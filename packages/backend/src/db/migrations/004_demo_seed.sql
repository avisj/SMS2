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
