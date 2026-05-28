"""Phase 5: interruption detection + auto-snapshot trigger.

The brief describes this as one of the project's "magic" moments — by the
time the user returns to their laptop, the snapshot for what they were
just doing should already be waiting.

Mechanism:
  1. The sessionizer (Phase 2.1+) classifies every session closure with an
     `interruption_type`: idle / drift / gap / context_switch.
  2. The events ingest path (Phase 5) accumulates which sessions just got
     closed-by-interruption during the current batch.
  3. After response, those sessions are passed to `auto_snapshot_session()`
     as FastAPI BackgroundTasks. Each task gets its own DB session and
     calls Gemini in the threadpool — does not block the next request.

Sessions that close on `context_switch` (clean topic pivot) are NOT auto-
snapshotted. The user can always manually `POST /sessions/{id}/snapshot`
if they want one.
"""

from __future__ import annotations

import logging
from typing import Iterable

from .ai import apply_snapshot_to_session, generate_snapshot
from .database import SessionLocal
from .models import Event, Session

logger = logging.getLogger(__name__)

# Closure reasons that trigger an automatic snapshot. `context_switch` is a
# natural boundary and is excluded — the user pivoted intentionally.
INTERRUPTION_TYPES_AUTO_SNAPSHOT = frozenset({"idle", "drift", "gap"})

# Skip auto-snapshot for sessions too thin to be worth Gemini's attention.
# Manual /snapshot still works at any size; this gate is just for the
# automatic firehose.
AUTO_SNAPSHOT_MIN_EVENTS = 4
AUTO_SNAPSHOT_MIN_ACTIVE_SECONDS = 30.0


def should_auto_snapshot(session: Session) -> bool:
    """Pure predicate: is this session worth auto-snapshotting?

    Caller (the ingest router) uses this to decide whether to enqueue the
    background task. The background task re-checks before calling Gemini
    so a race condition (e.g. concurrent manual snapshot) can't cause a
    double generation.
    """
    if session.status != "closed":
        return False
    if session.interruption_type not in INTERRUPTION_TYPES_AUTO_SNAPSHOT:
        return False
    if session.snapshot_generated_at is not None:
        return False
    if (session.event_count or 0) < AUTO_SNAPSHOT_MIN_EVENTS:
        return False
    if (session.total_active_seconds or 0.0) < AUTO_SNAPSHOT_MIN_ACTIVE_SECONDS:
        return False
    return True


def auto_snapshot_session(session_id: int) -> None:
    """Background task: generate and persist a snapshot for one session.

    Runs in the FastAPI threadpool. Owns its own DB session — the request-
    scoped session has already been closed by the time this fires.

    Errors are logged but never re-raised: a failed auto-snapshot must
    not break unrelated requests, and the user can always trigger it
    manually via POST /sessions/{id}/snapshot.
    """
    db = SessionLocal()
    try:
        session = db.get(Session, session_id)
        if session is None:
            logger.warning("auto_snapshot: session %s vanished before task ran", session_id)
            return
        if not should_auto_snapshot(session):
            # Re-check the gate now that we hold a fresh session — a
            # concurrent manual snapshot may have already filled it.
            return

        events = (
            db.query(Event)
            .filter(Event.session_id == session_id)
            .order_by(Event.timestamp.asc())
            .all()
        )
        if not events:
            return

        logger.info(
            "auto_snapshot: generating for session %s (interruption=%s, events=%d)",
            session_id,
            session.interruption_type,
            len(events),
        )
        try:
            snap = generate_snapshot(session, events)
        except Exception as e:
            # Don't crash the worker on transient API failures. The user
            # can retry manually if they want this snapshot urgently.
            logger.error("auto_snapshot: Gemini failed for session %s: %s", session_id, e)
            return

        apply_snapshot_to_session(session, snap)
        db.commit()
        logger.info("auto_snapshot: session %s → %r", session_id, snap.task)
    finally:
        db.close()


def collect_interrupted_session_ids(
    sessions: Iterable[Session | None],
) -> set[int]:
    """Helper for the ingest router: given the sessions touched by a batch,
    return the IDs that should be auto-snapshotted. Dedupes naturally."""
    out: set[int] = set()
    for s in sessions:
        if s is not None and should_auto_snapshot(s):
            out.add(s.id)
    return out
