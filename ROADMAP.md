# Redev Roadmap & Timeline

> **High-level product phases with dependencies, success criteria, and what each phase unblocks**

---

## 🎯 Overview

Redev is built in 5 sequential phases. **Each phase must complete before the next begins** because later phases depend on earlier foundations. This document shows what each phase delivers, why it matters, and what it enables.

---

## 📅 Phase 1: Foundation & Element Selection (Weeks 1-2)

### What We're Building
Users can click a UI element and see it identified with basic context.

### Deliverables
✅ Dev-server integration (Vite plugin)  
✅ Browser overlay with hover/click detection  
✅ Element bounds and highlighting  
✅ Basic element metadata (tag, id, classes)  
✅ Click freezes selection  

### Why This First
Everything else depends on intercepting the dev server and detecting what the user clicks. **This is the foundational communication channel.**

### Success Criteria
- [ ] Dev server starts with Redev integration active
- [ ] Hovering over elements shows visual outline
- [ ] Clicking an element captures its coordinates and DOM info
- [ ] Overlay doesn't break page interactivity
- [ ] Selection can be toggled on/off with a keyboard shortcut
- [ ] Metadata injection adds <500ms to page load
- [ ] **Test**: Enable overlay in a real React app, click 5 elements, verify info captured

### What It Unblocks
- ✅ Phase 2: Framework adapter needs element metadata to map to source
- ✅ Phase 3: Agent bridge needs coordinates to send context
- ✅ Frontend UI: Inspector panel can show element details

### Files Created
```
backend/src/plugins/
  └── dev-server-plugin.ts          # Vite integration

backend/src/services/
  └── asset-interceptor.ts           # Injects metadata into DOM

frontend/src/overlay/
  ├── OverlayManager.tsx             # Lifecycle + rendering
  ├── ElementHighlighter.tsx         # Visual outlines
  ├── EventCapture.ts                # Click/hover listeners
  └── useOverlayState.ts             # React state hook

frontend/src/types/
  └── overlay.ts                     # Type definitions
```

### Effort Estimate
**~40 hours** (1 senior engineer, 1 week)

---

## 🔍 Phase 2: Framework Understanding (Weeks 3-4)

### What We're Building
Redev can map clicked elements back to React component files and identify Tailwind classes used.

### Deliverables
✅ Element → React component file mapping  
✅ Tailwind class parsing and detection  
✅ Props extraction from rendered elements  
✅ Component library scanning  
✅ Design token detection (colors, spacing, etc.)  
✅ Confidence scores on mappings  

### Why This Phase
Users click a visual element. The agent needs to know which file and component that represents. **Without accurate mapping, Claude Code edits the wrong file.**

### Success Criteria
- [ ] Clicking a button correctly identifies the Button component file
- [ ] Tailwind classes are extracted and categorized (spacing, color, size)
- [ ] Props visible on the element are listed
- [ ] Mapping confidence scores reflect uncertainty appropriately
- [ ] Scans component library for available components
- [ ] Extracts tailwind.config.js tokens (colors, spacing scale)
- [ ] Never presents an uncertain mapping as certain
- [ ] **Test**: Click 10 elements in a multi-component React app, verify ≥95% correct file identification

### What It Unblocks
- ✅ Phase 3: Prompt engineering needs design system context
- ✅ Phase 4: Verification needs to know what was changed
- ✅ Frontend UI: Inspector can show component and Tailwind details

### Files Created
```
backend/src/adapters/
  ├── ReactAdapter.ts                # React-specific mappings
  └── TailwindAdapter.ts             # Tailwind class parsing

backend/src/services/
  ├── SourceMapper.ts                # DOM → file mapping
  ├── PropExtractor.ts               # Extracts React props
  ├── DesignSystemExtractor.ts       # Tailwind config + tokens
  └── PatternDetector.ts             # Common component patterns

backend/src/utils/
  └── metadata-injector.ts           # Injects IDs into rendered elements

frontend/src/types/
  └── framework.ts                   # Framework detection types

frontend/src/components/
  └── ElementInspector.tsx           # Shows mapped component info
```

### Effort Estimate
**~60 hours** (1 senior engineer, 1.5 weeks)

---

## 🤖 Phase 3: Code Generation (Weeks 5-6)

### What We're Building
Claude Code can edit the correct source file based on what was clicked and what the user requested.

### Deliverables
✅ MCP server setup and tool definitions  
✅ Context extraction from source code  
✅ Prompt engineering with design system awareness  
✅ Code generation via Claude Code  
✅ Syntax and type validation  
✅ File writing with hot-reload triggering  
✅ Diff calculation and display  

### Why This Phase
Now we can identify what was clicked. Next, we need to generate code changes. **This is where the AI work happens.** The agent must have enough context to edit correctly.

### Success Criteria
- [ ] MCP server starts and responds to tool calls
- [ ] Context extracted includes component file, imports, related components
- [ ] System prompt is clear and includes design system examples
- [ ] Claude Code can call MCP tools and retrieve context
- [ ] Generated code is syntactically valid (passes parser)
- [ ] TypeScript type checking passes on generated changes
- [ ] Files are written atomically with backups
- [ ] Hot-reload is triggered after file write
- [ ] Diffs can be displayed in UI
- [ ] **Test**: Make 5 change requests (padding, color, typography), verify generated code is valid and applied

