# Medullo · Deployment Guide

Two paths are supported, depending on what you're trying to do:

1. **[Hosted app](#path-1--hosted-app-vercel--railway)** — frontend on Vercel,
   backend on Railway. Multiple users can point at the same backend; bearer
   tokens keep each user's events, sessions, and snapshots separate.
2. **[Self-host](#path-2--self-host-docker-compose)** — `docker compose up`
   and the whole stack runs on the user's machine. Matches the brief's
   local-first identity.

The Chrome extension and VS Code extension both support a user-configurable
backend URL, so the same published extension works against either deployment.

---

## Path 1 · Hosted app (Vercel + Railway)

The fastest way to give judges, testers, or early users a working URL.

### What you'll deploy

```
medullo-frontend  ──→  Vercel        (Next.js, free)
medullo-backend   ──→  Railway       (Docker, $5/mo trial-then-paid, persistent volume)
```

### Prerequisites

- A **GitHub** account with this repo pushed
- A **Vercel** account ([vercel.com](https://vercel.com), free)
- A **Railway** account ([railway.app](https://railway.app), $5 trial credit)
- A **Gemini API key** ([aistudio.google.com](https://aistudio.google.com/apikey))

### Step 1 — Deploy the backend to Railway

1. In Railway, click **New Project → Deploy from GitHub repo** and select
   this repo.
2. After it imports, open **Settings → Service Source** and set the
   **Root Directory** to `backend`. Railway will auto-detect
   `backend/Dockerfile` and `backend/railway.toml`.
3. Open the **Variables** tab and add:
   ```
   GEMINI_API_KEY     = <your key>
   CORS_ORIGINS       = https://<your-vercel-app>.vercel.app
   ```
   *(You'll know the Vercel URL after Step 2 — you can come back and add
   it then. Until then, set it to `*` so CORS doesn't block your first
   test.)*
4. **Add a persistent volume** so SQLite survives redeploys:
   open the service → **Volumes → New Volume**, mount path `/data`,
   size 1 GB is plenty.
5. Click **Deploy**. When the build finishes, Railway gives the service
   a public URL like `https://medullo-backend-production.up.railway.app`.
   Test it:
   ```bash
   curl https://your-backend-url.up.railway.app/health
   # {"status":"ok","service":"medullo-second-brain","phase":1}
   ```

### Step 2 — Deploy the frontend to Vercel

1. In Vercel, click **Add New → Project** and import this GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Vercel auto-detects Next.js. Under **Environment Variables**, add:
   ```
   NEXT_PUBLIC_API_URL = https://your-backend-url.up.railway.app
   ```
4. Click **Deploy**. After ~1 minute, Vercel gives you a URL like
   `https://medullo-second-brain.vercel.app`.
5. Go back to Railway's **Variables** and tighten
   `CORS_ORIGINS` to your exact Vercel URL (replace the temporary `*`).

### Step 3 — Verify end-to-end

1. Sideload the Chrome extension (`chrome://extensions` → Developer mode
   → Load unpacked → `extension/` folder).
2. Click the Medullo icon → click the **Backend** row → enter the
   Railway URL → Save.
3. Browse for a few minutes, then step away or sit on `chrome://newtab/`
   to trigger an interruption.
4. Open your Vercel URL. The welcome card should render with the
   Gemini-generated snapshot. If prompted, copy the token from the Chrome
   extension popup and paste it into the UI.

### Hosted user isolation

The Railway backend is now multi-user:

- `POST /auth/devices` issues a bearer token and creates a backend-owned
  anonymous user when needed.
- Chrome stores the token in `chrome.storage.local` and sends it as
  `Authorization: Bearer ...` on every event batch.
- The resume UI stores the same token in browser `localStorage` and uses it
  for session/snapshot reads.
- VS Code can either auto-provision its own token or use the shared token via
  `medullo.accessToken`.
- The backend sets `events.user_id` and `sessions.user_id` from the verified
  token and filters every private query by that ID.

Do not ask clients to send a plain `user_id` as proof of identity. IDs are
labels; bearer tokens are the authorization boundary.

---

## Path 2 · Self-host (docker-compose)

For anyone who wants the whole stack on their own machine. Matches the
project's local-first identity — nothing leaves the user's hardware except
the Gemini API call.

### Prerequisites

- **Docker** (Docker Desktop on macOS/Windows, or any recent Docker engine)
- A **Gemini API key**

### Run it

```bash
git clone https://github.com/<you>/medullo-cognitive-companion.git
cd medullo-cognitive-companion

cp .env.example .env
# Open .env and set: GEMINI_API_KEY=<your key>

docker compose up -d --build
```

That's it. After ~2 minutes the first time (subsequent runs are ~10s):

- Backend on [http://localhost:8000](http://localhost:8000) (with
  `/docs` for the API explorer)
- Frontend on [http://localhost:3000](http://localhost:3000)
- SQLite data persisted in a named Docker volume (`medullo_data`)

### Manage the stack

```bash
docker compose logs -f               # tail logs
docker compose ps                    # show status
docker compose down                  # stop everything (data persists)
docker compose down -v               # stop AND wipe the SQLite volume
docker compose up -d --build         # rebuild after pulling new code
```

### Then install the extensions

Chrome extension (sideloaded for now):
1. `chrome://extensions` → Developer mode → Load unpacked → `extension/`
2. The default backend URL is `http://localhost:8000` — no settings change
   needed for self-host

VS Code extension:
1. `cd vscode-extension && vsce package` produces `medullo-vscode-0.1.0.vsix`
2. In VS Code: Extensions → ⋯ → Install from VSIX → select the file
3. Open Settings → search "Medullo" → confirm `medullo.backendUrl` is
   `http://localhost:8000`

---

## Configurable backend URLs

Both extensions read the backend URL at runtime — so the **same published
extension** works against either a hosted demo or a self-hosted stack.

**Chrome extension**
- Open the popup → click the **Backend** row → enter URL → Save.
- Stored in `chrome.storage.local`, persists across browser restarts.

**VS Code extension**
- Settings → search "Medullo" → set `medullo.backendUrl`.
- Or edit `settings.json` directly:
  ```json
  { "medullo.backendUrl": "https://medullo-backend.up.railway.app" }
  ```

---

## Publishing the extensions to public stores

Optional next step. Lets users install with one click instead of sideloading.

### Chrome Web Store

```bash
# Package the extension
cd extension
zip -r ../medullo-extension.zip . -x '*.DS_Store' '*.git*'
```

Then:
1. Create a Chrome Web Store developer account ($5 one-time fee) at
   [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole/).
2. Click **New Item** → upload `medullo-extension.zip`.
3. Fill in store listing: description, screenshots (1280×800), category
   (*Productivity*), promo tile.
4. Justify the permissions in the privacy form — important ones:
   - `tabs`, `idle`, `windows`: needed to detect attention signals
   - `storage`: queues events locally, stores backend URL preference
   - `notifications`: surfaces interruption alerts
   - `host_permissions: https://*/*`: required because the user
     configures which backend URL the extension sends events to
5. Submit. Review typically takes 1–3 days.

### VS Code Marketplace

```bash
cd vscode-extension
npm install -g @vscode/vsce
vsce login <publisher-id>   # one-time; requires Microsoft account
vsce publish
```

The marketplace listing inherits from `vscode-extension/package.json` —
fill in `publisher`, `displayName`, `description`, `repository`, and add a
`README.md` + `icon.png` in the same folder before publishing.

---

## Configuration reference

### Backend env vars

| Variable          | Default                       | Notes                                                       |
| ----------------- | ----------------------------- | ----------------------------------------------------------- |
| `GEMINI_API_KEY`  | *(required)*                  | From aistudio.google.com                                    |
| `GEMINI_MODEL`    | `gemini-2.5-pro`              | Swap to `gemini-2.5-flash` for cheaper snapshots            |
| `DATABASE_URL`    | `sqlite:////data/medullo.db`  | Postgres URL also works (set up the table migrations yourself) |
| `CORS_ORIGINS`    | `http://localhost:3000,...`   | Comma-separated; wildcards allowed (e.g. `https://*.vercel.app`) |
| `PORT`            | `8000`                        | Railway/Fly inject this — leave it unset                    |

### Auth endpoints

| Endpoint | Purpose |
| -------- | ------- |
| `POST /auth/devices` | Create an anonymous user/device token, or attach a new device when called with an existing bearer token |
| `GET /auth/me` | Verify the current bearer token and return the user record |

All `/events/*` and `/sessions/*` endpoints require `Authorization: Bearer
<token>`.

### Frontend env vars

| Variable               | Default                  | Notes                                  |
| ---------------------- | ------------------------ | -------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:8000`  | Baked at build time. Rebuild to change. |

### Extension settings (Chrome)

| Setting     | Default                  | Where                              |
| ----------- | ------------------------ | ---------------------------------- |
| Backend URL | `http://localhost:8000`  | Popup → click the "Backend" row    |

### Extension settings (VS Code)

| Setting              | Default                  | Where                          |
| -------------------- | ------------------------ | ------------------------------ |
| `medullo.backendUrl` | `http://localhost:8000`  | Settings UI or `settings.json` |

---

## Troubleshooting

| Symptom                                           | Likely cause / fix                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Welcome screen shows "Soon." (backend offline)    | Backend isn't running, or `NEXT_PUBLIC_API_URL` doesn't match. Rebuild the frontend after changing it. |
| `CORS error` in browser console                   | Add the frontend origin to `CORS_ORIGINS` on the backend and redeploy.             |
| Chrome popup says `Last error: Failed to fetch`   | Extension's backend URL doesn't match a reachable server. Click the "Backend" row to fix. |
| Snapshot endpoint returns 503                     | `GEMINI_API_KEY` not set in backend env.                                           |
| SQLite "readonly database" in Docker              | Volume isn't mounted with write permissions, or the file lives outside the volume. |
| `vsce publish` fails with 403                     | Run `vsce login <publisher-id>` first; create the publisher in [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage). |

---

## Cost reality check

| Component        | Provider | Tier              | Monthly cost          |
| ---------------- | -------- | ----------------- | --------------------- |
| Frontend         | Vercel   | Hobby             | $0                    |
| Backend          | Railway  | Hobby (after trial) | ~$5                 |
| Gemini snapshots | Google AI Studio | Pay-as-you-go | ~$0.01 per snapshot (Pro), ~10x cheaper on Flash |
| Chrome Web Store | Google   | One-time dev fee  | $5 once               |
| VS Code Marketplace | Microsoft | —              | Free                  |

For a hackathon-scale demo (you + judges + a few testers), expect
~$5–10/month total. Self-host paths cost $0 except for the user's Gemini
calls.
