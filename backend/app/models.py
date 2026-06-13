from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    """A backend-owned account boundary.

    Devices/extensions authenticate with bearer tokens that resolve to one
    user. Event/session/snapshot queries are always scoped through this ID.
    """

    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    label = Column(Text, nullable=True)

    devices = relationship("DeviceToken", back_populates="user")
    sessions = relationship("Session", back_populates="user")
    events = relationship("Event", back_populates="user")


class DeviceToken(Base):
    """A single extension/UI token, stored as a hash."""

    __tablename__ = "device_tokens"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    device_name = Column(Text, nullable=True)
    install_id = Column(String(128), nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_seen_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="devices")


class Session(Base):
    """A semantic work session — a coherent chunk of attention on a task.

    Built by the heuristic sessionizer over the raw event stream. The AI
    layer (Phase 4) generates structured cognitive snapshots over these.
    """

    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    started_at = Column(DateTime, nullable=False, index=True)
    ended_at = Column(DateTime, nullable=True, index=True)
    status = Column(String(16), nullable=False, default="active", index=True)  # active | closed
    # Phase 5: why the session closed. None on active sessions and on clean
    # context_switch boundaries. Set on idle / drift / gap closures so the
    # auto-snapshot trigger can fire and the UI can mark interrupted work.
    interruption_type = Column(String(24), nullable=True, index=True)
    title = Column(Text, nullable=True)  # mirrors ai_task after snapshot generation
    primary_domain = Column(String(255), nullable=True)
    event_count = Column(Integer, nullable=False, default=0)
    total_active_seconds = Column(Float, nullable=False, default=0.0)
    keywords = Column(JSON, nullable=True)  # heuristic title-token bag

    # --- Phase 4: AI-generated cognitive snapshot --------------------------
    ai_task = Column(Text, nullable=True)
    ai_intent = Column(Text, nullable=True)
    ai_progress = Column(JSON, nullable=True)         # list[str]
    ai_blockers = Column(JSON, nullable=True)         # list[str]
    ai_next_steps = Column(JSON, nullable=True)       # list[str]
    snapshot_generated_at = Column(DateTime, nullable=True)
    snapshot_model = Column(String(64), nullable=True)

    user = relationship("User", back_populates="sessions")
    events = relationship("Event", back_populates="session", order_by="Event.timestamp")


class Event(Base):
    """A single raw workflow signal emitted by the browser extension.

    Belongs to at most one semantic `Session` (assigned at ingest time by
    the sessionizer; nullable for events that arrived before Phase 2 or
    that the heuristic decided to drop, e.g. very short spans).
    """

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    received_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    event_type = Column(String(32), nullable=False, index=True)
    app = Column(String(64), nullable=False, default="Chrome")
    title = Column(Text, nullable=True)
    url = Column(Text, nullable=True)
    domain = Column(String(255), nullable=True, index=True)
    duration_seconds = Column(Float, nullable=True)
    browsing_session_id = Column(String(64), nullable=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True, index=True)
    extra = Column(JSON, nullable=True)

    user = relationship("User", back_populates="events")
    session = relationship("Session", back_populates="events")


Index("ix_events_type_timestamp", Event.event_type, Event.timestamp)
Index("ix_events_user_type_timestamp", Event.user_id, Event.event_type, Event.timestamp)
Index("ix_sessions_user_started", Session.user_id, Session.started_at)
