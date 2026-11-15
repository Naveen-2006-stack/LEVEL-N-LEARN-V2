-- =============================================================================
-- LEVELNLEARN V2 — COMPLETE MASTER SUPABASE / POSTGRESQL SCHEMA
-- Role-Agnostic Live Interactive Quiz Platform (SRMIST Campus Edition)
-- Idempotent: Safe to run on a brand new or existing Supabase project.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 2. USERS TABLE
-- Secure user store for SRMIST Campus Students, Faculty Hosts, and Super Admins.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    password_hash VARCHAR(255),
    salt VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user', -- 'user', 'host', 'super_admin'
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all required columns exist on legacy tables
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS salt VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- -----------------------------------------------------------------------------
-- 3. PASSWORD RESET TOKENS TABLE
-- Cryptographically secure password reset storage.
-- Stores ONLY SHA-256 hashes of reset tokens; plaintext tokens are never stored.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash of raw 32-byte token
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

-- Ensure columns exist
ALTER TABLE public.password_reset_tokens ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64) UNIQUE;
ALTER TABLE public.password_reset_tokens ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.password_reset_tokens ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.password_reset_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.password_reset_tokens ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT FALSE;
ALTER TABLE public.password_reset_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON public.password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_email ON public.password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON public.password_reset_tokens(expires_at);

-- -----------------------------------------------------------------------------
-- 4. QUIZZES TABLE
-- Custom and AI-generated quiz configurations.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Performance Index
CREATE INDEX IF NOT EXISTS idx_quizzes_creator ON public.quizzes(creator_id);

-- -----------------------------------------------------------------------------
-- 5. QUESTIONS TABLE
-- Multi-choice questions bound to quizzes.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- JSON Array of options e.g. ["Opt A", "Opt B", "Opt C", "Opt D"]
    correct_option INT NOT NULL, -- 0-indexed position (0, 1, 2, or 3)
    difficulty_tier VARCHAR(20) DEFAULT 'medium', -- 'easy', 'medium', 'hard'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS correct_option INT NOT NULL DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS difficulty_tier VARCHAR(20) DEFAULT 'medium';

-- Performance Index
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions(quiz_id);

-- -----------------------------------------------------------------------------
-- 6. GAME SESSIONS TABLE
-- Active live arena multiplayer quiz sessions.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
    host_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    room_pin VARCHAR(10) NOT NULL UNIQUE,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active' -- 'active', 'completed', 'abandoned'
);

-- Ensure columns exist
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_pin ON public.game_sessions(room_pin);
CREATE INDEX IF NOT EXISTS idx_game_sessions_host ON public.game_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON public.game_sessions(status);

-- -----------------------------------------------------------------------------
-- 7. SESSION RESULTS TABLE
-- Flushed from Redis/In-Memory game engine on match completion.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    final_score INT DEFAULT 0,
    action_points_earned INT DEFAULT 0,
    violation_logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_session_player UNIQUE (session_id, player_id)
);

