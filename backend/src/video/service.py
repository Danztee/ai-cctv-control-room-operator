"""Business logic for video processing service."""
import logging
import os
import queue
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.config import settings
from src.video.exceptions import (
    ServiceAlreadyRunningError,
    ServiceNotRunningError,
    InvalidConfigError,
    QUEUE_MAXSIZE,
)
from src.video.event_detector import VideoEventDetector
from src.video.stream_chunker import VideoStreamChunker

logger = logging.getLogger(__name__)

# Global service state
video_chunk_queue: Optional[queue.Queue] = None
event_detection_queue: Optional[queue.Queue] = None
service_active = False
threads: List[threading.Thread] = []
current_config: Optional[Dict[str, Any]] = None
shutdown_event = threading.Event()


def _ensure_queues():
    """Ensure queues are initialized."""
    global video_chunk_queue, event_detection_queue
    if video_chunk_queue is None:
        video_chunk_queue = queue.Queue(maxsize=QUEUE_MAXSIZE)
    if event_detection_queue is None:
        event_detection_queue = queue.Queue(maxsize=QUEUE_MAXSIZE)


def _validate_config(config: Dict[str, Any]) -> None:
    """Validate configuration."""
    required_keys = [
        "rtsp_url",
        "chunk_duration",
        "model",
        "context",
        "events",
    ]
    if not all(key in config for key in required_keys):
        raise InvalidConfigError(
            f"Config is missing required keys: {required_keys}"
        )


def _video_processing_worker(config: Dict[str, Any], stop_event: threading.Event):
    """Background worker for video processing."""
    logger.info("Video processing worker started.")
    detector: Optional[VideoEventDetector] = None
 
    detector = VideoEventDetector(
        model=config["model"],
        api_key=settings.GOOGLE_API_KEY or "",
        output_queue=event_detection_queue,
    )
      

    context = config.get("context", "")
    events = config.get("events", [])

    while not stop_event.is_set():
        try:
            video_path = video_chunk_queue.get(timeout=1)
            logger.info(f"Processing video chunk: {video_path}")
            if detector is not None:
                detector.detect_events(video_path=video_path, events=events, context=context)
            else:
                # Skip AI detection; still mark task done
                pass
            video_chunk_queue.task_done()
        except queue.Empty:
            continue
        except Exception as e:
            logger.exception(f"Error during video processing: {e}")
            video_chunk_queue.task_done()

    logger.info("Video processing worker stopped.")


def _event_collection_worker(stop_event: threading.Event, db_callback):
    """Background worker for event collection."""
    logger.info("Event collection worker started.")

    while not stop_event.is_set():
        try:
            result = event_detection_queue.get(timeout=1)
            logger.info(f"Received event data: {result.get('event_code')}")

            try:
                event_data = {
                    "event_timestamp": result.get("event_timestamp", datetime.now()),
                    "event_code": result.get("event_code", "unknown-code"),
                    "event_description": result.get(
                        "event_description", "Unknown event description"
                    ),
                    "event_detection_explanation_by_ai": result.get(
                        "event_detection_explanation_by_ai", ""
                    ),
                    "event_video_url": result.get("event_video_url", ""),
                }

                db_callback(event_data)
                logger.info("Event written to database.")

            except Exception as e:
                logger.exception(f"Error processing event: {e}")
            finally:
                event_detection_queue.task_done()

        except queue.Empty:
            continue
        except Exception as e:
            logger.exception(f"Error collecting event: {e}")

    logger.info("Event collection worker stopped.")


def start_service(config: Dict[str, Any], db_callback) -> Dict[str, Any]:
    """Start the video processing service."""
    global shutdown_event, service_active, threads, current_config

    if service_active:
        raise ServiceAlreadyRunningError()

    logger.info("Starting services...")
    _ensure_queues()
    current_config = config.copy()

    try:
        _validate_config(config)
    except InvalidConfigError:
        raise

    logger.info(f"DATABASE_URL configured: {bool(settings.DATABASE_URL)}")
    if not settings.DATABASE_URL:
        logger.error(f"DATABASE_URL is None or empty. Current value: {settings.DATABASE_URL}")
        raise InvalidConfigError("DATABASE_URL not configured")

    try:
        chunker = VideoStreamChunker(
            stream_url=config["rtsp_url"],
            output_dir=settings.VIDEO_CHUNKS_DIR,
            chunk_duration=config["chunk_duration"],
            output_queue=video_chunk_queue,
        )
        logger.info(f"Video stream chunker initialized: {settings.VIDEO_CHUNKS_DIR}")
    except Exception as e:
        logger.error(f"Failed to initialize VideoStreamChunker: {e}")
        raise InvalidConfigError(f"Failed to initialize video chunker: {e}")

    video_proc_thread = threading.Thread(
        target=_video_processing_worker,
        args=(config, shutdown_event),
        daemon=True,
        name="VideoProcessor",
    )
    event_collect_thread = threading.Thread(
        target=_event_collection_worker,
        args=(shutdown_event, db_callback),
        daemon=True,
        name="EventCollector",
    )
    chunker_thread = threading.Thread(
        target=chunker.start,
        daemon=True,
        name="StreamChunker",
    )

    threads = [video_proc_thread, event_collect_thread, chunker_thread]

    for t in threads:
        t.start()

    service_active = True
    logger.info("All services started.")
    return {"status": "Services started successfully"}


def stop_service() -> Dict[str, Any]:
    """Stop the video processing service."""
    global shutdown_event, service_active, threads, current_config

    if not service_active:
        raise ServiceNotRunningError()

    logger.info("Stopping services...")
    shutdown_event.set()
    shutdown_event = threading.Event()

    timeout_seconds = 10
    for t in threads:
        if t.is_alive():
            t.join(timeout=timeout_seconds)
            if t.is_alive():
                logger.warning(f"Thread {t.name} did not finish within timeout.")

    service_active = False
    threads = []
    current_config = None
    logger.info("All services stopped.")
    return {"status": "Services stopped successfully"}


def get_status() -> Dict[str, Any]:
    """Get service status."""
    global service_active, current_config, video_chunk_queue, event_detection_queue

    queue_info = {
        "video_chunks_queue_size": (video_chunk_queue.qsize() if video_chunk_queue else 0),
        "event_detection_queue_size": (event_detection_queue.qsize() if event_detection_queue else 0),
    }

    response = {"service_active": service_active, "queue_info": queue_info}

    if current_config:
        response["stream_url"] = current_config.get("rtsp_url", "")

    return response

