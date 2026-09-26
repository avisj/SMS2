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
