# Medullo — Privacy Policy

_Last updated: 3 June 2026_

Medullo is a personal cognitive continuity tool. This document describes what
the Chrome extension, the VS Code extension, and the backend collect, why,
and where it goes.

The single most important fact:
**Medullo sends your data only to the backend server you choose.** The default
is your own machine. If you point Medullo at a hosted backend, that backend
stores your events and snapshots under a backend-issued user ID tied to your
access token.

---

## What the Chrome extension collects

The extension observes lightweight, structural signals about your browser
activity:

- **Active tab URL** and **page title**
- **Tab switches**, **page focus duration**, **idle state** (≥60s without
  keyboard/mouse activity)
- **Search query text** when the URL matches a known search host (Google,
  Bing, DuckDuckGo, Brave, GitHub, Stack Overflow, YouTube)
- **Timestamps** for the above events
- **A per-install random ID** for local grouping, plus a backend-issued access
  token when using a hosted or authenticated backend

The extension does **not** collect:

- Keystrokes or text you type into pages
- The content of pages you read (no DOM scraping, no HTML/text extraction)
- Form data, passwords, autofill values, cookies, or browser history
- Screenshots, video, audio, or webcam input
- Files on your device
- Anything from incognito tabs (the extension does not run there)

---

## What the VS Code extension collects

When installed and enabled, the VS Code extension sends:

- **File path** and **file name** of the file you have focused
- **Cursor position** (line and column)
- A **best-guess function or class name** at the cursor (extracted by a
  simple regex on surrounding lines — the actual code content is not sent)
- **Programming language** (e.g. `typescript`, `python`) as reported by
  VS Code
- **Idle state** (≥60s without activity in VS Code)

The VS Code extension does **not** collect:

- The contents of any file you have open
- Anything from terminals, debug consoles, or output panels
- Diff content, commit messages, or any source code
- Project secrets, environment variables, or `.env` file contents

---

## Where the data goes

By default, published extensions send events to the hosted Medullo backend on
Railway. For local self-hosting, set the backend URL to
**`http://localhost:8000`**.

You can change the backend URL at any time:

- **Chrome extension:** click the Medullo icon → click the "Backend" row →
  enter the hosted backend or local self-host URL → Save. The URL is stored
  locally in `chrome.storage.local`.
- **VS Code extension:** Settings (⌘ ,) → search "Medullo" → set
  `medullo.backendUrl`.

When you change the URL — for example, to point at a Medullo backend you've
deployed to Railway/Fly/etc. — that is where your data goes. Hosted backends
use bearer-token authentication so one user's events, sessions, and snapshots
are not returned to another user.

When the Chrome extension opens the web UI, it passes the access token in the
URL hash (`#token=...`) so the page can connect without manual setup. Hash
fragments are handled by the browser and are not sent as part of the HTTP
request to the frontend host.

---

## The AI snapshot layer

If the backend you point Medullo at has been configured with a Google Gemini
API key, the backend will send your **session events** (URLs, titles,
timestamps, and the heuristic keyword bag) to Google's Gemini API in order
to generate the cognitive snapshot (task / intent / progress / blockers /
next steps).

That request is governed by [Google's API privacy and security
policies](https://ai.google.dev/gemini-api/terms). The free Gemini API tier
specifically uses prompts to improve their models — if this matters to you,
use a paid Gemini key or run the backend without a Gemini key at all (event
collection still works; only the AI snapshot layer is disabled).

---

## Local storage and retention

- All collected events live in a **SQLite database** on whichever machine
  is running the backend, or in the configured hosted database for a Railway /
  cloud deployment.
- The extensions queue events in `chrome.storage.local` /
  `vscode.workspace.getConfiguration` and discard them once successfully
  sent.
- If you use a backend run by someone else, that operator controls the server
  and Gemini API key. Use a backend you trust.
- To delete your data: delete the `medullo.db` file from your backend's
  data directory. For docker-compose self-host, this is
  `docker volume rm medullo_data` after stopping the stack.

---

## Permissions and why each is needed

| Chrome permission     | Why it's needed                                                  |
| --------------------- | ---------------------------------------------------------------- |
| `tabs`                | Detect which tab is active, read its URL/title for context       |
| `idle`                | Detect when you step away (the "interruption" signal)            |
| `windows`             | Detect window-focus changes (a different signal than tab change) |
| `storage`             | Queue events offline, persist your backend URL preference        |
| `alarms`              | Wake the service worker every ~15s to flush queued events        |
| `notifications`       | Surface a quiet alert when an interruption is detected           |
| `host_permissions` for hosted Railway + localhost | Allows the extension to send events to the Medullo backend API, or to localhost for self-hosted development. |

---

## Contact

Questions, deletion requests, or privacy concerns:

- Open an issue on
  [github.com/Isaaciyo/medullo-cognitive-companion](https://github.com/Isaaciyo/medullo-cognitive-companion)

---

## Changes to this policy

If we change what data is collected, this document will be updated and the
version date at the top will reflect the change. Significant changes will
also be called out in the extension's release notes.
