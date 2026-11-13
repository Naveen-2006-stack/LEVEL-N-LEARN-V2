# Plan — levelnlearn

Project verify: `npx playwright test tests/security.spec.js tests/join-quiz.spec.js tests/multiplayer.spec.js tests/campus-gateway-lifecycle.spec.js`

## Config

- max_review_cycles: 3
- wave_budget: none
- review_panel: off
- finding_skeptics: off

## Wave 1 — risk burn-down

Goal: Harden backend session TTLs, PIN validation, and auth checks; reconcile documentation architecture.
Review depth: full

## Wave 2 — walking skeleton

Goal: Synchronize player arena and host dashboard lobby flow, answer handling, leaderboard podium, and end-to-end tests.
Review depth: full

## Surface contract

### Web App — T003

Criteria: SC2, SC3, SC4
Entry: /arena/:roomPin and /host
States:
- Empty lobby showing room PIN and player counter
- Loading spinner during session connection and state sync
- Active question screen with timer countdown and answer options
- Completed screen with final podium and score breakdown
Walkthrough:
1. Open /host to generate a live quiz room PIN.
2. Open /arena/<pin> in a participant window and verify immediate appearance in host lobby roster.
3. Host clicks Start Game; observe active question and synchronized countdown timer on student screen.
4. Student submits an answer option; observe local score feedback and updated host scoreboard.
5. Host ends quiz; observe final leaderboard and session summary on both screens.

### REST API — T001

Criteria: SC1, SC5
Entry: POST /api/game/join, POST /api/game/host-action, POST /api/game/submit, POST /api/game/end
States:
- 200 OK with session data and player token
- 400 Bad Request on empty PIN or malformed payload
- 401 Unauthorized on missing or invalid session token
- 403 Forbidden on unauthorized host action attempt
Walkthrough:
1. Send POST /api/game/join with empty roomPin; observe 400 Bad Request error.
2. Send POST /api/game/join with valid roomPin and username; observe 200 OK with playerId and playerToken.
3. Send POST /api/game/host-action without valid host token; observe 401 Unauthorized.
4. Send POST /api/game/submit with valid playerToken and optionIndex; observe 200 OK with pointsAwarded and newTotalScore.

## Intent coverage

| Criterion | Task | Acceptance |
|-----------|------|------------|
| SC1 | T001 | AC1 |
| SC1 | T001 | AC2 |
| SC2 | T003 | AC5 |
| SC3 | T003 | AC2 |
| SC3 | T003 | AC4 |
| SC4 | T003 | AC3 |
| SC4 | T003 | AC5 |
| SC5 | T001 | AC3 |
| SC5 | T001 | AC4 |
| SC6 | T002 | AC1 |
| SC6 | T002 | AC2 |
| SC6 | T002 | AC3 |
| SC7 | T004 | AC1 |
| SC7 | T004 | AC2 |

## Held-out checks

| Edge | Task | Test |
|------|------|------|
| E1 | T001 | tests/security.spec.js |
| E2 | T001 | tests/security.spec.js |
| E3 | T003 | tests/join-quiz.spec.js |
| E4 | T003 | tests/multiplayer.spec.js |
| E5 | T003 | tests/multiplayer.spec.js |
| E6 | T001 | tests/security.spec.js |

## Dependency notes

- T003 depends on T001 because the frontend Arena and HostDashboard state handlers consume the hardened join API response and backend room state structures delivered by T001.
- T004 depends on T001 and T003 because the end-to-end lifecycle test validates the combined integration of backend session management and frontend UI synchronization.
