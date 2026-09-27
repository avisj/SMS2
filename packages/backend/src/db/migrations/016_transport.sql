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

DROP POLICY IF EXISTS p_vehicles_isolation ON vehicles;
CREATE POLICY p_vehicles_isolation ON vehicles FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_driver_assignments_isolation ON vehicle_driver_assignments;
CREATE POLICY p_driver_assignments_isolation ON vehicle_driver_assignments FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_transport_routes_isolation ON transport_routes;
CREATE POLICY p_transport_routes_isolation ON transport_routes FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_route_stops_isolation ON transport_route_stops;
CREATE POLICY p_route_stops_isolation ON transport_route_stops FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_std_transport_isolation ON student_transport_assignments;
CREATE POLICY p_std_transport_isolation ON student_transport_assignments FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_transport_trips_isolation ON transport_trips;
CREATE POLICY p_transport_trips_isolation ON transport_trips FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_location_history_isolation ON vehicle_location_history;
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
