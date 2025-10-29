"""API router for video domain."""
import os
import json
import asyncio
from typing import Callable

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from src.database import get_session
from src.video.schemas import (
    AppConfigSchema,
    EventResponseSchema,
    EventListResponseSchema,
)
from src.video.models import EventLog
from src.video.service import start_service, stop_service, get_status
from src.video.service import subscribe_to_events, unsubscribe_from_events
from src.video.exceptions import (
    EventNotFoundError,
    InvalidVideoPathError,
)
from src.config import settings

router = APIRouter()

# WebRTC removed


def _get_db_write_callback() -> Callable[[dict], bool]:
    """Get a database write callback for the service."""
    def write_event(event_data: dict) -> bool:
        """Write event to database using a fresh session."""
        if not settings.DATABASE_URL:
            return False
        
        try:
            session = next(get_session())
            event = EventLog(**event_data)
            session.add(event)
            session.commit()
            return True
        except Exception:
            session.rollback()
            return False
        finally:
            session.close()
    
    return write_event


@router.post("/start")
async def start(config: AppConfigSchema):
    """Start video processing service."""
    try:
        return start_service(config.dict(), _get_db_write_callback())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop():
    """Stop video processing service."""
    try:
        return stop_service()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def status():
    """Get service status."""
    return get_status()


@router.get("/events", response_model=EventListResponseSchema)
async def get_events(
    limit: int = 100,
    session: Session = Depends(get_session)
):
    """Get recent events."""
    try:
        query = session.query(EventLog).order_by(EventLog.event_timestamp.desc()).limit(limit)
        events = [
            {
                "event_id": event.event_id,
                "event_timestamp": event.event_timestamp.isoformat(),
                "event_code": event.event_code,
                "event_description": event.event_description,
                "event_video_url": event.event_video_url,
                "event_detection_explanation_by_ai": event.event_detection_explanation_by_ai,
            }
            for event in query.all()
        ]
        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/events/id/{event_id}", response_model=EventResponseSchema)
async def get_event(
    event_id: int,
    session: Session = Depends(get_session)
):
    """Get a specific event."""
    event = session.query(EventLog).filter(EventLog.event_id == event_id).first()
    if not event:
        raise EventNotFoundError(event_id)

    return {
        "event_id": event.event_id,
        "event_timestamp": event.event_timestamp.isoformat(),
        "event_code": event.event_code,
        "event_description": event.event_description,
        "event_video_url": event.event_video_url,
        "event_detection_explanation_by_ai": event.event_detection_explanation_by_ai,
    }


@router.get("/events/stream")
async def stream_events():
    """Server-Sent Events stream for real-time event updates."""
    subscriber_queue = subscribe_to_events()

    async def event_generator():
      try:
        while True:
            # Block on the thread-safe queue in a worker thread
            event = await asyncio.to_thread(subscriber_queue.get)
            payload = {
                "event_id": event.get("event_id"),
                "event_timestamp": (
                    event.get("event_timestamp").isoformat()
                    if hasattr(event.get("event_timestamp"), "isoformat")
                    else event.get("event_timestamp")
                ),
                "event_code": event.get("event_code"),
                "event_description": event.get("event_description"),
                "event_video_url": event.get("event_video_url"),
                "event_detection_explanation_by_ai": event.get(
                    "event_detection_explanation_by_ai", ""
                ),
            }
            data = json.dumps(payload)
            yield f"data: {data}\n\n"
      except asyncio.CancelledError:
        # Client disconnected
        pass
      finally:
        unsubscribe_from_events(subscriber_queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/video")
async def get_video(filepath: str):
    """Get video file."""
    if not os.path.isfile(filepath):
        raise InvalidVideoPathError(filepath)

    filename = os.path.basename(filepath)
    return FileResponse(path=filepath, media_type="video/mp4", filename=filename)


# WebRTC endpoint removed
