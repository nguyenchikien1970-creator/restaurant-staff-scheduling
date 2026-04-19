import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { MasterData, Employee, RestaurantConfig, DailyEntry } from '../types';

// ─────────────────────────────────────────────────
// Hook: load/save data from Supabase per logged-in user
// With proper error handling + operation status tracking
// ─────────────────────────────────────────────────

export type OperationStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useSupabaseData(userId: string | null) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<OperationStatus>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const [masterData, setMasterData] = useState<MasterData>({
    companyName: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    restaurantConfig: { openTime: '12:00', closeTime: '23:00', minStaff: 1, closedDays: [] },
    employees: [],
  });
  const [entries, setEntries] = useState<DailyEntry[]>([]);

  // Helper: show save status briefly then reset
  const flashStatus = (status: OperationStatus, msg: string, durationMs = 3000) => {
    setSaveStatus(status);
    setSaveMessage(msg);
    if (status !== 'saving') {
      setTimeout(() => { setSaveStatus('idle'); setSaveMessage(''); }, durationMs);
    }
  };

  // ── Load all data from Supabase ──
  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);

    try {
      // 1. Load restaurant config
      const { data: configData, error: configErr } = await supabase
        .from('restaurant_configs')
        .select('*')
        .eq('user_id', userId)
        .single();

      // PGRST116 = no rows found → first time user, not an error
      if (configErr && configErr.code !== 'PGRST116') {
        throw new Error(`Config load failed: ${configErr.message}`);
      }

      // 2. Load employees
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (empErr) throw new Error(`Employees load failed: ${empErr.message}`);

      const month = configData?.month || new Date().getMonth() + 1;
      const year = configData?.year || new Date().getFullYear();

      const employees: Employee[] = (empData || []).map(e => ({
        id: e.id,
        name: e.name,
        personnelNumber: e.personnel_number || '',
        weeklyHours: parseFloat(e.weekly_hours) || 40,
      }));

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
        month,
        year,
        restaurantConfig: config,
        employees,
      });

      // 3. Load schedule entries
      await loadEntries(userId, month, year);

    } catch (err: any) {
      console.error('Supabase load error:', err);
      setLoadError(err.message || 'Failed to load data');
    }

    setLoading(false);
  }, [userId]);

  // ── Load schedule entries for specific month/year ──
  const loadEntries = async (uid: string, month: number, year: number) => {
    const { data: entryData, error } = await supabase
      .from('schedule_entries')
      .select('*')
      .eq('user_id', uid)
      .eq('month', month)
      .eq('year', year);

    if (error) throw new Error(`Schedule load failed: ${error.message}`);

    setEntries((entryData || []).map(e => ({
      employeeId: e.employee_id,
      date: e.entry_date,
      startTime: e.start_time || '',
      pauseMinutes: e.pause_minutes || 0,
      endTime: e.end_time || '',
      absenceCode: e.absence_code || '',
      remark: e.remark || '',
    })));
  };

  useEffect(() => { loadData(); }, [loadData]);

  // ── Save restaurant config ──
  const saveConfig = useCallback(async (data: MasterData): Promise<boolean> => {
    if (!userId) return false;
    flashStatus('saving', '');
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
    if (error) {
      console.error('Save config error:', error);
      flashStatus('error', error.message);
      return false;
    }
    flashStatus('saved', '✓');
    return true;
  }, [userId]);

  // ── Save employee ──
  const saveEmployee = useCallback(async (emp: Employee): Promise<boolean> => {
    if (!userId) return false;
    const { error } = await supabase
      .from('employees')
      .upsert({
        id: emp.id,
        user_id: userId,
        name: emp.name,
        personnel_number: emp.personnelNumber,
        weekly_hours: emp.weeklyHours,
      }, { onConflict: 'id' });
    if (error) {
      console.error('Save employee error:', error);
      flashStatus('error', `Employee save failed: ${error.message}`);
      return false;
    }
    return true;
  }, [userId]);

  // ── Add new employee ──
  const addEmployee = useCallback(async (emp: Omit<Employee, 'id'> & { id?: string }): Promise<Employee | null> => {
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
    if (error) {
      console.error('Add employee error:', error);
      flashStatus('error', `Add employee failed: ${error.message}`);
      return null;
    }
    return {
      id: data.id,
      name: data.name,
      personnelNumber: data.personnel_number,
      weeklyHours: parseFloat(data.weekly_hours),
    } as Employee;
  }, [userId]);

  // ── Delete employee ──
  const deleteEmployee = useCallback(async (empId: string): Promise<boolean> => {
    if (!userId) return false;
    const { error: entryErr } = await supabase.from('schedule_entries').delete().eq('employee_id', empId);
    if (entryErr) console.warn('Delete entries warning:', entryErr);
    const { error } = await supabase.from('employees').delete().eq('id', empId);
    if (error) {
      console.error('Delete employee error:', error);
      flashStatus('error', `Delete failed: ${error.message}`);
      return false;
    }
    return true;
  }, [userId]);

  // ── Save all schedule entries for a month ──
  const saveEntries = useCallback(async (newEntries: DailyEntry[], month: number, year: number): Promise<boolean> => {
    if (!userId) return false;
    flashStatus('saving', '');

    // Delete existing
    const { error: delErr } = await supabase
      .from('schedule_entries')
      .delete()
      .eq('user_id', userId)
      .eq('month', month)
      .eq('year', year);
    if (delErr) {
      flashStatus('error', `Delete old entries failed: ${delErr.message}`);
      return false;
    }

    if (newEntries.length === 0) { flashStatus('saved', '✓'); return true; }

    const rows = newEntries.map(e => ({
      user_id: userId,
      employee_id: e.employeeId,
      entry_date: e.date,
      month, year,
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
      if (error) {
        console.error('Save entries batch error:', error);
        flashStatus('error', `Save entries failed: ${error.message}`);
        return false;
      }
    }

    flashStatus('saved', '✓');
    return true;
  }, [userId]);

  return {
    loading,
    loadError,
    saveStatus,
    saveMessage,
    masterData, setMasterData,
    entries, setEntries,
    saveConfig, saveEmployee, addEmployee, deleteEmployee, saveEntries,
    loadData,
  };
}
