"""Pydantic schemas for video domain."""
from typing import List

from pydantic import BaseModel


class EventConfigSchema(BaseModel):
    """Schema for event configuration."""
    event_code: str
    event_description: str
    detection_guidelines: str


class AppConfigSchema(BaseModel):
    """Schema for application configuration."""
    model: str
    rtsp_url: str
    chunk_duration: int
    context: str
    events: List[EventConfigSchema]


class EventResponseSchema(BaseModel):
    """Schema for event response."""
    event_id: int
    event_timestamp: str
    event_code: str
    event_description: str
    event_video_url: str
    event_detection_explanation_by_ai: str


class EventListResponseSchema(BaseModel):
    """Schema for event list response."""
    events: List[EventResponseSchema]

