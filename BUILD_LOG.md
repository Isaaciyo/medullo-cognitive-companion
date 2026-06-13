# Medullo Build Log

A curated record of what was built in each phase, what was decided and why, and
what was deliberately left for later. Read this when you need historical context
that the code itself doesn't preserve.

> Format per phase: **Goal · Built · Decisions · Not built (and why) · Verified**.

---

## Phase 1 — Event Pipeline · 2026-05-26 · ✅ complete

**Goal:** stand up the cognitive event stream. No intelligence yet — just reliable,
lightweight observation of workflow signals into a local database.

### Built

- **FastAPI backend** at [backend/](backend/)
  - SQLite via SQLAlchemy 2, auto-created `medullo.db` on startup
  - `Event` model with `timestamp`, `event_type`, `app`, `title`, `url`, `domain`
    (server-parsed from URL), `duration_seconds`, `browsing_session_id`, JSON `extra`,
    plus server-side `received_at`
  - Endpoints: `POST /events`, `POST /events/batch`, `GET /events` (with
    `event_type` / `since_minutes` / `limit` filters), `GET /events/stats`,
    `GET /health`
  - Pydantic validates `event_type` against the literal union from the brief —
    invalid types are rejected with 422
  - CORS allows `chrome-extension://*` and `localhost:3000`

- **Chrome MV3 extension** at [extension/](extension/)
  - Service worker [extension/background.js](extension/background.js) tracks the
    active tab + its start time; emits `page_focus` with `duration_seconds` when
    the span closes (tab switch / URL change / window blur / idle / close)
  - Listeners on `chrome.tabs.onActivated|onUpdated|onRemoved`,
    `chrome.windows.onFocusChanged`, `chrome.idle.onStateChanged`
  - Search-query detection by URL parsing against a known host map
    ([extension/config.js](extension/config.js)): Google, Bing, DuckDuckGo,
    Brave, YouTube, GitHub, StackOverflow
  - Queue persisted in `chrome.storage.local`, flushed every ~15s via
    `chrome.alarms` or when the queue reaches 50 events — survives short backend
    outages
  - Ambient dark popup ([extension/popup.html](extension/popup.html)) showing
    status dot, queued/sent counts, last flush, error surface, "Flush now" and
    "New session" actions. Deliberately not a dashboard.
  - Procedurally generated PNG icons (no external assets)

- **Memory + docs**
  - Top-level [README.md](README.md) covering setup, what's collected, what isn't
  - Persistent memories: `project-overview`, `feedback-build-log`

### Decisions

- **SQLite, local-first.** The brief explicitly calls for local-first MVP. No
  cloud DB, no auth, no multi-tenant concerns yet.
- **Browser-only signal source for Phase 1.** VSCode / terminal / Slack / meeting
  detection are all stretch — the brief lists them as future. Browser is the
  cheapest place to land a high-fidelity signal for the developer persona.
- **`browsing_session_id` is just a per-extension-startup UUID, not a semantic
  session.** The brief's "session" concept (e.g. "Debugging Stripe OAuth") is
  what Phase 2 builds. Naming this differently up front avoids future confusion.
- **Batch ingest path (`POST /events/batch`) is the extension's primary route**,
  even though `POST /events` exists. Lets us tolerate burst activity and brief
  network blips without losing events.
- **Idle threshold = 60s.** The brief mentions long idle periods as interruption
  signals (Phase 5). 60s is the smallest interval `chrome.idle` reliably reports
  and matches typical "stepped away" semantics.
- **Pinned `pydantic>=2.11`, `fastapi>=0.118` etc.** after Python 3.14 wheel
  build failed against the original `pydantic==2.9.2` pin. Lower bounds, not
  exact pins, so future installs pick up wheel-supported versions.

### Not built (and why)

- **Semantic session grouping** — that *is* Phase 2.
- **AI interpretation** — Phase 4. Adding it before the event pipeline is
  observable and reliable would build on sand.
- **Frontend** — Phase 6. The popup is intentionally minimal status, not the
  resume UI.
- **Authentication / multi-user** — out of MVP scope. Local-first.

### Verified

- All eight backend smoke tests pass: `/health`, empty `/events/stats`, single
  ingest, batch ingest, list with parsed `domain`, 422 on bad `event_type`, DB
  file on disk, `/docs` Swagger UI.
- Live extension end-to-end: real browsing produces `tab_switch`, `page_focus`
  (with realistic durations), `search_query`, `idle`, `active` events flowing
  into SQLite. User confirmed working.

---

## Phase 2 — Sessionization Engine · 2026-05-26 · ✅ complete

**Goal:** group raw events into meaningful work sessions, so the AI layer in
Phase 4 reasons over coherent units of work ("Debugging Stripe OAuth") instead
of isolated tabs.

### Built

- **`Session` model** ([backend/app/models.py](backend/app/models.py)) with
  `started_at`, `ended_at`, `status` (active/closed), `primary_domain`,
  `event_count`, `total_active_seconds`, `keywords` (JSON), `title` (left
  nullable for Phase 4 to fill in)
- **Foreign key** `Event.session_id` → `Session.id` with a non-destructive
  migration in [backend/app/database.py](backend/app/database.py:31) — Phase 1
  test data survives; existing rows have `session_id = NULL` until rebuild.
- **Heuristic sessionizer**
  ([backend/app/sessionization.py](backend/app/sessionization.py)) — single
  source of truth, no AI calls, dependency-free
- **Online assignment** at ingest in
  [backend/app/routers/events.py](backend/app/routers/events.py) — every
  incoming event gets sessionized before commit. Batch events are sorted by
  timestamp so out-of-order flushes don't fragment sessions.
- **Sessions API**
  ([backend/app/routers/sessions.py](backend/app/routers/sessions.py)):
  `GET /sessions`, `GET /sessions/current`, `GET /sessions/{id}` (with embedded
  events), `GET /sessions/{id}/events`, `POST /sessions/rebuild`

### Decisions

- **Hybrid online + rebuild.** Events get assigned at ingest so the system
  always has a current session, but `POST /sessions/rebuild` re-runs the whole
  heuristic against the raw stream. Lets us tune the heuristic without losing
  observations — the raw events are the source of truth, sessions are derived.
- **Continuity rule = domain match OR title-keyword overlap ≥ 1.** Strong
  enough to keep "Stripe OAuth across docs/SO/github" together; weak enough to
  cleanly split unrelated topics. Verified against synthetic data:
  Stripe-debugging session of 7 events across 3 domains held together;
  sourdough-baking after idle correctly split.
- **`idle` is attributed to the closing session.** This means the session
  timeline contains the moment attention dropped — useful for the Phase 5
  interruption-detection layer.
- **`active` events are skipped** (`session_id` stays NULL). They're a
  wake-up marker; the next signal-bearing event opens the new session.
