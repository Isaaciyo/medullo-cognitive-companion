"""Phase 4: AI cognitive interpretation layer.

Generates structured cognitive snapshots over completed/active sessions
using Gemini 2.5 Pro. The schema (task, intent, progress, blockers,
next_steps) is the one specified in the project brief and feeds the
Phase 6 resume UI.

Design notes:
- Gemini's structured-output mode (`response_schema` + `application/json`
  mime type) is what produces reliably-typed results; we never parse free
  text. If the API ever returns malformed data, we raise — Phase 5 will
  decide what to do (retry vs. show stale snapshot).
- The client is lazy-initialized so the backend boots fine without a
  GEMINI_API_KEY (events still get collected; only the snapshot endpoint
  will 503).
- We do NOT auto-generate snapshots on session close in Phase 4. That
  trigger belongs in Phase 5 (interruption detection) so the cost / UX of
  when to invoke Gemini stays in one place.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .models import Event, Session

GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL", "gemini-2.5-flash"
)  # set to "gemini-2.5-pro" for more capable (but costly) snapshots

# Cap the timeline included in the prompt. 1M-context Pro can handle far
# more, but cost scales with input tokens; sessions rarely need >80 events
# of context to reconstruct intent.
MAX_EVENTS_IN_PROMPT = 80

# Skip page_focus spans shorter than this — they're transit, not attention.
MIN_FOCUS_FOR_PROMPT_SECONDS = 2.0


SYSTEM_INSTRUCTION = """\
You are a cognitive companion. Your job is to help a knowledge worker recover \
their train of thought after an interruption.

Given a sequence of browsing events from one work session, reconstruct what \
the user was actually trying to do — not just what they clicked.

Tone:
- calm, precise, human
- second person, as if recapping their own notes to them ("you were…", "your blocker was…")
- specific, never generic

Avoid:
- corporate or marketing language
- productivity coaching ("consider blocking distractions…")
- literal play-by-play summaries ("the user visited X, then Y")
- judging the user's focus or effort
- recommending unrelated tools or services

Be conservative: if the evidence does not support a clear task or blocker, \
return an empty list rather than inventing one. Quality over volume.\
"""


class GeneratedSnapshot(BaseModel):
    """Structured cognitive snapshot. Matches the schema from the brief."""

    task: str = Field(
        description="One short clause describing what the user was working on. Not the domain — the actual task. E.g. 'Debug Stripe OAuth refresh persistence', not 'Browsing stripe.com'."
    )
    intent: str = Field(
        description="The deeper 'why' behind the task — what outcome the user is pursuing."
    )
    progress: list[str] = Field(
        default_factory=list,
        description="1-3 concrete things that got done in the session. Each item is one short sentence. Empty list if no real progress is evident.",
    )
    blockers: list[str] = Field(
        default_factory=list,
        description="1-3 things that seemed stuck or unresolved. Empty list if nothing was blocked.",
    )
    next_steps: list[str] = Field(
        default_factory=list,
        description="1-3 actionable next moves the user can take to continue. Empty list if no next step is clearly supported.",
    )


def _format_event_line(event: Event) -> str:
    t = event.timestamp.strftime("%H:%M:%S")
    domain = event.domain or "-"
    title = (event.title or "").strip()[:90]
    extras = []
    if event.event_type == "page_focus" and event.duration_seconds:
        extras.append(f"{event.duration_seconds:.0f}s")
    if event.extra and event.extra.get("drift_marker"):
        extras.append("drift")
    if event.extra and event.extra.get("query"):
        extras.append(f"query={event.extra['query'][:60]}")
    suffix = f" [{', '.join(extras)}]" if extras else ""
    return f"{t}  {event.event_type:13s} {domain:28s} {title}{suffix}"


def _filter_events_for_prompt(events: list[Event]) -> list[Event]:
    """Drop noise events; cap at MAX_EVENTS_IN_PROMPT (keep most recent if too many)."""
    kept = []
    for ev in events:
        if ev.event_type == "active":
            continue
        if (
            ev.event_type == "page_focus"
            and (ev.duration_seconds or 0) < MIN_FOCUS_FOR_PROMPT_SECONDS
        ):
            continue
        kept.append(ev)
    if len(kept) > MAX_EVENTS_IN_PROMPT:
        # Keep the most recent — the resume use case cares about where the user
        # *ended up*, not where they started.
        kept = kept[-MAX_EVENTS_IN_PROMPT:]
    return kept


def build_prompt(session: Session, events: list[Event]) -> str:
    duration_seconds = 0.0
    if session.ended_at and session.started_at:
        duration_seconds = (session.ended_at - session.started_at).total_seconds()
    timeline = "\n".join(
        _format_event_line(e) for e in _filter_events_for_prompt(events)
    )
    keywords = ", ".join(session.keywords or []) or "(none gathered)"
    return f"""\
SESSION CONTEXT
---------------
Started:           {session.started_at.isoformat() if session.started_at else "-"}
Ended:             {session.ended_at.isoformat() if session.ended_at else "(still active)"}
Wall-clock span:   {duration_seconds:.0f} seconds
Active attention:  {session.total_active_seconds:.0f} seconds
Primary domain:    {session.primary_domain or "-"}
Heuristic keywords: {keywords}

EVENT TIMELINE
--------------
{timeline}

Produce the cognitive snapshot for this session. If the events don't tell a clear story, \
say so by leaving progress / blockers / next_steps empty — do not invent.\
"""


# --- Gemini client (lazy) -----------------------------------------------------

_client = None


def _get_client():
    """Initialize the Gemini client lazily so the app boots without an API key."""
    global _client
    if _client is not None:
        return _client

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to backend/.env (see .env.example)."
        )

    # Import inside the function so missing google-genai doesn't break boot.
    from google import genai  # type: ignore

    _client = genai.Client(api_key=api_key)
    return _client


def generate_snapshot(session: Session, events: list[Event]) -> GeneratedSnapshot:
    """Generate a structured cognitive snapshot via Gemini.

    Raises RuntimeError if the API key is missing or the SDK returns
    unparseable output (the latter would suggest a model regression).
    """
    client = _get_client()
    from google.genai import types  # type: ignore

    prompt = build_prompt(session, events)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=GeneratedSnapshot,
            temperature=0.4,
        ),
    )

    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, GeneratedSnapshot):
        return parsed

    # Fallback: parse the raw JSON text if the SDK didn't auto-deserialize.
    raw = getattr(response, "text", None)
    if not raw:
        raise RuntimeError("Gemini returned no parseable output")
    return GeneratedSnapshot.model_validate_json(raw)


def apply_snapshot_to_session(session: Session, snap: GeneratedSnapshot) -> None:
    """Persist the generated snapshot onto the Session row. Caller commits."""
    session.ai_task = snap.task
    session.ai_intent = snap.intent
    session.ai_progress = list(snap.progress)
    session.ai_blockers = list(snap.blockers)
    session.ai_next_steps = list(snap.next_steps)
    session.title = snap.task  # surface the task in /sessions listings
    session.snapshot_generated_at = datetime.utcnow()
    session.snapshot_model = GEMINI_MODEL
