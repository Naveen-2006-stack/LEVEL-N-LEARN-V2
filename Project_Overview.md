# LevelNLearn V2 - Project Overview

## 1. Project Description
**LevelNLearn V2** is a role-agnostic, real-time interactive quiz platform. It features a full-stack architecture combining a React-based frontend and a Fastify-based backend. The platform supports live quiz hosting, real-time player interactions, and an anti-cheat engine, all powered by a robust tech stack including Supabase Realtime broadcast channels, Redis, and Supabase.

## 2. Tech Stack
### Frontend
- **Framework:** React 19
- **Build Tool:** Vite
- **Routing:** React Router DOM
- **Animations:** Framer Motion
- **Icons:** Lucide React

### Backend
- **Server:** Fastify (with `@fastify/cors` and `@fastify/static`)
- **Real-Time Communication:** Supabase Realtime broadcast channels (`room:${roomPin}`) paired with Fastify REST endpoints
- **Caching & Real-Time Data:** Redis (`ioredis`) with in-memory session engine fallback
- **Database:** PostgreSQL via Supabase (`@supabase/supabase-js`, `pg`)
- **Validation:** Zod

### AI Integration
- **Google Generative AI** (`@google/generative-ai`)
- **Groq SDK** (`groq-sdk`)

## 3. Project Structure
- **`src/server.js`**: The main entry point for the Fastify backend server. It handles REST API routes and serves the static React frontend.
- **`schema.sql`**: Contains the PostgreSQL database schema definitions and Row Level Security (RLS) policies.
- **`src/components/`**: React UI components (e.g., `LandingPage.jsx`, `HostDashboard.jsx`, `Arena.jsx`, `CampusAuthGateway.jsx`).
- **`src/services/`**: Core business logic and integrations.
  - `gameEngineService.js`: Live game session lifecycle, Redis room state, player joining, scoring, and teardown.
  - `quizService.js`: Quiz creation, AI-assisted generation, and question management.
  - `authService.js` / `feedbackService.js`: Authentication and user feedback services.
  - `llm/`: AI integration services.
- **`src/routes/`**: Fastify REST API route definitions (`authRoutes.js`, `gameRoutes.js`, `quizRoutes.js`, `feedbackRoutes.js`).
- **`src/controllers/`**: API request handlers (`authController.js`, `gameController.js`, `quizController.js`, `feedbackController.js`).

## 4. Database Architecture
The application uses PostgreSQL with the following core tables:
1. **`users`**: Lightweight profiles for both hosts and players.
2. **`quizzes`**: Stores quiz metadata (title, description).
3. **`questions`**: Stores questions, JSON options, correct answers, and difficulty tiers.
4. **`game_sessions`**: Tracks active and completed live quiz sessions (room PINs, host IDs).
5. **`session_results`**: Records player scores, action points, and anti-cheat violation logs.

Row Level Security (RLS) is enabled across all tables to ensure data privacy and security.

## 5. Key Features
- **Real-Time Gameplay**: Low-latency interactions using Supabase Realtime broadcast channels and Redis.
- **Role-Agnostic System**: Flexible user modeling where anyone can be a host or player.
- **Anti-Cheat Engine**: Real-time monitoring and logging of violations stored via Redis & Supabase JSONB.
- **AI-Powered Capabilities**: Integration with Gemini and Groq for intelligent features (quiz generation, feedback).

## 6. Scripts (`package.json`)
- `npm start`: Runs the production server (`node src/server.js`).
- `npm run server`: Runs the backend server in watch mode for development.
- `npm run dev` / `npm run client`: Runs the Vite frontend development server.
- `npm run build`: Builds the React frontend for production.
