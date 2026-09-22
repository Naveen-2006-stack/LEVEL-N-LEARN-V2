-- ==========================================
-- LevelNLearn V2 - PostgreSQL / Supabase Schema
-- Role-Agnostic Live Interactive Quiz Platform
-- ==========================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Secure profile for SRMIST Students, Hosts, and Super Admins)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    password_hash VARCHAR(255),
    salt VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user', -- 'user', 'host', 'super_admin'
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist for existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS salt VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;

-- Index for fast username and email lookup
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for creator lookup
CREATE INDEX IF NOT EXISTS idx_quizzes_creator ON quizzes(creator_id);

-- 3. Questions Table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- JSON Array of 4 strings e.g. ["Opt A", "Opt B", "Opt C", "Opt D"]
    correct_option INT NOT NULL, -- 0-indexed position (0, 1, 2, or 3)
    difficulty_tier VARCHAR(20) DEFAULT 'medium', -- 'easy', 'medium', 'hard'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup of quiz questions
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);

-- 4. Game Sessions Table
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
    host_id UUID REFERENCES users(id) ON DELETE CASCADE,
    room_pin VARCHAR(10) NOT NULL UNIQUE,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active' -- 'active', 'completed'
);

-- Index for active room PIN lookup
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_pin ON game_sessions(room_pin);
CREATE INDEX IF NOT EXISTS idx_game_sessions_host ON game_sessions(host_id);

-- 5. Session Results Table (Flushed from Redis on game teardown)
CREATE TABLE IF NOT EXISTS session_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    final_score INT DEFAULT 0,
    action_points_earned INT DEFAULT 0,
    violation_logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_session_player UNIQUE (session_id, player_id)
);

-- Ensure column exists for existing tables
ALTER TABLE session_results ADD COLUMN IF NOT EXISTS violation_logs JSONB DEFAULT '[]'::jsonb;

-- Index for session stats lookup
CREATE INDEX IF NOT EXISTS idx_session_results_session ON session_results(session_id);
CREATE INDEX IF NOT EXISTS idx_session_results_player ON session_results(player_id);

-- Enable RLS & Add Public Access Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_results ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Drop insecure public policies if they exist
    DROP POLICY IF EXISTS "Allow public access users" ON users;
    DROP POLICY IF EXISTS "Allow public access quizzes" ON quizzes;
    DROP POLICY IF EXISTS "Allow public access questions" ON questions;
    DROP POLICY IF EXISTS "Allow public access game_sessions" ON game_sessions;
    DROP POLICY IF EXISTS "Allow public access session_results" ON session_results;

    -- Secure Policies for users table
    -- Users can read all users (e.g., for leaderboards) but can only modify themselves.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read all') THEN
        CREATE POLICY "Users can read all" ON users FOR SELECT USING (true);
    END IF;

    -- Secure Policies for quizzes table
    -- Anyone can read quizzes. Only creators can modify their own quizzes.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Quizzes are readable by all') THEN
        CREATE POLICY "Quizzes are readable by all" ON quizzes FOR SELECT USING (true);
    END IF;

    -- Secure Policies for questions table
    -- Anyone can read questions.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Questions are readable by all') THEN
        CREATE POLICY "Questions are readable by all" ON questions FOR SELECT USING (true);
    END IF;

    -- Secure Policies for game_sessions
    -- Anyone can read active game sessions (to join)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sessions are readable by all') THEN
        CREATE POLICY "Sessions are readable by all" ON game_sessions FOR SELECT USING (true);
    END IF;

    -- Secure Policies for session_results
    -- Anyone can read results (for leaderboards)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Session results are readable by all') THEN
        CREATE POLICY "Session results are readable by all" ON session_results FOR SELECT USING (true);
    END IF;

    -- Note: This is an application using service_role for backend operations (upserts/inserts)
    -- so complex mutation policies are handled securely via the backend API using the SERVICE_ROLE_KEY.
    -- We restrict frontend clients from directly mutating data.
END $$;
