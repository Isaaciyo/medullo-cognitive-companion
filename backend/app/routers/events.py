from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..interruptions import auto_snapshot_session, should_auto_snapshot
from ..models import Event
from ..models import Session as SessionModel
from ..schemas import EventBatch, EventIn, EventOut, IngestResult
from ..sessionization import assign_session_for_event

router = APIRouter(prefix="/events", tags=["events"])


def _persist(db: Session, e: EventIn) -> tuple[Event, Optional[SessionModel]]:
    row = Event(
        timestamp=e.timestamp.replace(tzinfo=None) if e.timestamp.tzinfo else e.timestamp,
        event_type=e.event_type,
        app=e.app,
        title=e.title,
        url=e.url,
        domain=e.domain(),
        duration_seconds=e.duration_seconds,
        browsing_session_id=e.browsing_session_id,
        extra=e.extra,
    )
    db.add(row)
    db.flush()  # populate row.id before sessionization references it
    sess = assign_session_for_event(db, row)
    return row, sess


def _enqueue_auto_snapshots(
    background_tasks: BackgroundTasks, sessions: list[Optional[SessionModel]]
) -> None:
    """Phase 5: any session this batch just closed-with-interruption gets a
    snapshot generated in the background, so the next time the user looks
    it's already there."""
    to_snapshot: set[int] = set()
    for s in sessions:
        if s is not None and should_auto_snapshot(s):
            to_snapshot.add(s.id)
    for sid in to_snapshot:
        background_tasks.add_task(auto_snapshot_session, sid)


@router.post("", response_model=IngestResult)
def ingest_single(
    event: EventIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> IngestResult:
    _, sess = _persist(db, event)
    db.commit()
    _enqueue_auto_snapshots(background_tasks, [sess])
    return IngestResult(accepted=1)


@router.post("/batch", response_model=IngestResult)
def ingest_batch(
    batch: EventBatch,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> IngestResult:
    # Sort by timestamp so the sessionizer sees events in chronological order
    # even if a delayed flush carries an out-of-order batch.
    touched: list[Optional[SessionModel]] = []
    for e in sorted(batch.events, key=lambda x: x.timestamp):
        _, sess = _persist(db, e)
        touched.append(sess)
    db.commit()
    _enqueue_auto_snapshots(background_tasks, touched)
    return IngestResult(accepted=len(batch.events))


@router.get("", response_model=list[EventOut])
def list_events(
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=1000),
    event_type: Optional[str] = None,
    since_minutes: Optional[int] = Query(default=None, ge=1),
) -> list[Event]:
    q = db.query(Event)
    if event_type:
        q = q.filter(Event.event_type == event_type)
    if since_minutes:
        cutoff = datetime.utcnow() - timedelta(minutes=since_minutes)
        q = q.filter(Event.timestamp >= cutoff)
    return q.order_by(desc(Event.timestamp)).limit(limit).all()


@router.get("/stats")
def stats(db: Session = Depends(get_db)) -> dict:
    total = db.query(Event).count()
    last = db.query(Event).order_by(desc(Event.timestamp)).first()
    return {
        "total_events": total,
        "last_event_at": last.timestamp.isoformat() if last else None,
        "last_event_type": last.event_type if last else None,
    }
