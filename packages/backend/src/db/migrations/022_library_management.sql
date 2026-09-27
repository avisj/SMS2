-- ============================================================================
-- Migration: 022_library_management.sql
-- Description: Complete Library Management Module schema for multi-tenant SaaS
-- Tables:
--   1. library_settings
--   2. library_categories
--   3. library_authors
--   4. library_publishers
--   5. library_books
--   6. library_book_authors
--   7. library_book_copies
--   8. library_members
--   9. library_issues
--  10. library_reservations
--  11. library_fines
--  12. library_lost_damaged
-- ============================================================================

-- 1. Library Settings
CREATE TABLE IF NOT EXISTS library_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    loan_period_days INTEGER NOT NULL DEFAULT 14,
    maximum_books_per_member INTEGER NOT NULL DEFAULT 3,
    student_issue_limit INTEGER NOT NULL DEFAULT 3,
    staff_issue_limit INTEGER NOT NULL DEFAULT 5,
    maximum_renewals INTEGER NOT NULL DEFAULT 2,
    fine_per_day NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    grace_period_days INTEGER NOT NULL DEFAULT 1,
    reservation_enabled BOOLEAN NOT NULL DEFAULT true,
    reservation_expiry_days INTEGER NOT NULL DEFAULT 7,
    auto_fine_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_library_settings_school UNIQUE (school_id)
);

-- 2. Library Categories
CREATE TABLE IF NOT EXISTS library_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_library_category_name UNIQUE (school_id, name)
);

-- 3. Library Authors
CREATE TABLE IF NOT EXISTS library_authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    biography TEXT,
    remarks TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Library Publishers
CREATE TABLE IF NOT EXISTS library_publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    contact VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(50),
    address TEXT,
    website VARCHAR(255),
    remarks TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Library Books (Bibliographic / Master Record)
CREATE TABLE IF NOT EXISTS library_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    accession_reference VARCHAR(100),
    isbn VARCHAR(30),
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    category_id UUID NOT NULL REFERENCES library_categories(id) ON DELETE RESTRICT,
    publisher_id UUID REFERENCES library_publishers(id) ON DELETE SET NULL,
    publication_year INTEGER,
    edition VARCHAR(50),
    language VARCHAR(50) NOT NULL DEFAULT 'English',
    pages INTEGER,
    description TEXT,
    subject VARCHAR(100),
    class_level VARCHAR(50),
    cover_image TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Book Authors (Many-to-Many)
CREATE TABLE IF NOT EXISTS library_book_authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES library_authors(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_book_author UNIQUE (book_id, author_id)
);

-- 7. Book Copies (Physical Holdings)
CREATE TABLE IF NOT EXISTS library_book_copies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    copy_code VARCHAR(50) NOT NULL,
    accession_number VARCHAR(50),
    barcode VARCHAR(50),
    purchase_date DATE,
    purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    vendor_id UUID REFERENCES inventory_vendors(id) ON DELETE SET NULL,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    room VARCHAR(50),
    shelf VARCHAR(50),
    rack VARCHAR(50),
    condition VARCHAR(20) NOT NULL DEFAULT 'GOOD',
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    remarks TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_book_copy_code UNIQUE (school_id, copy_code)
);

-- 8. Library Members (Uses Universal Users)
CREATE TABLE IF NOT EXISTS library_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    membership_number VARCHAR(50) NOT NULL,
    membership_type VARCHAR(20) NOT NULL DEFAULT 'STUDENT',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    max_books_allowed INTEGER,
    joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_library_member_user UNIQUE (school_id, user_id),
    CONSTRAINT uq_library_member_number UNIQUE (school_id, membership_number)
);

-- 9. Library Issues (Circulation Ledger)
CREATE TABLE IF NOT EXISTS library_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE RESTRICT,
    book_copy_id UUID NOT NULL REFERENCES library_book_copies(id) ON DELETE RESTRICT,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    return_date DATE,
    renewal_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
    returned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Library Reservations
