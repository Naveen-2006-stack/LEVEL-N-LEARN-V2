# Synthesis

## Settled

- Real-time transport — Supabase Realtime broadcast channels `room:${roomPin}` + Fastify REST endpoints (INTENT.md: Constraints, user ruling)
- Database and schema — PostgreSQL via Supabase with existing tables `users`, `quizzes`, `questions`, `game_sessions`, `session_results` (INTENT.md: Scope out, schema.sql)
- Frontend component structure — Arena.jsx handles player arena and HostDashboard.jsx handles host lobby (evidence-codebase.md, INTENT.md)
- Documentation reconciliation — Update Project_Overview.md to remove @fastify/websocket and src/websocket/ (DOCS-AUDIT.md: User rulings)

## Decisions

### Realtime Broadcast Payload Envelope

- **Decision**: Standardize all server-to-client broadcast dispatches using the Supabase Realtime broadcast envelope `{ type: 'broadcast', event: string, payload: object }`, and ensure client handlers consistently unwrap `payload.payload` (with synthetic direct event fallback `{ event, data }`).
- **Runner-up**: Custom JSON messaging over raw Fastify WebSockets (rejected due to missing websocket packages and explicit user veto).
- **Evidence**: .project/research/evidence-stack.md § Supabase Realtime broadcast envelope wraps event payload under payload.payload
- **Confidence**: high

### Redis Session Key Expiration & Lifecycle

- **Decision**: Apply an explicit 24-hour (86400s) TTL across all auxiliary room session keys (`players`, `scores`, `streaks`, `action_points`, `questions`) during session creation, alongside the existing multi-key deletion on teardownSession.
- **Runner-up**: Relying strictly on teardownSession deletion without setting auxiliary key TTLs (rejected because abandoned sessions without explicit teardown leave orphaned hashes in Redis).
- **Evidence**: .project/research/evidence-pitfalls.md § Auxiliary Redis session keys lack explicit TTL fallbacks outside room metadata
- **Confidence**: high

### Player Identity & Reconnection Resumption

- **Decision**: Maintain player identity and score resumption via `rejoinPlayerId` and `rejoinToken` in browser `sessionStorage`, allowing players who refresh or momentarily drop connection to resume their active score and streak without creating duplicate players.
- **Runner-up**: Pure IP or localStorage tracking (rejected because shared campus workstations would collide, whereas sessionStorage isolates player instances per tab).
- **Evidence**: .project/research/evidence-stack.md § State transitions operate via four broadcast events and initial REST sync
- **Confidence**: high

## For the planner

- **Wave-1 blockers**: Validate room PIN verification, host authorization checks, and Supabase Realtime channel subscription reliability.
- **Walking skeleton**: Player joins with room PIN -> host lobby shows player -> host clicks start -> question renders in player Arena -> player submits answer -> host leaderboard reflects score.
- **Pitfalls → tasks**: Stale Redis auxiliary keys -> task updating gameEngineService createSession to apply TTLs across all session keys; doc drift -> task updating Project_Overview.md.

## User rulings

- Real-time architecture choice → Keep Supabase Realtime channels + REST; do not migrate to Fastify WebSockets in this milestone.

## Still unknown

- none — all architectural questions answered by codebase evidence and research.
