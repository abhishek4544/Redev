# Redev Automatic App Detection Architecture

## Product promise

From a web project's root, this should be enough:

```bash
npx redev
```

Redev automatically discovers the running local app, identifies its framework
when possible, starts a local editing proxy, and opens the correct browser URL.
The editing overlay must work even when framework identification or exact source
mapping is unavailable.

The product must never require a framework-specific npm package for the first
successful edit.

## Non-negotiable rules

1. **Discover automatically.** A user must not need to know a port or framework
   in the normal case.
2. **Do not guess across projects.** When there is meaningful ambiguity, show a
   short app chooser rather than attaching to the first responding port.
3. **The overlay is universal.** It is delivered by Redev's local proxy, not by
   a Vite, Next.js, or other framework integration.
4. **Exact source mapping is progressive enhancement.** Unsupported frameworks
   fall back to DOM context plus project search.
5. **Stay local and dev-only.** Only loopback hosts are examined or proxied;
   production deployments are never modified.

## User flow

```text
User runs: npx redev
        |
        v
Find project root and examine local development processes
        |
        v
Probe candidate loopback HTTP servers and classify each response
        |
        v
Group ports that belong to one app, then score each app for this project
        |
        +-- high-confidence single app --> attach automatically
        |
        +-- multiple plausible apps ------> one-line app chooser
        |
        +-- no app -----------------------> explain how to start one
        |
        v
Start free local proxy port, inject overlay, forward HMR/WebSockets
        |
        v
Open http://localhost:<redev-port> and wait for browser bridge
```

Examples:

```bash
npx redev                                  # normal automatic flow
npx redev --app http://localhost:3003      # deterministic override
npx redev doctor                           # explain detection and blockers
npx redev --remember                       # persist an explicit selection
```

## System components

### 1. Project inspector

Inputs: current directory, parent directories, `package.json`, lockfiles, and
workspace files.

Responsibilities:

- Find the active package/workspace root.
- Recognize framework *intent* from dependencies and scripts: `next`, `vite`,
  `astro`, `@remix-run/*`, `@sveltejs/kit`, Nuxt, and custom scripts.
- Record scripts such as `dev`, `start`, and their expected commands.
- Never treat a dependency alone as proof that a responding server belongs to
  this project.

Output:

```ts
type ProjectProfile = {
  root: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  frameworkHints: Array<{ framework: string; confidence: number; reason: string }>;
  devScripts: string[];
  workspaceRoots: string[];
};
```

### 2. Local process and port discovery

The process inspector finds listeners on loopback interfaces and associates
them with a PID, command line, working directory, and parent process where the
operating system permits it. It never scans a remote network.

Candidate inputs, ordered by reliability:

1. Listening processes launched from the current project root or workspace.
2. Ports explicitly supplied by the user or stored for this project.
3. Common development ports (`3000`, `3001`, `3003`, `4200`, `4321`, `5173`,
   `8080`) as a fallback only.

Ports are not apps. One app may own an HTTP port, a hot-reload WebSocket, an API
server, and an internal dev-server port. The next stage groups them.

### 3. HTTP probe and framework classifier

For each candidate HTTP listener, Redev sends a short `GET /` request with a
strict timeout. It gathers only the response status, headers, first bounded
portion of HTML, redirects, and WebSocket/HMR clues.

Framework classification uses several independent signals:

| Framework | Strong signals |
|---|---|
| Next.js | `next dev` process, `next` dependency, `/_next/` assets, `__NEXT_DATA__`, App Router flight markers |
| Vite | Vite client path, HMR client, `vite` process/dependency |
| Astro | Astro assets/markers, `astro dev` command |
| Remix | Remix build/client markers and dev command |
| SvelteKit | SvelteKit assets and dev command |
| Generic | HTML response from a process in the project root |

Classification is additive. A Next.js label requires compatible evidence from
the project, process, and response when all are available. Redev can still
label an app `generic web app` and attach safely.

### 4. App grouper and confidence engine

The engine converts raw ports into `AppCandidate` objects. It groups listeners
with a common PID tree, working directory, or framework-specific HMR relation.

```ts
type AppCandidate = {
  id: string;
  displayName: string;
  baseUrl: string;
  projectRoot?: string;
  framework: string | 'generic';
  relatedPorts: number[];
  evidence: Evidence[];
  confidence: number; // 0..100
};
```

Suggested scoring:

- +45: server process working directory matches the active project
- +25: process command matches an active dev script
- +15: response framework marker agrees with project dependency
- +10: previously confirmed URL still has the same app fingerprint
- -40: process belongs to a different known project
- -25: response looks like an API/non-HTML service
- -30: port is an HMR/internal socket rather than a document server

Selection policy:

- **80–100:** attach automatically.
- **60–79:** attach only if it is the sole credible browser app; otherwise show
  the chooser with the recommended choice selected.
