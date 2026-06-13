const $ = (id) => document.getElementById(id);

function formatRelative(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.round(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

function render(status) {
  $("backend-url").textContent = status.backendUrl;
  $("account").textContent = status.userId
    ? `${status.userId.slice(0, 8)}…`
    : status.hasAccessToken
      ? "Linked"
      : "Not linked";
  $("queued").textContent = String(status.queued);
  $("sent").textContent = String(status.stats?.sent ?? 0);
  $("last-flush").textContent = formatRelative(status.stats?.lastFlushAt);

  const errEl = $("error");
  const dot = $("status-dot");
  if (status.lastError) {
    errEl.hidden = false;
    errEl.textContent = `Last error: ${status.lastError.message}`;
    dot.classList.add("warn");
  } else {
    errEl.hidden = true;
    dot.classList.remove("warn");
  }
}

async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: "medullo:getStatus" });
  if (status) render(status);
}

$("flush").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "medullo:flushNow" });
  await refresh();
});

$("reset").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "medullo:resetSession" });
  await refresh();
});

$("open-app").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "medullo:openApp", path: "/" });
  await refresh();
});

$("copy-token").addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "medullo:getAccessToken" });
  if (!result?.ok || !result.accessToken) return;
  await navigator.clipboard.writeText(result.accessToken);
  const btn = $("copy-token");
  const previous = btn.textContent;
  btn.textContent = "Copied";
  setTimeout(() => {
    btn.textContent = previous;
  }, 1200);
  await refresh();
});

// --- Settings: backend URL --------------------------------------------------

function openSettings(currentUrl) {
  $("settings").hidden = false;
  $("backend-url-input").value = currentUrl || "";
  $("backend-url-input").focus();
  $("backend-url-input").select();
}

function closeSettings() {
  $("settings").hidden = true;
}

function normalizeUrl(raw) {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  // If they typed just a hostname, default to https.
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

$("backend-row").addEventListener("click", () => {
  openSettings($("backend-url").textContent);
});

$("settings-cancel").addEventListener("click", closeSettings);

$("settings-save").addEventListener("click", async () => {
  const url = normalizeUrl($("backend-url-input").value);
  if (!url) {
    closeSettings();
    return;
  }
  const result = await chrome.runtime.sendMessage({
    type: "medullo:setBackendUrl",
    url,
  });
  if (result?.ok) {
    closeSettings();
    await refresh();
  }
});

$("backend-url-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("settings-save").click();
  if (e.key === "Escape") closeSettings();
});

refresh();
setInterval(refresh, 2000);
