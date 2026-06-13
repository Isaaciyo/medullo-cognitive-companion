# Medullo — Second Brain

> A quiet second working memory.
> Built for the **International AI Agents Hackathon**.

**🌿 Live demo:** [medullo-cognitive-companion.vercel.app](https://medullo-cognitive-companion.vercel.app)

Medullo is an AI cognitive continuity system. It quietly observes the
lightweight signals of your digital workflow — tabs you switch to, pages you
linger on, moments your focus drifts — and reconstructs *what you were
trying to do* the next time you sit back down.

The product is **memory augmentation**, never surveillance. No keylogging,
no screen recording, no webcam. Just the kind of ambient context that keeps
your train of thought from falling off the rails every time the world
interrupts it.

---

## The problem

Modern knowledge workers lose a quiet but significant amount of time each
day rebuilding context after interruptions: a meeting, a Slack ping, a
coffee refill, a moment of drift on a new tab.

You sit back down and the same questions surface every time:

> *What was I doing? Why did I open these tabs? What was that one error
> message? What was I about to try next?*

Most productivity tools track tasks and files. Almost none preserve
**cognitive context** — the intent, the progress, the blockers, the next
step you had already decided on. So you reconstruct it from scratch, dozens
of times a day, and most of it stays unconscious cost.

Medullo's premise is that **AI is the right tool for this specific job**:
quiet observation, semantic synthesis, structured restoration. Not a
chatbot, not a dashboard — a piece of cognitive scaffolding that helps
humans keep momentum in a fragmented digital environment.

---

## What it does

```
┌─ Chrome Extension ───────────────────────────────────────┐
│  Active tab · page focus · idle · search queries         │
│  Drift detection (long dwells on chrome://newtab/)       │
└──────────────────────────────────────────────────────────┘
                            ↓
        Event collection · batched · resilient to outages
                            ↓
┌─ FastAPI + SQLite Backend ───────────────────────────────┐
│  Sessionization (groups events into coherent work)       │
│  Interruption detection (idle / drift / gap)             │
│  AI snapshot generation (Gemini 2.5 Pro)                 │
└──────────────────────────────────────────────────────────┘
                            ↓
┌─ VS Code Extension ──────────────────────────────────────┐
│  Active file · cursor position · function context        │
└──────────────────────────────────────────────────────────┘
                            ↓
┌─ Next.js Resume UI ──────────────────────────────────────┐
│  Welcome back · You were … · Where you got stuck …       │
│  Interruptions archive · full session history            │
└──────────────────────────────────────────────────────────┘
```

The single demo moment to optimize for is the one where you return to your
laptop after an interruption and Medullo *already knows* what you were
doing. The snapshot was pre-generated the moment your attention drifted —
so the welcome screen renders instantly, with no spinning, no prompting.

---

## What it feels like

Open `localhost:3000` after a stretch of real work and you'll see something
like this:

> ## *Welcome back.*
>
> Your focus drifted · 4 minutes ago
>
> **You were**
> Researching how to run Apex Legends on Mac
>
> *You were comparing cloud-streaming options (GeForce Now, Shadow PC) and
> Boot Camp performance on Apple Silicon, with the goal of playing without
> dual-booting.*
>
> **What you did**
> · Compared Shadow PC vs GeForce Now on the EA site
> · Read Reddit threads on Boot Camp performance
>
> **Where you got stuck**
> · Unclear which cloud option has the lowest input latency
>
> **A possible next step**
> · Sign up for GeForce Now's free tier and benchmark a match

That paragraph wasn't there a moment ago. The system inferred it from your
tabs, your dwell time, the URLs you opened — and Gemini generated the
structured snapshot the instant your attention slipped.

---

## Architecture

The project is local-first by default, but now supports a hosted multi-user
backend. In hosted mode, each extension/UI provisions a bearer token that maps
to a backend-owned user ID; every event, session, and snapshot query is scoped
to that authenticated user.

| Component         | Stack                                     |
| ----------------- | ----------------------------------------- |
| Backend           | FastAPI · SQLAlchemy · SQLite             |
| AI layer          | Google Gemini 2.5 Pro (`google-genai`)    |
| Chrome extension  | Manifest V3 · service worker · vanilla JS |
| VS Code extension | VS Code Extension API · Node              |
| Frontend          | Next.js 14 (App Router) · Tailwind · Framer Motion |

The self-host path still runs fully on your machine. The hosted path can run on
Railway with your Gemini API key; user data is separated by authenticated
`user_id`, not by trusting client-supplied IDs.

---

## Try it

Two paths, depending on what you want:

- **Just look at it** — open the [live demo](https://medullo-cognitive-companion.vercel.app).
  You'll see the developer's own cognitive snapshots rendered against the
  hosted backend. No install required.

- **Use it on your own browsing** — sideload the Chrome extension from
  [extension/](extension/) (`chrome://extensions` → Developer mode → Load
  unpacked), then point its backend URL at either the hosted demo or a
  self-hosted stack (see **Setup** below). The same extension works
  against either.

Full deployment + self-host instructions live in
[DEPLOYMENT.md](DEPLOYMENT.md).

---

## Setup

You'll need:

- **Python 3.11+** (3.13 or 3.14 also work)
- **Node 20+** (`brew install node` on macOS)
- **Google Chrome** with Developer mode enabled
- **VS Code** (optional, for the IDE-context extension)
- A **Gemini API key** from [aistudio.google.com](https://aistudio.google.com/apikey)

The fastest local setup is `docker compose up -d --build` at the repo
root — see [DEPLOYMENT.md § Self-host](DEPLOYMENT.md#path-2--self-host-docker-compose).

If you'd rather run each component by hand, the instructions below cover
that. Start them in order so the extensions have something to talk to.

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Open .env and set GEMINI_API_KEY=...

uvicorn app.main:app --reload --port 8000
```

The SQLite database is created automatically at `backend/medullo.db` on
first run. Visit [http://localhost:8000/docs](http://localhost:8000/docs)
for the OpenAPI explorer.

Quick health check:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/events/stats
```

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). Until you've
browsed enough to generate a snapshot, the screen shows a quiet
empty state — that's expected.

### 3. Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** and select the `extension/` folder
4. Pin the Medullo icon to the toolbar (puzzle-piece menu → pin)

The published extension defaults to the hosted Railway backend. For local
self-hosting, open the popup, click the **Backend** row, and set it to
`http://localhost:8000`. The popup will surface a `Last error` line if it
can't reach the selected server.

### 4. VS Code extension (optional)

The VS Code extension enriches sessions with IDE context: active file,
cursor position, and function name.

```bash
cd vscode-extension
# In VS Code, run: File → Open Folder → select vscode-extension/
# Press F5 to launch an Extension Development Host
```

Or to package and install via `.vsix`:

```bash
cd vscode-extension
npm install -g @vscode/vsce
vsce package
# Then in VS Code: Extensions → ⋯ → Install from VSIX
```

---

## What the Chrome extension collects

Lightweight workflow signals only.

| Event           | When it fires                                                |
| --------------- | ------------------------------------------------------------ |
| `tab_switch`    | Active tab changes, window focus changes, URL changes        |
| `page_focus`    | A tab's span closes — carries `duration_seconds`             |
| `page_loaded`   | A page's real title finalizes (after loading-state stub)     |
| `search_query`  | Active URL matches a known search host (Google, GitHub, …)   |
| `idle`          | OS idle for ≥60s, or screen locked                           |
| `active`        | Returns from idle                                            |

Events are queued in `chrome.storage.local` and flushed every ~15 seconds
(or sooner if 50 pile up), so a brief backend outage will not lose data.

---

## Data shape

Each event looks roughly like this:

```json
{
  "timestamp": "2026-05-27T17:23:25Z",
  "event_type": "page_focus",
  "app": "Chrome",
  "title": "Stripe OAuth Refresh Tokens",
  "url": "https://docs.stripe.com/oauth/refresh",
  "duration_seconds": 124,
  "browsing_session_id": "abc123",
  "extra": null
}
```

The backend additionally records `received_at`, a parsed `domain`, and —
after sessionization — a `session_id` linking it to a semantic work
session.

A finished session, after AI snapshot generation, looks like:

```json
{
  "id": 19,
  "title": "Research how to run Apex Legends on Mac",
  "primary_domain": "esports.gg",
  "started_at": "2026-05-27T17:18:00Z",
  "ended_at": "2026-05-27T17:30:14Z",
  "status": "closed",
  "interruption_type": "drift",
  "event_count": 13,
  "total_active_seconds": 488,
  "ai_task": "Research how to run Apex Legends on Mac",
  "ai_intent": "Find a way to play without dual-booting",
  "ai_progress": ["Compared Shadow PC vs GeForce Now", "Read Reddit on Boot Camp"],
  "ai_blockers": ["Unclear which cloud option has lowest latency"],
  "ai_next_steps": ["Benchmark GeForce Now's free tier"]
}
```

---

## Repository layout

```
backend/                  FastAPI + SQLite + Gemini
  app/
    main.py               App + CORS + DB init
    database.py           SQLAlchemy engine + migrations
    models.py             Event / Session tables
    schemas.py            Pydantic validation models
    sessionization.py     Heuristic session-grouping engine
    ai.py                 Gemini client + snapshot prompt
    interruptions.py      Auto-snapshot trigger logic
    routers/
      events.py           /events, /events/batch, /events/stats
      sessions.py         /sessions, /sessions/last-interrupted, /snapshot
  requirements.txt
  .env.example

extension/                Chrome MV3 extension
  manifest.json
  background.js           Service worker, queue, drift detection
  config.js               Backend URL + search-host map
  popup.html | .css | .js
  icons/

vscode-extension/         VS Code extension
  package.json
  extension.js            Active file + cursor + function tracking
  README.md

frontend/                 Next.js 14 (App Router)
  app/
    page.tsx              Welcome / resume screen
    interruptions/        Recent interrupted moments
    sessions/             Full session archive
    globals.css
    layout.tsx
  components/
    AmbientBackground.tsx Drifting pastel blobs + SVG waves
    WelcomeCard.tsx       Cursive welcome + snapshot reveal
    EmptyState.tsx        Quiet first-launch screen
  lib/
    api.ts                Backend client
    types.ts              TS types mirroring backend schemas

README.md                 You are here
BRIEF_OVERVIEW.md         Project vision + architecture rationale
BUILD_LOG.md              Phase-by-phase development record
DEMO_SCRIPT.md            Hackathon demo narrative
DEPLOYMENT.md             Deployment notes
```

---

## Design constraints

Worth re-reading before contributing — these shape every decision in the
codebase:

- The product is **memory augmentation**, never **monitoring**. Keep
  collection lightweight and the framing trustful.
- Tone is calm, ambient, supportive. Avoid loud dashboards, gamification,
  or productivity-guilt aesthetics.
- The AI layer produces **structured JSON**, not chatbot prose.
- MVP scope stays tight. No team features, no enterprise dashboards, no
  unnecessary agent orchestration.
- Be conservative about claims. If the events don't support a clear task
  or blocker, the snapshot leaves the field empty rather than fabricating.

---

## Built for the International AI Agents Hackathon

Medullo is our entry for the **International AI Agents Hackathon** — a
working demonstration that an AI workflow agent can do quiet,
useful, dignity-respecting work without ever feeling like a chatbot or a
surveillance tool.

The hidden cognitive tax of context switching is one of the most universal
problems in modern knowledge work. We think AI is uniquely well-suited to
help with it — not by automating decisions, but by gently restoring the
context you already had.

Try it: [medullo-cognitive-companion.vercel.app](https://medullo-cognitive-companion.vercel.app)

Welcome back.
