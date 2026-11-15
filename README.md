# AI CCTV Control Room Operator

**Winner, DevFest Ilorin Hackathon 2025.**

An AI "control room operator" that watches a live CCTV feed, decides whether events you define have happened, and alerts a human operator in real time. Each alert comes with a short video clip and the model's explanation.

Control rooms often have more cameras than people watching them, so incidents get missed. Instead of training a separate computer-vision model for every kind of incident, operators describe the events they care about in plain language ("person climbing the fence", "vehicle blocking the gate"). A multimodal LLM (Google Gemini) then checks each few seconds of footage against those descriptions.

---

## How it works

```
RTSP / IP camera
      │
      ▼
VideoStreamChunker  (OpenCV + FFmpeg)
  splits the live stream into N-second MP4 clips
      │  video_chunk_queue
      ▼
VideoEventDetector  (Gemini 2.5)
  samples one frame per second → prompt with site context + event list
  → structured JSON: { event_code, detected, explanation }
      │  event_detection_queue
      ▼
Event collector
  ├─ writes detected events to PostgreSQL (SQLAlchemy)
  └─ broadcasts them over Server-Sent Events
      │
      ▼
Next.js control-room dashboard
  live alerts (toasts), event history, clip playback
```

**Pipeline design**
- **Three decoupled stages joined by bounded queues.** Stream capture, AI analysis and event persistence run on separate threads, so a slow model call never blocks frame capture. The bounded queues provide backpressure.
- **Time-based chunking.** The chunker cuts clips based on a monotonic clock, not frame counts, so clip length stays correct when a camera's FPS drifts.
- **Frame sampling.** The chunker takes one frame per second of video (first, last or random within each second) instead of sending whole clips. This keeps each Gemini request small and cheap.
- **Grounded prompting.** The system prompt tells the model to use only what is visible plus the operator's site context, and to return strict JSON for each event, with a boolean `detected` and a written `explanation`.
- **Evidence for every alert.** A detected event stores its timestamp, event code, the AI's explanation and the path of the clip that triggered it, so a human can confirm it in one click.

## Features

- Event definitions configured at runtime. Each event has a code, a description and detection guidelines.
- Choice of model: `gemini-2.5-pro`, `gemini-2.5-flash` or `gemini-2.5-flash-lite`. This trades accuracy against latency and cost.
- Adjustable clip length (default 5 s) and free-text site context ("warehouse loading bay, no staff after 22:00").
- Live alert stream over SSE, event history and in-browser clip playback.
- Start, stop and status controls for the monitoring service.

## Tech stack

| Layer | Tech |
|---|---|
| Video ingest | Python, OpenCV (FFmpeg backend), RTSP/HTTP streams |
| AI analysis | Google Gemini 2.5 (multimodal), Pillow |
| API | FastAPI, Pydantic, Server-Sent Events |
| Storage | PostgreSQL, SQLAlchemy |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Sonner |

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/start` | Start monitoring. Body: `model`, `rtsp_url`, `chunk_duration`, `context`, `events[]` |
| `POST` | `/stop` | Stop monitoring and shut the workers down |
| `GET` | `/status` | Service state and queue sizes |
| `GET` | `/events?limit=N` | Recent detected events |
| `GET` | `/events/id/{id}` | One event |
| `GET` | `/events/stream` | Live events (SSE) |
| `GET` | `/video?filepath=…` | Serve an event clip (restricted to the clips directory) |

Interactive docs: `http://127.0.0.1:8000/docs`

Example `/start` body:

```json
{
  "model": "gemini-2.5-flash",
  "rtsp_url": "rtsp://camera.local/stream",
  "chunk_duration": 5,
  "context": "Front gate of an office compound. Gate should stay closed after 20:00.",
  "events": [
    {
      "event_code": "GATE_OPEN",
      "event_description": "The main gate is open",
      "detection_guidelines": "Gate leaf visibly swung away from the closed position"
    }
  ]
}
```

## Getting started

**Prerequisites:** Python 3.11+, Node.js 20+, PostgreSQL, a Google Gemini API key, and an RTSP or IP camera stream. A phone running an IP-camera app works for testing.

### Backend

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt

cd backend
cp .env.example .env   # set DATABASE_URL and GOOGLE_API_KEY
uvicorn src.main:app --reload
```

On macOS, if `opencv-python` or `psycopg2-binary` fails to install, run `xcode-select --install` first.

### Frontend

```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Open `http://localhost:3000`, enter the stream URL, define your events and start monitoring. Detected events appear on the **Live** page.

## Project structure

```
backend/src/
  main.py               FastAPI app, CORS, lifespan
  config.py             settings from environment
  video/
    stream_chunker.py   live stream → timed MP4 clips
    event_detector.py   frame sampling + Gemini prompting + JSON parsing
    service.py          worker threads, queues, SSE fan-out
    router.py           REST + SSE endpoints
    models.py           EventLog table
frontend/app/
  page.tsx              configuration + controls
  live/page.tsx         live alert feed + clip playback
  actions.ts            API client
```

## Security notes

- **Clip serving is locked to the clips directory.** `/video` resolves the requested path, following symlinks and `..` segments, and serves it only if it sits inside `VIDEO_CHUNKS_DIR`. Anything else returns 404, so arbitrary server files such as `.env` or `/etc/passwd` can't be read through it.

## Known limitations and next steps

- **Clip retention.** Add automatic deletion of clips with no detection after a set time.
- **Multiple cameras.** The service runs one stream per process. The next step is a pool of chunkers sharing one detector.
- **Accuracy evaluation.** Build a labelled clip set to measure precision and recall per event and per model.
- **Authentication** for the dashboard and API before running it outside a local network.

## Credits

Built for DevFest Ilorin 2025 by [Daniel Olowoniyi](https://danielolowoniyi.com).

## License

MIT
