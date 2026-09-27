-- ========================================================================
-- Migration 021: Asset Management Module Schema
-- Physical asset tracking: categories, master, assignment history,
-- movements/transfers, maintenance lifecycle, and disposal records
-- ========================================================================

-- 1. Asset Categories Table
CREATE TABLE IF NOT EXISTS asset_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_asset_cat_school_code UNIQUE (school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_asset_cat_school ON asset_categories(school_id);
CREATE INDEX IF NOT EXISTS idx_asset_cat_active ON asset_categories(school_id, is_active) WHERE deleted_at IS NULL;

-- 2. Asset Subcategories Table
CREATE TABLE IF NOT EXISTS asset_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_asset_subcat_school_cat_code UNIQUE (school_id, category_id, code)
);

CREATE INDEX IF NOT EXISTS idx_asset_subcat_category ON asset_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_asset_subcat_school ON asset_subcategories(school_id);

-- 3. Assets Master Table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_code VARCHAR(50) NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    category_id UUID NOT NULL REFERENCES asset_categories(id),
    subcategory_id UUID REFERENCES asset_subcategories(id),
    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    barcode VARCHAR(100),
    asset_tag VARCHAR(100),
    description TEXT,
    purchase_date DATE,
    purchase_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    vendor_id UUID REFERENCES inventory_vendors(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    invoice_number VARCHAR(100),
    invoice_date DATE,
    warranty_start_date DATE,
    warranty_end_date DATE,
    current_location_id UUID NOT NULL REFERENCES locations(id),
    building VARCHAR(100),
    floor VARCHAR(50),
    room VARCHAR(100),
    room_number VARCHAR(50),
    area VARCHAR(100),
    rack VARCHAR(50),
    seat_desk VARCHAR(50),
    current_custodian_user_id UUID REFERENCES users(id),
    condition VARCHAR(30) NOT NULL DEFAULT 'NEW' CHECK (condition IN ('NEW', 'GOOD', 'FAIR', 'DAMAGED', 'CRITICAL')),
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ASSIGNED', 'UNDER_MAINTENANCE', 'DAMAGED', 'LOST', 'DISPOSED', 'RETIRED')),
    remarks TEXT,
    useful_life_years NUMERIC(5, 2),
    salvage_value NUMERIC(15, 2) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_assets_school_code UNIQUE (school_id, asset_code)
);

CREATE INDEX IF NOT EXISTS idx_assets_school ON assets(school_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(current_location_id);
CREATE INDEX IF NOT EXISTS idx_assets_custodian ON assets(current_custodian_user_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(school_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_condition ON assets(school_id, condition);
CREATE INDEX IF NOT EXISTS idx_assets_barcode ON assets(school_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_serial ON assets(school_id, serial_number) WHERE serial_number IS NOT NULL;

-- 4. Asset Assignments Table (Historical Custody & Returns)
CREATE TABLE IF NOT EXISTS asset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    assigned_to_user_id UUID NOT NULL REFERENCES users(id),
    location_id UUID REFERENCES locations(id),
    assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_return_date DATE,
    actual_return_date DATE,
    condition_at_assignment VARCHAR(30) NOT NULL DEFAULT 'GOOD',
    condition_at_return VARCHAR(30),
    remarks TEXT,
    assigned_by UUID REFERENCES users(id),
    returned_by UUID REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_assign_asset ON asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assign_user ON asset_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_asset_assign_active ON asset_assignments(asset_id, is_active);

-- 5. Asset Movement / Transfer Table
CREATE TABLE IF NOT EXISTS asset_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    from_location_id UUID REFERENCES locations(id),
    to_location_id UUID NOT NULL REFERENCES locations(id),
    from_building VARCHAR(100),
    to_building VARCHAR(100),
    from_room VARCHAR(100),
    to_room VARCHAR(100),
    from_user_id UUID REFERENCES users(id),
    to_user_id UUID REFERENCES users(id),
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason VARCHAR(255),
    condition VARCHAR(30),
    remarks TEXT,
    moved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_mov_asset ON asset_movements(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_mov_school ON asset_movements(school_id);

-- 6. Asset Maintenance Table
CREATE TABLE IF NOT EXISTS asset_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(50) NOT NULL DEFAULT 'REPAIR',
    service_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor_id UUID REFERENCES inventory_vendors(id),
    service_provider VARCHAR(255),
    issue_description TEXT NOT NULL,
    work_performed TEXT,
    cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    next_service_date DATE,
    warranty_claim BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    previous_asset_status VARCHAR(30),
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_maint_asset ON asset_maintenance(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maint_status ON asset_maintenance(school_id, status);

-- 7. Asset Disposals Table
CREATE TABLE IF NOT EXISTS asset_disposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    disposal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    disposal_reason VARCHAR(100) NOT NULL,
    disposal_method VARCHAR(100) NOT NULL,
    disposal_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    approved_by UUID REFERENCES users(id),
    document_url TEXT,
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asset_disposal_asset UNIQUE (asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_disp_asset ON asset_disposals(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_disp_school ON asset_disposals(school_id);

-- 8. Asset Documents Table
CREATE TABLE IF NOT EXISTS asset_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_docs_asset ON asset_documents(asset_id);

-- 9. Row Level Security (RLS)
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_disposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asset_categories_tenant_isolation ON asset_categories;
CREATE POLICY asset_categories_tenant_isolation ON asset_categories
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS asset_subcategories_tenant_isolation ON asset_subcategories;
CREATE POLICY asset_subcategories_tenant_isolation ON asset_subcategories
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS assets_tenant_isolation ON assets;
CREATE POLICY assets_tenant_isolation ON assets
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS asset_assignments_tenant_isolation ON asset_assignments;
CREATE POLICY asset_assignments_tenant_isolation ON asset_assignments
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS asset_movements_tenant_isolation ON asset_movements;
CREATE POLICY asset_movements_tenant_isolation ON asset_movements
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS asset_maintenance_tenant_isolation ON asset_maintenance;
CREATE POLICY asset_maintenance_tenant_isolation ON asset_maintenance
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS asset_disposals_tenant_isolation ON asset_disposals;
CREATE POLICY asset_disposals_tenant_isolation ON asset_disposals
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);

DROP POLICY IF EXISTS asset_documents_tenant_isolation ON asset_documents;
CREATE POLICY asset_documents_tenant_isolation ON asset_documents
    FOR ALL USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::UUID);
