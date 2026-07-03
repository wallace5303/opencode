# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo state

This is the **opencode** monorepo (Bun + TypeScript, Turborepo workspaces). The `opencode-docs` directory name is just the local checkout path; the repository root is the opencode project. The default branch is `dev` — a local `main` ref may not exist; use `dev` or `origin/dev` for diffs. Requires Bun 1.3+.

## Commands

Run from repo root unless noted. Tests and typecheck must run from package directories, never root (root `bun test` exits 1 with a `do-not-run-tests-from-root` guard).

```bash
bun install                      # install deps (runs packages/core fix-node-pty in postinstall)
bun dev                          # run opencode TUI against packages/opencode (local equiv of the `opencode` binary)
bun dev <directory>              # run TUI against a specific directory (use `bun dev .` for the repo root)
bun dev serve [--port 8080]      # headless API server (default port 4096)
bun dev web                      # server + web UI
bun run --cwd packages/app dev   # web UI dev (start `bun dev serve` first)
bun --cwd packages/desktop dev   # Electron desktop app
bun lint                         # oxlint (root)
bun typecheck                    # turbo typecheck across packages
```

Per-package (e.g. `packages/opencode`):

```bash
bun typecheck                    # tsgo --noEmit — always use this, never raw tsc
bun test --timeout 30000 --only-failures        # full test suite
bun test path/to/file.test.ts                    # single test file
bun test -t "name pattern"                       # single test by name
bun run test:httpapi                             # exercises the public HttpApi (coverage/auth/effect modes)
bun run build                                    # build via script/build.ts
./packages/opencode/script/build.ts --single     # compile a standalone executable → packages/opencode/dist/opencode-<platform>/bin/opencode
```

Other dev servers: `dev:console`, `dev:stats`, `dev:storybook` (see root `package.json`).

## Code generation (do not hand-edit)

- `packages/client/src/generated` and `src/generated-effect` are produced from the public Protocol/Server `HttpApi`. After changing either, run `bun run generate` from `packages/client`.
- The legacy JS SDK is regenerated via `./packages/sdk/js/script/build.ts`.

## Architecture

### Dependency direction (enforced, important)

Runtime dependencies flow: **Schema → Core and Protocol → Server**. **Client** runtime code may depend on Schema and Protocol but **never** Core or Server. `sdk-next` composes Client + Core + Server. Do not introduce imports that violate this layering.

### Key packages (`packages/`)

- `opencode` — core business logic & server; the CLI/TUI entrypoint. Subdirs of `src/` map to domains: `session`, `provider`, `tool`, `agent`, `server`, `config`, `auth`, `lsp`, `mcp`, `plugin`, `permission`, `project`, `session`, `worktree`, `cli/cmd` (CLI subcommands), `cli/cmd/tui` (TUI, SolidJS + opentui).
- `app` — shared web UI components (SolidJS).
- `desktop` — Electron app wrapping `packages/app`.
- `tui`, `ui`, `web` — additional SolidJS UI surfaces.
- `core` — shared core primitives (also provides `fix-node-pty` postinstall).
- `schema`, `protocol` — type/contract definitions (base of the dependency graph).
- `server` — HTTP server implementation.
- `client`, `sdk`, `sdk-next` — generated/composed client libraries.
- `plugin` — source for the published `@opencode-ai/plugin`.
- `docs` — the docs site (MDX + `docs.json`; `openapi.json` is the published API spec).

### Storage / DB

`packages/opencode` uses a `#db` import alias that resolves to `src/storage/db.bun.ts` (Bun) or `db.node.ts` (Node) via package `imports` conditions. Drizzle schemas use **snake_case** field names so column names don't need redefining as strings.

### V2 Session Core

Session runtime is durable and admission/execution is split. When touching session code:

- `SessionV2.prompt(...)` admits one durable `session_input` row, then schedules advisory `SessionExecution.wake(sessionID)` unless `resume: false`. The serialized runner promotes admitted inputs to visible user messages at safe boundaries.
- `SessionExecution` is process-global and Session-ID-based — no layer should take a Session ID; placement is discovered via `SessionStore` + `LocationServiceMap` only on drain. Interruption targets the active process-local ownership chain; idle/missing is a no-op.
- One explicit `llm.stream(request)` call per provider turn; reload projected history before durable continuation. Do **not** bridge through legacy `SessionPrompt.loop(...)` or delegate to an in-memory tool loop.
- `SessionRunCoordinator` joins same-Session resumes and coalesces prompt wakeups; different Sessions run concurrently. Drains are process-local until clustering exists; a drain has no durable identity or transcript boundary.
- Delivery vocabulary is explicit: `steer` (default, promotes at next safe boundary), `queue` (pending until Session would go idle). Promoting any new user input resets the agent's provider-turn allowance; a steer batch resets it once.
- System Context algebra/registry/built-ins live in `src/system-context`; Context Source producers live with their observed domains; Session History selection and Context Epoch persistence are Session-owned.

See `CONTEXT.md` for the canonical vocabulary (System Context, Context Source, Context Epoch, Admitted Prompt, Prompt Promotion, Provider Turn, Session Drain, etc.) — use these terms, not informal ones like "system prompt".

## Conventions

### Branches & commits

- Default branch: `dev`. Branch names: ≤3 hyphen-separated words, no slashes, no `feat/`/`fix:` prefixes (e.g. `session-recovery`).
- Conventional commits for both commits and PR titles: `type(scope): summary`. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. Scope = affected package (`core`, `opencode`, `tui`, `app`, `desktop`, `sdk`, `plugin`, …). Examples: `fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`.

### Style (from AGENTS.md — these are enforced preferences, not generic advice)

- No alias imports (`import { foo as bar }`) and no star imports. If a namespace value is needed, import the module's own exported namespace by name, e.g. `import { Project } from "@opencode-ai/core/project"` then `Project.ID`.
- Prefer dynamic imports for heavy modules in startup-sensitive paths; destructure bindings at the top of the narrowest scope that needs them (not inline `await import(...).then(...)` chains). Keep branch-specific imports inside their branch.
- Rely on type inference; avoid explicit annotations/interfaces unless required for exports or clarity. Avoid `any`.
- Inline single-use values; don't extract preemptive helpers. Keep helpers below the main export only when they name a real concept.
- Prefer `const` + ternaries/early returns over `let`/reassignment. Avoid `else`.
- Avoid `try`/`catch` where possible; prefer `.catch(...)`. Don't return `Effect` from helpers that only do sync parsing/validation.
- Avoid unnecessary destructuring; use dot notation to preserve context.
- Prefer functional array methods (`flatMap`/`filter`/`map`) over `for` loops; use type guards on `filter` to keep inference.
- Use Bun APIs (`Bun.file()`, etc.) when they fit.
- In Effect generators, bind services to named variables before calling methods — no nested `yield* (yield* Foo.Service).bar()`.
- Prefer Effect schema helpers (`Schema.UnknownFromJsonString`, `Schema.decodeUnknownOption`) over manual `JSON.parse` wrapped in `Effect.try`.
- In `src/config`, follow the self-export pattern (`export * as ConfigAgent from "./agent"`) when adding a config module.
- Prettier: `semi: false`, `printWidth: 120`.

### Testing

- Avoid mocks; don't touch `globalThis.*` unless it's the only option. Test real implementations — don't duplicate logic into tests.
- Tests run from package dirs (e.g. `packages/opencode`), never root.
