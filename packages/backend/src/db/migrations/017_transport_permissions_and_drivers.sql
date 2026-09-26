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
