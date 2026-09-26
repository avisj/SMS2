-- ========================================================================
-- 020_inventory_complete_setup.sql
-- COMPLETE, IDEMPOTENT INVENTORY & ORDER MANAGEMENT SETUP SCRIPT
-- Safe to run in Supabase SQL Editor on fresh or existing databases.
-- Combines base tables, standalone SKU architecture, RLS, and permissions.
-- ========================================================================

-- 0. HELPER FUNCTIONS FOR MULTI-TENANT RLS (Safe Fallbacks)
CREATE OR REPLACE FUNCTION current_school_id() 
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_school_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION is_platform_super_admin() 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(NULLIF(current_setting('app.is_super_admin', true), '')::BOOLEAN, FALSE);
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- 1. INVENTORY CATEGORIES
CREATE TABLE IF NOT EXISTS inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_category_code UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_inv_cat_school ON inventory_categories(school_id);
CREATE INDEX IF NOT EXISTS idx_inv_cat_status ON inventory_categories(school_id, status);

-- 2. INVENTORY SUBCATEGORIES
CREATE TABLE IF NOT EXISTS inventory_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES inventory_categories(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_subcat_code UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_inv_subcat_school ON inventory_subcategories(school_id);
CREATE INDEX IF NOT EXISTS idx_inv_subcat_cat ON inventory_subcategories(category_id);

-- 3. UNITS OF MEASURE (UOM)
CREATE TABLE IF NOT EXISTS inventory_uoms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    is_fractional BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_uom_code UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_inv_uom_school ON inventory_uoms(school_id);

-- 4. BRANDS / MANUFACTURERS
CREATE TABLE IF NOT EXISTS inventory_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_brand_code UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_inv_brand_school ON inventory_brands(school_id);

-- 5. VENDORS / SUPPLIERS
CREATE TABLE IF NOT EXISTS inventory_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(150) NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(50) NULL,
    address TEXT NULL,
    tax_id VARCHAR(50) NULL,
    payment_terms VARCHAR(100) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_inventory_vendor_code UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_inv_vendor_school ON inventory_vendors(school_id);
CREATE INDEX IF NOT EXISTS idx_inv_vendor_status ON inventory_vendors(school_id, status);

-- 6. PRODUCTS TABLE (Backward-compatible catalog grouping)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    category_id UUID NULL REFERENCES inventory_categories(id) ON DELETE SET NULL,
    subcategory_id UUID NULL REFERENCES inventory_subcategories(id) ON DELETE SET NULL,
    uom_id UUID NULL REFERENCES inventory_uoms(id) ON DELETE SET NULL,
    brand_id UUID NULL REFERENCES inventory_brands(id) ON DELETE SET NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_product_code UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_products_school ON products(school_id);

-- 7. SKUs MASTER TABLE (Single Item Master)
CREATE TABLE IF NOT EXISTS skus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    product_id UUID NULL REFERENCES products(id) ON DELETE SET NULL,
    sku_name VARCHAR(200) NULL,
    sku_code VARCHAR(100) NOT NULL,
    barcode VARCHAR(100) NULL,
    alternate_barcode VARCHAR(100) NULL,
    category_id UUID NULL REFERENCES inventory_categories(id) ON DELETE SET NULL,
    subcategory_id UUID NULL REFERENCES inventory_subcategories(id) ON DELETE SET NULL,
    uom_id UUID NULL REFERENCES inventory_uoms(id) ON DELETE SET NULL,
    brand_id UUID NULL REFERENCES inventory_brands(id) ON DELETE SET NULL,
    description TEXT NULL,
    reorder_level NUMERIC(10,2) NOT NULL DEFAULT 10,
    min_order_qty NUMERIC(10,2) NOT NULL DEFAULT 1,
    max_stock NUMERIC(12,2) NULL,
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_sku_code UNIQUE(school_id, sku_code)
);

