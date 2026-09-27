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
-- ========================================================================
-- 002_rls_policies.sql
-- Multi-Tenant School Management System SaaS - PostgreSQL Row-Level Security
-- Enforces tenant isolation at the database layer
-- ========================================================================

-- Enable Row Level Security on all tenant-isolated tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_location_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions to get session context safely
CREATE OR REPLACE FUNCTION current_school_id() 
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_school_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION is_platform_super_admin() 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(NULLIF(current_setting('app.is_super_admin', true), '')::BOOLEAN, FALSE);
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------
-- Schools Table RLS
-- Super Admins can see all schools; School users only see their own school
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS p_schools_tenant_isolation ON schools;
CREATE POLICY p_schools_tenant_isolation ON schools
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE 
        OR id = current_school_id()
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE 
        OR id = current_school_id()
    );

-- ------------------------------------------------------------------------
-- Locations Table RLS
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS p_locations_tenant_isolation ON locations;
CREATE POLICY p_locations_tenant_isolation ON locations
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    );

-- ------------------------------------------------------------------------
-- Universal Users Table RLS
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS p_users_tenant_isolation ON users;
CREATE POLICY p_users_tenant_isolation ON users
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    );

-- ------------------------------------------------------------------------
-- User Types Table RLS (System defaults with NULL school_id visible to all)
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS p_user_types_tenant_isolation ON user_types;
CREATE POLICY p_user_types_tenant_isolation ON user_types
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE 
        OR school_id IS NULL 
        OR school_id = current_school_id()
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    );

-- ------------------------------------------------------------------------
-- Roles Table RLS (System template roles with NULL school_id visible to all)
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS p_roles_tenant_isolation ON roles;
CREATE POLICY p_roles_tenant_isolation ON roles
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE 
        OR school_id IS NULL 
        OR school_id = current_school_id()
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    );

-- ------------------------------------------------------------------------
-- Role Permissions Table RLS
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS p_role_permissions_tenant_isolation ON role_permissions;
CREATE POLICY p_role_permissions_tenant_isolation ON role_permissions
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE 
        OR school_id IS NULL 
        OR school_id = current_school_id()
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    );

-- ------------------------------------------------------------------------
-- User Roles Table RLS
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS p_user_roles_tenant_isolation ON user_roles;
CREATE POLICY p_user_roles_tenant_isolation ON user_roles
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    );

-- ------------------------------------------------------------------------
-- User Location Access Table RLS
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS p_user_location_tenant_isolation ON user_location_access;
CREATE POLICY p_user_location_tenant_isolation ON user_location_access
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    );

-- ------------------------------------------------------------------------
-- School Features & Settings Table RLS
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS p_school_features_tenant_isolation ON school_features;
CREATE POLICY p_school_features_tenant_isolation ON school_features
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    );

DROP POLICY IF EXISTS p_school_settings_tenant_isolation ON school_settings;
CREATE POLICY p_school_settings_tenant_isolation ON school_settings
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    );

-- ------------------------------------------------------------------------
-- Audit Logs RLS (Append and Read-only for tenant)
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS p_audit_logs_tenant_isolation ON audit_logs;
CREATE POLICY p_audit_logs_tenant_isolation ON audit_logs
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE 
        OR school_id = current_school_id()
    );
-- ========================================================================
-- 003_system_seed.sql
-- Multi-Tenant School Management System SaaS - Seed Data & System Templates
-- ZERO hardcoded business configuration in application code!
-- ========================================================================

-- 1. DATA SCOPES (Seed)
INSERT INTO data_scopes (id, code, name, description, hierarchy_level) VALUES
    ('10000000-0000-0000-0000-000000000001', 'ALL_SCHOOLS', 'All Schools', 'Platform-wide access across all tenant schools (SaaS Super Admin only)', 100),
    ('10000000-0000-0000-0000-000000000002', 'ALL_LOCATIONS', 'All Locations', 'Access to all branches/locations within the assigned school', 80),
    ('10000000-0000-0000-0000-000000000003', 'SELECTED_LOCATIONS', 'Selected Locations', 'Access to specifically assigned branches/locations', 60),
    ('10000000-0000-0000-0000-000000000004', 'ONE_LOCATION', 'Primary Location Only', 'Access restricted to the users primary branch', 40),
    ('10000000-0000-0000-0000-000000000005', 'ALL_CLASSES', 'All Classes', 'Access to all academic classes within permitted location(s)', 30),
    ('10000000-0000-0000-0000-000000000006', 'SELECTED_CLASSES', 'Selected Classes', 'Access restricted to selected classes/sections', 20),
    ('10000000-0000-0000-0000-000000000007', 'ASSIGNED_CLASSES', 'Assigned Classes', 'Access restricted to classes/sections where user is designated teacher', 15),
    ('10000000-0000-0000-0000-000000000008', 'OWN_RECORD', 'Own Record', 'Access restricted strictly to the users own personal data', 5),
    ('10000000-0000-0000-0000-000000000009', 'OWN_CHILDREN', 'Own Children', 'Access restricted to linked students/children', 5)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. USER TYPES (System Defaults, school_id = NULL)
INSERT INTO user_types (id, school_id, code, name, description, is_system, is_active) VALUES
    ('20000000-0000-0000-0000-000000000001', NULL, 'SUPER_ADMIN', 'SaaS Super Admin', 'Platform operator administrator', TRUE, TRUE),
    ('20000000-0000-0000-0000-000000000002', NULL, 'DIRECTOR', 'School Director', 'Executive leadership of a school tenant', TRUE, TRUE),
    ('20000000-0000-0000-0000-000000000003', NULL, 'ADMIN', 'Administrator', 'School or branch operations administrator', TRUE, TRUE),
    ('20000000-0000-0000-0000-000000000004', NULL, 'TEACHER', 'Teacher / Faculty', 'Academic teaching staff', TRUE, TRUE),
    ('20000000-0000-0000-0000-000000000005', NULL, 'STAFF', 'Non-Teaching Staff', 'Operational, administrative, or support staff', TRUE, TRUE),
    ('20000000-0000-0000-0000-000000000006', NULL, 'STUDENT', 'Student', 'Enrolled student learner', TRUE, TRUE),
    ('20000000-0000-0000-0000-000000000007', NULL, 'PARENT', 'Parent / Guardian', 'Parent or legal guardian of enrolled students', TRUE, TRUE),
    ('20000000-0000-0000-0000-000000000008', NULL, 'OTHER', 'Other / External', 'External auditors, contractors, or guest users', TRUE, TRUE)
ON CONFLICT (school_id, code) DO NOTHING;