-- Ensure columns exist
ALTER TABLE public.session_results ADD COLUMN IF NOT EXISTS violation_logs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.session_results ADD COLUMN IF NOT EXISTS action_points_earned INT DEFAULT 0;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_session_results_session ON public.session_results(session_id);
CREATE INDEX IF NOT EXISTS idx_session_results_player ON public.session_results(player_id);

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) & ACCESS POLICIES
-- Configures explicit policies for public (anon), authenticated, and service_role.
-- Prevents Error 42501 (new row violates row-level security policy).
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_results ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- -------------------------------------------------------------------------
    -- USERS POLICIES
    -- -------------------------------------------------------------------------
    DROP POLICY IF EXISTS "Users can read all" ON public.users;
    DROP POLICY IF EXISTS "Allow public access users" ON public.users;
    DROP POLICY IF EXISTS "Allow select users" ON public.users;
    DROP POLICY IF EXISTS "Allow insert users" ON public.users;
    DROP POLICY IF EXISTS "Allow update users" ON public.users;

    CREATE POLICY "Allow select users" ON public.users
        FOR SELECT TO anon, authenticated, service_role
        USING (true);

    CREATE POLICY "Allow insert users" ON public.users
        FOR INSERT TO anon, authenticated, service_role
        WITH CHECK (true);

    CREATE POLICY "Allow update users" ON public.users
        FOR UPDATE TO anon, authenticated, service_role
        USING (true)
        WITH CHECK (true);

    -- -------------------------------------------------------------------------
    -- PASSWORD RESET TOKENS POLICIES
    -- -------------------------------------------------------------------------
    DROP POLICY IF EXISTS "Allow select reset tokens" ON public.password_reset_tokens;
    DROP POLICY IF EXISTS "Allow insert reset tokens" ON public.password_reset_tokens;
    DROP POLICY IF EXISTS "Allow update reset tokens" ON public.password_reset_tokens;

    CREATE POLICY "Allow select reset tokens" ON public.password_reset_tokens
        FOR SELECT TO anon, authenticated, service_role
        USING (true);

    CREATE POLICY "Allow insert reset tokens" ON public.password_reset_tokens
        FOR INSERT TO anon, authenticated, service_role
        WITH CHECK (true);

    CREATE POLICY "Allow update reset tokens" ON public.password_reset_tokens
        FOR UPDATE TO anon, authenticated, service_role
        USING (true)
        WITH CHECK (true);

    -- -------------------------------------------------------------------------
    -- QUIZZES POLICIES
    -- -------------------------------------------------------------------------
    DROP POLICY IF EXISTS "Quizzes are readable by all" ON public.quizzes;
    DROP POLICY IF EXISTS "Allow public access quizzes" ON public.quizzes;
    DROP POLICY IF EXISTS "Allow select quizzes" ON public.quizzes;
    DROP POLICY IF EXISTS "Allow insert quizzes" ON public.quizzes;
    DROP POLICY IF EXISTS "Allow update quizzes" ON public.quizzes;
    DROP POLICY IF EXISTS "Allow delete quizzes" ON public.quizzes;

    CREATE POLICY "Allow select quizzes" ON public.quizzes
        FOR SELECT TO anon, authenticated, service_role
        USING (true);

    CREATE POLICY "Allow insert quizzes" ON public.quizzes
        FOR INSERT TO anon, authenticated, service_role
        WITH CHECK (true);

    CREATE POLICY "Allow update quizzes" ON public.quizzes
        FOR UPDATE TO anon, authenticated, service_role
        USING (true)
        WITH CHECK (true);

    CREATE POLICY "Allow delete quizzes" ON public.quizzes
        FOR DELETE TO anon, authenticated, service_role
        USING (true);

    -- -------------------------------------------------------------------------
    -- QUESTIONS POLICIES
    -- -------------------------------------------------------------------------
    DROP POLICY IF EXISTS "Questions are readable by all" ON public.questions;
    DROP POLICY IF EXISTS "Allow public access questions" ON public.questions;
    DROP POLICY IF EXISTS "Allow select questions" ON public.questions;
    DROP POLICY IF EXISTS "Allow insert questions" ON public.questions;
    DROP POLICY IF EXISTS "Allow update questions" ON public.questions;
    DROP POLICY IF EXISTS "Allow delete questions" ON public.questions;

    CREATE POLICY "Allow select questions" ON public.questions
        FOR SELECT TO anon, authenticated, service_role
        USING (true);

    CREATE POLICY "Allow insert questions" ON public.questions
        FOR INSERT TO anon, authenticated, service_role
        WITH CHECK (true);

    CREATE POLICY "Allow update questions" ON public.questions
        FOR UPDATE TO anon, authenticated, service_role
        USING (true)
        WITH CHECK (true);

    CREATE POLICY "Allow delete questions" ON public.questions
        FOR DELETE TO anon, authenticated, service_role
        USING (true);

    -- -------------------------------------------------------------------------
    -- GAME SESSIONS POLICIES
    -- -------------------------------------------------------------------------
    DROP POLICY IF EXISTS "Sessions are readable by all" ON public.game_sessions;
    DROP POLICY IF EXISTS "Allow public access game_sessions" ON public.game_sessions;
    DROP POLICY IF EXISTS "Allow select game_sessions" ON public.game_sessions;
    DROP POLICY IF EXISTS "Allow insert game_sessions" ON public.game_sessions;
    DROP POLICY IF EXISTS "Allow update game_sessions" ON public.game_sessions;

    CREATE POLICY "Allow select game_sessions" ON public.game_sessions
        FOR SELECT TO anon, authenticated, service_role
        USING (true);

    CREATE POLICY "Allow insert game_sessions" ON public.game_sessions
        FOR INSERT TO anon, authenticated, service_role
        WITH CHECK (true);

    CREATE POLICY "Allow update game_sessions" ON public.game_sessions
        FOR UPDATE TO anon, authenticated, service_role
        USING (true)
        WITH CHECK (true);

    -- -------------------------------------------------------------------------
    -- SESSION RESULTS POLICIES
    -- -------------------------------------------------------------------------
    DROP POLICY IF EXISTS "Session results are readable by all" ON public.session_results;
    DROP POLICY IF EXISTS "Allow public access session_results" ON public.session_results;
    DROP POLICY IF EXISTS "Allow select session_results" ON public.session_results;
    DROP POLICY IF EXISTS "Allow insert session_results" ON public.session_results;
    DROP POLICY IF EXISTS "Allow update session_results" ON public.session_results;

    CREATE POLICY "Allow select session_results" ON public.session_results
        FOR SELECT TO anon, authenticated, service_role
        USING (true);

    CREATE POLICY "Allow insert session_results" ON public.session_results
        FOR INSERT TO anon, authenticated, service_role
        WITH CHECK (true);

    CREATE POLICY "Allow update session_results" ON public.session_results
        FOR UPDATE TO anon, authenticated, service_role
        USING (true)
        WITH CHECK (true);
