# Evidence — pitfalls

Dimension: pitfalls
Questions assigned: How does the server currently clean up stale or abandoned game sessions in Redis?

## Finding: Auxiliary Redis session keys lack explicit TTL fallbacks outside room metadata

- **Claim**: `createSession` sets an 86400-second (24 hour) TTL only on `room:${pin}:meta`, while auxiliary keys (`players`, `scores`, `streaks`, `action_points`, `questions`, `crowd_questions`) rely strictly on explicit `teardownSession` execution for deletion.
- **Source**: `src/services/gameEngineService.js:120-121,611-632`
- **Confidence**: high
- **Why it matters here**: If a host closes their tab without ending the session, auxiliary player hashes and question lists persist in Redis indefinitely unless explicitly cleaned or given matching TTLs.

## Finding: In-memory fallback registry requires status synchronization on session teardown

- **Claim**: For mock or demo sessions that do not persist to Supabase PostgreSQL, `teardownSession` updates `inMemorySessions.set(roomPin, { ...memSession, status: 'completed' })` to prevent `/api/sessions/validate-pin` from reporting finished sessions as active.
- **Source**: `src/services/gameEngineService.js:634-641`
- **Confidence**: high
- **Why it matters here**: Session termination must reliably prevent participants from joining dead rooms.

## Assigned questions — answers

- How does the server currently clean up stale or abandoned game sessions in Redis? → Normal cleanup is executed during `teardownSession(roomPin, hostId)`, which calls `redis.del(...keysToDelete)` for `room:${roomPin}:meta`, `room:${roomPin}:players`, `room:${roomPin}:scores`, `room:${roomPin}:streaks`, `room:${roomPin}:action_points`, `room:${roomPin}:questions`, `room:${roomPin}:answered_players`, and player violation logs, after flushing results to PostgreSQL `session_results`. For abandoned sessions where `teardownSession` is never invoked, `room:${pin}:meta` has a 24-hour TTL fallback (`redis.expire(metaKey, 86400)`), but child keys currently lack individual TTLs. Setting TTL across all created room keys mitigates abandoned-session memory accumulation. Source: `src/services/gameEngineService.js:120-121,611-633`.

## Dead ends

- `Immediate room deletion on host WebSocket/channel leave` — Disconnecting on tab switch or page refresh is common; terminating the room immediately would destroy games prematurely.
