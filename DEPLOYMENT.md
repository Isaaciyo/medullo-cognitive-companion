# Medullo Deployment Guide

## Quick Start (Local Demo)

Perfect for testing, demoing, or developing locally.

### Prerequisites
- Python 3.8+
- Node.js 18+
- Google Chrome or Chromium-based browser
- VS Code (for IDE extension)

---

## 1. Backend Setup (FastAPI)

```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Output:** Backend running at `http://localhost:8000`
- API docs: `http://localhost:8000/docs` (Swagger UI)
- Database: `medullo.db` (SQLite, auto-created)

---

## 2. Frontend Setup (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

**Output:** Frontend running at `http://localhost:3000`

**Optional - Production build:**
```bash
npm run build
npm start  # Runs production server
```

---

## 3. Chrome Extension (Manual)

### Load Extension in Developer Mode

1. Open Chrome, go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Navigate to `/extension` folder in this project
5. Extension appears in toolbar

### Verify Installation

- Icon should appear in Chrome toolbar
- Click icon → popup shows "Medullo Context Captured"
- Open DevTools (F12) → extension sends events to backend
- Check `chrome://extensions/` → see "Medullo — Context Capture"

**Note:** Extension auto-batches events every ~15s to `http://localhost:8000/events`

---

## 4. VS Code Extension (Manual)

### Debug Mode (Development)

1. Open VS Code
2. File → Open Folder → select `/vscode-extension`
3. Press **F5** to start debugging
4. New VS Code window opens with extension active

**Verify:**
- Open any code file
- Move cursor around
- Check extension console (Help → Toggle Developer Tools)
- Should see logs: `"Medullo: vscode_context sent"`, `"Medullo: idle check running"`

### Production (VSIX Package)

```bash
cd vscode-extension

# Install vsce (if not already)
npm install -g @vscode/vsce

# Package extension
vsce package

# Output: medullo-code-context-0.0.1.vsix
# Install in VS Code: Extensions → ... → Install from VSIX
```

---

## End-to-End Local Demo Flow

1. **Terminal 1 - Backend:**
   ```bash
   cd backend && source .venv/bin/activate
   python -m uvicorn app.main:app --reload --port 8000
   ```

2. **Terminal 2 - Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Terminal 3 - Extension Logs (optional):**
   ```bash
   # Watch backend events in real-time
   curl http://localhost:8000/docs  # Check API
   ```

4. **Chrome:**
   - Load `/extension` as unpacked extension
   - Visit `http://localhost:3000`
   - Trigger events (tab switches, searches, idle)

5. **VS Code:**
   - Press F5 to run `/vscode-extension` in debug mode
   - Open code files, move cursor
   - Wait 2+ min for idle detection

6. **View Results:**
   - Go to `http://localhost:3000`
   - See home page with WelcomeCard (latest interrupted session)
   - Click "Cognitive Interruptions" → `/interruptions` page
   - Click "All Sessions" → `/sessions` page (archive)

---

## Production Deployment

### Backend (FastAPI → Cloud)

**Option A: Heroku (simple, free tier deprecated but still works)**
```bash
# Add Procfile
echo "web: uvicorn app.main:app --host 0.0.0.0 --port \$PORT" > Procfile

# Deploy
heroku login
heroku create medullo-backend
git push heroku main
```

**Option B: AWS EC2**
```bash
# SSH into instance
ssh -i key.pem ubuntu@<instance-ip>

# Install Python, clone repo
sudo apt update
sudo apt install python3-pip python3-venv
git clone <repo>
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run with gunicorn
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 app.main:app

# Or use systemd for auto-restart
sudo systemctl restart medullo-backend
```

**Option C: Docker**
```dockerfile
# backend/Dockerfile
FROM python:3.11
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t medullo-backend .
docker run -p 8000:8000 medullo-backend
```

### Frontend (Next.js → Vercel)

**Easiest: Vercel (made by Next.js creators)**
```bash
npm install -g vercel
vercel
# Follow prompts, auto-deploys from git
```

**Alternative: AWS Amplify, Netlify, GitHub Pages**

