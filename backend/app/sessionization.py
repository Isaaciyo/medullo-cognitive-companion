"""Heuristic sessionizer for Phase 2 (with 2.1 fixes).

The brief is explicit that *simple heuristics are acceptable for MVP*. The job
of this layer is to turn a stream of raw events into coherent "work sessions"
that the Phase 4 AI layer can reason over.

Continuity rule — `event` extends the active session if:
  1. The time gap from the session's *effective end* is ≤ MAX_GAP, AND
  2. There is browsing continuity (same domain OR meaningful title-keyword
     overlap with the running session's keyword bag).

Otherwise close the current session and open a new one. `idle` closes the
active session; the next non-idle event opens a fresh one.

### Internal browser pages (chrome://newtab/, etc.)

Brief transit through `chrome://*` URLs is just navigation noise and is
skipped entirely (no session assignment).

But a **long dwell** on the new-tab page is the signature of the very
problem this product exists for — lost train of thought / drift. So a
`page_focus` on a chrome:// page with duration ≥ NEWTAB_DRIFT_THRESHOLD is
treated like `idle`: it closes the active session and is attributed to it as
the moment attention drifted.

### Effective end time

`page_focus` events carry the user's attention *over a span*. The event is
timestamped at the START of the span (after the extension's 2.1 fix); the
END is `timestamp + duration_seconds`. For gap math and the session's
`ended_at`, we use this effective end — otherwise a 30-minute deep read would
look like a 30-minute gap and fragment the session.

This module is the single source of truth for the heuristic. Both online
ingest (`assign_session_for_event`) and the rebuild endpoint go through it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, Optional
from urllib.parse import urlparse

from sqlalchemy import desc
from sqlalchemy.orm import Session as DbSession

from .models import Event, Session

# ---------- tunables ----------

# Max gap between a session's effective end and the next event that still
# counts as the same session. Generous enough to allow deep reads.
MAX_GAP = timedelta(minutes=15)

# `idle` always closes the active session, regardless of MAX_GAP.
IDLE_CLOSES_SESSION = True

# Dwell on chrome://newtab/ (or other chrome:// pages) at or above this
# threshold is treated as a drift / lost-focus signal — closes the session.
NEWTAB_DRIFT_THRESHOLD = timedelta(seconds=30)

# A page span shorter than this is treated as transient noise and does NOT
# extend the active session's `total_active_seconds`.
MIN_SPAN_SECONDS = 1.0

# How many top tokens to keep on the session's keyword bag.
MAX_KEYWORDS = 24

# Title tokens shorter than this are dropped (filters "a", "of", noise).
MIN_TOKEN_LEN = 3

# Title tokens longer than this are almost always tracking/base64 gibberish.
MAX_TOKEN_LEN = 24

# Common stopwords, chrome UI noise, and frequent URL-param names that
# leak in when Chrome falls back to URL as title.
_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "into",
    "your",
    "you",
    "are",
    "but",
    "not",
    "have",
    "has",
    "was",
    "were",
    "will",
    "what",
    "how",
    "why",
    "when",
    "where",
    "who",
    "all",
    "any",
    "can",
    "get",
    "set",
    "new",
    "via",
    "use",
    "using",
    # browser chrome / UI labels
    "tab",
    "newtab",
    "untitled",
    "extensions",
    "settings",
    "history",
    "bookmarks",
    "downloads",
    "whats-new",
    # generic site-name noise
    "google",
    "search",
    "results",
    "github",
    "stack",
    "overflow",
    "stackoverflow",
    "youtube",
    "page",
    "home",
    "chrome",
    # common URL parameter names — appear when title falls back to URL
    "ved",
    "sourceid",
    "utf-8",
    "utf",
    "lcrp",
    "client",
    "oq",
    "sxsrf",
    "hl",
    "ie",
    "aqs",
    "biw",
    "bih",
    "ei",
    "https",
    "http",
    "com",
    "org",
    "net",
    "www",
}

# Split on word boundaries — but treat `+`, `_`, `/`, `.`, `?`, `=`, `&` as
# separators too, so URL-encoded titles (`apex+legends`) and URL paths
# (`/games/apex-legends`) split into useful tokens. Keep `-` and `#` inside
# tokens since `apex-legends` and `c#` carry meaning.
_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9#\-]{2,}")
_URL_SHAPED = re.compile(
    r"^(https?|chrome|chrome-extension|file|about):", re.IGNORECASE
)
_VOWELS = set("aeiouy")
# Path/query segments worth ignoring as topic signal — they're structural.
_URL_PATH_STOP = {
    "www",
    "com",
    "org",
    "net",
    "io",
    "gg",
    "co",
    "uk",
    "edu",
    "html",
    "htm",
    "php",
    "aspx",
    "jsp",
    "index",
    "home",
    "main",
    "default",
    "search",
    "results",
    "page",
    "pages",
    "api",
    "v1",
    "v2",
    "v3",
}


def is_internal_url(url: Optional[str]) -> bool:
    """True for browser-internal pages that aren't real attention destinations."""
    if not url:
        return False
    u = url.lower()
    return (
        u.startswith("chrome://")
        or u.startswith("chrome-extension://")
        or u.startswith("about:")
        or u.startswith("edge://")
    )


