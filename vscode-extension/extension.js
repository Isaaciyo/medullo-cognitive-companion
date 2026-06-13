// Medullo VS Code Extension
// Captures active file context and sends to the local backend.

const vscode = require("vscode");

const CONFIG = {
  // Compile-time fallback. The real value is read live from VS Code settings
  // via getBackendUrl() so users can change it in their settings.json without
  // rebuilding the extension.
  defaultBackendUrl: "https://medullo-cognitive-companion-production.up.railway.app",
  idleThresholdSeconds: 60,
  cursorDebounceMs: 2000,
  minAutoReportMs: 15000,
};

/**
 * Read the backend URL from VS Code settings, falling back to the default.
 * Contributed as `medullo.backendUrl` in package.json — users can change it
 * via Settings UI or by editing settings.json directly.
 */
function getBackendUrl() {
  const configured = vscode.workspace
    .getConfiguration("medullo")
    .get("backendUrl");
  const url =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : CONFIG.defaultBackendUrl;
  return url.replace(/\/+$/, "");
}

let extension = {
  disposables: [],
  context: null,
  output: null,
  lastReportedUri: null,
  lastReportedLine: null,
  lastReportedColumn: null,
  lastAutoReportAtMs: 0,
  pendingReportTimeoutId: null,
};

function log(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  extension.output?.appendLine(line);
  console.log(`Medullo: ${message}`);
}

/**
 * Called when the extension activates (on VS Code startup).
 */
function activate(context) {
  extension.context = context;
  extension.output = vscode.window.createOutputChannel("Medullo");
  extension.disposables.push(extension.output);
  log("VS Code extension activated");

  // Send initial context
  reportCodeContext(null, null, { force: true, reason: "activation" });

  // Listen for active editor changes
  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    () => reportCodeContext(null, null, { force: true, reason: "editor_change" })
  );
  extension.disposables.push(editorChangeDisposable);

  // Listen for cursor position changes
  const selectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection(
    (event) => {
      const editor = event.textEditor;
      const selection = event.selections[0];
      if (selection) {
        scheduleCodeContextReport(editor, selection.active);
      }
    }
  );
  extension.disposables.push(selectionChangeDisposable);

  // Register a command to manually flush
  const flushDisposable = vscode.commands.registerCommand(
    "medullo.flush",
    async () => {
      const result = await reportCodeContext(null, null, { force: true });
      if (result?.ok) {
        vscode.window.showInformationMessage("Medullo context flushed");
      } else {
        vscode.window.showWarningMessage(
          result?.message || "Medullo did not find an active editor to flush"
        );
      }
    }
  );
  extension.disposables.push(flushDisposable);
}

function scheduleCodeContextReport(editor, position) {
  extension.lastActivityTimeMs = Date.now();
  extension.isIdle = false;
  if (extension.pendingReportTimeoutId) {
    clearTimeout(extension.pendingReportTimeoutId);
  }
  extension.pendingReportTimeoutId = setTimeout(() => {
    extension.pendingReportTimeoutId = null;
    reportCodeContext(editor, position, { reason: "cursor_settled" });
  }, CONFIG.cursorDebounceMs);
}

function getConfiguredAccessToken() {
  const configured = vscode.workspace
    .getConfiguration("medullo")
    .get("accessToken");
  return typeof configured === "string" && configured.trim()
    ? configured.trim()
    : null;
}

