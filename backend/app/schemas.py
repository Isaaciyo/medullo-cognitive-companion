from datetime import datetime
from typing import Any, Literal, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

EventType = Literal[
    "tab_switch",
    "page_focus",
    "page_loaded",
    "idle",
    "active",
    "search_query",
    "interruption_detected",
]


class EventIn(BaseModel):
    timestamp: datetime
    event_type: EventType
    app: str = "Chrome"
    title: Optional[str] = None
    url: Optional[str] = None
    duration_seconds: Optional[float] = Field(default=None, ge=0)
    browsing_session_id: Optional[str] = None
    extra: Optional[dict[str, Any]] = None

    @field_validator("title", "url")
    @classmethod
    def _strip(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if isinstance(v, str) else v

    def domain(self) -> Optional[str]:
        if not self.url:
            return None
        try:
            host = urlparse(self.url).hostname
            return host.lower() if host else None
        except Exception:
            return None


class EventBatch(BaseModel):
    events: list[EventIn] = Field(default_factory=list, max_length=500)


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    received_at: datetime
    event_type: str
    app: str
    title: Optional[str]
    url: Optional[str]
    domain: Optional[str]
    duration_seconds: Optional[float]
    browsing_session_id: Optional[str]
    session_id: Optional[int]


class IngestResult(BaseModel):
    accepted: int


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    started_at: datetime
    ended_at: Optional[datetime]
    status: str
    title: Optional[str]
    primary_domain: Optional[str]
    event_count: int
    total_active_seconds: float
    keywords: Optional[list[str]]
    interruption_type: Optional[str] = None
    snapshot_generated_at: Optional[datetime] = None


class SessionDetail(SessionOut):
    events: list[EventOut]


class RebuildResult(BaseModel):
    sessions_created: int
    events_assigned: int
    events_skipped: int


class SnapshotOut(BaseModel):
    """AI-generated cognitive snapshot for a session."""

    model_config = ConfigDict(from_attributes=True)

    session_id: int
    task: Optional[str]
    intent: Optional[str]
    progress: Optional[list[str]]
    blockers: Optional[list[str]]
    next_steps: Optional[list[str]]
    generated_at: Optional[datetime]
    model: Optional[str]
