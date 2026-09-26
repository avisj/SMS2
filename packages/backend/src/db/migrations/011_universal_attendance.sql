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
