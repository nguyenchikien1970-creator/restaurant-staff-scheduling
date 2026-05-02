-- =========================================================
-- PHASE 1 Migration — Add new columns (non-destructive)
-- Run in Supabase SQL Editor AFTER the initial migration
-- All columns are nullable → existing data is unaffected
-- =========================================================

-- Employees: contract type, hourly wage, active status
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_wage NUMERIC(6,2) DEFAULT NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Restaurant configs: headcount settings
ALTER TABLE restaurant_configs ADD COLUMN IF NOT EXISTS lunch_peak_headcount INTEGER DEFAULT NULL;
ALTER TABLE restaurant_configs ADD COLUMN IF NOT EXISTS dinner_peak_headcount INTEGER DEFAULT NULL;
ALTER TABLE restaurant_configs ADD COLUMN IF NOT EXISTS baseline_headcount INTEGER DEFAULT NULL;
ALTER TABLE restaurant_configs ADD COLUMN IF NOT EXISTS closing_headcount INTEGER DEFAULT NULL;
ALTER TABLE restaurant_configs ADD COLUMN IF NOT EXISTS month INTEGER DEFAULT NULL;
ALTER TABLE restaurant_configs ADD COLUMN IF NOT EXISTS year INTEGER DEFAULT NULL;
