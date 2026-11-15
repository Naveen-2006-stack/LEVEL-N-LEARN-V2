# Intent — levelnlearn

Lane: standard

Review panel: off

Finding skeptics: off

Surfaces: Web App, REST API

## Summary

Make the existing LevelNLearn live quiz flow reliable from participant joining through active gameplay and completion. Ensure participants can seamlessly enter room PINs and maintain consistent game state across reconnections. Enable hosts to reliably manage lobbies, kick disruptive players, synchronize question timers, and view real-time leaderboards. Harden session authentication, preserve the Supabase Realtime channels + REST architecture, and reconcile documentation.

## Problem

Live interactive quizzes can suffer from state desynchronization between hosts and participants, unreliable lobby management, inconsistent score tallying on client refresh, and documentation drift that misleads developers and operators about real-time WebSocket architecture.

## Users

Host instructors/creators and student participants (SRMIST campus students and general players) operating via web browsers on desktop and mobile.

## Success criteria

1. Participants can enter a valid room PIN and join a live game session, appearing in the host's lobby player roster in real time without connection drops.
2. The host dashboard enables the host to view connected players, remove unwanted players, and transition the session from lobby to active question state with synchronized question delivery to all connected participants.
3. During active gameplay, participants receive questions, submit answers, and receive immediate local feedback while scores and session state remain synchronized across all participants and the host scoreboard.
4. When a game session concludes, final scores, action points, and violation logs are flushed to PostgreSQL (session_results) and rendered consistently on both host and participant leaderboards.
5. Join attempts with invalid room PINs, expired sessions, or forged tokens return descriptive structured error responses without leaking sensitive user data or internal server state.
6. Documentation in Project_Overview.md is updated to accurately reflect the Supabase Realtime channel and REST API architecture, removing obsolete references to @fastify/websocket and src/websocket/.
7. Automated Playwright and API tests cover the full participant join flow, host lobby controls, and state transitions across the live quiz lifecycle.

## Edge coverage

| Edge | Criterion | Category | Disposition | Detail |
|------|-----------|----------|-------------|--------|
| E1 | SC1 | empty | held-out | empty or whitespace room PIN is rejected with HTTP 400 and validation error message |
| E2 | SC1 | concurrency | held-out | multiple players joining concurrently receive unique player IDs and connect to the room channel |
| E3 | SC2 | boundary | held-out | host starting game with zero players is rejected or warned with appropriate client feedback |
| E4 | SC3 | idempotency | held-out | duplicate answer submissions for the same question by the same player are ignored |
| E5 | SC4 | boundary | held-out | game ending with tied scores sorts players deterministically by response speed / timestamp |
| E6 | SC5 | boundary | held-out | requests with expired or forged tokens return HTTP 401/403 |
| E7 | SC6 | none | dismissed | documentation update has no runtime data boundaries |
| E8 | SC7 | none | dismissed | automated test execution has no runtime data boundaries |

## Prohibitions

| Prohibition | Criterion | Must not | Disposition | Detail |
|-------------|-----------|----------|-------------|--------|
| N1 | SC1 | expose private host credentials or other players' auth tokens in public room broadcasts | judgment | verify player join payloads and channel messages omit user password hashes, salts, and secret tokens |
| N2 | SC2 | allow arbitrary participants to start a game or kick other players | criterion SC5 | |
| N3 | SC3 | leak correct answer options to client participants before question timer expires | judgment | verify active question payload to players omits correct_option until question phase completes |
| N4 | SC4 | display unverified or corrupted score totals on final leaderboard | judgment | verify scores and rankings match calculated session_results before rendering final podium |
| N5 | SC5 | allow non-hosts to trigger host-only actions (start game, next question, end game) | criterion SC5 | |
| N6 | SC6 | none | dismissed | documentation update does not introduce behavioral prohibitions |
| N7 | SC7 | none | dismissed | test suite execution does not introduce behavioral prohibitions |

## Scope: in

- Participant join flow reliability (PIN validation, error handling, session persistence).
- Host dashboard lobby controls (real-time player list, kick/remove action, start game trigger).
- Gameplay state synchronization (question progression, answer submission, score tallying via Supabase Realtime channels + REST).
- Auth & security checks on game actions (host authorization verification, player token integrity).
- Reconcile Project_Overview.md documentation to match the Supabase Realtime + REST architecture.
- Playwright/integration test suites verifying join flow, lobby controls, and quiz transitions.

## Scope: out (vetoes)

- Fastify WebSockets migration — user vetoed: keep Supabase Realtime channels + REST architecture.
- Broad UI/UX redesign — user vetoed: retain current UI design and component layout.
- New anti-cheat engine or external proctoring expansion — user vetoed: fix only security issues found in existing flow.
- Major database schema redesign — keep existing tables (users, quizzes, questions, game_sessions, session_results).

## Constraints

- Stack: Node.js ESM, Fastify 5.2, React 19, Vite, Supabase Realtime, PostgreSQL with RLS, Redis.
- Bound branch: gsd-path/M001
- Real-time architecture: Supabase Realtime channels + Fastify REST endpoints.
- Doc-vs-code rulings:
  - Project_Overview.md: Fastify (with @fastify/cors, @fastify/static, and @fastify/websocket): fix-doc
  - Project_Overview.md: Real-Time Communication: WebSockets: fix-doc
  - Project_Overview.md: src/websocket/ directory: fix-doc
  - Project_Overview.md: LiveQuiz.jsx: fix-doc

## Current state (brownfield only)

- **What exists**: Full-stack Fastify 5.2 / React 19 application with Supabase PostgreSQL and Redis caching, serving REST endpoints and a static SPA bundle.
- **Must not break**: Existing quiz CRUD, SRMIST campus student auth, and working anti-cheat violation logging in session_results.
- **Doc-vs-code rulings**:
  - Project_Overview.md Tech Stack: fix-doc (remove @fastify/websocket, document Supabase Realtime + REST)
  - Project_Overview.md Project Structure: fix-doc (remove src/websocket/, reference src/components/Arena.jsx)
- **Ground truth**: .project/research/evidence-codebase.md, .project/research/DOCS-AUDIT.md

## Risks

- Real-time channel disconnects or reconnection drops when participants switch tabs or experience intermittent network conditions.
- State desynchronization between in-memory/Redis state and Supabase database records upon sudden host disconnect.

## Open questions

- [RESEARCH] What is the exact payload structure and event contract used across Arena.jsx and Supabase Realtime channels for state transitions?
- [RESEARCH] How does the server currently clean up stale or abandoned game sessions in Redis?

## Corrections

- C1 2026-11-13: "Keep the current Supabase Realtime channels + REST architecture. Fix and document the existing approach; don’t migrate to Fastify WebSockets in this milestone."
