# Restake Bot - Agent Guidelines

This file provides comprehensive instructions for AI agents working on this repository.

## 1. Project Overview
A Cosmos blockchain auto-restaking bot running as an HTTP service. It manages delegations, claims rewards, and restakes to validators.
- **Stack:** TypeScript, Node.js, Fastify, Zod, Jest.
- **Platform:** Fly.io.

## 2. Development Commands

### Build & Run
- **Install:** `pnpm install`
- **Build:** `pnpm build` (Compiles to `dist/`)
- **Start (Server):** `pnpm start` (Runs `dist/server.js`)
- **Start (Once):** `pnpm start:once` (Runs restaking logic once)
- **Dev (Server):** `pnpm dev`
- **Dev (Once):** `pnpm dev:once`

### Testing
- **Run All Tests:** `pnpm test`
- **Run Single Test File:** `pnpm test path/to/file.test.ts`
- **Run Single Test Case:** `pnpm test -t "name of test"`
- **Watch Mode:** `pnpm test:watch`
- **Coverage:** `pnpm test:coverage`
- **Type Check:** `pnpm type-check` (Strict TypeScript check)

## 3. Code Style & Conventions

### TypeScript & Types
- **Strict Mode:** Enabled. Handle `undefined` and `null` explicitly.
- **Validation:** Use **Zod** (`z`) for all runtime validation (env vars, API responses, config).
- **Type Definitions:** Define schemas in `src/types.ts` and infer types via `z.infer<typeof Schema>`.
- **Compiler Options:** Note `noUncheckedIndexedAccess` is on; array access returns `T | undefined`.

### Naming & Formatting
- **Variables/Functions:** `camelCase`
- **Classes/Interfaces:** `PascalCase`
- **Files:** `camelCase` (e.g., `delegationService.ts`)
- **Logging:** Use `console.debug()` for debug info. Avoid `console.log` in production code.

### Architecture Patterns
- **Services:** Business logic resides in `src/services/`. Keep functions pure where possible.
- **Config:** Centralized in `src/config.ts`. Do not hardcode values.
- **Error Handling:** Use `try/catch`. Critical errors should trigger Discord notifications via `DiscordNotifier`.

## 4. Testing Guidelines
- **Framework:** Jest.
- **Requirement:** Create at least **2 unit tests** for every new feature or bug fix.
- **Regression:** Every reported bug must have a regression test.
- **Timing:** Write unit tests *before* submitting the final code (but you may explore/prototype first).
- **Mocks:** Mock all network requests (LCD/RPC calls) and Discord notifications.

## 5. Agent Behavioral Rules (Critical)

### Communication & Git
- **Commit Messages:**
  - Use **Conventional Commits** (e.g., `feat:`, `fix:`, `chore:`).
  - Concise, non-verbose, user-focused.
  - **NEVER** mention "Claude", "Anthropic", or "AI" in commit messages.
  - **NEVER** add `Co-Authored-By` trailers.
- **Communication:** Compact your status updates after every commit.

### Workflow
- **Planning:** Store full implementation plans in `planning/` directory for substantial changes.
- **Server:** Ask permission before stopping/starting Node.js servers.
- **Issues:** Do not close Gitea issues without explicit approval.
- **Documentation:** Always update `README.md` if business logic changes.

### Safety & Secrets
- **Secrets:** Use `$GITEA_TOKEN` for repo access if needed.
- **Gitignore:** Ensure `.claude/settings.local.json` is ignored.

## 6. Directory Structure
```
src/
├── services/       # Core business logic (wallet, delegation, rewards, etc.)
├── utils/          # Shared utilities (fetching, formatting)
├── types.ts        # Zod schemas and type definitions
├── config.ts       # Configuration and env vars
├── server.ts       # Fastify HTTP server entry point
├── index.ts        # CLI/Cron entry point (executeRestake)
└── DiscordNotifier.ts # Notification service
```
