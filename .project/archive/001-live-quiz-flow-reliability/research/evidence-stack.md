# Evidence — stack

Dimension: stack
Questions assigned: What is the exact payload structure and event contract used across Arena.jsx and Supabase Realtime channels for state transitions?

## Finding: Supabase Realtime broadcast envelope wraps event payload under payload.payload

- **Claim**: The backend dispatches room events via Supabase Realtime broadcast messages shaped as `{ type: 'broadcast', event: string, payload: object }`, which client subscribers receive under `message.payload`. Arena.jsx normalizes this with direct synthetic events `{ event, data }`.
- **Source**: `src/controllers/gameController.js:7-13`, `src/components/Arena.jsx:165-175`
- **Confidence**: high
- **Why it matters here**: Any additions to room state transitions must conform to this envelope structure to avoid dropping client state updates.

## Finding: State transitions operate via four broadcast events and initial REST sync

- **Claim**: The server broadcasts four primary channel events: `player_joined`, `game_started`, `question_active`, and `game_over`. Initial room state is returned directly in HTTP POST `/api/game/join` response and passed to `handleServerEvent({ event: 'room_state_sync', data })`.
- **Source**: `src/controllers/gameController.js:33,73,81,180`, `src/components/Arena.jsx:117-120`
- **Confidence**: high
- **Why it matters here**: Joining players synchronize lobby and player lists immediately upon HTTP join without awaiting a broadcast, ensuring zero initial latency.

## Assigned questions — answers

- What is the exact payload structure and event contract used across Arena.jsx and Supabase Realtime channels for state transitions? → The event contract uses channel `room:${roomPin}`. Server broadcasts sent via `supabase.channel.send({ type: 'broadcast', event, payload })` are: (1) `player_joined` with payload `{ activePlayers }`, (2) `game_started` with payload `{ status: 'active', currentQuestionIndex: 0, currentQuestion, totalQuestions }`, (3) `question_active` with payload `{ status, currentQuestionIndex, currentQuestion }`, and (4) `game_over` with payload `{ finalLeaderboard }`. On the client, `Arena.jsx` unwraps both Realtime broadcasts (where data resides in `payload.payload`) and synthetic events (where data resides in `payload.data`, such as initial `room_state_sync` and local `answer_result`). Source: `src/controllers/gameController.js:7-13,73-85,180-184` and `src/components/Arena.jsx:89-120,165-205`.

## Dead ends

- `Fastify WebSockets under src/websocket/` — Fastify websocket plugin is not installed and directory does not exist; rejected per user veto.
