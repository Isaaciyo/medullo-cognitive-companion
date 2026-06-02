# Medullo — VS Code Extension

Captures your active file, cursor position, and function name to enrich Medullo's cognitive snapshots.

## Features

- 🔍 **Active File Tracking**: Sends file path, language, and line/column on focus changes
- 🎯 **Cursor Position**: Reports cursor position updates to backend
- 🔬 **Function Detection**: Simple heuristic to extract the function/method name you're in
- � **Idle Detection**: Automatically detects when you step away from VS Code (≥2 min inactivity)
- 📍 **Drift Detection**: Identifies major context switches (different project/directory)
- �🔇 **Quiet**: Runs in the background, no UI, minimal overhead

## Setup

1. Make sure Medullo backend is running on `http://localhost:8000`
2. In VS Code: `File > Open Folder...` → select this directory (`vscode-extension/`)
3. Press `F5` to open the extension in a debug window
4. Open any code file — the extension will start sending context to the backend

Or to package:

```bash
npm install -g @vscode/vsce
vsce package
```

Then install the `.vsix` file in VS Code.

## How It Works

When you:
- Switch files → sends `vscode_context` event with new file info
- Move cursor → sends `vscode_context` with new line/column
- Step away (2+ min idle) → sends `vscode_idle` event
- Return from idle → sends `vscode_active` event
- Switch to very different file/project → sends `vscode_drift` event
- Use command `Medullo: Flush Context` → manually trigger a report

## Event Types

| Event | Triggers | Payload |
|-------|----------|---------|
| `vscode_context` | File/cursor change | file_path, line, column, function_name, language_id |
| `vscode_idle` | 2+ min without activity | inactive_seconds, last_file |
| `vscode_active` | Return from idle | idle_duration_seconds |
| `vscode_drift` | Major context switch | from_file, to_file, language_id |
- `file_path`: Full file path
- `file_name`: Just the filename
- `language_id`: VS Code language (javascript, python, etc.)
- `line_number`: 1-indexed line number
- `column_number`: 1-indexed column number
- `function_name`: Extracted function/method name (heuristic)

## Event Examples

### vscode_context (cursor/file activity)
```json
{
  "timestamp": "2026-05-28T20:15:33Z",
  "event_type": "vscode_context",
  "app": "VSCode",
  "title": "auth.ts",
  "url": "/path/to/project/src/auth.ts",
  "extra": {
    "language_id": "typescript",
    "file_path": "/path/to/project/src/auth.ts",
    "file_name": "auth.ts",
    "line_number": 42,
    "column_number": 15,
    "function_name": "handleLogin"
  }
}
```

### vscode_idle (detected 2+ min inactivity)
```json
{
  "timestamp": "2026-05-28T20:25:00Z",
  "event_type": "vscode_idle",
  "app": "VSCode",
  "extra": {
    "inactive_seconds": 120,
    "last_file": "/path/to/project/src/auth.ts"
  }
}
```

### vscode_drift (major context switch)
```json
{
  "timestamp": "2026-05-28T20:30:15Z",
  "event_type": "vscode_drift",
  "app": "VSCode",
  "title": "index.tsx",
  "url": "/path/to/frontend/src/index.tsx",
  "extra": {
    "from_file": "/path/to/project/src/auth.ts",
    "to_file": "/path/to/frontend/src/index.tsx",
    "language_id": "typescriptreact"
  }
}
```

## Limitations

- Function detection uses simple regex (not a full AST parser)
- Only sends to local backend (`http://localhost:8000`)
- No encryption or authentication yet

## Future

- [ ] Extract function name via full language server
- [ ] Support remote backends
- [ ] Configuration UI for backend URL
- [ ] Semantic code snippets (surrounding context)
