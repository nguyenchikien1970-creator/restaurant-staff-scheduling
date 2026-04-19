export interface Employee {
  id: string;
  name: string;
  personnelNumber: string;
  weeklyHours: number; // now stored as decimal, e.g. 35.25
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
