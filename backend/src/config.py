"""Global configuration and settings."""
import os
from typing import Optional


class Settings:
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")

    # Google Gemini API
    GOOGLE_API_KEY: Optional[str] = os.getenv("GOOGLE_API_KEY")

    # Video processing - store in project root
    _backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    VIDEO_CHUNKS_DIR: str = os.path.join(_backend_dir, "video_chunks")

    # API
    API_TITLE: str = "Video Event Detection API"
    API_HOST: str = "127.0.0.1"
    API_PORT: int = 8000


settings = Settings()

