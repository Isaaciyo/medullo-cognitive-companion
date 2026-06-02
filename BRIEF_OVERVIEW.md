# Project Brief: AI Cognitive Continuity System

## Project Vision

We are building an AI-powered cognitive continuity system designed to reduce the mental cost of interruptions and context switching during digital work.

The project is NOT a traditional productivity tool or chatbot.

The core idea is:

> Modern knowledge workers lose significant time and mental energy reconstructing their thought process after interruptions. Existing tools track tasks and files, but they do not preserve cognitive context.

This system acts as a lightweight “second working memory” that:

* observes workflow signals,
* infers active work context,
* creates cognitive checkpoints,
* and restores users back into their mental workflow after interruptions.

The project is being built for the “International AI Agents Hackathon,” where the goal is to create an AI workflow automation tool for real-world industry use.

The emphasis should be:

* human-centered interaction,
* workflow intelligence,
* cognitive assistance,
* and practical usefulness.

The system should feel:

* calm,
* intelligent,
* ambient,
* supportive,
* and non-invasive.

It should NOT feel:

* overly corporate,
* surveillance-oriented,
* or like a generic AI chatbot.

---

# Core Problem Statement

Knowledge workers constantly experience:

* interruptions,
* fragmented attention,
* multitasking overload,
* and context switching.

After interruptions, users often spend several minutes reconstructing:

* what they were doing,
* why they were doing it,
* what progress had been made,
* what blockers existed,
* and what the next step should be.

This hidden “cognitive re-entry cost” accumulates throughout the day.

The goal of the project is to minimize this re-entry cost through AI-generated cognitive continuity.

---

# MVP Goal

The MVP should successfully demonstrate this loop:

```text
Observe workflow activity
    ↓
Build contextual session history
    ↓
Detect interruption/context switch
    ↓
Generate cognitive snapshot
    ↓
Restore user context later
```

The single most important demo moment is:

> “The AI remembered the user’s mental state better than the user did.”

---

# Primary Target User

Initial MVP target:

* developers / programmers

Reason:

* easy workflow signals,
* technically rich environments,
* highly relatable interruption pain,
* strong hackathon demo potential.

Future expansion can support:

* researchers,
* students,
* designers,
* analysts,
* healthcare workers,
* legal professionals,
* and general knowledge workers.

---

# High-Level Product Behavior

The system should:

* passively observe workflow activity,
* organize actions into semantic work sessions,
* infer user intent,
* identify progress/blockers,
* create interruption checkpoints,
* and later generate concise resume summaries.

The system should NOT:

* behave like a generic assistant chatbot,
* require constant prompting,
* overwhelm users with notifications,
* or aggressively automate decisions.

The intelligence should feel proactive but subtle.

---

# Core UX Philosophy

The UI should feel like:

* a cognitive companion,
* semantic memory augmentation,
* quiet workflow scaffolding.

It should avoid:

* loud dashboards,
* excessive metrics,
* gamification,
* productivity guilt aesthetics.

The tone should feel:

* intelligent,
* calming,
* concise,
* context-aware.

---

# Technical Architecture Overview

Initial architecture:

```text
Browser Extension
    ↓
Event Collection Layer
    ↓
Sessionization Engine
    ↓
Local Database
    ↓
AI Interpretation Layer
    ↓
Snapshot + Resume System
    ↓
Frontend UI
```

---

# MVP Tech Stack

## Frontend

* Next.js
* TailwindCSS
* Framer Motion

## Browser Extension

* Chrome Extension (Manifest V3)

## Backend

* FastAPI (Python)

## Database

* SQLite initially

## AI APIs

Possible:

* OpenAI
* Claude
* Gemini

Structured JSON outputs are preferred.

---

# Initial MVP Scope

We are intentionally keeping scope tight.

The MVP focuses ONLY on:

1. Event collection
2. Session grouping
3. Interruption detection
4. AI-generated cognitive snapshots
5. Context restoration

Do NOT build:

* large productivity suites,
* team collaboration systems,
* enterprise dashboards,
* excessive agent orchestration,
* or complicated autonomous systems.

---

# Phase 1: Backend Event Collection

## Goal

Build the foundational “cognitive event stream.”

This is the most important system layer.

The project should first focus on reliable contextual data collection before AI reasoning or UI polish.

---

# Browser Extension Responsibilities

The extension should collect lightweight workflow signals such as:

* active browser tab
* tab switches
* URL changes
* page titles
* activity duration
* browser idle states
* search queries
* copy events (optional later)

Avoid invasive collection:

* no webcam tracking
* no keylogging
* no full-screen recording

The extension should send structured events to the backend.

