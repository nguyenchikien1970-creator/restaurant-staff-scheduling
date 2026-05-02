-- =========================================================
-- Restaurant Staff App — Supabase Migration
-- Chạy script này trong Supabase SQL Editor
-- =========================================================

-- 1. Bảng cấu hình nhà hàng
CREATE TABLE IF NOT EXISTS restaurant_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT DEFAULT '',
  open_time TEXT DEFAULT '12:00',
  close_time TEXT DEFAULT '23:00',
  min_staff INTEGER DEFAULT 1,
  closed_days INTEGER[] DEFAULT '{}',
  day_schedules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Bảng nhân viên
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  personnel_number TEXT DEFAULT '',
  weekly_hours NUMERIC(6,2) DEFAULT 40.00,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Bảng lịch làm việc
CREATE TABLE IF NOT EXISTS schedule_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  start_time TEXT DEFAULT '',
  end_time TEXT DEFAULT '',
  pause_minutes INTEGER DEFAULT 0,
  absence_code TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, entry_date)
);

-- =========================================================
-- Row Level Security (RLS) — mỗi user chỉ thấy data của mình
-- =========================================================

ALTER TABLE restaurant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;

-- Policies cho restaurant_configs
CREATE POLICY "Users can view own config"
  ON restaurant_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own config"
  ON restaurant_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own config"
  ON restaurant_configs FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies cho employees
CREATE POLICY "Users can view own employees"
  ON employees FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own employees"
  ON employees FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own employees"
  ON employees FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own employees"
  ON employees FOR DELETE
  USING (auth.uid() = user_id);

-- Policies cho schedule_entries
CREATE POLICY "Users can view own entries"
  ON schedule_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON schedule_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON schedule_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON schedule_entries FOR DELETE
  USING (auth.uid() = user_id);

-- =========================================================
-- Indexes for performance
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_user_id ON schedule_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_month_year ON schedule_entries(user_id, month, year);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_employee ON schedule_entries(employee_id, entry_date);

-- =========================================================
-- Migration: Peak hours & Busy days (Phase 5)
-- Run this if columns don't exist yet
-- =========================================================
ALTER TABLE restaurant_configs ADD COLUMN IF NOT EXISTS bundesland TEXT DEFAULT '';
ALTER TABLE restaurant_configs ADD COLUMN IF NOT EXISTS busy_days INTEGER[] DEFAULT '{}';
ALTER TABLE restaurant_configs ADD COLUMN IF NOT EXISTS lunch_peak_start TEXT DEFAULT '12:00';
ALTER TABLE restaurant_configs ADD COLUMN IF NOT EXISTS lunch_peak_end TEXT DEFAULT '15:00';
ALTER TABLE restaurant_configs ADD COLUMN IF NOT EXISTS dinner_peak_start TEXT DEFAULT '18:00';
ALTER TABLE restaurant_configs ADD COLUMN IF NOT EXISTS dinner_peak_end TEXT DEFAULT '21:00';
