-- ========================================================================
-- Migration 024: Admissions & Enquiry CRM Pipeline (Corrected)
-- Multi-Tenant SaaS School Management System
-- Canonical Universal User & Academic Placement Architecture
-- Lead capturing, walk-ins, website enquiries, follow-ups, applications,
-- and formal conversion into Universal User + Student Profile + Academic Enrollment.
-- ========================================================================

-- 1. ADMISSION LEAD SOURCES
CREATE TABLE IF NOT EXISTS admission_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admission_source UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_admission_sources_school ON admission_sources(school_id);

-- 2. ADMISSION ENQUIRIES / LEADS
CREATE TABLE IF NOT EXISTS admission_enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_session_id UUID REFERENCES academic_sessions(id) ON DELETE SET NULL,
    enquiry_number VARCHAR(50) NOT NULL,
    enquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source_id UUID REFERENCES admission_sources(id) ON DELETE SET NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'WALK_IN', -- WALK_IN, WEBSITE, REFERRAL, PHONE, SOCIAL
    student_first_name VARCHAR(100) NOT NULL,
    student_last_name VARCHAR(100),
    date_of_birth DATE,
    gender VARCHAR(20),
    seeking_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    previous_school VARCHAR(255),
    parent_name VARCHAR(150) NOT NULL,
    parent_relation VARCHAR(50) NOT NULL DEFAULT 'FATHER', -- FATHER, MOTHER, GUARDIAN
    primary_phone VARCHAR(50) NOT NULL,
    alternate_phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'NEW', -- NEW, CONTACTED, CAMPUS_VISIT_SCHEDULED, APPLICATION_SUBMITTED, ADMITTED, REJECTED, CLOSED
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_admission_enquiry UNIQUE(school_id, enquiry_number)
);

CREATE INDEX IF NOT EXISTS idx_admission_enquiries_school ON admission_enquiries(school_id);
CREATE INDEX IF NOT EXISTS idx_admission_enquiries_status ON admission_enquiries(school_id, status);
CREATE INDEX IF NOT EXISTS idx_admission_enquiries_phone ON admission_enquiries(school_id, primary_phone);

-- 3. ADMISSION FOLLOW-UPS & APPOINTMENTS
CREATE TABLE IF NOT EXISTS admission_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    enquiry_id UUID NOT NULL REFERENCES admission_enquiries(id) ON DELETE CASCADE,
    followup_date DATE NOT NULL DEFAULT CURRENT_DATE,
    next_followup_date DATE,
    contacted_via VARCHAR(50) NOT NULL DEFAULT 'PHONE', -- PHONE, EMAIL, IN_PERSON, SMS, WHATSAPP
    response_notes TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED', -- SCHEDULED, COMPLETED, CANCELLED
    handled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admission_followups_enquiry ON admission_followups(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_admission_followups_next_date ON admission_followups(school_id, next_followup_date);

-- 4. FORMAL ADMISSION APPLICATIONS
CREATE TABLE IF NOT EXISTS admission_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    enquiry_id UUID REFERENCES admission_enquiries(id) ON DELETE SET NULL,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
    application_number VARCHAR(50) NOT NULL,
    application_date DATE NOT NULL DEFAULT CURRENT_DATE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
    student_first_name VARCHAR(100) NOT NULL,
    student_middle_name VARCHAR(100),
    student_last_name VARCHAR(100),
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    blood_group VARCHAR(10),
    nationality VARCHAR(100) DEFAULT 'Indian',
    religion VARCHAR(100),
    category VARCHAR(100),
    primary_contact_name VARCHAR(150) NOT NULL,
    primary_contact_phone VARCHAR(50) NOT NULL,
    primary_contact_email VARCHAR(255),
    primary_contact_relation VARCHAR(50) NOT NULL DEFAULT 'FATHER',
    address TEXT,
    documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED, UNDER_REVIEW, APPROVED, ADMITTED, REJECTED
    converted_student_id UUID REFERENCES users(id) ON DELETE SET NULL,
    converted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_admission_application UNIQUE(school_id, application_number)
);

CREATE INDEX IF NOT EXISTS idx_admission_applications_school ON admission_applications(school_id);
CREATE INDEX IF NOT EXISTS idx_admission_applications_status ON admission_applications(school_id, status);
CREATE INDEX IF NOT EXISTS idx_admission_applications_student ON admission_applications(converted_student_id);

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE admission_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_applications ENABLE ROW LEVEL SECURITY;

-- 6. TENANT ISOLATION POLICIES (Preserves strict multi-tenant boundary)
DROP POLICY IF EXISTS p_admission_sources_tenant_isolation ON admission_sources;
CREATE POLICY p_admission_sources_tenant_isolation ON admission_sources
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    );

DROP POLICY IF EXISTS p_admission_enquiries_tenant_isolation ON admission_enquiries;
CREATE POLICY p_admission_enquiries_tenant_isolation ON admission_enquiries
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    );

DROP POLICY IF EXISTS p_admission_followups_tenant_isolation ON admission_followups;
CREATE POLICY p_admission_followups_tenant_isolation ON admission_followups
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    );

DROP POLICY IF EXISTS p_admission_applications_tenant_isolation ON admission_applications;
CREATE POLICY p_admission_applications_tenant_isolation ON admission_applications
    FOR ALL
    USING (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    )
    WITH CHECK (
        is_platform_super_admin() = TRUE
        OR school_id = current_school_id()
        OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID
    );

-- 7. SEED DEFAULT LEAD SOURCES FOR EXISTING SCHOOLS
INSERT INTO admission_sources (school_id, name, code)
SELECT s.id, 'Walk-in Inquiry', 'WALK_IN' FROM schools s
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO admission_sources (school_id, name, code)
SELECT s.id, 'School Website', 'WEBSITE' FROM schools s
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO admission_sources (school_id, name, code)
SELECT s.id, 'Parent Referral', 'REFERRAL' FROM schools s
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO admission_sources (school_id, name, code)
SELECT s.id, 'Social Media Campaign', 'SOCIAL' FROM schools s
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO admission_sources (school_id, name, code)
SELECT s.id, 'Education Fair / Expo', 'EXPO' FROM schools s
ON CONFLICT (school_id, code) DO NOTHING;
