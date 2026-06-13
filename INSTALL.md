# Medullo · Install Guide

For users who want to run Medullo on their own machine. Estimated time:
**5–10 minutes**.

If you only want to see what Medullo looks like, skip this and visit
[medullo-cognitive-companion.vercel.app](https://medullo-cognitive-companion.vercel.app)
— that's the live demo, no install required.

---

## What you'll install

Medullo has three pieces. They work together; you can install any subset.

| Piece | What it does | Where to get it |
| --- | --- | --- |
| **Chrome extension** | Quietly watches your browsing — active tab, dwell, idle, search queries | [Chrome Web Store](https://chrome.google.com/webstore/detail/medullo-second-brain/) |
| **VS Code extension** _(optional)_ | Adds your active file and cursor position to snapshots | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=medullo.medullo-vscode) |
| **Backend + UI** _(on your machine)_ | Stores your events, generates the cognitive snapshots, renders the welcome screen | This guide, step 3 |

The Docker path keeps the backend on your computer. The Railway path puts the
backend in your Railway account and uses your Gemini API key. In either case,
Medullo separates people with backend-issued access tokens — not by trusting an
ID typed into the extension.

---

## What you'll need

- A **Mac, Linux, or Windows** computer
- **Google Chrome**
- A **Gemini API key** — free at
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- _(Optional)_ **VS Code** with the Medullo extension installed

For the backend, pick one of two paths in step 3 below — Railway (no
install on your machine) or Docker (free, fully local).

---

## Step 1 · Install the Chrome extension

1. Open [the Medullo listing on the Chrome Web Store](https://chrome.google.com/webstore/detail/medullo-second-brain/)
2. Click **Add to Chrome** → confirm the permissions prompt
3. The Medullo icon appears in your toolbar. Pin it (puzzle-piece menu → 📌) so it's always visible.

You'll see a **Last error: Failed to fetch** in the popup. That's
expected if the selected backend isn't reachable yet. Fresh installs default
to the hosted Railway backend; self-hosted Docker users will switch it to
localhost in step 4.

---

## Step 2 · Install the VS Code extension _(optional)_

If you want Medullo's snapshots to include which file and function you
were in:

1. Open [the Medullo VS Code listing](https://marketplace.visualstudio.com/items?itemName=medullo.medullo-vscode)
2. Click **Install** (it'll open VS Code)
3. Reload the window if prompted

You can skip this step entirely — the browser extension alone is enough
for a working setup.

---

## Step 3 · Set up the backend — pick one

| | Path A · Railway _(recommended)_ | Path B · Docker on your machine |
| --- | --- | --- |
| **Time** | ~3 minutes | ~10 minutes |
| **You install** | Nothing | Docker Desktop |
| **Cost** | Free trial credit, then ~$5/mo | $0 forever |
| **Always on** | Yes — survives reboots | Only while Docker Desktop is running |
| **Data lives** | On your Railway account | On your hard drive |
| **Best for** | Smoothest experience, less technical | Maximum privacy, fully offline-capable |

Pick the row that matches you, then follow the matching path below. Both
end with the extension talking to a working backend.

---

### Path A · Railway _(recommended)_

This deploys the Medullo backend to your own Railway account in three
clicks. Nothing gets installed on your computer.

1. **Create a Railway account** at [railway.app](https://railway.app/) →
   sign in with GitHub (fastest) or email. You'll get a free trial
   credit on signup.

2. **Click "New Project" → "Deploy from GitHub repo"** → select
   `medullo-cognitive-companion`. (If you don't have a fork yet, fork
   it first: [github.com/Isaaciyo/medullo-cognitive-companion](https://github.com/Isaaciyo/medullo-cognitive-companion)
   → click **Fork**.)

3. After the project imports, Railway will try to build and fail —
   that's expected. Click the service tile → **Settings** → set
   **Root Directory** to `backend` → **Save**. The build restarts.

4. **Variables** tab → add two variables:
   ```
   GEMINI_API_KEY   = AIzaSy_paste_your_key_here
   CORS_ORIGINS     = *
   ```

5. **Volumes** tab → **+ Add Volume** → mount path `/data`,
   size **1 GB**. This keeps your snapshots across redeploys.

6. **Settings → Networking** → **Generate Domain**. Railway gives you
   a URL like
   `https://medullo-backend-production-abcd.up.railway.app`.
   **Copy this URL** — you need it in step 4.

7. Verify it works: open the URL in a new tab. You should see JSON
   like `{"name":"Medullo Second Brain", ...}`. If yes, you're done
   with the backend.

That's it. Backend lives at the Railway URL, no terminal involved.

---

### Path B · Docker on your machine

Most private, fully local, no monthly cost. Requires you to install
Docker Desktop and use a terminal.

1. Install **Docker Desktop** from
   [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
   Launch it after install and wait for the whale icon in your menu bar
   to stop animating.

2. Open a terminal and run:
   ```bash
   git clone https://github.com/Isaaciyo/medullo-cognitive-companion.git
   cd medullo-cognitive-companion
   cp .env.example .env
   ```

3. Open the `.env` file in any text editor and paste your Gemini API
   key:
   ```
   GEMINI_API_KEY=AIzaSy_your_key_here
   ```

4. Back in the terminal:
   ```bash
   docker compose up -d --build
   ```
   First build takes ~2 minutes. When it finishes, the backend is
   running at `http://localhost:8000`.

5. Verify:
   ```bash
   curl http://localhost:8000/health
   # {"status":"ok","service":"medullo-second-brain","phase":1}
   ```

That's the backend URL: `http://localhost:8000`.

---

## Step 4 · Point the extensions at your backend

You should now have one of two backend URLs:

- **Railway path:** something like `https://medullo-backend-production-abcd.up.railway.app`
- **Docker path:** `http://localhost:8000`

Paste whichever one matches into both extensions:

**Chrome extension:**
1. Click the Medullo icon in your toolbar
2. Click the **Backend** row in the popup
3. Paste your backend URL → **Save**
4. Click **Open app**. The extension creates an access token on your backend,
   opens the web UI, and connects it automatically.
5. The "Last error" line disappears and the status dot turns green

**Resume UI:**
Normally there is nothing to paste. The extension opens the web UI with the
token in the URL hash and the UI saves it locally. If that bridge ever fails,
the popup still has **Copy token** as a fallback.

That token is what keeps the web UI scoped to your own sessions and snapshots.

**VS Code extension** _(if installed)_:
1. Open Settings (**⌘ ,**) → search **"Medullo"**
2. Set `medullo.backendUrl` to the same URL
3. Optional but recommended: set `medullo.accessToken` to the same token copied
   from the Chrome extension, so browser and code context land in the same
   account.
4. The setting takes effect immediately — no reload needed

---

## Step 5 · Use it

That's the whole setup. From here:

1. Browse normally for a few minutes — Medullo's extension is collecting
   silently. Watch the **Sent** counter climb in the popup.
2. **Step away from your computer** for 60+ seconds, OR sit on
   `chrome://newtab/` for 30+ seconds. That's an "interruption."
3. Wait ~15 seconds for the snapshot to generate.
4. Open [http://localhost:3000](http://localhost:3000). You should see
   the welcome screen reconstruct what you were doing.

The system gets better the more you use it — sessions get richer, the
AI's read of your patterns becomes more useful.

---

## Stopping and starting

Medullo runs in the background until you stop it.

```bash
# Stop the backend + UI (your data is preserved)
docker compose down

# Start it again later
docker compose up -d
```

The Chrome and VS Code extensions stop working when the backend isn't
running — they'll queue events for a few minutes and then surface a
quiet "Last error" in the popup. Starting the backend again resumes
everything.

---

## Updating

When a new version is released:

```bash
cd medullo-cognitive-companion
git pull
docker compose up -d --build
```

The Chrome and VS Code extensions update automatically through their
respective stores.

---

## Uninstalling

To remove Medullo and all its data:

```bash
cd medullo-cognitive-companion
docker compose down -v          # -v also wipes the stored events
cd .. && rm -rf medullo-cognitive-companion
```

Then in Chrome: `chrome://extensions/` → find Medullo → **Remove**.
In VS Code: Extensions panel → Medullo → **Uninstall**.

Your data lives only in the Docker volume on your machine — once
`docker compose down -v` runs, it's gone for good.

---

## Privacy in one paragraph

Medullo sends your data only to the backend URL you configure. On Docker, that
backend is your computer. On Railway, that backend is your hosted service and
data is separated by bearer-token user IDs. The only external AI call is to
Google's Gemini API when generating a snapshot, and only events (URLs, page
titles, timestamps) are sent — never page content, keystrokes, screenshots, or
code. Full policy:
[PRIVACY.md](PRIVACY.md).

---

## Help

| Problem | Fix |
| --- | --- |
| `docker: command not found` | Install Docker Desktop, then quit and reopen your terminal |
| Backend health check fails | Check `docker compose logs backend` for the error |
| Frontend shows "Soon." | Backend isn't running. `docker compose ps` should show both services as `Up`. |
| Welcome screen stays empty after browsing | The snapshot only generates after a *real* interruption (idle ≥60s or newtab dwell ≥30s) and ≥4 meaningful events |
| Snapshot endpoint returns "GEMINI_API_KEY not set" | Re-check your `.env` — paste the key, then `docker compose restart backend` |
| Want a fresh start | `docker compose down -v && docker compose up -d` resets the database |

Still stuck? File an issue at
[github.com/Isaaciyo/medullo-cognitive-companion/issues](https://github.com/Isaaciyo/medullo-cognitive-companion/issues).
