-- ========================================================================
-- 013_fees_management.sql
-- Fees Management Module Schema
-- Supports Fee Heads, Structures, Student Demands, Payments, Allocations,
-- Receipts, Adjustments (Discounts & Waivers), and Refunds.
-- ========================================================================

-- 1. FEE HEADS (Fee Categories / Charge Types Master)
CREATE TABLE IF NOT EXISTS fee_heads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'ACADEMIC', -- 'ACADEMIC', 'FACILITY', 'OPTIONAL', 'ONE_TIME', 'TRANSPORT', 'MISC'
    is_taxable BOOLEAN NOT NULL DEFAULT FALSE,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',     -- 'ACTIVE', 'INACTIVE'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_fee_heads_school_code UNIQUE(school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_fee_heads_school ON fee_heads(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_heads_status ON fee_heads(school_id, status);

-- 2. FEE STRUCTURES (Fee Rules by Session, Branch, Class, Section)
CREATE TABLE IF NOT EXISTS fee_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NULL REFERENCES locations(id) ON DELETE CASCADE, -- NULL means school-wide
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NULL REFERENCES sections(id) ON DELETE SET NULL,  -- NULL means all sections in class
    fee_head_id UUID NOT NULL REFERENCES fee_heads(id) ON DELETE RESTRICT,
    frequency VARCHAR(30) NOT NULL DEFAULT 'MONTHLY', -- 'ONE_TIME', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    due_day_of_month INT NOT NULL DEFAULT 10,
    notes TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_fee_structures_school_session ON fee_structures(school_id, academic_session_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_class ON fee_structures(class_id);

-- 3. STUDENT FEE DEMANDS (Individual Student Invoices / Dues)
CREATE TABLE IF NOT EXISTS student_fee_demands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_number VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_enrollment_id UUID NULL REFERENCES student_academic_enrollments(id) ON DELETE SET NULL,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    fee_structure_id UUID NULL REFERENCES fee_structures(id) ON DELETE SET NULL,
    fee_head_id UUID NOT NULL REFERENCES fee_heads(id) ON DELETE RESTRICT,
    billing_period VARCHAR(50) NOT NULL,              -- e.g. '2026-04', 'Q1-2026', 'ADMISSION-2026'
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    original_amount NUMERIC(12,2) NOT NULL CHECK (original_amount >= 0),
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    waiver_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (waiver_amount >= 0),
    late_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (late_fee_amount >= 0),
    net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount >= 0),
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'UNPAID',    -- 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED'
    cancellation_reason TEXT NULL,
    cancelled_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_student_fee_demand UNIQUE(school_id, student_user_id, academic_session_id, fee_head_id, billing_period)
);

CREATE INDEX IF NOT EXISTS idx_sfd_school ON student_fee_demands(school_id);
CREATE INDEX IF NOT EXISTS idx_sfd_student ON student_fee_demands(student_user_id);
CREATE INDEX IF NOT EXISTS idx_sfd_due ON student_fee_demands(school_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_sfd_academic ON student_fee_demands(school_id, academic_session_id, location_id, class_id, section_id);

-- 4. FEE DEMAND ADJUSTMENTS (Discounts and Waivers Log)
CREATE TABLE IF NOT EXISTS fee_demand_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_fee_demand_id UUID NOT NULL REFERENCES student_fee_demands(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    adjustment_type VARCHAR(30) NOT NULL,             -- 'DISCOUNT', 'WAIVER', 'LATE_FEE_OVERRIDE'
    discount_name VARCHAR(100) NULL,                  -- e.g. 'Sibling Discount', 'Merit Scholarship'
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',   -- 'PENDING', 'APPROVED', 'REJECTED'
    approved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fda_demand ON fee_demand_adjustments(student_fee_demand_id);
CREATE INDEX IF NOT EXISTS idx_fda_student ON fee_demand_adjustments(student_user_id);

-- 5. FEE PAYMENTS (Financial Collection Transaction Header)
CREATE TABLE IF NOT EXISTS fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
    refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (refunded_amount >= 0),
    payment_mode VARCHAR(30) NOT NULL,                -- 'CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'
    transaction_reference VARCHAR(100) NULL,
    remarks TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',    -- 'SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REVERSED'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_fee_payments_number UNIQUE(school_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_fee_payments_school_date ON fee_payments(school_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_user_id);

-- 6. FEE PAYMENT ALLOCATIONS (Itemized Allocation of Payment to Demands)
CREATE TABLE IF NOT EXISTS fee_payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
    student_fee_demand_id UUID NOT NULL REFERENCES student_fee_demands(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(12,2) NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fpa_payment ON fee_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_fpa_demand ON fee_payment_allocations(student_fee_demand_id);

-- 7. FEE RECEIPTS (Official School Receipts)
CREATE TABLE IF NOT EXISTS fee_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',     -- 'ACTIVE', 'CANCELLED'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fee_receipts_school_number UNIQUE(school_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_fee_receipts_school ON fee_receipts(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_student ON fee_receipts(student_user_id);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_payment ON fee_receipts(payment_id);

-- 8. FEE REFUNDS (Partial / Full Refunds against Payments)
CREATE TABLE IF NOT EXISTS fee_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_number VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refund_amount NUMERIC(12,2) NOT NULL CHECK (refund_amount > 0),
    refund_date DATE NOT NULL DEFAULT CURRENT_DATE,
    refund_mode VARCHAR(30) NOT NULL DEFAULT 'ORIGINAL_MODE',
    reason TEXT NOT NULL,
    reference_no VARCHAR(100) NULL,
    approved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fee_refunds_number UNIQUE(school_id, refund_number)
);

CREATE INDEX IF NOT EXISTS idx_fee_refunds_school ON fee_refunds(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_refunds_payment ON fee_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_fee_refunds_student ON fee_refunds(student_user_id);
