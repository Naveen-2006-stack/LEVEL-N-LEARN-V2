# Evidence — codebase

Repo root: C:\Drive D\LevelNLearn
Scanned: 2026-11-13
Checks run: node scripts/test-redis.js (in verify sidecar) → ERR_MODULE_NOT_FOUND (node_modules unlinked in bare git worktree; static analysis used)

## Map

- **Stack**: Node.js ESM, Fastify 5.2.1 (@fastify/cors, @fastify/static), React 19.2.8 (Vite 8.2.1), Tailwind/CSS, Lucide React, Framer Motion, PostgreSQL via Supabase (@supabase/supabase-js, pg), Redis (ioredis), Zod 3.24.1, Playwright 1.63.0, AI SDKs (@google/generative-ai 0.21.0, groq-sdk 0.15.0).
- **Entry points**: Server: src/server.js (Fastify HTTP server serving /api/* and static SPA) and api/server.js (Vercel serverless export). Frontend: index.html -> src/main.jsx -> src/App.jsx.
- **Architecture**: Full-stack hybrid monolith deployed as dual Vercel targets (serverless Fastify API + static Vite bundle). REST controllers (quizController.js, gameController.js) delegate to backend services (quizService.js, gameEngineService.js, authService.js, llmEngine.js). Real-time multiplayer synchronization and live quiz telemetry utilize Supabase Realtime channels alongside Redis state caching rather than direct WebSockets.
- **Conventions**: ES modules ("type": "module"), camelCase filenames and identifiers, service-controller architecture with try/catch error wrapping and structured JSON responses ({ success: true/false, ... }), Playwright end-to-end test specs in tests/, conventional/semantic commit messages (feat: ..., fix: ...).
- **Maturity**: Core application functional with comprehensive UI components (Arena.jsx, QuizEditor.jsx, HostDashboard.jsx, CampusAuthGateway.jsx), full REST API endpoints, Supabase RLS policies in schema.sql, and Playwright test suites; runtime tests require populated environment variables and Redis/Supabase connectivity.
- **Recent activity**: Recent commits focused on Vercel deployment refactoring, fixing frontend blank screen crash, security hardening for live quiz and AI LLM endpoints, fixing authorization gaps in final verification, and adding core components and test suites.

## Finding: Real-time multiplayer uses Supabase Realtime channels instead of Fastify WebSockets

- **Claim**: Real-time communication is implemented via Supabase Realtime and REST endpoints rather than Fastify WebSockets or dedicated src/websocket/ handlers.
- **Source**: src/components/Arena.jsx:15-18, src/routes/gameRoutes.js:3-9, src/server.js:22-26
- **Confidence**: high
- **Why it matters here**: Documentation claims @fastify/websocket and src/websocket/wsManager.js, which do not exist in the codebase. Planners would design websocket architecture that does not match reality.

## Finding: Live quiz component is named Arena.jsx rather than LiveQuiz.jsx

- **Claim**: The interactive quiz runner UI component is implemented in src/components/Arena.jsx; LiveQuiz.jsx mentioned in docs does not exist.
- **Source**: src/components/Arena.jsx:25, src/App.jsx:18
- **Confidence**: high
- **Why it matters here**: Any references or tasks modifying the live quiz component must target src/components/Arena.jsx.

## Finding: Vercel serverless deployment wrapper in api/server.js

- **Claim**: The repository contains a Vercel-specific deployment configuration (vercel.json) and entry wrapper (api/server.js).
- **Source**: api/server.js:1-2, vercel.json:1-29, src/server.js:98-100
- **Confidence**: high
- **Why it matters here**: Deployment and server lifecycle logic must account for both standalone Node (src/server.js) and Vercel serverless environments.

## Finding: Multi-LLM provider abstraction with Gemini and Groq

- **Claim**: AI quiz generation supports pluggable providers (Gemini, Groq, Grok) coordinated by src/services/llm/llmEngine.js.
- **Source**: src/services/llm/llmEngine.js, src/services/llm/geminiProvider.js, src/services/llm/groqProvider.js
- **Confidence**: high
- **Why it matters here**: AI generation features are modular and depend on configured API keys (GEMINI_API_KEY, GROQ_API_KEY).

## Apparent intent

- The project appears to be transitioning into an institutional/campus-tailored real-time interactive quiz platform with strict SRMIST student auth restrictions, anti-cheat proctoring, and automated AI quiz generation. — based on src/components/CampusAuthGateway.jsx, src/hooks/useAntiCheat.js, and src/services/llm/llmEngine.js.

## Open questions for define

- Should the project retain the current Supabase Realtime channel architecture, or is there an intent to migrate to direct Fastify WebSockets as previously stated in Project_Overview.md?
- What are the priority feature goals for the upcoming milestone (e.g. enhanced host analytics, campus authentication refinement, mobile responsiveness, or AI quiz enhancements)?

## Blocked areas

- Runtime execution of node scripts/test-redis.js inside the isolated verify worktree was blocked due to untracked node_modules in the secondary worktree.
