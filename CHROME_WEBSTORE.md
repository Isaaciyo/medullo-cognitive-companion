# Medullo — Chrome Web Store Submission Pack

Everything you need to submit the Chrome extension to the Web Store in one
place: ready-to-paste listing copy, permission justifications,
screenshot recipe, and the package command. Pair this with
[PRIVACY.md](PRIVACY.md) (which you'll need to host at a public URL — see
"Privacy policy URL" below).

---

## 0 · One-time setup

If you don't have a developer account yet:

1. Go to
   [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole/)
2. Sign in with the Google account you want to publish under
3. Pay the one-time **$5 developer registration fee**
4. Optionally set up a **publisher group** if you want to publish under a
   project name rather than your personal account

---

## 1 · Package the extension

From the repo root:

```bash
cd extension
zip -r ../medullo-extension.zip . \
  -x '*.DS_Store' '*.git*' '*node_modules*'
cd ..
ls -lh medullo-extension.zip
```

You should get a `.zip` around 20–30 KB. That's the file you upload.

> Verify before uploading: `unzip -l medullo-extension.zip` should show
> `manifest.json`, `background.js`, `config.js`, `popup.html`, `popup.css`,
> `popup.js`, and the three icons. **No source maps, no node_modules,
> nothing else.**

---

## 2 · Listing copy

Paste each section into the corresponding field in the developer console.

### Extension name (max 75 chars)

```
Medullo — Second Brain
```

### Short summary (max 132 chars)

```
A quiet second working memory. Medullo restores your mental state after interruptions — never surveillance, only continuity.
```

### Detailed description

```
Medullo is a calm, AI-powered cognitive continuity tool. When you get interrupted mid-task by a meeting, a Slack ping, or a moment of drift on a new tab, Medullo quietly reconstructs what you were trying to do, so picking up afterward feels almost effortless.

How it works:
• The extension observes lightweight signals: which tab you're on, when you switch, when you go idle, what you searched for.
• Those signals get grouped into coherent "work sessions" by a sessionization engine running on a backend you control.
• On first install, Medullo creates a private access token and opens the web app already connected.
• When an interruption is detected (idle, screen lock, or a long stare at a New Tab page), a structured cognitive snapshot is generated — what you were doing, why, what got done, where you got stuck, and what to try next.
• When you return, the snapshot is waiting on the resume page. No more "what was I doing?"

What's collected
• Active tab URL and title
• Tab switches, page focus durations, idle/active state
• Search query text on known search hosts
• Timestamps, a per-install ID for local grouping, and a backend-issued access token for authenticated hosted backends

What's NOT collected
• No keystrokes, no screen content, no DOM scraping
• No passwords, autofill, cookies, or browsing history
• No screenshots, video, audio, or webcam input
• No incognito-tab data
• No analytics or third-party tracking

Where your data goes
• By default, to the hosted Medullo backend on Railway
• Developers can switch the backend URL to localhost for self-hosted testing
• Hosted backends separate users with bearer-token authentication, so your snapshots are scoped to your account

The product is memory augmentation, never monitoring.

Self-host or hosted?
Medullo is designed to be local-first. The full backend + frontend run with a single `docker compose up` on your own machine. A hosted demo runs at https://medullo-cognitive-companion.vercel.app — feel free to point this extension there to try it before self-hosting.

Open source
github.com/Isaaciyo/medullo-cognitive-companion

Built for the International AI Agents Hackathon.
```

### Category

```
Productivity
```

### Language

```
English
```

---

## 3 · Privacy policy URL

The Web Store requires a publicly accessible privacy policy URL. You have
two easy options:

**Option A — GitHub raw URL (easiest)**

After pushing [PRIVACY.md](PRIVACY.md) to the repo:

```
https://github.com/Isaaciyo/medullo-cognitive-companion/blob/main/PRIVACY.md
```

This works for Web Store review.

**Option B — host on your Vercel frontend** (cleaner long term)

Drop `PRIVACY.md` content into `frontend/app/privacy/page.tsx` so it lives
at `https://medullo-cognitive-companion.vercel.app/privacy`. Lets you
update without changing the Web Store listing.

