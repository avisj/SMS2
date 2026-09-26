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
