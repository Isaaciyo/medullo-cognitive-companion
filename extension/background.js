// Medullo Second Brain — background service worker (MV3).
// Collects lightweight workflow signals and ships them to the local backend.

import { CONFIG, SEARCH_HOSTS } from "./config.js";

const STORAGE_KEYS = {
  queue: "medullo:queue",
  browsingSessionId: "medullo:browsingSessionId",
  stats: "medullo:stats",
  lastError: "medullo:lastError",
  alertState: "medullo:alertState",
  backendUrl: "medullo:backendUrl",
};

// User-overridable backend URL. Falls back to the compile-time default in
// config.js (localhost) for fresh installs. Always read via getBackendUrl()
// rather than CONFIG.backendUrl directly — the storage value is the source
// of truth once the user has set one via the popup.
async function getBackendUrl() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.backendUrl);
  const url = stored[STORAGE_KEYS.backendUrl];
  if (typeof url === "string" && url.trim()) return url.replace(/\/+$/, "");
  return CONFIG.backendUrl.replace(/\/+$/, "");
}

const state = {
  currentTabId: null,
  currentUrl: null,
  currentTitle: null,
  currentStartMs: null,
  idle: false,
  // The title most recently reported via a `page_loaded` event — so we
  // don't spam duplicate page_loaded events as Chrome flicks through
  // intermediate titles ("Loading...", domain-only, then real title).
  reportedTitle: null,
  // VS Code monitoring
  vsCodeActive: false,
  lastVsCodeActivityMs: null,
  // Alert state: tracks which snapshot we've alerted for, prevents repeat alerts
  lastAlertedSnapshotId: null,
};

// ---------- bootstrap ----------

chrome.runtime.onInstalled.addListener(async () => {
  await ensureBrowsingSession(true);
  await chrome.idle.setDetectionInterval(CONFIG.idleThresholdSeconds);
  await chrome.alarms.create("medullo:flush", {
    periodInMinutes: Math.max(CONFIG.flushIntervalSeconds / 60, 0.25),
  });
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureBrowsingSession(true);
  await chrome.idle.setDetectionInterval(CONFIG.idleThresholdSeconds);
});

async function ensureBrowsingSession(forceNew = false) {
  const existing = (await chrome.storage.local.get(STORAGE_KEYS.browsingSessionId))[
    STORAGE_KEYS.browsingSessionId
  ];
  if (existing && !forceNew) return existing;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [STORAGE_KEYS.browsingSessionId]: id });
  return id;
}

async function getBrowsingSessionId() {
  return (
    (await chrome.storage.local.get(STORAGE_KEYS.browsingSessionId))[
      STORAGE_KEYS.browsingSessionId
    ] || (await ensureBrowsingSession(true))
  );
}

// ---------- event enqueue + flush ----------

async function enqueue(event) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.queue);
  const queue = data[STORAGE_KEYS.queue] || [];
  queue.push(event);
  await chrome.storage.local.set({ [STORAGE_KEYS.queue]: queue });
  if (queue.length >= CONFIG.flushBatchMax) {
    flush();
  }
}