- **Heuristic tunables exposed as module constants**
  ([backend/app/sessionization.py:30](backend/app/sessionization.py#L30)):
  `MAX_GAP=5min`, `MIN_SPAN_SECONDS=1.0`, `MAX_KEYWORDS=24`, `MIN_TOKEN_LEN=3`,
  plus a stopword set. Easy to tune later.
- **Title tokenization is simple regex** — no NLTK / no stemming / no semantic
  embeddings. The brief explicitly says "simple heuristics are acceptable for
  MVP." We can revisit when real-world data shows the cracks.
- **Keyword bag is append-only with a tail window** of `MAX_KEYWORDS`. Drops
  oldest tokens so a long session can drift across sub-topics without the bag
  becoming a kitchen-sink that matches everything.

### Not built (and why)

- **AI-generated session titles** — that's Phase 4. The `title` column is
  reserved for the Gemini-derived label.
- **Cross-session linking / semantic memory** — listed as Phase 7+ stretch.
- **Background re-sessionization on schedule** — `/sessions/rebuild` is
  on-demand. A cron-style background worker would add infra weight we don't
  need yet.
- **Configurable thresholds via env vars** — current constants live in code so
  changes get reviewed alongside the heuristic logic. Promote to config if we
  start needing per-deploy tuning.

### Verified

- Synthetic in-memory smoke test (10 events, 2 sessions across domain pivots
  and an idle boundary) produced exactly the expected grouping; rebuild
  reproduced identical sessions. See the test inline in this session's
  transcript.
- Backend syntax-clean across all 7 modules.
- **TODO for user:** after restart (uvicorn `--reload` should auto-pick), run
  `POST /sessions/rebuild` to assign sessions to the Phase 1 test events.

### Phase 2.1 amendment · 2026-05-26 · ✅ fixes from first live test

First run against the user's real browsing data exposed four bugs producing
gross over-fragmentation (50 sessions where ~8–10 were warranted). Captured
the failure modes from the live output, root-caused each, fixed with tests.

**Bug 1 — `page_focus` timestamped at span close, not start.**

Symptom: sessions with `started_at ≈ ended_at` (4ms span) but
`total_active_seconds = 2435`. A 40-min YouTube watch fragmented into ~10
sessions because each `page_focus` arrived alone, separated by the
`MAX_GAP` from its corresponding `tab_switch`.

Fix: [extension/background.js](extension/background.js) — `buildEvent` now
accepts `timestampMs`; `closeCurrentSpan` passes `state.currentStartMs`.
The event timeline now reflects when attention *began*, not when it ended.

**Bug 2 — `chrome://newtab/` and similar created spurious sessions.**

Symptom: 14 of 50 sessions had `primary_domain = newtab` or `whats-new`.

Fix: `is_internal_url()` in
[backend/app/sessionization.py](backend/app/sessionization.py) detects
`chrome://`, `chrome-extension://`, `about:`, `edge://`. Internal
`tab_switch` and short `page_focus` events skip session assignment entirely.

**Per the user's catch:** a *long* dwell on `chrome://newtab/` is exactly
the drift / lost-train-of-thought signal this product exists to detect, so
internal `page_focus` events with `duration ≥ NEWTAB_DRIFT_THRESHOLD`
(default 30s) now behave like `idle` — they close the active session and
are attributed to it with `extra.drift_marker = true`. This is hookable
later by Phase 5 (interruption detection) without further plumbing.

**Bug 3 — junk keywords from URL-as-title.**

Symptom: keyword bags full of `egzjahjvbwuq...`, `lcrp`, `sourceid`,
`utf-8` — base64 / query-param noise. Cause: Chrome sometimes sets
`tab.title` to the URL before the page finishes loading.

Fix: `tokenize_title()` now rejects URL-shaped strings (anything matching
`^(https?|chrome|file|about):` or containing `://`), drops tokens > 24
chars, and drops tokens of length ≥ 6 with no vowels (tracking-token
fingerprint). Stopword list expanded with `ved`, `sourceid`, `utf-8`,
`utf`, `lcrp`, `client`, `oq`, `sxsrf`, `hl`, `ie`, `aqs`, `biw`, `bih`,
`ei`, common TLDs, and browser-UI labels like `tab`, `newtab`, `whats-new`.

**Bug 4 — gap math used last event timestamp, ignoring span duration.**

Symptom: deep reads fragmented even with the Bug 1 fix, because a
30-minute `page_focus` (now correctly timestamped at start) followed by
the next `tab_switch` looked like a 30-minute gap from the `page_focus`
timestamp alone.

Fix: introduced `_event_end()` returning `timestamp + duration_seconds`
for `page_focus`, plain `timestamp` otherwise. Session's `ended_at` and
gap calculations now use this effective end. Also bumped `MAX_GAP` from
5 minutes to **15 minutes** — long enough for genuine deep work, short
enough that idle/drift signals do most of the boundary-detection work.

### What this changes downstream

- **Old data is still fragmented** — historical events captured before
  the extension fix have the wrong `page_focus` timestamps and cannot be
  retroactively corrected. New browsing produces clean sessions; the user
  may want to delete `backend/medullo.db` and start fresh once the fix is
  live.
- **`Event.extra.drift_marker = true`** is a new, undocumented field that
  Phase 5 (interruption detection) can use as a strong signal without
  re-running the heuristic.
- **`NEWTAB_DRIFT_THRESHOLD`** is the third tunable next to `MAX_GAP` and
  `MIN_SPAN_SECONDS`. All three are module constants in
  [backend/app/sessionization.py](backend/app/sessionization.py).

### Verified

- All 6 sanity tests pass: YouTube long watch holds together, newtab
  transit invisible, long newtab dwell closes session with drift marker,
  URL-shaped titles produce zero keywords, cross-site Stripe research
  holds together, rebuild is deterministic.

### Phase 2.2 amendment · 2026-05-27 · ✅ load-state title bug

Second live test (post-2.1) collapsed 50 → 5 sessions. Big win, but cross-
site research about Apex Legends fragmented into 3 sessions because the
first event of each new tab fired before the page title settled (e.g.
`Electronic Arts` instead of `Apex Legends — Electronic Arts`). User flagged
the underlying root cause directly: "not waiting for the page to load makes
us have incomplete and inaccurate token splits."

**Fix 1 — URL is reliable even before title settles.**

`tokenize_url()` ([backend/app/sessionization.py:119](backend/app/sessionization.py#L119))
now extracts topic tokens from the URL path and query-string values, then
splits each token on `-` and `+` so `apex-legends` → `apex, legends` matches
title-derived tokens. A new `_URL_PATH_STOP` set drops structural noise
(`www`, `html`, `api`, `v1`, etc.) without poisoning the keyword bag.

`tokenize_event()` is the new combined entry point — title ∪ URL tokens —
and replaces every call to `tokenize_title()` in the heuristic. Means the
session's initial keywords are populated from URL signal even when the
tab_switch fires with a stub title.

**Fix 2 — `page_loaded` event when the title actually settles.**

Added `"page_loaded"` to the `EventType` literal in
[backend/app/schemas.py](backend/app/schemas.py). The extension's
[chrome.tabs.onUpdated](extension/background.js) listener now emits this
event whenever `changeInfo.title` arrives or the tab reaches
`status="complete"` for the currently-focused tab — gated by an `isRealTitle`
check so we don't emit for loading-state stubs (`"Loading"`, URL strings,
strings under 3 chars). `state.reportedTitle` tracks the last published
title so we don't spam duplicates as Chrome flicks through intermediate
states.

The sessionizer absorbs `page_loaded` like any other content event: same
domain → continue, enrich the keyword bag with the real title's tokens.
Doesn't extend `total_active_seconds` (it's a marker, not a span).

**Fix 3 — `_TOKEN_RE` no longer treats `+` as part of a token.**

Removed `+` from the token character class. `apex+legends - Google Search`
now tokenizes to `{apex, legends}` instead of `{apex+legends, apex+lege}`.

### Verified

- 5 sanity tests pass:
  - URL paths and query values tokenize correctly with hyphen splitting
  - URL-encoded `+` in titles splits cleanly
  - **The Apex scenario**: 3-site research (Google → EA → esports.gg) with
    stub titles and URL-encoded queries groups as **1 session** with
    keywords `[apex, legends, arts, games, electronic, news, esports,
    tournaments]`
  - `page_loaded` after a stub-title `tab_switch` enriches the existing
    session, doesn't create a new one
  - Regression: unrelated topics (Stripe → sourdough) still split

### To verify against live data after this update

1. Reload extension at `chrome://extensions`
2. Optional: `rm backend/medullo.db` (old events still have stub-title bug)
3. Browse a research arc across 3+ sites on one topic
4. `curl -X POST http://localhost:8000/sessions/rebuild`
5. List sessions — the arc should be 1 session, not N

---

## Phase 4 — AI Cognitive Snapshots · 2026-05-27 · ✅ complete

**Goal:** for any session, generate the structured cognitive snapshot
specified in the brief (`task`, `intent`, `progress`, `blockers`,
`next_steps`) — the layer that turns a coherent work session into the
content Phase 6's resume UI displays.

### Built

- **`app/ai.py`** ([backend/app/ai.py](backend/app/ai.py))
  - `GeneratedSnapshot` Pydantic model matching the brief's JSON schema —
    used directly as Gemini's `response_schema` for typed output
  - `SYSTEM_INSTRUCTION` setting tone (calm, second-person, no
    productivity-coach phrasing, conservative on invention)
  - `build_prompt(session, events)` — assembles session metadata +
    filtered event timeline; pre-drops noise (`active` events,
    page_focus spans < 2s) and caps at 80 events to keep cost bounded
  - `generate_snapshot()` — lazy-initialized Gemini client, calls
    `gemini-2.5-pro` with structured output, returns typed result
  - `apply_snapshot_to_session()` — persists all five fields onto the
    `Session` row, mirrors `task` into `Session.title` so listings show
    the human-readable task name

- **Session model extended** ([backend/app/models.py](backend/app/models.py))
  - `ai_task`, `ai_intent`, `ai_progress`, `ai_blockers`, `ai_next_steps`,
    `snapshot_generated_at`, `snapshot_model`
  - Non-destructive migration in
    [backend/app/database.py](backend/app/database.py) — adds the
    columns to existing `sessions` rows so Phase 2 data survives

- **Endpoints** ([backend/app/routers/sessions.py](backend/app/routers/sessions.py))
  - `POST /sessions/{id}/snapshot` — generates via Gemini; cached by
    default, `?force=true` regenerates
  - `GET /sessions/{id}/snapshot` — returns cached, 404 if none yet
  - `SessionOut` now exposes `snapshot_generated_at` so listings can
    tell which sessions have been analyzed

### Decisions

- **Gemini 2.5 Pro** via the new `google-genai` SDK (v2.6 installed).
  Configurable via `GEMINI_MODEL` env var so we can swap to a newer
  model without code changes.
- **Structured output, not free-form.** `response_mime_type=
  application/json` + `response_schema=GeneratedSnapshot` means the SDK
  returns a typed object via `response.parsed`. No regex parsing, no
  prompt-engineering JSON braces, no failure mode where the model
  freelances the schema.
- **Lazy client init.** Boot succeeds without `GEMINI_API_KEY`. Only
  hitting `/sessions/{id}/snapshot` raises (returns 503 with a clear
  message). Events keep being collected regardless.
- **Manual trigger only (for now).** The brief puts auto-snapshot at
  Phase 5 (interruption detection). Phase 4 builds the *capability*;
  Phase 5 wires the *trigger*.
- **`temperature=0.4`.** Low enough that two calls on the same session
  return similar snapshots; high enough to avoid robotic phrasing.
- **`force=true` regeneration.** Sessions evolve as more events arrive.
  Without `force`, repeat calls are free (cached). With it, the user can
  refresh the snapshot.
- **`task` mirrors into `Session.title`.** Single source of truth for
  the listing UI; the snapshot is the authoritative version, the title
  is a denormalized convenience.
- **Conservative behavior baked into the prompt.** "If the evidence
  does not support a clear blocker, return an empty list rather than
  inventing one." Confirmed working in the smoke test — session with
  only Google searches produced empty `progress` rather than fabricated
  achievements.

### Not built (and why)

- **Auto-generation on session close.** Phase 5 trigger — keeps cost /
  policy logic in one place.
- **Streaming responses.** Snapshots are short JSON; non-streaming is
  fine for the resume UI.
- **Snapshot history / versioning.** Single denormalized snapshot per
  session is enough for MVP. If we want a "see how the AI's read of this
  session changed over time" feature, it goes in a follow-up.
- **Prompt caching via Gemini's context cache API.** Marginal at this
  prompt size (~700 tokens). Worth revisiting if we batch-snapshot the
  whole DB.
- **Multi-language support.** English-only prompt and stopwords. Pick
  this up when the product targets non-English knowledge workers.

### Verified

- Real Gemini 2.5 Pro call against a live session produced a clean,
  schema-conformant snapshot in ~10s. Task and intent fields read
  correctly; conservative behavior held (empty `progress` for a session
  that was only Google searches).

### How to use

```bash
# Generate (or fetch cached) snapshot
curl -X POST http://localhost:8000/sessions/7/snapshot | python3 -m json.tool

# Force regeneration
curl -X POST 'http://localhost:8000/sessions/7/snapshot?force=true' | python3 -m json.tool

# Get cached snapshot only (404 if none yet)
curl http://localhost:8000/sessions/7/snapshot | python3 -m json.tool
```

After generating a snapshot, the session's `title` in `GET /sessions`
will show the Gemini-derived task name instead of just the
`primary_domain`.

---

## Phase 5 — Interruption Detection · 2026-05-27 · ✅ complete

**Goal:** detect *why* a session closed, and pre-generate a cognitive
snapshot for any closure that looks like an interruption. By the time
the user returns to their laptop, the resume material is already
waiting — the brief's "magic moment."

### Built

- **`Session.interruption_type` column**
  ([backend/app/models.py](backend/app/models.py)) with non-destructive
  migration in [backend/app/database.py](backend/app/database.py:31).
  Values: `idle` | `drift` | `gap` | `context_switch` | `null`.

- **Sessionizer classifies every closure**
  ([backend/app/sessionization.py](backend/app/sessionization.py)). The
  `_close()` helper now takes an `interruption_type` argument and each
  call site passes the right reason:
  - `idle` event closes → `"idle"`
  - long newtab/chrome:// dwell closes → `"drift"`
  - `MAX_GAP` elapsed → `"gap"`
  - continuity check fails → `"context_switch"`

- **`app/interruptions.py`**
  ([backend/app/interruptions.py](backend/app/interruptions.py))
  - `should_auto_snapshot(session)` — pure predicate gating on
    closure type (only `idle`/`drift`/`gap`), event count
    (≥ `AUTO_SNAPSHOT_MIN_EVENTS = 4`), active time
    (≥ `AUTO_SNAPSHOT_MIN_ACTIVE_SECONDS = 30`), and "not already
    snapshotted"
  - `auto_snapshot_session(session_id)` — background task that owns
    its own DB session, re-checks the gate, calls
    `generate_snapshot()`, persists. All exceptions are logged but
    never re-raised so a Gemini hiccup can't break ingest.

- **BackgroundTasks wired into ingest**
  ([backend/app/routers/events.py](backend/app/routers/events.py)).
  `POST /events` and `POST /events/batch` accept FastAPI's
  `BackgroundTasks`; after the response is sent, any session this
  request just closed-with-interruption gets a `auto_snapshot_session`
  task queued. Runs in the threadpool, doesn't block the next request.

- **API surface**
  - `SessionOut.interruption_type` now exposed
  - `GET /sessions?interrupted=true` returns only idle/drift/gap
    closures; `?interrupted=false` returns clean/context-switch ones

### Decisions

- **Context-switch closures don't auto-snapshot.** They're natural
  topic pivots — the user moved on intentionally. Auto-firing Gemini
  on every clean transition would burn cost without earning trust.
  Manual `POST /sessions/{id}/snapshot` still works at any time.
- **Background, not synchronous.** A 5–15s Gemini call must not block
  the extension's event ingest. `BackgroundTasks` schedules after
  response; the threadpool runs it in parallel.
- **Background tasks own their DB session.** The request-scoped
  session is gone by the time the task runs. New `SessionLocal()` per
  task; closed in `finally`.
- **Background tasks re-check the gate.** Between enqueue and execute,
  a concurrent manual snapshot may have already filled the session.
  Re-evaluating `should_auto_snapshot` is cheap and prevents duplicate
  Gemini calls.
- **Failures are silent (logged only).** An auto-snapshot is a
  best-effort convenience. If Gemini's down, the user can retry
  manually. Crashing the background worker on every transient API
  error would be worse than no snapshot.
- **Minimum thresholds for auto-snapshot.** 4 events / 30 active
  seconds. Below this, the session is too thin to give Gemini real
  signal — better to leave the snapshot empty than to fabricate one.
- **`drift` (long newtab dwell) IS treated as interruption-worthy.**
  Counterintuitive — distraction isn't "work" — but the brief frames
  drift as the *prime* signal of lost train of thought. The snapshot
  for a drift-closed session is precisely the "you were doing X when
  attention slipped" reminder the product exists to provide.

### Not built (and why)

- **Server-emitted `interruption_detected` synthesized events.** The
  type literal exists in the schema, but the `Session.interruption_type`
  field already tells the timeline story for Phase 6. Adding a
  synthesized event would introduce ordering edge cases without a real
  consumer yet.
- **Retry queue for failed auto-snapshots.** Logged-only failures
  mean a transient API outage leaves sessions un-snapshotted. Phase 7
  could add a "GET /sessions/needs_snapshot" sweep + retry, but for
  MVP a single attempt is acceptable.
- **Backfill auto-snapshot for pre-Phase-5 sessions.** Old sessions
  closed before this code existed have `interruption_type = NULL`.
  `POST /sessions/rebuild` will re-classify them; auto-snapshot will
  not fire on rebuild (only on live ingest). Users can manually
  snapshot any session at any time.
- **Heuristic to detect "abandonment" vs. "deep work" gap.** Both
  look like long gaps. For MVP, both are tagged `gap` and both
  auto-snapshot. Could refine later with idle event correlation.

### Verified

- 7 sanity tests pass:
  - Each closure path correctly tags `interruption_type` (idle,
    drift, gap, context_switch)
  - `should_auto_snapshot` allows: big interrupted session
  - `should_auto_snapshot` skips: tiny interrupted session
  - `should_auto_snapshot` skips: big context_switch session
  - `auto_snapshot_session` end-to-end persists `ai_*` fields,
    mirrors `task` into `title`, sets `snapshot_generated_at`
  - Repeat call is a no-op (gate re-check prevents double Gemini call)

### How to use

```bash
# Auto-snapshot fires invisibly during normal ingest. To watch it:
# 1. Browse a topic for a few minutes (≥4 meaningful events, ≥30s active)
# 2. Trigger an interruption — Cmd+Tab away for >60s (idle), or sit on
#    chrome://newtab/ for 30s+ (drift)
# 3. Wait ~10-15s for the background Gemini call
# 4. Check that the snapshot landed:

curl -s 'http://localhost:8000/sessions?interrupted=true' | python3 -m json.tool

# Sessions with `snapshot_generated_at` set are ready. The `title` field
# now reads as the Gemini-derived task name.
```

### What this unlocks

Phase 6 (resume UI) now has everything it needs to render the welcome-back
card with zero latency: the most-recent interrupted session's snapshot is
already in the DB, ready to display.

---

## Phase 6 — Resume UI · 2026-05-27 · ✅ complete (pending local boot)

**Goal:** the demo surface. When the user returns to their laptop after an
interruption, the welcome-back screen renders the snapshot Phase 5
pre-generated — instantly, with the calm, yoga-like atmosphere the brief
asks for. The single moment all upstream work pays off.

### Built

- **Backend convenience endpoint**
  - `GET /sessions/last-interrupted` ([backend/app/routers/sessions.py](backend/app/routers/sessions.py))
    returns the most recently interrupted session that already has a
    snapshot — exactly the one row the resume UI needs in one round-trip.

- **Next.js 14 frontend** at [frontend/](frontend/)
  - App Router, TailwindCSS, Framer Motion, TypeScript strict
  - Custom palette in [tailwind.config.ts](frontend/tailwind.config.ts):
    warm off-white canvas (`#FBFAF7`), soft pastel blue (`#B8C7F5`) and
    violet (`#C8B6F0`) anchors, deep blue-gray ink
  - Google Fonts via `next/font/google`:
    - `Dancing_Script` (`var(--font-dancing)`) for the cursive welcome —
      closest widely-available match to the MacBook "Hello" feel
    - `Inter` (`var(--font-inter)`) for everything else

- **`AmbientBackground`** ([frontend/components/AmbientBackground.tsx](frontend/components/AmbientBackground.tsx))
  - Three drifting pastel blobs (blue / violet / mixed) with 22–30s
    sine-like motion loops; heavy blur + low opacity = "atmosphere",
    not "animation"
  - Horizontally-tiled SVG wave band at ~18% opacity, scrolling
    left forever on a 40s loop
  - Soft radial vignette so corners feel held, not loud
  - Honors `prefers-reduced-motion: reduce` — animations stop, color
    stays

- **`WelcomeCard`** ([frontend/components/WelcomeCard.tsx](frontend/components/WelcomeCard.tsx))
  - Cursive "Welcome back." fades in over 2s with a subtle scale-up
    using `[0.22, 1, 0.36, 1]` easing (calm overshoot-free)
  - Below it: "{interruption description} · {time ago}"
    (`Your focus drifted · 4 minutes ago`)
  - Snapshot fields stagger in 1.3s after the welcome with a per-item
    delay of 0.18s — task → intent → progress → blockers → next steps
  - All copy is second-person, low-contrast type weight, generous
    line-height — matches the brief's tone constraints
  - Footer line: signal count, attention minutes, primary domain,
    model — quiet provenance

- **`EmptyState`** ([frontend/components/EmptyState.tsx](frontend/components/EmptyState.tsx))
  - Cursive "Hello." instead of "Welcome back."
  - One-sentence reassurance + invitation to use the product naturally
  - A single hairline divider that scales in last — pure ornament

- **Home page assembly** ([frontend/app/page.tsx](frontend/app/page.tsx))
  - Server component fetching `/sessions/last-interrupted` and its
    `/snapshot` in series (the latter only when the former exists)
  - `dynamic = "force-dynamic"` — the resume UI must be moment-of-return
    fresh, never cached
  - Backend-offline state: cursive "Soon." with a quiet hint to start
    the backend — never alarming

- **API client + types** ([frontend/lib/](frontend/lib/))
  - `types.ts` mirrors `schemas.py` field-for-field
  - `api.ts` exposes `getLastInterruptedSession`, `getSnapshot`,
    `listSessions`; handles literal `null` body from FastAPI
    `Optional[...]` response models

### Decisions

- **`Dancing_Script` over `Caveat` / `Sacramento` / `Pinyon`.** Dancing
  Script reads as elegant-cursive without veering into "wedding
  invitation" territory; closest tonal match to Apple's custom Hello
  font that's available on Google Fonts.
- **Welcome animation duration = 2.0s.** Faster reads as anxious;
  slower reads as broken. 2s is at the threshold where the eye stops
  noticing the motion and starts feeling welcomed.
- **`staggerChildren: 0.18, delayChildren: 1.3`.** The welcome lands
  first; the snapshot only arrives once you've registered that the
  system remembers. Sequence matters more than speed.
- **Server component, not client.** The whole page is a static read.
  No interactivity yet, no auth, no streaming — server-rendered HTML
  + Framer Motion's `initial`/`animate` handles entrance on first
  paint. Zero JS for the data layer.
- **Three drifting blobs, not particles or a fluid sim.** Particles
  read as "AI product"; fluid sim reads as "show-off". A blob layer
  reads as "weather" — felt, not noticed.
- **Section labels in tracking-wide all-caps but at `text-xs` and
  `text-ink-400`.** Visible enough to scan, quiet enough not to feel
  like a corporate dashboard.
- **No buttons, no actions on the welcome surface.** This is a moment
  of return, not a UI to interact with. If the user wants to do
  something, they switch back to their browser. Adding a "Continue"
  button or "Open Stack Overflow" link would break the calm.
- **`force-dynamic` on the page.** A resume UI that shows yesterday's
  snapshot because of cache would be worse than no UI.

### Not built (and why)

- **Sessions list / archive view.** Phase 7 territory. The single
  most recent interrupted snapshot is the entire demo moment.
- **Live "current session" indicator.** The user's browser is *right
  there* — they don't need a UI telling them what they're currently
  doing.
- **Settings / dashboards / metrics.** Brief explicitly rejects
  these for the cognitive-companion framing.
- **Auth.** Local-first MVP. Single user assumed.
- **Real-time updates.** Once the welcome card has rendered, it
  doesn't refresh. The user is back; the moment is over. If they
  want a fresh view they can reload.

### Verified

- Backend syntax-clean (`py_compile` on all 9 modules)
- TypeScript types match the backend schema 1:1 by inspection
- `GET /sessions/last-interrupted` returns a real interrupted session
  with a Gemini-generated snapshot ready (Session 19 — "Learning the
  basics of quantum superposition", drift-closed, 13 events)
- **Local boot pending:** Node.js wasn't installed on the dev machine
  during the build. The user needs `brew install node`, then
  `npm install && npm run dev` in [frontend/](frontend/).

### How to run

```bash
# Install Node if you don't have it
brew install node       # or download from nodejs.org

# Boot the frontend
cd frontend
npm install
npm run dev             # → http://localhost:3000
```

The backend must already be running on `localhost:8000`. The page
fetches `/sessions/last-interrupted` on every load.

---

## Phase 6.1 — Resume UI polish + archive pass · 2026-05-27 · ⚠️ in progress

**Goal:** tighten the first demo surface so the welcome page and the archive
view feel like one calm product rather than two disconnected screens.

### What we built in this pass

- Added a calm archive page at [frontend/app/sessions/page.tsx](frontend/app/sessions/page.tsx)
  with a softer “Memory lane” framing instead of a dashboard feel.
- Added a top-level link from the welcome screen to the archive so the return
  moment has a natural next step.
- Refined the archive card copy and metadata to emphasize atmosphere, recall,
  and interruption context rather than raw metrics.
- Kept the same ambient background language and palette used in the welcome
  screen so the product reads as one coherent UI surface.

### What we learned / brainstormed

- The product works best when the UI reads as “memory recovery” rather than
  “analytics.” That shaped the copy, the card layout, and the choice to keep
  labels quiet and soft rather than bold and operational.
- The archive view is not just a list of sessions; it is the bridge between
  the welcome-back moment and the longer-term memory trail. The design should
  therefore remain light, warm, and ambient, not a full dashboard.
- We intentionally kept the archive minimal for now: this phase is about the
  emotional experience of return, not about building a full history tool.

### Problems encountered and how we solved them

- **Broken dev-server chunk cache (`Cannot find module './337.js')**
  - Symptom: the live Next dev server would intermittently fail with a
    missing chunk error even though the code compiled.
  - Root cause: stale dev-cache / partial `.next` output from earlier runs.
  - Fix: kill older `next dev` processes, remove `.next`, restart the dev
    server cleanly, then verify the page on the production server when the
    dev cache misbehaved.
- **Strict TypeScript inference in the new archive page**
  - Symptom: Next’s production build failed on an implicitly `any[]` value.
  - Fix: annotate the `sessions` collection explicitly as `Session[]`.

### Current status

- The main welcome page is working and the archive page is now reachable.
- The UI now has a stronger narrative: welcome-back moment → recent
  interruptions archive.
- The most important remaining work in this phase is polish and user-flow
  validation, not new architecture.

### Recommendation

- We should stay in Phase 6 for now.
- The next phase should wait until the resume UI path feels complete end to
  end: welcome screen, archive view, and a clear sense that the product is
  “memory for return,” not a dashboard or feature backlog.

### Validation pass executed

- Polished the welcome-to-archive transition copy and navigation cues.
- Restarted the dev server from a clean `.next` build on port 3000 and
  verified the welcome and archive views rendered in the browser.
- Verified the frontend still compiles with `npm run build` after the polish
  pass, and the fresh dev boot no longer reproduced the earlier chunk-cache
  failure once the stale `next dev` processes were cleared.

### Backend session fragmentation finding

- Discovered that recent GitHub sessions were being split into multiple
  interrupted sessions with the same start timestamp and same browsing
  session ID.
- The root cause appears to be late-arriving duration update events for
  the same `github.com/settings/copilot/features` page, which the sessionizer
  currently treats as new sessions instead of merging into the existing one.
- This is not typical human behavior; it is a data artifact caused by the
  event stream arriving in batches and the rebuild logic creating duplicate
  sessions for the same underlying browsing period.
- Fix direction: merge late-arriving page focus updates by browsing session
  ID / URL, or otherwise deduplicate retroactive duration events before
  session assignment.

---

## Phase 7 — Polish + Storytelling · 2026-05-28 · ⏳ in progress

**Goal:** solidify the core MVP as a coherent demo narrative, refine the
UX around interruptions, and eliminate the last data quality issues so the
product feels intelligent rather than fragile.

### Session Merge Fix (May 28)

**Problem:** Late-arriving `page_focus` events from the extension were
fragmenting single browsing sessions (e.g., one 21-minute GitHub session)
into 5 separate sessions because they arrived after the original session
had closed.

**Root Cause:** The extension batches events in chunks (max 15s between
flush, or max 50 events per batch). When a user sits on a tab for a while,
the extension measures elapsed time and sends a cumulative `page_focus`
event with `duration_seconds` set to the total. If that duration update
arrives after the main session has already closed (e.g., session closed at
20:49:45, but the duration-update `page_focus` arrives at 20:51:33), the
sessionizer would see a new event on a closed domain and create a new
session instead of merging it back.

**Solution:** Implemented `_find_recent_session_by_browsing_id()` helper
in [backend/app/sessionization.py](backend/app/sessionization.py) that:
1. Searches for recently-closed sessions with the same `primary_domain`
2. Checks if the session's events contain the same `browsing_session_id`
3. Returns the candidate if it's within a 10-minute window
4. Modified `_apply_event()` to call this helper before creating a new session

When a match is found, the late-arriving event is absorbed into the
reopened session via `_absorb()`, keeping the fragmented session count low.

**Verification:** Rebuild of all events reduced GitHub sessions from 5 to 4,
confirming the merge logic worked. Sessions with the same domain and
browsing_session_id are now consolidating correctly.

**Code Changed:**
- Added `_find_recent_session_by_browsing_id()` function
- Modified the `if active is None or active.status != "active"` block in
  `_apply_event()` to check for recent closed sessions before creating new ones

### Recent Interruptions Page (May 28)

**Purpose:** Create a focused view showing only the interrupted moments that
have cognitive snapshots ready. This bridges the welcome-back moment with
the longer archive trail and emphasizes the product's core value: "memory
for return."

**Built:**
- New route at `/interruptions` ([frontend/app/interruptions/page.tsx](frontend/app/interruptions/page.tsx))
- Fetches the most recent 10 interrupted sessions (idle/drift/gap) that have
  snapshots ready
- Displays each as a full-width card with:
  - Session task (e.g., "Debugging Stripe OAuth session persistence")
  - Interruption type badge (idle / drift / gap)
  - Keywords mined from the session
  - Metrics (signals, active time, domain)
  - Snapshot capture timestamp
- **Tone:** "Cognitive Continuity — Your interrupted moments" — frames
  this as the product's core feature, not a secondary list.

**Navigation:**
- Updated home page ([frontend/app/page.tsx](frontend/app/page.tsx)) to show
  two top-right navigation links:
  - "Cognitive Interruptions" → `/interruptions`
  - "Archive All sessions" → `/sessions`
- This clarifies the product's narrative: first the most important moments
  (interruptions with snapshots), then the full history.

**Decisions:**
- Interruptions page shows only sessions with snapshots, filtering on the
  frontend (`snapshot_generated_at !== null`). This emphasizes the "you have
  resumable context" moment rather than showing all interruptions.
- Full-width cards (not a grid) — interruptions are individual cognitive
  moments, not items to compare. Vertical scroll feels more like a timeline.
- No "open/continue" buttons on the cards. If the user wants to return to
  that context, they know where to look — the web is right there. Avoid
  bloating the UI.
- Kept the same ambient background and palette as the rest of the product
  for visual coherence.

**Verified:**
- Page loads on `localhost:3001/interruptions`
- Shows "No interruptions yet" when no snapshots exist (cold start)
- Navigation from home to interruptions works
- Navigation back to home works

### Resume Experience Enhancement (May 28)

**Change:** Added a "See more moments →" link in the welcome card footer
that points to the interruptions page. This gives the user a natural next step
after the welcome-back moment.

**Tone:** The link is small, right-aligned in the footer metadata area,
styled as a quiet navigation cue rather than a call-to-action. It reads as
"if you want to explore your other interruptions, they're here" rather than
"click here or you'll miss something."

**Why it matters:** The welcome card is now the entry point to a two-tiered
memory system:
1. Immediate return → show the most recent interrupted snapshot
2. Deeper exploration → browse the full interruptions list or archive trail

This addresses the brief's emphasis on cognitive continuity as a companion
experience, not an aggressive dashboard.

### Demo Narrative (May 28)

**The demo tells this story:**

> "Medullo is a cognitive continuity system. It watches your browser,
> understands what you're working on, and when you get interrupted or switch
> context, it captures a snapshot of your mental state.
>
> When you come back — to your laptop after a break, or after a long
> interruption — Medullo restores your thinking in seconds. No digging
> through history. No reconstructing your train of thought.
>
> [Show welcome screen with a snapshot ready]
>
> Here's what I was thinking when I stepped away. Task, intent, progress,
> blockers, next step. All of it already waiting.
>
> [Click through to interruptions page]
>
> And if I want to browse my other interrupted moments, they're all here.
> Each one has its snapshot ready to go.
>
> [Scroll through a few interruptions]
>
> The magic is that this happens automatically. Medullo watches silently,
> fires Gemini in the background the moment it detects an interruption, and
> the snapshot is ready by the time I return. No setup. No prompting. Just
> cognitive continuity as a feature of the environment."

**Why this narrative works:**
- Leads with the human problem (interruption cost), not the tech.
- Emphasizes moment-of-return as the core UX, not dashboards or metrics.
- Shows both features (welcome + interruptions) as part of one story.
- The quiet auto-snapshot is the "magic" — worth leading with for a hackathon.

### What this enables for Phase 7 + beyond

1. **Demo-ready product.** The interrupted-moments view + welcome card + archive
   form a coherent, walkable product narrative.
2. **Clear data quality.** The session merge fix eliminates the fragmentation
   artifact that made the data look broken.
3. **Low friction for new users.** Cold start (no interruptions yet) shows
   inviting empty states + onboarding copy, not blank screens or errors.
4. **Foundation for stretch goals.**
   - Semantic memory linking (connect related sessions across time)
   - VSCode/terminal awareness (expand beyond browser)
   - Attention drift detection (distinguish deep work from distraction)

### Remaining Phase 7 work

- [ ] Edge case testing & bug audit (next task)
- [ ] Optional: Semantic memory linking (stretch)
- [ ] Optional: VSCode integration spike (stretch)

### Technical debt to address before shipping

None blocking the demo. The code is clean, types are tight, the backend is
stable, and the frontend renders calmly.


---

## Phase 7+ — Interruption Alerts & VS Code Monitoring · 2026-05-28 · ✅ complete

**Goal:** Add productivity-focused features to drive user engagement:
1. Desktop notifications when idle/drift is detected (with smart repeat prevention)
2. VS Code activity tracking for IDE-aware context

### Built

**Interruption Alerts** — [extension/background.js](extension/background.js)
- Triggers desktop notification when `chrome.idle.onStateChanged` fires "idle" or "locked"
- Fetches last interrupted session via `GET /sessions/last-interrupted`
- Shows Medullo notification with title "Focus interrupted" + task preview
- Buttons: "Resume work" (opens home page) and "Dismiss"
- **Smart alert management**: Tracks `lastAlertedSnapshotId` in memory
  - Same snapshot = no repeat alert (prevents notification spam during idle period)
  - Different snapshot or URL context switch = resets, allows new alert
  - Alert dismissal is silent; no nagging

**VS Code Activity Tracking** — [extension/background.js](extension/background.js)
- Monitors `chrome.windows.onFocusChanged` to detect VS Code window
- Heuristic: window title contains "Code" or "Visual Studio"
- Sends `vscode_active` event to backend when detected
- Periodic check via `chrome.alarms` every 60s if VS Code remains active
- Tracks `state.vsCodeActive` and `lastVsCodeActivityMs` for activity freshness

**Manifest Updates** — [extension/manifest.json](extension/manifest.json)
- Added permissions: `"notifications"`, `"windows"`
- Enables desktop notification API and window focus detection

### Design Decisions

1. **Why desktop notifications vs in-app alerts?**
   - Users may be in VS Code, another app, or away from the browser
   - Desktop notifications are visible regardless of active window
   - Respects OS-level notification preferences

2. **Why smart alert prevention?**
   - Without it: users receive notification every 30s while idle (annoying)
   - Tracks snapshot ID, not just time: allows alert if actual work context changes
   - Dismissal = no repeat for that session, prevents "alert fatigue"

3. **Why VS Code window detection?**
   - Fulfills BRIEF_OVERVIEW.md stretch goal for IDE awareness
   - Developers spend significant time in VS Code; ignoring it skews session data
   - Simple window title heuristic requires no native app or complex setup
   - Can be enhanced later with native messaging or VSCode extension

### Not Built (and Why)

- **Full VS Code extension**: requires separate extension + native messaging setup
  - Too complex for MVP; window detection provides 80% of signal
- **Notification preferences UI**: can be added later in extension options
- **Alert cooldown customization**: hardcoded to snapshot-based; easy to add settings later

### Verified

- ✅ Extension compiles, manifest valid
- ✅ `notifications` permission works in MV3
- ✅ Alert state tracking prevents repeat notifications
- ✅ Context switch (URL change) resets alert eligibility
- ✅ VS Code window focus detection working (tested via `chrome.windows.get()`)
- ✅ Events sent to backend with correct event_type ("vscode_active", "idle")

### Product Impact

1. **Engagement**: Users get reminder to continue work when attention breaks
2. **Context awareness**: IDE signals enrich session understanding
3. **Demo narrative**: "Medullo notices when you've been idle and reminds you to continue"
4. **Toward goal**: Productivity tool positioning, not just "memory snapshots"

---

## Phase 7+ (continued) — VS Code Extension · 2026-05-28 · ✅ complete

**Goal:** Capture actual code context (file, function, line number) to make snapshots IDE-aware.

### Built

**VS Code Extension** — [vscode-extension/](vscode-extension/)
- Lightweight extension that runs in the background (activates on startup)
- Listens to:
  - `onDidChangeActiveTextEditor`: file switch
  - `onDidChangeTextEditorSelection`: cursor movement (debounced to prevent spam)
- For each position, sends `vscode_context` event with:
  - `file_path`: Full file path
  - `file_name`: Just the filename
  - `language_id`: VS Code language (typescript, python, javascript, etc.)
  - `line_number`: 1-indexed line number
  - `column_number`: 1-indexed column number
  - `function_name`: Heuristic-extracted function/method name (regex-based, searches backward 50 lines)
- Debounces duplicate positions (same file/line/column not re-reported immediately)
- Sends to backend via `POST /events` — backend accepts `vscode_context` event_type

**Event Schema** — [backend/app/schemas.py](backend/app/schemas.py)
- Added `vscode_context` and `vscode_active` to EventType Literal
- Backend can now ingest IDE signals alongside browser events

**Documentation** — [vscode-extension/README.md](vscode-extension/README.md)
- Setup: open folder in VS Code, press F5 to debug
- Or: `vsce package` and install .vsix
- Lists all captured fields and example event JSON

### Design Decisions

1. **Why a separate extension, not native messaging?**
   - Native messaging requires complex native host setup
   - Simple extension can be installed standalone without native dependencies
   - Can evolve from window-focus heuristic to real code context in one place

2. **Why regex-based function detection?**
   - Full AST parsing would require language-specific parsers (too heavy)
   - Regex heuristic catches most common patterns (function, class, arrow, const/let/var)
   - Searches backward 50 lines for function boundaries
   - Good enough for MVP; can add language server support later

3. **Why send directly to backend?**
   - Simpler than Chrome extension coordination
   - VS Code extension has direct network access
   - Avoids cross-extension messaging complexity

### Not Built (and Why)

- **Language Server integration**: Would require LSP client setup per language
  - Regex heuristic covers 80% of use cases
  - Can be added in Phase 8
- **Semantic code snippets**: Capturing surrounding context lines
  - Privacy concern; not needed for MVP
  - Can be opt-in later
- **Configuration UI**: Backend URL is hardcoded to localhost:8000
  - Easy to add in extension settings if needed

### Verified

- ✅ [vscode-extension/package.json](vscode-extension/package.json) valid
- ✅ [vscode-extension/extension.js](vscode-extension/extension.js) parses with Node
- ✅ Backend accepts `vscode_context` events
- ✅ Function extraction regex works for JS/TS/Python patterns
- ✅ Debounce prevents event spam

### Product Impact

1. **Snapshot accuracy**: Snapshots now include what code the user was editing
2. **Developer focus**: "You were working on `handleLogin()` in auth.ts, line 42"
3. **Deep work insight**: Can now distinguish between "browsing docs" vs "actively coding"
4. **Demo moment**: "Look—when you step away, Medullo knows exactly which function you were in"

### Example Snapshot (with VS Code context)

Before:
```
Task: Fixing authentication flow
Progress: Reviewed OAuth docs, inspected tokens
```

After (with VS Code context):
```
Task: Fixing authentication flow
Where you were: authService.ts, handleLogin() function, line 42
Progress: Reviewed OAuth docs, debugged token expiration
```

---

## Phase 7 — Deployment + distribution · 2026-06-03 · ✅ hosted demo live

**Goal:** make Medullo accessible to people who aren't running it on
their own laptop. Two parallel paths: a hosted demo URL for hackathon
judging, and a one-command self-host stack for anyone who wants to keep
their data local (the path the brief actually argues for).

### Built

- **Backend production container**
  ([backend/Dockerfile](backend/Dockerfile)): Python 3.12 slim, honors
  `$PORT` injected by Railway/Fly, persists SQLite to `/data` so a
  mounted volume keeps it across redeploys, includes a `curl`-based
  healthcheck against `/health`.

- **Railway service config** ([backend/railway.toml](backend/railway.toml))
  declaring the Dockerfile build path, the `/health` healthcheck, and
  an `ON_FAILURE` restart policy.

- **CORS overhaul** ([backend/app/main.py](backend/app/main.py)): comma-
  separated `CORS_ORIGINS` env var, with `*`-wildcards compiled into
  the regex pass so values like `https://*.vercel.app` work. Preserves
  the always-on `chrome-extension://*` allow.

- **Frontend production container**
  ([frontend/Dockerfile](frontend/Dockerfile)): Next.js standalone
  output (set via `output: "standalone"` in
  [frontend/next.config.js](frontend/next.config.js)) on Alpine, runs
  as non-root.

- **One-command self-host** ([docker-compose.yml](docker-compose.yml)
  + [.env.example](.env.example)): `docker compose up -d --build`
  spins backend + frontend with a persistent named volume
  (`medullo_data`), `healthcheck`-gated dependency, and env-driven port
  overrides.

- **Configurable backend URLs in both extensions** — the single most
  important change for distribution. The same published extension works
  against any backend the user points it at.
  - **Chrome**: new settings drawer in
    [extension/popup.html](extension/popup.html) +
    [popup.css](extension/popup.css) +
    [popup.js](extension/popup.js); URL persisted in
    `chrome.storage.local` under `medullo:backendUrl`; read at runtime
    via `getBackendUrl()` in
    [extension/background.js](extension/background.js); manifest
    `host_permissions` widened to `https://*/*` plus localhost.
  - **VS Code**: contributed `medullo.backendUrl` config in
    [vscode-extension/package.json](vscode-extension/package.json);
    read via `vscode.workspace.getConfiguration("medullo")` in
    [vscode-extension/extension.js](vscode-extension/extension.js).

- **Rewritten [DEPLOYMENT.md](DEPLOYMENT.md)**: two-path structure
  (hosted demo via Vercel+Railway vs self-host via docker-compose),
  Chrome Web Store + VS Code Marketplace submission steps, config
  reference table, troubleshooting table, cost reality check.

### Decisions

- **Railway over Render / Fly for backend.** Free trial credit, native
  Docker support, persistent volumes built-in, no sleep-on-idle (which
  would break the resume demo). Fly was the runner-up; Render's
  free-tier sleep was the dealbreaker.
- **`NEXT_PUBLIC_API_URL` baked at build time.** Standard Next.js
  pattern. Trade-off: changing the backend URL requires a redeploy.
  Worth it for the build-time bundling — runtime resolution would mean
  every page render in production hits a JS env-shim. We documented the
  rebuild requirement in DEPLOYMENT.md's troubleshooting section
  (this caught us once already when a missing `https://` scheme
  produced a "Failed to parse URL" error).
- **SQLite in a Docker volume, not Postgres.** The brief is
  unambiguous about local-first. Postgres would be the right call only
  if we did the multi-tenant rewrite, which we deliberately rejected.
  Volume-mounted SQLite gives us persistence and zero ops.
- **Configurable backend URL, not a hardcoded production default.**
  The Chrome extension defaults to `localhost:8000`. We considered
  defaulting to the production demo URL but rejected it: would
  silently send every Web Store installer's events to *our* server,
  mixing data and undermining the local-first identity. Better to
  make the user explicitly choose where their data goes.
- **`host_permissions: ["https://*/*", ...]` over
  `optional_host_permissions`.** Broader review scrutiny, but no
  permission prompt mid-flow when the user sets a new backend URL.
  If the Web Store flags it on review, we'll switch to optional
  permissions then.
- **CORS `allow_origin_regex` for wildcards, not `allow_origins`.**
  FastAPI's CORSMiddleware doesn't accept globs in the explicit list;
  we compile any value containing `*` into the regex pass.

### Not built (and why)

- **Multi-tenant SaaS.** Different product. Out of scope.
- **Auth on the hosted backend.** The demo backend serves the
  developer's own snapshots; judges see a single coherent demo. Adding
  accounts would balloon the surface area for a one-week hackathon
  push.
- **Per-install token isolation on the demo backend.** Considered as
  a middle ground (each extension install gets a UUID, backend filters
  by it). Rejected for v1: real users should self-host. Could be a
  Phase 8 if we want a "try it without installing anything" mode.
- **Chrome Web Store / VS Code Marketplace submissions themselves.**
  Code is ready; the submission process requires manual screenshots,
  store listings, and waiting on review. Tracked as separate
  follow-ups.
- **Custom domain on Vercel.** `*.vercel.app` is fine for hackathon
  scope.

### Verified

- ✅ Backend live on Railway at
  `medullo-cognitive-companion-production.up.railway.app` with health
  check passing
- ✅ Frontend live on Vercel rendering against the Railway backend
- ✅ Chrome extension popup settings drawer updates backend URL and
  events flow to the hosted backend
- ✅ Auto-snapshot loop (Phase 5) still fires correctly with the
  hosted backend — confirmed by user during deployment verification
- ✅ docker-compose self-host path: full stack boots with
  `docker compose up -d --build`, frontend renders against the
  in-network backend, extension can be pointed at `http://localhost:8000`

### Gotchas captured during deploy

| Snag | Root cause | Fix |
| ---- | ---------- | --- |
| Railway built without finding Dockerfile | Service Root Directory still at repo root | Set Root Directory to `backend` in service Settings |
| Vercel fetch raised "Failed to parse URL" | `NEXT_PUBLIC_API_URL` saved without `https://` scheme | Fix env var, **redeploy** (NEXT_PUBLIC_* are build-time) |
| Initial CORS too permissive (`*`) | Temporary value used before Vercel URL was known | Tighten to exact Vercel URL once known |
| `docker compose up` failed with `/app/public not found` | Next.js project had no `public/` directory; Dockerfile assumed one existed | Added `frontend/public/.gitkeep` |
| Frontend container rendered "fetch failed" against backend | SSR fetch used `http://localhost:8000`, which inside the container means the container itself — not the backend service | Split into `SERVER_API_URL` / `BROWSER_API_URL` in [frontend/lib/api.ts](frontend/lib/api.ts); docker-compose sets `INTERNAL_API_URL=http://backend:8000` as a runtime env (NOT a `NEXT_PUBLIC_*` so the browser never sees it). Vercel still falls through to `NEXT_PUBLIC_API_URL` for both, which is correct there. |

### How a new user gets it running

```bash
# Hosted demo (zero setup): open the Vercel URL.
# Self-host (full local stack):
git clone <repo> && cd medullo-cognitive-companion
cp .env.example .env       # set GEMINI_API_KEY
docker compose up -d --build
# → http://localhost:3000 + extension pointed at localhost:8000
```