async function ensureAccessToken() {
  const configured = getConfiguredAccessToken();
  if (configured) return configured;

  const stored = extension.context?.globalState.get("medullo.accessToken");
  if (typeof stored === "string" && stored.trim()) return stored;

  const response = await fetch(`${getBackendUrl()}/auth/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_name: "VS Code extension",
      install_id: vscode.env.machineId,
    }),
  });
  if (!response.ok) {
    throw new Error(`auth HTTP ${response.status}`);
  }

  const payload = await response.json();
  await extension.context?.globalState.update("medullo.accessToken", payload.access_token);
  await extension.context?.globalState.update("medullo.userId", payload.user_id);
  return payload.access_token;
}

async function authHeaders() {
  const token = await ensureAccessToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Report the current code context to the backend.
 */
async function reportCodeContext(editor = null, position = null, options = {}) {
  try {
    // Use provided editor or get current active editor
    const activeEditor = editor || vscode.window.activeTextEditor;
    if (!activeEditor) return { ok: false, message: "No active editor" };

    const uri = activeEditor.document.uri.fsPath;
    const fileName = activeEditor.document.fileName.split("/").pop();
    const languageId = activeEditor.document.languageId;
    const position_ = position || activeEditor.selection.active;
    const line = position_.line + 1; // 1-indexed
    const column = position_.character + 1;
    const now = Date.now();
    extension.lastActivityTimeMs = now;
    extension.isIdle = false;

    // Don't spam the same position, and rate-limit automatic cursor reports.
    if (
      !options.force &&
      extension.lastReportedUri === uri &&
      extension.lastReportedLine === line &&
      extension.lastReportedColumn === column
    ) {
      return { ok: true, message: "Context unchanged" };
    }
    if (!options.force && now - extension.lastAutoReportAtMs < CONFIG.minAutoReportMs) {
      return { ok: true, message: "Context report rate-limited" };
    }

    // Detect drift (major context switch)
    if (extension.lastActiveFile && isDriftSwitch(extension.lastActiveFile, uri)) {
      await sendEvent("vscode_drift", {
        url: uri,
        title: fileName,
        extra: {
          from_file: extension.lastActiveFile,
          to_file: uri,
          language_id: languageId,
        },
      });
      log(`VS Code drift detected (${extension.lastActiveFile} -> ${fileName})`);
    }

    extension.lastReportedUri = uri;
    extension.lastReportedLine = line;
    extension.lastReportedColumn = column;
    extension.lastActiveFile = uri;

    // Try to extract function name (simple heuristic)
    const functionName = extractFunctionName(activeEditor, line);

    const event = {
      timestamp: new Date().toISOString(),
      event_type: "vscode_context",
      app: "VSCode",
      title: fileName,
      url: uri,
      extra: {
        language_id: languageId,
        file_path: uri,
        file_name: fileName,
        line_number: line,
        column_number: column,
        function_name: functionName,
      },
    };

    // Send to backend
    const response = await fetch(`${getBackendUrl()}/events`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const message = `Backend error: ${response.status}`;
      log(message);
      return { ok: false, message };
    }
    if (!options.force) {
      extension.lastAutoReportAtMs = now;
    }
    log(`Sent vscode_context for ${fileName}:${line}:${column}`);
    return { ok: true };
  } catch (err) {
    const message = `Error reporting code context: ${err}`;
    log(message);
    return { ok: false, message };
  }
}

/**
 * Simple heuristic to extract the function/method name at the given line.
 * Looks backward from the line for common function/method declaration patterns.
 */
function extractFunctionName(editor, targetLine) {
  try {
    const document = editor.document;
    const patterns = [
      /^\s*(?:async\s+)?(?:static\s+)?(?:private\s+)?(?:public\s+)?(?:protected\s+)?function\s+(\w+)/,
      /^\s*(?:async\s+)?(?:\w+\s+)*(\w+)\s*\(/,
      /^\s*(?:async\s+)?(\w+)\s*=>\s*{/,
      /^\s*class\s+(\w+)/,
      /^\s*(?:export\s+)?(?:default\s+)?(?:const|let|var)\s+(\w+)/,
    ];

    // Search backward from target line
    for (let i = Math.min(targetLine, document.lineCount) - 1; i >= Math.max(0, targetLine - 50); i--) {
      const line = document.lineAt(i).text;
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if VS Code has been idle (no activity) and report if threshold exceeded.
 */
async function checkAndReportIdleState() {
  const now = Date.now();
  const inactiveMs = now - extension.lastActivityTimeMs;
  const inactiveSeconds = inactiveMs / 1000;

  if (inactiveSeconds >= CONFIG.idleThresholdSeconds && !extension.isIdle) {
    // Transition to idle
    extension.isIdle = true;
    await sendEvent("vscode_idle", {
      extra: {
        inactive_seconds: Math.round(inactiveSeconds),
        last_file: extension.lastActiveFile,
      },
    });
    log(`VS Code idle detected (${Math.round(inactiveSeconds)}s)`);
  } else if (inactiveSeconds < CONFIG.idleThresholdSeconds && extension.isIdle) {
    // Transition back to active
    extension.isIdle = false;
    await sendEvent("vscode_active", {
      extra: {
        idle_duration_seconds: Math.round(inactiveSeconds),
      },
    });
    log("VS Code activity resumed");
  }
}

/**
 * Detect if file switch represents a "drift" (major context change).
 * Simple heuristic: different language or very different directory.
 */
function isDriftSwitch(oldFile, newFile) {
  if (!oldFile) return false;

  const oldParts = oldFile.split("/");
  const newParts = newFile.split("/");

  // Different project root (first directory) = drift
  if (oldParts[0] !== newParts[0]) {
    return true;
  }

  // Same project but different subdirectory (e.g., src/ → tests/) = drift
  if (oldParts[1] && newParts[1] && oldParts[1] !== newParts[1]) {
    return true;
  }

  return false;
}

/**
 * Send an event to the backend.
 */
async function sendEvent(eventType, options = {}) {
  try {
    const event = {
      timestamp: new Date().toISOString(),
      event_type: eventType,
      app: "VSCode",
      title: options.title || null,
      url: options.url || null,
      duration_seconds: options.durationSeconds || null,
      extra: options.extra || null,
    };

    const response = await fetch(`${getBackendUrl()}/events`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      log(`Backend error: ${response.status}`);
    }
  } catch (err) {
    log(`Error sending event: ${err}`);
  }
}

/**
 * Called when the extension is deactivated.
 */
function deactivate() {
  if (extension.idleCheckIntervalId) {
    clearInterval(extension.idleCheckIntervalId);
  }
  extension.disposables.forEach((d) => d.dispose());
}

module.exports = { activate, deactivate };
