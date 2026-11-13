---
id: T001
title: Harden backend game engine, Redis session TTLs, and join/action APIs
wave: 1
deps: []
status: pending
agent: null
base: null
worktree: null
task_branch: null
files:
  - src/controllers/gameController.js
  - src/services/gameEngineService.js
  - tests/security.spec.js
---

# T001 — Harden backend game engine, Redis session TTLs, and join/action APIs

## Context

During inspect and research, we identified that while room metadata has a 24-hour TTL, auxiliary session keys (players, scores, streaks, questions) lack explicit TTLs upon creation and could leak on abandoned sessions. Additionally, join and host action handlers need strict validation for empty/whitespace room PINs, token integrity, and non-host action rejection without leaking sensitive data.

## Approach

1. In `src/services/gameEngineService.js`, update `createSession` to apply an explicit 86400s (24 hour) TTL across auxiliary keys or pipeline TTL application for all created room keys.
2. In `src/controllers/gameController.js`, validate room PIN parameter for empty/whitespace values (E1), ensuring structured 400 Bad Request responses.
3. Validate concurrent player joining logic and token verification (E2, E6), rejecting expired or forged tokens with 401/403 errors and omitting password hashes or salts from responses.
4. Ensure `tests/security.spec.js` executes and tests these boundaries.

## Interface contract

- `room:${roomPin}:meta`: Hash containing `session_id`, `quiz_id`, `host_id`, `status`, `current_question`.
- `POST /api/game/join`: Request `{ roomPin, username, userId, token, rejoinPlayerId, rejoinToken }` -> Response `{ success: true, data: { roomPin, playerId, playerToken, activePlayers, gameState } }` or `{ error: string }`.

## Intent coverage

- SC1
- SC5

## Acceptance criteria

1. E1: Empty or whitespace room PIN sent to `/api/game/join` is rejected with HTTP 400 and descriptive error message.
2. E2: Multiple players joining concurrently receive distinct player IDs and connect to the room session without state corruption.
3. E6: Requests to game action endpoints with expired, missing, or forged auth tokens return HTTP 401 or 403 status codes.
4. N5: Non-host users attempting host actions (start_game, next_question, end_game) are strictly rejected with 401 or 403 errors.
5. All room session keys initialized in `gameEngineService.createSession` carry a 24-hour safety TTL.

## Verify

```bash
npx playwright test tests/security.spec.js
```

Heavy: no

## Log

- 2026-11-13 — created by planner