**Environment Variables:**
```
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
```

### Chrome Extension

1. Build for production:
   ```bash
   # Already production-ready, no build step needed
   # Just zip the /extension folder
   zip -r medullo-extension.zip extension/
   ```

2. Submit to Chrome Web Store:
   - Developer account ($5 one-time fee)
   - Upload manifest.json + screenshots + description
   - Review process: 1-3 days
   - URL: `https://chrome.google.com/webstore/detail/medullo-context-capture/...`

3. Update in manifest.json for production:
   ```json
   "host_permissions": [
     "http://api.yourdomain.com/*",
     "*://*.google.com/*"
   ]
   ```

### VS Code Extension

1. Publish to VS Code Marketplace:
   ```bash
   cd vscode-extension
   vsce publish
   # Requires Microsoft account
   ```

2. URL: `https://marketplace.visualstudio.com/items?itemName=yourname.medullo-code-context`

3. Update in extension.js for production:
   ```javascript
   const CONFIG = {
     backendUrl: "https://api.yourdomain.com",
     idleThresholdSeconds: 120,
   };
   ```

---

## Environment Configuration

### Local (.env.local in root)
```
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
GEMINI_API_KEY=your-key-here
DATABASE_URL=sqlite:///./medullo.db
```

### Production (.env in backend/)
```
BACKEND_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
GEMINI_API_KEY=your-key-here
DATABASE_URL=postgresql://user:pass@db-host:5432/medullo
```

---

## Database Migration (Production)

Switch from SQLite to PostgreSQL:

```bash
# Install postgres driver
pip install psycopg2-binary

# Update backend/app/database.py
# DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./medullo.db")
# to:
# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost/medullo")

# Create tables
alembic upgrade head
```

---

## Testing Before Deploy

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm run test

# Manual E2E test
# 1. All 4 services running
# 2. Open browser to localhost:3000
# 3. Trigger: tab switch, search, 2+ min idle in VS Code
# 4. Verify: snapshot appears on home page
# 5. Verify: /interruptions and /sessions pages work
```

---

## Monitoring & Debugging

### Backend Logs
```bash
# Watch live
tail -f backend/medullo.db  # SQLite
# or check FastAPI logs in terminal

# Check events
curl http://localhost:8000/events
```

### Frontend Console
```
Open browser DevTools (F12) → Console tab
Look for Medullo API calls to /events, /sessions, etc.
```

### Extension Logs
- Chrome: DevTools → Extensions tab → Check logs
- VS Code: Help → Toggle Developer Tools → Console

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Backend won't start | Check port 8000 not in use: `lsof -i :8000` |
| Frontend won't build | `rm -rf node_modules && npm install` |
| Extension not sending events | Check `CONFIG.backendUrl` matches backend URL |
| Idle detection not working | Ensure VS Code extension is running (F5 in debug) |
| Database locked (SQLite) | Restart backend process |
| CORS errors | Add `CORS_ORIGINS` env var to backend |

---

## Quick Deploy Checklist

- [ ] Backend running and healthy (`/docs` endpoint)
- [ ] Frontend builds without errors (`npm run build`)
- [ ] Chrome extension loads (`chrome://extensions/`)
- [ ] VS Code extension debugs (`F5` works)
- [ ] Can create events and see in `/interruptions` page
- [ ] Snapshots generate with Gemini AI
- [ ] Session archive shows multiple entries
- [ ] All three pages work (home, interruptions, archive)

---

## One-Click Local Deploy (Optional Script)

Create `start.sh`:
```bash
#!/bin/bash

# Start backend
cd backend
source .venv/bin/activate &
python -m uvicorn app.main:app --reload --port 8000 &

# Start frontend
cd ../frontend
npm run dev &

echo "✓ Backend: http://localhost:8000"
echo "✓ Frontend: http://localhost:3000"
echo "✓ Load extension: chrome://extensions"
echo "✓ Load VS Code extension: Press F5 in /vscode-extension"
```

Run: `chmod +x start.sh && ./start.sh`