-- 3. PERMISSIONS (Master System Register)
INSERT INTO permissions (id, module, action, code, name, description, default_scope_id, is_system) VALUES
    -- Schools module
    ('30000000-0000-0000-0000-000000000001', 'schools', 'view', 'schools.view', 'View Schools', 'View school profiles and details', '10000000-0000-0000-0000-000000000001', TRUE),
    ('30000000-0000-0000-0000-000000000002', 'schools', 'manage', 'schools.manage', 'Manage Schools', 'Create, edit, suspend schools', '10000000-0000-0000-0000-000000000001', TRUE),
    -- Locations module
    ('30000000-0000-0000-0000-000000000003', 'locations', 'view', 'locations.view', 'View Locations', 'View branch locations within permitted scope', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000004', 'locations', 'manage', 'locations.manage', 'Manage Locations', 'Create, update, manage branches/locations', '10000000-0000-0000-0000-000000000002', TRUE),
    -- Users module
    ('30000000-0000-0000-0000-000000000005', 'users', 'view', 'users.view', 'View Users', 'View user profiles and rosters', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000006', 'users', 'create', 'users.create', 'Create Users', 'Register new users in the school', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000007', 'users', 'update', 'users.update', 'Update Users', 'Modify user details, status, profiles', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000008', 'users', 'delete', 'users.delete', 'Archive Users', 'Soft-delete or deactivate users', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000009', 'users', 'assign_roles', 'users.assign_roles', 'Assign Roles', 'Assign or revoke roles from users', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000010', 'users', 'assign_locations', 'users.assign_locations', 'Assign Locations', 'Grant branch access to users', '10000000-0000-0000-0000-000000000002', TRUE),
    -- Roles & Access Control
    ('30000000-0000-0000-0000-000000000011', 'roles', 'view', 'roles.view', 'View Roles', 'Inspect roles and their permission matrices', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000012', 'roles', 'manage', 'roles.manage', 'Manage Roles', 'Create, update, delete custom roles and assign permissions', '10000000-0000-0000-0000-000000000002', TRUE),
    -- Settings & Features
    ('30000000-0000-0000-0000-000000000013', 'settings', 'view', 'settings.view', 'View Settings', 'View school configurations', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000014', 'settings', 'manage', 'settings.manage', 'Manage Settings', 'Update school settings and preferences', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000015', 'features', 'view', 'features.view', 'View Features', 'Inspect enabled school modules and features', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000016', 'features', 'manage', 'features.manage', 'Manage Features', 'Toggle and configure modules per school', '10000000-0000-0000-0000-000000000002', TRUE),
    -- Audit Logging
    ('30000000-0000-0000-0000-000000000017', 'audit', 'view', 'audit.view', 'View Audit Logs', 'Inspect tamper-resistant security and operational logs', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000018', 'audit', 'export', 'audit.export', 'Export Audit Logs', 'Download CSV/Excel audit reports', '10000000-0000-0000-0000-000000000002', TRUE),
    -- Academic Foundations
    ('30000000-0000-0000-0000-000000000019', 'academics', 'view', 'academics.view', 'View Academic Data', 'View classes, sections, sessions', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000020', 'academics', 'manage', 'academics.manage', 'Manage Academic Setup', 'Create and organize sessions, classes, subjects', '10000000-0000-0000-0000-000000000002', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 4. SYSTEM ROLE TEMPLATES (school_id = NULL)
INSERT INTO roles (id, school_id, code, name, description, is_system, is_active) VALUES
    ('40000000-0000-0000-0000-000000000001', NULL, 'SUPER_ADMIN', 'Platform Super Admin', 'Full SaaS platform governance and multi-tenant administration', TRUE, TRUE),
    ('40000000-0000-0000-0000-000000000002', NULL, 'SCHOOL_DIRECTOR', 'School Director', 'Executive administrative authority across all school locations', TRUE, TRUE),
    ('40000000-0000-0000-0000-000000000003', NULL, 'SCHOOL_ADMIN', 'School Administrator', 'Operational administration across permitted branches', TRUE, TRUE),
    ('40000000-0000-0000-0000-000000000004', NULL, 'BRANCH_ADMIN', 'Branch Administrator', 'Management of a single assigned branch location', TRUE, TRUE),
    ('40000000-0000-0000-0000-000000000005', NULL, 'TEACHER', 'Teacher', 'Faculty member with classroom and student evaluation scopes', TRUE, TRUE),
    ('40000000-0000-0000-0000-000000000006', NULL, 'STAFF', 'Staff Member', 'Operational and administrative support staff', TRUE, TRUE),
    ('40000000-0000-0000-0000-000000000007', NULL, 'STUDENT', 'Student', 'Student access to own academic records and submissions', TRUE, TRUE),
    ('40000000-0000-0000-0000-000000000008', NULL, 'PARENT', 'Parent / Guardian', 'Parent access to linked children performance and fees', TRUE, TRUE)
ON CONFLICT (school_id, code) DO NOTHING;

-- 5. MAP ROLE PERMISSIONS FOR SYSTEM TEMPLATES
-- Super Admin: All permissions with ALL_SCHOOLS scope
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000001', p.id, '10000000-0000-0000-0000-000000000001'
FROM permissions p
ON CONFLICT DO NOTHING;

-- School Director: All tenant permissions with ALL_LOCATIONS scope
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000002', p.id, '10000000-0000-0000-0000-000000000002'
FROM permissions p
WHERE p.code NOT IN ('schools.manage') -- Director cannot create/suspend other schools
ON CONFLICT DO NOTHING;

-- School Admin: Operational permissions with ALL_LOCATIONS scope
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000003', p.id, '10000000-0000-0000-0000-000000000002'
FROM permissions p
WHERE p.code IN (
    'locations.view', 'users.view', 'users.create', 'users.update', 
    'users.assign_roles', 'users.assign_locations', 'roles.view', 
    'roles.manage', 'settings.view', 'features.view', 'audit.view', 'academics.view', 'academics.manage'
)
ON CONFLICT DO NOTHING;

-- Branch Admin: Permissions with ONE_LOCATION / SELECTED_LOCATIONS scope
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000004', p.id, '10000000-0000-0000-0000-000000000004'
FROM permissions p
WHERE p.code IN (
    'locations.view', 'users.view', 'users.create', 'users.update', 
    'users.assign_roles', 'roles.view', 'audit.view', 'academics.view'
)
ON CONFLICT DO NOTHING;

-- Teacher: Academic permissions with ASSIGNED_CLASSES scope
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000005', p.id, '10000000-0000-0000-0000-000000000007'
FROM permissions p
WHERE p.code IN ('users.view', 'academics.view')
ON CONFLICT DO NOTHING;

-- 6. PLATFORM MASTER FEATURES
INSERT INTO platform_features (id, feature_key, name, description, category, is_enabled, plan_tier) VALUES
    ('50000000-0000-0000-0000-000000000001', 'online_admissions', 'Online Admissions', 'Public application portal, verification, and admission pipeline', 'ACADEMIC', TRUE, 'STANDARD'),
    ('50000000-0000-0000-0000-000000000002', 'fee_management', 'Fee Management & Online Pay', 'Configurable fee ledgers, payment gateways, receipts, concessions', 'FINANCE', TRUE, 'STANDARD'),
    ('50000000-0000-0000-0000-000000000003', 'attendance', 'Attendance Management', 'Daily, subject-wise attendance with biometric integration support', 'OPERATIONS', TRUE, 'STANDARD'),
    ('50000000-0000-0000-0000-000000000004', 'homework', 'Homework Module', 'Classroom homework dispatch, attachments, and submissions', 'ACADEMIC', TRUE, 'STANDARD'),
    ('50000000-0000-0000-0000-000000000005', 'assignments', 'Graded Assignments', 'Graded assignment workflow with rubrics and scoring', 'ACADEMIC', TRUE, 'STANDARD'),
    ('50000000-0000-0000-0000-000000000006', 'examinations', 'Examinations & Marks', 'Exam scheduling, admit cards, marks entry, and report cards', 'ACADEMIC', TRUE, 'PREMIUM'),
    ('50000000-0000-0000-0000-000000000007', 'library', 'Library Management', 'Book catalog, barcode scanning, issue/return tracking, and fines', 'OPERATIONS', TRUE, 'PREMIUM'),
    ('50000000-0000-0000-0000-000000000008', 'transport', 'Transport & Fleet', 'Vehicle routes, stops, driver assignments, and live tracking', 'OPERATIONS', TRUE, 'PREMIUM'),
    ('50000000-0000-0000-0000-000000000009', 'notifications_whatsapp', 'WhatsApp Notifications', 'Automated fee and attendance notifications via WhatsApp API', 'COMMUNICATION', TRUE, 'ENTERPRISE'),
    ('50000000-0000-0000-0000-000000000010', 'notifications_sms', 'SMS Gateway', 'High-priority SMS alerts for OTP and critical notices', 'COMMUNICATION', TRUE, 'STANDARD'),
    ('50000000-0000-0000-0000-000000000011', 'parent_portal', 'Parent Portal & Mobile App', 'Dedicated mobile and web portal for parents', 'COMMUNICATION', TRUE, 'STANDARD'),
    ('50000000-0000-0000-0000-000000000012', 'student_portal', 'Student Portal', 'Student self-service portal for homework, results, timetable', 'ACADEMIC', TRUE, 'STANDARD')
ON CONFLICT (feature_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 7. PLATFORM GLOBAL SETTINGS
INSERT INTO platform_settings (key, value, data_type, description, is_public) VALUES
    ('platform_name', 'EduCloud SMS SaaS', 'STRING', 'Global brand name of the SaaS platform', TRUE),
    ('support_email', 'support@educloud.io', 'STRING', 'Primary SaaS support contact email', TRUE),
    ('maintenance_mode', 'false', 'BOOLEAN', 'Toggle global maintenance mode window', TRUE),
    ('max_branches_per_school', '10', 'NUMBER', 'Default maximum branch allowance per tenant', FALSE)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- ========================================================================
-- 004_demo_seed.sql
-- Multi-Tenant Demo Seed: 2 Schools, Multi-Branches, Roles, and Scoped Users
-- Used to immediately verify tenant boundary and multi-branch scoping
-- ========================================================================

-- Create School A: Delhi Public Academy
INSERT INTO schools (id, school_code, school_name, legal_name, email, phone, website, address, city, state, country, timezone, currency, status)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'DPA',
    'Delhi Public Academy',
    'Delhi Public Academy Educational Trust',
    'contact@dpa.edu',
    '+91 11 2899 4321',
    'https://dpa.edu',
    'Sector 14, Dwarka',
    'New Delhi',
    'Delhi',
    'India',
    'Asia/Kolkata',
    'INR',
    'ACTIVE'
) ON CONFLICT (school_code) DO NOTHING;

-- Create School B: Greenwood International School
INSERT INTO schools (id, school_code, school_name, legal_name, email, phone, website, address, city, state, country, timezone, currency, status)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'GWI',
    'Greenwood International School',
    'Greenwood Educational Foundation Ltd.',
    'info@greenwood.edu',
    '+91 22 4788 1200',
    'https://greenwood.edu',
    'Bandra Kurla Complex',
    'Mumbai',
    'Maharashtra',
    'India',
    'Asia/Kolkata',
    'INR',
    'ACTIVE'
) ON CONFLICT (school_code) DO NOTHING;

-- Locations for School A
INSERT INTO locations (id, school_id, location_code, location_name, address, city, state, pincode, phone, email, status)
VALUES 
(
    'a1000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'DEL-MAIN',
    'Dwarka Main Campus',
    'Plot 4, Institutional Area, Sector 14, Dwarka',
    'New Delhi',
    'Delhi',
    '110078',
    '+91 11 2899 4321',
    'dwarka@dpa.edu',
    'ACTIVE'
),
(
    'a1000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'NOI-EXT',
    'Noida Extension Campus',
    'Knowledge Park V, Greater Noida West',
    'Noida',
    'Uttar Pradesh',
    '201306',
    '+91 120 6554 990',
    'noida@dpa.edu',
    'ACTIVE'
) ON CONFLICT (school_id, location_code) DO NOTHING;

-- Locations for School B
INSERT INTO locations (id, school_id, location_code, location_name, address, city, state, pincode, phone, email, status)
VALUES 
(
    'b1000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'MUM-CEN',
    'Bandra Central Campus',
    'BKC Tech Enclave, G Block',
    'Mumbai',
    'Maharashtra',
    '400051',
    '+91 22 4788 1200',
    'bkc@greenwood.edu',
    'ACTIVE'
) ON CONFLICT (school_id, location_code) DO NOTHING;

-- Sample Users
-- 1. SaaS Super Admin
INSERT INTO users (id, auth_user_id, school_id, user_type_id, username, email, phone, first_name, last_name, status, password_hash)
VALUES (
    '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000001',
    NULL,
    '20000000-0000-0000-0000-000000000001', -- SUPER_ADMIN
    'superadmin',
    'superadmin@educloud.io',
    '+91 99999 00001',
    'Platform',
    'SuperAdmin',
    'ACTIVE',
    'password123'
) ON CONFLICT (username) DO NOTHING;

-- 2. School A Director (Rajesh Sharma) - Access to ALL branches
INSERT INTO users (id, auth_user_id, school_id, user_type_id, username, email, phone, first_name, last_name, status, password_hash)
VALUES (
    'a2000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002', -- DIRECTOR
    'rajesh.sharma',
    'director@dpa.edu',
    '+91 98100 12345',
    'Rajesh',
    'Sharma',
    'ACTIVE',
    'password123'
) ON CONFLICT (username) DO NOTHING;

-- 3. School A Branch Admin (Sunita Rao) - Access to Delhi Main ONLY
INSERT INTO users (id, auth_user_id, school_id, user_type_id, username, email, phone, first_name, last_name, status, password_hash)
VALUES (
    'a2000000-0000-0000-0000-000000000002',
    'a2000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000003', -- ADMIN
    'sunita.rao',
    'admin.delhi@dpa.edu',
    '+91 98100 23456',
    'Sunita',
    'Rao',
    'ACTIVE',
    'password123'
) ON CONFLICT (username) DO NOTHING;

-- 4. School A Teacher (Vikram Verma) - Teaches at Delhi and Noida
INSERT INTO users (id, auth_user_id, school_id, user_type_id, username, email, phone, first_name, last_name, status, password_hash)
VALUES (
    'a2000000-0000-0000-0000-000000000003',
    'a2000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000004', -- TEACHER
    'vikram.verma',
    'vikram.verma@dpa.edu',
    '+91 98100 34567',
    'Vikram',
    'Verma',
    'ACTIVE',
    'password123'
) ON CONFLICT (username) DO NOTHING;

-- 5. School B Director (Anita Desai) - Greenwood International
INSERT INTO users (id, auth_user_id, school_id, user_type_id, username, email, phone, first_name, last_name, status, password_hash)
VALUES (
    'b2000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002', -- DIRECTOR
    'anita.desai',
    'director@greenwood.edu',
    '+91 98200 45678',
    'Anita',
    'Desai',
    'ACTIVE',
    'password123'
) ON CONFLICT (username) DO NOTHING;

-- User Roles Mapping
-- Super Admin -> SUPER_ADMIN role
INSERT INTO user_roles (user_id, role_id, school_id) VALUES
('90000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', NULL)
ON CONFLICT DO NOTHING;

-- Rajesh Sharma -> SCHOOL_DIRECTOR
INSERT INTO user_roles (user_id, role_id, school_id) VALUES
('a2000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Sunita Rao -> BRANCH_ADMIN
INSERT INTO user_roles (user_id, role_id, school_id) VALUES
('a2000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Vikram Verma -> TEACHER
INSERT INTO user_roles (user_id, role_id, school_id) VALUES
('a2000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Anita Desai -> SCHOOL_DIRECTOR (School B)
INSERT INTO user_roles (user_id, role_id, school_id) VALUES
('b2000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- User Location Access
-- Rajesh Sharma -> Delhi Main (Primary) & Noida Ext
INSERT INTO user_location_access (user_id, location_id, school_id, is_primary) VALUES
('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', TRUE),
('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', FALSE)
ON CONFLICT DO NOTHING;

-- Sunita Rao -> Delhi Main ONLY
INSERT INTO user_location_access (user_id, location_id, school_id, is_primary) VALUES
('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', TRUE)
ON CONFLICT DO NOTHING;

-- Vikram Verma -> Delhi Main (Primary) & Noida Ext
INSERT INTO user_location_access (user_id, location_id, school_id, is_primary) VALUES
('a2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', TRUE),
('a2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', FALSE)
ON CONFLICT DO NOTHING;

-- Anita Desai -> Mumbai Central ONLY
INSERT INTO user_location_access (user_id, location_id, school_id, is_primary) VALUES
('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', TRUE)
ON CONFLICT DO NOTHING;

-- School Features for School A
INSERT INTO school_features (school_id, feature_key, is_enabled, configuration) VALUES
('a0000000-0000-0000-0000-000000000001', 'online_admissions', TRUE, '{"academic_year": "2026-2027", "form_fee": 500}'::jsonb),
('a0000000-0000-0000-0000-000000000001', 'fee_management', TRUE, '{"currency": "INR", "allow_online_partial": true}'::jsonb),
('a0000000-0000-0000-0000-000000000001', 'attendance', TRUE, '{"mode": "DAILY_SUBJECT", "biometric_sync": false}'::jsonb),
('a0000000-0000-0000-0000-000000000001', 'homework', TRUE, '{"max_file_size_mb": 15}'::jsonb),
('a0000000-0000-0000-0000-000000000001', 'examinations', TRUE, '{"grading_system": "CBSE_10_POINT"}'::jsonb),
('a0000000-0000-0000-0000-000000000001', 'notifications_whatsapp', FALSE, '{}'::jsonb)
ON CONFLICT (school_id, feature_key) DO NOTHING;

-- School Settings for School A
INSERT INTO school_settings (school_id, setting_key, setting_value, category, data_type) VALUES
('a0000000-0000-0000-0000-000000000001', 'brand_color', '#0d9488', 'BRANDING', 'STRING'),
('a0000000-0000-0000-0000-000000000001', 'academic_session_current', '2026-2027', 'ACADEMIC', 'STRING'),
('a0000000-0000-0000-0000-000000000001', 'date_format', 'DD/MM/YYYY', 'GENERAL', 'STRING'),
('a0000000-0000-0000-0000-000000000001', 'attendance_cutoff_time', '08:30', 'OPERATIONS', 'STRING')
ON CONFLICT (school_id, setting_key) DO NOTHING;
-- ========================================================================
-- 005_people_masters.sql
-- People / User Management Masters & Extensions
-- Universal Users Model with Supporting Domain Extensions
-- ========================================================================

-- 1. DESIGNATION MASTER (Tenant Scoped)
CREATE TABLE IF NOT EXISTS designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_designation UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_designations_school ON designations(school_id);
CREATE INDEX IF NOT EXISTS idx_designations_deleted ON designations(deleted_at);

-- 2. USER CATEGORIES & SUBCATEGORIES (Tenant Scoped)
CREATE TABLE IF NOT EXISTS user_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_user_category UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_user_categories_school ON user_categories(school_id);

CREATE TABLE IF NOT EXISTS user_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES user_categories(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_user_subcategory UNIQUE(school_id, category_id, code)
);

CREATE INDEX IF NOT EXISTS idx_user_subcategories_cat ON user_subcategories(category_id);

-- 3. USER TAGS & LABELS (Tenant Scoped)
CREATE TABLE IF NOT EXISTS user_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#0d9488',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_user_tag UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_user_tags_school ON user_tags(school_id);

CREATE TABLE IF NOT EXISTS user_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#4f46e5',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_user_label UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_user_labels_school ON user_labels(school_id);

-- 4. TAXONOMY USER ASSIGNMENTS (Many-to-Many Mappings)
CREATE TABLE IF NOT EXISTS user_category_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES user_categories(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_category UNIQUE(user_id, category_id)
);

CREATE TABLE IF NOT EXISTS user_subcategory_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subcategory_id UUID NOT NULL REFERENCES user_subcategories(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_subcategory UNIQUE(user_id, subcategory_id)
);

CREATE TABLE IF NOT EXISTS user_tag_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES user_tags(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_tag UNIQUE(user_id, tag_id)
);

CREATE TABLE IF NOT EXISTS user_label_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES user_labels(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_label UNIQUE(user_id, label_id)
);

-- 5. SPECIALIZED DOMAIN EXTENSION TABLES (Linked to universal users.id)
-- Student Academic Profile
CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    admission_number VARCHAR(50) NOT NULL,
    admission_date DATE,
    roll_number VARCHAR(30),
    academic_session VARCHAR(50),
    class_name VARCHAR(50),
    section_name VARCHAR(50),
    house VARCHAR(50),
    stream VARCHAR(50),
    medium VARCHAR(50),
    blood_group VARCHAR(10),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_admission_number UNIQUE(school_id, admission_number)
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_user ON student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_school ON student_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_class ON student_profiles(class_name, section_name);

-- Staff Employment Profile
CREATE TABLE IF NOT EXISTS staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) NOT NULL,
    designation_id UUID REFERENCES designations(id) ON DELETE SET NULL,
    department VARCHAR(100),
    joining_date DATE,
    qualification VARCHAR(150),
    experience_years INT DEFAULT 0,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_employee_code UNIQUE(school_id, employee_code)
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_user ON staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_school ON staff_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_desig ON staff_profiles(designation_id);

-- Parent - Student Relationship Table
CREATE TABLE IF NOT EXISTS parent_student_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL, -- 'FATHER', 'MOTHER', 'GUARDIAN'
    is_emergency_contact BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_parent_student UNIQUE(parent_user_id, student_user_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_student_school ON parent_student_relationships(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_parent ON parent_student_relationships(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_student ON parent_student_relationships(student_user_id);

-- 6. ENABLE ROW LEVEL SECURITY ON ALL EXTENSION TABLES
ALTER TABLE designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_student_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_designations_isolation ON designations FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_user_categories_isolation ON user_categories FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_user_subcategories_isolation ON user_subcategories FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_user_tags_isolation ON user_tags FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_user_labels_isolation ON user_labels FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_student_profiles_isolation ON student_profiles FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_staff_profiles_isolation ON staff_profiles FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_parent_student_isolation ON parent_student_relationships FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());
-- ========================================================================
-- 006_academic_structure.sql
-- Academic Structure & Academic Assignments
-- Configurable sessions, classes, sections, subjects, groups, and assignments
-- ========================================================================

-- 1. ACADEMIC SESSIONS MASTER (Tenant Scoped)
CREATE TABLE IF NOT EXISTS academic_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g. "2026-27"
    code VARCHAR(50) NOT NULL, -- e.g. "AY2627"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'COMPLETED'
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_session_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_academic_sessions_school ON academic_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_academic_sessions_current ON academic_sessions(school_id, is_current);

-- 2. CLASS MASTER (Tenant Scoped)
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g. "10", "Nursery", "Kindergarten"
    code VARCHAR(50) NOT NULL, -- e.g. "CLS-10"
    display_name VARCHAR(100) NOT NULL, -- e.g. "Class 10"
    numeric_order INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_class_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_order ON classes(school_id, numeric_order);

-- 3. SECTION MASTER (Tenant Scoped)
CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g. "A", "B", "Blue", "Lily"
    code VARCHAR(50) NOT NULL, -- e.g. "SEC-A"
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_section_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_sections_school ON sections(school_id);

-- 4. ACADEMIC CLASS + SECTION CONFIGURATION (Class-Section Offerings per Session)
CREATE TABLE IF NOT EXISTS academic_class_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    capacity INT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_session_class_section UNIQUE(school_id, academic_session_id, class_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_acs_session ON academic_class_sections(academic_session_id);
CREATE INDEX IF NOT EXISTS idx_acs_class ON academic_class_sections(class_id);

-- 5. SUBJECT MASTER (Tenant Scoped)
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g. "Mathematics", "Science"
    code VARCHAR(50) NOT NULL, -- e.g. "SUB-MATH"
    short_name VARCHAR(50),
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_subject_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id);

-- 6. SUBJECT GROUP MASTER (Tenant Scoped)
CREATE TABLE IF NOT EXISTS subject_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g. "Core Subjects", "Electives"
    code VARCHAR(50) NOT NULL, -- e.g. "GRP-CORE"
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_subject_group_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_subject_groups_school ON subject_groups(school_id);

CREATE TABLE IF NOT EXISTS subject_group_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_group_id UUID NOT NULL REFERENCES subject_groups(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subject_group_item UNIQUE(subject_group_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_sgi_group ON subject_group_items(subject_group_id);
CREATE INDEX IF NOT EXISTS idx_sgi_subject ON subject_group_items(subject_id);

-- 7. CLASS SUBJECT CONFIGURATION (Subject Offerings per Class and Session)
CREATE TABLE IF NOT EXISTS academic_class_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_group_id UUID REFERENCES subject_groups(id) ON DELETE SET NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    subject_type VARCHAR(30) NOT NULL DEFAULT 'THEORY', -- 'THEORY', 'PRACTICAL', 'BOTH'
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    credits NUMERIC(4,2) NULL,
    max_marks INT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_session_class_subject UNIQUE(school_id, academic_session_id, class_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_acs_class_subj ON academic_class_subjects(academic_session_id, class_id);

-- 8. STUDENT ACADEMIC ENROLLMENTS (Historical & Current Class-Section Assignments)
CREATE TABLE IF NOT EXISTS student_academic_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    academic_class_section_id UUID REFERENCES academic_class_sections(id) ON DELETE SET NULL,
    admission_number VARCHAR(50) NOT NULL,
    roll_number VARCHAR(50) NULL,
    enrollment_status VARCHAR(30) NOT NULL DEFAULT 'ENROLLED', -- 'ENROLLED', 'PROMOTED', 'DETAINED', 'TRANSFERRED', 'WITHDRAWN', 'ALUMNI'
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_student_academic_session UNIQUE(school_id, student_user_id, academic_session_id)
);

CREATE INDEX IF NOT EXISTS idx_sae_student ON student_academic_enrollments(student_user_id);
CREATE INDEX IF NOT EXISTS idx_sae_session_class ON student_academic_enrollments(academic_session_id, class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_sae_location ON student_academic_enrollments(location_id);

-- 9. TEACHER SUBJECT ASSIGNMENTS (Teaching Allocation)
CREATE TABLE IF NOT EXISTS teacher_subject_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    academic_class_section_id UUID REFERENCES academic_class_sections(id) ON DELETE SET NULL,
    academic_class_subject_id UUID REFERENCES academic_class_subjects(id) ON DELETE SET NULL,
    is_primary_teacher BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_teacher_assignment UNIQUE(school_id, academic_session_id, location_id, class_id, section_id, subject_id, teacher_user_id)
);

CREATE INDEX IF NOT EXISTS idx_tsa_teacher ON teacher_subject_assignments(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_tsa_class_section ON teacher_subject_assignments(academic_session_id, location_id, class_id, section_id);

-- 10. ENABLE ROW LEVEL SECURITY
ALTER TABLE academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_class_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_group_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_academic_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subject_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_academic_sessions_isolation ON academic_sessions FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_classes_isolation ON classes FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_sections_isolation ON sections FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_academic_class_sections_isolation ON academic_class_sections FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_subjects_isolation ON subjects FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_subject_groups_isolation ON subject_groups FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_subject_group_items_isolation ON subject_group_items FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_academic_class_subjects_isolation ON academic_class_subjects FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_student_academic_enrollments_isolation ON student_academic_enrollments FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_teacher_subject_assignments_isolation ON teacher_subject_assignments FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());
-- ========================================================================
-- 007_refactor_roles_rights_and_display_order.sql
-- Architecture & Navigation Correction:
-- 1. Remove unnecessary display_order columns from all master tables
-- 2. Formalize role_rights link view / table
-- 3. Academic session configuration defaults
-- ========================================================================

-- 1. Drop display_order from People Masters
ALTER TABLE designations DROP COLUMN IF EXISTS display_order;
ALTER TABLE user_categories DROP COLUMN IF EXISTS display_order;
ALTER TABLE user_subcategories DROP COLUMN IF EXISTS display_order;

-- 2. Drop display_order from Academic Masters
ALTER TABLE classes DROP COLUMN IF EXISTS display_order;
ALTER TABLE sections DROP COLUMN IF EXISTS display_order;
ALTER TABLE academic_sessions DROP COLUMN IF EXISTS display_order;
ALTER TABLE academic_class_sections DROP COLUMN IF EXISTS display_order;
ALTER TABLE subjects DROP COLUMN IF EXISTS display_order;
ALTER TABLE subject_groups DROP COLUMN IF EXISTS display_order;
ALTER TABLE academic_class_subjects DROP COLUMN IF EXISTS display_order;

-- 3. Create or replace role_rights view as unified interface to role_permissions
CREATE OR REPLACE VIEW role_rights AS
SELECT
    rp.id,
    rp.role_id,
    rp.permission_id AS right_id,
    rp.data_scope_id,
    rp.school_id,
    rp.created_at,
    p.code AS right_code,
    p.name AS right_name,
    p.module,
    p.action,
    p.description AS right_description,
    r.name AS role_name,
    r.code AS role_code
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
JOIN roles r ON rp.role_id = r.id;

-- 4. Create or replace rights view as unified interface to permissions (Rights Master)
CREATE OR REPLACE VIEW rights AS
SELECT
    id,
    code,
    name,
    description,
    module,
    action,
    default_scope_id,
    is_system,
    created_at
FROM permissions;
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
-- ========================================================================
-- 009_student_staff_extended_records.sql
-- Normalized Child Entities for Student History, Staff Qualifications,
-- Experience, Certifications, and Generic Document Attachments
-- ========================================================================

-- 1. Student Previous Academic History
CREATE TABLE IF NOT EXISTS student_previous_academic_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academic_year VARCHAR(50),
    previous_school_name VARCHAR(255) NOT NULL,
    class_name VARCHAR(50),
    board VARCHAR(100),
    result VARCHAR(50),
    marks_grade VARCHAR(50),
    remarks TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_prev_records_student ON student_previous_academic_records(student_user_id);
CREATE INDEX IF NOT EXISTS idx_student_prev_records_school ON student_previous_academic_records(school_id);

-- 2. Student Awards & Achievements
CREATE TABLE IF NOT EXISTS student_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_date DATE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- Sports, Academics, Arts, Leadership, etc.
    level VARCHAR(100),    -- School, Inter-school, District, State, National, International
    award_position VARCHAR(100), -- 1st Place, Gold Medal, Participant, etc.
    description TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON student_achievements(student_user_id);
CREATE INDEX IF NOT EXISTS idx_student_achievements_school ON student_achievements(school_id);

-- 3. Staff Education & Qualifications
CREATE TABLE IF NOT EXISTS staff_qualifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    education_level VARCHAR(100), -- High School, Bachelors, Masters, Doctorate, Diploma
    qualification_name VARCHAR(255) NOT NULL, -- B.Ed, M.Sc Mathematics, etc.
    institution VARCHAR(255) NOT NULL,
    board_university VARCHAR(255),
    passing_year INT,
    marks_grade VARCHAR(50),
    specialization VARCHAR(255),
    certificate_url TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_qualifications_staff ON staff_qualifications(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_school ON staff_qualifications(school_id);

-- 4. Staff Professional Experience
CREATE TABLE IF NOT EXISTS staff_professional_experience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization VARCHAR(255) NOT NULL,
    designation VARCHAR(255) NOT NULL,
    from_date DATE,
    to_date DATE,
    duration VARCHAR(50),
    responsibilities TEXT,
    experience_letter_url TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_experience_staff ON staff_professional_experience(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_experience_school ON staff_professional_experience(school_id);

-- 5. Staff Certifications
CREATE TABLE IF NOT EXISTS staff_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    certification_name VARCHAR(255) NOT NULL,
    issuing_organization VARCHAR(255) NOT NULL,
    issue_date DATE,
    expiry_date DATE,
    credential_number VARCHAR(100),
    attachment_url TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_certifications_staff ON staff_certifications(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_certifications_school ON staff_certifications(school_id);

-- 6. Generic User Documents Attachment Registry
CREATE TABLE IF NOT EXISTS user_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL, -- ID Proof, Birth Certificate, Transfer Certificate, etc.
    document_name VARCHAR(255) NOT NULL,
    document_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_size INT,
    mime_type VARCHAR(100),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_documents_user ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_school ON user_documents(school_id);
-- ========================================================================
-- 010_student_timetable.sql
-- Authoritative Student Timetable Module
-- Versioned Timetable Master and Timetable Details with Conflict Constraints
-- ========================================================================

-- 1. TIMETABLE MASTER (Tenant & Branch & Session Scoped)
CREATE TABLE IF NOT EXISTS timetable_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_id VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    version_no INT NOT NULL DEFAULT 1,
    working_days JSONB NOT NULL DEFAULT '["Monday","Tuesday","Wednesday","Thursday","Friday"]'::jsonb,
    first_period_start_time VARCHAR(5) NOT NULL, -- HH:MM in 24-hr format
    last_period_end_time VARCHAR(5) NOT NULL,   -- HH:MM in 24-hr format
    period_duration_minutes INT NOT NULL,       -- Duration in minutes, e.g. 45
    lunch_start_time VARCHAR(5) NOT NULL,       -- HH:MM in 24-hr format
    lunch_end_time VARCHAR(5) NOT NULL,         -- HH:MM in 24-hr format
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'ACTIVE', 'ARCHIVED'
    effective_from DATE NULL,
    effective_to DATE NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_timetable_master_version UNIQUE(school_id, academic_session_id, location_id, version_no),
    CONSTRAINT uq_timetable_master_id UNIQUE(school_id, timetable_id)
);

CREATE INDEX IF NOT EXISTS idx_timetable_master_school ON timetable_master(school_id);
CREATE INDEX IF NOT EXISTS idx_timetable_master_session ON timetable_master(school_id, academic_session_id);
CREATE INDEX IF NOT EXISTS idx_timetable_master_location ON timetable_master(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_timetable_master_status ON timetable_master(school_id, academic_session_id, location_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_timetable_master_active_version ON timetable_master(school_id, academic_session_id, location_id) WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- 2. TIMETABLE DETAILS (Snapshot Rows of Timetable Master)
CREATE TABLE IF NOT EXISTS timetable_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_detail_id VARCHAR(100) NOT NULL,
    timetable_master_id UUID NOT NULL REFERENCES timetable_master(id) ON DELETE CASCADE,
    timetable_id VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL,          -- 'Monday', 'Tuesday', ... 'Sunday'
    period_no INT NOT NULL,                    -- 1, 2, 3...
    start_time VARCHAR(5) NOT NULL,            -- HH:MM
    end_time VARCHAR(5) NOT NULL,              -- HH:MM
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id VARCHAR(50) NULL,
    is_free_period BOOLEAN NOT NULL DEFAULT FALSE,
    is_lunch BOOLEAN NOT NULL DEFAULT FALSE,
    remarks TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_timetable_details_class_slot UNIQUE(timetable_master_id, day_of_week, period_no, class_id, section_id),
    CONSTRAINT uq_timetable_details_teacher_slot UNIQUE(timetable_master_id, day_of_week, period_no, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_timetable_details_master ON timetable_details(timetable_master_id);
CREATE INDEX IF NOT EXISTS idx_timetable_details_class ON timetable_details(school_id, class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_timetable_details_teacher ON timetable_details(school_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetable_details_slot ON timetable_details(timetable_master_id, day_of_week, period_no);
-- ========================================================================
-- 011_universal_attendance.sql
-- Universal Attendance Module
-- Single Authoritative user_attendance Table for Student and Staff/Faculty
-- ========================================================================

-- 1. ATTENDANCE STATUS MASTER (Configurable Attendance Statuses)
CREATE TABLE IF NOT EXISTS attendance_status_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    status_code VARCHAR(30) NOT NULL,            -- 'PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'EXCUSED'
    status_name VARCHAR(50) NOT NULL,            -- 'Present', 'Absent', 'Late', 'Half Day', 'Leave', 'Excused'
    attendance_type VARCHAR(20) NOT NULL DEFAULT 'ALL', -- 'ALL', 'STUDENT', 'STAFF'
    counts_as_present BOOLEAN NOT NULL DEFAULT FALSE,
    counts_as_absent BOOLEAN NOT NULL DEFAULT FALSE,
    counts_as_leave BOOLEAN NOT NULL DEFAULT FALSE,
    color_code VARCHAR(20) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_attendance_status_school_code UNIQUE(school_id, status_code)
);

CREATE INDEX IF NOT EXISTS idx_attendance_status_school ON attendance_status_master(school_id);

-- 2. UNIVERSAL USER ATTENDANCE (Single Source of Truth)
CREATE TABLE IF NOT EXISTS user_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id VARCHAR(100) NOT NULL,         -- Human-readable format, e.g. ATT-DPA-20260910-0001
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    attendance_type VARCHAR(20) NOT NULL,        -- 'STUDENT' or 'STAFF'
    academic_session_id UUID NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    
    -- Student Historical Context
    student_enrollment_id UUID NULL REFERENCES student_academic_enrollments(id) ON DELETE SET NULL,
    class_id UUID NULL REFERENCES classes(id) ON DELETE SET NULL,
    section_id UUID NULL REFERENCES sections(id) ON DELETE SET NULL,
    
    -- Staff Historical Context
    staff_assignment_id UUID NULL,
    department VARCHAR(100) NULL,
    
    -- Attendance Status & Timing Details
    status VARCHAR(30) NOT NULL DEFAULT 'PRESENT', -- 'PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'EXCUSED'
    check_in_time VARCHAR(10) NULL,              -- e.g. '08:42'
    check_out_time VARCHAR(10) NULL,             -- e.g. '16:35'
    late_minutes INT NOT NULL DEFAULT 0,
    early_departure_minutes INT NOT NULL DEFAULT 0,
    remarks TEXT NULL,
    
    -- Operational & Locking Metadata
    marked_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'MANUAL', -- 'MANUAL', 'MOBILE', 'BIOMETRIC', 'RFID', 'IMPORT', 'API'
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,

    -- Uniqueness per user, per day, per attendance type
    CONSTRAINT uq_user_attendance_daily UNIQUE(school_id, user_id, attendance_date, attendance_type)
);

-- Performance & Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_user_attendance_school_date ON user_attendance(school_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_user_attendance_user_date ON user_attendance(school_id, user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_user_attendance_student_roster ON user_attendance(school_id, academic_session_id, location_id, class_id, section_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_user_attendance_staff_roster ON user_attendance(school_id, location_id, attendance_date, attendance_type);
CREATE INDEX IF NOT EXISTS idx_user_attendance_enrollment ON user_attendance(student_enrollment_id);

-- 3. ATTENDANCE AUDIT LOG (Track Status and Timing Edits)
CREATE TABLE IF NOT EXISTS attendance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    attendance_id UUID NOT NULL REFERENCES user_attendance(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    old_check_in VARCHAR(10) NULL,
    new_check_in VARCHAR(10) NULL,
    old_check_out VARCHAR(10) NULL,
    new_check_out VARCHAR(10) NULL,
    changed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_att ON attendance_audit_log(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_school ON attendance_audit_log(school_id);
-- ========================================================================
-- 012_student_enrollment_partial_unique.sql
-- Relax unique constraint on student_academic_enrollments to partial unique index
-- This allows historical transfers (status 'TRANSFERRED') while strictly guaranteeing
-- at most one active ('ENROLLED') enrollment per student per academic session.
-- ========================================================================

-- Drop the restrictive static unique constraint if it exists
ALTER TABLE student_academic_enrollments 
    DROP CONSTRAINT IF EXISTS uq_student_academic_session;

-- Create partial unique index guaranteeing exactly ONE active enrollment per session
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_active_session 
    ON student_academic_enrollments (school_id, student_user_id, academic_session_id) 
    WHERE enrollment_status = 'ENROLLED' AND deleted_at IS NULL;
-- ========================================================================
-- 013_fees_management.sql
-- Fees Management Module Schema
-- Supports Fee Heads, Structures, Student Demands, Payments, Allocations,
-- Receipts, Adjustments (Discounts & Waivers), and Refunds.
-- ========================================================================

-- 1. FEE HEADS (Fee Categories / Charge Types Master)
CREATE TABLE IF NOT EXISTS fee_heads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'ACADEMIC', -- 'ACADEMIC', 'FACILITY', 'OPTIONAL', 'ONE_TIME', 'TRANSPORT', 'MISC'
    is_taxable BOOLEAN NOT NULL DEFAULT FALSE,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',     -- 'ACTIVE', 'INACTIVE'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_fee_heads_school_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_fee_heads_school ON fee_heads(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_heads_status ON fee_heads(school_id, status);

-- 2. FEE STRUCTURES (Fee Rules by Session, Branch, Class, Section)
CREATE TABLE IF NOT EXISTS fee_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NULL REFERENCES locations(id) ON DELETE CASCADE, -- NULL means school-wide
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NULL REFERENCES sections(id) ON DELETE SET NULL,  -- NULL means all sections in class
    fee_head_id UUID NOT NULL REFERENCES fee_heads(id) ON DELETE RESTRICT,
    frequency VARCHAR(30) NOT NULL DEFAULT 'MONTHLY', -- 'ONE_TIME', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    due_day_of_month INT NOT NULL DEFAULT 10,
    notes TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_fee_structures_school_session ON fee_structures(school_id, academic_session_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_class ON fee_structures(class_id);

-- 3. STUDENT FEE DEMANDS (Individual Student Invoices / Dues)
CREATE TABLE IF NOT EXISTS student_fee_demands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_number VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_enrollment_id UUID NULL REFERENCES student_academic_enrollments(id) ON DELETE SET NULL,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    fee_structure_id UUID NULL REFERENCES fee_structures(id) ON DELETE SET NULL,
    fee_head_id UUID NOT NULL REFERENCES fee_heads(id) ON DELETE RESTRICT,
    billing_period VARCHAR(50) NOT NULL,              -- e.g. '2026-04', 'Q1-2026', 'ADMISSION-2026'
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    original_amount NUMERIC(12,2) NOT NULL CHECK (original_amount >= 0),
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    waiver_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (waiver_amount >= 0),
    late_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (late_fee_amount >= 0),
    net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount >= 0),
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'UNPAID',    -- 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED'
    cancellation_reason TEXT NULL,
    cancelled_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_student_fee_demand UNIQUE(school_id, student_user_id, academic_session_id, fee_head_id, billing_period)
);

CREATE INDEX IF NOT EXISTS idx_sfd_school ON student_fee_demands(school_id);
CREATE INDEX IF NOT EXISTS idx_sfd_student ON student_fee_demands(student_user_id);
CREATE INDEX IF NOT EXISTS idx_sfd_due ON student_fee_demands(school_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_sfd_academic ON student_fee_demands(school_id, academic_session_id, location_id, class_id, section_id);

-- 4. FEE DEMAND ADJUSTMENTS (Discounts and Waivers Log)
CREATE TABLE IF NOT EXISTS fee_demand_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_fee_demand_id UUID NOT NULL REFERENCES student_fee_demands(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    adjustment_type VARCHAR(30) NOT NULL,             -- 'DISCOUNT', 'WAIVER', 'LATE_FEE_OVERRIDE'
    discount_name VARCHAR(100) NULL,                  -- e.g. 'Sibling Discount', 'Merit Scholarship'
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',   -- 'PENDING', 'APPROVED', 'REJECTED'
    approved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fda_demand ON fee_demand_adjustments(student_fee_demand_id);
CREATE INDEX IF NOT EXISTS idx_fda_student ON fee_demand_adjustments(student_user_id);

-- 5. FEE PAYMENTS (Financial Collection Transaction Header)
CREATE TABLE IF NOT EXISTS fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
    refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (refunded_amount >= 0),
    payment_mode VARCHAR(30) NOT NULL,                -- 'CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'
    transaction_reference VARCHAR(100) NULL,
    remarks TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',    -- 'SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REVERSED'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_fee_payments_number UNIQUE(school_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_fee_payments_school_date ON fee_payments(school_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_user_id);

-- 6. FEE PAYMENT ALLOCATIONS (Itemized Allocation of Payment to Demands)
CREATE TABLE IF NOT EXISTS fee_payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
    student_fee_demand_id UUID NOT NULL REFERENCES student_fee_demands(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(12,2) NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fpa_payment ON fee_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_fpa_demand ON fee_payment_allocations(student_fee_demand_id);

-- 7. FEE RECEIPTS (Official School Receipts)
CREATE TABLE IF NOT EXISTS fee_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',     -- 'ACTIVE', 'CANCELLED'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fee_receipts_school_number UNIQUE(school_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_fee_receipts_school ON fee_receipts(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_student ON fee_receipts(student_user_id);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_payment ON fee_receipts(payment_id);

-- 8. FEE REFUNDS (Partial / Full Refunds against Payments)
CREATE TABLE IF NOT EXISTS fee_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_number VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refund_amount NUMERIC(12,2) NOT NULL CHECK (refund_amount > 0),
    refund_date DATE NOT NULL DEFAULT CURRENT_DATE,
    refund_mode VARCHAR(30) NOT NULL DEFAULT 'ORIGINAL_MODE',
    reason TEXT NOT NULL,
    reference_no VARCHAR(100) NULL,
    approved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fee_refunds_number UNIQUE(school_id, refund_number)
);

CREATE INDEX IF NOT EXISTS idx_fee_refunds_school ON fee_refunds(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_refunds_payment ON fee_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_fee_refunds_student ON fee_refunds(student_user_id);
-- ========================================================================
-- 014_exams_management.sql
-- Exams & Results Module Schema
-- Supports Exam Master, Structures, Structure Subjects, Schedules,
-- Grade Rules, Marks Entry, and Calculated Results / Publication Snapshots
-- ========================================================================

-- 1. EXAM MASTER (Examination Definitions)
CREATE TABLE IF NOT EXISTS exam_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    exam_name VARCHAR(150) NOT NULL,
    exam_code VARCHAR(50) NOT NULL,
    exam_type VARCHAR(50) NOT NULL DEFAULT 'ASSESSMENT', -- 'UNIT_TEST', 'PERIODIC_TEST', 'HALF_YEARLY', 'ANNUAL', 'PRE_BOARD', 'INTERNAL'
    description TEXT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',        -- 'DRAFT', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_exam_master_school_session_code UNIQUE(school_id, academic_session_id, exam_code)
);

CREATE INDEX IF NOT EXISTS idx_exam_master_school ON exam_master(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_master_session ON exam_master(school_id, academic_session_id);
CREATE INDEX IF NOT EXISTS idx_exam_master_status ON exam_master(school_id, status);

-- 2. EXAM STRUCTURES (Academic Group Binding per Exam)
CREATE TABLE IF NOT EXISTS exam_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exam_master(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NULL REFERENCES locations(id) ON DELETE CASCADE, -- NULL means school-wide
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NULL REFERENCES sections(id) ON DELETE SET NULL,  -- NULL means all sections in class
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',     -- 'ACTIVE', 'INACTIVE'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_exam_structures_school ON exam_structures(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_structures_exam ON exam_structures(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_structures_class ON exam_structures(class_id);

-- 3. EXAM STRUCTURE SUBJECTS (Subject-level marks and grading configuration)
CREATE TABLE IF NOT EXISTS exam_structure_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_structure_id UUID NOT NULL REFERENCES exam_structures(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    maximum_marks NUMERIC(6,2) NOT NULL CHECK (maximum_marks > 0),
    passing_marks NUMERIC(6,2) NOT NULL CHECK (passing_marks >= 0 AND passing_marks <= maximum_marks),
    grade_applicable BOOLEAN NOT NULL DEFAULT TRUE,
    weightage NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_exam_struct_subj UNIQUE(exam_structure_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_struct_subj ON exam_structure_subjects(exam_structure_id);

-- 4. EXAM SCHEDULES (Timetable of Exam Papers)
CREATE TABLE IF NOT EXISTS exam_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exam_master(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NULL REFERENCES sections(id) ON DELETE CASCADE, -- NULL means all sections
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    exam_date DATE NOT NULL,
    start_time VARCHAR(10) NOT NULL,                  -- e.g. '09:00'
    end_time VARCHAR(10) NOT NULL,                    -- e.g. '11:00'
    venue VARCHAR(100) NULL,
    maximum_marks NUMERIC(6,2) NOT NULL DEFAULT 100.00,
    instructions TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'COMPLETED', 'CANCELLED'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_exam_schedules_school ON exam_schedules(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_exam ON exam_schedules(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_date ON exam_schedules(school_id, exam_date);

-- 5. GRADE RULES (Grading Scale Configuration)
CREATE TABLE IF NOT EXISTS grade_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    grade_name VARCHAR(10) NOT NULL,
    min_percentage NUMERIC(5,2) NOT NULL,
    max_percentage NUMERIC(5,2) NOT NULL,
    grade_point NUMERIC(4,2) NULL,
    description VARCHAR(100) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_grade_rules_school_grade UNIQUE(school_id, grade_name)
);

CREATE INDEX IF NOT EXISTS idx_grade_rules_school ON grade_rules(school_id);

-- 6. EXAM MARKS (Student Subject Assessment Records)
CREATE TABLE IF NOT EXISTS exam_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exam_master(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    maximum_marks NUMERIC(6,2) NOT NULL,
    passing_marks NUMERIC(6,2) NOT NULL,
    obtained_marks NUMERIC(6,2) NULL,
    attendance_status VARCHAR(20) NOT NULL DEFAULT 'PRESENT', -- 'PRESENT', 'ABSENT', 'EXEMPT'
    remarks TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ENTERED',            -- 'ENTERED', 'VERIFIED', 'PUBLISHED'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_exam_marks_student_subj UNIQUE(school_id, exam_id, student_user_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_marks_school ON exam_marks(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_student ON exam_marks(student_user_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_lookup ON exam_marks(school_id, exam_id, class_id, section_id, subject_id);

-- 7. EXAM RESULTS (Student Aggregate Computed Results / Publication Snapshots)
CREATE TABLE IF NOT EXISTS exam_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exam_master(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_obtained_marks NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    total_maximum_marks NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    grade VARCHAR(10) NOT NULL DEFAULT 'F',
    result_status VARCHAR(20) NOT NULL DEFAULT 'PASS',        -- 'PASS', 'FAIL', 'ABSENT', 'WITHHELD'
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',              -- 'DRAFT', 'PUBLISHED'
    published_at TIMESTAMPTZ NULL,
    published_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_exam_results_student UNIQUE(school_id, exam_id, student_user_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_results_school ON exam_results(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam_class ON exam_results(school_id, exam_id, class_id, section_id);

-- 8. EXAM RESULT DETAILS (Immutable Subject Breakdown Snapshot)
CREATE TABLE IF NOT EXISTS exam_result_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_result_id UUID NOT NULL REFERENCES exam_results(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    subject_name VARCHAR(100) NOT NULL,
    maximum_marks NUMERIC(6,2) NOT NULL,
    passing_marks NUMERIC(6,2) NOT NULL,
    obtained_marks NUMERIC(6,2) NULL,
    attendance_status VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
    grade VARCHAR(10) NOT NULL DEFAULT '',
    is_pass BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_res_det_res ON exam_result_details(exam_result_id);

-- 9. DEFAULT GRADE RULES SEED (CBSE Scale)
INSERT INTO grade_rules (school_id, grade_name, min_percentage, max_percentage, grade_point, description)
SELECT s.id, g.name, g.min_p, g.max_p, g.gp, g.descr
FROM schools s
CROSS JOIN (
    VALUES 
    ('A+', 90.00, 100.00, 10.0, 'Outstanding'),
    ('A',  80.00, 89.99,  9.0, 'Excellent'),
    ('B+', 70.00, 79.99,  8.0, 'Very Good'),
    ('B',  60.00, 69.99,  7.0, 'Good'),
    ('C+', 50.00, 59.99,  6.0, 'Above Average'),
    ('C',  40.00, 49.99,  5.0, 'Average'),
    ('D',  33.00, 39.99,  4.0, 'Pass'),
    ('F',   0.00, 32.99,  0.0, 'Needs Improvement')
) AS g(name, min_p, max_p, gp, descr)
ON CONFLICT (school_id, grade_name) DO NOTHING;
-- ========================================================================
-- 015_communication.sql
-- Communication Module Schema
-- Supports Communications, Recipient Delivery Snapshots, Read Tracking,
-- Acknowledgments, and Reusable Communication Templates
-- ========================================================================

-- 1. COMMUNICATIONS MASTER TABLE
CREATE TABLE IF NOT EXISTS communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NULL REFERENCES locations(id) ON DELETE SET NULL, -- NULL = School-wide / All branches
    academic_session_id UUID NULL REFERENCES academic_sessions(id) ON DELETE SET NULL,
    communication_type VARCHAR(50) NOT NULL DEFAULT 'ANNOUNCEMENT', -- 'ANNOUNCEMENT', 'NOTICE', 'GENERAL_MESSAGE', 'ACADEMIC', 'FEE', 'ATTENDANCE', 'EXAM', 'EVENT', 'URGENT', 'OTHER'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL', -- 'NORMAL', 'HIGH', 'URGENT'
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SCHEDULED', 'SENT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'FAILED'
    delivery_channel VARCHAR(50) NOT NULL DEFAULT 'IN_APP', -- 'IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'
    audience_type VARCHAR(50) NOT NULL DEFAULT 'ENTIRE_SCHOOL', -- 'ENTIRE_SCHOOL', 'BRANCH', 'CLASS', 'SECTION', 'STUDENTS', 'PARENTS', 'TEACHERS', 'STAFF', 'SPECIFIC_USERS'
    audience_filters JSONB NULL DEFAULT '{}'::jsonb, -- e.g. {"class_id": "...", "section_id": "...", "user_ids": [...]}
    requires_acknowledgement BOOLEAN NOT NULL DEFAULT FALSE,
    attachment_url TEXT NULL,
    attachment_name VARCHAR(255) NULL,
    scheduled_at TIMESTAMPTZ NULL,
    published_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_communications_school ON communications(school_id);
CREATE INDEX IF NOT EXISTS idx_communications_session ON communications(school_id, academic_session_id);
CREATE INDEX IF NOT EXISTS idx_communications_location ON communications(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_communications_status ON communications(school_id, status);
CREATE INDEX IF NOT EXISTS idx_communications_type ON communications(school_id, communication_type);
CREATE INDEX IF NOT EXISTS idx_communications_created ON communications(school_id, created_at DESC);

-- 2. COMMUNICATION RECIPIENTS TABLE (Delivery Snapshot & Interaction State)
CREATE TABLE IF NOT EXISTS communication_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_type VARCHAR(50) NOT NULL DEFAULT 'STUDENT', -- 'STUDENT', 'PARENT', 'TEACHER', 'STAFF', 'OTHER'
    delivery_channel VARCHAR(50) NOT NULL DEFAULT 'IN_APP',
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'DELIVERED', -- 'PENDING', 'SENT', 'DELIVERED', 'FAILED'
    read_status VARCHAR(30) NOT NULL DEFAULT 'UNREAD', -- 'UNREAD', 'READ'
    acknowledgement_status VARCHAR(30) NOT NULL DEFAULT 'NOT_REQUIRED', -- 'NOT_REQUIRED', 'PENDING', 'ACKNOWLEDGED'
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ NULL,
    acknowledged_at TIMESTAMPTZ NULL,
    failure_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_comm_recipient UNIQUE(communication_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_recipients_comm ON communication_recipients(communication_id);
CREATE INDEX IF NOT EXISTS idx_comm_recipients_school ON communication_recipients(school_id);
CREATE INDEX IF NOT EXISTS idx_comm_recipients_user ON communication_recipients(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_comm_recipients_user_read ON communication_recipients(recipient_user_id, read_status);
CREATE INDEX IF NOT EXISTS idx_comm_recipients_status ON communication_recipients(communication_id, delivery_status);

-- 3. COMMUNICATION TEMPLATES MASTER
CREATE TABLE IF NOT EXISTS communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    template_name VARCHAR(150) NOT NULL,
    communication_type VARCHAR(50) NOT NULL DEFAULT 'NOTICE',
    subject VARCHAR(255) NOT NULL,
    message_body TEXT NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    requires_acknowledgement BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_template_name UNIQUE(school_id, template_name)
);

CREATE INDEX IF NOT EXISTS idx_comm_templates_school ON communication_templates(school_id);
CREATE INDEX IF NOT EXISTS idx_comm_templates_type ON communication_templates(school_id, communication_type);

-- 4. ENABLE ROW LEVEL SECURITY
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_communications_isolation ON communications FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_comm_recipients_isolation ON communication_recipients FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_comm_templates_isolation ON communication_templates FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

-- 5. SEED INITIAL STANDARD TEMPLATES FOR DEFAULT SCHOOLS
INSERT INTO communication_templates (
    school_id, template_name, communication_type, subject, message_body, priority, requires_acknowledgement, status
)
SELECT 
    s.id,
    t.name,
    t.comm_type,
    t.subj,
    t.body,
    t.prio,
    t.ack,
    'ACTIVE'
FROM schools s
CROSS JOIN (
    VALUES
    (
        'Parent-Teacher Meeting (PTM)',
        'NOTICE',
        'Invitation to Upcoming Parent-Teacher Meeting (PTM)',
        'Dear Parents/Guardians,\n\nYou are cordially invited to attend the Parent-Teacher Meeting scheduled for upcoming Saturday. The session will provide an opportunity to discuss your ward''s academic progress, attendance, and overall development with class teachers and subject faculty.\n\nPlease ensure your presence during your designated time slot.\n\nWarm regards,\nSchool Administration',
        'HIGH',
        TRUE
    ),
    (
        'Fee Payment Due Reminder',
        'FEE',
        'Urgent: Term Fee Payment Due Notice',
        'Dear Parents/Guardians,\n\nThis is a gentle reminder that the school term fees for the current quarter are due. To avoid late fee penalties and ensure uninterrupted access to academic resources, kindly clear the outstanding balance at the earliest via the online fee payment portal or school fee counter.\n\nIf you have already paid, please ignore this notice.\n\nRegards,\nAccounts Department',
        'HIGH',
        FALSE
    ),
    (
        'Annual Examination Schedule Notice',
        'EXAM',
        'Announcement: Upcoming Term Examination Timetable',
        'Dear Students & Parents,\n\nThe official schedule for the upcoming Term Examinations has been finalized and published. Students are advised to review the subject-wise dates, exam timings, and room allocations carefully.\n\nPlease refer to the examination syllabus guidelines. Hall tickets will be issued shortly.\n\nBest of luck,\nExamination Committee',
        'HIGH',
        TRUE
    ),
    (
        'Official Holiday Notification',
        'ANNOUNCEMENT',
        'Notice: School Closure on Account of Public Holiday',
        'Dear Students, Parents, and Staff Members,\n\nPlease take note that the school will remain closed on the upcoming declared holiday. Regular academic and administrative operations will resume promptly on the next working day.\n\nHappy Holidays!\nPrincipal''s Office',
        'NORMAL',
        FALSE
    ),
    (
        'Daily Attendance & Absence Advisory',
        'ATTENDANCE',
        'Student Absence Alert & Regular Attendance Notice',
        'Dear Parents,\n\nRegular and punctual school attendance is vital for academic excellence. If your ward is absent today or requires leave for medical reasons, kindly submit an official leave application signed by the parent through the portal.\n\nThank you for your cooperation.\nAcademic Office',
        'NORMAL',
        FALSE
    )
) AS t(name, comm_type, subj, body, prio, ack)
ON CONFLICT (school_id, template_name) DO NOTHING;
-- ========================================================================
-- 016_transport.sql
-- Transport Management Module Schema
-- Supports Vehicles, Driver Assignments, Routes, Stops, 
-- Student Transport Assignments, Daily Trips, and GPS/Location History
-- ========================================================================

-- 1. VEHICLES MASTER TABLE
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NULL REFERENCES locations(id) ON DELETE SET NULL, -- Branch/Campus
    vehicle_number VARCHAR(50) NOT NULL, -- Display/Business Identifier e.g. 'BUS-01'
    registration_number VARCHAR(50) NOT NULL, -- e.g. 'UP14AB1234'
    vehicle_type VARCHAR(50) NOT NULL DEFAULT 'SCHOOL_BUS', -- 'SCHOOL_BUS', 'VAN', 'MINI_BUS', 'OTHER'
    make VARCHAR(100) NULL,
    model VARCHAR(100) NULL,
    capacity INTEGER NOT NULL DEFAULT 40,
    fuel_type VARCHAR(50) NULL,
    purchase_date DATE NULL,
    insurance_expiry DATE NULL,
    fitness_expiry DATE NULL,
    permit_expiry DATE NULL,
    puc_expiry DATE NULL,
    gps_device_id VARCHAR(100) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED'
    last_service_date DATE NULL,
    next_service_due DATE NULL,
    remarks TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_vehicle_registration UNIQUE(school_id, registration_number)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_school ON vehicles(school_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_location ON vehicles(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(school_id, status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(school_id, vehicle_type);

-- 2. VEHICLE DRIVER ASSIGNMENTS TABLE (Historical & Current Staff/Driver Assignment)
CREATE TABLE IF NOT EXISTS vehicle_driver_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_number VARCHAR(100) NULL,
    license_expiry DATE NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NULL,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_driver_assignments_school ON vehicle_driver_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_vehicle ON vehicle_driver_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_driver ON vehicle_driver_assignments(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_status ON vehicle_driver_assignments(school_id, status);

-- 3. TRANSPORT ROUTES MASTER TABLE
CREATE TABLE IF NOT EXISTS transport_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NULL REFERENCES locations(id) ON DELETE SET NULL, -- NULL = All branches or Branch specific
    route_name VARCHAR(150) NOT NULL,
    route_code VARCHAR(50) NOT NULL, -- e.g. 'RT-DW-01'
    route_type VARCHAR(50) NOT NULL DEFAULT 'BOTH', -- 'PICKUP', 'DROP', 'BOTH'
    start_point VARCHAR(150) NOT NULL,
    end_point VARCHAR(150) NOT NULL,
    estimated_duration_mins INTEGER NULL,
    distance_km NUMERIC(6,2) NULL,
    assigned_vehicle_id UUID NULL REFERENCES vehicles(id) ON DELETE SET NULL,
    primary_driver_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'SUSPENDED'
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_route_code UNIQUE(school_id, route_code)
);

CREATE INDEX IF NOT EXISTS idx_transport_routes_school ON transport_routes(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_routes_location ON transport_routes(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_transport_routes_status ON transport_routes(school_id, status);
CREATE INDEX IF NOT EXISTS idx_transport_routes_vehicle ON transport_routes(assigned_vehicle_id);

-- 4. ROUTE STOPS TABLE (Ordered sequence of pickup/drop points)
CREATE TABLE IF NOT EXISTS transport_route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
    stop_name VARCHAR(150) NOT NULL,
    stop_code VARCHAR(50) NULL,
    address_landmark TEXT NULL,
    sequence_number INTEGER NOT NULL DEFAULT 1,
    pickup_time VARCHAR(10) NULL, -- 'HH:MM' e.g. '07:30'
    drop_time VARCHAR(10) NULL,   -- 'HH:MM' e.g. '14:45'
    latitude NUMERIC(10,7) NULL,
    longitude NUMERIC(10,7) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE'
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_route_stop_sequence UNIQUE(route_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_route_stops_route ON transport_route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_seq ON transport_route_stops(route_id, sequence_number);

-- 5. STUDENT TRANSPORT ASSIGNMENT TABLE (Operational link - does NOT alter student academic enrollment)
CREATE TABLE IF NOT EXISTS student_transport_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
    pickup_stop_id UUID NULL REFERENCES transport_route_stops(id) ON DELETE SET NULL,
    drop_stop_id UUID NULL REFERENCES transport_route_stops(id) ON DELETE SET NULL,
    vehicle_id UUID NULL REFERENCES vehicles(id) ON DELETE SET NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'COMPLETED'
    remarks TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_std_transport_school ON student_transport_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_std_transport_session ON student_transport_assignments(school_id, academic_session_id);
CREATE INDEX IF NOT EXISTS idx_std_transport_student ON student_transport_assignments(student_user_id);
CREATE INDEX IF NOT EXISTS idx_std_transport_route ON student_transport_assignments(route_id);
CREATE INDEX IF NOT EXISTS idx_std_transport_vehicle ON student_transport_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_std_transport_status ON student_transport_assignments(school_id, status);

-- 6. DAILY TRANSPORT TRIPS TABLE
CREATE TABLE IF NOT EXISTS transport_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NULL REFERENCES locations(id) ON DELETE SET NULL,
    trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
    route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_type VARCHAR(30) NOT NULL DEFAULT 'PICKUP', -- 'PICKUP', 'DROP', 'OTHER'
    scheduled_start_time VARCHAR(10) NULL,
    scheduled_end_time VARCHAR(10) NULL,
    actual_start_at TIMESTAMPTZ NULL,
    actual_end_at TIMESTAMPTZ NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'STARTED', 'COMPLETED', 'CANCELLED'
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_trips_school ON transport_trips(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_trips_date ON transport_trips(school_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_transport_trips_route ON transport_trips(route_id);
CREATE INDEX IF NOT EXISTS idx_transport_trips_vehicle ON transport_trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transport_trips_driver ON transport_trips(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_transport_trips_status ON transport_trips(school_id, status);

-- 7. VEHICLE LOCATION HISTORY TABLE (For live GPS and route replay when device connected)
CREATE TABLE IF NOT EXISTS vehicle_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    trip_id UUID NULL REFERENCES transport_trips(id) ON DELETE SET NULL,
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,
    speed_kmh NUMERIC(5,2) NULL,
    heading_degrees NUMERIC(5,2) NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_history_vehicle ON vehicle_location_history(vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_history_trip ON vehicle_location_history(trip_id);

-- 8. ROW LEVEL SECURITY POLICIES
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_transport_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_vehicles_isolation ON vehicles FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_driver_assignments_isolation ON vehicle_driver_assignments FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_transport_routes_isolation ON transport_routes FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_route_stops_isolation ON transport_route_stops FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_std_transport_isolation ON student_transport_assignments FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_transport_trips_isolation ON transport_trips FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_location_history_isolation ON vehicle_location_history FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

-- 9. SEED DEMO VEHICLE FOR EXISTING SCHOOLS
INSERT INTO vehicles (
    school_id, vehicle_number, registration_number, vehicle_type, make, model, capacity, fuel_type, status, remarks
)
SELECT 
    s.id,
    'BUS-01',
    'UP14AB1234',
    'SCHOOL_BUS',
    'Tata Motors',
    'Starbus 40',
    40,
    'DIESEL',
    'ACTIVE',
    'Primary fleet bus for Dwarka route'
FROM schools s
ON CONFLICT (school_id, registration_number) DO NOTHING;
-- ========================================================================
-- 017_transport_permissions_and_drivers.sql
-- Transport Rights Master, Role-Rights Mappings, Driver Profiles,
-- and Backward-Compatible Numeric User Type Master
-- ========================================================================

-- 1. INSERT STABLE TRANSPORT PERMISSIONS INTO RIGHTS/PERMISSIONS MASTER
INSERT INTO permissions (id, module, action, code, name, description, default_scope_id, is_system) VALUES
    ('30000000-0000-0000-0000-000000000060', 'transport', 'view', 'transport.dashboard.view', 'View Transport Dashboard', 'View fleet KPIs, vehicle metrics and compliance alerts', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000061', 'transport', 'view', 'transport.vehicle.view', 'View Vehicles', 'View school fleet vehicles list and details', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000062', 'transport', 'create', 'transport.vehicle.create', 'Register Vehicle', 'Register new transport fleet vehicles', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000063', 'transport', 'update', 'transport.vehicle.update', 'Update Vehicle', 'Modify vehicle information and maintenance status', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000064', 'transport', 'delete', 'transport.vehicle.delete', 'Delete Vehicle', 'Retire or delete fleet vehicles', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000065', 'transport', 'view', 'transport.driver.view', 'View Drivers', 'View eligible transport drivers and staff', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000066', 'transport', 'assign', 'transport.driver.assign', 'Assign Driver', 'Assign primary/secondary drivers to vehicles', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000067', 'transport', 'view', 'transport.route.view', 'View Routes', 'View transport routes and itineraries', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000068', 'transport', 'create', 'transport.route.create', 'Create Route', 'Create new transport routes', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000069', 'transport', 'update', 'transport.route.update', 'Update Route', 'Edit existing transport routes and parameters', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000070', 'transport', 'delete', 'transport.route.delete', 'Delete Route', 'Deactivate or delete transport routes', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000071', 'transport', 'view', 'transport.route_stops.view', 'View Route Stops', 'View route pickup and drop stop itineraries', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000072', 'transport', 'manage', 'transport.route_stops.manage', 'Manage Route Stops', 'Add, edit, reorder, and remove route stops', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000073', 'transport', 'view', 'transport.student_assignment.view', 'View Student Transport', 'View student route assignments and manifests', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000074', 'transport', 'create', 'transport.student_assignment.create', 'Assign Student Transport', 'Assign enrolled students to transport routes and stops', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000075', 'transport', 'update', 'transport.student_assignment.update', 'Update Student Transport', 'Transfer or end student transport assignments', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000076', 'transport', 'delete', 'transport.student_assignment.delete', 'Delete Student Transport', 'Remove student transport assignments', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000077', 'transport', 'view', 'transport.trip.view', 'View Daily Trips', 'View daily scheduled and completed transport trips', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000078', 'transport', 'manage', 'transport.trip.manage', 'Manage Daily Trips', 'Dispatch, start, complete, and cancel transport trips', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000079', 'transport', 'view', 'transport.gps.view', 'View GPS Tracking', 'View vehicle telemetry and real-time GPS tracking', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000080', 'transport', 'view', 'transport.reports.view', 'View Transport Reports', 'View and export fleet utilization, manifests, and audit reports', '10000000-0000-0000-0000-000000000002', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 2. MAP TRANSPORT RIGHTS TO ROLES
-- A. Platform Super Admin (Full SaaS Governance)
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000001', p.id, '10000000-0000-0000-0000-000000000001'
FROM permissions p
WHERE p.module = 'transport'
ON CONFLICT DO NOTHING;

-- B. School Director (Executive authority across all school locations)
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000002', p.id, '10000000-0000-0000-0000-000000000002'
FROM permissions p
WHERE p.module = 'transport'
ON CONFLICT DO NOTHING;

-- C. School Administrator (Operational authority across permitted branches)
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000003', p.id, '10000000-0000-0000-0000-000000000002'
FROM permissions p
WHERE p.module = 'transport'
ON CONFLICT DO NOTHING;

-- 3. NUMERIC USER TYPE MASTER (STABLE NUMERIC CLASSIFICATION)
-- Serves population & filtering for future modules.
-- Does NOT replace or rewrite existing users.user_type_id or user_types table.
CREATE TABLE IF NOT EXISTS user_type_master (
    id INTEGER PRIMARY KEY,
    type_code VARCHAR(50) NOT NULL UNIQUE,
    type_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO user_type_master (id, type_code, type_name, description, is_active) VALUES
    (1, 'STUDENT', 'Student', 'Enrolled learner in academic sessions', TRUE),
    (2, 'STAFF', 'Staff', 'Academic faculty, administrative, and operational staff', TRUE),
    (3, 'PARENT', 'Parent / Guardian', 'Parent or guardian of enrolled students', TRUE),
    (4, 'OTHER', 'Other / External', 'External affiliates, drivers, and guests', TRUE)
ON CONFLICT (id) DO UPDATE SET
    type_code = EXCLUDED.type_code,
    type_name = EXCLUDED.type_name,
    description = EXCLUDED.description;

-- Add backward-compatible numeric reference on user_types if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_types' AND column_name = 'numeric_id'
    ) THEN
        ALTER TABLE user_types ADD COLUMN numeric_id INTEGER NULL REFERENCES user_type_master(id) ON DELETE SET NULL;
        
        UPDATE user_types SET numeric_id = 1 WHERE code = 'STUDENT';
        UPDATE user_types SET numeric_id = 2 WHERE code IN ('STAFF', 'TEACHER', 'ADMIN', 'DIRECTOR', 'SUPER_ADMIN');
        UPDATE user_types SET numeric_id = 3 WHERE code = 'PARENT';
        UPDATE user_types SET numeric_id = 4 WHERE code = 'OTHER';
    END IF;
END $$;

-- 4. TRANSPORT DRIVER PROFILES TABLE (Specialized Driver Qualification Extension)
CREATE TABLE IF NOT EXISTS transport_driver_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    driver_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    license_number VARCHAR(100) NULL,
    license_type VARCHAR(50) NOT NULL DEFAULT 'COMMERCIAL_HEAVY', -- 'COMMERCIAL_HEAVY', 'LIGHT_VEHICLE', 'BUS'
    license_expiry DATE NULL,
    contact_phone VARCHAR(50) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'SUSPENDED'
    remarks TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_transport_driver_user UNIQUE(school_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_profiles_school ON transport_driver_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_user ON transport_driver_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_status ON transport_driver_profiles(school_id, status);

-- Row Level Security on transport_driver_profiles
ALTER TABLE transport_driver_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_driver_profiles_isolation ON transport_driver_profiles FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

-- 5. SEED DEDICATED DEMO TRANSPORT DRIVER FOR DPA
-- Ensure a verified transport driver exists for DPA testing
DO $$
DECLARE
    dpa_school_id UUID := 'a0000000-0000-0000-0000-000000000001';
    staff_type_id UUID;
    driver_user_id UUID := 'a2000000-0000-0000-0000-000000000099';
    loc_id UUID := 'a1000000-0000-0000-0000-000000000001';
    driver_role_id UUID := '40000000-0000-0000-0000-000000000006'; -- STAFF
BEGIN
    SELECT id INTO staff_type_id FROM user_types WHERE code = 'STAFF' LIMIT 1;

    IF EXISTS (SELECT 1 FROM schools WHERE id = dpa_school_id) THEN
        -- Insert user if not exists
        INSERT INTO users (
            id, school_id, user_type_id, username, email, phone, first_name, last_name, status
        ) VALUES (
            driver_user_id,
            dpa_school_id,
            staff_type_id,
            'ramesh.driver',
            'ramesh.driver@dpa.edu',
            '+91 98101 23456',
            'Ramesh',
            'Chandra (Driver)',
            'ACTIVE'
        )
        ON CONFLICT (id) DO NOTHING;

        -- Link location
        INSERT INTO user_location_access (id, user_id, location_id, school_id, is_primary)
        VALUES (gen_random_uuid(), driver_user_id, loc_id, dpa_school_id, TRUE)
        ON CONFLICT DO NOTHING;

        -- Link role
        INSERT INTO user_roles (id, user_id, role_id, school_id)
        VALUES (gen_random_uuid(), driver_user_id, driver_role_id, dpa_school_id)
        ON CONFLICT DO NOTHING;

        -- Create Transport Driver Profile
        INSERT INTO transport_driver_profiles (
            school_id, user_id, driver_eligible, license_number, license_type, license_expiry, contact_phone, status, remarks
        ) VALUES (
            dpa_school_id,
            driver_user_id,
            TRUE,
            'DL-04-2021-0091823',
            'COMMERCIAL_HEAVY',
            '2030-05-31',
            '+91 98101 23456',
            'ACTIVE',
            'Certified heavy passenger vehicle driver for DPA fleet'
        )
        ON CONFLICT (school_id, user_id) DO UPDATE SET
            driver_eligible = TRUE,
            license_number = EXCLUDED.license_number,
            license_expiry = EXCLUDED.license_expiry,
            status = 'ACTIVE';
    END IF;
END $$;
-- ========================================================================
-- 018_inventory_order_management.sql
-- Complete Inventory & Order Management Module Schema
-- Supports Products, SKUs, Categories, Subcategories, UOMs, Brands, Vendors,
-- Multi-Location Stock Tracking, Append-Only Stock Ledger,
-- Purchase Orders (with partial/full receive), and Sales Orders (with partial/full fulfill)
-- ========================================================================

-- 1. INVENTORY CATEGORIES MASTER TABLE
CREATE TABLE IF NOT EXISTS inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_category_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inv_cat_school ON inventory_categories(school_id);
CREATE INDEX IF NOT EXISTS idx_inv_cat_status ON inventory_categories(school_id, status);

-- 2. INVENTORY SUBCATEGORIES MASTER TABLE
CREATE TABLE IF NOT EXISTS inventory_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES inventory_categories(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_subcat_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inv_subcat_school ON inventory_subcategories(school_id);
CREATE INDEX IF NOT EXISTS idx_inv_subcat_cat ON inventory_subcategories(category_id);

-- 3. UNITS OF MEASURE (UOM) MASTER TABLE
CREATE TABLE IF NOT EXISTS inventory_uoms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    is_fractional BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_uom_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inv_uom_school ON inventory_uoms(school_id);

-- 4. BRANDS MASTER TABLE
CREATE TABLE IF NOT EXISTS inventory_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_brand_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inv_brand_school ON inventory_brands(school_id);

-- 5. VENDORS / SUPPLIERS MASTER TABLE
CREATE TABLE IF NOT EXISTS inventory_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(150) NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(50) NULL,
    address TEXT NULL,
    tax_id VARCHAR(50) NULL, -- GSTIN / Tax Identification
    payment_terms VARCHAR(100) NULL, -- Net 15, Net 30, COD, Advance
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_vendor_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inv_vendor_school ON inventory_vendors(school_id);
CREATE INDEX IF NOT EXISTS idx_inv_vendor_status ON inventory_vendors(school_id, status);

-- 6. PRODUCTS MASTER TABLE (General Product Definition)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    category_id UUID NULL REFERENCES inventory_categories(id) ON DELETE SET NULL,
    subcategory_id UUID NULL REFERENCES inventory_subcategories(id) ON DELETE SET NULL,
    uom_id UUID NULL REFERENCES inventory_uoms(id) ON DELETE SET NULL,
    brand_id UUID NULL REFERENCES inventory_brands(id) ON DELETE SET NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_product_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_products_school ON products(school_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(school_id, status);

-- 7. SKUs MASTER TABLE (Distinct Inventory Item & Pricing)
CREATE TABLE IF NOT EXISTS skus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku_code VARCHAR(100) NOT NULL,
    barcode VARCHAR(100) NULL,
    reorder_level NUMERIC(10,2) NOT NULL DEFAULT 10,
    min_order_qty NUMERIC(10,2) NOT NULL DEFAULT 1,
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_sku_code UNIQUE(school_id, sku_code)
);

CREATE INDEX IF NOT EXISTS idx_skus_school ON skus(school_id);
CREATE INDEX IF NOT EXISTS idx_skus_product ON skus(product_id);
CREATE INDEX IF NOT EXISTS idx_skus_barcode ON skus(school_id, barcode);

-- 8. INVENTORY STOCK TABLE (Materialized Stock Balance per SKU & Location)
CREATE TABLE IF NOT EXISTS inventory_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    reserved_quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    min_quantity NUMERIC(10,2) NOT NULL DEFAULT 5,
    reorder_point NUMERIC(10,2) NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inv_stock_location_sku UNIQUE(school_id, location_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_stock_school_loc ON inventory_stock(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inv_stock_sku ON inventory_stock(sku_id);

-- 9. INVENTORY STOCK LEDGER (Append-Only Immutable Audit Trail of Physical Changes)
CREATE TABLE IF NOT EXISTS inventory_stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL, -- 'OPENING', 'STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'PURCHASE_RECEIPT', 'SALES_FULFILLMENT', 'RETURN'
    reference_type VARCHAR(50) NOT NULL, -- 'OPENING_STOCK', 'PURCHASE_ORDER', 'SALES_ORDER', 'STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT'
    reference_id UUID NULL,
    quantity NUMERIC(12,2) NOT NULL, -- +ve for in/increase, -ve for out/decrease
    previous_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    new_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_ledger_school_loc ON inventory_stock_ledger(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_sku ON inventory_stock_ledger(sku_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_created ON inventory_stock_ledger(school_id, created_at DESC);

-- 10. PURCHASE ORDERS TABLE (PO Intent to Purchase)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    po_number VARCHAR(50) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES inventory_vendors(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_po_number UNIQUE(school_id, po_number)
);

CREATE INDEX IF NOT EXISTS idx_po_school_loc ON purchase_orders(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(school_id, status);

-- 11. PURCHASE ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity_ordered NUMERIC(12,2) NOT NULL,
    quantity_received NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_sku ON purchase_order_items(sku_id);

-- 12. SALES ORDERS TABLE (SO Intent to Sell / Issue)
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    so_number VARCHAR(50) NOT NULL,
    customer_type VARCHAR(30) NOT NULL DEFAULT 'STUDENT', -- 'STUDENT', 'STAFF', 'PARENT', 'EXTERNAL'
    customer_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(150) NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'PARTIALLY_PAID', 'WAIVED'
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_so_number UNIQUE(school_id, so_number)
);

CREATE INDEX IF NOT EXISTS idx_so_school_loc ON sales_orders(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_so_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_status ON sales_orders(school_id, status);

-- 13. SALES ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    so_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity_ordered NUMERIC(12,2) NOT NULL,
    quantity_fulfilled NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_so_items_so ON sales_order_items(so_id);
CREATE INDEX IF NOT EXISTS idx_so_items_sku ON sales_order_items(sku_id);

-- 14. STOCK IN TRANSACTIONS (Goods Receipt Note)
CREATE TABLE IF NOT EXISTS inventory_stock_in (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    receipt_number VARCHAR(50) NOT NULL,
    vendor_id UUID NULL REFERENCES inventory_vendors(id) ON DELETE SET NULL,
    po_id UUID NULL REFERENCES purchase_orders(id) ON DELETE SET NULL,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_in_receipt UNIQUE(school_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_in_school_loc ON inventory_stock_in(school_id, location_id);

CREATE TABLE IF NOT EXISTS inventory_stock_in_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_in_id UUID NOT NULL REFERENCES inventory_stock_in(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remarks TEXT NULL
);

-- 15. STOCK OUT TRANSACTIONS (Goods Issue Note)
CREATE TABLE IF NOT EXISTS inventory_stock_out (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    issue_number VARCHAR(50) NOT NULL,
    so_id UUID NULL REFERENCES sales_orders(id) ON DELETE SET NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    issued_to_type VARCHAR(50) NULL, -- 'STUDENT', 'STAFF', 'DEPARTMENT', 'GENERAL'
    issued_to_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_out_issue UNIQUE(school_id, issue_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_out_school_loc ON inventory_stock_out(school_id, location_id);

CREATE TABLE IF NOT EXISTS inventory_stock_out_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_out_id UUID NOT NULL REFERENCES inventory_stock_out(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,2) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remarks TEXT NULL
);

-- 16. STOCK ADJUSTMENTS TABLE
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    adjustment_number VARCHAR(50) NOT NULL,
    adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason VARCHAR(100) NOT NULL, -- 'DAMAGE', 'AUDIT_CORRECTION', 'EXPIRED', 'FOUND', 'OTHER'
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_adjustment_number UNIQUE(school_id, adjustment_number)
);

CREATE INDEX IF NOT EXISTS idx_adjustment_school_loc ON inventory_adjustments(school_id, location_id);

CREATE TABLE IF NOT EXISTS inventory_adjustment_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id UUID NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    adjustment_type VARCHAR(20) NOT NULL, -- 'INCREASE', 'DECREASE'
    quantity NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remarks TEXT NULL
);

-- 17. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_uoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_in_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_out ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_out_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustment_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_inv_cat_isolation ON inventory_categories FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_inv_subcat_isolation ON inventory_subcategories FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_inv_uom_isolation ON inventory_uoms FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_inv_brand_isolation ON inventory_brands FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_inv_vendor_isolation ON inventory_vendors FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_products_isolation ON products FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_skus_isolation ON skus FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_inv_stock_isolation ON inventory_stock FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_inv_ledger_isolation ON inventory_stock_ledger FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_po_isolation ON purchase_orders FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_so_isolation ON sales_orders FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_stock_in_isolation ON inventory_stock_in FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_stock_out_isolation ON inventory_stock_out FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_adjustments_isolation ON inventory_adjustments FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

-- 18. INSERT INVENTORY PERMISSIONS INTO PERMISSIONS MASTER
INSERT INTO permissions (id, module, action, code, name, description, default_scope_id, is_system) VALUES
    ('30000000-0000-0000-0000-000000000090', 'inventory', 'view', 'inventory.dashboard.view', 'View Inventory Dashboard', 'View stock KPIs, valuation, and reorder metrics', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000091', 'inventory', 'view', 'inventory.product.view', 'View Products', 'View master product catalog', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000092', 'inventory', 'create', 'inventory.product.create', 'Create Product', 'Add new master product catalog definitions', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000093', 'inventory', 'update', 'inventory.product.update', 'Update Product', 'Edit product specifications and categories', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000094', 'inventory', 'delete', 'inventory.product.delete', 'Delete Product', 'Retire or delete products', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000095', 'inventory', 'view', 'inventory.sku.view', 'View SKUs', 'View inventory SKUs, barcodes and price points', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000096', 'inventory', 'create', 'inventory.sku.create', 'Create SKU', 'Define new stock keeping units', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000097', 'inventory', 'update', 'inventory.sku.update', 'Update SKU', 'Modify SKU pricing, barcode and parameters', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000098', 'inventory', 'delete', 'inventory.sku.delete', 'Delete SKU', 'Remove inventory SKUs', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000099', 'inventory', 'manage', 'inventory.taxonomy.manage', 'Manage Inventory Taxonomy', 'Manage Categories, Subcategories, UOMs, and Brands', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000100', 'inventory', 'manage', 'inventory.vendor.manage', 'Manage Vendors', 'Add, update and deactivate suppliers and vendors', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000101', 'inventory', 'view', 'inventory.stock.view', 'View Stock Balances', 'View real-time stock levels across branches', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000102', 'inventory', 'manage', 'inventory.stock.manage', 'Manage Stock Movements', 'Manage Opening Stock, Stock In, Stock Out, and Adjustments', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000103', 'inventory', 'view', 'inventory.ledger.view', 'View Stock Ledger', 'Inspect immutable audit trail of stock movements', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000104', 'inventory', 'view', 'inventory.purchase_order.view', 'View Purchase Orders', 'View POs, line items, and fulfillment history', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000105', 'inventory', 'manage', 'inventory.purchase_order.manage', 'Manage Purchase Orders', 'Create, approve, and receive PO shipments', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000106', 'inventory', 'view', 'inventory.sales_order.view', 'View Sales Orders', 'View SOs, requisitions, and fulfillment history', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000107', 'inventory', 'manage', 'inventory.sales_order.manage', 'Manage Sales Orders', 'Create, confirm, and fulfill student/staff sales orders', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000108', 'inventory', 'view', 'inventory.reports.view', 'View Inventory Reports', 'Generate stock valuation, movement and reorder reports', '10000000-0000-0000-0000-000000000002', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 19. MAP INVENTORY RIGHTS TO ROLES
-- Platform Super Admin
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000001', p.id, '10000000-0000-0000-0000-000000000001'
FROM permissions p
WHERE p.module = 'inventory'
ON CONFLICT DO NOTHING;

-- School Director
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000002', p.id, '10000000-0000-0000-0000-000000000002'
FROM permissions p
WHERE p.module = 'inventory'
ON CONFLICT DO NOTHING;

-- School Administrator
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000003', p.id, '10000000-0000-0000-0000-000000000002'
FROM permissions p
WHERE p.module = 'inventory'
ON CONFLICT DO NOTHING;
-- ========================================================================
-- 019_inventory_architecture_correction.sql
-- Inventory Architecture Correction & SKU Master Consolidation
-- 1. Makes product_id nullable on skus table (SKU is now the standalone item master)
-- 2. Adds direct catalog & metadata columns to skus (sku_name, category_id, subcategory_id,
--    brand_id, uom_id, description, alternate_barcode, max_stock, attributes)
-- 3. Backfills existing skus from products without data loss
-- 4. Preserves products table for backward compatibility (no destructive drops)
-- 5. Configures default school currency (INR) and optimizes indexes
-- ========================================================================

-- 1. ALLOW SKUS TO EXIST STANDALONE (product_id optional)
ALTER TABLE skus ALTER COLUMN product_id DROP NOT NULL;

-- 2. ADD CATALOG, TAXONOMY, METADATA & FLEXIBLE ATTRIBUTES DIRECTLY TO SKUS
ALTER TABLE skus ADD COLUMN IF NOT EXISTS sku_name VARCHAR(200);
ALTER TABLE skus ADD COLUMN IF NOT EXISTS alternate_barcode VARCHAR(100);
ALTER TABLE skus ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES inventory_subcategories(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES inventory_uoms(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES inventory_brands(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS max_stock NUMERIC(12,2) NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. BACKFILL EXISTING SKUS FROM ASSOCIATED PRODUCTS
UPDATE skus s
SET sku_name = COALESCE(s.sku_name, p.name),
    category_id = COALESCE(s.category_id, p.category_id),
    subcategory_id = COALESCE(s.subcategory_id, p.subcategory_id),
    uom_id = COALESCE(s.uom_id, p.uom_id),
    brand_id = COALESCE(s.brand_id, p.brand_id),
    description = COALESCE(s.description, p.description)
FROM products p
WHERE s.product_id = p.id;

-- Fallback for any SKU that had no product or missing name
UPDATE skus
SET sku_name = sku_code
WHERE sku_name IS NULL OR sku_name = '';

-- 4. PERFORMANCE INDEXES ON NEW SKU COLUMNS
CREATE INDEX IF NOT EXISTS idx_skus_name ON skus(school_id, sku_name);
CREATE INDEX IF NOT EXISTS idx_skus_category ON skus(category_id);
CREATE INDEX IF NOT EXISTS idx_skus_subcategory ON skus(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_skus_brand ON skus(brand_id);
CREATE INDEX IF NOT EXISTS idx_skus_uom ON skus(uom_id);
CREATE INDEX IF NOT EXISTS idx_skus_alt_barcode ON skus(school_id, alternate_barcode);
CREATE INDEX IF NOT EXISTS idx_skus_attributes ON skus USING gin(attributes);

-- 5. ENSURE CENTRAL SCHOOL CURRENCY DEFAULTS TO INR
UPDATE schools
SET currency = 'INR'
WHERE currency IS NULL OR currency = '';
-- ========================================================================
-- 020_inventory_complete_setup.sql
-- COMPLETE, IDEMPOTENT INVENTORY & ORDER MANAGEMENT SETUP SCRIPT
-- Safe to run in Supabase SQL Editor on fresh or existing databases.
-- Combines base tables, standalone SKU architecture, RLS, and permissions.
-- ========================================================================

-- 0. HELPER FUNCTIONS FOR MULTI-TENANT RLS (Safe Fallbacks)
CREATE OR REPLACE FUNCTION current_school_id() 
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_school_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION is_platform_super_admin() 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(NULLIF(current_setting('app.is_super_admin', true), '')::BOOLEAN, FALSE);
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- 1. INVENTORY CATEGORIES
CREATE TABLE IF NOT EXISTS inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_category_code UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_inv_cat_school ON inventory_categories(school_id);
CREATE INDEX IF NOT EXISTS idx_inv_cat_status ON inventory_categories(school_id, status);

-- 2. INVENTORY SUBCATEGORIES
CREATE TABLE IF NOT EXISTS inventory_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES inventory_categories(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_subcat_code UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_inv_subcat_school ON inventory_subcategories(school_id);
CREATE INDEX IF NOT EXISTS idx_inv_subcat_cat ON inventory_subcategories(category_id);

-- 3. UNITS OF MEASURE (UOM)
CREATE TABLE IF NOT EXISTS inventory_uoms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    is_fractional BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_uom_code UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_inv_uom_school ON inventory_uoms(school_id);

-- 4. BRANDS / MANUFACTURERS
CREATE TABLE IF NOT EXISTS inventory_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_brand_code UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_inv_brand_school ON inventory_brands(school_id);

-- 5. VENDORS / SUPPLIERS
CREATE TABLE IF NOT EXISTS inventory_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(150) NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(50) NULL,
    address TEXT NULL,
    tax_id VARCHAR(50) NULL,
    payment_terms VARCHAR(100) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_vendor_code UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_inv_vendor_school ON inventory_vendors(school_id);
CREATE INDEX IF NOT EXISTS idx_inv_vendor_status ON inventory_vendors(school_id, status);

-- 6. PRODUCTS TABLE (Backward-compatible catalog grouping)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    category_id UUID NULL REFERENCES inventory_categories(id) ON DELETE SET NULL,
    subcategory_id UUID NULL REFERENCES inventory_subcategories(id) ON DELETE SET NULL,
    uom_id UUID NULL REFERENCES inventory_uoms(id) ON DELETE SET NULL,
    brand_id UUID NULL REFERENCES inventory_brands(id) ON DELETE SET NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_product_code UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_products_school ON products(school_id);

-- 7. SKUs MASTER TABLE (Single Item Master)
CREATE TABLE IF NOT EXISTS skus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    product_id UUID NULL REFERENCES products(id) ON DELETE SET NULL,
    sku_name VARCHAR(200) NULL,
    sku_code VARCHAR(100) NOT NULL,
    barcode VARCHAR(100) NULL,
    alternate_barcode VARCHAR(100) NULL,
    category_id UUID NULL REFERENCES inventory_categories(id) ON DELETE SET NULL,
    subcategory_id UUID NULL REFERENCES inventory_subcategories(id) ON DELETE SET NULL,
    uom_id UUID NULL REFERENCES inventory_uoms(id) ON DELETE SET NULL,
    brand_id UUID NULL REFERENCES inventory_brands(id) ON DELETE SET NULL,
    description TEXT NULL,
    reorder_level NUMERIC(10,2) NOT NULL DEFAULT 10,
    min_order_qty NUMERIC(10,2) NOT NULL DEFAULT 1,
    max_stock NUMERIC(12,2) NULL,
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_sku_code UNIQUE(school_id, sku_code)
);

-- Ensure skus columns exist if table was previously created with 018
ALTER TABLE skus ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS sku_name VARCHAR(200);
ALTER TABLE skus ADD COLUMN IF NOT EXISTS alternate_barcode VARCHAR(100);
ALTER TABLE skus ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES inventory_subcategories(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES inventory_uoms(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES inventory_brands(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS max_stock NUMERIC(12,2) NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill from products if sku_name is empty
UPDATE skus s
SET sku_name = COALESCE(s.sku_name, p.name),
    category_id = COALESCE(s.category_id, p.category_id),
    subcategory_id = COALESCE(s.subcategory_id, p.subcategory_id),
    uom_id = COALESCE(s.uom_id, p.uom_id),
    brand_id = COALESCE(s.brand_id, p.brand_id),
    description = COALESCE(s.description, p.description)
FROM products p
WHERE s.product_id = p.id;

UPDATE skus SET sku_name = sku_code WHERE sku_name IS NULL OR sku_name = '';

CREATE INDEX IF NOT EXISTS idx_skus_school ON skus(school_id);
CREATE INDEX IF NOT EXISTS idx_skus_name ON skus(school_id, sku_name);
CREATE INDEX IF NOT EXISTS idx_skus_category ON skus(category_id);
CREATE INDEX IF NOT EXISTS idx_skus_barcode ON skus(school_id, barcode);
CREATE INDEX IF NOT EXISTS idx_skus_alt_barcode ON skus(school_id, alternate_barcode);
CREATE INDEX IF NOT EXISTS idx_skus_attributes ON skus USING gin(attributes);

-- 8. INVENTORY STOCK BALANCES
CREATE TABLE IF NOT EXISTS inventory_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    reserved_quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    min_quantity NUMERIC(10,2) NOT NULL DEFAULT 5,
    reorder_point NUMERIC(10,2) NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inv_stock_location_sku UNIQUE(school_id, location_id, sku_id)
);
CREATE INDEX IF NOT EXISTS idx_inv_stock_school_loc ON inventory_stock(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inv_stock_sku ON inventory_stock(sku_id);

-- 9. INVENTORY STOCK LEDGER (Append-Only Audit Trail)
CREATE TABLE IF NOT EXISTS inventory_stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    reference_id UUID NULL,
    quantity NUMERIC(12,2) NOT NULL,
    previous_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    new_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_school_loc ON inventory_stock_ledger(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_sku ON inventory_stock_ledger(sku_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_created ON inventory_stock_ledger(school_id, created_at DESC);

-- 10. PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    po_number VARCHAR(50) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES inventory_vendors(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_po_number UNIQUE(school_id, po_number)
);
CREATE INDEX IF NOT EXISTS idx_po_school_loc ON purchase_orders(school_id, location_id);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity_ordered NUMERIC(12,2) NOT NULL,
    quantity_received NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);

-- 11. SALES ORDERS
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    so_number VARCHAR(50) NOT NULL,
    customer_type VARCHAR(30) NOT NULL DEFAULT 'STUDENT',
    customer_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(150) NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_so_number UNIQUE(school_id, so_number)
);
CREATE INDEX IF NOT EXISTS idx_so_school_loc ON sales_orders(school_id, location_id);

CREATE TABLE IF NOT EXISTS sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    so_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity_ordered NUMERIC(12,2) NOT NULL,
    quantity_fulfilled NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_so_items_so ON sales_order_items(so_id);

-- 12. STOCK IN (Goods Receipt)
CREATE TABLE IF NOT EXISTS inventory_stock_in (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    receipt_number VARCHAR(50) NOT NULL,
    vendor_id UUID NULL REFERENCES inventory_vendors(id) ON DELETE SET NULL,
    po_id UUID NULL REFERENCES purchase_orders(id) ON DELETE SET NULL,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_in_receipt UNIQUE(school_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS inventory_stock_in_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_in_id UUID NOT NULL REFERENCES inventory_stock_in(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remarks TEXT NULL
);

-- 13. STOCK OUT (Goods Issue)
CREATE TABLE IF NOT EXISTS inventory_stock_out (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    issue_number VARCHAR(50) NOT NULL,
    so_id UUID NULL REFERENCES sales_orders(id) ON DELETE SET NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    issued_to_type VARCHAR(50) NULL,
    issued_to_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_out_issue UNIQUE(school_id, issue_number)
);

CREATE TABLE IF NOT EXISTS inventory_stock_out_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_out_id UUID NOT NULL REFERENCES inventory_stock_out(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,2) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remarks TEXT NULL
);

-- 14. STOCK ADJUSTMENTS
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    adjustment_number VARCHAR(50) NOT NULL,
    adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason VARCHAR(100) NOT NULL,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_adjustment_number UNIQUE(school_id, adjustment_number)
);

CREATE TABLE IF NOT EXISTS inventory_adjustment_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id UUID NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    adjustment_type VARCHAR(20) NOT NULL,
    quantity NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remarks TEXT NULL
);

-- 15. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_uoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_in_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_out ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_out_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustment_details ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS: Drop policy if exists before recreating
DROP POLICY IF EXISTS p_inv_cat_isolation ON inventory_categories;
CREATE POLICY p_inv_cat_isolation ON inventory_categories FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_inv_subcat_isolation ON inventory_subcategories;
CREATE POLICY p_inv_subcat_isolation ON inventory_subcategories FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_inv_uom_isolation ON inventory_uoms;
CREATE POLICY p_inv_uom_isolation ON inventory_uoms FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_inv_brand_isolation ON inventory_brands;
CREATE POLICY p_inv_brand_isolation ON inventory_brands FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_inv_vendor_isolation ON inventory_vendors;
CREATE POLICY p_inv_vendor_isolation ON inventory_vendors FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_products_isolation ON products;
CREATE POLICY p_products_isolation ON products FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_skus_isolation ON skus;
CREATE POLICY p_skus_isolation ON skus FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_inv_stock_isolation ON inventory_stock;
CREATE POLICY p_inv_stock_isolation ON inventory_stock FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_inv_ledger_isolation ON inventory_stock_ledger;
CREATE POLICY p_inv_ledger_isolation ON inventory_stock_ledger FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_po_isolation ON purchase_orders;
CREATE POLICY p_po_isolation ON purchase_orders FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_so_isolation ON sales_orders;
CREATE POLICY p_so_isolation ON sales_orders FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_stock_in_isolation ON inventory_stock_in;
CREATE POLICY p_stock_in_isolation ON inventory_stock_in FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_stock_out_isolation ON inventory_stock_out;
CREATE POLICY p_stock_out_isolation ON inventory_stock_out FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_adjustments_isolation ON inventory_adjustments;
CREATE POLICY p_adjustments_isolation ON inventory_adjustments FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

-- 16. INVENTORY PERMISSIONS
INSERT INTO permissions (id, module, action, code, name, description, default_scope_id, is_system) VALUES
    ('30000000-0000-0000-0000-000000000090', 'inventory', 'view', 'inventory.dashboard.view', 'View Inventory Dashboard', 'View stock KPIs, valuation, and reorder metrics', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000091', 'inventory', 'view', 'inventory.product.view', 'View Products', 'View master product catalog', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000092', 'inventory', 'create', 'inventory.product.create', 'Create Product', 'Add new master product catalog definitions', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000093', 'inventory', 'update', 'inventory.product.update', 'Update Product', 'Edit product specifications and categories', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000094', 'inventory', 'delete', 'inventory.product.delete', 'Delete Product', 'Retire or delete products', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000095', 'inventory', 'view', 'inventory.sku.view', 'View SKUs', 'View inventory SKUs, barcodes and price points', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000096', 'inventory', 'create', 'inventory.sku.create', 'Create SKU', 'Define new stock keeping units', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000097', 'inventory', 'update', 'inventory.sku.update', 'Update SKU', 'Modify SKU pricing, barcode and parameters', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000098', 'inventory', 'delete', 'inventory.sku.delete', 'Delete SKU', 'Remove inventory SKUs', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000099', 'inventory', 'manage', 'inventory.taxonomy.manage', 'Manage Inventory Taxonomy', 'Manage Categories, Subcategories, UOMs, and Brands', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000100', 'inventory', 'manage', 'inventory.vendor.manage', 'Manage Vendors', 'Add, update and deactivate suppliers and vendors', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000101', 'inventory', 'view', 'inventory.stock.view', 'View Stock Balances', 'View real-time stock levels across branches', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000102', 'inventory', 'manage', 'inventory.stock.manage', 'Manage Stock Movements', 'Manage Opening Stock, Stock In, Stock Out, and Adjustments', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000103', 'inventory', 'view', 'inventory.ledger.view', 'View Stock Ledger', 'Inspect immutable audit trail of stock movements', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000104', 'inventory', 'view', 'inventory.purchase_order.view', 'View Purchase Orders', 'View POs, line items, and fulfillment history', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000105', 'inventory', 'manage', 'inventory.purchase_order.manage', 'Manage Purchase Orders', 'Create, approve, and receive PO shipments', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000106', 'inventory', 'view', 'inventory.sales_order.view', 'View Sales Orders', 'View SOs, requisitions, and fulfillment history', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000107', 'inventory', 'manage', 'inventory.sales_order.manage', 'Manage Sales Orders', 'Create, confirm, and fulfill student/staff sales orders', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000108', 'inventory', 'view', 'inventory.reports.view', 'View Inventory Reports', 'Generate stock valuation, movement and reorder reports', '10000000-0000-0000-0000-000000000002', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 17. ROLE PERMISSION ASSIGNMENTS
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000001', p.id, '10000000-0000-0000-0000-000000000001'
FROM permissions p WHERE p.module = 'inventory'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000002', p.id, '10000000-0000-0000-0000-000000000002'
FROM permissions p WHERE p.module = 'inventory'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000003', p.id, '10000000-0000-0000-0000-000000000002'
FROM permissions p WHERE p.module = 'inventory'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 18. DEFAULT SCHOOL CURRENCY TO INR
UPDATE schools
SET currency = 'INR'
WHERE currency IS NULL OR currency = '';
-- ========================================================================
-- Migration 021: Asset Management Module Schema
-- Physical asset tracking: categories, master, assignment history,
-- movements/transfers, maintenance lifecycle, and disposal records
-- ========================================================================

-- 1. Asset Categories Table
CREATE TABLE IF NOT EXISTS asset_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_asset_cat_school_code UNIQUE (school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_asset_cat_school ON asset_categories(school_id);
CREATE INDEX IF NOT EXISTS idx_asset_cat_active ON asset_categories(school_id, is_active) WHERE deleted_at IS NULL;

-- 2. Asset Subcategories Table
CREATE TABLE IF NOT EXISTS asset_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_asset_subcat_school_cat_code UNIQUE (school_id, category_id, code)
);

CREATE INDEX IF NOT EXISTS idx_asset_subcat_category ON asset_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_asset_subcat_school ON asset_subcategories(school_id);

-- 3. Assets Master Table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_code VARCHAR(50) NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    category_id UUID NOT NULL REFERENCES asset_categories(id),
    subcategory_id UUID REFERENCES asset_subcategories(id),
    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    barcode VARCHAR(100),
    asset_tag VARCHAR(100),
    description TEXT,
    purchase_date DATE,
    purchase_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    vendor_id UUID REFERENCES inventory_vendors(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    invoice_number VARCHAR(100),
    invoice_date DATE,
    warranty_start_date DATE,
    warranty_end_date DATE,
    current_location_id UUID NOT NULL REFERENCES locations(id),
    building VARCHAR(100),
    floor VARCHAR(50),
    room VARCHAR(100),
    room_number VARCHAR(50),
    area VARCHAR(100),
    rack VARCHAR(50),
    seat_desk VARCHAR(50),
    current_custodian_user_id UUID REFERENCES users(id),
    condition VARCHAR(30) NOT NULL DEFAULT 'NEW' CHECK (condition IN ('NEW', 'GOOD', 'FAIR', 'DAMAGED', 'CRITICAL')),
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ASSIGNED', 'UNDER_MAINTENANCE', 'DAMAGED', 'LOST', 'DISPOSED', 'RETIRED')),
    remarks TEXT,
    useful_life_years NUMERIC(5, 2),
    salvage_value NUMERIC(15, 2) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_assets_school_code UNIQUE (school_id, asset_code)
);

CREATE INDEX IF NOT EXISTS idx_assets_school ON assets(school_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(current_location_id);
CREATE INDEX IF NOT EXISTS idx_assets_custodian ON assets(current_custodian_user_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(school_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_condition ON assets(school_id, condition);
CREATE INDEX IF NOT EXISTS idx_assets_barcode ON assets(school_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_serial ON assets(school_id, serial_number) WHERE serial_number IS NOT NULL;

-- 4. Asset Assignments Table (Historical Custody & Returns)
CREATE TABLE IF NOT EXISTS asset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    assigned_to_user_id UUID NOT NULL REFERENCES users(id),
    location_id UUID REFERENCES locations(id),
    assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_return_date DATE,
    actual_return_date DATE,
    condition_at_assignment VARCHAR(30) NOT NULL DEFAULT 'GOOD',
    condition_at_return VARCHAR(30),
    remarks TEXT,
    assigned_by UUID REFERENCES users(id),
    returned_by UUID REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_assign_asset ON asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assign_user ON asset_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_asset_assign_active ON asset_assignments(asset_id, is_active);

-- 5. Asset Movement / Transfer Table
CREATE TABLE IF NOT EXISTS asset_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    from_location_id UUID REFERENCES locations(id),
    to_location_id UUID NOT NULL REFERENCES locations(id),
    from_building VARCHAR(100),
    to_building VARCHAR(100),
    from_room VARCHAR(100),
    to_room VARCHAR(100),
    from_user_id UUID REFERENCES users(id),
    to_user_id UUID REFERENCES users(id),
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason VARCHAR(255),
    condition VARCHAR(30),
    remarks TEXT,
    moved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_mov_asset ON asset_movements(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_mov_school ON asset_movements(school_id);

-- 6. Asset Maintenance Table
CREATE TABLE IF NOT EXISTS asset_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(50) NOT NULL DEFAULT 'REPAIR',
    service_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor_id UUID REFERENCES inventory_vendors(id),
    service_provider VARCHAR(255),
    issue_description TEXT NOT NULL,
    work_performed TEXT,
    cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    next_service_date DATE,
    warranty_claim BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    previous_asset_status VARCHAR(30),
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_maint_asset ON asset_maintenance(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maint_status ON asset_maintenance(school_id, status);

-- 7. Asset Disposals Table
CREATE TABLE IF NOT EXISTS asset_disposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    disposal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    disposal_reason VARCHAR(100) NOT NULL,
    disposal_method VARCHAR(100) NOT NULL,
    disposal_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    approved_by UUID REFERENCES users(id),
    document_url TEXT,
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asset_disposal_asset UNIQUE (asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_disp_asset ON asset_disposals(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_disp_school ON asset_disposals(school_id);

-- 8. Asset Documents Table
CREATE TABLE IF NOT EXISTS asset_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_docs_asset ON asset_documents(asset_id);

-- 9. Row Level Security (RLS)
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_disposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_categories_tenant_isolation ON asset_categories
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY asset_subcategories_tenant_isolation ON asset_subcategories
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY assets_tenant_isolation ON assets
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY asset_assignments_tenant_isolation ON asset_assignments
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY asset_movements_tenant_isolation ON asset_movements
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY asset_maintenance_tenant_isolation ON asset_maintenance
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY asset_disposals_tenant_isolation ON asset_disposals
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY asset_documents_tenant_isolation ON asset_documents
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);
-- ============================================================================
-- Migration: 022_library_management.sql
-- Description: Complete Library Management Module schema for multi-tenant SaaS
-- Tables:
--   1. library_settings
--   2. library_categories
--   3. library_authors
--   4. library_publishers
--   5. library_books
--   6. library_book_authors
--   7. library_book_copies
--   8. library_members
--   9. library_issues
--  10. library_reservations
--  11. library_fines
--  12. library_lost_damaged
-- ============================================================================

-- 1. Library Settings
CREATE TABLE IF NOT EXISTS library_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    loan_period_days INTEGER NOT NULL DEFAULT 14,
    maximum_books_per_member INTEGER NOT NULL DEFAULT 3,
    student_issue_limit INTEGER NOT NULL DEFAULT 3,
    staff_issue_limit INTEGER NOT NULL DEFAULT 5,
    maximum_renewals INTEGER NOT NULL DEFAULT 2,
    fine_per_day NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    grace_period_days INTEGER NOT NULL DEFAULT 1,
    reservation_enabled BOOLEAN NOT NULL DEFAULT true,
    reservation_expiry_days INTEGER NOT NULL DEFAULT 7,
    auto_fine_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_library_settings_school UNIQUE (school_id)
);

-- 2. Library Categories
CREATE TABLE IF NOT EXISTS library_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_library_category_name UNIQUE (school_id, name)
);

-- 3. Library Authors
CREATE TABLE IF NOT EXISTS library_authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    biography TEXT,
    remarks TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Library Publishers
CREATE TABLE IF NOT EXISTS library_publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    contact VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(50),
    address TEXT,
    website VARCHAR(255),
    remarks TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Library Books (Bibliographic / Master Record)
CREATE TABLE IF NOT EXISTS library_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    accession_reference VARCHAR(100),
    isbn VARCHAR(30),
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    category_id UUID NOT NULL REFERENCES library_categories(id) ON DELETE RESTRICT,
    publisher_id UUID REFERENCES library_publishers(id) ON DELETE SET NULL,
    publication_year INTEGER,
    edition VARCHAR(50),
    language VARCHAR(50) NOT NULL DEFAULT 'English',
    pages INTEGER,
    description TEXT,
    subject VARCHAR(100),
    class_level VARCHAR(50),
    cover_image TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Book Authors (Many-to-Many)
CREATE TABLE IF NOT EXISTS library_book_authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES library_authors(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_book_author UNIQUE (book_id, author_id)
);

-- 7. Book Copies (Physical Holdings)
CREATE TABLE IF NOT EXISTS library_book_copies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    copy_code VARCHAR(50) NOT NULL,
    accession_number VARCHAR(50),
    barcode VARCHAR(50),
    purchase_date DATE,
    purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    vendor_id UUID REFERENCES inventory_vendors(id) ON DELETE SET NULL,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    room VARCHAR(50),
    shelf VARCHAR(50),
    rack VARCHAR(50),
    condition VARCHAR(20) NOT NULL DEFAULT 'GOOD',
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    remarks TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_book_copy_code UNIQUE (school_id, copy_code)
);

-- 8. Library Members (Uses Universal Users)
CREATE TABLE IF NOT EXISTS library_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    membership_number VARCHAR(50) NOT NULL,
    membership_type VARCHAR(20) NOT NULL DEFAULT 'STUDENT',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    max_books_allowed INTEGER,
    joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_library_member_user UNIQUE (school_id, user_id),
    CONSTRAINT uq_library_member_number UNIQUE (school_id, membership_number)
);

-- 9. Library Issues (Circulation Ledger)
CREATE TABLE IF NOT EXISTS library_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE RESTRICT,
    book_copy_id UUID NOT NULL REFERENCES library_book_copies(id) ON DELETE RESTRICT,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    return_date DATE,
    renewal_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
    returned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Library Reservations
CREATE TABLE IF NOT EXISTS library_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reservation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    queue_position INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    fulfilled_copy_id UUID REFERENCES library_book_copies(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Library Fines & Payments
CREATE TABLE IF NOT EXISTS library_fines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    issue_id UUID REFERENCES library_issues(id) ON DELETE SET NULL,
    member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    fine_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    reason VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    balance_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    paid_date DATE,
    payment_mode VARCHAR(50),
    payment_reference VARCHAR(100),
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    waived_amount NUMERIC(10, 2) DEFAULT 0.00,
    waived_by UUID REFERENCES users(id) ON DELETE SET NULL,
    waiver_reason TEXT,
    remarks TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Library Lost / Damaged / Disposed Log
CREATE TABLE IF NOT EXISTS library_lost_damaged (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    book_copy_id UUID NOT NULL REFERENCES library_book_copies(id) ON DELETE RESTRICT,
    issue_id UUID REFERENCES library_issues(id) ON DELETE SET NULL,
    record_type VARCHAR(20) NOT NULL,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    responsible_member_id UUID REFERENCES users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    cost_charged NUMERIC(10, 2) DEFAULT 0.00,
    fine_id UUID REFERENCES library_fines(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_lib_books_school ON library_books(school_id);
CREATE INDEX IF NOT EXISTS idx_lib_books_isbn ON library_books(school_id, isbn);
CREATE INDEX IF NOT EXISTS idx_lib_books_category ON library_books(school_id, category_id);
CREATE INDEX IF NOT EXISTS idx_lib_copies_book ON library_book_copies(book_id);
CREATE INDEX IF NOT EXISTS idx_lib_copies_school ON library_book_copies(school_id);
CREATE INDEX IF NOT EXISTS idx_lib_copies_barcode ON library_book_copies(school_id, barcode);
CREATE INDEX IF NOT EXISTS idx_lib_copies_accession ON library_book_copies(school_id, accession_number);
CREATE INDEX IF NOT EXISTS idx_lib_copies_location ON library_book_copies(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_lib_copies_status ON library_book_copies(school_id, status);
CREATE INDEX IF NOT EXISTS idx_lib_members_school_user ON library_members(school_id, user_id);
CREATE INDEX IF NOT EXISTS idx_lib_issues_school ON library_issues(school_id);
CREATE INDEX IF NOT EXISTS idx_lib_issues_member ON library_issues(school_id, member_user_id);
CREATE INDEX IF NOT EXISTS idx_lib_issues_copy ON library_issues(book_copy_id);
CREATE INDEX IF NOT EXISTS idx_lib_issues_status ON library_issues(school_id, status);
CREATE INDEX IF NOT EXISTS idx_lib_reservations_school_book ON library_reservations(school_id, book_id);
CREATE INDEX IF NOT EXISTS idx_lib_fines_member ON library_fines(school_id, member_user_id);
CREATE INDEX IF NOT EXISTS idx_lib_fines_status ON library_fines(school_id, status);

-- Enable RLS
ALTER TABLE library_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_book_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_lost_damaged ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY library_settings_tenant_policy ON library_settings FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY library_categories_tenant_policy ON library_categories FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY library_authors_tenant_policy ON library_authors FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY library_publishers_tenant_policy ON library_publishers FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY library_books_tenant_policy ON library_books FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY library_book_authors_tenant_policy ON library_book_authors FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY library_book_copies_tenant_policy ON library_book_copies FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY library_members_tenant_policy ON library_members FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY library_issues_tenant_policy ON library_issues FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY library_reservations_tenant_policy ON library_reservations FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY library_fines_tenant_policy ON library_fines FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

CREATE POLICY library_lost_damaged_tenant_policy ON library_lost_damaged FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);
-- ========================================================================
-- Migration 023: Centralized School Currency & Localization Settings
-- Multi-Tenant SaaS School Management System
-- Provides tenant-level localization parameters without silent historical conversion.
-- ========================================================================

-- 1. ADD LOCALIZATION COLUMNS TO SCHOOLS TABLE
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) DEFAULT '₹',
  ADD COLUMN IF NOT EXISTS currency_position VARCHAR(10) DEFAULT 'BEFORE',
  ADD COLUMN IF NOT EXISTS decimal_places INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS time_format VARCHAR(10) DEFAULT '12h',
  ADD COLUMN IF NOT EXISTS locale VARCHAR(20) DEFAULT 'en-IN';

-- 2. BACKFILL DEFAULTS FOR EXISTING SCHOOLS
UPDATE schools
SET 
  currency = COALESCE(NULLIF(currency, ''), 'INR'),
  currency_symbol = CASE 
    WHEN currency = 'USD' THEN '$'
    WHEN currency = 'EUR' THEN '€'
    WHEN currency = 'GBP' THEN '£'
    WHEN currency = 'AED' THEN 'د.إ'
    WHEN currency = 'SGD' THEN 'S$'
    WHEN currency = 'AUD' THEN 'A$'
    WHEN currency = 'CAD' THEN 'C$'
    WHEN currency = 'JPY' THEN '¥'
    ELSE '₹'
  END,
  currency_position = CASE 
    WHEN currency = 'EUR' THEN 'AFTER'
    ELSE 'BEFORE'
  END,
  decimal_places = CASE 
    WHEN currency = 'JPY' THEN 0
    ELSE 2
  END,
  date_format = COALESCE(NULLIF(date_format, ''), 'DD/MM/YYYY'),
  time_format = COALESCE(NULLIF(time_format, ''), '12h'),
  locale = CASE 
    WHEN currency = 'USD' THEN 'en-US'
    WHEN currency = 'EUR' THEN 'de-DE'
    WHEN currency = 'GBP' THEN 'en-GB'
    WHEN currency = 'AED' THEN 'ar-AE'
    ELSE 'en-IN'
  END
WHERE currency_symbol IS NULL OR currency_position IS NULL OR decimal_places IS NULL;

-- 3. SYNC TO SCHOOL_SETTINGS FOR GENERAL CATEGORY IF MISSING
INSERT INTO school_settings (school_id, setting_key, setting_value, category, data_type)
SELECT 
  s.id, 'currency_code', s.currency, 'GENERAL', 'STRING'
FROM schools s
ON CONFLICT (school_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, updated_at = NOW();

INSERT INTO school_settings (school_id, setting_key, setting_value, category, data_type)
SELECT 
  s.id, 'currency_symbol', s.currency_symbol, 'GENERAL', 'STRING'
FROM schools s
ON CONFLICT (school_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, updated_at = NOW();

INSERT INTO school_settings (school_id, setting_key, setting_value, category, data_type)
SELECT 
  s.id, 'currency_position', s.currency_position, 'GENERAL', 'STRING'
FROM schools s
ON CONFLICT (school_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, updated_at = NOW();

INSERT INTO school_settings (school_id, setting_key, setting_value, category, data_type)
SELECT 
  s.id, 'decimal_places', s.decimal_places::text, 'GENERAL', 'NUMBER'
FROM schools s
ON CONFLICT (school_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, updated_at = NOW();

INSERT INTO school_settings (school_id, setting_key, setting_value, category, data_type)
SELECT 
  s.id, 'locale', s.locale, 'GENERAL', 'STRING'
FROM schools s
ON CONFLICT (school_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
-- ========================================================================
-- Migration 024: Admissions & Enquiry CRM Pipeline (Corrected)
-- Multi-Tenant SaaS School Management System
-- Canonical Universal User & Academic Placement Architecture
-- Lead capturing, walk-ins, website enquiries, follow-ups, applications,
-- and formal conversion into Universal User + Student Profile + Academic Enrollment.
-- ========================================================================

-- 1. ADMISSION LEAD SOURCES
CREATE TABLE IF NOT EXISTS admission_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admission_source UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_admission_sources_school ON admission_sources(school_id);

-- 2. ADMISSION ENQUIRIES / LEADS
CREATE TABLE IF NOT EXISTS admission_enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_session_id UUID REFERENCES academic_sessions(id) ON DELETE SET NULL,
    enquiry_number VARCHAR(50) NOT NULL,
    enquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source_id UUID REFERENCES admission_sources(id) ON DELETE SET NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'WALK_IN', -- WALK_IN, WEBSITE, REFERRAL, PHONE, SOCIAL
    student_first_name VARCHAR(100) NOT NULL,
    student_last_name VARCHAR(100),
    date_of_birth DATE,
    gender VARCHAR(20),
    seeking_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    previous_school VARCHAR(255),
    parent_name VARCHAR(150) NOT NULL,
    parent_relation VARCHAR(50) NOT NULL DEFAULT 'FATHER', -- FATHER, MOTHER, GUARDIAN
    primary_phone VARCHAR(50) NOT NULL,
    alternate_phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'NEW', -- NEW, CONTACTED, CAMPUS_VISIT_SCHEDULED, APPLICATION_SUBMITTED, ADMITTED, REJECTED, CLOSED
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_admission_enquiry UNIQUE(school_id, enquiry_number)
);

CREATE INDEX IF NOT EXISTS idx_admission_enquiries_school ON admission_enquiries(school_id);
CREATE INDEX IF NOT EXISTS idx_admission_enquiries_status ON admission_enquiries(school_id, status);
CREATE INDEX IF NOT EXISTS idx_admission_enquiries_phone ON admission_enquiries(school_id, primary_phone);

-- 3. ADMISSION FOLLOW-UPS & APPOINTMENTS
CREATE TABLE IF NOT EXISTS admission_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    enquiry_id UUID NOT NULL REFERENCES admission_enquiries(id) ON DELETE CASCADE,
    followup_date DATE NOT NULL DEFAULT CURRENT_DATE,
    next_followup_date DATE,
    contacted_via VARCHAR(50) NOT NULL DEFAULT 'PHONE', -- PHONE, EMAIL, IN_PERSON, SMS, WHATSAPP
    response_notes TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED', -- SCHEDULED, COMPLETED, CANCELLED
    handled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admission_followups_enquiry ON admission_followups(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_admission_followups_next_date ON admission_followups(school_id, next_followup_date);

-- 4. FORMAL ADMISSION APPLICATIONS
CREATE TABLE IF NOT EXISTS admission_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    enquiry_id UUID REFERENCES admission_enquiries(id) ON DELETE SET NULL,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
    application_number VARCHAR(50) NOT NULL,
    application_date DATE NOT NULL DEFAULT CURRENT_DATE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
    student_first_name VARCHAR(100) NOT NULL,
    student_middle_name VARCHAR(100),
    student_last_name VARCHAR(100),
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    blood_group VARCHAR(10),
    nationality VARCHAR(100) DEFAULT 'Indian',
    religion VARCHAR(100),
    category VARCHAR(100),
    primary_contact_name VARCHAR(150) NOT NULL,
    primary_contact_phone VARCHAR(50) NOT NULL,
    primary_contact_email VARCHAR(255),
    primary_contact_relation VARCHAR(50) NOT NULL DEFAULT 'FATHER',
    address TEXT,
    documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED, UNDER_REVIEW, APPROVED, ADMITTED, REJECTED
    converted_student_id UUID REFERENCES users(id) ON DELETE SET NULL,
    converted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_admission_application UNIQUE(school_id, application_number)
);

CREATE INDEX IF NOT EXISTS idx_admission_applications_school ON admission_applications(school_id);
CREATE INDEX IF NOT EXISTS idx_admission_applications_status ON admission_applications(school_id, status);
CREATE INDEX IF NOT EXISTS idx_admission_applications_student ON admission_applications(converted_student_id);

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE admission_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_applications ENABLE ROW LEVEL SECURITY;

-- 6. TENANT ISOLATION POLICIES (Preserves strict multi-tenant boundary)
DROP POLICY IF EXISTS p_admission_sources_tenant_isolation ON admission_sources;
CREATE POLICY p_admission_sources_tenant_isolation ON admission_sources
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    );

DROP POLICY IF EXISTS p_admission_enquiries_tenant_isolation ON admission_enquiries;
CREATE POLICY p_admission_enquiries_tenant_isolation ON admission_enquiries
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    );

DROP POLICY IF EXISTS p_admission_followups_tenant_isolation ON admission_followups;
CREATE POLICY p_admission_followups_tenant_isolation ON admission_followups
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    );

DROP POLICY IF EXISTS p_admission_applications_tenant_isolation ON admission_applications;
CREATE POLICY p_admission_applications_tenant_isolation ON admission_applications
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    );

-- 7. SEED DEFAULT LEAD SOURCES FOR EXISTING SCHOOLS
INSERT INTO admission_sources (school_id, name, code)
SELECT s.id, 'Walk-in Inquiry', 'WALK_IN' FROM schools s
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO admission_sources (school_id, name, code)
SELECT s.id, 'School Website', 'WEBSITE' FROM schools s
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO admission_sources (school_id, name, code)
SELECT s.id, 'Parent Referral', 'REFERRAL' FROM schools s
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO admission_sources (school_id, name, code)
SELECT s.id, 'Social Media Campaign', 'SOCIAL' FROM schools s
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO admission_sources (school_id, name, code)
SELECT s.id, 'Education Fair / Expo', 'EXPO' FROM schools s
ON CONFLICT (school_id, code) DO NOTHING;
