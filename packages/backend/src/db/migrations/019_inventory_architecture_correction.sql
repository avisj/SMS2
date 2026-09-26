-- ========================================================================
-- 019_inventory_architecture_correction.sql
-- Inventory Architecture Correction & SKU Master Consolidation
-- 1. Makes product_id nullable on skus table (SKU is now the standalone item master)
-- 2. Adds direct catalog & metadata columns to skus (sku_name, category_id, subcategory_id,
--    brand_id, uom_id, description, alternate_barcode, max_stock, attributes)
-- 3. Backfills existing skus from products without data loss
-- 4. Preserves products table for backward compatibility (no destructive drops)
-- 5. Configures default school currency (INR) and optimizes indexes
-- ========================================================================

-- 1. ALLOW SKUS TO EXIST STANDALONE (product_id optional)
ALTER TABLE skus ALTER COLUMN product_id DROP NOT NULL;

-- 2. ADD CATALOG, TAXONOMY, METADATA & FLEXIBLE ATTRIBUTES DIRECTLY TO SKUS
ALTER TABLE skus ADD COLUMN IF NOT EXISTS sku_name VARCHAR(200);
ALTER TABLE skus ADD COLUMN IF NOT EXISTS alternate_barcode VARCHAR(100);
ALTER TABLE skus ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES inventory_subcategories(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES inventory_uoms(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES inventory_brands(id) ON DELETE SET NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS max_stock NUMERIC(12,2) NULL;
ALTER TABLE skus ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. BACKFILL EXISTING SKUS FROM ASSOCIATED PRODUCTS
UPDATE skus s
SET sku_name = COALESCE(s.sku_name, p.name),
    category_id = COALESCE(s.category_id, p.category_id),
    subcategory_id = COALESCE(s.subcategory_id, p.subcategory_id),
    uom_id = COALESCE(s.uom_id, p.uom_id),
    brand_id = COALESCE(s.brand_id, p.brand_id),
    description = COALESCE(s.description, p.description)
FROM products p
WHERE s.product_id = p.id;

-- Fallback for any SKU that had no product or missing name
UPDATE skus
SET sku_name = sku_code
WHERE sku_name IS NULL OR sku_name = '';

-- 4. PERFORMANCE INDEXES ON NEW SKU COLUMNS
CREATE INDEX IF NOT EXISTS idx_skus_name ON skus(school_id, sku_name);
CREATE INDEX IF NOT EXISTS idx_skus_category ON skus(category_id);
CREATE INDEX IF NOT EXISTS idx_skus_subcategory ON skus(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_skus_brand ON skus(brand_id);
CREATE INDEX IF NOT EXISTS idx_skus_uom ON skus(uom_id);
CREATE INDEX IF NOT EXISTS idx_skus_alt_barcode ON skus(school_id, alternate_barcode);
CREATE INDEX IF NOT EXISTS idx_skus_attributes ON skus USING gin(attributes);

-- 5. ENSURE CENTRAL SCHOOL CURRENCY DEFAULTS TO INR
UPDATE schools
SET currency = 'INR'
WHERE currency IS NULL OR currency = '';
