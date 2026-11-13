# Docs Audit

Repo root: C:\Drive D\LevelNLearn
Audited: 2026-11-13
Audited HEAD: 6f6b5320377633809d677a3154e8b0b59a275fcf
Alignment mode: no

## Summary

| Verdict | Count |
|---------|-------|
| verified | 5 |
| stale | 3 |
| aspirational | 1 |
| unverifiable | 0 |
| descriptive docs (no testable claims) | 40 |

Worst drift: Project_Overview.md specifies Fastify WebSockets and an obsolete src/websocket/ directory, while real-time multiplayer uses Supabase Realtime channels and REST endpoints.

## Doc: Project_Overview.md

| Claim | Type | Verdict | Evidence |
|-------|------|---------|----------|
| "Fastify (with @fastify/cors, @fastify/static, and @fastify/websocket)" | config | stale | package.json:16-32 and src/server.js:1-3 register @fastify/cors and @fastify/static; @fastify/websocket is not installed or registered |
| "Real-Time Communication: WebSockets" | feature | stale | src/server.js:57-58 and src/components/Arena.jsx:15-18 use Supabase Realtime channels and REST API endpoints |
| "src/websocket/: wsManager.js, gameHandler.js, lobbyHandler.js" | structure | aspirational | src/websocket directory does not exist; game handlers are in src/services/gameEngineService.js and src/routes/gameRoutes.js |
| "src/components/ (e.g., LandingPage.jsx, HostDashboard.jsx, LiveQuiz.jsx, CampusAuthGateway.jsx)" | structure | stale | src/components/ contains LandingPage.jsx, HostDashboard.jsx, CampusAuthGateway.jsx, and Arena.jsx; LiveQuiz.jsx does not exist |
| "Database tables: users, quizzes, questions, game_sessions, session_results" | structure | verified | schema.sql:10,35,47,61,76 defines all five tables with RLS enabled |
| "npm start: Runs the production server (node src/server.js)" | command | verified | package.json:8 scripts.start is node src/server.js |
| "npm run server: Runs the backend server in watch mode for development" | command | verified | package.json:9 scripts.server is node --watch src/server.js |
| "npm run dev / npm run client: Runs the Vite frontend development server" | command | verified | package.json:10-11 scripts.dev and scripts.client are vite --port 3000 |
| "npm run build: Builds the React frontend for production" | command | verified | package.json:12 scripts.build is vite build |

## Descriptive docs

- .agents/skills/supabase-postgres-best-practices/CHANGELOG.md
- .agents/skills/supabase-postgres-best-practices/SKILL.md
- .agents/skills/supabase-postgres-best-practices/references/_contributing.md
- .agents/skills/supabase-postgres-best-practices/references/_sections.md
- .agents/skills/supabase-postgres-best-practices/references/_template.md
- .agents/skills/supabase-postgres-best-practices/references/advanced-full-text-search.md
- .agents/skills/supabase-postgres-best-practices/references/advanced-jsonb-indexing.md
- .agents/skills/supabase-postgres-best-practices/references/conn-idle-timeout.md
- .agents/skills/supabase-postgres-best-practices/references/conn-limits.md
- .agents/skills/supabase-postgres-best-practices/references/conn-pooling.md
- .agents/skills/supabase-postgres-best-practices/references/conn-prepared-statements.md
- .agents/skills/supabase-postgres-best-practices/references/data-batch-inserts.md
- .agents/skills/supabase-postgres-best-practices/references/data-n-plus-one.md
- .agents/skills/supabase-postgres-best-practices/references/data-pagination.md
- .agents/skills/supabase-postgres-best-practices/references/data-upsert.md
- .agents/skills/supabase-postgres-best-practices/references/lock-advisory.md
- .agents/skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md
- .agents/skills/supabase-postgres-best-practices/references/lock-short-transactions.md
- .agents/skills/supabase-postgres-best-practices/references/lock-skip-locked.md
- .agents/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md
- .agents/skills/supabase-postgres-best-practices/references/monitor-pg-stat-statements.md
- .agents/skills/supabase-postgres-best-practices/references/monitor-vacuum-analyze.md
- .agents/skills/supabase-postgres-best-practices/references/query-composite-indexes.md
- .agents/skills/supabase-postgres-best-practices/references/query-covering-indexes.md
- .agents/skills/supabase-postgres-best-practices/references/query-index-types.md
- .agents/skills/supabase-postgres-best-practices/references/query-missing-indexes.md
- .agents/skills/supabase-postgres-best-practices/references/query-partial-indexes.md
- .agents/skills/supabase-postgres-best-practices/references/schema-constraints.md
- .agents/skills/supabase-postgres-best-practices/references/schema-data-types.md
- .agents/skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md
- .agents/skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md
- .agents/skills/supabase-postgres-best-practices/references/schema-partitioning.md
- .agents/skills/supabase-postgres-best-practices/references/schema-primary-keys.md
- .agents/skills/supabase-postgres-best-practices/references/security-privileges.md
- .agents/skills/supabase-postgres-best-practices/references/security-rls-basics.md
- .agents/skills/supabase-postgres-best-practices/references/security-rls-performance.md
- .agents/skills/supabase/CHANGELOG.md
- .agents/skills/supabase/SKILL.md
- .agents/skills/supabase/assets/feedback-issue-template.md
- .agents/skills/supabase/references/skill-feedback.md

## User rulings

| Queue # | Ruling | User's words | Planned |
|---------|--------|--------------|---------|
| 1 | fix-doc | "Keep the current Supabase Realtime channels + REST architecture. Fix and document the existing approach; don’t migrate to Fastify WebSockets in this milestone." | T002 |
| 2 | fix-doc | "Keep the current Supabase Realtime channels + REST architecture. Fix and document the existing approach; don’t migrate to Fastify WebSockets in this milestone." | T002 |
| 3 | fix-doc | "Keep the current Supabase Realtime channels + REST architecture. Fix and document the existing approach; don’t migrate to Fastify WebSockets in this milestone." | T002 |
| 4 | fix-doc | "Keep the current Supabase Realtime channels + REST architecture. Fix and document the existing approach; don’t migrate to Fastify WebSockets in this milestone." | T002 |

## Remediation queue

| # | Doc | Claim | Verdict | Class | Suggested action |
|---|-----|-------|---------|-------|------------------|
| 1 | Project_Overview.md | "Fastify (with @fastify/cors, @fastify/static, and @fastify/websocket)" | stale | fix-doc | Update Tech Stack in Project_Overview.md to remove @fastify/websocket |
| 2 | Project_Overview.md | "Real-Time Communication: WebSockets" | stale | fix-doc | Update documentation to clarify real-time communication via Supabase Realtime |
| 3 | Project_Overview.md | "src/websocket/: wsManager.js, gameHandler.js, lobbyHandler.js" | aspirational | fix-doc | Remove obsolete src/websocket/ directory description from Project Structure |
| 4 | Project_Overview.md | "src/components/ (e.g., LandingPage.jsx, HostDashboard.jsx, LiveQuiz.jsx, CampusAuthGateway.jsx)" | stale | fix-doc | Replace LiveQuiz.jsx with Arena.jsx in Project Structure component list |