async function flush() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.queue);
  const queue = data[STORAGE_KEYS.queue] || [];
  if (queue.length === 0) return;

  try {
    const backendUrl = await getBackendUrl();
    const res = await fetch(`${backendUrl}/events/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: queue }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await chrome.storage.local.set({ [STORAGE_KEYS.queue]: [] });
    await bumpStats(queue.length);
    await chrome.storage.local.remove(STORAGE_KEYS.lastError);
  } catch (err) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.lastError]: { message: String(err), at: new Date().toISOString() },
    });
  }
}

async function bumpStats(delta) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.stats);
  const stats = data[STORAGE_KEYS.stats] || { sent: 0, lastFlushAt: null };
  stats.sent += delta;
  stats.lastFlushAt = new Date().toISOString();
  await chrome.storage.local.set({ [STORAGE_KEYS.stats]: stats });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "medullo:flush") flush();
});

// ---------- event helpers ----------

function detectSearchQuery(urlString) {
  try {
    const u = new URL(urlString);
    const param = SEARCH_HOSTS[u.hostname];
    if (!param) return null;
    const q = u.searchParams.get(param);
    return q && q.trim() ? q.trim() : null;
  } catch {
    return null;
  }
}

async function buildEvent(type, { url, title, durationSeconds, extra, timestampMs } = {}) {
  // Default timestamp is "now". Callers can pass `timestampMs` to override —
  // e.g. page_focus events use the span START so the event timeline reflects
  // when attention began, not when it ended. This is critical for the
  // sessionizer's gap math.
  return {
    timestamp: new Date(timestampMs ?? Date.now()).toISOString(),
    event_type: type,
    app: "Chrome",
    title: title || null,
    url: url || null,
    duration_seconds: durationSeconds ?? null,
    browsing_session_id: await getBrowsingSessionId(),
    extra: extra || null,
  };
}

async function closeCurrentSpan(reason) {
  if (state.currentTabId == null || state.currentStartMs == null) return;
  const durationSeconds = (Date.now() - state.currentStartMs) / 1000;
  if (durationSeconds < 0.5) return; // ignore noise
  await enqueue(
    await buildEvent("page_focus", {
      url: state.currentUrl,
      title: state.currentTitle,
      durationSeconds,
      timestampMs: state.currentStartMs, // event is timestamped at span START
      extra: { closed_by: reason },
    })
  );
}

async function openSpan(tab) {
  state.currentTabId = tab.id;
  state.currentUrl = tab.url || tab.pendingUrl || null;
  state.currentTitle = tab.title || null;
  state.currentStartMs = Date.now();
  // Reset the "reported title" so the next title settle for this URL is
  // emitted as a page_loaded event.
  state.reportedTitle = null;

  await enqueue(await buildEvent("tab_switch", { url: state.currentUrl, title: state.currentTitle }));

  if (state.currentUrl) {
    const q = detectSearchQuery(state.currentUrl);
    if (q) {
      await enqueue(
        await buildEvent("search_query", {
          url: state.currentUrl,
          title: state.currentTitle,
          extra: { query: q },
        })
      );
    }
  }
}

// Heuristic: a title is "real" enough to publish if it's not empty, isn't
// just the URL Chrome falls back to during loading, and is at least a few
// characters. Stops us spamming page_loaded for loading-state stubs.
function isRealTitle(title, url) {
  if (!title) return false;
  const t = title.trim();
  if (t.length < 3) return false;
  if (t === url) return false;
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("chrome://")) return false;
  return true;
}

async function maybeEmitPageLoaded() {
  if (!state.currentUrl) return;
  if (!isRealTitle(state.currentTitle, state.currentUrl)) return;
  if (state.currentTitle === state.reportedTitle) return;
  state.reportedTitle = state.currentTitle;
  await enqueue(
    await buildEvent("page_loaded", {
      url: state.currentUrl,
      title: state.currentTitle,
    })
  );
}

// ---------- Chrome event listeners ----------

// Also update tab switch to reset alert when context truly changes
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    const contextChanged = tab.url !== state.currentUrl;
    
    await closeCurrentSpan("tab_switch");
    await openSpan(tab);
    
    // Reset alert state on significant context switch
    if (contextChanged) {
      await resetAlertState();
    }
  } catch {
    /* tab may have closed */
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId !== state.currentTabId) return;
  if (changeInfo.url) {
    await closeCurrentSpan("url_change");
    await openSpan(tab);
    return;
  }
  if (changeInfo.title) {
    state.currentTitle = changeInfo.title;
    await maybeEmitPageLoaded();
  }
  // Some sites only finalize the title at status=complete; double-check then.
  if (changeInfo.status === "complete") {
    state.currentTitle = tab.title || state.currentTitle;
    await maybeEmitPageLoaded();
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === state.currentTabId) {
    await closeCurrentSpan("tab_closed");
    state.currentTabId = null;
    state.currentUrl = null;
    state.currentTitle = null;
    state.currentStartMs = null;
  }
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  // newState: "active" | "idle" | "locked"
  if (newState === "active" && state.idle) {
    state.idle = false;
    await enqueue(await buildEvent("active"));
  } else if ((newState === "idle" || newState === "locked") && !state.idle) {
    state.idle = true;
    await closeCurrentSpan("idle");
    await enqueue(
      await buildEvent("idle", { extra: { reason: newState } })
    );
    // Trigger alert when user becomes idle
    await showInterruptionAlert("idle");
  }
});

// ---------- VS Code monitoring ----------

// Monitor for VS Code window focus (works via window title detection)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    state.vsCodeActive = false;
    return;
  }
  try {
    const window = await chrome.windows.get(windowId);
    // Detect VS Code by window title (contains "Code" or "Visual Studio Code")
    state.vsCodeActive = window.title && (window.title.includes("Code") || window.title.includes("Visual Studio"));
    if (state.vsCodeActive) {
      state.lastVsCodeActivityMs = Date.now();
      await enqueue(
        await buildEvent("vscode_active", {
          extra: { window_title: window.title },
        })
      );
    }
  } catch {
    /* no-op */
  }
});

// Send periodic VS Code activity signal if it remains active
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "medullo:flush") flush();
  if (alarm.name === "medullo:checkVsCode" && state.vsCodeActive && state.lastVsCodeActivityMs) {
    const idleMs = Date.now() - state.lastVsCodeActivityMs;
    if (idleMs < 30000) { // Only send if activity is recent (< 30s)
      await enqueue(await buildEvent("vscode_active"));
    }
  }
});

// Start VS Code monitoring on install
chrome.runtime.onInstalled.addListener(async () => {
  await ensureBrowsingSession(true);
  await chrome.idle.setDetectionInterval(CONFIG.idleThresholdSeconds);
  await chrome.alarms.create("medullo:flush", {
    periodInMinutes: Math.max(CONFIG.flushIntervalSeconds / 60, 0.25),
  });
  await chrome.alarms.create("medullo:checkVsCode", {
    periodInMinutes: 1,
  });
});

// ---------- Interruption alerts ----------

async function showInterruptionAlert(reason) {
  try {
    // Fetch the last interrupted session with a snapshot
    const backendUrl = await getBackendUrl();
    const res = await fetch(`${backendUrl}/sessions/last-interrupted`);
    if (!res.ok) return;
    
    const session = await res.json();
    if (!session || !session.snapshot_generated_at) return;
    
    // Only show alert if this is a different snapshot than we last alerted for
    if (session.id === state.lastAlertedSnapshotId) return;
    
    state.lastAlertedSnapshotId = session.id;
    
    // Show desktop notification
    const title = "Medullo: Focus interrupted";
    const options = {
      iconUrl: chrome.runtime.getURL("icons/128.png"),
      title,
      message: `You were working on: "${session.title || session.primary_domain || 'a task'}". Want to continue?`,
      type: "basic",
      requireInteraction: true,
      buttons: [
        { title: "Resume work" },
        { title: "Dismiss" },
      ],
    };
    
    chrome.notifications.create(`medullo:alert:${session.id}`, options);
    
    // Store alert state for reference
    await chrome.storage.local.set({
      [STORAGE_KEYS.alertState]: {
        lastAlertedSnapshotId: session.id,
        alertedAt: new Date().toISOString(),
        reason,
      },
    });
  } catch (err) {
    console.error("Error showing interruption alert:", err);
  }
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
  if (notifId.startsWith("medullo:alert:")) {
    if (btnIdx === 0) {
      // "Resume work" button - open Medullo home page
      chrome.tabs.create({ url: "http://localhost:3000" });
    }
    // "Dismiss" (btnIdx === 1) - just close notification, alert won't repeat until context switches
    chrome.notifications.clear(notifId);
  }
});

// When context switches, reset alert state to allow new alerts
async function resetAlertState() {
  state.lastAlertedSnapshotId = null;
  await chrome.storage.local.set({ [STORAGE_KEYS.alertState]: null });
}

// ---------- popup messaging ----------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "medullo:getStatus") {
      const data = await chrome.storage.local.get([
        STORAGE_KEYS.queue,
        STORAGE_KEYS.stats,
        STORAGE_KEYS.lastError,
        STORAGE_KEYS.browsingSessionId,
      ]);
      sendResponse({
        queued: (data[STORAGE_KEYS.queue] || []).length,
        stats: data[STORAGE_KEYS.stats] || { sent: 0, lastFlushAt: null },
        lastError: data[STORAGE_KEYS.lastError] || null,
        browsingSessionId: data[STORAGE_KEYS.browsingSessionId] || null,
        backendUrl: await getBackendUrl(),
      });
    } else if (msg?.type === "medullo:flushNow") {
      await flush();
      sendResponse({ ok: true });
    } else if (msg?.type === "medullo:resetSession") {
      await ensureBrowsingSession(true);
      sendResponse({ ok: true });
    } else if (msg?.type === "medullo:setBackendUrl") {
      const url = typeof msg.url === "string" ? msg.url.trim().replace(/\/+$/, "") : "";
      if (!url) {
        sendResponse({ ok: false, error: "empty url" });
        return;
      }
      await chrome.storage.local.set({ [STORAGE_KEYS.backendUrl]: url });
      // Clear any stale connection error so the popup status dot recovers
      // immediately the next time flush() succeeds against the new URL.
      await chrome.storage.local.remove(STORAGE_KEYS.lastError);
      sendResponse({ ok: true, backendUrl: url });
    }
  })();
  return true; // keep the channel open for async sendResponse
});
