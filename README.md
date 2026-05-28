# Medullo — Second Brain

> Semantic RAM for human cognition.

Medullo is an AI cognitive continuity system. It observes lightweight workflow signals,
infers what you were working on, and helps you recover your mental state after an
interruption. Built for the International AI Agents Hackathon.

This repository is being built in phases. **Phase 6 (current): UI Polish. Most core features complete.**

```
Browser Extension  →  Event Collection  →  Sessionization  →  SQLite
                              ↓                     ↓
                          SQLite         [Rebuild endpoint]
                              ↓
                     AI Interpretation (Gemini 2.5 Pro)
                              ↓
                  Snapshot + Resume System (auto-snapshot + sessions API)
                              ↓
                      Next.js Frontend UI
```

---

## Completion Status

**✅ Phase 1–5 Complete:**
- Chrome MV3 extension with event collection (tab_switch, page_focus, idle, active, search_query)
- FastAPI backend with event ingestion, sessionization, rebuilding, and AI snapshot generation
- SQLite persistence with Event/Session ORM models
- Sessionization engine with interruption detection (idle/drift/gap/context_switch)
- Gemini 2.5 Pro integration for cognitive snapshots (auto-triggered on interruptions)
- Session merge logic (handles late-arriving events from extension)

**✅ Phase 6 In Progress:**
- Next.js archive/memory lane UI (`/sessions`) with scrolling fixed and smart titles
- Welcome screen with session cards and ambient animations
- Session detail views with snapshot display
- Context restoration workflow

**⏳ Phase 7 (Stretch - In Progress):**

Polish + Storytelling Checklist:

- [ ] Recent Interruptions Page (`/interruptions`) — Show last 10 interrupted sessions with snapshots
- [ ] Semantic Memory Linking — Connect related sessions across time
- [ ] Resume Experience Enhancement — Improve context restoration flow
- [ ] Demo Refinement — Polish narrative for hackathon presentation
- [ ] Testing & Edge Cases — Audit for bugs, handle extension edge cases
- [ ] VSCode Integration — Observe code editor activity (optional stretch)

---

## Running the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Then visit [http://localhost:8000/docs](http://localhost:8000/docs) for the OpenAPI UI.

Quick smoke test:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/events/stats
```

The SQLite database is created automatically at `backend/medullo.db`.

---

## Loading the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** and select the `extension/` folder
4. The Medullo icon appears in the toolbar — pin it for visibility

The extension expects the backend at `http://localhost:8000`. Start the backend first
or the popup will surface a `Last error` line until it can reach the server.

### What the extension collects

Lightweight workflow signals only. No keylogging, no screen recording, no webcam.

| Event           | When it fires                                                |
|-----------------|--------------------------------------------------------------|
| `tab_switch`    | Active tab changes, window focus changes, URL changes        |
| `page_focus`    | The previous tab span closes — carries a `duration_seconds`  |
| `search_query`  | Active URL matches a known search host (Google, GitHub, …)   |
| `idle`          | OS idle for ≥60s, or screen locked                           |
| `active`        | User returns from idle                                       |

Events are queued in `chrome.storage.local` and flushed every ~15 seconds (or sooner
if the queue reaches 50 items), so a brief backend outage will not lose data.

---

## Data shape

```json
{
  "timestamp": "2026-05-21T18:22:00Z",
  "event_type": "tab_switch",
  "app": "Chrome",
  "title": "Stripe OAuth Docs",
  "url": "https://docs.stripe.com/oauth",
  "duration_seconds": 124,
  "browsing_session_id": "abc123",
  "extra": null
}
```

The backend additionally records `received_at` and a parsed `domain`.

> `browsing_session_id` here is just the extension's per-startup id. The semantic
> work-session grouping ("Debugging Stripe OAuth Persistence") arrives in Phase 2.

---

## Repository layout

```
backend/
  app/
    main.py            FastAPI app + CORS + DB init
    database.py        SQLAlchemy engine/session
    models.py          Event table
    schemas.py         Pydantic models + validation
    routers/events.py  /events, /events/batch, /events/stats
  requirements.txt
  .env.example

extension/
  manifest.json        MV3 manifest
  background.js        Service worker — listeners, queue, flush
  config.js            Backend URL + search-host map
  popup.html / .css / .js
  icons/

README.md
```

---

## Design constraints worth re-reading before contributing

- The product is **memory augmentation**, never **monitoring**. Keep collection
  lightweight and the framing trustful.
- Tone is calm, ambient, supportive. Avoid loud dashboards, gamification, or
  productivity-guilt aesthetics.
- The AI layer (Phase 4) must produce **structured JSON**, not chatbot prose.
- Keep MVP scope tight. No team features, no enterprise dashboards.