### What It Unblocks
- ✅ Phase 4: Verification engine needs code changes to verify
- ✅ Phase 5: Integration testing depends on end-to-end code flow
- ✅ Frontend UI: Can display generated diffs

### Files Created
```
backend/src/mcp/
  ├── RedevServer.ts                 # MCP server implementation
  ├── tools/
  │   ├── GenerateCodeTool.ts        # Calls Claude Code
  │   └── VerifyChangesTool.ts       # Triggers verification
  └── types/
      └── index.ts                   # MCP message types

backend/src/services/
  ├── ContextComposer.ts             # Builds handoff context
  ├── FileReader.ts                  # Cached file reading
  ├── DependencyAnalyzer.ts          # Dependency graph
  ├── ContextOptimizer.ts            # Fits within token limits
  ├── CodeGenerator.ts               # Orchestrates generation
  ├── DiffCalculator.ts              # Computes diffs
  └── FileWriter.ts                  # Atomic writes + backups

backend/src/prompts/
  ├── system.prompt.ts               # Main system prompt
  ├── examples.ts                    # Few-shot examples
  └── PromptBuilder.ts               # Assembles prompts

frontend/src/components/
  └── DiffViewer.tsx                 # Displays diffs

frontend/src/services/
  └── CodeService.ts                 # Calls backend generation
```

### Effort Estimate
**~80 hours** (1 senior engineer + 1 mid-level, 2 weeks)

---

## ✅ Phase 4: Verification (Weeks 7-8)

### What We're Building
Redev proves the code change is correct across desktop, tablet, and mobile. Shows "Verified ✅" or "Needs Review ⚠️".

### Deliverables
✅ AST parsing for React/JSX files  
✅ Syntax validation  
✅ TypeScript type checking  
✅ Viewport simulation (desktop, tablet, mobile)  
✅ Property value re-reading after changes  
✅ Before/after evidence capture  
✅ Verification verdict logic  
✅ Visual regression detection  

### Why This Phase
Code can be syntactically correct but visually wrong. **Redev's differentiator is proving results are correct, not just plausible.** This requires re-reading computed values and comparing them to what was requested.

### Success Criteria
- [ ] AST correctly parses React/JSX files
- [ ] Syntax errors detected in generated code
- [ ] TypeScript type checker runs successfully
- [ ] Can simulate 3 viewports (desktop 1440px, tablet 768px, mobile 375px)
- [ ] Can capture screenshot or computed styles per viewport
- [ ] Requested property values can be re-read from DOM
- [ ] Verdict is "Verified" only if ALL requested checks pass at ALL required viewports
- [ ] Verdict is "Needs Review" if any check fails or viewport is unavailable
- [ ] Never shows false positives (confident but wrong)
- [ ] Evidence (before/after values) displays with verdict
- [ ] **Test**: Make 10 property changes, verify verdicts are accurate; test viewport simulation

### What It Unblocks
- ✅ Phase 5: Integration + polish work can now test full loop

### Files Created
```
backend/src/services/
  ├── ASTParser.ts                   # TypeScript compiler API wrapper
  ├── SyntaxValidator.ts             # Checks code syntax
  ├── TypeChecker.ts                 # Runs TypeScript compiler
  ├── FixtureGenerator.ts            # Creates test fixtures
  ├── ComponentTester.ts             # Renders components
  ├── PropertyReader.ts              # Reads computed values from DOM
  ├── ViewportSimulator.ts           # Desktop/tablet/mobile presets
  ├── RegressionDetector.ts          # Compares before/after
  └── VerificationEngine.ts          # Orchestrates all checks

frontend/src/components/
  ├── VerificationStatus.tsx         # Shows Verified/Needs Review
  ├── EvidenceDisplay.tsx            # Shows before/after values
  └── ViewportPreview.tsx            # Desktop/tablet/mobile previews
```

### Effort Estimate
**~100 hours** (1 senior engineer + 1 mid-level, 2.5 weeks)

---

## 🎨 Phase 5: Polish & Alpha Release (Weeks 9-10)

### What We're Building
Production-ready code with error handling, performance optimization, complete testing, and documentation.

### Deliverables
✅ Comprehensive error handling  
✅ Performance optimization (caching, memoization)  
✅ End-to-end test suite  
✅ Integration tests  
✅ User documentation  
✅ API documentation  
✅ Demo video (60 seconds)  
✅ Public repository  
✅ Install instructions  
✅ Troubleshooting guide  

### Why This Phase
MVP works but may crash or be slow. Shipping requires stability, docs, and evidence that it works.

