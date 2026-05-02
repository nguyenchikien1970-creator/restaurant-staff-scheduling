import { useState, useEffect, useCallback } from 'react';
import { MasterData, Employee, DailyEntry } from '../types';

// ─────────────────────────────────────────────────
// Hook: load/save data from localStorage (replaces Supabase)
// Same interface as useSupabaseData for drop-in replacement
// ─────────────────────────────────────────────────

export type OperationStatus = 'idle' | 'saving' | 'saved' | 'error';

const STORAGE_KEYS = {
  masterData: 'restaurant_masterData',
  entries: (month: number, year: number) => `restaurant_entries_${month}_${year}`,
};

const defaultMasterData: MasterData = {
  companyName: '',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  restaurantConfig: { openTime: '12:00', closeTime: '23:00', minStaff: 1, closedDays: [] },
  employees: [],
};

export function useLocalData() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<OperationStatus>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const [masterData, setMasterData] = useState<MasterData>(defaultMasterData);
  const [entries, setEntries] = useState<DailyEntry[]>([]);

  // Helper: show save status briefly then reset
  const flashStatus = (status: OperationStatus, msg: string, durationMs = 2000) => {
    setSaveStatus(status);
    setSaveMessage(msg);
    if (status !== 'saving') {
      setTimeout(() => { setSaveStatus('idle'); setSaveMessage(''); }, durationMs);
    }
  };

  // ── Load all data from localStorage ──
  const loadData = useCallback(() => {
    setLoading(true);
    setLoadError(null);

    try {
      // 1. Load masterData (config + employees)
      const stored = localStorage.getItem(STORAGE_KEYS.masterData);
      if (stored) {
        const parsed: MasterData = JSON.parse(stored);
        setMasterData(parsed);

        // 2. Load entries for the stored month/year
        const entriesKey = STORAGE_KEYS.entries(parsed.month, parsed.year);
        const storedEntries = localStorage.getItem(entriesKey);
        if (storedEntries) {
          setEntries(JSON.parse(storedEntries));
        }
      }
    } catch (err: any) {
      console.error('localStorage load error:', err);
      setLoadError(err.message || 'Failed to load data');
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Save restaurant config (masterData) ──
  const saveConfig = useCallback((data: MasterData): boolean => {
    try {
      flashStatus('saving', '');
      // Merge: keep employees from current state, update config fields
      const toSave: MasterData = {
        ...data,
        employees: masterData.employees.length > 0 && data.employees.length === 0
          ? masterData.employees
          : data.employees,
      };
      localStorage.setItem(STORAGE_KEYS.masterData, JSON.stringify(toSave));
      flashStatus('saved', '✓');
      return true;
    } catch (err: any) {
      console.error('Save config error:', err);
      flashStatus('error', err.message);
      return false;
    }
  }, [masterData.employees]);

  // ── Save full masterData (called when employees change too) ──
  const persistMasterData = useCallback((data: MasterData) => {
    try {
      localStorage.setItem(STORAGE_KEYS.masterData, JSON.stringify(data));
    } catch (err) {
      console.error('Persist masterData error:', err);
    }
  }, []);

  // ── Save employee ──
  const saveEmployee = useCallback(async (emp: Employee): Promise<boolean> => {
    try {
      setMasterData(prev => {
        const updated = {
          ...prev,
          employees: prev.employees.map(e => e.id === emp.id ? emp : e),
        };
        persistMasterData(updated);
        return updated;
      });
      return true;
    } catch (err: any) {
      console.error('Save employee error:', err);
      flashStatus('error', `Employee save failed: ${err.message}`);
      return false;
    }
  }, [persistMasterData]);

  // ── Add new employee ──
  const addEmployee = useCallback(async (emp: Omit<Employee, 'id'> & { id?: string }): Promise<Employee | null> => {
    try {
      const newEmp: Employee = {
        id: emp.id || crypto.randomUUID(),
        name: emp.name,
        personnelNumber: emp.personnelNumber || '',
        weeklyHours: emp.weeklyHours,
        contractType: emp.contractType || undefined,
        hourlyWage: emp.hourlyWage || undefined,
        isActive: true,
      };
      // Note: we don't update masterData here because App.tsx already handles it
      // via handleEmployeesChange. We just need to persist.
      return newEmp;
    } catch (err: any) {
      console.error('Add employee error:', err);
      flashStatus('error', `Add employee failed: ${err.message}`);
      return null;
    }
  }, []);

  // ── Delete employee ──
  const deleteEmployee = useCallback(async (empId: string): Promise<boolean> => {
    try {
      // Also remove entries for this employee
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (key.startsWith('restaurant_entries_')) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const ent: DailyEntry[] = JSON.parse(stored);
            const filtered = ent.filter(e => e.employeeId !== empId);
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        }
      });
      return true;
    } catch (err: any) {
      console.error('Delete employee error:', err);
      flashStatus('error', `Delete failed: ${err.message}`);
      return false;
    }
  }, []);

  // ── Save all schedule entries for a month ──
  const saveEntries = useCallback(async (newEntries: DailyEntry[], month: number, year: number): Promise<boolean> => {
    try {
      flashStatus('saving', '');
      const key = STORAGE_KEYS.entries(month, year);
      localStorage.setItem(key, JSON.stringify(newEntries));
      flashStatus('saved', '✓');
      return true;
    } catch (err: any) {
      console.error('Save entries error:', err);
      flashStatus('error', `Save entries failed: ${err.message}`);
      return false;
    }
  }, []);

  // ── Load entries from previous month ──
  const loadPreviousMonthEntries = useCallback(async (month: number, year: number): Promise<DailyEntry[]> => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const key = STORAGE_KEYS.entries(prevMonth, prevYear);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }, []);

  // Auto-persist masterData whenever it changes
  useEffect(() => {
    if (!loading) {
      persistMasterData(masterData);
    }
  }, [masterData, loading, persistMasterData]);

  return {
    loading,
    loadError,
    saveStatus,
    saveMessage,
    masterData, setMasterData,
    entries, setEntries,
    saveConfig, saveEmployee, addEmployee, deleteEmployee, saveEntries,
    loadData, loadPreviousMonthEntries,
  };
}
