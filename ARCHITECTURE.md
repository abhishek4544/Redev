# Redev Architecture

> **System design for the click-to-edit verification platform**

---

## 🏗️ System Overview

Redev has 7 core architectural components that work together to enable the click→edit→verify loop:

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Redev Browser Overlay (React)                     │ │
│  │  ├─ Element Selection (hover/click)                │ │
│  │  ├─ Inspector Panel (metadata display)             │ │
│  │  ├─ Prompt Input (user instructions)               │ │
│  │  └─ Diff Viewer (review changes)                   │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Running React App (being edited)                  │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
        ↕ (WebSocket + REST)
┌─────────────────────────────────────────────────────────┐
│                  Backend (Node.js/Express)              │
│                    MCP Agent Server                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 1. Dev-Server Integration                        │  │
│  │    • Vite/Webpack plugin                         │  │
│  │    • Metadata injection                          │  │
│  │    • Hot-reload triggering                       │  │
│  └──────────────────────────────────────────────────┘  │
│                         ↓                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 3. Framework Adapter (React + Tailwind)          │  │
│  │    • Component source mapping                    │  │
│  │    • Tailwind class parsing                      │  │
│  │    • Props extraction                            │  │
│  └──────────────────────────────────────────────────┘  │
│                         ↓                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 4. Context Composer                              │  │
│  │    • Source code extraction                      │  │
│  │    • Dependency analysis                         │  │
│  │    • Design system extraction                    │  │
│  │    • Context optimization (token limits)         │  │
│  └──────────────────────────────────────────────────┘  │
│                         ↓                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 5. Agent Bridge (MCP)                            │  │
│  │    • Tool definitions                            │  │
│  │    • Request/response handling                   │  │
│  │    • Token tracking                              │  │
│  └──────────────────────────────────────────────────┘  │
│              ↕ (MCP Protocol)                            │
│              Claude Code (User's Agent)                  │
│                         ↓                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 6. Verification Engine                           │  │
│  │    • AST parsing                                 │  │
│  │    • Syntax validation                           │  │
│  │    • Type checking                               │  │
│  │    • Runtime testing                             │  │
│  │    • Property verification                       │  │
│  └──────────────────────────────────────────────────┘  │
│                         ↓                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 2. Browser Overlay                               │  │
│  │    (Displays verification results)                │  │
│  └──────────────────────────────────────────────────┘  │
│                         ↓                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 7. Fixture Harness                               │  │
│  │    • Testing mapping accuracy                    │  │
│  │    • Testing verification reliability            │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 The 7 Components

### 1. Dev-Server Integration

**Purpose:** Hook into the development server and inject metadata into running code

**Responsibilities:**
- Intercept Vite/Webpack build pipeline
- Inject data attributes into rendered elements (for identification)
- Serve the browser overlay UI
- Trigger hot-reload after file changes
- Never run in production

**How it Works:**
```
Vite Dev Server Request
    ↓
Redev Vite Plugin intercepts
    ↓
Modifies HTML/JS to inject metadata (e.g., data-redev-id, data-redev-file)
    ↓
Serves modified assets to browser
    ↓
Overlay attaches to page and reads metadata
```

**Key Files:**
- `backend/src/plugins/dev-server-plugin.ts` - Vite integration hook
- `backend/src/services/asset-interceptor.ts` - Modifies assets before serving
- `backend/src/services/HotReloadTrigger.ts` - Watches file changes and reloads

**Critical Requirement:** Must be invisible to the app. Zero layout shifts, zero style changes, zero functionality changes.

---

### 2. Browser Overlay

**Purpose:** Let users click on UI elements without modifying the page

**Responsibilities:**
- Render on top of the app in a shadow DOM (isolated from host styles)
- Detect mouseover and clicks on elements
- Highlight elements with outlines/borders
- Capture element coordinates and DOM properties
- Display selected element metadata
- Never interfere with page interaction

**How it Works:**
```
User hovers over element
    ↓
Overlay captures mouseover event
    ↓
Renders transparent highlight over element
    ↓
User clicks element
    ↓
Overlay freezes selection and sends to backend
    ↓
Inspector panel shows element metadata
```

**Key Files:**
- `frontend/src/overlay/OverlayManager.tsx` - Main overlay lifecycle
- `frontend/src/overlay/ElementHighlighter.tsx` - Visual highlights
- `frontend/src/overlay/EventCapture.ts` - Click/hover event listeners
- `frontend/src/hooks/useOverlayState.ts` - State management

**Critical Requirement:** Shadow DOM isolation prevents host page styles from affecting overlay.

---

### 3. Framework Adapter (React + Tailwind)

**Purpose:** Map clicked DOM elements back to React source code

**Responsibilities:**
- Identify React component from element (using injected metadata)
- Map element to source file, line, and column
- Extract Tailwind classes and convert to class names
- Extract React props from element attributes
- Build component dependency graph
- Provide confidence scores on mappings

**How it Works:**
```
User clicks element
    ↓
Overlay reads injected metadata (data-redev-file, data-redev-component)
    ↓
Backend queries source map to find source file
    ↓
Backend parses React AST to understand component structure
    ↓
Backend extracts Tailwind classes from element's className
    ↓
Backend looks up component props from rendered attributes
    ↓
Returns: { file, line, column, confidence, component, tailwindClasses, props }
```

**Key Files:**
- `backend/src/adapters/ReactAdapter.ts` - React-specific mapping
- `backend/src/adapters/TailwindAdapter.ts` - Tailwind class parsing
- `backend/src/services/SourceMapper.ts` - DOM element → source file
- `backend/src/services/DesignSystemExtractor.ts` - Tailwind config + tokens

**Critical Requirement:** ≥95% accuracy on source mapping. Confidence scores must be honest; never present uncertain mappings as certain.

---

### 4. Context Composer

**Purpose:** Build the complete context that Claude Code needs to make edits

**Responsibilities:**
- Read source files from disk (with caching)
- Analyze component dependencies
- Extract design system (Tailwind tokens, component library)
- Optimize context to fit token limits
- Format context as structured handoff for Claude Code
- Include examples from the design system

**How it Works:**
```
User clicks element and describes change
    ↓
Overlay sends element metadata + user prompt to backend
    ↓
Backend uses SourceMapper to identify component file
    ↓
Backend reads source file and related components (via dependency analysis)
    ↓
Backend extracts Tailwind config and design tokens
    ↓
Backend assembles context with examples of similar patterns
    ↓
Context formatted as: { selectedFile, relatedFiles, design, task }
    ↓
Sent to Claude Code via MCP
```

**Key Files:**
- `backend/src/services/ContextComposer.ts` - Main orchestrator
- `backend/src/services/FileReader.ts` - File I/O with caching
- `backend/src/services/DependencyAnalyzer.ts` - Component graph
- `backend/src/services/DesignSystemExtractor.ts` - Tailwind + tokens
- `backend/src/prompts/PromptBuilder.ts` - Assembles final prompt

**Critical Requirement:** Context must fit within Claude's token limit. Better to omit less relevant files than to truncate important ones.

---

### 5. Agent Bridge (MCP)

**Purpose:** Enable Claude Code to retrieve context and generate edits

**Responsibilities:**
- Implement MCP server that Claude Code connects to
- Define tools Claude Code can call (GetContext, GenerateCode)
- Handle request/response marshalling
- Track token usage
- Provide clear tool documentation

**How it Works:**
```
User clicks "Confirm" on prompt
    ↓
Claude Code calls MCP tool: GetContext(elementId, task)
    ↓
Backend retrieves context via Context Composer
    ↓
Returns context to Claude Code
    ↓
Claude Code generates code changes using its LLM
    ↓
Claude Code calls MCP tool: ApplyChanges(filePath, changes)
    ↓
Backend applies changes to source file
    ↓
Backend triggers hot-reload
```

**Key Files:**
- `backend/src/mcp/RedevServer.ts` - MCP server implementation
- `backend/src/mcp/tools/GetContextTool.ts` - Returns context
- `backend/src/mcp/tools/GenerateCodeTool.ts` - Orchestrates code generation
- `backend/src/services/CodeGenerator.ts` - Calls Claude Code LLM

**Critical Requirement:** Tools must be clear and well-documented. MCP protocol requires explicit tool schemas.

---

### 6. Verification Engine

**Purpose:** Prove the generated changes are correct across all viewports

**Responsibilities:**
- Parse generated code (AST parsing)
- Validate syntax (no parsing errors)
- Check types (TypeScript type checking)
- Simulate viewports (desktop, tablet, mobile)
- Re-read computed values after hot-reload
- Compare requested vs actual values
- Generate verdicts (Verified ✅ or Needs Review ⚠️)
- Capture evidence (before/after screenshots, values)

**How it Works:**
```
Code generated and applied to source file
    ↓
Dev server hot-reloads
    ↓
Backend waits for page to reload (2-3 seconds)
    ↓
Backend simulates viewport 1 (desktop 1440px):
  ├─ Navigate to app
  ├─ Locate element
  ├─ Read computed values (padding, color, size)
  ├─ Compare to requested values
  └─ Generate verdict: ✅ or ⚠️
    ↓
Backend simulates viewport 2 (tablet 768px): [repeat]
    ↓
Backend simulates viewport 3 (mobile 375px): [repeat]
    ↓
Final verdict: ✅ Verified (ALL viewports pass) or ⚠️ Needs Review (any viewport fails)
    ↓
Display to user with evidence
```

**Key Files:**
- `backend/src/services/ASTParser.ts` - Parses React/JSX code
- `backend/src/services/SyntaxValidator.ts` - Checks syntax errors
- `backend/src/services/TypeChecker.ts` - Runs TypeScript compiler
- `backend/src/services/ViewportSimulator.ts` - Desktop/tablet/mobile presets
- `backend/src/services/PropertyReader.ts` - Re-reads DOM values
- `backend/src/services/VerificationEngine.ts` - Orchestrates all checks
- `backend/src/services/RegressionDetector.ts` - Compares before/after

**Critical Requirement:** ZERO false positives. If we say "Verified", it must be correct. Prefer "Needs Review" over a wrong "Verified".

---

### 7. Fixture Harness

**Purpose:** Test mapping and verification accuracy before shipping

**Responsibilities:**
- Generate test fixtures (React components with known props/styles)
- Test framework adapter (can we map fixture elements correctly?)
- Test verification engine (can we detect correct vs incorrect changes?)
- Continuously validate accuracy in CI
- Alert on regressions

**How it Works:**
```
Fixture: A simple Card component with known Tailwind classes
    ↓
Test 1 - Framework Adapter:
  ├─ Render fixture
  ├─ Ask mapper: "What is this Card component?"
  └─ Verify: File, line, classes match expected values
    ↓
Test 2 - Verification:
  ├─ Render fixture
  ├─ Make a known change ("increase padding")
  ├─ Ask verifier: "Did this change happen?"
  └─ Verify: Verdict is Verified (should be) and evidence is correct
    ↓
Test 3 - Regression:
  ├─ Make an intentional WRONG change
  ├─ Ask verifier: "Did this change happen?"
  └─ Verify: Verdict is Needs Review (should be), not false Verified
```

**Key Files:**
- `backend/src/services/FixtureGenerator.ts` - Creates test React components
- `backend/src/services/ComponentTester.ts` - Renders fixtures
- `backend/tests/fixtures/` - Fixture definitions
- `backend/tests/integration/` - Integration test suites

**Critical Requirement:** Fixtures must match real-world projects, not toy examples. Test on actual component libraries.

---

## 🔄 Data Flow: Complete Loop

### User Initiates Edit

```
1. User clicks "Edit" button in overlay
   └─→ Overlay enters edit mode
       ├─ Freezes element selection
       ├─ Shows inspector with component metadata
       └─ Shows prompt input field

2. User hovers elements (selects a different element)
   └─→ Framework adapter identifies component
       ├─ Maps element → React component file
       ├─ Extracts Tailwind classes
       ├─ Calculates confidence score
       └─ Inspector updates with new metadata

3. User types instruction: "make padding larger"
   └─→ Frontend sends to backend
       ├─ Backend logs instruction
       └─ Frontend shows preview (live preview not yet committed)

4. User clicks "Send to Claude"
   └─→ Frontend requests handoff preview
       ├─ Backend builds full context (file, imports, design system)
       ├─ Backend shows preview without sending
       └─ Frontend displays what will be sent

5. User clicks "Confirm"
   └─→ Handoff sent to Claude Code via MCP GetContext tool
       └─ Claude Code receives context
           ├─ Understands component file
           ├─ Has design system examples
           └─ Knows task clearly
```

### Claude Code Generates

```
6. Claude Code LLM processes context
   └─→ Generates code change
       ├─ Modifies source file
       ├─ Maintains code style
       └─ Uses existing patterns

7. Claude Code calls MCP tool: ApplyChanges
   └─→ Backend writes file
       ├─ Atomic write (no partial updates)
       ├─ Backs up original
       └─ Triggers hot-reload
```

### Verification Happens

```
8. Dev server hot-reloads
   └─→ Browser reloads with new code
       ├─ Page stabilizes (wait 2-3 seconds)
       └─ Element still exists (or Needs Review)

9. Backend re-reads element properties
   └─→ For desktop viewport:
       ├─ Locate element in DOM
       ├─ Read computed styles (padding, color, etc.)
       ├─ Compare to requested values
       └─ Generate verdict: ✅ or ⚠️
       
   └─→ For tablet viewport: [repeat]
   └─→ For mobile viewport: [repeat]

10. Verification results sent to frontend
    └─→ Overlay displays verdict + evidence
        ├─ "✅ Verified across all viewports"
        ├─ Or "⚠️ Needs Review - padding increased but not color changed"
        └─ Shows before/after screenshots
```

### User Reviews & Accepts

```
11. User reviews verdict and evidence
    └─→ Options:
        ├─ "Accept" → Diff committed to git
        ├─ "Refine" → Describe further change to Claude Code
        └─ "Reselect" → Choose different element to edit
```

---

## 🗂️ Folder Structure & Component Mapping

```
backend/src/
├── plugins/
│   └── dev-server-plugin.ts            ← Component 1: Dev-Server Integration
│
├── overlay/ (frontend)
│   └── OverlayManager.tsx              ← Component 2: Browser Overlay
│
├── adapters/
│   ├── ReactAdapter.ts                 ← Component 3: Framework Adapter
│   └── TailwindAdapter.ts
│
├── services/
│   ├── ContextComposer.ts              ← Component 4: Context Composer
│   ├── FileReader.ts
│   ├── DependencyAnalyzer.ts
│   ├── DesignSystemExtractor.ts
│   │
│   ├── CodeGenerator.ts                ← Component 5: Agent Bridge
│   │
│   ├── ASTParser.ts                    ← Component 6: Verification Engine
│   ├── SyntaxValidator.ts
│   ├── TypeChecker.ts
│   ├── ViewportSimulator.ts
│   ├── PropertyReader.ts
│   ├── VerificationEngine.ts
│   ├── RegressionDetector.ts
│   │
│   ├── FixtureGenerator.ts             ← Component 7: Fixture Harness
│   └── ComponentTester.ts
│
├── mcp/
│   ├── RedevServer.ts                  ← Component 5: MCP Tools
│   └── tools/
│       ├── GetContextTool.ts
│       └── GenerateCodeTool.ts
│
└── prompts/
    ├── system.prompt.ts                ← Component 4: Prompts
    ├── examples.ts
    └── PromptBuilder.ts
```

---

## 🔐 Security & Isolation

### Overlay Isolation
- Browser overlay uses Shadow DOM (not affected by host page styles)
- No style pollution between overlay and app

### Dev-Only
- Plugin only activates in development mode
- Metadata injection removed in production builds
- MCP server only accessible locally

### File Safety
- Atomic file writes with backups
- Never overwrites without backup
- Rollback available for recent changes

### Token Limits
- Context composer respects Claude's token limits
- Never sends incomplete/truncated context
- Prioritizes essential info over nice-to-haves

---

## 🧪 Testing Strategy

### Unit Testing
- Each service tested independently
- Mock dependencies
- Fast (< 1s per test)

### Integration Testing
- Services work together (e.g., adapter → context composer → prompt builder)
- Real file I/O but isolated directories
- Slower but catches real issues

### End-to-End Testing
- Complete loop: click → generate → verify
- Real React app (fixture component)
- Real viewport simulation
- Slowest but most valuable

### Continuous Testing
- Fixture harness runs in CI
- Alerts on regressions
- Mapping accuracy tracked over time

---

## 📈 Performance Targets

| Metric | Target | Why |
|--------|--------|-----|
| Context extraction | < 500ms | User shouldn't wait long |
| Initial render | < 16ms | 60 FPS |
| Framework mapping | < 250ms | Click should be snappy |
| Verification | < 5s | Reasonable wait for validation |
| Cache hit rate | > 70% | Mostly reading same files |

---

## 🔄 State Management

### Frontend
- **Edit Mode State:** Enabled/disabled
- **Selected Element:** Current clicked element + metadata
- **Prompt History:** Recent user prompts
- **Diff View:** Current/previous/proposed code

### Backend
- **Cache:** Files, AST, design system (LRU, max 100MB)
- **Change History:** Recent edits (for rollback)
- **Viewport State:** Current simulated viewport

---

## 🚨 Error Handling

### At Each Layer

| Component | Error Type | Handling |
|-----------|-----------|----------|
| Dev-Server Integration | Plugin load fails | User sees clear error: "Redev plugin didn't load" |
| Overlay | Elements not clickable | Fallback to manual file input |
| Framework Adapter | Can't map element | Show "Uncertain" badge; don't guess |
| Context Composer | File not found | Use relative context; show warning |
| Agent Bridge | MCP tool fails | Retry up to 3 times; ask user to reconnect Claude |
| Code Generator | Syntax error in output | Don't apply; show error to user |
| Verification | Viewport unavailable | Mark as "Needs Review" |

---

## 📝 Next Steps

- **[ROADMAP.md](./ROADMAP.md)** - Timeline and phases
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Step-by-step tasks
