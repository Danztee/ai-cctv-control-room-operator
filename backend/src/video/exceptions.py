"""Domain-specific exceptions for video."""
from enum import Enum
from fastapi import HTTPException
from typing import Optional


class ErrorCode(str, Enum):
    """Error codes for video domain."""
    # Service errors
    SERVICE_ALREADY_RUNNING = "SERVICE_ALREADY_RUNNING"
    SERVICE_NOT_RUNNING = "SERVICE_NOT_RUNNING"
    INVALID_CONFIG = "INVALID_CONFIG"
    DATABASE_NOT_CONFIGURED = "DATABASE_NOT_CONFIGURED"
    # Event errors
    EVENT_NOT_FOUND = "EVENT_NOT_FOUND"
    INVALID_VIDEO_PATH = "INVALID_VIDEO_PATH"
    # Processing errors
    VIDEO_PROCESSING_FAILED = "VIDEO_PROCESSING_FAILED"
    FRAME_EXTRACTION_FAILED = "FRAME_EXTRACTION_FAILED"
    AI_DETECTION_FAILED = "AI_DETECTION_FAILED"


# Queue sizes
QUEUE_MAXSIZE = 100

# Video processing defaults
DEFAULT_CHUNK_DURATION = 5


class ServiceAlreadyRunningError(HTTPException):
    """Service is already running."""

    def __init__(self):
        super().__init__(
            status_code=409,
            detail={
                "error_code": ErrorCode.SERVICE_ALREADY_RUNNING,
                "message": "Service is already running",
            },
        )


class ServiceNotRunningError(HTTPException):
    """Service is not running."""

    def __init__(self):
        super().__init__(
            status_code=409,
            detail={
                "error_code": ErrorCode.SERVICE_NOT_RUNNING,
                "message": "Service is not running",
            },
        )


class InvalidConfigError(HTTPException):
    """Invalid configuration."""

    def __init__(self, message: str):
        super().__init__(
            status_code=400,
            detail={
                "error_code": ErrorCode.INVALID_CONFIG,
                "message": message,
            },
        )


class EventNotFoundError(HTTPException):
    """Event not found."""

    def __init__(self, event_id: int):
        super().__init__(
            status_code=404,
            detail={
                "error_code": ErrorCode.EVENT_NOT_FOUND,
                "message": f"Event {event_id} not found",
            },
        )


class InvalidVideoPathError(HTTPException):
    """Invalid video path."""

    def __init__(self, path: str):
        super().__init__(
            status_code=404,
            detail={
                "error_code": ErrorCode.INVALID_VIDEO_PATH,
                "message": f"Video file at path {path} not found",
            },
        )