def _looks_like_url(title: str) -> bool:
    return bool(_URL_SHAPED.match(title.strip())) or "://" in title


def _is_gibberish(token: str) -> bool:
    """Crude check for tracking-style tokens (long, no vowels, etc.)."""
    if len(token) > MAX_TOKEN_LEN:
        return True
    # Tokens with no vowels and length >= 6 are almost always gibberish.
    if len(token) >= 6 and not (_VOWELS & set(token)):
        return True
    return False


def _filter_tokens(raw: Iterable[str]) -> set[str]:
    return {
        t
        for t in (s.lower() for s in raw)
        if MIN_TOKEN_LEN <= len(t) <= MAX_TOKEN_LEN
        and t not in _STOPWORDS
        and t not in _URL_PATH_STOP
        and not _is_gibberish(t)
    }


def tokenize_title(title: Optional[str]) -> set[str]:
    if not title:
        return set()
    s = title.strip()
    if not s or _looks_like_url(s):
        return set()
    # Replace URL-encoding plus signs with spaces before tokenizing, so
    # `apex+legends` becomes `apex legends` and splits cleanly.
    s = s.replace("+", " ")
    return _filter_tokens(_TOKEN_RE.findall(s))


def tokenize_url(url: Optional[str]) -> set[str]:
    """Extract topic tokens from a URL's path and query values.

    The URL is reliable signal at tab_switch time — the page title may be
    a loading-state stub, but the URL is correct. So tokenizing the path
    (`/games/apex-legends`) gives us topic before the title settles.
    """
    if not url:
        return set()
    try:
        u = urlparse(url)
    except Exception:
        return set()
    if u.scheme in ("chrome", "chrome-extension", "about", "edge", "file"):
        return set()
    segments: list[str] = []
    if u.path:
        # Split on / and re-tokenize each segment (which itself may contain
        # hyphens like apex-legends).
        segments.extend(seg.replace("+", " ") for seg in u.path.split("/") if seg)
    if u.query:
        for pair in u.query.split("&"):
            if "=" in pair:
                _, _, val = pair.partition("=")
                if val:
                    segments.append(val.replace("+", " "))
    raw: list[str] = []
    for seg in segments:
        for token in _TOKEN_RE.findall(seg):
            # Split URL tokens on `-` too — URLs use hyphens as word
            # separators (`apex-legends`, `ai-agents`), so we want both
            # `apex` and `legends` to match title-derived tokens.
            raw.extend(part for part in token.split("-") if part)
    return _filter_tokens(raw)


def tokenize_event(event: Event) -> set[str]:
    """Combined topic tokens for an event — title + URL signals."""
    return tokenize_title(event.title) | tokenize_url(event.url)


def _merge_keywords(
    existing: Optional[list[str]], new_tokens: Iterable[str]
) -> list[str]:
    bag = list(existing or [])
    seen = set(bag)
    for t in new_tokens:
        if t not in seen:
            bag.append(t)
            seen.add(t)
    return bag[-MAX_KEYWORDS:]


def _event_end(event: Event) -> datetime:
    """Effective end time of an event — accounts for page_focus spans."""
    if event.event_type == "page_focus" and event.duration_seconds:
        return event.timestamp + timedelta(seconds=event.duration_seconds)
    return event.timestamp


