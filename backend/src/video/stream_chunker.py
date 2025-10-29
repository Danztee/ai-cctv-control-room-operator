"""Video stream chunker for processing RTSP streams."""
import datetime
import logging
import os
import queue
import time
import threading
from typing import Optional
import cv2

logger = logging.getLogger(__name__)
# Prefer H.264 for widest browser compatibility (Chrome, Safari, Firefox)
# Note: This requires FFmpeg with H.264 encoder available to OpenCV.
DEFAULT_FOURCC = "H264"
DEFAULT_CONTAINER = "mp4"


class VideoStreamChunker:
    def __init__(
        self,
        stream_url: str,
        output_dir: str,
        chunk_duration: int = 5,
        output_queue: Optional[queue.Queue] = None,
        fourcc: str = DEFAULT_FOURCC,
        container: str = DEFAULT_CONTAINER,
        max_read_timeouts: int = 30,
        max_connect_failures: int = 10,
        use_tcp: bool = True,
    ):
        if chunk_duration <= 0:
            raise ValueError("Chunk duration must be positive")
        if not (
            stream_url.startswith("rtsp://")
            or stream_url.startswith("http://")
            or stream_url.startswith("https://")
        ):
            raise ValueError("Stream URL must be RTSP or HTTP(S)")

        self.stream_url = stream_url
        self.output_dir = output_dir
        self.chunk_duration = chunk_duration
        self.output_queue = output_queue
        self.fourcc = cv2.VideoWriter_fourcc(*fourcc)
        self.container = container
        self.max_read_timeouts = max_read_timeouts
        self.max_connect_failures = max_connect_failures
        self.use_tcp = use_tcp

        self.is_running = False
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

        # Stats
        self.chunk_count = 0
        self.reconnect_count = 0
        self.total_frames = 0
        self.stream_start_time = 0.0

        try:
            os.makedirs(output_dir, exist_ok=True)
            logger.info(f"Ensured output directory exists: {output_dir}")
        except OSError as e:
            logger.error(f"Failed to create output directory {output_dir}: {e}")
            raise

    def start(self) -> None:
        """Start chunker in background thread."""
        if self.is_running:
            logger.warning("Chunker is already running.")
            return

        self.is_running = True
        self._stop_event.clear()
        self.stream_start_time = time.monotonic()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info(f"Started video stream chunker: {self.stream_url}")

    def stop(self) -> None:
        """Request graceful shutdown."""
        if not self.is_running:
            logger.warning("Chunker is not running.")
            return
        logger.info("Stopping video stream chunker...")
        self._stop_event.set()
        self.is_running = False

    def join(self, timeout: Optional[float] = None) -> None:
        """Wait for chunker thread to finish."""
        if self._thread:
            self._thread.join(timeout)

    def is_healthy(self) -> bool:
        """Check if stream is active and healthy."""
        if not self.is_running:
            return False
        # You can extend with last_frame_time, etc.
        return True

    def _run(self):
        """Internal run loop."""
        try:
            self.process_stream()
        except Exception as e:
            logger.exception(f"Unexpected error in chunker thread: {e}")
        finally:
            self.is_running = False
            logger.info("Video stream chunker thread terminated.")

    def _open_stream(self):
        """Open stream with minimal buffering. Use TCP for RTSP."""
        if self.use_tcp and self.stream_url.startswith("rtsp://"):
            os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;tcp'

        cap = cv2.VideoCapture(self.stream_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimal buffer
        cap.set(cv2.CAP_PROP_FPS, 30)       # Hint FPS

        return cap

    def _finalize_chunk(
        self,
        writer: cv2.VideoWriter,
        temp_file: str,
        start_time: datetime.datetime,
        frame_count: int,
    ) -> None:
        """Finalize and rename chunk."""
        if not writer or not temp_file or frame_count == 0:
            return

        try:
            writer.release()
            time.sleep(0.2)  # Let filesystem flush

            if not os.path.exists(temp_file) or os.path.getsize(temp_file) == 0:
                logger.warning(f"Chunk {temp_file} is empty. Skipping.")
                try:
                    os.remove(temp_file)
                except:
                    pass
                return

            end_time = datetime.datetime.now(datetime.timezone.utc)
            start_str = start_time.strftime("%Y%m%d%H%M%S")
            end_str = end_time.strftime("%Y%m%d%H%M%S")
            final_file = os.path.join(
                self.output_dir, f"{start_str}_{end_str}.{self.container}"
            )
            os.rename(temp_file, final_file)

            self.chunk_count += 1
            logger.info(f"Chunk #{self.chunk_count}: {final_file} ({frame_count} frames)")

            if self.output_queue:
                try:
                    self.output_queue.put(final_file, timeout=1)
                except queue.Full:
                    logger.error("Output queue full. Dropped chunk path.")
                except Exception as qe:
                    logger.error(f"Queue error: {qe}")

        except Exception as e:
            logger.error(f"Failed to finalize chunk {temp_file}: {e}")

    def process_stream(self):
        cap = None
        writer = None
        temp_file = None
        start_time_utc = None
        chunk_start_monotonic = 0.0
        frames_in_chunk = 0
        target_frames_per_chunk = 0
        fps = 30
        width = height = 0

        retry_delay = 1
        consecutive_failures = 0
        read_timeout_count = 0

        while not self._stop_event.is_set():
            try:
                # === Reconnect Logic ===
                if not cap or not cap.isOpened():
                    if cap:
                        cap.release()
                        cap = None

                    logger.info(f"Connecting to stream: {self.stream_url}")
                    cap = self._open_stream()

                    if not cap.isOpened():
                        consecutive_failures += 1
                        logger.warning(
                            f"Failed to open stream ({consecutive_failures}/{self.max_connect_failures})"
                        )
                        if consecutive_failures >= self.max_connect_failures:
                            logger.error("Max connection failures reached. Stopping.")
                            break
                        time.sleep(retry_delay)
                        retry_delay = min(retry_delay * 2, 60)
                        continue

                    # Reset on success
                    self.reconnect_count += 1
                    consecutive_failures = 0
                    retry_delay = 1
                    read_timeout_count = 0

                    # Get stream properties
                    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
                    fps = max(1, min(fps, 120))
                    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

                    if width <= 0 or height <= 0:
                        logger.error(f"Invalid dimensions: {width}x{height}")
                        cap.release()
                        cap = None
                        time.sleep(1)
                        continue

                    target_frames_per_chunk = max(1, fps * self.chunk_duration)
                    logger.info(f"Stream opened: {width}x{height} @ {fps} FPS")

                    # Start new chunk on reconnect
                    if writer:
                        self._finalize_chunk(writer, temp_file, start_time_utc, frames_in_chunk)
                        writer = None
                    chunk_start_monotonic = time.monotonic()
                    frames_in_chunk = 0

                # === Read Frame ===
                ret, frame = cap.read()
                if not ret or frame is None:
                    read_timeout_count += 1
                    if read_timeout_count >= self.max_read_timeouts:
                        logger.warning("Read timeout. Reconnecting...")
                        if writer:
                            self._finalize_chunk(writer, temp_file, start_time_utc, frames_in_chunk)
                            writer = None
                        cap.release()
                        cap = None
                        read_timeout_count = 0
                        time.sleep(retry_delay)
                        retry_delay = min(retry_delay * 2, 60)
                    else:
                        time.sleep(0.05)
                    continue

                read_timeout_count = 0
                self.total_frames += 1
                now = time.monotonic()

                # === Start New Chunk ===
                time_elapsed = now - chunk_start_monotonic
                should_start_new = (
                    chunk_start_monotonic == 0 or
                    time_elapsed >= self.chunk_duration or
                    (target_frames_per_chunk > 0 and frames_in_chunk >= target_frames_per_chunk)
                )

                if should_start_new and writer and frames_in_chunk > 0:
                    self._finalize_chunk(writer, temp_file, start_time_utc, frames_in_chunk)
                    writer = None

                if not writer:
                    chunk_start_monotonic = now
                    start_time_utc = datetime.datetime.now(datetime.timezone.utc)
                    start_str = start_time_utc.strftime("%Y%m%d%H%M%S")
                    temp_file = os.path.join(self.output_dir, f"{start_str}_ongoing.{self.container}")

                    writer = cv2.VideoWriter(temp_file, self.fourcc, fps, (width, height))
                    if not writer.isOpened():
                        logger.error(f"Failed to open VideoWriter: {temp_file}")
                        writer = None
                        time.sleep(1)
                        continue
                    frames_in_chunk = 0
                    logger.debug(f"New chunk: {temp_file}")

                # === Write Frame ===
                if writer and writer.isOpened():
                    writer.write(frame)
                    frames_in_chunk += 1

            except cv2.error as e:
                logger.error(f"OpenCV error: {e}")
                if cap:
                    cap.release()
                    cap = None
                if writer:
                    writer.release()
                    writer = None
                time.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, 60)

            except Exception as e:
                logger.exception(f"Unexpected error: {e}")
                time.sleep(5)

        # === Final Cleanup ===
        if writer and frames_in_chunk > 0:
            self._finalize_chunk(writer, temp_file, start_time_utc, frames_in_chunk)
        if writer:
            writer.release()
        if cap:
            cap.release()

        uptime = time.monotonic() - self.stream_start_time
        logger.info(
            f"Chunker stopped. Uptime: {uptime:.1f}s, "
            f"Chunks: {self.chunk_count}, Frames: {self.total_frames}, "
            f"Reconnects: {self.reconnect_count}"
        )

    # === Context Manager ===
    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()
        self.join()


# === Example Usage ===
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    )

    RTSP_URL = "rtsp://admin:password@192.168.1.100:554/stream1"
    OUTPUT_DIR = "./chunks"
    q = queue.Queue(maxsize=10)

    chunker = VideoStreamChunker(
        stream_url=RTSP_URL,
        output_dir=OUTPUT_DIR,
        chunk_duration=10,
        output_queue=q,
        fourcc="H264",  # or "mp4v"
        container="mp4",
        use_tcp=True
    )

    try:
        with chunker:
            logger.info("Chunker running... Press Ctrl+C to stop.")
            while True:
                try:
                    chunk_path = q.get(timeout=1)
                    logger.info(f"New chunk ready: {chunk_path}")
                except queue.Empty:
                    continue
    except KeyboardInterrupt:
        logger.info("Shutting down...")