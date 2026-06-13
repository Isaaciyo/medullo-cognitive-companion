import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine, ensure_schema
from .routers import auth, events, sessions

load_dotenv()

Base.metadata.create_all(bind=engine)
ensure_schema()

app = FastAPI(
    title="Medullo Second Brain",
    description="Cognitive continuity event pipeline (Phase 1: event collection).",
    version="0.1.0",
)

# CORS origins come from env. Defaults cover local dev; deploys should set
# `CORS_ORIGINS` to a comma-separated list including the deployed frontend
# domain (e.g. "https://medullo.vercel.app"). Any value containing a `*`
# wildcard gets compiled into the regex pass instead of the literal list.
_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
_raw_origins = os.getenv("CORS_ORIGINS", _default_origins)
_explicit: list[str] = []
_wildcards: list[str] = []
for o in (item.strip() for item in _raw_origins.split(",")):
    if not o:
        continue
    (_wildcards if "*" in o else _explicit).append(o)

# Always allow chrome-extension://<any-id> so both unpacked-dev and Web-Store
# installs work without env tweaks. Append any user-provided wildcards.
_extra_regex = "|".join(w.replace(".", r"\.").replace("*", ".*") for w in _wildcards)
_origin_regex = r"chrome-extension://.*"
if _extra_regex:
    _origin_regex = f"({_origin_regex})|({_extra_regex})"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_explicit,
    allow_origin_regex=_origin_regex,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(auth.router)
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