CREATE TABLE IF NOT EXISTS library_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reservation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    queue_position INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    fulfilled_copy_id UUID REFERENCES library_book_copies(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Library Fines & Payments
CREATE TABLE IF NOT EXISTS library_fines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    issue_id UUID REFERENCES library_issues(id) ON DELETE SET NULL,
    member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    fine_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    reason VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    balance_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    paid_date DATE,
    payment_mode VARCHAR(50),
    payment_reference VARCHAR(100),
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    waived_amount NUMERIC(10, 2) DEFAULT 0.00,
    waived_by UUID REFERENCES users(id) ON DELETE SET NULL,
    waiver_reason TEXT,
    remarks TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Library Lost / Damaged / Disposed Log
CREATE TABLE IF NOT EXISTS library_lost_damaged (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    book_copy_id UUID NOT NULL REFERENCES library_book_copies(id) ON DELETE RESTRICT,
    issue_id UUID REFERENCES library_issues(id) ON DELETE SET NULL,
    record_type VARCHAR(20) NOT NULL,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    responsible_member_id UUID REFERENCES users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    cost_charged NUMERIC(10, 2) DEFAULT 0.00,
    fine_id UUID REFERENCES library_fines(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_lib_books_school ON library_books(school_id);
CREATE INDEX IF NOT EXISTS idx_lib_books_isbn ON library_books(school_id, isbn);
CREATE INDEX IF NOT EXISTS idx_lib_books_category ON library_books(school_id, category_id);
CREATE INDEX IF NOT EXISTS idx_lib_copies_book ON library_book_copies(book_id);
CREATE INDEX IF NOT EXISTS idx_lib_copies_school ON library_book_copies(school_id);
CREATE INDEX IF NOT EXISTS idx_lib_copies_barcode ON library_book_copies(school_id, barcode);
CREATE INDEX IF NOT EXISTS idx_lib_copies_accession ON library_book_copies(school_id, accession_number);
CREATE INDEX IF NOT EXISTS idx_lib_copies_location ON library_book_copies(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_lib_copies_status ON library_book_copies(school_id, status);
CREATE INDEX IF NOT EXISTS idx_lib_members_school_user ON library_members(school_id, user_id);
CREATE INDEX IF NOT EXISTS idx_lib_issues_school ON library_issues(school_id);
CREATE INDEX IF NOT EXISTS idx_lib_issues_member ON library_issues(school_id, member_user_id);
CREATE INDEX IF NOT EXISTS idx_lib_issues_copy ON library_issues(book_copy_id);
CREATE INDEX IF NOT EXISTS idx_lib_issues_status ON library_issues(school_id, status);
CREATE INDEX IF NOT EXISTS idx_lib_reservations_school_book ON library_reservations(school_id, book_id);
CREATE INDEX IF NOT EXISTS idx_lib_fines_member ON library_fines(school_id, member_user_id);
CREATE INDEX IF NOT EXISTS idx_lib_fines_status ON library_fines(school_id, status);

-- Enable RLS
ALTER TABLE library_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_book_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_lost_damaged ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DROP POLICY IF EXISTS library_settings_tenant_policy ON library_settings;
CREATE POLICY library_settings_tenant_policy ON library_settings FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS library_categories_tenant_policy ON library_categories;
CREATE POLICY library_categories_tenant_policy ON library_categories FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS library_authors_tenant_policy ON library_authors;
CREATE POLICY library_authors_tenant_policy ON library_authors FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS library_publishers_tenant_policy ON library_publishers;
CREATE POLICY library_publishers_tenant_policy ON library_publishers FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS library_books_tenant_policy ON library_books;
CREATE POLICY library_books_tenant_policy ON library_books FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS library_book_authors_tenant_policy ON library_book_authors;
CREATE POLICY library_book_authors_tenant_policy ON library_book_authors FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS library_book_copies_tenant_policy ON library_book_copies;
CREATE POLICY library_book_copies_tenant_policy ON library_book_copies FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS library_members_tenant_policy ON library_members;
CREATE POLICY library_members_tenant_policy ON library_members FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS library_issues_tenant_policy ON library_issues;
CREATE POLICY library_issues_tenant_policy ON library_issues FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS library_reservations_tenant_policy ON library_reservations;
CREATE POLICY library_reservations_tenant_policy ON library_reservations FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS library_fines_tenant_policy ON library_fines;
CREATE POLICY library_fines_tenant_policy ON library_fines FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS library_lost_damaged_tenant_policy ON library_lost_damaged;
CREATE POLICY library_lost_damaged_tenant_policy ON library_lost_damaged FOR ALL
    USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);
