from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session as DbSession

from ..ai import apply_snapshot_to_session, generate_snapshot
from ..auth import get_current_user
from ..database import get_db
from ..models import Event, Session, User
from ..schemas import EventOut, RebuildResult, SessionDetail, SessionOut, SnapshotOut
from ..sessionization import get_active_session, rebuild_all_sessions

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=list[SessionOut])
def list_sessions(
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=500),
    status: Optional[str] = Query(default=None, pattern="^(active|closed)$"),
    since_minutes: Optional[int] = Query(default=None, ge=1),
    interrupted: Optional[bool] = Query(
        default=None,
        description="Filter to only interrupted sessions (idle/drift/gap closures).",
    ),
) -> list[Session]:
    q = db.query(Session).filter(Session.user_id == current_user.id)
    if status:
        q = q.filter(Session.status == status)
    if since_minutes:
        cutoff = datetime.utcnow() - timedelta(minutes=since_minutes)
        q = q.filter(Session.started_at >= cutoff)
    if interrupted is True:
        q = q.filter(Session.interruption_type.in_(["idle", "drift", "gap"]))
    elif interrupted is False:
        q = q.filter(
            (Session.interruption_type.is_(None))
            | (Session.interruption_type == "context_switch")
        )
    return q.order_by(desc(Session.started_at)).limit(limit).all()


@router.get("/current", response_model=Optional[SessionOut])
def current_session(
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Optional[Session]:
    return get_active_session(db, current_user.id)


@router.get("/last-interrupted", response_model=Optional[SessionDetail])
def last_interrupted_session(
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Optional[Session]:
    """The single session the resume UI cares about: the most recently
    interrupted session that already has a cognitive snapshot ready.

    Returns null if no such session exists (clean slate / first launch /
    no interruption yet)."""
    s = (
        db.query(Session)
        .filter(Session.user_id == current_user.id)
        .filter(Session.interruption_type.in_(["idle", "drift", "gap"]))
        .filter(Session.snapshot_generated_at.isnot(None))
        .order_by(desc(Session.ended_at))
        .first()
    )
    if s is not None:
        s.events  # eager-touch for SessionDetail
    return s


@router.post("/rebuild", response_model=RebuildResult)
def rebuild(
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RebuildResult:
    """Re-run the sessionizer over all events. Idempotent; events keep their
    raw data, only their `session_id` and the `sessions` table are recomputed.
    Useful when iterating on the heuristic."""
    summary = rebuild_all_sessions(db, current_user.id)
    return RebuildResult(
        sessions_created=summary.sessions_created,
        events_assigned=summary.events_assigned,
        events_skipped=summary.events_skipped,
    )


@router.get("/{session_id}", response_model=SessionDetail)
def session_detail(
    session_id: int,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Session:
    s = db.get(Session, session_id)
    if not s or s.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="session not found")
    s.events  # touch the relationship so it's loaded for response serialization
    return s


@router.get("/{session_id}/events", response_model=list[EventOut])
def session_events(
    session_id: int,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Event]:
    """Lightweight: just the events for one session, no session metadata."""
    s = db.get(Session, session_id)
    if not s or s.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="session not found")
    return (
        db.query(Event)
        .filter(Event.user_id == current_user.id)
        .filter(Event.session_id == session_id)
        .order_by(Event.timestamp.asc())
        .all()
    )


def _snapshot_payload(s: Session) -> SnapshotOut:
    return SnapshotOut(
        session_id=s.id,
        task=s.ai_task,
        intent=s.ai_intent,
        progress=s.ai_progress,
        blockers=s.ai_blockers,
        next_steps=s.ai_next_steps,
        generated_at=s.snapshot_generated_at,
        model=s.snapshot_model,
    )


@router.get("/{session_id}/snapshot", response_model=SnapshotOut)
def get_snapshot(
    session_id: int,
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SnapshotOut:
    """Return the cached cognitive snapshot. 404 if none has been generated."""
    s = db.get(Session, session_id)
    if not s or s.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="session not found")
    if s.snapshot_generated_at is None:
        raise HTTPException(
            status_code=404,
            detail="no snapshot generated yet — POST to this endpoint to create one",
        )
    return _snapshot_payload(s)


@router.post("/{session_id}/snapshot", response_model=SnapshotOut)
def create_snapshot(
    session_id: int,
    force: bool = Query(default=False, description="Regenerate even if a snapshot exists"),
    db: DbSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SnapshotOut:
    """Generate a cognitive snapshot for the session via Gemini.

    Cached by default — pass `?force=true` to regenerate. The snapshot's
    `task` also becomes the session's `title`, so subsequent /sessions
    listings will show the human-readable task name instead of just the
    primary_domain.
    """
    s = db.get(Session, session_id)
    if not s or s.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="session not found")

    if s.snapshot_generated_at is not None and not force:
        return _snapshot_payload(s)

    events = (
        db.query(Event)
        .filter(Event.user_id == current_user.id)
        .filter(Event.session_id == session_id)
        .order_by(Event.timestamp.asc())
        .all()
    )
    if not events:
        raise HTTPException(
            status_code=422,
            detail="session has no events to summarize",
        )

    try:
        snap = generate_snapshot(s, events)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini call failed: {e}") from e

    apply_snapshot_to_session(s, snap)
    db.commit()
    db.refresh(s)
    return _snapshot_payload(s)
