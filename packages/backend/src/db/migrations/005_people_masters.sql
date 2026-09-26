-- ========================================================================
-- 005_people_masters.sql
-- People / User Management Masters & Extensions
-- Universal Users Model with Supporting Domain Extensions
-- ========================================================================

-- 1. DESIGNATION MASTER (Tenant Scoped)
CREATE TABLE IF NOT EXISTS designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_designation UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_designations_school ON designations(school_id);
CREATE INDEX IF NOT EXISTS idx_designations_deleted ON designations(deleted_at);

-- 2. USER CATEGORIES & SUBCATEGORIES (Tenant Scoped)
CREATE TABLE IF NOT EXISTS user_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_user_category UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_user_categories_school ON user_categories(school_id);

CREATE TABLE IF NOT EXISTS user_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES user_categories(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_user_subcategory UNIQUE(school_id, category_id, code)
);

CREATE INDEX IF NOT EXISTS idx_user_subcategories_cat ON user_subcategories(category_id);

-- 3. USER TAGS & LABELS (Tenant Scoped)
CREATE TABLE IF NOT EXISTS user_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#0d9488',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_user_tag UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_user_tags_school ON user_tags(school_id);

CREATE TABLE IF NOT EXISTS user_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#4f46e5',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_user_label UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_user_labels_school ON user_labels(school_id);

-- 4. TAXONOMY USER ASSIGNMENTS (Many-to-Many Mappings)
CREATE TABLE IF NOT EXISTS user_category_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES user_categories(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_category UNIQUE(user_id, category_id)
);

CREATE TABLE IF NOT EXISTS user_subcategory_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subcategory_id UUID NOT NULL REFERENCES user_subcategories(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_subcategory UNIQUE(user_id, subcategory_id)
);

CREATE TABLE IF NOT EXISTS user_tag_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES user_tags(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_tag UNIQUE(user_id, tag_id)
);

CREATE TABLE IF NOT EXISTS user_label_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES user_labels(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_label UNIQUE(user_id, label_id)
);

-- 5. SPECIALIZED DOMAIN EXTENSION TABLES (Linked to universal users.id)
-- Student Academic Profile
CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    admission_number VARCHAR(50) NOT NULL,
    admission_date DATE,
    roll_number VARCHAR(30),
    academic_session VARCHAR(50),
    class_name VARCHAR(50),
    section_name VARCHAR(50),
    house VARCHAR(50),
    stream VARCHAR(50),
    medium VARCHAR(50),
    blood_group VARCHAR(10),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_admission_number UNIQUE(school_id, admission_number)
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_user ON student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_school ON student_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_class ON student_profiles(class_name, section_name);

-- Staff Employment Profile
CREATE TABLE IF NOT EXISTS staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) NOT NULL,
    designation_id UUID REFERENCES designations(id) ON DELETE SET NULL,
    department VARCHAR(100),
    joining_date DATE,
    qualification VARCHAR(150),
    experience_years INT DEFAULT 0,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_school_employee_code UNIQUE(school_id, employee_code)
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_user ON staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_school ON staff_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_desig ON staff_profiles(designation_id);

-- Parent - Student Relationship Table
CREATE TABLE IF NOT EXISTS parent_student_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL, -- 'FATHER', 'MOTHER', 'GUARDIAN'
    is_emergency_contact BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_parent_student UNIQUE(parent_user_id, student_user_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_student_school ON parent_student_relationships(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_parent ON parent_student_relationships(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_student ON parent_student_relationships(student_user_id);

-- 6. ENABLE ROW LEVEL SECURITY ON ALL EXTENSION TABLES
ALTER TABLE designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_student_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_designations_isolation ON designations FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_user_categories_isolation ON user_categories FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_user_subcategories_isolation ON user_subcategories FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_user_tags_isolation ON user_tags FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_user_labels_isolation ON user_labels FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_student_profiles_isolation ON student_profiles FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_staff_profiles_isolation ON staff_profiles FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_parent_student_isolation ON parent_student_relationships FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());
