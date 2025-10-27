"""Database models for video domain."""
from sqlalchemy import Column, DateTime, Integer, String, Text

from src.models import Base


class EventLog(Base):
    """Event log model."""

    __tablename__ = "event_logs"

    event_id = Column(Integer, primary_key=True, autoincrement=True)
    event_timestamp = Column(DateTime(timezone=True), nullable=False)
    event_code = Column(String(20), nullable=False)
    event_description = Column(Text, nullable=False)
    event_video_url = Column(String(255), nullable=False)
    event_detection_explanation_by_ai = Column(Text, nullable=False)

