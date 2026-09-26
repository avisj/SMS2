-- ========================================================================
-- 001_core_schema.sql
-- Multi-Tenant School Management System SaaS - Core Foundation Schema
-- Database: PostgreSQL (Supabase Compatible)
-- ========================================================================

-- Enable pgcrypto for UUID generation if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 1. PLATFORM LEVEL ENTITIES (SaaS Super Admin Scope)
-- ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    data_type VARCHAR(20) NOT NULL DEFAULT 'STRING', -- 'STRING', 'BOOLEAN', 'NUMBER', 'JSON'
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'CORE',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    plan_tier VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------
-- 2. TENANT LAYER (Schools & Locations/Branches)
-- ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_code VARCHAR(30) UNIQUE NOT NULL,
    school_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    website VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'SUSPENDED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(school_code);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);
CREATE INDEX IF NOT EXISTS idx_schools_deleted_at ON schools(deleted_at);

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_code VARCHAR(30) NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    phone VARCHAR(50),
    email VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_location_code UNIQUE(school_id, location_code)
);

CREATE INDEX IF NOT EXISTS idx_locations_school_id ON locations(school_id);
CREATE INDEX IF NOT EXISTS idx_locations_deleted_at ON locations(deleted_at);

-- ------------------------------------------------------------------------
-- 3. IDENTITY & ACCESS CONTROL (Universal Users & Dynamic RBAC)
-- ------------------------------------------------------------------------

-- Dynamic User Types (Classification/Categorization, NOT Authorization)
CREATE TABLE IF NOT EXISTS user_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NULL REFERENCES schools(id) ON DELETE CASCADE, -- NULL = System defaults
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_user_type_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_user_types_school ON user_types(school_id);

-- Universal Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- Supabase Auth auth.users(id) or JWT sub
    school_id UUID NULL REFERENCES schools(id) ON DELETE RESTRICT, -- NULL for SaaS Super Admin
    user_type_id UUID NOT NULL REFERENCES user_types(id),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    profile_photo_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    password_hash VARCHAR(255) NULL, -- Fallback hash for local/hybrid auth mode
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_user_type_id ON users(user_type_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- Data Scopes (Defines WHAT DATA a permission applies to)
CREATE TABLE IF NOT EXISTS data_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    hierarchy_level INT NOT NULL DEFAULT 0
);

-- Granular Permissions (Module + Action)
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    default_scope_id UUID REFERENCES data_scopes(id),
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);

-- Configurable Roles (System templates with school_id = NULL, or custom school roles)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NULL REFERENCES schools(id) ON DELETE CASCADE, -- NULL = System role template
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_role_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_roles_school_id ON roles(school_id);
CREATE INDEX IF NOT EXISTS idx_roles_deleted_at ON roles(deleted_at);

-- Role Permissions with Specific Scope Mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    data_scope_id UUID NOT NULL REFERENCES data_scopes(id),
    school_id UUID NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_permission UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- User Role Assignments (Users can hold MULTIPLE roles)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    school_id UUID NULL REFERENCES schools(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    CONSTRAINT uq_user_role UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- User Location Access (Users can belong to 1, multiple, or all locations)
CREATE TABLE IF NOT EXISTS user_location_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    CONSTRAINT uq_user_location UNIQUE(user_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_user_location_user ON user_location_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_location_location ON user_location_access(location_id);

-- Class and Section Access Foundation for Academic Scopes
CREATE TABLE IF NOT EXISTS user_class_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL,
    academic_session_id UUID NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_section_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    section_id UUID NOT NULL,
    academic_session_id UUID NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id)
);

-- ------------------------------------------------------------------------
-- 4. CONFIGURATION & FEATURE FLAGS (School Specific)
-- ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS school_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_feature UNIQUE(school_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_school_features_school ON school_features(school_id);

CREATE TABLE IF NOT EXISTS school_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    data_type VARCHAR(20) NOT NULL DEFAULT 'STRING', -- 'STRING', 'BOOLEAN', 'NUMBER', 'JSON'
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_setting UNIQUE(school_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_school_settings_school ON school_settings(school_id);

-- ------------------------------------------------------------------------
-- 5. AUDIT LOGGING (Tamper-Resistant Ledger)
-- ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NULL REFERENCES schools(id) ON DELETE SET NULL,
    location_id UUID NULL REFERENCES locations(id) ON DELETE SET NULL,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'ACCESS_DENIED'
    module VARCHAR(50) NOT NULL,
    entity_name VARCHAR(50) NOT NULL,
    record_id VARCHAR(100),
    old_values JSONB NULL,
    new_values JSONB NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school ON audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
