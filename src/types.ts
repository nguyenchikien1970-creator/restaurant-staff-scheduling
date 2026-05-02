export type ContractType = 'Vollzeit' | 'Teilzeit' | 'Minijob';

export interface Employee {
  id: string;
  name: string;
  personnelNumber: string;
  weeklyHours: number; // now stored as decimal, e.g. 35.25
  contractType?: ContractType;  // auto-derived from weeklyHours if not set
  hourlyWage?: number;          // relevant for Minijob tracking
  isActive?: boolean;           // default true
}

export interface DayScheduleConfig {
  closed: boolean;        // true = Ruhetag
  openTime: string;       // HH:mm — custom per day
  closeTime: string;      // HH:mm — custom per day
}

export interface RestaurantConfig {
  openTime: string; // HH:mm — default opening time
  closeTime: string; // HH:mm — default closing time
  minStaff: number;
  closedDays: number[]; // legacy — kept for backward compatibility
  daySchedules?: Record<number, DayScheduleConfig>; // per-day config: key = dow (0=Sun..6=Sat)
  lunchPeakHeadcount?: number;   // NV giờ trưa (12:00-15:00), default: minStaff + 2
  dinnerPeakHeadcount?: number;  // NV giờ tối (18:00-21:00), default: minStaff + 2
  baselineHeadcount?: number;    // NV giờ thường, default: minStaff
  closingHeadcount?: number;     // NV giờ đóng cửa, default: 2
  bundesland?: string;           // German state for Feiertage detection
  busyDays?: number[];           // Days of week with most customers (0=Sun..6=Sat)
  lunchPeakStart?: string;       // "12:00" — lunch rush start
  lunchPeakEnd?: string;         // "15:00" — lunch rush end
  dinnerPeakStart?: string;      // "18:00" — dinner rush start
  dinnerPeakEnd?: string;        // "21:00" — dinner rush end
}

export interface MasterData {
  companyName: string;
  month: number;
  year: number;
  restaurantConfig: RestaurantConfig;
  employees: Employee[];
}

export type AbsenceCode = '' | 'K' | 'U' | 'UU' | 'F' | 'SA' | 'SU';

export interface DailyEntry {
  employeeId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  pauseMinutes: number;
  endTime: string; // HH:mm
  absenceCode: AbsenceCode;
  remark: string;
}

export interface CalculatedEntry extends DailyEntry {
  durationMinutes: number;
  durationTime: string; // HH:mm
  durationDecimal: number;
  warnings: string[];
}

export interface MonthlySummaryData {
  totalNormalHours: number;
  totalK: number;
  totalU: number;
  totalUU: number;
  totalF: number;
  calendarDays: number;
  workedDays: number;
  absenceDays: number;
  totalBreakMinutes: number;
  totalDecimalHours: number;
}

/** Helper: derive contract type from weekly hours if not explicitly set */
export function deriveContractType(weeklyHours: number): ContractType {
  if (weeklyHours >= 35) return 'Vollzeit';
  if (weeklyHours >= 10) return 'Teilzeit';
  return 'Minijob';
}

/** Helper: get effective contract type for an employee */
export function getContractType(emp: Employee): ContractType {
  return emp.contractType || deriveContractType(emp.weeklyHours);
}
