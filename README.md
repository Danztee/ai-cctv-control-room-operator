# AI CCTV Control Room Operator

AI-powered CCTV event detection system using Google Gemini for real-time video analysis.

## Project Structure

```
ai-cctv-control-room-operator/
├── backend/          # FastAPI backend
├── frontend/         # Next.js frontend
├── venv/            # Python virtual environment
├── video_chunks/    # Generated video chunks (created by backend)
└── README.md
```

## Quick Start

### Backend Setup

```bash
# From project root
source venv/bin/activate
cd backend

# Set environment variables
export DATABASE_URL=postgresql://user:pass@localhost:5432/db
export GOOGLE_API_KEY=your_google_api_key

# Run the server
uvicorn src.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Required backend environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_API_KEY` - Google Gemini API key

## API Documentation

Once backend is running:

- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc
