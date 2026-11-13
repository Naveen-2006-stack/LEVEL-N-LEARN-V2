---
id: T002
title: Reconcile project overview documentation with Supabase Realtime architecture
wave: 1
deps: []
status: pending
agent: null
base: null
worktree: null
task_branch: null
files:
  - Project_Overview.md
---

# T002 — Reconcile project overview documentation with Supabase Realtime architecture

## Context

During inspect and research, docs-audit found that `Project_Overview.md` claimed `@fastify/websocket` and an obsolete `src/websocket/` directory with `wsManager.js`, `gameHandler.js`, and `lobbyHandler.js`, as well as a non-existent `LiveQuiz.jsx` component. User rulings approved `fix-doc` to document the Supabase Realtime channel + Fastify REST architecture and remove stale references.

## Approach

1. Update `Project_Overview.md` Section 2 (Tech Stack) to remove `@fastify/websocket` and document Supabase Realtime channels under Real-Time Communication.
2. Update Section 3 (Project Structure) to remove the obsolete `src/websocket/` section, document `src/components/Arena.jsx` instead of `LiveQuiz.jsx`, and clarify controller/service roles.
3. Ensure documentation claims match actual repository implementation.

## Interface contract

- None

## Intent coverage

- SC6

## Acceptance criteria

1. `Project_Overview.md` accurately documents Supabase Realtime channels and REST API endpoints for real-time synchronization, removing `@fastify/websocket`.
2. Stale references to `src/websocket/` and `LiveQuiz.jsx` in `Project_Overview.md` are replaced with actual paths (`src/components/Arena.jsx`, `src/services/gameEngineService.js`).
3. GSD Path docs audit check passes with zero unaddressed stale claims in `Project_Overview.md`.

## Verify

```bash
node -e "const doc = fs.readFileSync(process.argv[1], 'utf8'); if (doc.includes('@fastify/websocket') || doc.includes('src/websocket/')) process.exit(1);" Project_Overview.md
```

Heavy: no

## Log

- 2026-11-13 — created by planner
