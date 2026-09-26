-- ========================================================================
-- 009_student_staff_extended_records.sql
-- Normalized Child Entities for Student History, Staff Qualifications,
-- Experience, Certifications, and Generic Document Attachments
-- ========================================================================

-- 1. Student Previous Academic History
CREATE TABLE IF NOT EXISTS student_previous_academic_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academic_year VARCHAR(50),
    previous_school_name VARCHAR(255) NOT NULL,
    class_name VARCHAR(50),
    board VARCHAR(100),
    result VARCHAR(50),
    marks_grade VARCHAR(50),
    remarks TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_prev_records_student ON student_previous_academic_records(student_user_id);
CREATE INDEX IF NOT EXISTS idx_student_prev_records_school ON student_previous_academic_records(school_id);

-- 2. Student Awards & Achievements
CREATE TABLE IF NOT EXISTS student_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_date DATE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- Sports, Academics, Arts, Leadership, etc.
    level VARCHAR(100),    -- School, Inter-school, District, State, National, International
    award_position VARCHAR(100), -- 1st Place, Gold Medal, Participant, etc.
    description TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON student_achievements(student_user_id);
CREATE INDEX IF NOT EXISTS idx_student_achievements_school ON student_achievements(school_id);

-- 3. Staff Education & Qualifications
CREATE TABLE IF NOT EXISTS staff_qualifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    education_level VARCHAR(100), -- High School, Bachelors, Masters, Doctorate, Diploma
    qualification_name VARCHAR(255) NOT NULL, -- B.Ed, M.Sc Mathematics, etc.
    institution VARCHAR(255) NOT NULL,
    board_university VARCHAR(255),
    passing_year INT,
    marks_grade VARCHAR(50),
    specialization VARCHAR(255),
    certificate_url TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_qualifications_staff ON staff_qualifications(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_school ON staff_qualifications(school_id);

-- 4. Staff Professional Experience
CREATE TABLE IF NOT EXISTS staff_professional_experience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization VARCHAR(255) NOT NULL,
    designation VARCHAR(255) NOT NULL,
    from_date DATE,
    to_date DATE,
    duration VARCHAR(50),
    responsibilities TEXT,
    experience_letter_url TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_experience_staff ON staff_professional_experience(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_experience_school ON staff_professional_experience(school_id);

-- 5. Staff Certifications
CREATE TABLE IF NOT EXISTS staff_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    certification_name VARCHAR(255) NOT NULL,
    issuing_organization VARCHAR(255) NOT NULL,
    issue_date DATE,
    expiry_date DATE,
    credential_number VARCHAR(100),
    attachment_url TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_certifications_staff ON staff_certifications(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_certifications_school ON staff_certifications(school_id);

-- 6. Generic User Documents Attachment Registry
CREATE TABLE IF NOT EXISTS user_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL, -- ID Proof, Birth Certificate, Transfer Certificate, etc.
    document_name VARCHAR(255) NOT NULL,
    document_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_size INT,
    mime_type VARCHAR(100),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_documents_user ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_school ON user_documents(school_id);
