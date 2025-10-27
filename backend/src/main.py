"""Main FastAPI application."""
import logging
import signal
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from .env file
load_dotenv()

from src.config import settings
from src.database import init_db
from src.video.router import router as video_router

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    # Startup
    logger.info("Starting application...")
    init_db()
    yield
    # Shutdown
    logger.info("Shutting down application...")


app = FastAPI(
    title=settings.API_TITLE,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(video_router, tags=["video"])


def _signal_handler(signum, frame):
    """Handle shutdown signals."""
    logger.warning(f"Received signal {signum}. Initiating graceful shutdown...")


if __name__ == "__main__":
    import uvicorn

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)