For the hackathon submission, **Option A is fine** — do Option B later if
this becomes a real public product.

---

## 4 · Permission justifications

The developer console asks for a written justification for every powerful
permission in `manifest.json`. Paste these directly:

| Permission | Justification (paste verbatim) |
| --- | --- |
| `tabs` | Read the active tab's URL and title to detect when the user switches tasks. This is the primary signal Medullo uses to reconstruct work sessions. No page content is accessed. |
| `idle` | Detect when the user steps away from the keyboard (≥60s). This is one of the core interruption signals that triggers automatic snapshot generation. |
| `windows` | Detect when the user changes window focus — a different signal than tab change. Both are necessary to accurately model attention. |
| `storage` | Queue events locally when the backend is unreachable, persist the user's chosen backend URL preference, store the backend-issued access token, and track a per-install ID to group local activity. All extension storage is local to the user's browser. |
| `alarms` | Wake the service worker every ~15s to flush queued events to the backend. MV3 service workers are otherwise terminated aggressively. |
| `notifications` | Surface a quiet, optional alert when an interruption is detected, so the user can recover context faster. Notifications can be disabled by the user at the OS level. |
| `host_permissions: ["https://medullo-cognitive-companion-production.up.railway.app/*", "http://localhost/*", "http://127.0.0.1/*"]` | Send workflow events only to the hosted Medullo backend, or to localhost during self-hosted development. No page content is read from these hosts; this permission is only for the extension's backend API requests. |

If the reviewer asks about a *single justification* field for the
extension overall: "Medullo is a cognitive continuity tool that observes
lightweight workflow signals (active tab, idle state, search queries) and
sends them to a backend the user controls. The tab and host permissions
exist solely so the user can choose where their own data is sent. No page
content is collected."

---

## 5 · Screenshots

The Web Store requires **at least 1 screenshot**, supports up to **5**.
Dimensions: **1280×800** (preferred) or **640×400**.

Recipe — go to the live demo at
[medullo-cognitive-companion.vercel.app](https://medullo-cognitive-companion.vercel.app)
and capture these (Chrome → ⌘⇧S or use macOS screenshot tool):

| # | Capture | Why this one |
| --- | --- | --- |
| 1 | The full welcome card with a real snapshot rendered (Task / Intent / What you did / Next step), ambient blobs visible in the background | The product's whole identity in one frame |
| 2 | The Chrome extension popup with status and Open app controls visible | Demonstrates connection state and user control |
| 3 | The home page in the empty / "Hello." state | Calm tone, what new users see first |
| 4 | The `/interruptions` page showing multiple recent moments | Hints at the temporal continuity story |
| 5 | A close-up of one of the snapshot card's text sections | Shows the second-person, conservative tone |

**Tip:** open the browser DevTools → device toolbar → set the viewport to
exactly 1280×800 before screenshotting, so every shot has the same
dimensions and no scrollbars.

**Promo tile** (small icon, 440×280) — optional but recommended for store
discoverability. A simple cropped composition of the welcome card on the
ambient background works well.

---

## 6 · Submit

In the developer console:

1. **+ New Item** → upload `medullo-extension.zip`
2. Wait for the manifest to validate (~30s)
3. **Store listing** tab → paste the copy from section 2
4. **Privacy** tab → paste the justifications from section 4, set the
   privacy policy URL from section 3
5. **Distribution** tab → set visibility to **Public** (or **Unlisted**
   if you want a private link for judges only)
6. **Save Draft** → review the listing preview → **Submit for review**

Review takes 1–3 business days for a first submission. Subsequent
updates are usually faster.

---

## 7 · While you wait

You can ship the Devpost submission with the **Unlisted** install URL once
the review completes — judges click one link, extension installs, they
point it at your Vercel/Railway demo, done.

If review hasn't completed by your hackathon deadline, the sideload
path still works: "Developer mode → Load unpacked → `extension/`" — and
your Devpost README has the live demo URL for the watch-it-work-without-installing
case.
