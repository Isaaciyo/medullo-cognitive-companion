import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine, ensure_schema
from .routers import events, sessions

load_dotenv()

Base.metadata.create_all(bind=engine)
ensure_schema()

app = FastAPI(
    title="Medullo Second Brain",
    description="Cognitive continuity event pipeline (Phase 1: event collection).",
    version="0.1.0",
)

cors_origins = os.getenv("CORS_ORIGINS", "chrome-extension://*,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins if o.strip()],
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(sessions.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "medullo-second-brain", "phase": 1}


@app.get("/")
def root() -> dict:
    return {
        "name": "Medullo Second Brain",
        "tagline": "Semantic RAM for human cognition.",
        "phase": 1,
        "docs": "/docs",
    }
