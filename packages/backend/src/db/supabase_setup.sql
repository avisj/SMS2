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
    deleted_at TIMESTAMPTZ NULL
);

-- Exactly ONE active enrollment per student per academic session (preserves historical TRANSFERRED records)
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_active_session 
    ON student_academic_enrollments (school_id, student_user_id, academic_session_id) 
    WHERE enrollment_status = 'ENROLLED' AND deleted_at IS NULL;

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

-- ------------------------------------------------------------------------
-- 011_universal_attendance.sql
-- Universal Attendance Module
-- ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attendance_status_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    status_code VARCHAR(30) NOT NULL,
    status_name VARCHAR(50) NOT NULL,
    attendance_type VARCHAR(20) NOT NULL DEFAULT 'ALL',
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

CREATE TABLE IF NOT EXISTS user_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    attendance_type VARCHAR(20) NOT NULL,
    academic_session_id UUID NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    student_enrollment_id UUID NULL REFERENCES student_academic_enrollments(id) ON DELETE SET NULL,
    class_id UUID NULL REFERENCES classes(id) ON DELETE SET NULL,
    section_id UUID NULL REFERENCES sections(id) ON DELETE SET NULL,
    staff_assignment_id UUID NULL,
    department VARCHAR(100) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PRESENT',
    check_in_time VARCHAR(10) NULL,
    check_out_time VARCHAR(10) NULL,
    late_minutes INT NOT NULL DEFAULT 0,
    early_departure_minutes INT NOT NULL DEFAULT 0,
    remarks TEXT NULL,
    marked_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_user_attendance_daily UNIQUE(school_id, user_id, attendance_date, attendance_type)
);

CREATE INDEX IF NOT EXISTS idx_user_attendance_school_date ON user_attendance(school_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_user_attendance_user_date ON user_attendance(school_id, user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_user_attendance_student_roster ON user_attendance(school_id, academic_session_id, location_id, class_id, section_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_user_attendance_staff_roster ON user_attendance(school_id, location_id, attendance_date, attendance_type);
CREATE INDEX IF NOT EXISTS idx_user_attendance_enrollment ON user_attendance(student_enrollment_id);

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

-- ------------------------------------------------------------------------
-- Migration Ledger Initialization
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _schema_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO _schema_migrations (name) VALUES
    ('001_core_schema.sql'),
    ('002_rls_policies.sql'),
    ('003_system_seed.sql'),
    ('004_demo_seed.sql'),
    ('005_people_masters.sql'),
    ('006_academic_structure.sql'),
    ('007_refactor_roles_rights_and_display_order.sql'),
    ('008_auth_school_id_and_credentials.sql'),
    ('009_student_staff_extended_records.sql'),
    ('010_student_timetable.sql'),
    ('011_universal_attendance.sql'),
    ('012_student_enrollment_partial_unique.sql'),
    ('013_fees_management.sql')
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------------------
-- 13. FEES MANAGEMENT SCHEMA
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_heads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'ACADEMIC',
    is_taxable BOOLEAN NOT NULL DEFAULT FALSE,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_fee_heads_school_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_fee_heads_school ON fee_heads(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_heads_status ON fee_heads(school_id, status);

CREATE TABLE IF NOT EXISTS fee_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NULL REFERENCES locations(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NULL REFERENCES sections(id) ON DELETE SET NULL,
    fee_head_id UUID NOT NULL REFERENCES fee_heads(id) ON DELETE RESTRICT,
    frequency VARCHAR(30) NOT NULL DEFAULT 'MONTHLY',
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
    billing_period VARCHAR(50) NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    original_amount NUMERIC(12,2) NOT NULL CHECK (original_amount >= 0),
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    waiver_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (waiver_amount >= 0),
    late_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (late_fee_amount >= 0),
    net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount >= 0),
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
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

CREATE TABLE IF NOT EXISTS fee_demand_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_fee_demand_id UUID NOT NULL REFERENCES student_fee_demands(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    adjustment_type VARCHAR(30) NOT NULL,
    discount_name VARCHAR(100) NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    approved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fda_demand ON fee_demand_adjustments(student_fee_demand_id);
CREATE INDEX IF NOT EXISTS idx_fda_student ON fee_demand_adjustments(student_user_id);

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
    payment_mode VARCHAR(30) NOT NULL,
    transaction_reference VARCHAR(100) NULL,
    remarks TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_fee_payments_number UNIQUE(school_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_fee_payments_school_date ON fee_payments(school_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_user_id);

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
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fee_receipts_school_number UNIQUE(school_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_fee_receipts_school ON fee_receipts(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_student ON fee_receipts(student_user_id);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_payment ON fee_receipts(payment_id);

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


