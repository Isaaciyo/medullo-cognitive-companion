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

refresh();
setInterval(refresh, 2000);