END $$;

-- -----------------------------------------------------------------------------
-- 9. SCHEMA PERMISSIONS
-- Explicit grants for PostgREST Data API exposure.
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10. DEFAULT SEED ACCOUNTS (PBKDF2 SHA-512 with 100,000 iterations)
-- Super Admin, Host, and Student fixtures.
-- -----------------------------------------------------------------------------
INSERT INTO public.users (id, username, email, full_name, password_hash, salt, role, is_verified)
VALUES
    (
        'a0000000-0000-0000-0000-000000000001'::uuid,
        'quizsrm',
        'quizsrm@gmail.com',
        'SRMIST Super Admin',
        'c341a79fc566f43a882ae9934ffd939af639cdb0a51a5be554726ffee491396b1c9aaa53993988dfc2b2d59897bcaf8fa67f252e726e04b80df37babc0d7876c',
        '0349a86105011836a852e842211757d9',
        'super_admin',
        true
    ),
    (
        'a0000000-0000-0000-0000-000000000002'::uuid,
        'hostuser',
        'hostuser@srmist.edu.in',
        'Host User',
        '886bc487e57e6f7ace9a0f31831deb18756a84aabdc1112e3e6743dc309b3f75f2f5cb0217a4b98c08a96635c3ad743e5927d3bd7fe48e96deaf10acc7fb9a90',
        '71d567212bc299f1ef5583e04d332770',
        'user',
        true
    ),
    (
        'a0000000-0000-0000-0000-000000000003'::uuid,
        'scholar',
        'scholar@srmist.edu.in',
        'Campus Scholar',
        '886bc487e57e6f7ace9a0f31831deb18756a84aabdc1112e3e6743dc309b3f75f2f5cb0217a4b98c08a96635c3ad743e5927d3bd7fe48e96deaf10acc7fb9a90',
        '71d567212bc299f1ef5583e04d332770',
        'user',
        true
    ),
    (
        'a0000000-0000-0000-0000-000000000004'::uuid,
        'student123',
        'student123@srmist.edu.in',
        'Scholar Student',
        '253b972f34108a3e72cee80af63484e82db33d66cebe79cd3034d4382495f5fb8295af16a689391f471b72dab9474874319a4252463bd0b11a6cf9778523bdc1',
        '925ba020cce4949f709e8bb9eec94cdc',
        'user',
        true
    )
ON CONFLICT (username) DO UPDATE
SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    salt = EXCLUDED.salt,
    role = EXCLUDED.role,
    is_verified = EXCLUDED.is_verified;
