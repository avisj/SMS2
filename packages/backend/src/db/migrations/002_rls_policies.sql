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
