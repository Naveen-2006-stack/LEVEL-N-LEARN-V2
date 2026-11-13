---
id: T003
title: Synchronize Arena and HostDashboard lobby management, question state, and scoring
wave: 2
deps:
  - T001
status: pending
agent: null
base: null
worktree: null
task_branch: null
files:
  - src/components/Arena.jsx
  - src/components/HostDashboard.jsx
  - tests/join-quiz.spec.js
  - tests/multiplayer.spec.js
---

# T003 — Synchronize Arena and HostDashboard lobby management, question state, and scoring

## Context

T001 hardens the backend API and Redis state. This task connects the frontend components (Arena.jsx and HostDashboard.jsx) to reliably reflect lobby state, participant lists, question countdowns, and real-time score updates via Supabase Realtime broadcast channels and REST actions.

## Approach

1. In src/components/HostDashboard.jsx, improve lobby controls to display the live player roster from channel broadcasts, handle kick/remove player actions, and provide feedback when starting a game with zero players (E3).
2. In src/components/Arena.jsx, ensure answer submission idempotency (E4) so repeated clicks or duplicate submissions for the same question index are ignored.
3. Synchronize question progression and timer countdowns so all connected participants receive the active question simultaneously.
4. On game conclusion, verify final score tallying and deterministic podium ranking for tied scores (E5) based on response speed/timestamps before displaying the leaderboard.
5. In tests/join-quiz.spec.js and tests/multiplayer.spec.js, ensure test cases cover lobby start constraints, idempotent answer submission, and leaderboard ranking.

## Interface contract

- `room:${roomPin}:meta`: Hash containing `session_id`, `quiz_id`, `host_id`, `status`, `current_question`.
- `POST /api/game/join`: Request `{ roomPin, username, userId, token, rejoinPlayerId, rejoinToken }` -> Response `{ success: true, data: { roomPin, playerId, playerToken, activePlayers, gameState } }` or `{ error: string }`.

## Intent coverage

- SC2
- SC3
- SC4

## Acceptance criteria

1. E3: Host attempting to start a game with zero connected players is rejected or warned with clear UI feedback.
2. E4: Duplicate or repeated answer submissions for the same question index by the same player are ignored (idempotent).
3. E5: When a game ends with tied scores, players are sorted deterministically on the leaderboard by response speed / timestamp.
4. N1 & N3: Player join payloads omit private credentials, and correct answer options are not revealed to participants until the timer expires.
5. HostDashboard allows the host to view live participants, remove players, transition from lobby to active questions, and conclude the quiz.

## Verify

```bash
npx playwright test tests/join-quiz.spec.js tests/multiplayer.spec.js
```

Heavy: no

## Log

- 2026-11-13 — created by planner
