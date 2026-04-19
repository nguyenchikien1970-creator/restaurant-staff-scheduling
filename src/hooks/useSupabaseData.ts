import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { MasterData, Employee, RestaurantConfig, DailyEntry } from '../types';

// ─────────────────────────────────────────────────
// Hook: load/save data from Supabase per logged-in user
// ─────────────────────────────────────────────────

export function useSupabaseData(userId: string | null) {
  const [loading, setLoading] = useState(true);
  const [masterData, setMasterData] = useState<MasterData>({
    companyName: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    restaurantConfig: { openTime: '12:00', closeTime: '23:00', minStaff: 1, closedDays: [] },
    employees: [],
  });
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [dbEmployeeMap, setDbEmployeeMap] = useState<Record<string, string>>({}); // local id → db id

  // ── Load all data from Supabase ──
  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    try {
      // 1. Load restaurant config
      const { data: configData } = await supabase
        .from('restaurant_configs')
        .select('*')
        .eq('user_id', userId)
        .single();

      // 2. Load employees
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      // 3. Load current month/year schedule entries
      const month = configData?.month || new Date().getMonth() + 1;
      const year = configData?.year || new Date().getFullYear();

      const employees: Employee[] = (empData || []).map(e => ({
        id: e.id,
        name: e.name,
        personnelNumber: e.personnel_number || '',
        weeklyHours: parseFloat(e.weekly_hours) || 40,
      }));

      // Build employee id map
      const idMap: Record<string, string> = {};
      employees.forEach(e => { idMap[e.id] = e.id; });
      setDbEmployeeMap(idMap);

      const config: RestaurantConfig = configData
        ? {
            openTime: configData.open_time || '12:00',
            closeTime: configData.close_time || '23:00',
            minStaff: configData.min_staff || 1,
            closedDays: configData.closed_days || [],
            daySchedules: configData.day_schedules || undefined,
          }
        : { openTime: '12:00', closeTime: '23:00', minStaff: 1, closedDays: [] };

      setMasterData({
        companyName: configData?.company_name || '',
        month: month,
        year: year,
        restaurantConfig: config,
        employees,
      });

      // Load schedule entries for current month/year
      await loadEntries(userId, month, year, employees);

    } catch (err) {
      console.error('Error loading data from Supabase:', err);
    }

    setLoading(false);
  }, [userId]);

  // ── Load schedule entries for specific month/year ──
  const loadEntries = async (uid: string, month: number, year: number, emps: Employee[]) => {
    const { data: entryData } = await supabase
      .from('schedule_entries')
      .select('*')
      .eq('user_id', uid)
      .eq('month', month)
      .eq('year', year);

    const dailyEntries: DailyEntry[] = (entryData || []).map(e => ({
      employeeId: e.employee_id,
      date: e.entry_date,
      startTime: e.start_time || '',
      pauseMinutes: e.pause_minutes || 0,
      endTime: e.end_time || '',
      absenceCode: e.absence_code || '',
      remark: e.remark || '',
    }));

    setEntries(dailyEntries);
  };

  useEffect(() => { loadData(); }, [loadData]);

  // ── Save restaurant config ──
  const saveConfig = useCallback(async (data: MasterData) => {
    if (!userId) return;
    const { error } = await supabase
      .from('restaurant_configs')
      .upsert({
        user_id: userId,
        company_name: data.companyName,
        open_time: data.restaurantConfig.openTime,
        close_time: data.restaurantConfig.closeTime,
        min_staff: data.restaurantConfig.minStaff,
        closed_days: data.restaurantConfig.closedDays,
        day_schedules: data.restaurantConfig.daySchedules || {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (error) console.error('Error saving config:', error);
  }, [userId]);

  // ── Save employee ──
  const saveEmployee = useCallback(async (emp: Employee) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('employees')
      .upsert({
        id: emp.id,
        user_id: userId,
        name: emp.name,
        personnel_number: emp.personnelNumber,
        weekly_hours: emp.weeklyHours,
      }, { onConflict: 'id' })
      .select()
      .single();
    if (error) console.error('Error saving employee:', error);
    return data;
  }, [userId]);

  // ── Add new employee ──
  const addEmployee = useCallback(async (emp: Omit<Employee, 'id'>) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('employees')
      .insert({
        user_id: userId,
        name: emp.name,
        personnel_number: emp.personnelNumber,
        weekly_hours: emp.weeklyHours,
      })
      .select()
      .single();
    if (error) { console.error('Error adding employee:', error); return null; }
    return {
      id: data.id,
      name: data.name,
      personnelNumber: data.personnel_number,
      weeklyHours: parseFloat(data.weekly_hours),
    } as Employee;
  }, [userId]);

  // ── Delete employee ──
  const deleteEmployee = useCallback(async (empId: string) => {
    if (!userId) return;
    // Delete schedule entries first
    await supabase.from('schedule_entries').delete().eq('employee_id', empId);
    await supabase.from('employees').delete().eq('id', empId);
  }, [userId]);

  // ── Save all schedule entries for a month ──
  const saveEntries = useCallback(async (newEntries: DailyEntry[], month: number, year: number) => {
    if (!userId) return;

    // Delete existing entries for this month
    await supabase
      .from('schedule_entries')
      .delete()
      .eq('user_id', userId)
      .eq('month', month)
      .eq('year', year);

    // Insert new entries (batch)
    if (newEntries.length === 0) return;

    const rows = newEntries.map(e => ({
      user_id: userId,
      employee_id: e.employeeId,
      entry_date: e.date,
      month,
      year,
      start_time: e.startTime,
      end_time: e.endTime,
      pause_minutes: e.pauseMinutes,
      absence_code: e.absenceCode,
      remark: e.remark,
    }));

    // Insert in batches of 500
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase.from('schedule_entries').insert(batch);
      if (error) console.error('Error saving entries batch:', error);
    }
  }, [userId]);

  return {
    loading,
    masterData,
    setMasterData,
    entries,
    setEntries,
    saveConfig,
    saveEmployee,
    addEmployee,
    deleteEmployee,
    saveEntries,
    loadData,
  };
}
