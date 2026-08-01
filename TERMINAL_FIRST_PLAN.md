# Redev Terminal-First Plan

> **CLI-first tool for clicking UI elements and reviewing/applying changes in the terminal**

---

## 🎯 The Flow

### User Perspective
```
1. Start dev server
2. Open browser, see your app + invisible overlay
3. Press Cmd+Shift+E to enable overlay (optional UI)
4. Click element you want to change
5. Terminal shows element details
6. Type change description in terminal
7. Claude Code generates code
8. Terminal shows diff (colored, readable)
9. Type Y to accept
10. Browser reloads with changes
11. Terminal confirms: "Verified ✅"
12. Done! Change is in your source code
```

---

## 🏗️ Architecture (Simplified from Redev)

```
Browser                    Terminal                Backend
├─ App                     ├─ CLI UI              ├─ MCP Server
├─ Overlay                 │  ├─ Element Info    │  ├─ Dev Plugin
│  └─ Click handler        │  ├─ Change Prompt   │  ├─ Context
└─ WebSocket              │  ├─ Diff Viewer      │  ├─ Generation
   to CLI                  │  └─ Approval        │  └─ Verification
                           └─ Input Handler
```

---

## 🚀 Quick Start Guide (When Built)

```bash
# 1. Install Redev in your React project
npm install -D redev-cli

# 2. Add to package.json
{
  "scripts": {
    "redev": "redev-cli"
  }
}

# 3. Start your dev server (normal way)
npm run dev

# 4. In another terminal, start Redev
npm run redev

# 5. In browser:
# - Open http://localhost:5173 (your app)
# - Press Cmd+Shift+E to enable overlay
# - Click any element

# 6. Terminal shows:
# ✓ Button selected: components/Button.tsx:42
# ? Describe change: > make this button green
# [Claude generating...] ⏳
# [Diff shown]
# ? Accept? (Y/n): Y
# ✓ Done! Browser reloaded
```

---

## 📋 Core Components (Terminal-First)

### 1. **Browser Overlay** (Minimal)
- Shadow DOM element selector
- Click → send to CLI via WebSocket
- No UI buttons (just click detection)
- Shows which element is selected (outline)

### 2. **CLI Application** (Main UX)
- Displays element info (file, classes, props)
- Prompts for change description
- Shows diffs with colors
- Handles approval/rejection
- Shows verification results

### 3. **Backend Services** (Same as before)
- Dev-server integration
- Framework adapter (React mapping)
- Context composer
- MCP agent bridge
- Code generator
- Verification engine

### 4. **WebSocket Bridge**
- Browser ↔ Terminal communication
- Real-time updates
- Change notifications

---

## 📝 Implementation Phases

### Phase 1: CLI Foundation (Week 1)
**Goal:** Terminal can show element info and accept descriptions

- ✅ CLI app skeleton
- ✅ WebSocket server (browser ↔ CLI)
- ✅ Element info display
- ✅ Change prompt input
- ✅ File path integration

### Phase 2: Code Generation (Week 2)
**Goal:** Claude Code generates edits

- ✅ MCP server integration
- ✅ Context building
- ✅ Code generation
- ✅ Diff calculation and display

### Phase 3: Verification (Week 3)
**Goal:** Terminal shows verification results

- ✅ AST validation
- ✅ Viewport simulation
- ✅ Property verification
- ✅ Verdict display (✅ Verified or ⚠️ Needs Review)

### Phase 4: Polish (Week 4)
**Goal:** Production-ready CLI

- ✅ Error handling
- ✅ Colors and formatting
- ✅ Performance
- ✅ Documentation

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **CLI** | Node.js + Ink (React for terminals) or Blessed |
| **Browser Overlay** | React + Shadow DOM |
| **Communication** | WebSocket (ws) |
| **MCP** | Model Context Protocol SDK |
| **Code Generation** | Claude API via MCP |
| **Parsing** | TypeScript Compiler API |
| **Verification** | jsdom + Puppeteer/Playwright |

---

## 📁 Folder Structure

```
potatoo-dev/
├── backend/                    # Backend services (same as before)
│   ├── src/
│   │   ├── plugins/           # Dev-server integration
│   │   ├── adapters/          # React + Tailwind adapters
│   │   ├── services/          # Core services
│   │   ├── mcp/               # MCP server
│   │   ├── prompts/           # Prompts
│   │   └── websocket/         # WebSocket server
│   └── package.json
│
├── cli/                        # Terminal CLI (NEW)
│   ├── src/
│   │   ├── index.ts           # Entry point
│   │   ├── ui/
│   │   │   ├── App.tsx        # Main CLI UI (Ink)
│   │   │   ├── ElementInfo.tsx # Shows element details
│   │   │   ├── DiffViewer.tsx # Shows colored diffs
│   │   │   ├── PromptInput.tsx # Change description
│   │   │   └── VerificationStatus.tsx
│   │   ├── services/
│   │   │   ├── WebSocketClient.ts
│   │   │   ├── CLIStateManager.ts
│   │   │   └── DiffFormatter.ts
│   │   └── utils/
│   │       ├── colors.ts      # Terminal colors
│   │       └── formatting.ts
│   └── package.json
│
├── frontend/                   # Browser overlay (simplified)
│   ├── src/
│   │   ├── overlay/
│   │   │   ├── OverlayManager.tsx
│   │   │   ├── ElementSelector.tsx
│   │   │   └── WebSocketClient.ts
│   │   └── index.tsx
│   └── package.json
│
├── TERMINAL_FIRST_PLAN.md     # This file
└── QUICK_START.md             # Getting started guide
```

