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
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_student_academic_session UNIQUE(school_id, student_user_id, academic_session_id)
);

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