def _is_continuation(active: Session, event: Event) -> bool:
    """Semantic continuity check (caller handles the time-gap check)."""
    # Domain match is the strongest signal — same site = same task, usually.
    if event.domain and active.primary_domain and event.domain == active.primary_domain:
        return True

    # Otherwise look for keyword overlap with the session's bag. URL tokens
    # rescue the loading-state case where the title is a stub but the URL
    # already says `/games/apex-legends`.
    tokens = tokenize_event(event)
    if not tokens:
        # No usable signal. Don't fragment titleless events (loading states);
        # let the next signal-bearing event decide.
        return True

    bag = set(active.keywords or [])
    if not bag:
        return True

    return bool(tokens & bag)


def _close(
    session: Session, at: datetime, interruption_type: Optional[str] = None
) -> None:
    """Close a session and record *why* it closed.

    interruption_type values:
      - "idle"           → user went idle / locked the screen
      - "drift"          → long dwell on newtab / chrome:// = lost focus
      - "gap"            → MAX_GAP elapsed with no event (away from desk)
      - "context_switch" → user pivoted to genuinely different work (clean)
      -  None            → fallback, should not normally occur

    Phase 5's auto-snapshot trigger consumes this field: `idle`, `drift`,
    and `gap` closures are treated as interruptions worth pre-generating
    a snapshot for. `context_switch` is a natural boundary, no trigger.
    """
    session.status = "closed"
    session.ended_at = at
    session.interruption_type = interruption_type


def _new_session(db: DbSession, event: Event) -> Session:
    s = Session(
        user_id=event.user_id,
        started_at=event.timestamp,
        ended_at=_event_end(event),
        status="active",
        primary_domain=event.domain,
        event_count=0,
        total_active_seconds=0.0,
        keywords=sorted(tokenize_event(event)) or [],
    )
    db.add(s)
    db.flush()
    return s


def _absorb(active: Session, event: Event) -> None:
    event.session_id = active.id
    active.event_count += 1
    end = _event_end(event)
    if active.ended_at is None or end > active.ended_at:
        active.ended_at = end
    active.keywords = _merge_keywords(active.keywords, tokenize_event(event))
    if event.domain and not active.primary_domain:
        active.primary_domain = event.domain
    if (
        event.event_type == "page_focus"
        and (event.duration_seconds or 0) >= MIN_SPAN_SECONDS
    ):
        active.total_active_seconds += event.duration_seconds or 0.0


def _find_recent_session_by_browsing_id(
    db: DbSession, browsing_session_id: Optional[str], event: Event
) -> Optional[Session]:
    """Find a recently-closed session with the same browsing_session_id.

    Late-arriving duration updates from the extension have the same browsing_session_id
    but arrive after the session has already closed. Instead of fragmenting into new
    sessions, merge them back into the original session.
    """
    if not browsing_session_id:
        return None

    # Look for a closed session with this browsing_session_id that ended recently
    # (within the last 10 minutes) and is on the same domain.
    recent_cutoff = event.timestamp - timedelta(minutes=10)

    candidate = (
        db.query(Session)
        .filter(
            Session.user_id == event.user_id,
            Session.status == "closed",
            Session.primary_domain == event.domain,
            # Check extra for browsing_session_id if it was stored, or infer from events
        )
        .order_by(desc(Session.ended_at))
        .first()
    )

    # Verify the browsing_session_id by checking if any event in this session
    # matches our incoming event's browsing_session_id
    if candidate and candidate.ended_at and candidate.ended_at >= recent_cutoff:
        # Simple heuristic: if the closed session has the same domain and ended recently,
        # and our new event is from the same browsing context, absorb it.
        existing_events = (
            db.query(Event)
            .filter(Event.user_id == event.user_id)
            .filter(Event.session_id == candidate.id)
            .all()
        )
        if any(e.browsing_session_id == browsing_session_id for e in existing_events):
            return candidate

    return None


