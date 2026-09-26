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