### Success Criteria
- [ ] Backend errors caught and logged with helpful messages
- [ ] Frontend shows user-friendly error messages
- [ ] Context caching hits >70% of lookups
- [ ] Initial context load < 500ms
- [ ] UI re-renders complete < 16ms
- [ ] E2E tests pass for complete click→edit→verify loop
- [ ] Integration tests pass for all component interactions
- [ ] README is clear and complete
- [ ] API docs list all MCP tools with examples
- [ ] User guide covers common workflows
- [ ] Demo video shows full loop in <60 seconds
- [ ] One-command install works on a fresh machine
- [ ] **Test**: Fresh install → first successful edit in <10 minutes

### What It Unblocks
- ✅ Alpha release to users

### Files Created
```
backend/src/services/
  ├── ErrorHandler.ts                # Centralized error handling
  └── CacheManager.ts                # Caching strategy

frontend/src/
  ├── components/ErrorBoundary.tsx   # React error boundary
  └── services/ErrorService.ts       # Frontend error display

tests/
  ├── e2e/
  │   └── redev.test.ts              # Full loop tests
  └── integration/
      └── components.test.ts         # Component interaction tests

docs/
  ├── REDEV_GUIDE.md                 # User guide
  ├── API.md                         # API reference
  ├── TROUBLESHOOTING.md             # Common issues
  └── INSTALL.md                     # Setup instructions

root/
  └── DEMO.md                        # How to record demo
```

### Effort Estimate
**~60 hours** (1 mid-level engineer + QA, 1.5 weeks)

---

## 📊 Timeline Summary

| Phase | Duration | Key Outcome | Status |
|-------|----------|-------------|--------|
| 1: Foundation | Weeks 1-2 | Click elements, get metadata | 🔄 Ready to start |
| 2: Framework | Weeks 3-4 | Map to React components + Tailwind | 🔄 Blocked on Phase 1 |
| 3: Generation | Weeks 5-6 | Claude Code edits source | 🔄 Blocked on Phase 2 |
| 4: Verification | Weeks 7-8 | Prove changes across viewports | 🔄 Blocked on Phase 3 |
| 5: Polish | Weeks 9-10 | Production-ready + docs | 🔄 Blocked on Phase 4 |

**Total: ~10 weeks to MVP**

---

## 🚦 What Blocks Each Phase

### Phase 1 Blockers
- None (foundation layer)

### Phase 2 Blockers
- ✋ Phase 1 **must** be stable (element detection must be reliable)
- ✋ Source maps must be available (most frameworks provide them)

### Phase 3 Blockers
- ✋ Phase 2 **must** be accurate (wrong mapping = wrong file edit)
- ✋ MCP spec must be understood (Claude Code agent model)
- ✋ Design system must be extractable from project

### Phase 4 Blockers
- ✋ Phase 3 **must** work end-to-end (hot-reload must trigger)
- ✋ Viewport simulation must be reliable
- ✋ DOM property reading must work in test environment

### Phase 5 Blockers
- ✋ Phases 1-4 **must** work together without crashes

---

## 🎯 Success Metrics (By Phase)

### Phase 1
- ✅ No false positives (overlay never shows wrong element)
- ✅ Latency < 250ms (click to selection ready)

### Phase 2
- ✅ Source mapping accuracy ≥95%
- ✅ Zero silent false positives (never guess with confidence)

### Phase 3
- ✅ Generated code is syntactically valid ≥90%
- ✅ First valid edit < 5 minutes from click

### Phase 4
- ✅ Verified changes that are actually correct ≥90%
- ✅ False positives = 0 (CRITICAL)

### Phase 5
- ✅ First user gets from install to successful edit in <10 minutes
- ✅ Week-2 retention ≥40%

---

## 🤔 Why This Order?

**Can we skip phases or work in parallel?**

❌ **No.** Each phase depends on prior phases:

- Can't verify (Phase 4) without generated code (Phase 3)
- Can't generate code (Phase 3) without knowing what was clicked (Phase 2)
- Can't map clicks (Phase 2) without selecting them (Phase 1)
- Can't ship (Phase 5) without a working product (Phases 1-4)

**Early phases are high-risk:** Source mapping and verification are where bugs hide. If Phase 2 mapping is wrong, Claude Code edits the wrong file, and the whole product fails. **We must get these right before proceeding.**

---

## 📈 Dependencies Graph

```
Phase 1 (Foundation)
    ↓
Phase 2 (Framework Understanding)
    ↓
Phase 3 (Code Generation)
    ↓
Phase 4 (Verification)
    ↓
Phase 5 (Polish & Release)
```

**Linear dependency chain. No parallel work between phases.**

---

## 🔄 If We Get Stuck

- **Phase 1 blocked:** Vite plugin API issue? Switch test framework or get help from Vite maintainers
- **Phase 2 blocked:** Source mapping unreliable? Reduce confidence threshold or limit to simpler projects first
- **Phase 3 blocked:** Claude Code integration issue? Test MCP separately before proceeding
- **Phase 4 blocked:** Verification unreliable? Fall back to "manual review" until reliability improves
- **Phase 5 blocked:** Shipping issue? Do internal testing before public alpha

---

## 📝 What's Next?

→ Read **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** for the exact step-by-step tasks within each phase.

→ Read **[ARCHITECTURE.md](./ARCHITECTURE.md)** for system design details.
