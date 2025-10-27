"""Database connection and session management."""
import logging
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from src.config import settings
from src.models import Base

logger = logging.getLogger(__name__)

_engine = None
_session_factory = None


def get_engine():
    """Get or create database engine."""
    global _engine
    if _engine is None and settings.DATABASE_URL:
        _engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
        Base.metadata.create_all(_engine)
    return _engine


def get_session() -> Generator[Session, None, None]:
    """Dependency for FastAPI to get database sessions."""
    if not settings.DATABASE_URL:
        logger.error("DATABASE_URL not configured")
        raise RuntimeError("Database not configured")

    engine = get_engine()
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


def init_db():
    """Initialize database connection and create tables."""
    if not settings.DATABASE_URL:
        logger.error("DATABASE_URL environment variable not set.")
        return False

    try:
        engine = get_engine()
        Base.metadata.create_all(engine)
        logger.info("Database connection successful and tables verified.")
        return True
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        return False

