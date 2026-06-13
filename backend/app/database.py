import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./medullo.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_SESSIONS_PHASE4_COLUMNS = {
    "ai_task": "TEXT",
    "ai_intent": "TEXT",
    "ai_progress": "JSON",
    "ai_blockers": "JSON",
    "ai_next_steps": "JSON",
    "snapshot_generated_at": "DATETIME",
    "snapshot_model": "VARCHAR(64)",
}

_SESSIONS_PHASE5_COLUMNS = {
    "interruption_type": "VARCHAR(24)",
}

_MULTI_USER_COLUMNS = {
    "events": {
        "user_id": "VARCHAR(36) REFERENCES users(id)",
    },
    "sessions": {
        "user_id": "VARCHAR(36) REFERENCES users(id)",
    },
}


def ensure_schema() -> None:
    """Apply lightweight, non-destructive migrations on startup.

    SQLAlchemy `create_all` only creates missing tables; it does not add
    columns to tables that already exist. We use this hook to add new
    columns introduced after a phase ships — preserving the user's data.
    """
    if not DATABASE_URL.startswith("sqlite"):
        return  # only SQLite needs hand-rolled migrations here

    insp = inspect(engine)
    tables = set(insp.get_table_names())
    with engine.begin() as conn:
        # Phase 2 migration: events.session_id FK to sessions(id)
        if "events" in tables:
            events_cols = {c["name"] for c in insp.get_columns("events")}
            if "session_id" not in events_cols:
                conn.execute(
                    text("ALTER TABLE events ADD COLUMN session_id INTEGER REFERENCES sessions(id)")
                )
            for col, col_type in _MULTI_USER_COLUMNS["events"].items():
                if col not in events_cols:
                    conn.execute(text(f"ALTER TABLE events ADD COLUMN {col} {col_type}"))

        # Phase 4 + 5 migrations: snapshot fields and interruption_type on sessions
        if "sessions" in tables:
            sessions_cols = {c["name"] for c in insp.get_columns("sessions")}
            for col, col_type in {**_SESSIONS_PHASE4_COLUMNS, **_SESSIONS_PHASE5_COLUMNS}.items():
                if col not in sessions_cols:
                    conn.execute(text(f"ALTER TABLE sessions ADD COLUMN {col} {col_type}"))
            for col, col_type in _MULTI_USER_COLUMNS["sessions"].items():
                if col not in sessions_cols:
                    conn.execute(text(f"ALTER TABLE sessions ADD COLUMN {col} {col_type}"))