def _apply_event(
    active: Optional[Session], event: Event, db: DbSession
) -> Optional[Session]:
    """Mutate `active` (or open a new session) to absorb `event`. Returns the
    session the event was assigned to (or None if intentionally skipped)."""

    internal = is_internal_url(event.url)
    duration = timedelta(seconds=event.duration_seconds or 0)

    # --- explicit boundary markers ---------------------------------------

    if event.event_type == "idle":
        if active is not None and active.status == "active":
            _absorb(active, event)
            _close(active, event.timestamp, interruption_type="idle")
        return active

    if event.event_type == "active":
        # Wake-up marker; doesn't belong to any session. The next signal
        # event opens a fresh one.
        return None

    # --- chrome:// internal pages ----------------------------------------
    # Brief transit through newtab/extensions/etc. is just navigation noise.
    # But a long dwell IS the drift signal this product exists to catch.

    if internal:
        if event.event_type == "tab_switch":
            return None  # pure transit
        if event.event_type == "page_focus":
            if (
                duration >= NEWTAB_DRIFT_THRESHOLD
                and active is not None
                and active.status == "active"
            ):
                # Lost-focus moment — attribute to the closing session.
                event.extra = {**(event.extra or {}), "drift_marker": True}
                _absorb(active, event)
                _close(active, event.timestamp + duration, interruption_type="drift")
                return active
            return None  # short newtab dwell — noise
        # other event types on internal URLs: fall through as normal

    # --- gap check (uses session's effective end, not last timestamp) ----

    if active is not None and active.status == "active":
        ref = active.ended_at or active.started_at
        if event.timestamp - ref > MAX_GAP:
            _close(active, ref, interruption_type="gap")
            active = None

    # --- continuity check ------------------------------------------------

    if active is not None and active.status == "active":
        if not _is_continuation(active, event):
            _close(
                active,
                active.ended_at or active.started_at,
                interruption_type="context_switch",
            )
            active = None

    if active is None or active.status != "active":
        # Before creating a new session, check if there's a recently-closed session
        # with the same browsing_session_id (late-arriving duration update).
        recent = _find_recent_session_by_browsing_id(
            db, event.browsing_session_id, event
        )
        if recent:
            # Reopen and absorb this late-arriving event into the closed session.
            recent.status = "active"
            _absorb(recent, event)
            return recent

        active = _new_session(db, event)
        # Skip the event_count bump that _absorb does, since _new_session
        # already initialized state from this event. Just count it once.
        event.session_id = active.id
        active.event_count = 1
        if (
            event.event_type == "page_focus"
            and (event.duration_seconds or 0) >= MIN_SPAN_SECONDS
        ):
            active.total_active_seconds += event.duration_seconds or 0.0
        return active

    _absorb(active, event)
    return active


# ---------- public API ----------


def get_active_session(db: DbSession, user_id: str) -> Optional[Session]:
    return (
        db.query(Session)
        .filter(Session.user_id == user_id)
        .filter(Session.status == "active")
        .order_by(desc(Session.started_at))
        .first()
    )


def assign_session_for_event(db: DbSession, event: Event) -> Optional[Session]:
    """Online sessionization — call this on every ingested event before commit.

    Idempotent w.r.t. an already-assigned `event.session_id` (will not move
    events between sessions; rebuild does that).
    """
    if event.session_id is not None:
        session = db.get(Session, event.session_id)
        if session is not None and session.user_id == event.user_id:
            return session
        return None

    if not event.user_id:
        raise ValueError("event.user_id is required for sessionization")

    active = get_active_session(db, event.user_id)
    return _apply_event(active, event, db)


@dataclass
class RebuildSummary:
    sessions_created: int
    events_assigned: int
    events_skipped: int


def rebuild_all_sessions(db: DbSession, user_id: str) -> RebuildSummary:
    """Discard all sessions and rebuild from the raw event stream.

    Lets us iterate the heuristic without losing observations — the raw
    events are the source of truth, sessions are derived.
    """
    db.query(Event).filter(Event.user_id == user_id).update({Event.session_id: None})
    db.query(Session).filter(Session.user_id == user_id).delete()
    db.flush()

    assigned = 0
    skipped = 0
    active: Optional[Session] = None

    events = (
        db.query(Event)
        .filter(Event.user_id == user_id)
        .order_by(Event.timestamp.asc(), Event.id.asc())
        .all()
    )
    for ev in events:
        result = _apply_event(active, ev, db)
        if ev.session_id is not None:
            assigned += 1
        else:
            skipped += 1
        if result is not None and result.status == "active":
            active = result
        elif result is not None and result.status == "closed":
            active = None

    created = db.query(Session).filter(Session.user_id == user_id).count()
    db.commit()
    return RebuildSummary(
        sessions_created=created, events_assigned=assigned, events_skipped=skipped
    )
