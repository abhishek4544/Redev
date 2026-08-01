# Redev Implementation Plan - Detailed Task Breakdown

> **Step-by-step tasks for engineering teams. Each task shows: what to build, why, dependencies, success criteria, and what it unblocks.**

---

## 🚀 Quick Navigation

- **[Tasks 1-4](#foundation-layer-tasks-1-4)** - Foundation (dev-server, overlay, framework adapter, MCP)
- **[Tasks 5-7](#context-layer-tasks-5-7)** - Context (code extraction, design system, prompts)
- **[Tasks 8-12](#verification--generation-layer-tasks-8-12)** - Verification & generation (AST, validation, verification, generation, file writing)
- **[Tasks 13-15](#ui--integration-layer-tasks-13-15)** - Frontend UI (edit controls, prompt, diff display)
- **[Tasks 16-18](#hardening-layer-tasks-16-18)** - Polish (error handling, performance, testing)

---

# FOUNDATION LAYER (Tasks 1-4)

## Task 1: Dev-Server Integration Foundation

### What We're Building
A Vite plugin that intercepts requests and injects metadata into the DOM, enabling element identification.

### Why This First
Every other component depends on intercepting the dev server and detecting what the user clicks. **This is the foundational communication channel.**

### Dependencies
- None (foundational)

### Success Criteria
- [ ] Dev server starts with Redev integration active
- [ ] HTML assets are modified before serving to add data attributes
- [ ] Metadata injection adds <500ms to page load time
- [ ] No console errors from the plugin
- [ ] Plugin can be toggled on/off without restarting server
- [ ] **Test**: Serve a React app through Vite + Redev plugin, inspect HTML, verify data attributes present

### What It Unblocks
- ✅ Task 2: Overlay needs metadata to identify elements
- ✅ Task 3: Framework adapter reads injected metadata
- ✅ Task 4: MCP server needs metadata in payloads

### Files to Create
```
backend/src/plugins/
  └── dev-server-plugin.ts

backend/src/services/
  └── asset-interceptor.ts
  └── metadata-injector.ts

backend/src/utils/
  └── metadata.ts (helpers for data attribute formatting)

backend/src/types/
  └── plugin.ts (TypeScript types)
```

### Implementation Steps

**Step 1.1:** Create Vite plugin entry point
```typescript
// backend/src/plugins/dev-server-plugin.ts
import { Plugin } from 'vite'

export default function redevPlugin(): Plugin {
  return {
    name: 'redev-plugin',
    apply: 'serve',
    // Configure transformations here
  }
}
```

**Step 1.2:** Implement HTML transformation
```typescript
// Transform HTML to inject data attributes
// <div class="btn">Click</div> becomes
// <div class="btn" data-redev-id="xyz" data-redev-component="Button">
```

**Step 1.3:** Track injected IDs
```typescript
// Keep mapping of ID → source location for later lookup
// { "xyz": { file: "Button.tsx", line: 42, column: 10 } }
```

**Step 1.4:** Handle hot-reload
```typescript
// Ensure metadata persists through dev server hot-reloads
// Re-inject on every rebuild
```

### Effort Estimate
**~8-10 hours** (1 engineer)

### Key Risks
- Plugin performance: transformation shouldn't slow dev server
- ID collisions: ensure unique IDs across renders
- Hot-reload: metadata can get out of sync with source

### Testing
```bash
# Manual test
npm run dev  # Start backend
# Open browser, inspect HTML
# Verify data-redev-* attributes present

# Automated test (if time allows)
# Render React component, verify attributes
```

---

## Task 2: Browser Overlay Architecture

### What We're Building
A React overlay that detects element hovers, highlights them visually, and captures click events.

### Why This Phase
Users need to be able to click on visual elements. The overlay must be invisible and never break page interaction.

### Dependencies
- Task 1: Needs metadata-injected HTML to read from

### Success Criteria
- [ ] Overlay renders without blocking page interaction
- [ ] Hovering over elements shows highlight outline
- [ ] Clicking an element captures: tagName, classes, id, coordinates, data attributes
- [ ] Selected element stays highlighted until re-clicking
- [ ] Overlay can be toggled on/off with keyboard shortcut (e.g., Cmd+Shift+E)
- [ ] No layout shift or style bleeding into page
- [ ] Shadow DOM isolation prevents style conflicts
- [ ] Performance: overlay interactions should be <16ms per frame
- [ ] **Test**: Toggle overlay on, hover 10 elements, click 5, verify data captured correctly

### What It Unblocks
- ✅ Task 3: Framework adapter needs element data from clicks
- ✅ Task 5: Context composer receives selected element
- ✅ Task 13: Frontend UI needs overlay foundation

### Files to Create
```
frontend/src/overlay/
  ├── OverlayManager.tsx        # Main component & lifecycle
  ├── ElementHighlighter.tsx    # Renders visual highlights
  ├── EventCapture.ts           # Click/hover listener logic
  └── OverlayPortal.tsx         # Shadow DOM wrapper

frontend/src/hooks/
  └── useOverlayState.ts        # React state hook

frontend/src/types/
  └── overlay.ts                # Type definitions

frontend/src/styles/
  └── overlay.css               # Styles (must be isolated)

frontend/src/
  └── index.tsx                 # Register overlay on page load
```

### Implementation Steps

**Step 2.1:** Create overlay mount point
```typescript
// frontend/index.tsx
// Mount overlay into shadow DOM on page load
const host = document.createElement('div')
document.body.appendChild(host)
const root = ReactDOM.createRoot(host, { shadow: true })
root.render(<OverlayManager />)
```

**Step 2.2:** Implement element detection
```typescript
// frontend/src/overlay/EventCapture.ts
// Listen for mouseover on document
// Track hovered element
// Read data attributes from Task 1
```

**Step 2.3:** Render highlights
```typescript
// frontend/src/overlay/ElementHighlighter.tsx
// Calculate element bounding rect
// Render DIV with border outline at that position
// Match browser dev tools styling
```

**Step 2.4:** Handle clicks
```typescript
// Capture click event
// Freeze selection
// Send element data to backend
// Display inspector panel with data
```

### Effort Estimate
**~12-15 hours** (1 engineer)

### Key Risks
- Shadow DOM browser compatibility (older browsers)
- Mouse event conflicts with host page
- Z-index issues if page has high stacking contexts

### Testing
```bash
npm run dev  # Start frontend
# Enable overlay (Cmd+Shift+E)
# Hover over elements, verify outlines appear
# Click element, verify data captured
# Check console for errors
```

---

## Task 3: Framework Adapter - React + Tailwind Detection

### What We're Building
A service that maps clicked DOM elements back to React component source code and identifies Tailwind classes.

### Why Here
Now that we can detect elements, we need to understand React structure. This adapter translates DOM elements → source code.

### Dependencies
- Task 1: Needs metadata-injected HTML
- Task 2: Needs element data from overlay

### Success Criteria
- [ ] Can identify React component file from element's data-redev-id
- [ ] Correctly maps element to source file with ≥95% accuracy
- [ ] Extracts all Tailwind classes and converts to Tailwind utility names
- [ ] Extracts visible React props from element attributes
- [ ] Provides confidence score on mapping (0-1)
- [ ] Never shows uncertain mapping as certain (always visible confidence indicator)
- [ ] Handles edge cases: nested components, higher-order components, hooks
- [ ] Performance: mapping should complete in <250ms
- [ ] **Test**: Click 10 different elements in a multi-component React app, verify ≥95% correct file identification and confidence scores

### What It Unblocks
- ✅ Task 5: Context composer needs file paths for source extraction
- ✅ Task 6: Design system extraction needs Tailwind class detection
- ✅ Task 13: Frontend inspector can show component details

### Files to Create
```
backend/src/adapters/
  ├── ReactAdapter.ts           # React-specific logic
  └── TailwindAdapter.ts        # Tailwind class parsing

backend/src/services/
  ├── SourceMapper.ts           # DOM element → file mapping
  ├── PropExtractor.ts          # React props from element
  └── ConfidenceCalculator.ts   # Scoring confidence

backend/src/types/
  └── framework.ts              # Types for mapping results

backend/utils/
  └── sourcemap.ts              # Source map reading
```

### Implementation Steps

**Step 3.1:** Read injected metadata
```typescript
// backend/src/services/SourceMapper.ts
// Extract data-redev-id from element
// Look up ID in metadata mapping from Task 1
// Return: { file, line, column }
```

**Step 3.2:** Verify source file exists
```typescript
// Read actual source file from disk
// Verify component is exported
// Check for TypeScript/JSX errors
```

**Step 3.3:** Extract Tailwind classes
```typescript
// backend/src/adapters/TailwindAdapter.ts
// Parse element's className attribute
// Split into individual classes
// Validate against Tailwind config
// Return: { utility, value, type: 'spacing' | 'color' | etc }
```

**Step 3.4:** Calculate confidence
```typescript
// Score based on:
// - Metadata presence (high confidence if present)
// - Component uniqueness (low confidence if multiple matches)
// - Recent changes to file (medium confidence if recently edited)
```

### Effort Estimate
**~15-18 hours** (1 engineer)

### Key Risks
- Source maps can be outdated or incorrect
- Tailwind customizations not in default config
- React component patterns that don't match expectations
- Dynamic class names (hard to identify)

### Testing
```bash
# Create test React component with known classes
# Click element
# Verify correct file, line, and Tailwind classes identified
# Test edge cases (HOCs, hooks, etc)
```

---

## Task 4: MCP Agent Bridge Setup

### What We're Building
An MCP (Model Context Protocol) server that Claude Code can connect to and call tools.

### Why Now
Before we generate code, we need the communication protocol ready. This enables Claude Code to retrieve context and make edits.

### Dependencies
- Task 3: Needs framework adapter for context data

### Success Criteria
- [ ] MCP server starts on a known port (e.g., 3001)
- [ ] Claude Code can connect and list available tools
- [ ] Tools have clear, well-documented schemas
- [ ] Tool calls return structured data (not strings)
- [ ] Token counter accurately estimates usage
- [ ] Errors in tool execution are caught and reported
- [ ] Server can handle multiple concurrent tool calls
- [ ] Performance: tool response <2 seconds
- [ ] **Test**: Connect Claude Code client, verify tools available, call a tool, verify response

### What It Unblocks
- ✅ Task 5: Context composer needs to format for MCP
- ✅ Task 7: Prompt engineering needs to know MCP tool signatures
- ✅ Task 11: Code generation calls MCP tools

### Files to Create
```
backend/src/mcp/
  ├── RedevServer.ts            # MCP server implementation
  ├── types/
  │   └── index.ts              # MCP message types
  └── tools/
      ├── GetContextTool.ts      # Returns full context
      ├── GenerateCodeTool.ts    # Calls LLM to generate code
      └── VerifyChangesTool.ts   # Triggers verification

backend/src/services/
  └── TokenCounter.ts           # Estimates token usage

backend/src/
  └── mcp-server.ts             # Server entry point
```

### Implementation Steps

**Step 4.1:** Set up MCP server
```typescript
// backend/src/mcp-server.ts
import { MCPServer } from "@modelcontextprotocol/sdk/server/mcp.js"

const server = new MCPServer({
  name: "redev",
  version: "0.1.0",
})
```

**Step 4.2:** Define tool schemas
```typescript
// backend/src/mcp/tools/GetContextTool.ts
export const getContextToolSchema = {
  name: "get_context",
  description: "Get context for a selected element",
  inputSchema: {
    type: "object",
    properties: {
      elementId: { type: "string" },
      task: { type: "string" }
    },
    required: ["elementId", "task"]
  }
}
```

**Step 4.3:** Implement tool handlers
```typescript
// Handle GetContext calls
// Return: { selectedFile, relatedFiles, design, task, examples }
```

**Step 4.4:** Add token tracking
```typescript
// backend/src/services/TokenCounter.ts
// Track tokens in request and response
// Warn if approaching limit
```

### Effort Estimate
**~10-12 hours** (1 engineer)

### Key Risks
- MCP spec changes (but currently stable)
- Token estimation inaccuracy
- Tool timeouts (slow context retrieval)

### Testing
```bash
# Start MCP server
npm run mcp-server

# In separate terminal, test with Claude Code or mcp-client CLI
mcp-client ws://localhost:3001
# Call GetContext tool
# Verify response format and token count
```

---

# CONTEXT LAYER (Tasks 5-7)

## Task 5: Context Composer - Code Extraction

### What We're Building
A service that reads source files, builds dependency graphs, and extracts only relevant code for Claude to edit.

### Why Here
Now we can identify elements (Task 3) and have MCP ready (Task 4). Context composer pulls it together.

### Dependencies
- Task 3: Framework adapter identifies files
- Task 4: MCP defines what context format looks like

### Success Criteria
- [ ] Can read source files from disk (with caching)
- [ ] Builds accurate dependency graph (component A imports B imports C)
- [ ] Includes related components (if editing Button, include ButtonGroup)
- [ ] Extracts imports and exports correctly
- [ ] Context stays within token limits (<4000 tokens for context)
- [ ] Cache hit rate >70% on repeated reads
- [ ] No circular dependencies in extracted context
- [ ] Handles TypeScript/JSX syntax correctly
- [ ] Performance: extract context in <500ms
- [ ] **Test**: Select element in multi-file component tree, verify context includes all necessary files

### What It Unblocks
- ✅ Task 6: Design system extraction extends this
- ✅ Task 7: Prompt engineering uses this context
- ✅ Task 11: Code generation uses this context

### Files to Create
```
backend/src/services/
  ├── ContextComposer.ts        # Main orchestrator
  ├── FileReader.ts             # File I/O with caching
  ├── DependencyAnalyzer.ts     # Builds import graph
  ├── ContextOptimizer.ts       # Fits within token limits
  └── CacheManager.ts           # LRU cache for files

backend/src/types/
  └── context.ts                # Context structure types

backend/src/utils/
  └── parser.ts                 # Code parsing helpers
```

### Implementation Steps

**Step 5.1:** Implement file reader with caching
```typescript
// backend/src/services/FileReader.ts
class FileReader {
  private cache = new Map<string, string>()
  
  read(filePath: string): string {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    this.cache.set(filePath, content)
    return content
  }
}
```

**Step 5.2:** Build dependency analyzer
```typescript
// backend/src/services/DependencyAnalyzer.ts
// Parse imports from file
// Recursively find related files
// Stop at node_modules boundaries
```

**Step 5.3:** Implement context optimization
```typescript
// Keep most relevant files
// Drop duplicates and less relevant code
// Ensure total tokens < limit
```

**Step 5.4:** Assemble context structure
```typescript
// Return: {
//   selectedFile: { path, content, line, column },
//   relatedFiles: [{ path, content }],
//   imports: [...],
//   exports: [...]
// }
```

### Effort Estimate
**~14-16 hours** (1 engineer)

### Key Risks
- Dependency graph can have circular refs
- Token estimation accuracy
- Cache invalidation (stale files after edits)

### Testing
```bash
# Select element in React component
# Request context
# Verify includes component file and imports
# Check total tokens
```

---

## Task 6: Context Composer - Design System Extraction

### What We're Building
Extract Tailwind config, design tokens, and component library patterns so Claude Code can generate code that matches the project's design.

### Why After Code Extraction
We need the context composer infrastructure first; this extends it.

### Dependencies
- Task 5: Context composer needs to locate files
- Task 3: Needs Tailwind class detection

### Success Criteria
- [ ] Reads and parses tailwind.config.js correctly
- [ ] Extracts colors, spacing, typography, sizing tokens
- [ ] Identifies custom components in component library
- [ ] Detects common patterns (button sizes, card layouts)
- [ ] Provides examples of how components are used
- [ ] Performance: extract design system in <300ms
- [ ] **Test**: Analyze a real project, verify tokens and patterns correctly extracted

### What It Unblocks
- ✅ Task 7: Prompt engineering uses design system in examples

### Files to Create
```
backend/src/services/
  ├── DesignSystemExtractor.ts  # Main extractor
  ├── TokenExtractor.ts         # Tailwind tokens
  ├── ComponentLibraryAnalyzer.ts # Scans components
  └── PatternDetector.ts        # Common patterns

backend/src/types/
  └── design.ts                 # Design system types
```

### Implementation Steps

**Step 6.1:** Parse Tailwind config
```typescript
// Read tailwind.config.js
// Extract theme.colors, theme.spacing, theme.fontSize
// Handle extends and custom configs
```

**Step 6.2:** Scan component library
```typescript
// List files in components/ directory
// Extract component names and basic usage
// Build library index
```

**Step 6.3:** Detect patterns
```typescript
// Look for: button sizes (sm, md, lg)
// Look for: color variants (primary, secondary)
// Look for: layout patterns (flex-center, grid-auto)
```

**Step 6.4:** Package for context
```typescript
// Return design system as structured data
// Include examples: "buttons usually use px-4 py-2"
```

### Effort Estimate
**~10-12 hours** (1 engineer)

### Key Risks
- Tailwind config non-standard or extends multiple configs
- Component library naming inconsistency

### Testing
```bash
# Extract design system from sample project
# Verify colors, spacing, components identified
```

---

## Task 7: Agent Prompt Engineering

### What We're Building
System prompts and examples that guide Claude Code to generate correct edits using the context we provide.

### Why After Context Extraction
Now we know what context is available; design prompts to use it effectively.

### Dependencies
- Task 5: Needs to understand context structure
- Task 6: Needs to reference design system

### Success Criteria
- [ ] System prompt is clear and well-structured
- [ ] Few-shot examples cover common edit types (color, spacing, typography)
- [ ] Examples include component names and existing patterns
- [ ] Prompt directs Claude to use design tokens (not magic values)
- [ ] Prompt includes error handling (what to do if component not found)
- [ ] Chain-of-thought prompts for complex edits
- [ ] Total prompt + context stays within token limits
- [ ] **Test**: Generate prompts for 5 different tasks, verify they're coherent and actionable

### What It Unblocks
- ✅ Task 11: Code generation uses these prompts

### Files to Create
```
backend/src/prompts/
  ├── system.prompt.ts          # Main system prompt template
  ├── examples.ts               # Few-shot examples
  ├── cot.prompt.ts             # Chain-of-thought templates
  └── PromptBuilder.ts          # Assembles final prompts

backend/src/types/
  └── prompt.ts                 # Prompt structure types
```

### Implementation Steps

**Step 7.1:** Write system prompt
```
You are Redev, an AI assistant for editing React + Tailwind CSS code.

The user has selected a UI element and requested a change. You will:
1. Understand the component structure (imports, dependencies)
2. Identify the exact code to modify
3. Make the minimal change needed
4. Use existing patterns and design tokens

Design tokens available:
- Colors: primary, secondary, neutral-100, etc.
- Spacing: xs (2px), sm (4px), md (8px), etc.

Always use Tailwind utilities, not inline styles.
Always preserve component structure and props.
```

**Step 7.2:** Create few-shot examples
```
Example 1: Increase padding
  Selected: Button component
  Request: "increase padding"
  Change: className="px-2 py-1" → className="px-4 py-2"

Example 2: Change color
  Selected: Card component
  Request: "make text red"
  Change: className="text-gray-900" → className="text-red-600"
```

**Step 7.3:** Add error handling
```
If you can't find the component, ask the user for clarification.
If the change breaks syntax, report the error.
Never make multiple unrelated changes in one edit.
```

**Step 7.4:** Build prompt assembly
```typescript
// backend/src/prompts/PromptBuilder.ts
class PromptBuilder {
  buildPrompt(
    context: Context,
    designSystem: DesignSystem,
    userRequest: string
  ): string {
    return `${SYSTEM_PROMPT}

Context:
${context}

Design Tokens:
${designSystem}

User Request: ${userRequest}
`
  }
}
```

### Effort Estimate
**~8-10 hours** (1 engineer, may need iteration)

### Key Risks
- Prompts too verbose (exceed token limits)
- Examples don't match real projects
- Claude generates multiple changes when asked for one
- Claude doesn't use design tokens

### Testing
```bash
# Build prompts for different scenarios
# Manually review coherence
# Count tokens
# Later: test with Claude Code and measure accuracy
```

---

# VERIFICATION & GENERATION LAYER (Tasks 8-12)

## Task 8: Verification Engine - AST Parser

### What We're Building
A parser that converts React/JSX/TypeScript code into an Abstract Syntax Tree (AST) so we can validate syntax and extract structure.

### Why Here
Before verifying changes, we need to understand code structure deeply.

### Dependencies
- Task 5: Needs file reader to get source code

### Success Criteria
- [ ] Correctly parses valid React/JSX files
- [ ] Correctly parses TypeScript files
- [ ] Extracts component structure (props, state, renders)
- [ ] Tracks imports and exports accurately
- [ ] Handles edge cases (async components, forwardRef, etc.)
- [ ] Can traverse AST to find specific nodes
- [ ] Error messages are clear when parsing fails
- [ ] Performance: parse file in <100ms
- [ ] **Test**: Parse 10 real React component files, verify AST structure

### What It Unblocks
- ✅ Task 9: Syntax validation uses AST
- ✅ Task 10: Runtime testing uses AST

### Files to Create
```
backend/src/services/
  ├── ASTParser.ts              # Main parser wrapper
  └── ASTUtils.ts               # AST traversal helpers

backend/src/types/
  └── ast.ts                    # AST node types
```

### Implementation Steps

**Step 8.1:** Set up TypeScript compiler
```typescript
// backend/src/services/ASTParser.ts
import * as ts from 'typescript'

class ASTParser {
  parse(sourceCode: string): ts.SourceFile {
    return ts.createSourceFile(
      'temp.tsx',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    )
  }
}
```

**Step 8.2:** Extract component info
```typescript
// Find component function/class definitions
// Extract component name, props, return type
// Track JSX elements
```

**Step 8.3:** Build traversal helpers
```typescript
// Helper functions to walk AST
// Find imports, exports, JSX elements
// Extract specific node types
```

### Effort Estimate
**~8-10 hours** (1 engineer)

### Key Risks
- TypeScript compiler errors hard to debug
- JSX syntax complexity
- Performance on large files

### Testing
```bash
# Parse sample React components
# Verify component structure extracted correctly
# Test edge cases (hooks, HOCs, etc)
```

---

## Task 9: Verification Engine - Syntax & Type Checking

### What We're Building
Validators that check generated code for syntax errors and TypeScript type issues.

### Why After AST Parser
Now we can traverse AST and validate against it.

### Dependencies
- Task 8: Uses AST parser
- Task 3: Needs to understand component props

### Success Criteria
- [ ] Detects syntax errors in generated code
- [ ] Catches missing imports
- [ ] Validates component prop types
- [ ] Checks for undefined variables
- [ ] TypeScript type checking passes
- [ ] Error messages are actionable
- [ ] Performance: check file in <300ms
- [ ] **Test**: Feed valid and invalid code, verify correct detection

### What It Unblocks
- ✅ Task 10: Runtime verification depends on this
- ✅ Task 11: Code generation needs to ensure output passes checks

### Files to Create
```
backend/src/services/
  ├── SyntaxValidator.ts        # Syntax checking
  ├── TypeChecker.ts            # TypeScript type checking
  ├── ImportValidator.ts        # Import validation
  └── PropValidator.ts          # Component prop validation
```

### Implementation Steps

**Step 9.1:** Syntax validation
```typescript
// backend/src/services/SyntaxValidator.ts
// Use AST parser - if it fails, syntax is invalid
// Provide user-friendly error messages
```

**Step 9.2:** Type checking
```typescript
// backend/src/services/TypeChecker.ts
// Run TypeScript compiler diagnostic check
// Collect all errors and warnings
```

**Step 9.3:** Import validation
```typescript
// Check all imports exist
// Verify paths are correct (relative vs absolute)
```

**Step 9.4:** Prop validation
```typescript
// Extract component prop types from source
// Validate that edits don't break props
```

### Effort Estimate
**~10-12 hours** (1 engineer)

### Key Risks
- TypeScript errors hard to parse
- Type system complexity
- Performance on large codebases

### Testing
```bash
# Test syntax validation with invalid code
# Test type checking with TypeScript errors
# Verify error messages are clear
```

---

## Task 10: Verification Engine - Runtime Testing

### What We're Building
A test fixture system that renders components in a test environment and verifies changes actually happened.

### Why After Type Checking
Type checking happens before runtime; runtime tests use that output.

### Dependencies
- Tasks 8-9: Need AST and type validation first
- Task 3: Need to know what element to test

### Success Criteria
- [ ] Generates valid test fixtures (React components)
- [ ] Renders fixtures in a test environment
- [ ] Captures screenshots at multiple viewports
- [ ] Reads computed DOM properties (padding, color, size)
- [ ] Detects visual changes accurately
- [ ] Can compare before/after renders
- [ ] Handles async rendering (wait for updates)
- [ ] Performance: run full test in <5 seconds
- [ ] **Test**: Generate fixture, make change, verify detected correctly

### What It Unblocks
- ✅ Task 11: Code generation needs verification results
- ✅ Task 13: Frontend displays verification verdicts

### Files to Create
```
backend/src/services/
  ├── FixtureGenerator.ts       # Create test React components
  ├── ComponentTester.ts        # Render and test
  ├── PropertyReader.ts         # Read computed CSS values
  ├── ViewportSimulator.ts      # Desktop/tablet/mobile
  └── RegressionDetector.ts     # Compare before/after

backend/tests/
  └── fixtures/                 # Test component definitions
```

### Implementation Steps

**Step 10.1:** Generate test fixtures
```typescript
// backend/src/services/FixtureGenerator.ts
// Create minimal test wrapper around component
// Set up props and render context
// Example:
// <Button className="px-2 py-1">Click me</Button>
```

**Step 10.2:** Render in test environment
```typescript
// Use jsdom or similar to create fake DOM
// Render React component
// Wait for render to complete
```

**Step 10.3:** Read computed properties
```typescript
// backend/src/services/PropertyReader.ts
// After render, read element's computed styles
// Get padding, margin, color, size, etc.
// Return actual values
```

**Step 10.4:** Simulate viewports
```typescript
// backend/src/services/ViewportSimulator.ts
// Desktop: 1440px width
// Tablet: 768px width
// Mobile: 375px width
// Re-render for each and capture properties
```

**Step 10.5:** Detect regressions
```typescript
// Compare before-edit and after-edit renders
// Identify visual changes
// Return: { changed: true, properties: {...} }
```

### Effort Estimate
**~18-20 hours** (1-2 engineers)

### Key Risks
- DOM rendering complexity (async effects, animations)
- Viewport simulation accuracy
- Browser API availability in test environment
- Performance (multiple renders can be slow)

### Testing
```bash
# Create test component
# Render and read properties
# Modify and re-render
# Verify changes detected
```

---

## Task 11: Code Generation Engine

### What We're Building
A service that calls Claude Code to generate edits, formats the output, and prepares it for verification.

### Why After Verification Infrastructure
We need verification tools ready before generating code that needs to be verified.

### Dependencies
- Task 4: MCP bridge for calling Claude Code
- Task 7: Prompts for guiding generation
- Task 5: Context to send to Claude

### Success Criteria
- [ ] Calls Claude Code agent with proper context
- [ ] Generated code is syntactically valid
- [ ] Code follows project style (indentation, quotes, etc.)
- [ ] Diffs are accurate and readable
- [ ] Handles multi-file edits (if needed)
- [ ] Errors from Claude are caught and reported
- [ ] Performance: generation completes in <10 seconds
- [ ] **Test**: Request 5 changes, verify generated code is valid

### What It Unblocks
- ✅ Task 12: File writing applies generated changes
- ✅ Task 13: Frontend displays generated diffs

### Files to Create
```
backend/src/services/
  ├── CodeGenerator.ts          # Main generation orchestrator
  ├── DiffCalculator.ts         # Compute diffs
  └── CodeFormatter.ts          # Format with Prettier

backend/src/
  └── agents/                   # Agent interaction layer
      └── ClaudeCodeAgent.ts
```

### Implementation Steps

**Step 11.1:** Call Claude Code
```typescript
// backend/src/services/CodeGenerator.ts
// Use MCP tool to get context
// Call Claude Code with prompt + context
// Stream or wait for response
```

**Step 11.2:** Parse generated code
```typescript
// Extract code from Claude's response
// Validate syntax (using Task 9)
// Handle if Claude returns explanation + code
```

**Step 11.3:** Calculate diffs
```typescript
// backend/src/services/DiffCalculator.ts
// Compare original vs generated code
// Use diff-match-patch or similar
// Format as readable diff
```

**Step 11.4:** Format code
```typescript
// backend/src/services/CodeFormatter.ts
// Run Prettier on generated code
// Match project's formatting (eslint config)
```

### Effort Estimate
**~12-14 hours** (1 engineer)

### Key Risks
- Claude generates invalid code
- Claude makes multiple unrelated changes
- Diff calculation accuracy
- Formatting style conflicts

### Testing
```bash
# Request change from Claude
# Verify generated code is valid
# Check diff output
```

---

## Task 12: Change Application & File Writing

### What We're Building
A service that safely writes generated changes to files, backs up originals, and triggers dev server reload.

### Why Last in Generation
Must be done only after verification passes.

### Dependencies
- Task 1: Dev server needs to reload
- Task 11: Generated code to apply

### Success Criteria
- [ ] Writes files atomically (no partial writes)
- [ ] Creates backups before overwriting
- [ ] Triggers dev server hot-reload
- [ ] Can rollback changes (via backup)
- [ ] Tracks change history
- [ ] Handles file permissions correctly
- [ ] No data loss (validates file exists before overwriting)
- [ ] Performance: write + reload in <2 seconds
- [ ] **Test**: Write change, verify file updated, verify browser reloads

### What It Unblocks
- ✅ Task 13: Frontend shows updated app
- ✅ Task 14: Can accept changes into git

### Files to Create
```
backend/src/services/
  ├── FileWriter.ts             # Atomic file writes
  ├── RollbackManager.ts       # Manages undo/history
  └── HotReloadTrigger.ts      # Signals dev server

backend/src/utils/
  └── backup.ts                # Backup utilities
```

### Implementation Steps

**Step 12.1:** Implement atomic write
```typescript
// backend/src/services/FileWriter.ts
// Write to temp file first
// Verify write successful
// Move to target location (atomic)
```

**Step 12.2:** Backup management
```typescript
// backend/src/services/RollbackManager.ts
// Keep last N backups in memory
// Provide rollback method
// Store backup metadata (timestamp, change description)
```

**Step 12.3:** Trigger reload
```typescript
// Use WebSocket or similar to notify dev server
// Dev server hot-reloads
// Browser refreshes
```

**Step 12.4:** Validate write
```typescript
// After write, read file back
// Verify content matches what we wrote
// If mismatch, revert
```

### Effort Estimate
**~8-10 hours** (1 engineer)

### Key Risks
- File system errors
- Permission issues
- Atomic write not guaranteed on all systems
- Hot-reload timing issues

### Testing
```bash
# Write change to file
# Verify file content correct
# Verify browser reloads
# Test rollback
```

---

# UI & INTEGRATION LAYER (Tasks 13-15)

## Task 13: Frontend UI - Edit Mode Controls

### What We're Building
The main UI components for entering edit mode, viewing element details, and managing the edit flow.

### Why Here
Backend infrastructure must be stable before building UI that depends on it.

### Dependencies
- Task 2: Overlay for element selection
- Task 12: Change application for executing edits

### Success Criteria
- [ ] "Edit Mode" button toggles edit mode on/off
- [ ] Selected element inspector shows: component name, file, Tailwind classes
- [ ] Visual feedback shows which element is selected
- [ ] Error states display clearly
- [ ] Loading states during context fetch
- [ ] Can deselect element and re-select
- [ ] Responsive design works on different screen sizes
- [ ] Performance: UI interactions <16ms per frame
- [ ] **Test**: Toggle edit mode, select element, verify UI updates correctly

### What It Unblocks
- ✅ Task 14: Prompt input extends this UI
- ✅ Task 15: Diff display extends this UI

### Files to Create
```
frontend/src/components/
  ├── EditModeToggle.tsx        # Edit mode button
  ├── ElementInspector.tsx      # Shows selected element info
  ├── SuggestionPanel.tsx       # AI suggestions (optional)
  └── EditPage.tsx              # Main edit mode layout

frontend/src/pages/
  └── EditPage.tsx              # Or move to pages/

frontend/src/hooks/
  ├── useEditMode.ts            # Edit mode state
  └── useSelectedElement.ts     # Selected element state

frontend/src/services/
  └── EditService.ts            # Backend communication

frontend/src/styles/
  └── edit-page.module.css      # Styles
```

### Implementation Steps

**Step 13.1:** Create edit mode toggle
```typescript
// frontend/src/components/EditModeToggle.tsx
// Button that calls backend to enable edit mode
// Visual indicator showing mode status
```

**Step 13.2:** Build element inspector
```typescript
// frontend/src/components/ElementInspector.tsx
// Display selected element info:
// - Component name
// - File path
// - Tailwind classes
// - Confidence score
// - Props (optional)
```

**Step 13.3:** Implement state management
```typescript
// frontend/src/hooks/useEditMode.ts
// Manage: enabled, loading, error states
// Manage: selected element data
```

**Step 13.4:** Handle errors
```typescript
// Show clear error messages
// Suggest recovery actions
// Disable UI appropriately
```

### Effort Estimate
**~10-12 hours** (1 engineer)

### Key Risks
- State management complexity
- Backend communication errors
- UI responsiveness (too many rerenders)

### Testing
```bash
npm run dev:frontend
# Toggle edit mode
# Select elements
# Verify UI displays correctly
```

---

## Task 14: Frontend UI - Prompt Input & Submission

### What We're Building
The UI for users to describe changes and submit them to Claude Code.

### Why After Edit Controls
Prompt input is part of the edit UI workflow.

### Dependencies
- Task 13: Edit mode UI foundation

### Success Criteria
- [ ] Textarea for free-form instruction input
- [ ] Submit button with loading state
- [ ] Can cancel in-flight requests
- [ ] Stores recent prompts in history
- [ ] Autocomplete suggestions (optional)
- [ ] Character count / token estimate
- [ ] Error handling if request fails
- [ ] Performance: responsive typing (<50ms latency)
- [ ] **Test**: Type prompt, submit, verify backend receives it

### What It Unblocks
- ✅ Task 15: Diff display shows results of prompt

### Files to Create
```
frontend/src/components/
  ├── PromptInput.tsx           # Input textarea + submit
  ├── PromptHistory.tsx         # Recent prompts
  └── TokenEstimate.tsx         # Token counter display

frontend/src/services/
  └── PromptService.ts          # Backend API calls

frontend/src/hooks/
  └── usePromptHistory.ts       # History management
```

### Implementation Steps

**Step 14.1:** Build prompt input
```typescript
// frontend/src/components/PromptInput.tsx
// Textarea with placeholder "describe the change..."
// Button to submit
```

**Step 14.2:** Handle submission
```typescript
// Call backend API with prompt + selected element
// Show loading state
// Handle errors
// Clear input on success
```

**Step 14.3:** Add history
```typescript
// Store prompts in localStorage
// Display recent prompts as suggestions
// Allow clicking to re-use
```

**Step 14.4:** Token estimation
```typescript
// Estimate tokens as user types
// Show running total
// Warn if approaching limit
```

### Effort Estimate
**~8-10 hours** (1 engineer)

### Key Risks
- Token estimation accuracy
- Input validation complexity
- State management

### Testing
```bash
# Type prompt and submit
# Verify backend receives correct data
# Test cancel functionality
# Check history storage
```

---

## Task 15: Frontend UI - Diff Display & Preview

### What We're Building
Display the generated code changes in a readable diff format and let users accept or reject.

### Why After Prompt Submission
Displays results of prompt submission.

### Dependencies
- Task 14: Receives diff from prompt submission

### Success Criteria
- [ ] Displays diff with syntax highlighting
- [ ] Before/after code side-by-side or unified view
- [ ] Accept button to confirm changes
- [ ] Reject button to discard
- [ ] Edit button to refine (send new prompt)
- [ ] Shows verification status (if ready)
- [ ] Error messages if generation failed
- [ ] Performance: syntax highlighting <200ms
- [ ] **Test**: Generate change, verify diff displays, accept/reject works

### What It Unblocks
- ✅ Task 16: Error handling for diff issues
- ✅ Task 17: Performance optimization of diff rendering

### Files to Create
```
frontend/src/components/
  ├── DiffViewer.tsx            # Main diff display
  ├── SyntaxHighlight.tsx       # Code highlighting
  ├── ApprovalPanel.tsx         # Accept/reject buttons
  └── VerificationStatus.tsx    # Shows verification results

frontend/src/services/
  └── DiffService.ts            # Diff formatting

frontend/src/styles/
  └── diff-viewer.module.css
```

### Implementation Steps

**Step 15.1:** Display diff
```typescript
// frontend/src/components/DiffViewer.tsx
// Format and display diff from backend
// Highlight added/removed lines
// Line numbers
```

**Step 15.2:** Add syntax highlighting
```typescript
// Use highlight.js or Prism
// Detect language (React/TypeScript)
// Color-code syntax
```

**Step 15.3:** Approval buttons
```typescript
// Accept: confirm changes and close
// Reject: discard and back to edit
// Edit: send new prompt to Claude
```

**Step 15.4:** Show verification status
```typescript
// If verification complete, show verdict
// Display evidence (before/after values)
// Show viewport results
```

### Effort Estimate
**~12-14 hours** (1 engineer)

### Key Risks
- Syntax highlighting performance
- Diff formatting complexity
- State management

### Testing
```bash
# Generate change
# Verify diff displays with highlighting
# Test accept/reject buttons
```

---

# HARDENING LAYER (Tasks 16-18)

## Task 16: Error Handling & Recovery

### What We're Building
Comprehensive error handling throughout the system with user-friendly messages and recovery paths.

### Why Here
Build robust error handling after core functionality works.

### Dependencies
- All previous tasks (handles errors from all components)

### Success Criteria
- [ ] No unhandled promise rejections
- [ ] All errors have user-friendly messages
- [ ] Error recovery suggestions provided
- [ ] Logging captures full error details
- [ ] Frontend displays errors clearly
- [ ] System continues working after errors
- [ ] No data loss on error
- [ ] **Test**: Trigger common errors, verify handling

### What It Unblocks
- ✅ Task 17: Performance optimization needs stable error handling
- ✅ Task 18: Testing depends on error handling

### Files to Create
```
backend/src/services/
  └── ErrorHandler.ts           # Centralized error handling

backend/src/utils/
  ├── ErrorMessages.ts          # User-facing messages
  ├── RecoverySuggestions.ts    # What to try next
  └── logging.ts                # Logging utility

frontend/src/services/
  └── ErrorService.ts           # Frontend error display

frontend/src/components/
  ├── ErrorBoundary.tsx         # React error boundary
  └── ErrorDisplay.tsx          # Error message UI
```

### Implementation Steps

**Step 16.1:** Centralize error handling
```typescript
// backend/src/services/ErrorHandler.ts
// Catch all errors
// Log with context
// Return structured error to client
```

**Step 16.2:** Create error messages
```typescript
// backend/src/utils/ErrorMessages.ts
// Map error types to user-friendly messages
// Example:
// ELEMENT_NOT_FOUND → "I couldn't find that element after reloading. Try clicking it again."
```

**Step 16.3:** Add recovery suggestions
```typescript
// backend/src/utils/RecoverySuggestions.ts
// Suggest what user should try next
// Example: File not writable? Check permissions.
```

**Step 16.4:** Frontend error UI
```typescript
// frontend/src/components/ErrorDisplay.tsx
// Show error message
// Show recovery suggestion
// Provide action button (Retry, etc.)
```

### Effort Estimate
**~8-10 hours** (1 engineer)

### Key Risks
- Missing error cases
- Messages not helpful
- Error logging too verbose or too sparse

### Testing
```bash
# Trigger errors at each layer
# Verify user-friendly messages appear
# Test recovery suggestions
```

---

## Task 17: Performance Optimization

### What We're Building
Optimize slow parts: caching, memoization, request batching.

### Why After Error Handling
Optimize stable, working code.

### Dependencies
- All previous tasks (optimization is additive)

### Success Criteria
- [ ] Context extraction < 500ms
- [ ] UI renders < 16ms per frame
- [ ] Cache hit rate > 70%
- [ ] Initial load < 2 seconds
- [ ] No memory leaks
- [ ] No excessive re-renders
- [ ] **Test**: Profile backend and frontend, verify targets met

### What It Unblocks
- ✅ Task 18: Testing uses optimized components

### Files to Create
```
backend/src/services/
  └── CacheManager.ts           # LRU cache

backend/src/utils/
  └── memoization.ts            # Memoization helpers

frontend/src/services/
  └── QueryOptimizer.ts         # Request batching
```

### Implementation Steps

**Step 17.1:** Implement caching
```typescript
// backend/src/services/CacheManager.ts
// LRU cache for frequently accessed data
// Cache file reads, AST parses, design system
```

**Step 17.2:** Add memoization
```typescript
// React hooks: useMemo, useCallback
// Prevent unnecessary re-renders
// Memoize expensive computations
```

**Step 17.3:** Batch requests
```typescript
// frontend/src/services/QueryOptimizer.ts
// Group API calls
// Reduce number of round-trips
```

**Step 17.4:** Profile and optimize
```bash
# Use Chrome DevTools to profile
# Flamegraph to find bottlenecks
# React DevTools to find re-renders
```

### Effort Estimate
**~10-12 hours** (1 engineer)

### Key Risks
- Premature optimization
- Cache invalidation bugs
- Memory usage growth

### Testing
```bash
# Profile with DevTools
# Measure performance metrics
# Verify targets met
```

---

## Task 18: Integration Testing & Documentation

### What We're Building
Complete end-to-end tests and comprehensive documentation.

### Why Last
Test complete system after optimization.

### Dependencies
- All previous tasks (tests all components)

### Success Criteria
- [ ] E2E tests cover main flow (click → edit → verify)
- [ ] Integration tests for component interactions
- [ ] Test coverage > 80% of critical paths
- [ ] README is clear and complete
- [ ] API documentation lists all MCP tools
- [ ] User guide covers common workflows
- [ ] Troubleshooting guide covers common issues
- [ ] One-command install works
- [ ] **Test**: Run full test suite, verify all pass

### What It Unblocks
- ✅ MVP release to alpha users

### Files to Create
```
tests/
  ├── e2e/
  │   └── redev.test.ts         # End-to-end tests
  └── integration/
      └── components.test.ts    # Component interaction tests

docs/
  ├── REDEV_GUIDE.md            # User guide
  ├── API.md                    # API reference
  ├── TROUBLESHOOTING.md        # Common issues
  ├── INSTALL.md                # Setup instructions
  └── CONTRIBUTING.md           # Dev guide

root/
  └── SETUP_LOCAL.md            # Local development
```

### Implementation Steps

**Step 18.1:** Write E2E tests
```typescript
// tests/e2e/redev.test.ts
// Test: Start app → Click element → Describe change → See diff → Accept
// Test: Verification shows correct verdict
// Test: Error handling works
```

**Step 18.2:** Write integration tests
```typescript
// tests/integration/components.test.ts
// Test: Adapter + Context Composer work together
// Test: Code Generator + Verification work together
// Test: Frontend + Backend communication
```

**Step 18.3:** Write documentation
```markdown
# User Guide
1. Install with: npm install && npm run redev:install
2. Start dev server
3. Enable edit mode in overlay
4. Click element
5. Describe change
6. Review diff
7. Accept and commit
```

**Step 18.4:** Create troubleshooting guide
```markdown
# Common Issues

Q: Edit mode button doesn't appear
A: Make sure Vite plugin is enabled. Check browser console for errors.

Q: Verification always shows "Needs Review"
A: Try restarting dev server. Check that element still exists in DOM.
```

### Effort Estimate
**~12-14 hours** (1 engineer + tech writer)

### Key Risks
- Tests flaky (timing issues)
- Documentation incomplete or outdated
- Setup instructions unclear

### Testing
```bash
# Run full test suite
npm run test

# Check coverage
npm run test:coverage

# Manually verify install works on fresh machine
```

---

# 🏁 Summary Table

| Task | Duration | Effort | Why This Order | Blocker For |
|------|----------|--------|----------------|------------|
| 1. Dev-Server Integration | 1 week | ~10h | Foundational | 2,3,4 |
| 2. Browser Overlay | 1-1.5 weeks | ~15h | Need selection | 3,5,13 |
| 3. Framework Adapter | 1.5 weeks | ~18h | Need identification | 5,6,13 |
| 4. MCP Agent Bridge | 1-1.5 weeks | ~12h | Parallel with 3 | 5,7,11 |
| 5. Context Composer - Code | 1.5 weeks | ~16h | Need adapter & MCP | 6,7,11 |
| 6. Context Composer - Design | 1 week | ~12h | After code extraction | 7 |
| 7. Prompt Engineering | 1 week | ~10h | After context | 11 |
| 8. AST Parser | 1 week | ~10h | Parallel start | 9,10 |
| 9. Syntax & Type Checking | 1-1.5 weeks | ~12h | After AST | 10,11 |
| 10. Runtime Testing | 1.5-2 weeks | ~20h | After type checking | 11,13 |
| 11. Code Generation | 1-1.5 weeks | ~14h | After prompt + verification | 12,13 |
| 12. File Writing & Reload | 1 week | ~10h | After code generation | 13 |
| 13. Edit Mode UI | 1-1.5 weeks | ~12h | After backend stable | 14,15 |
| 14. Prompt Input | 1 week | ~10h | After edit UI | 15 |
| 15. Diff Display | 1-1.5 weeks | ~14h | After prompt | 16 |
| 16. Error Handling | 1 week | ~10h | After all components | 17,18 |
| 17. Performance | 1-1.5 weeks | ~12h | After working system | 18 |
| 18. Testing & Docs | 1-1.5 weeks | ~14h | Last | Release |

**Total: ~40-50 days for one strong team**

---

## 🎯 How to Use This Plan

### For the Product Manager
- Use the summary table to track progress
- Each completed task unblocks others (shown in "Blocker For" column)
- Report blockers immediately if a task takes longer than estimate

### For the Engineering Lead
- Assign tasks in order (dependencies matter)
- Parallelize where possible (e.g., Tasks 8-9 while Task 7 finishes)
- Do code reviews at task boundaries
- Run integration tests after each task group

### For Individual Engineers
- Read the task description + dependencies
- Implement all files listed
- Validate against success criteria
- Communicate blockers early

---

## 📖 Next Steps

→ Start with **Task 1: Dev-Server Integration**
→ See **[ROADMAP.md](./ROADMAP.md)** for phase-level overview
→ See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for system design
