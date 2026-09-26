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