---

# Core Event Schema

Example:

```json
{
  "timestamp": "2026-05-21T18:22:00Z",
  "event_type": "tab_switch",
  "app": "Chrome",
  "title": "Stripe OAuth Docs",
  "url": "https://docs.stripe.com/oauth",
  "duration": 124,
  "session_id": "abc123"
}
```

---

# Initial Event Types

Implement:

* tab_switch
* page_focus
* idle
* active
* search_query
* interruption_detected

Possible future additions:

* vscode integration
* terminal command tracking
* Slack/Discord integrations
* meeting detection
* screenshot understanding
* computer vision screen understanding

These are NOT part of the initial MVP.

---

# Sessionization Engine

## Goal

Group raw events into meaningful work sessions.

Example session:

```text
Session:
"Debugging Stripe OAuth Persistence"

Includes:
- Stripe docs
- GitHub issues
- StackOverflow searches
- auth-related tabs
```

The AI should reason over sessions, NOT individual raw events.

---

# Sessionization Logic

Initial heuristics:

* time proximity
* semantic similarity
* repeated domains
* repeated keywords
* browsing continuity

The logic does NOT need to be perfect initially.

Simple heuristics are acceptable for MVP.

---

# Database Layer

Use SQLite initially.

Store:

* raw events
* sessions
* interruption snapshots
* AI summaries

Avoid premature cloud infrastructure optimization.

Local-first MVP is preferred.

---

# AI Interpretation Layer

This layer happens AFTER event collection and sessionization are working.

The AI layer should:

* infer active task
* summarize progress
* identify blockers
* suggest next steps
* generate cognitive snapshots

The AI should NOT become a general chat assistant.

---

# Structured AI Output

Expected format:

```json
{
  "task": "Fix Stripe OAuth refresh issue",
  "intent": "Maintain persistent authentication",
  "progress": [
    "Verified callback flow",
    "Compared token expiration timing"
  ],
  "blockers": [
    "Cookie persistence after redirect unclear"
  ],
  "next_steps": [
    "Inspect middleware cookie write timing"
  ]
}
```

Structured outputs are critical.

---

# Interruption Detection

The system should detect:

* long idle periods,
* unrelated context switches,
* major workflow changes,
* or abandoned sessions.

When detected:

* generate a cognitive checkpoint snapshot.

This is one of the project’s key “magic” features.

---

# Resume Experience

When the user returns, the system should display concise context restoration.

Example:

```text
Welcome back.

You were debugging Stripe OAuth session persistence.

Progress:
- callback flow verified
- token mismatch identified

Likely blocker:
Cookie persistence after redirect may be failing.

Suggested next step:
Inspect auth middleware cookie handling.
```

The summary should feel:

* concise,
* intelligent,
* actionable,
* and human.

---

# Phase 7+: Smart Interruption Alerts & VS Code Monitoring

## Recently Implemented

* **Interruption Notifications**: Desktop alerts when idle/drift detected
* **Smart Alert Management**: Prevents repeated alerts for the same snapshot until context switches
* **VS Code Activity Tracking**: Detects VS Code window focus and sends activity events to backend

---

# Stretch Features (Optional)

Only after MVP stability and Phase 7 completion.

Possible future additions:

* Full VS Code extension (deeper integration beyond window focus)
* terminal awareness
* attention drift detection
* blocker prediction
* semantic memory linking
* cross-app continuity
* meeting summaries
* computer vision screen understanding
* multimodal workflow understanding

These are secondary priorities.

---

# Design Constraints

The project should:

* minimize creepiness,
* respect user trust,
* avoid surveillance aesthetics,
* avoid overwhelming users.

The framing should always be:

> memory augmentation and cognitive continuity.

NOT:

> employee monitoring.

---

# Demo Narrative

The demo should tell a story:

1. User begins debugging/problem-solving task
2. User navigates multiple tabs/resources
3. User gets interrupted or switches context
4. Time passes
5. User returns
6. AI restores cognitive state clearly and intelligently

The emotional impact is more important than technical complexity.

---

# Development Priorities

## Priority Order

### Phase 1

Backend event pipeline

### Phase 2

Session grouping

### Phase 3

Database persistence

### Phase 4

AI summarization layer

### Phase 5

Interruption detection

### Phase 6

Resume UI

### Phase 7

Polish + storytelling

---

# Final Product Identity

This project should feel like:

> “Semantic RAM for human cognition.”

Or:

> “AI-powered cognitive continuity.”

The product is fundamentally about:

* preserving momentum,
* reducing cognitive turbulence,
* and helping humans recover their train of thought in fragmented digital environments.