- **0–59:** do not attach automatically.

The chooser is not a setup failure. It is a safety guard for users running
several apps.

```text
? Which app should Redev edit?
❯ Surgical — Next.js — http://localhost:3003  (project match)
  Admin — Vite — http://localhost:5173
  API — Express — http://localhost:8080       (not a browser app)
```

Persist a user-confirmed selection under `.redev/session.json`, keyed by the
project root and an app fingerprint—not merely by a port number.

### 5. Universal local proxy and overlay runtime

Once an app is selected, the proxy owns the user-facing URL. It:

- Picks a free loopback HTTP port and a free WebSocket port.
- Forwards HTTP, cookies, redirects, and HMR WebSocket upgrades to the app.
- Injects one dev-only overlay script into HTML documents.
- Proxies all non-HTML content without modification.
- Reports the final proxy URL clearly and opens it in the browser.

The overlay must receive the runtime-selected WebSocket port. Every URL shown
in the terminal, browser badge, and `doctor` output must use the same session
record so an occupied default port cannot create a split connection.

If HTML injection fails due to CSP, non-HTML rendering, or an unusual server,
Redev gives a framework-neutral fallback snippet and explains the exact reason.
It does not claim that the overlay is connected when it is not.

### 6. Source resolver pipeline

The click-to-edit experience has distinct capability levels:

| Resolver | Result | Availability |
|---|---|---|
| Instrumentation adapter | Exact component/file/line | Optional framework adapters |
| Source-map resolver | Likely generated source location | Framework/build dependent |
| Project search resolver | Candidate source files and confidence | Universal fallback |
| DOM-only resolver | Text, attributes, classes, hierarchy, URL, screenshot | Always available |

The agent receives the best available context plus a resolver confidence label.
It never presents a guessed line number as exact.

### 7. Diagnostics and recovery

`npx redev doctor` is a first-class feature, not a support afterthought.

```text
Project: Surgical (/work/surgical)
Detected framework: Next.js (92%)
Selected app: http://localhost:3003 (96%; process and response match)
Redev proxy: http://localhost:5050
Overlay: loaded
Browser bridge: connected
Source resolver: project-search fallback
```

When something fails, diagnose it in user language:

- “Several apps are running; choose one.”
- “The app at 3003 is not being opened through the Redev proxy.”
- “Your CSP blocked the injected script; use this dev-only snippet.”
- “Overlay loaded, but exact source mapping is unavailable; project search will
  be used.”

## Security and privacy boundaries

- Bind proxy and browser bridge to `localhost` by default.
- Inspect loopback processes and loopback HTTP endpoints only.
- Never upload code, page content, or process information as part of detection.
- Require user approval before applying edits; show changed files and a diff.
- Do not persist browser content. Persist only a confirmed local app identity
  when the user chooses to remember it.
- Refuse production-looking URLs unless an explicit development override is
  provided.

## Delivery phases

### Phase 1 — dependable universal attach

- Add structured candidate discovery instead of first-open-port detection.
- Implement explicit `--app`, `--port`, and `doctor` commands.
- Introduce the confidence score and one-screen chooser.
- Harden proxy forwarding and injection for Next.js and Vite.
- Success: a user with one running app executes `npx redev` and sees the
  overlay without editing application code.

### Phase 2 — automatic Next.js recognition

- Implement Next process, dependency, and response fingerprints.
- Group Next document/HMR ports as a single app.
- Add App Router and Pages Router fixtures.
- Success: Surgical on port 3003 is identified as Next.js and attached without
  a port argument when it is the project's only credible app.

### Phase 3 — multiple-app safety

- Add process-root matching and app grouping.
- Add app chooser and session fingerprint persistence.
- Test separate Next/Vite projects, monorepos, API servers, and stale saved
  sessions.
- Success: Redev never silently attaches to a different project when two or
  more browser apps are running.

### Phase 4 — source-resolution adapters

- Keep the current Vite transform as an optional exact-mapping adapter.
- Add Next resolver/instrumentation where supported.
- Surface resolver confidence in the overlay and agent prompt.
- Success: the editor remains usable on unsupported frameworks while supported
  frameworks get exact locations.

## Compatibility test matrix

Every release should test:

- Next.js App Router and Pages Router on default and non-default ports
- Vite React, Astro, Remix, SvelteKit, and plain HTML
- two simultaneous browser apps plus an API server
- monorepo package launched from a nested directory
- occupied Redev HTTP and WebSocket ports
- HMR after proxy attachment
- CSP-restricted development page and the manual-script fallback
- production-mode guard

The release gate is an end-to-end assertion: launch fixture, run `redev`, open
the displayed proxy URL, verify overlay badge, toggle selection mode, click an
element, and verify the backend receives the selection.
