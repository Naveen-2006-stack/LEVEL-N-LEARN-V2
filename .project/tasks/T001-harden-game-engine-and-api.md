---
id: T001
title: Harden backend game engine, Redis session TTLs, and join/action APIs
wave: 1
deps: []
status: done
agent: build_T001
base: a7b1155201808e8458e709b7475ddc02d1f40893
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
- 2026-11-13 — build_T001 completed implementation: hardened gameEngineService with 24h session TTLs and resilient UUID fallback, added empty PIN validation and token/host authorization checks in gameController, and verified security suite with 8 passing tests
- 2026-11-13 — orchestrator Verify (sidecar gsd-path-verify/task-t001-verify): fail, exit 1; output tail:
  ```
  npm notice run playwright test tests/security.spec.js
  [WebServer] node:internal/modules/package_json_reader:301
  [WebServer]   throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
  [WebServer]         ^
  [WebServer] 
  [WebServer] Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'fastify' imported from C:\Users\Naveen\.gsd-path\projects\aaba628f60a345c6\ba3f814d29c2b1f7\verify\task-t001-verify\src\server.js
  [WebServer]     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:301:9)
  [WebServer]     at packageResolve (node:internal/modules/esm/resolve:768:81)
  [WebServer]     at moduleResolve (node:internal/modules/esm/resolve:859:18)
  [WebServer]     at defaultResolve (node:internal/modules/esm/resolve:992:11)
  [WebServer]     at #cachedDefaultResolve (node:internal/modules/esm/loader:701:20)
  [WebServer]     at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:721:38)
  [WebServer]     at ModuleLoader.resolveSync (node:internal/modules/esm/loader:759:56)
  [WebServer]     at #resolve (node:internal/modules/esm/loader:683:17)
  [WebServer]     at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:603:35)
  [WebServer]     at ModuleJob.syncLink (node:internal/modules/esm/module_job:163:33) {
  [WebServer]   code: 'ERR_MODULE_NOT_FOUND'
  [WebServer] }
  [WebServer] 
  [WebServer] Node.js v24.18.0
  ```
- 2026-11-13 — orchestrator Verify (sidecar gsd-path-verify/task-t001-verify): pass, exit 0; output tail:
  ```
  
  Running 8 tests using 1 worker
  
    ok 1 [chromium] › tests\security.spec.js:4:3 › LevelNLearn Security, Anti-Cheat, and Authority Suite › Ensures ZERO Google Login or fake social OAuth buttons exist in the DOM (1.2s)
    ok 2 [chromium] › tests\security.spec.js:19:3 › LevelNLearn Security, Anti-Cheat, and Authority Suite › Non-super-admin users are strictly redirected away from /admin-console (7.9s)
    ok 3 [chromium] › tests\security.spec.js:37:3 › LevelNLearn Security, Anti-Cheat, and Authority Suite › Client payload question data never leaks correct_option answer keys (656ms)
    ok 4 [chromium] › tests\security.spec.js:61:3 › LevelNLearn Security, Anti-Cheat, and Authority Suite › Player identity cannot be spoofed via a known playerId; host actions require a verified host token (4.5s)
    ok 5 [chromium] › tests\security.spec.js:106:3 › LevelNLearn Security, Anti-Cheat, and Authority Suite › Anti-Cheat Engine triggers proctoring overlay on blur event (2.8s)
    ok 6 [chromium] › tests\security.spec.js:129:3 › LevelNLearn Security, Anti-Cheat, and Authority Suite › E1: Empty or whitespace room PIN sent to /api/game/join is rejected with HTTP 400 (25ms)
    ok 7 [chromium] › tests\security.spec.js:153:3 › LevelNLearn Security, Anti-Cheat, and Authority Suite › E2: Multiple players joining concurrently receive distinct player IDs without state corruption (4.9s)
    ok 8 [chromium] › tests\security.spec.js:193:3 › LevelNLearn Security, Anti-Cheat, and Authority Suite › E6 & N5: Forged/expired tokens or non-host users attempting host actions return 401/403 (704ms)
  
    8 passed (23.5s)
  npm notice run levelnlearn-backend@2.0.0 npx
  npm notice run playwright test tests/security.spec.js
  ```