---

## 🎯 18-Task Breakdown (Terminal-First Version)

### Foundation (Tasks 1-4): Same as before
1. Dev-Server Integration
2. Browser Overlay (simplified - no buttons, just clicks)
3. Framework Adapter (React + Tailwind)
4. MCP Agent Bridge

### CLI UI (Tasks 5-8): NEW
5. **CLI App Skeleton** - Create Ink app structure
6. **Element Info Display** - Show selected element details
7. **Change Prompt Input** - Terminal input for descriptions
8. **Diff Viewer** - Colored, readable diff display

### Code Generation (Tasks 9-11): Same as before
9. Context Composer
10. Prompt Engineering
11. Code Generation

### Verification & CLI (Tasks 12-15): Adapted
12. AST Parser + Syntax Validation
13. Runtime Testing
14. Verification Engine
15. CLI Verification Display

### Finishing (Tasks 16-18): Same as before
16. Error Handling
17. Performance Optimization
18. Testing & Documentation

---

## 💡 Why Terminal-First?

✅ **Simpler** - No complex browser UI  
✅ **Faster** - Click element, done in 10 seconds  
✅ **Scriptable** - Can automate from CI/CD  
✅ **Dev-friendly** - Stays in editor workflow  
✅ **Lightweight** - No overlay bloat  
✅ **Git-aware** - Can commit from same terminal  
✅ **Powerful** - All features, minimal UI  
✅ **Unique** - Differentiates from Frontman  

---

## 🎮 Example Session

```bash
$ npm run redev

     ┌─────────────────────────────────────────────┐
     │          🥔 Redev - Click to Edit           │
     └─────────────────────────────────────────────┘

     Waiting for element selection...
     (click any element in your browser)

     Press Cmd+Shift+E in browser to enable overlay

─────────────────────────────────────────────────────

✓ Element selected:
  Component: Button
  File: src/components/Button.tsx
  Line: 42
  Classes: px-2 py-1 bg-blue-500 text-white

─────────────────────────────────────────────────────

? Describe the change:
> add more padding and make corners rounded

─────────────────────────────────────────────────────

⏳ Claude Code is thinking...

─────────────────────────────────────────────────────

📝 Proposed Changes:

  src/components/Button.tsx

  Line 42-43:
  - className="px-2 py-1 bg-blue-500 text-white"
  + className="px-4 py-2 bg-blue-500 text-white rounded-lg"

─────────────────────────────────────────────────────

? Accept this change? (Y/n/e/r)
  Y = Yes, apply
  n = No, reject
  e = Edit description and regenerate
  r = Reselect element
> Y

✓ Change applied!
✓ Browser reloaded

─────────────────────────────────────────────────────

✓ Verification Status:

  Desktop (1440px):    ✅ Verified
  Tablet (768px):      ✅ Verified  
  Mobile (375px):      ✅ Verified

  ✓ All requested changes detected
  ✓ No visual regressions
  ✓ Ready to commit

─────────────────────────────────────────────────────

? Commit this change? (Y/n)
> Y

✓ Diff ready for git commit

─────────────────────────────────────────────────────

$ git status
  modified: src/components/Button.tsx

$ npm run redev
  Waiting for element selection...
```

---

## 🚀 Getting Started (Next Steps)

1. **Read this document** - understand the terminal-first approach
2. **Create CLI app skeleton** - start with Task 5
3. **Build element display** - Task 6
4. **Add diff viewer** - Task 7
5. **Then build backend** (backend is the same as before)

---

## ✅ Success Criteria (Terminal-First)

- [ ] Click element in browser → details appear in terminal
- [ ] Type change description → Claude generates code
- [ ] Terminal shows colored diff that's easy to review
- [ ] Approve with `Y` → code applied and verified
- [ ] Entire flow: <60 seconds from click to approval
- [ ] Works on macOS, Linux, Windows
- [ ] One-command install: `npm install -D redev-cli`

---

## 🎯 MVP Definition

**Minimum Viable Product:**
- Click element in browser
- Describe change in terminal
- Claude Code edits source
- Terminal shows diff
- Approve in terminal
- Browser reloads with changes
- Verification shows result
- Done!

**Not in MVP:**
- Multiple element editing
- Visual property controls
- Team collaboration
- Cloud storage
- Advanced visualizations

---

## 📊 Effort Summary

| Component | Tasks | Duration | Effort |
|-----------|-------|----------|--------|
| **Backend** (same) | 1-4, 9-11, 12-13 | 6 weeks | ~150h |
| **CLI UI** (new) | 5-8, 14-15 | 2 weeks | ~50h |
| **Verification** | 16-18 | 1 week | ~30h |
| **Total** | 18 | **9 weeks** | **~230h** |

**For 1 senior engineer:** ~2 months  
**For 2 engineers:** ~5-6 weeks  

---

## 🎓 Next Actions

1. ✅ Understand this terminal-first approach
2. → Update IMPLEMENTATION_PLAN.md for CLI focus
3. → Start with Task 5: CLI App Skeleton
4. → Build CLI UI components (Tasks 5-8)
5. → Then backend (same as before)

---

**The beauty of this approach:**
- Backend complexity is the same as Redev
- Frontend becomes much simpler (just clicks)
- CLI is powerful and fun to use
- Scales to teams (just share terminal or logs)
- Works great with git/CI workflow
- No browser bloat

Ready to build? 🚀