-- Ensure skus columns exist if table was previously created with 018
ALTER TABLE skus ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS sku_name VARCHAR(200);
ALTER TABLE skus ADD COLUMN IF NOT EXISTS alternate_barcode VARCHAR(100);
ALTER TABLE skus ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES inventory_subcategories(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES inventory_uoms(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES inventory_brands(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS max_stock NUMERIC(12,2) NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill from products if sku_name is empty
UPDATE skus s
SET sku_name = COALESCE(s.sku_name, p.name),
    category_id = COALESCE(s.category_id, p.category_id),
    subcategory_id = COALESCE(s.subcategory_id, p.subcategory_id),
    uom_id = COALESCE(s.uom_id, p.uom_id),
    brand_id = COALESCE(s.brand_id, p.brand_id),
    description = COALESCE(s.description, p.description)
FROM products p
WHERE s.product_id = p.id;

UPDATE skus SET sku_name = sku_code WHERE sku_name IS NULL OR sku_name = '';

CREATE INDEX IF NOT EXISTS idx_skus_school ON skus(school_id);
CREATE INDEX IF NOT EXISTS idx_skus_name ON skus(school_id, sku_name);
CREATE INDEX IF NOT EXISTS idx_skus_category ON skus(category_id);
CREATE INDEX IF NOT EXISTS idx_skus_barcode ON skus(school_id, barcode);
CREATE INDEX IF NOT EXISTS idx_skus_alt_barcode ON skus(school_id, alternate_barcode);
CREATE INDEX IF NOT EXISTS idx_skus_attributes ON skus USING gin(attributes);

-- 8. INVENTORY STOCK BALANCES
CREATE TABLE IF NOT EXISTS inventory_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    reserved_quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    min_quantity NUMERIC(10,2) NOT NULL DEFAULT 5,
    reorder_point NUMERIC(10,2) NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inv_stock_location_sku UNIQUE(school_id, location_id, sku_id)
);
CREATE INDEX IF NOT EXISTS idx_inv_stock_school_loc ON inventory_stock(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inv_stock_sku ON inventory_stock(sku_id);

-- 9. INVENTORY STOCK LEDGER (Append-Only Audit Trail)
CREATE TABLE IF NOT EXISTS inventory_stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    reference_id UUID NULL,
    quantity NUMERIC(12,2) NOT NULL,
    previous_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    new_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_school_loc ON inventory_stock_ledger(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_sku ON inventory_stock_ledger(sku_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_created ON inventory_stock_ledger(school_id, created_at DESC);

-- 10. PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    po_number VARCHAR(50) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES inventory_vendors(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_po_number UNIQUE(school_id, po_number)
);
CREATE INDEX IF NOT EXISTS idx_po_school_loc ON purchase_orders(school_id, location_id);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity_ordered NUMERIC(12,2) NOT NULL,
    quantity_received NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);

-- 11. SALES ORDERS
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    so_number VARCHAR(50) NOT NULL,
    customer_type VARCHAR(30) NOT NULL DEFAULT 'STUDENT',
    customer_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(150) NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_so_number UNIQUE(school_id, so_number)
);
CREATE INDEX IF NOT EXISTS idx_so_school_loc ON sales_orders(school_id, location_id);

CREATE TABLE IF NOT EXISTS sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    so_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity_ordered NUMERIC(12,2) NOT NULL,
    quantity_fulfilled NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_so_items_so ON sales_order_items(so_id);

-- 12. STOCK IN (Goods Receipt)
CREATE TABLE IF NOT EXISTS inventory_stock_in (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    receipt_number VARCHAR(50) NOT NULL,
    vendor_id UUID NULL REFERENCES inventory_vendors(id) ON DELETE SET NULL,
    po_id UUID NULL REFERENCES purchase_orders(id) ON DELETE SET NULL,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_in_receipt UNIQUE(school_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS inventory_stock_in_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_in_id UUID NOT NULL REFERENCES inventory_stock_in(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remarks TEXT NULL
);

-- 13. STOCK OUT (Goods Issue)
CREATE TABLE IF NOT EXISTS inventory_stock_out (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    issue_number VARCHAR(50) NOT NULL,
    so_id UUID NULL REFERENCES sales_orders(id) ON DELETE SET NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    issued_to_type VARCHAR(50) NULL,
    issued_to_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_out_issue UNIQUE(school_id, issue_number)
);

CREATE TABLE IF NOT EXISTS inventory_stock_out_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_out_id UUID NOT NULL REFERENCES inventory_stock_out(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,2) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remarks TEXT NULL
);

-- 14. STOCK ADJUSTMENTS
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    adjustment_number VARCHAR(50) NOT NULL,
    adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason VARCHAR(100) NOT NULL,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_adjustment_number UNIQUE(school_id, adjustment_number)
);

CREATE TABLE IF NOT EXISTS inventory_adjustment_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id UUID NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    adjustment_type VARCHAR(20) NOT NULL,
    quantity NUMERIC(12,2) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remarks TEXT NULL
);

-- 15. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_uoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_in_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_out ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_out_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustment_details ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS: Drop policy if exists before recreating
DROP POLICY IF EXISTS p_inv_cat_isolation ON inventory_categories;
CREATE POLICY p_inv_cat_isolation ON inventory_categories FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_inv_subcat_isolation ON inventory_subcategories;
CREATE POLICY p_inv_subcat_isolation ON inventory_subcategories FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_inv_uom_isolation ON inventory_uoms;
CREATE POLICY p_inv_uom_isolation ON inventory_uoms FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_inv_brand_isolation ON inventory_brands;
CREATE POLICY p_inv_brand_isolation ON inventory_brands FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_inv_vendor_isolation ON inventory_vendors;
CREATE POLICY p_inv_vendor_isolation ON inventory_vendors FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_products_isolation ON products;
CREATE POLICY p_products_isolation ON products FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_skus_isolation ON skus;
CREATE POLICY p_skus_isolation ON skus FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_inv_stock_isolation ON inventory_stock;
CREATE POLICY p_inv_stock_isolation ON inventory_stock FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_inv_ledger_isolation ON inventory_stock_ledger;
CREATE POLICY p_inv_ledger_isolation ON inventory_stock_ledger FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_po_isolation ON purchase_orders;
CREATE POLICY p_po_isolation ON purchase_orders FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_so_isolation ON sales_orders;
CREATE POLICY p_so_isolation ON sales_orders FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_stock_in_isolation ON inventory_stock_in;
CREATE POLICY p_stock_in_isolation ON inventory_stock_in FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_stock_out_isolation ON inventory_stock_out;
CREATE POLICY p_stock_out_isolation ON inventory_stock_out FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

DROP POLICY IF EXISTS p_adjustments_isolation ON inventory_adjustments;
CREATE POLICY p_adjustments_isolation ON inventory_adjustments FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

-- 16. INVENTORY PERMISSIONS
INSERT INTO permissions (id, module, action, code, name, description, default_scope_id, is_system) VALUES
    ('30000000-0000-0000-0000-000000000090', 'inventory', 'view', 'inventory.dashboard.view', 'View Inventory Dashboard', 'View stock KPIs, valuation, and reorder metrics', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000091', 'inventory', 'view', 'inventory.product.view', 'View Products', 'View master product catalog', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000092', 'inventory', 'create', 'inventory.product.create', 'Create Product', 'Add new master product catalog definitions', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000093', 'inventory', 'update', 'inventory.product.update', 'Update Product', 'Edit product specifications and categories', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000094', 'inventory', 'delete', 'inventory.product.delete', 'Delete Product', 'Retire or delete products', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000095', 'inventory', 'view', 'inventory.sku.view', 'View SKUs', 'View inventory SKUs, barcodes and price points', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000096', 'inventory', 'create', 'inventory.sku.create', 'Create SKU', 'Define new stock keeping units', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000097', 'inventory', 'update', 'inventory.sku.update', 'Update SKU', 'Modify SKU pricing, barcode and parameters', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000098', 'inventory', 'delete', 'inventory.sku.delete', 'Delete SKU', 'Remove inventory SKUs', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000099', 'inventory', 'manage', 'inventory.taxonomy.manage', 'Manage Inventory Taxonomy', 'Manage Categories, Subcategories, UOMs, and Brands', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000100', 'inventory', 'manage', 'inventory.vendor.manage', 'Manage Vendors', 'Add, update and deactivate suppliers and vendors', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000101', 'inventory', 'view', 'inventory.stock.view', 'View Stock Balances', 'View real-time stock levels across branches', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000102', 'inventory', 'manage', 'inventory.stock.manage', 'Manage Stock Movements', 'Manage Opening Stock, Stock In, Stock Out, and Adjustments', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000103', 'inventory', 'view', 'inventory.ledger.view', 'View Stock Ledger', 'Inspect immutable audit trail of stock movements', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000104', 'inventory', 'view', 'inventory.purchase_order.view', 'View Purchase Orders', 'View POs, line items, and fulfillment history', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000105', 'inventory', 'manage', 'inventory.purchase_order.manage', 'Manage Purchase Orders', 'Create, approve, and receive PO shipments', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000106', 'inventory', 'view', 'inventory.sales_order.view', 'View Sales Orders', 'View SOs, requisitions, and fulfillment history', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000107', 'inventory', 'manage', 'inventory.sales_order.manage', 'Manage Sales Orders', 'Create, confirm, and fulfill student/staff sales orders', '10000000-0000-0000-0000-000000000002', TRUE),
    ('30000000-0000-0000-0000-000000000108', 'inventory', 'view', 'inventory.reports.view', 'View Inventory Reports', 'Generate stock valuation, movement and reorder reports', '10000000-0000-0000-0000-000000000002', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 17. ROLE PERMISSION ASSIGNMENTS
INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000001', p.id, '10000000-0000-0000-0000-000000000001'
FROM permissions p WHERE p.module = 'inventory'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000002', p.id, '10000000-0000-0000-0000-000000000002'
FROM permissions p WHERE p.module = 'inventory'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, data_scope_id)
SELECT '40000000-0000-0000-0000-000000000003', p.id, '10000000-0000-0000-0000-000000000002'
FROM permissions p WHERE p.module = 'inventory'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 18. DEFAULT SCHOOL CURRENCY TO INR
UPDATE schools
SET currency = 'INR'
WHERE currency IS NULL OR currency = '';
