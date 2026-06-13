# Medullo — Code Context for VS Code

A quiet companion that captures where you are in your code, so
[Medullo](https://medullo-cognitive-companion.vercel.app) can reconstruct
your train of thought after an interruption.

This extension is one piece of a larger cognitive continuity system. On
its own it does nothing visible — it sends lightweight context signals to
the Medullo backend, which uses them to enrich the AI-generated snapshots
that appear on the Medullo resume screen.

---

## What it captures

| Event | Fires when | Carries |
| --- | --- | --- |
| `vscode_context` | You switch files or move the cursor | file path, file name, line, column, language, best-guess function name |
| `vscode_idle` | You're inactive in VS Code for ≥60s | inactive seconds, the last file you were on |
| `vscode_active` | You return from idle | how long you were away |
| `vscode_drift` | You context-switch to a very different file or project | from_file, to_file, language |

What it **does not** capture:

- The contents of any file you have open
- Anything from terminals, output panels, or debug consoles
- Diffs, commit messages, secrets, `.env` contents

The "function name" is a best-guess extracted by a simple regex over the
surrounding lines — the surrounding code itself is never sent.

---

## Setup

1. Install the extension (Marketplace install, or sideload via `.vsix`)
2. Open VS Code Settings (**⌘ ,**) → search **"Medullo"** →
   set `medullo.backendUrl` to the URL of your Medullo backend
3. If you want VS Code context to join the same account as Chrome, set
   `medullo.accessToken` to the token copied from the Chrome extension popup
4. That's it. Open a code file and start working — the extension reports
   silently in the background.

**Default backend URL:** `http://localhost:8000` (for the standard
self-host path).

To use against a hosted Medullo backend, paste the deployed URL into the
setting — for example
`https://medullo-cognitive-companion-production.up.railway.app`.

---

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `medullo.backendUrl` | `http://localhost:8000` | URL of the Medullo backend that should receive code context events. |
| `medullo.accessToken` | `""` | Optional bearer token. Use the Chrome extension's copied token to share one account. |

Change it via the Settings UI (**Code → Preferences → Settings → "Medullo"**)
or by editing `settings.json` directly:

```json
{
  "medullo.backendUrl": "https://your-medullo-backend.example.com",
  "medullo.accessToken": "medullo_paste_token_here"
}
```

The setting takes effect immediately — no reload needed.

---

## Example event

```json
{
  "timestamp": "2026-06-03T17:23:25Z",
  "event_type": "vscode_context",
  "app": "VSCode",
  "title": "auth.ts",
  "url": "/path/to/project/src/auth.ts",
  "extra": {
    "language_id": "typescript",
    "file_name": "auth.ts",
    "line_number": 42,
    "column_number": 15,
    "function_name": "handleLogin"
  }
}
```

---

## Privacy

This extension transmits file metadata only — never file contents — and only
to the backend URL you explicitly set in `medullo.backendUrl`. The default is
your own machine. If you use a hosted backend, set `medullo.accessToken` to
the token from the Chrome extension so browser and code context stay under the
same authenticated user.

Full privacy policy:
[github.com/Isaaciyo/medullo-cognitive-companion/blob/main/PRIVACY.md](https://github.com/Isaaciyo/medullo-cognitive-companion/blob/main/PRIVACY.md).

---

## How it fits with the rest of Medullo

```
┌─ Browser (Chrome extension) ──┐
│  active tab · idle · search   │
└──────────────┬─────────────────┘
               │
┌─ VS Code (this extension) ────┐
│  file · cursor · function     │
└──────────────┬─────────────────┘
               │
               ▼
   ┌─── Medullo backend ────┐
   │  Session grouping      │
   │  Interruption detection│
   │  AI snapshot (Gemini)  │
   └────────────┬───────────┘
                ▼
   ┌─── Medullo resume UI ──┐
   │ Welcome back · You were│
   │ in handleLogin() at 42 │
   └────────────────────────┘
```

The VS Code context shows up in Medullo's snapshots as enriching detail:

> **You were** debugging the auth refresh flow
> **Where you were** `auth.ts`, line 42, function `handleLogin()`
> **Progress** Verified the callback URL, narrowed the failure to the cookie write
> **A possible next step** Inspect middleware cookie timing

---

## Repository

[github.com/Isaaciyo/medullo-cognitive-companion](https://github.com/Isaaciyo/medullo-cognitive-companion)

Built for the **International AI Agents Hackathon**.
