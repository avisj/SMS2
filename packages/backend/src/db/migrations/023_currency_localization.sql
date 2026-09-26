-- ========================================================================
-- Migration 023: Centralized School Currency & Localization Settings
-- Multi-Tenant SaaS School Management System
-- Provides tenant-level localization parameters without silent historical conversion.
-- ========================================================================

-- 1. ADD LOCALIZATION COLUMNS TO SCHOOLS TABLE
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) DEFAULT '₹',
  ADD COLUMN IF NOT EXISTS currency_position VARCHAR(10) DEFAULT 'BEFORE',
  ADD COLUMN IF NOT EXISTS decimal_places INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS time_format VARCHAR(10) DEFAULT '12h',
  ADD COLUMN IF NOT EXISTS locale VARCHAR(20) DEFAULT 'en-IN';

-- 2. BACKFILL DEFAULTS FOR EXISTING SCHOOLS
UPDATE schools
SET 
  currency = COALESCE(NULLIF(currency, ''), 'INR'),
  currency_symbol = CASE 
    WHEN currency = 'USD' THEN '$'
    WHEN currency = 'EUR' THEN '€'
    WHEN currency = 'GBP' THEN '£'
    WHEN currency = 'AED' THEN 'د.إ'
    WHEN currency = 'SGD' THEN 'S$'
    WHEN currency = 'AUD' THEN 'A$'
    WHEN currency = 'CAD' THEN 'C$'
    WHEN currency = 'JPY' THEN '¥'
    ELSE '₹'
  END,
  currency_position = CASE 
    WHEN currency = 'EUR' THEN 'AFTER'
    ELSE 'BEFORE'
  END,
  decimal_places = CASE 
    WHEN currency = 'JPY' THEN 0
    ELSE 2
  END,
  date_format = COALESCE(NULLIF(date_format, ''), 'DD/MM/YYYY'),
  time_format = COALESCE(NULLIF(time_format, ''), '12h'),
  locale = CASE 
    WHEN currency = 'USD' THEN 'en-US'
    WHEN currency = 'EUR' THEN 'de-DE'
    WHEN currency = 'GBP' THEN 'en-GB'
    WHEN currency = 'AED' THEN 'ar-AE'
    ELSE 'en-IN'
  END
WHERE currency_symbol IS NULL OR currency_position IS NULL OR decimal_places IS NULL;

-- 3. SYNC TO SCHOOL_SETTINGS FOR GENERAL CATEGORY IF MISSING
INSERT INTO school_settings (school_id, setting_key, setting_value, category, data_type)
SELECT 
  s.id, 'currency_code', s.currency, 'GENERAL', 'STRING'
FROM schools s
ON CONFLICT (school_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, updated_at = NOW();

INSERT INTO school_settings (school_id, setting_key, setting_value, category, data_type)
SELECT 
  s.id, 'currency_symbol', s.currency_symbol, 'GENERAL', 'STRING'
FROM schools s
ON CONFLICT (school_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, updated_at = NOW();

INSERT INTO school_settings (school_id, setting_key, setting_value, category, data_type)
SELECT 
  s.id, 'currency_position', s.currency_position, 'GENERAL', 'STRING'
FROM schools s
ON CONFLICT (school_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, updated_at = NOW();

INSERT INTO school_settings (school_id, setting_key, setting_value, category, data_type)
SELECT 
  s.id, 'decimal_places', s.decimal_places::text, 'GENERAL', 'NUMBER'
FROM schools s
ON CONFLICT (school_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, updated_at = NOW();

INSERT INTO school_settings (school_id, setting_key, setting_value, category, data_type)
SELECT 
  s.id, 'locale', s.locale, 'GENERAL', 'STRING'
FROM schools s
ON CONFLICT (school_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
