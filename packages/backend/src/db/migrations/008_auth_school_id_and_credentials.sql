-- ========================================================================
-- 008_auth_school_id_and_credentials.sql
-- School ID Architecture, Dedicated User Credentials & Authentication Security
-- ========================================================================

-- 1. Add School ID Code (Unique identifier for School + Branch context)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS school_id_code VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_school_id_code ON locations(school_id_code) WHERE deleted_at IS NULL;

-- 2. Dedicated User Credentials Table (Separated from profile information)
CREATE TABLE IF NOT EXISTS user_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    school_id_code VARCHAR(50) NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    login_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'DISABLED'
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    last_login_at TIMESTAMPTZ NULL,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_code_username UNIQUE (school_id_code, username)
);

CREATE INDEX IF NOT EXISTS idx_user_credentials_school_code ON user_credentials(school_id_code);
CREATE INDEX IF NOT EXISTS idx_user_credentials_username ON user_credentials(username);
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_school_id ON user_credentials(school_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_location_id ON user_credentials(location_id);

-- 3. Adjust Universal Users Table: Ensure username uniqueness is scoped per school
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_school_username ON users(school_id, username) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_null_school_username ON users(username) WHERE school_id IS NULL AND deleted_at IS NULL;
