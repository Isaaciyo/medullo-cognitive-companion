# Medullo Demo Script — Quick Reference

**Total Runtime:** ~3 minutes  
**Setup:** Browser open to localhost:3000, VS Code with extension running, Chrome extension enabled

---

## [0:00 - 0:20] Opening Hook

**Scene:** Home page showing WelcomeCard

**Talking Points:**
- "Meet **Medullo** — your cognitive continuity companion"
- "Ever get interrupted mid-task and lose your train of thought?"
- "Medullo captures where you were, what you were doing, and why — so you can pick up exactly where you left off"

**Visual:** Pan across the welcome card, show the warm ambient background

---

## [0:20 - 0:50] The Problem (Setup)

**Scene:** Show browser with multiple tabs, then switch to VS Code

**Demo Actions:**
1. Open VS Code with a code file
2. Show cursor in a specific function
3. Switch back to browser
4. Go to a few tabs, do a search query

**Talking Points:**
- "Your typical workflow: jumping between browser tabs, code editor, docs, Slack..."
- "When you get interrupted — whether it's a notification, meeting, or just context fatigue..."
- "...you lose all that context. What were you working on? What was the goal?"

**Visual:** Show rapid tab switching, show distractions (notifications, multiple windows)

---

## [0:50 - 1:45] The Solution: Automatic Context Capture

**Scene:** Trigger an interruption by:
- Stepping away from keyboard for 2+ minutes (show idle timer in VS Code extension logs)
- OR manually open the home page and wait for snapshot

**Talking Points:**
- "Medullo runs silently in the background on your browser and VS Code"
- "It captures three things whenever you get interrupted:"

### **1. What You Were Doing**
- File you were in (VS Code: `src/auth.ts` line 42)
- Tab you were on (browser: e.g., "API Docs")
- Search queries or pages you visited

### **2. The Goal**
- "Medullo uses AI to synthesize this into a **cognitive snapshot**"
- "It asks: what was this person actually trying to accomplish?"

### **3. Blockers & Next Steps**
- "Were there any blockers? What's the next logical step?"

**Visual:**
- Show the WelcomeCard rendering with snapshot data
- Scroll through the snapshot to show: Task → Intent → Progress → Blockers → Next Steps
- Read one or two key fields aloud (e.g., "Task: Fix auth token expiration bug in login flow")

---

## [1:45 - 2:20] Resume & Continue

**Scene:** Click "Resume Work" button in the snapshot

**Talking Points:**
- "When you're ready to get back to work..."
- "Click 'Resume' — it opens your actual last file AND shows your saved context"
- "No more 'what was I doing?' — just continue"

**Visual:**
- Show button click
- Show file opening / context re-appearing
- Optional: show a second interruption cycle (brief)

---

## [2:20 - 2:50] Archive & Temporal Continuity

**Scene:** Click "View All Sessions" → navigate to `/sessions` page

**Talking Points:**
- "But it's not just for the current moment"
- "Medullo builds a **memory lane** — your complete work history"
- "See patterns: what problems keep coming up? When are you most productive?"
- "Useful for sprint reviews, onboarding others, or just nostalgia"

**Visual:**
- Show session list with multiple cards
- Highlight date/time, task titles
- Show scrolling through archive

---

## [2:50 - 3:00] Closing

**Scene:** Back to home page

**Talking Points:**
- "Medullo: the cognitive companion for deep work"
- "Never lose your train of thought again"

**Visual:** Show logo / ambient background, fade to black

---

## Quick Checklist Before Recording

- [ ] Backend running (`python -m uvicorn app.main:app --reload`)
- [ ] Frontend running (`npm run dev`)
- [ ] Chrome extension loaded (manifest v3)
- [ ] VS Code extension running in debug mode (F5)
- [ ] Sample session data in database (at least 1-2 old sessions)
- [ ] Fresh browser tab at localhost:3000
- [ ] Clear browser history (optional, for cleaner demo)
- [ ] Audio mic tested, quiet environment
- [ ] Screen resolution at least 1440p for readability

---

## Optional B-Roll / Extras

If you want to add depth without lengthening:

1. **Show the Architecture** (15s cut)
   - "Under the hood: Chrome extension → FastAPI backend → Gemini AI → next.js frontend"
   - Show a simple architecture diagram

2. **Show Real Event Data** (10s cut)
   - Open browser DevTools, show Network tab
   - Fire an event, show JSON payload
   - "Each action is timestamped and structured"

3. **Show Interruption Alert** (15s cut)
   - Trigger idle state in VS Code (2+ min)
   - Show desktop notification fires
   - "Proactive notifications keep you aware"

---

## Tone Tips

- **Speak conversationally** — not a robot
- **Pause after key features** — let them sink in
- **Show genuine enthusiasm** — this is a cool product
- **Use natural hand gestures** — don't feel rigid
- **Read snapshots naturally** — don't rush the AI output

---

## Recording Tools

- **Screen Recording:** QuickTime (native macOS)
- **Audio:** Built-in mic or AirPods
- **Editing:** CapCut, iMovie, or DaVinci Resolve (free)
- **Upload:** YouTube, Vimeo, or Demo video platform (MLH, Devpost)

**Pro Tip:** Record at 60fps if possible, 2K or 4K for crispness.
