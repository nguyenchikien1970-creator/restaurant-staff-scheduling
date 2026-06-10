import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, getDaysInMonth, isValid, parse, differenceInMinutes, isAfter, addDays, getWeek } from "date-fns";
import { de } from "date-fns/locale";
import { vi } from "date-fns/locale";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DailyEntry, CalculatedEntry, MasterData, MonthlySummaryData, AbsenceCode, Employee, RestaurantConfig, DayScheduleConfig } from "../types";
import { TranslateFn, Language } from "../i18n";

export const MIN_AUTO_SHIFT_MINUTES = 120;

/** Get the open/close times for a specific day-of-week, falling back to the global config */
export function getDayOpenClose(config: RestaurantConfig, dow: number): { openTime: string; closeTime: string; closed: boolean } {
  const dayConfig = config.daySchedules?.[dow];
  if (dayConfig) {
    return {
      openTime: dayConfig.openTime || config.openTime,
      closeTime: dayConfig.closeTime || config.closeTime,
      closed: dayConfig.closed,
    };
  }
  // Fallback: use global config + legacy closedDays
  const isClosed = (config.closedDays ?? []).includes(dow);
  return { openTime: config.openTime, closeTime: config.closeTime, closed: isClosed };
}

/** Check if a day-of-week is closed for the restaurant */
export function isDayClosed(config: RestaurantConfig, dow: number): boolean {
  return getDayOpenClose(config, dow).closed;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── German Public Holidays (Feiertage) ──
// Easter calculation using Anonymous Gregorian algorithm
function getEasterDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export const BUNDESLAENDER = [
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'
] as const;

export const BUNDESLAND_NAMES: Record<string, string> = {
  'BW': 'Baden-Württemberg', 'BY': 'Bayern', 'BE': 'Berlin', 'BB': 'Brandenburg',
  'HB': 'Bremen', 'HH': 'Hamburg', 'HE': 'Hessen', 'MV': 'Mecklenburg-Vorpommern',
  'NI': 'Niedersachsen', 'NW': 'Nordrhein-Westfalen', 'RP': 'Rheinland-Pfalz',
  'SL': 'Saarland', 'SN': 'Sachsen', 'ST': 'Sachsen-Anhalt', 'SH': 'Schleswig-Holstein', 'TH': 'Thüringen'
};

export function getGermanHolidays(year: number, bundesland?: string): Set<string> {
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  const addD = (d: Date, days: number) => addDays(d, days);
  const easter = getEasterDate(year);
  const bl = bundesland || '';

  const holidays = new Set<string>();

  // National holidays (all states)
  holidays.add(fmt(new Date(year, 0, 1)));    // Neujahr
  holidays.add(fmt(addD(easter, -2)));         // Karfreitag
  holidays.add(fmt(addD(easter, 1)));          // Ostermontag
  holidays.add(fmt(new Date(year, 4, 1)));     // Tag der Arbeit
  holidays.add(fmt(addD(easter, 39)));         // Christi Himmelfahrt
  holidays.add(fmt(addD(easter, 50)));         // Pfingstmontag
  holidays.add(fmt(new Date(year, 9, 3)));     // Tag der Deutschen Einheit
  holidays.add(fmt(new Date(year, 11, 25)));   // 1. Weihnachtstag
  holidays.add(fmt(new Date(year, 11, 26)));   // 2. Weihnachtstag

  // State-specific holidays
  if (['BW', 'BY', 'ST'].includes(bl)) holidays.add(fmt(new Date(year, 0, 6)));       // Heilige Drei Könige
  if (['BW', 'BY', 'HE', 'NW', 'RP', 'SL'].includes(bl)) holidays.add(fmt(addD(easter, 60))); // Fronleichnam
  if (['BY', 'SL'].includes(bl)) holidays.add(fmt(new Date(year, 7, 15)));             // Mariä Himmelfahrt
  if (['BB', 'MV', 'SN', 'ST', 'TH'].includes(bl)) holidays.add(fmt(new Date(year, 9, 31)));   // Reformationstag
  if (['BW', 'BY', 'NW', 'RP', 'SL'].includes(bl)) holidays.add(fmt(new Date(year, 10, 1)));   // Allerheiligen
  if (['SN'].includes(bl)) {
    // Buß- und Bettag: Wednesday before Nov 23
    const nov23 = new Date(year, 10, 23);
    const dayOfWeek = nov23.getDay();
    const daysBack = dayOfWeek >= 3 ? dayOfWeek - 3 : dayOfWeek + 4;
    holidays.add(fmt(addD(nov23, -daysBack)));
  }
  if (['BE'].includes(bl)) holidays.add(fmt(new Date(year, 2, 8)));                   // Internationaler Frauentag
  if (['TH'].includes(bl)) holidays.add(fmt(new Date(year, 8, 20)));                  // Weltkindertag

  return holidays;
}

export function generateMonthDates(month: number, year: number): string[] {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const dates: string[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    dates.push(format(new Date(year, month - 1, i), 'yyyy-MM-dd'));
  }
  return dates;
}

export function generateAutoFillEntries(
  month: number,
  year: number,
  workingDays: number,
  startTime: string,
  endTime: string,
  employeeId: string
): DailyEntry[] {
  const dates = generateMonthDates(month, year);
  const weekdays: string[] = [];
  const weekends: string[] = [];

  dates.forEach(date => {
    const d = new Date(date);
    const day = d.getDay();
    if (day === 0 || day === 6) {
      weekends.push(date);
    } else {
      weekdays.push(date);
    }
  });

  const pool = [...weekdays, ...weekends];
  const neededDays = Math.min(workingDays, pool.length);
  const selectedWork = pool.slice(0, neededDays);
  const grossShiftMinutes = calculateGrossShiftMinutes(startTime, endTime);

  return dates.map(date => {
    const entry: DailyEntry = {
      employeeId, date, startTime: '', pauseMinutes: 0,
      endTime: '', absenceCode: '', remark: ''
    };
    if (selectedWork.includes(date) && grossShiftMinutes >= MIN_AUTO_SHIFT_MINUTES) {
      entry.startTime = startTime;
      entry.endTime = endTime;
      entry.pauseMinutes = grossShiftMinutes > 510 ? 45 : grossShiftMinutes > 360 ? 30 : 0;
    }
    return entry;
  });
}

export function calculateGrossShiftMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const start = parse(startTime, 'HH:mm', new Date());
  let end = parse(endTime, 'HH:mm', new Date());
  if (!isValid(start) || !isValid(end)) return 0;
  if (isAfter(start, end)) {
    end = addDays(end, 1);
  }
  return Math.max(0, differenceInMinutes(end, start));
}

export function calculateWorkedMinutes(startTime: string, endTime: string, pauseMinutes: number): number {
  let diff = calculateGrossShiftMinutes(startTime, endTime);
  diff -= (pauseMinutes || 0);
  return Math.max(0, diff);
}

export function formatMinutesToTime(minutes: number): string {
  const isNegative = minutes < 0;
  const absMinutes = Math.abs(Math.round(minutes));
  const h = Math.floor(absMinutes / 60);
  const m = absMinutes % 60;
  return `${isNegative ? '-' : ''}${h}:${m.toString().padStart(2, '0')}`;
}

export function calculateDecimalHours(minutes: number): number {
  return Number((minutes / 60).toFixed(2));
}

// Returns translation keys instead of hardcoded strings
// Pause rules (based on GROSS time = total time present):
//   gross ≤ 8h30 (510 min) → Pause must be ≥ 30 min
//   gross > 8h30 (510 min) → Pause must be ≥ 45 min
// German labor law:
//   max 10h net per day
//   max 6h continuous work without break
export function validateRow(entry: DailyEntry, durationMinutes: number): string[] {
  const warnings: string[] = [];
  const isFullAbsence = ['K', 'U', 'UU', 'F'].includes(entry.absenceCode);

  if (!isFullAbsence) {
    if (entry.startTime && !entry.endTime) warnings.push('warning.endMissing');
    if (!entry.startTime && entry.endTime) warnings.push('warning.startMissing');
    if (entry.pauseMinutes < 0) warnings.push('warning.pauseNegative');
    const grossShiftMinutes = calculateGrossShiftMinutes(entry.startTime, entry.endTime);
    if (grossShiftMinutes > 0 && grossShiftMinutes < MIN_AUTO_SHIFT_MINUTES) {
      warnings.push('warning.shiftUnder2h');
    }
    // Only flag if we have a full shift recorded
    if (entry.startTime && entry.endTime && durationMinutes > 0) {
      // Calculate GROSS time (total time present = net worked + pause)
      const grossMinutes = durationMinutes + (entry.pauseMinutes || 0);

      // Break rules (GROSS-based)
      if (grossMinutes > 510 && entry.pauseMinutes < 45) warnings.push('warning.pauseUnder45');
      else if (grossMinutes <= 510 && grossMinutes > 360 && entry.pauseMinutes < 30) warnings.push('warning.pauseUnder30');

      // German law: max 10h NET per day
      if (durationMinutes > 600) warnings.push('warning.over10h');
      // German law: > 6h continuous without any break
      else if (grossMinutes > 360 && (entry.pauseMinutes || 0) === 0) warnings.push('warning.over6hNoPause');
    }
  }
  return warnings;
}

// Check 11h minimum rest between consecutive shifts for one employee
export function validateRestBetweenShifts(entries: DailyEntry[]): Map<string, string[]> {
  const restWarnings = new Map<string, string[]>(); // date → warnings
  const sorted = entries
    .filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode))
    .sort((a, b) => {
      const dateComp = a.date.localeCompare(b.date);
      if (dateComp !== 0) return dateComp;
      return a.startTime.localeCompare(b.startTime);
    });

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    // Parse end of previous day and start of current day
    const prevEnd = parse(`${prev.date} ${prev.endTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const currStart = parse(`${curr.date} ${curr.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const restMinutes = differenceInMinutes(currStart, prevEnd);

    if (restMinutes >= 0 && restMinutes < 660) { // 11h = 660 min
      const existing = restWarnings.get(curr.date) || [];
      existing.push('warning.restUnder11h');
      restWarnings.set(curr.date, existing);
    }
  }
  return restWarnings;
}


export function processEntries(entries: DailyEntry[]): CalculatedEntry[] {
  // Pre-compute rest-between-shifts warnings for the entire list
  const restWarnings = validateRestBetweenShifts(entries);

  return entries.map(entry => {
    const isFullAbsence = ['K', 'U', 'UU', 'F'].includes(entry.absenceCode);
    let durationMinutes = 0;
    if (!isFullAbsence || entry.absenceCode === 'SA' || entry.absenceCode === 'SU') {
      durationMinutes = calculateWorkedMinutes(entry.startTime, entry.endTime, entry.pauseMinutes);
    }
    const rowWarnings = validateRow(entry, durationMinutes);
    // Merge rest warnings for this date
    const dateRestWarnings = restWarnings.get(entry.date) || [];
    return {
      ...entry, durationMinutes,
      durationTime: formatMinutesToTime(durationMinutes),
      durationDecimal: calculateDecimalHours(durationMinutes),
      warnings: [...rowWarnings, ...dateRestWarnings]
    };
  });
}

export function calculateSummary(entries: CalculatedEntry[], holidays?: Set<string>): MonthlySummaryData {
  let totalNormalHours = 0, totalK = 0, totalU = 0, totalUU = 0, totalF = 0;
  let workedDays = 0, absenceDays = 0, totalBreakMinutes = 0, totalDecimalHours = 0;
  let nightHours = 0, sundayHours = 0, holidayHours = 0;

  entries.forEach(entry => {
    totalDecimalHours += entry.durationDecimal;
    totalBreakMinutes += (entry.pauseMinutes || 0);
    if (entry.durationMinutes > 0) {
      workedDays++;
      totalNormalHours += entry.durationDecimal;

      // ── Special hours calculation ──
      if (entry.startTime && entry.endTime) {
        const startParts = entry.startTime.split(':').map(Number);
        const endParts = entry.endTime.split(':').map(Number);
        const startMin = startParts[0] * 60 + startParts[1];
        const endMin = endParts[0] * 60 + endParts[1];
        const grossMin = endMin > startMin ? endMin - startMin : 0;
        const netMin = entry.durationMinutes;
        // Ratio of net to gross (to proportionally subtract pause from special hours)
        const netRatio = grossMin > 0 ? netMin / grossMin : 0;

        // Night hours: minutes worked >= 20:00 (1200 min from midnight)
        const NIGHT_START = 20 * 60; // 1200
        if (endMin > NIGHT_START && startMin < endMin) {
          const nightStart = Math.max(startMin, NIGHT_START);
          const nightGrossMin = endMin - nightStart;
          const nightNetMin = nightGrossMin * netRatio;
          nightHours += nightNetMin / 60;
        }

        // Sunday hours
        const dateObj = new Date(entry.date);
        if (dateObj.getDay() === 0) {
          sundayHours += entry.durationDecimal;
        }

        // Holiday hours
        if (holidays && holidays.has(entry.date)) {
          holidayHours += entry.durationDecimal;
        }
      }
    }
    if (entry.absenceCode === 'K') totalK++;
    if (entry.absenceCode === 'U') totalU++;
    if (entry.absenceCode === 'UU') totalUU++;
    if (entry.absenceCode === 'F') totalF++;
    if (['K', 'U', 'UU', 'F'].includes(entry.absenceCode)) absenceDays++;
  });

  return {
    totalNormalHours, totalK, totalU, totalUU, totalF,
    calendarDays: entries.length, workedDays, absenceDays, totalBreakMinutes, totalDecimalHours,
    nightHours: +nightHours.toFixed(2),
    sundayHours: +sundayHours.toFixed(2),
    holidayHours: +holidayHours.toFixed(2),
  };
}

export interface EmployeeAccuracy {
  employeeId: string;
  name: string;
  weeklyHours: number;
  targetHours: number;
  actualHours: number;
  difference: number;
  accuracy: number; // 0-100+
  workedDays: number;
  sickDays: number;
  vacationDays: number;
  nightHours: number;
  sundayHours: number;
  holidayHours: number;
}

export function calculateEmployeeAccuracy(emp: Employee, allEntries: DailyEntry[], holidays?: Set<string>): EmployeeAccuracy {
  const empEntries = allEntries.filter(e => e.employeeId === emp.id);
  const processed = processEntries(empEntries);
  const summary = calculateSummary(processed, holidays);
  const targetHours = emp.weeklyHours * 4.33;
  const accuracy = targetHours > 0 ? Math.round((summary.totalNormalHours / targetHours) * 100) : 0;
  return {
    employeeId: emp.id,
    name: emp.name,
    weeklyHours: emp.weeklyHours,
    targetHours: +targetHours.toFixed(2),
    actualHours: +summary.totalNormalHours.toFixed(2),
    difference: +(summary.totalNormalHours - targetHours).toFixed(2),
    accuracy: Math.min(accuracy, 200), // cap at 200% for display
    workedDays: summary.workedDays,
    sickDays: summary.totalK,
    vacationDays: summary.totalU,
    nightHours: summary.nightHours,
    sundayHours: summary.sundayHours,
    holidayHours: summary.holidayHours,
  };
}

export function calculateAllEmployeesAccuracy(employees: Employee[], allEntries: DailyEntry[], holidays?: Set<string>): EmployeeAccuracy[] {
  return employees.map(emp => calculateEmployeeAccuracy(emp, allEntries, holidays));
}

export function exportToExcel(masterData: MasterData, allEntries: DailyEntry[], employees: Employee[], t: TranslateFn, language: Language = 'vi') {
  const dateLocale = language === 'de' ? de : vi;
  const wb = XLSX.utils.book_new();
  const monthYearStr = `${masterData.month.toString().padStart(2, '0')}/${masterData.year}`;

  employees.forEach(employee => {
    const employeeEntries = allEntries.filter(e => e.employeeId === employee.id);
    const processed = processEntries(employeeEntries);
    const summary = calculateSummary(processed);

    const wsData: any[][] = [
      [`${t('excel.documentation')} - ${employee.name}`],
      [],
      [t('excel.company'), masterData.companyName],
      [t('excel.employeeName'), employee.name],
      [t('excel.personnelNr'), employee.personnelNumber, '', t('excel.monthYear'), monthYearStr],
      [t('excel.weeklyHours'), `${employee.weeklyHours} h`],
      [],
      [t('excel.calendarDay'), t('excel.start'), t('excel.break'), t('excel.end'), t('excel.duration'), t('excel.status'), t('excel.remarks')]
    ];

    processed.forEach(entry => {
      const dateStr = format(new Date(entry.date), 'EE, dd.MM.yy', { locale: dateLocale });
      wsData.push([
        dateStr, entry.startTime,
        entry.pauseMinutes ? `:${entry.pauseMinutes.toString().padStart(2, '0')}` : '',
        entry.endTime, entry.durationTime, entry.absenceCode, entry.remark
      ]);
    });

    wsData.push([]);
    wsData.push(['', '', '', t('excel.totalActual'), formatMinutesToTime(summary.totalDecimalHours * 60)]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{wch: 12}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 15}, {wch: 5}, {wch: 30}];
    XLSX.utils.book_append_sheet(wb, ws, employee.name.substring(0, 31));
  });

  const safeCompany = masterData.companyName.replace(/[^a-z0-9]/gi, '_') || 'Restaurant';
  const filename = `Arbeitszeit_${safeCompany}_${masterData.year}-${masterData.month.toString().padStart(2, '0')}.xlsx`;

  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  } catch (err) {
    console.error('Excel export error:', err);
    XLSX.writeFile(wb, filename);
  }
}

export function generateSmartSchedule(
  month: number, year: number, employees: Employee[], config: RestaurantConfig, t: TranslateFn
): DailyEntry[] {
  const dates = generateMonthDates(month, year);

  // ── Helpers ──
  const getISOWeek = (dateStr: string): number =>
    getWeek(new Date(dateStr), { weekStartsOn: 1 });
  const roundTo15 = (d: Date): Date =>
    new Date(Math.round(d.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000));
  const toHHMM = (d: Date): string => format(d, 'HH:mm');

  // ── Effective headcount from config (with sane defaults) ──
  const baseN = config.baselineHeadcount ?? config.minStaff;
  const lunchPeak = config.lunchPeakHeadcount ?? (config.minStaff + 2);
  const dinnerPeak = config.dinnerPeakHeadcount ?? (config.minStaff + 2);
  const busyDays = new Set(config.busyDays || []);
  // On busy days, use peak headcount as baseline; on normal days, use baseN
  const getNForDay = (dow: number) => busyDays.has(dow) ? Math.max(lunchPeak, dinnerPeak, baseN) : baseN;
  const N = baseN; // default for pre-calculations

  // ── Filter active employees only (respect endDate) ──
  const activeEmployees = employees.filter(e => e.isActive !== false);

  // Helper: check if employee is available on a given date (endDate check)
  const isEmpAvailableOnDate = (emp: Employee, dateStr: string): boolean => {
    if (!emp.endDate) return true;
    return dateStr <= emp.endDate; // available up to and including endDate
  };

  // ── Day metadata ──
  const dayMeta = dates.map((d, i) => {
    const date = new Date(d);
    const dow = date.getDay();
    const dayOC = getDayOpenClose(config, dow);
    const isRestaurantClosed = dayOC.closed;
    const openTimeDate = roundTo15(parse(dayOC.openTime, 'HH:mm', new Date()));
    const closeTimeDate = roundTo15(parse(dayOC.closeTime, 'HH:mm', new Date()));
    const week = getISOWeek(d);
    return { d, i, dow, isRestaurantClosed, openTimeDate, closeTimeDate, week };
  });

  // ── Feiertage: German public holidays ──
  const holidays = getGermanHolidays(year, config.bundesland);

  // ── RULE 5: Vacation 2 days/month per employee (mid-month weekdays) ──
  const vacationDays: Record<string, Set<number>> = {};
  const weekdayCandidates = dayMeta
    .filter(x => !x.isRestaurantClosed && x.dow >= 1 && x.dow <= 4)
    .map(x => x.i);

  activeEmployees.forEach((emp, empIdx) => {
    vacationDays[emp.id] = new Set();
    const pool1 = weekdayCandidates.filter(i => new Date(dates[i]).getDate() >= 8 && new Date(dates[i]).getDate() <= 15);
    const pool2 = weekdayCandidates.filter(i => new Date(dates[i]).getDate() >= 16 && new Date(dates[i]).getDate() <= 23);
    if (pool1.length > 0) vacationDays[emp.id].add(pool1[empIdx % pool1.length]);
    if (pool2.length > 0) vacationDays[emp.id].add(pool2[(empIdx + 2) % pool2.length]);
  });

  // ── Tracking ──
  const minutesAssigned: Record<string, number> = {};
  const weekDayCount: Record<string, Record<number, number>> = {};
  activeEmployees.forEach(emp => { minutesAssigned[emp.id] = 0; weekDayCount[emp.id] = {}; });

  // ── PRE-CALCULATE: How many work days each employee has available ──
  const empWorkDays: Record<string, number> = {};
  activeEmployees.forEach(emp => {
    let count = 0;
    dates.forEach((dateStr, dayIndex) => {
      const meta = dayMeta[dayIndex];
      if (meta.isRestaurantClosed) return;
      if (vacationDays[emp.id].has(dayIndex)) return;
      // endDate: skip days after employee's last working day
      if (!isEmpAvailableOnDate(emp, dateStr)) return;
      // count available days (up to 5 per week will be enforced later)
      count++;
    });
    // Cap at approx 5 days/week × number of weeks
    const uniqueWeeks = new Set(dates.map((_, i) => dayMeta[i].week)).size;
    empWorkDays[emp.id] = Math.min(count, uniqueWeeks * 5);
  });

  // ── PRE-CALCULATE: Target minutes per work day for even distribution ──
  const empDailyTarget: Record<string, number> = {};
  activeEmployees.forEach(emp => {
    const monthlyTargetMinutes = emp.weeklyHours * 4.33 * 60;
    const workDays = empWorkDays[emp.id] || 20;
    // Even split: total monthly target / available work days
    empDailyTarget[emp.id] = Math.round(monthlyTargetMinutes / workDays);
  });

  // ── PRE-CALCULATE: Consistent daily headcount ──
  // Total employee-days across the month ÷ total open days = avg headcount
  const totalOpenDays = dayMeta.filter(m => !m.isRestaurantClosed).length;
  const totalEmployeeDays = Object.values(empWorkDays).reduce((a, b) => a + b, 0);
  const avgDailyHeadcount = totalOpenDays > 0 ? Math.round(totalEmployeeDays / totalOpenDays) : activeEmployees.length;
  // Busy days get a boost (at least avgDailyHeadcount + 2, or dayN)
  const busyDayHeadcount = Math.min(activeEmployees.length, Math.max(avgDailyHeadcount + 2, Math.max(lunchPeak, dinnerPeak)));
  const normalDayHeadcount = Math.max(baseN, avgDailyHeadcount);

  const allEntries: DailyEntry[] = [];

  // ── DAY-BY-DAY SCHEDULING ──
  dates.forEach((dateStr, dayIndex) => {
    const meta = dayMeta[dayIndex];
    const dayEntries: Record<string, DailyEntry> = {};

    // Initialize entries for all employees
    employees.forEach(emp => {
      const isVacation = vacationDays[emp.id]?.has(dayIndex);
      const isHoliday = holidays.has(dateStr);
      dayEntries[emp.id] = {
        employeeId: emp.id, date: dateStr, startTime: '', pauseMinutes: 0, endTime: '',
        absenceCode: isVacation ? 'U' : '',
        remark: isHoliday ? t('remark.holiday') : isVacation ? t('remark.vacation') : meta.isRestaurantClosed ? t('remark.closedDay') : '',
      };
    });

    if (meta.isRestaurantClosed) {
      Object.values(dayEntries).forEach(e => allEntries.push(e));
      return;
    }

    const { openTimeDate, closeTimeDate, week } = meta;

    // Target headcount for this day: consistent across the month
    const isBusyDay = busyDays.has(meta.dow);
    const targetHeadcount = isBusyDay ? busyDayHeadcount : normalDayHeadcount;

    // ── Step 1: Select employees with standard 5-day/week limit ──
    let allAvailable = activeEmployees.filter(emp => {
      if (vacationDays[emp.id].has(dayIndex)) return false;
      if (!isEmpAvailableOnDate(emp, dateStr)) return false;  // endDate check
      if ((weekDayCount[emp.id][week] || 0) >= 5) return false;
      return true;
    });

    // ── Step 2: If not enough, relax to 6 days/week ──
    if (allAvailable.length < targetHeadcount) {
      allAvailable = activeEmployees.filter(emp => {
        if (vacationDays[emp.id].has(dayIndex)) return false;
        if (!isEmpAvailableOnDate(emp, dateStr)) return false;  // endDate check
        if ((weekDayCount[emp.id][week] || 0) >= 6) return false;
        return true;
      });
    }

    // Rank by RELATIVE debt (% remaining) — those who need hours most get priority
    const ranked = allAvailable
      .map(emp => {
        const target = emp.weeklyHours * 4.33 * 60;
        const pctRemaining = target > 0 ? (target - minutesAssigned[emp.id]) / target : 0;
        return { emp, pctRemaining, debt: target - minutesAssigned[emp.id] };
      })
      .sort((a, b) => b.pctRemaining - a.pctRemaining);

    // ── SELECT: Pick top targetHeadcount employees (consistent daily count) ──
    const selected = ranked.slice(0, Math.max(baseN, targetHeadcount));

    // ── Assign shifts to selected employees ──
    selected.forEach(({ emp }, idx) => {
      const entry = dayEntries[emp.id];

      // Use pre-calculated EVEN daily target
      const targetNetMinutes = Math.max(MIN_AUTO_SHIFT_MINUTES, Math.min(600, empDailyTarget[emp.id]));

      // Stagger start times
      const staggerMinutes = (idx % 8) * 15;
      let startDate = roundTo15(new Date(openTimeDate.getTime() + staggerMinutes * 60000));

      // Configurable peak hours
      const lunchStart = config.lunchPeakStart || '12:00';
      const dinnerStart = config.dinnerPeakStart || '18:00';

      // For short shifts (< 4h), alternate between lunch peak and dinner peak
      if (targetNetMinutes < 240 && idx % 2 === 1) {
        const peakTime = parse(dinnerStart, 'HH:mm', new Date());
        const candidate = roundTo15(new Date(peakTime.getTime() + staggerMinutes * 60000));
        const clampedCandidate = isAfter(openTimeDate, candidate) ? openTimeDate : candidate;
        if (!isAfter(clampedCandidate, closeTimeDate)) {
          startDate = clampedCandidate;
        }
      } else if (targetNetMinutes < 240 && idx % 2 === 0) {
        // Start at lunch peak
        const peakTime = parse(lunchStart, 'HH:mm', new Date());
        const candidate = roundTo15(new Date(peakTime.getTime() + staggerMinutes * 60000));
        const clampedCandidate = isAfter(openTimeDate, candidate) ? openTimeDate : candidate;
        if (!isAfter(clampedCandidate, closeTimeDate)) {
          startDate = clampedCandidate;
        }
      }

      // Pause only for shifts > 6h
      const estimatedPause = targetNetMinutes > 480 ? 45 : targetNetMinutes > 330 ? 30 : 0;
      const grossMinutes = Math.min(targetNetMinutes + estimatedPause, 10 * 60);
      let endDate = roundTo15(new Date(startDate.getTime() + grossMinutes * 60000));

      if (isAfter(endDate, closeTimeDate)) {
        endDate = closeTimeDate;
      }

      const actualGross = differenceInMinutes(endDate, startDate);

      if (actualGross < MIN_AUTO_SHIFT_MINUTES) {
        // Too short — skip
      } else {
        const pause = actualGross > 510 ? 45 : actualGross > 360 ? 30 : 0;

        entry.startTime = toHHMM(startDate);
        entry.endTime = toHHMM(endDate);
        entry.pauseMinutes = pause;

        const netWorked = actualGross - pause;
        minutesAssigned[emp.id] += Math.max(0, netWorked);

        weekDayCount[emp.id][week] = (weekDayCount[emp.id][week] || 0) + 1;
      }
    });

    // ── RULE 12: Ensure at least 1 employee works until closing time ──
    const closeTimeStr = toHHMM(closeTimeDate);
    const assignedEntries = Object.values(dayEntries).filter(e =>
      e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode)
    );
    const hasClosingStaff = assignedEntries.some(e => e.endTime === closeTimeStr);

    if (!hasClosingStaff && assignedEntries.length > 0) {
      // Find the employee whose endTime is closest to closeTime → extend them
      const closeTimeMin = closeTimeDate.getHours() * 60 + closeTimeDate.getMinutes();
      let bestEntry: DailyEntry | null = null;
      let bestEndMin = 0;

      assignedEntries.forEach(e => {
        const [eh, em] = e.endTime.split(':').map(Number);
        const endMin = eh * 60 + em;
        if (endMin > bestEndMin) {
          bestEndMin = endMin;
          bestEntry = e;
        }
      });

      if (bestEntry) {
        const entry = bestEntry as DailyEntry;
        const [sh, sm] = entry.startTime.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const newGross = closeTimeMin - startMin;
        // Only extend if within 10h gross limit
        if (newGross <= 10 * 60 + 45) {
          entry.endTime = closeTimeStr;
          entry.pauseMinutes = newGross > 510 ? 45 : newGross > 360 ? 30 : entry.pauseMinutes;
          // Update tracked minutes
          const emp = activeEmployees.find(e => e.id === entry.employeeId);
          if (emp) {
            const oldNet = bestEndMin - startMin - entry.pauseMinutes;
            const newNet = newGross - entry.pauseMinutes;
            minutesAssigned[emp.id] += Math.max(0, newNet - oldNet);
          }
        }
      }
    }

    Object.values(dayEntries).forEach(entry => allEntries.push(entry));
  });

  return allEntries;
}

// ─────────────────────────────────────────────────────────────
// Schedule Analysis: detect staffing problems after generation
// ─────────────────────────────────────────────────────────────

export type ScheduleAlertSeverity = 'error' | 'warning';

export interface ScheduleAlert {
  date: string;           // yyyy-MM-dd
  dateLabel: string;      // e.g. "So., 09.02."
  severity: ScheduleAlertSeverity;
  type: 'understaffed' | 'gap' | 'empty' | 'outside_hours' | 'short_shift';
  message: string;
}

export function analyzeScheduleWarnings(
  entries: DailyEntry[],
  employees: Employee[],
  config: RestaurantConfig,
  t: TranslateFn,
  language: 'vi' | 'de' = 'vi'
): ScheduleAlert[] {
  const alerts: ScheduleAlert[] = [];
  const dateLocale = language === 'de' ? de : vi;

  // Group entries by date
  const byDate: Record<string, DailyEntry[]> = {};
  entries.forEach(entry => {
    if (!byDate[entry.date]) byDate[entry.date] = [];
    byDate[entry.date].push(entry);
  });

  Object.keys(byDate).sort().forEach(dateStr => {
    const dayEntries = byDate[dateStr];
    const dateObj = new Date(dateStr);
    const dateLabel = format(dateObj, 'EE., dd.MM.', { locale: dateLocale });

    // Skip restaurant closed days (Ruhetag) – no alerts needed
    const dow = dateObj.getDay();
    if (isDayClosed(config, dow)) return;

    // Per-day open/close times
    const dayOC = getDayOpenClose(config, dow);
    const openTime = parse(dayOC.openTime, 'HH:mm', new Date());
    const closeTime = parse(dayOC.closeTime, 'HH:mm', new Date());
    const openMinutes = openTime.getHours() * 60 + openTime.getMinutes();
    const closeMinutes = closeTime.getHours() * 60 + closeTime.getMinutes();

    // Active workers: have start and end time, no full-day absence
    const activeWorkers = dayEntries.filter(e =>
      e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode)
    );

    // ── Check 1: Zero staff (restaurant completely unstaffed)
    if (activeWorkers.length === 0) {
      alerts.push({
        date: dateStr,
        dateLabel,
        severity: 'error',
        type: 'empty',
        message: language === 'de'
          ? `Kein Mitarbeiter eingeplant – Restaurant kann nicht öffnen!`
          : `Không có nhân viên nào – Nhà hàng không thể mở cửa!`
      });
      return; // no need to check further for this day
    }

    // ── Check 2: Shifts outside the configured opening hours
    const startsBeforeOpen = activeWorkers.some(entry => {
      const start = parse(entry.startTime, 'HH:mm', new Date());
      return start.getHours() * 60 + start.getMinutes() < openMinutes;
    });
    if (startsBeforeOpen) {
      alerts.push({
        date: dateStr,
        dateLabel,
        severity: 'error',
        type: 'outside_hours',
        message: language === 'de'
          ? `Mindestens eine Schicht beginnt vor der Öffnungszeit (${dayOC.openTime})`
          : `Có ca bắt đầu trước giờ mở cửa (${dayOC.openTime})`,
      });
    }

    const endsAfterClose = activeWorkers.some(entry => {
      const end = parse(entry.endTime, 'HH:mm', new Date());
      return end.getHours() * 60 + end.getMinutes() > closeMinutes;
    });
    if (endsAfterClose) {
      alerts.push({
        date: dateStr,
        dateLabel,
        severity: 'error',
        type: 'outside_hours',
        message: language === 'de'
          ? `Mindestens eine Schicht endet nach der Schließzeit (${dayOC.closeTime})`
          : `Có ca kết thúc sau giờ đóng cửa (${dayOC.closeTime})`,
      });
    }

    // ── Check 3: Shifts shorter than the automatic minimum
    const shortShiftCount = activeWorkers.filter(entry => {
      const gross = calculateGrossShiftMinutes(entry.startTime, entry.endTime);
      return gross > 0 && gross < MIN_AUTO_SHIFT_MINUTES;
    }).length;
    if (shortShiftCount > 0) {
      alerts.push({
        date: dateStr,
        dateLabel,
        severity: 'warning',
        type: 'short_shift',
        message: language === 'de'
          ? `${shortShiftCount} Schicht${shortShiftCount !== 1 ? 'en' : ''} kürzer als 2 Stunden`
          : `${shortShiftCount} ca làm dưới 2 giờ`,
      });
    }

    // ── Check 4: Understaffed (below minStaff)
    if (activeWorkers.length < config.minStaff) {
      alerts.push({
        date: dateStr,
        dateLabel,
        severity: 'error',
        type: 'understaffed',
        message: language === 'de'
          ? `Zu wenig Personal: ${activeWorkers.length} von ${config.minStaff} Mindest-Mitarbeitern eingeplant`
          : `Thiếu nhân sự: ${activeWorkers.length}/${config.minStaff} người tối thiểu`
      });
    }

    // ── Check 5: Coverage gaps – only during PEAK HOURS (configurable)
    const lps = config.lunchPeakStart || '12:00', lpe = config.lunchPeakEnd || '15:00';
    const dps = config.dinnerPeakStart || '18:00', dpe = config.dinnerPeakEnd || '21:00';
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const PEAK_WINDOWS = [
      { start: toMin(lps), end: toMin(lpe) },
      { start: toMin(dps), end: toMin(dpe) },
    ];

    if (closeMinutes <= openMinutes) return;

    // Build covered intervals from all active workers
    const intervals: { start: number; end: number }[] = [];
    activeWorkers.forEach(entry => {
      const s = parse(entry.startTime, 'HH:mm', new Date());
      const e = parse(entry.endTime, 'HH:mm', new Date());
      const startMin = s.getHours() * 60 + s.getMinutes();
      const endMin   = e.getHours() * 60 + e.getMinutes();
      if (startMin < endMin) intervals.push({ start: startMin, end: endMin });
    });
    intervals.sort((a, b) => a.start - b.start);

    // Helper: find uncovered (gap) sub-intervals within [rangeStart, rangeEnd]
    function findGapsInRange(rangeStart: number, rangeEnd: number): { from: number; to: number }[] {
      const gaps: { from: number; to: number }[] = [];
      let cursor = rangeStart;
      for (const iv of intervals) {
        if (iv.end <= cursor) continue;         // already past this
        if (iv.start > cursor) {
          // gap from cursor → iv.start (clamped to range)
          const gFrom = cursor;
          const gTo   = Math.min(iv.start, rangeEnd);
          if (gTo - gFrom >= 30) gaps.push({ from: gFrom, to: gTo });
        }
        cursor = Math.max(cursor, iv.end);
        if (cursor >= rangeEnd) break;
      }
      // tail gap after last interval
      if (cursor < rangeEnd - 30) gaps.push({ from: cursor, to: rangeEnd });
      return gaps;
    }

    const toHHMM = (min: number) =>
      `${Math.floor(min / 60).toString().padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}`;

    // Check each peak window that overlaps with today's opening hours
    PEAK_WINDOWS.forEach(pw => {
      const winStart = Math.max(pw.start, openMinutes);
      const winEnd   = Math.min(pw.end, closeMinutes);
      if (winEnd - winStart < 30) return;

      const gaps = findGapsInRange(winStart, winEnd);
      gaps.forEach(gap => {
        alerts.push({
          date: dateStr,
          dateLabel,
          severity: 'warning',
          type: 'gap',
          message: language === 'de'
            ? `Personallücke ${toHHMM(gap.from)}–${toHHMM(gap.to)} Uhr (Stoßzeit – kein Mitarbeiter!)`
            : `Thiếu người ${toHHMM(gap.from)}–${toHHMM(gap.to)} (giờ cao điểm – không có nhân viên!)`,
        });
      });
    });

    // ── Check 6: No employee working until closing time
    const dayCloseTimeStr = format(closeTime, 'HH:mm');
    const hasClosingStaff = activeWorkers.some(e => e.endTime === dayCloseTimeStr);
    if (!hasClosingStaff && activeWorkers.length > 0) {
      alerts.push({
        date: dateStr,
        dateLabel,
        severity: 'warning',
        type: 'gap',
        message: language === 'de'
          ? `Kein Mitarbeiter bis Schließzeit (${dayCloseTimeStr}) eingeplant`
          : `Không có NV làm đến giờ đóng cửa (${dayCloseTimeStr})`,
      });
    }
  });

  return alerts;
}

// ─────────────────────────────────────────────────────────────
// Schedule Optimizer: fix coverage gaps + balance hours to 95-98% accuracy
// ─────────────────────────────────────────────────────────────

export function optimizeSchedule(
  entries: DailyEntry[],
  employees: Employee[],
  config: RestaurantConfig,
  t: TranslateFn,
  language: 'vi' | 'de' = 'vi'
): DailyEntry[] {
  const optimized = entries.map(e => ({ ...e }));

  const byDate: Record<string, DailyEntry[]> = {};
  optimized.forEach(entry => {
    if (!byDate[entry.date]) byDate[entry.date] = [];
    byDate[entry.date].push(entry);
  });

  const toHHMM = (min: number) =>
    `${Math.floor(min / 60).toString().padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}`;

  const getMonthlyMinutes = (empId: string): number => {
    return optimized
      .filter(e => e.employeeId === empId && e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode))
      .reduce((sum, e) => {
        const s = parse(e.startTime, 'HH:mm', new Date());
        const en = parse(e.endTime, 'HH:mm', new Date());
        return sum + Math.max(0, differenceInMinutes(en, s) - (e.pauseMinutes || 0));
      }, 0);
  };

  const getShiftInfo = (e: DailyEntry) => {
    const s = parse(e.startTime, 'HH:mm', new Date());
    const en = parse(e.endTime, 'HH:mm', new Date());
    const sMin = s.getHours() * 60 + s.getMinutes();
    const eMin = en.getHours() * 60 + en.getMinutes();
    const gross = differenceInMinutes(en, s);
    const net = gross - (e.pauseMinutes || 0);
    return { sMin, eMin, gross, net };
  };

  const getDayLimits = (dateStr: string) => {
    const dow = new Date(dateStr).getDay();
    const oc = getDayOpenClose(config, dow);
    const dOpen = parse(oc.openTime, 'HH:mm', new Date());
    const dClose = parse(oc.closeTime, 'HH:mm', new Date());
    return {
      openMin: dOpen.getHours() * 60 + dOpen.getMinutes(),
      closeMin: dClose.getHours() * 60 + dClose.getMinutes(),
      closed: oc.closed,
    };
  };

  // ── PHASE 1–3: Fix coverage gaps, understaffing (keep existing logic) ──

  Object.keys(byDate).sort().forEach(dateStr => {
    const dateObj = new Date(dateStr);
    const dow = dateObj.getDay();
    if (isDayClosed(config, dow)) return;

    const { openMin, closeMin } = getDayLimits(dateStr);

    const PEAK_WINDOWS = [
      { start: Math.max(11 * 60 + 30, openMin), end: Math.min(15 * 60, closeMin) },
      { start: Math.max(17 * 60, openMin), end: Math.min(21 * 60 + 30, closeMin) },
    ].filter(w => w.end - w.start >= 30);

    const dayEntries = byDate[dateStr];
    const activeEntries = dayEntries.filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode));
    const activeIds = new Set(activeEntries.map(e => e.employeeId));
    const idleEntries = dayEntries.filter(e => !activeIds.has(e.employeeId) && !['K', 'U', 'UU', 'F'].includes(e.absenceCode));

    const getIntervals = () => dayEntries
      .filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode))
      .map(entry => {
        const s = parse(entry.startTime, 'HH:mm', new Date());
        const e = parse(entry.endTime, 'HH:mm', new Date());
        return { start: s.getHours() * 60 + s.getMinutes(), end: e.getHours() * 60 + e.getMinutes() };
      }).filter(iv => iv.start < iv.end).sort((a, b) => a.start - b.start);

    const findGaps = (rangeStart: number, rangeEnd: number) => {
      const intervals = getIntervals();
      const gaps: { from: number; to: number }[] = [];
      let cursor = rangeStart;
      for (const iv of intervals) {
        if (iv.end <= cursor) continue;
        if (iv.start > cursor) {
          const gTo = Math.min(iv.start, rangeEnd);
          if (gTo - cursor >= 30) gaps.push({ from: cursor, to: gTo });
        }
        cursor = Math.max(cursor, iv.end);
        if (cursor >= rangeEnd) break;
      }
      if (cursor < rangeEnd - 30) gaps.push({ from: cursor, to: rangeEnd });
      return gaps;
    };

    // FIX 1: Zero staff
    if (activeEntries.length === 0 && idleEntries.length > 0) {
      const sorted = idleEntries
        .map(e => {
          const emp = employees.find(em => em.id === e.employeeId);
          if (!emp) return { entry: e, debt: 0 };
          return { entry: e, debt: emp.weeklyHours * 4.33 * 60 - getMonthlyMinutes(emp.id) };
        })
        .sort((a, b) => b.debt - a.debt);
      sorted.slice(0, Math.max(config.minStaff, 1)).forEach(({ entry }, idx) => {
        const stagger = idx * 30;
        const startMinutes = openMin + stagger;
        const shiftLength = Math.min(8 * 60 + 30, closeMin - startMinutes);
        if (shiftLength < MIN_AUTO_SHIFT_MINUTES) return;
        entry.startTime = toHHMM(startMinutes);
        entry.endTime = toHHMM(Math.min(startMinutes + shiftLength, closeMin));
        entry.pauseMinutes = shiftLength > 510 ? 45 : shiftLength > 360 ? 30 : 0;
        entry.absenceCode = '';
        entry.remark = '';
      });
    }

    // FIX 2: Coverage gaps in peak hours
    PEAK_WINDOWS.forEach(pw => {
      let gaps = findGaps(pw.start, pw.end);
      if (gaps.length === 0) return;
      // Strategy A: Extend existing shifts
      gaps.forEach(gap => {
        const currentActive = dayEntries.filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode));
        let fixed = false;
        for (const entry of currentActive) {
          const eEnd = parse(entry.endTime, 'HH:mm', new Date());
          const endMin = eEnd.getHours() * 60 + eEnd.getMinutes();
          if (endMin >= gap.from - 60 && endMin <= gap.from + 15) {
            const newEndMin = Math.min(gap.to, closeMin);
            const eStart = parse(entry.startTime, 'HH:mm', new Date());
            const startMin = eStart.getHours() * 60 + eStart.getMinutes();
            if (newEndMin - startMin <= 10 * 60 + 45) {
              entry.endTime = toHHMM(newEndMin);
              const newNet = (newEndMin - startMin) - entry.pauseMinutes;
              if (newNet > 480 && entry.pauseMinutes < 45) entry.pauseMinutes = 45;
              fixed = true; break;
            }
          }
        }
        if (fixed) return;
        for (const entry of currentActive) {
          const eStart = parse(entry.startTime, 'HH:mm', new Date());
          const startMin = eStart.getHours() * 60 + eStart.getMinutes();
          if (startMin >= gap.to - 15 && startMin <= gap.to + 60) {
            const newStartMin = Math.max(gap.from, openMin);
            const eEnd = parse(entry.endTime, 'HH:mm', new Date());
            const endMin = eEnd.getHours() * 60 + eEnd.getMinutes();
            if (endMin - newStartMin <= 10 * 60 + 45) {
              entry.startTime = toHHMM(newStartMin);
              const newNet = (endMin - newStartMin) - entry.pauseMinutes;
              if (newNet > 480 && entry.pauseMinutes < 45) entry.pauseMinutes = 45;
              fixed = true; break;
            }
          }
        }
      });
      // Strategy B: Assign idle employees
      gaps = findGaps(pw.start, pw.end);
      if (gaps.length === 0) return;
      const currentIdle = dayEntries.filter(e => {
        const isActive = e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode);
        return !isActive && !['K', 'U', 'UU', 'F'].includes(e.absenceCode);
      });
      gaps.forEach(gap => {
        if (currentIdle.length === 0) return;
        const sorted = currentIdle.map((e, i) => {
          const emp = employees.find(em => em.id === e.employeeId);
          if (!emp) return { entry: e, debt: 0, idx: i };
          return { entry: e, debt: emp.weeklyHours * 4.33 * 60 - getMonthlyMinutes(emp.id), idx: i };
        }).sort((a, b) => b.debt - a.debt);
        const best = sorted[0];
        if (!best || best.debt <= 0) return;
        const shiftStart = Math.max(gap.from - 30, openMin);
        const shiftEnd = Math.min(gap.to + 30, closeMin);
        const gross = shiftEnd - shiftStart;
        if (gross >= MIN_AUTO_SHIFT_MINUTES) {
          best.entry.startTime = toHHMM(shiftStart);
          best.entry.endTime = toHHMM(shiftEnd);
          best.entry.pauseMinutes = gross > 510 ? 45 : gross > 360 ? 30 : 0;
          best.entry.absenceCode = '';
          best.entry.remark = '';
          if (best.idx >= 0) currentIdle.splice(best.idx, 1);
        }
      });
    });

    // FIX 3: Below minStaff
    const curActiveCount = dayEntries.filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode)).length;
    if (curActiveCount < config.minStaff) {
      const deficit = config.minStaff - curActiveCount;
      const remainIdle = dayEntries.filter(e => {
        const isActive = e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode);
        return !isActive && !['K', 'U', 'UU', 'F'].includes(e.absenceCode);
      });
      remainIdle
        .map(e => {
          const emp = employees.find(em => em.id === e.employeeId);
          if (!emp) return { entry: e, debt: 0 };
          return { entry: e, debt: emp.weeklyHours * 4.33 * 60 - getMonthlyMinutes(emp.id) };
        })
        .sort((a, b) => b.debt - a.debt)
        .slice(0, deficit)
        .forEach(({ entry }) => {
          const shiftLen = Math.min(8 * 60 + 30, closeMin - openMin);
          if (shiftLen < MIN_AUTO_SHIFT_MINUTES) return;
          entry.startTime = toHHMM(openMin);
          entry.endTime = toHHMM(Math.min(openMin + shiftLen, closeMin));
          entry.pauseMinutes = shiftLen > 510 ? 45 : shiftLen > 360 ? 30 : 0;
          entry.absenceCode = '';
          entry.remark = '';
        });
    }

    // FIX 4: Ensure at least 1 employee works until closing time
    const curActive = dayEntries.filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode));
    const hasCloser = curActive.some(e => {
      const [eh, em] = e.endTime.split(':').map(Number);
      return eh * 60 + em >= closeMin;
    });
    if (!hasCloser && curActive.length > 0) {
      // Find entry with latest endTime and extend to closeMin
      let best: DailyEntry | null = null;
      let bestEnd = 0;
      curActive.forEach(e => {
        const [eh, em] = e.endTime.split(':').map(Number);
        const endM = eh * 60 + em;
        if (endM > bestEnd) { bestEnd = endM; best = e; }
      });
      if (best) {
        const entry = best as DailyEntry;
        const [sh, sm] = entry.startTime.split(':').map(Number);
        const sMin = sh * 60 + sm;
        const newGross = closeMin - sMin;
        if (newGross <= 10 * 60 + 45) {
          entry.endTime = toHHMM(closeMin);
          entry.pauseMinutes = newGross > 510 ? 45 : newGross > 360 ? 30 : entry.pauseMinutes;
        }
      }
    }
  });

  // ── PHASE 4: HOURS BALANCING — converge to 95-98% accuracy ──
  // Tolerance per employee: 2% of monthly target (e.g. 48h/week → ±25 min; 5h/week → ±3 min)
  // Up to 20 passes for convergence.
  // Break rules: ≤8h30 gross → 30min pause; >8h30 gross → 45min pause
  // Minimum shift: 2h (120 min) gross

  const MAX_PASSES = 20;

  // Helper: recalculate pause for a given gross duration
  const correctPause = (gross: number) => gross > 510 ? 45 : gross > 360 ? 30 : 0;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;

    // Calculate deviations for all employees
    const devs = employees.map(emp => {
      const target = emp.weeklyHours * 4.33 * 60;
      const actual = getMonthlyMinutes(emp.id);
      const delta = actual - target; // positive = over, negative = under
      // Tolerance: 2% of target, minimum 15 min
      const tolerance = Math.max(15, Math.round(target * 0.02));
      const pct = target > 0 ? (actual / target) * 100 : 100;
      return { emp, delta, target, actual, tolerance, pct };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    // Check if all employees are within tolerance (95-98% range)
    const allConverged = devs.every(d => Math.abs(d.delta) <= d.tolerance);
    if (allConverged) break;

    for (const { emp, delta, tolerance } of devs) {
      if (Math.abs(delta) <= tolerance) continue;

      const empEntries = optimized.filter(e => e.employeeId === emp.id);

      if (delta > tolerance) {
        // ═══════════════════════════════════════════
        // OVER target → reduce hours
        // ═══════════════════════════════════════════
        let remain = delta;

        // Strategy A: Remove entire shifts (shortest first)
        const shortShifts = empEntries
          .filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode))
          .map(e => ({ entry: e, ...getShiftInfo(e) }))
          .sort((a, b) => a.net - b.net);

        for (const sh of shortShifts) {
          if (remain <= tolerance) break;
          const dayE = byDate[sh.entry.date] || [];
          const others = dayE.filter(e =>
            e.employeeId !== emp.id && e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode)
          ).length;

          if (others >= 1) {
            remain -= sh.net;
            sh.entry.startTime = '';
            sh.entry.endTime = '';
            sh.entry.pauseMinutes = 0;
            sh.entry.absenceCode = '';
            sh.entry.remark = '';
            changed = true;
          }
        }

        // Strategy B: Shorten remaining longest shifts
        if (remain > tolerance) {
          const longShifts = empEntries
            .filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode))
            .map(e => ({ entry: e, ...getShiftInfo(e) }))
            .sort((a, b) => b.net - a.net);

          for (const sh of longShifts) {
            if (remain <= tolerance) break;
            // Min 2h gross after trimming
            const minGross = MIN_AUTO_SHIFT_MINUTES;
            const maxTrimNet = sh.net - (minGross - sh.entry.pauseMinutes);
            const trim = Math.floor(Math.min(remain, Math.max(0, maxTrimNet)) / 15) * 15;
            if (trim < 15) continue;

            const dayE = byDate[sh.entry.date] || [];
            const others = dayE.filter(e =>
              e.employeeId !== emp.id && e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode)
            ).length;

            if (others >= 1) {
              const newEnd = sh.eMin - trim;
              const newGross = newEnd - sh.sMin;
              if (newGross >= minGross) {
                sh.entry.endTime = toHHMM(newEnd);
                sh.entry.pauseMinutes = correctPause(newGross);
                remain -= trim;
                changed = true;
              }
            }
          }
        }

      } else if (delta < -tolerance) {
        // ═══════════════════════════════════════════
        // UNDER target → add hours
        // ═══════════════════════════════════════════
        let remain = Math.abs(delta);

         // Strategy A: Extend existing shortest shifts first
        const shifts = empEntries
          .filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode))
          .map(e => ({ entry: e, ...getShiftInfo(e) }))
          .sort((a, b) => a.gross - b.gross);

        const maxGross = 10 * 60; // Max 10h gross
        const maxNet = 600;       // Max 10h net (German law)

        for (const sh of shifts) {
          if (remain <= tolerance) break;
          const { openMin: dOpenMin, closeMin: dCloseMin } = getDayLimits(sh.entry.date);

          // Check net limit: don't exceed 10h net
          const currentNet = sh.gross - (sh.entry.pauseMinutes || 0);
          const netRoom = maxNet - currentNet;
          if (netRoom <= 0) continue;

          // Extend at end (capped by close time, max gross, and net limit)
          const extEnd = Math.floor(Math.min(remain, dCloseMin - sh.eMin, maxGross - sh.gross, netRoom) / 15) * 15;
          if (extEnd >= 15) {
            sh.entry.endTime = toHHMM(sh.eMin + extEnd);
            sh.eMin += extEnd; sh.gross += extEnd;
            sh.entry.pauseMinutes = correctPause(sh.gross);
            remain -= extEnd;
            changed = true;
          }
          if (remain <= tolerance) break;

          // Extend at start (same caps)
          const currentNet2 = sh.gross - (sh.entry.pauseMinutes || 0);
          const netRoom2 = maxNet - currentNet2;
          const extStart = Math.floor(Math.min(remain, sh.sMin - dOpenMin, maxGross - sh.gross, netRoom2) / 15) * 15;
          if (extStart >= 15) {
            sh.entry.startTime = toHHMM(sh.sMin - extStart);
            sh.sMin -= extStart; sh.gross += extStart;
            sh.entry.pauseMinutes = correctPause(sh.gross);
            remain -= extStart;
            changed = true;
          }
        }

        // Strategy B: Convert off days to work days
        if (remain > tolerance) {
          const offDays = empEntries.filter(e =>
            !e.startTime && !e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode)
          );

          // Helper: check 11h rest between adjacent shifts
          const getAdjacentShiftEnd = (dateStr: string, empId: string, direction: 'prev' | 'next'): number | null => {
            const entries = optimized.filter(e =>
              e.employeeId === empId && e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode)
            ).sort((a, b) => a.date.localeCompare(b.date));

            const idx = entries.findIndex(e => e.date === dateStr);
            if (direction === 'prev' && idx > 0) {
              const prev = entries[idx - 1];
              const end = parse(prev.endTime, 'HH:mm', new Date());
              return end.getHours() * 60 + end.getMinutes();
            }
            if (direction === 'next' && idx >= 0 && idx < entries.length - 1) {
              const next = entries[idx + 1];
              const start = parse(next.startTime, 'HH:mm', new Date());
              return start.getHours() * 60 + start.getMinutes();
            }
            return null;
          };

          // Count work days per ISO week for this employee
          const weekDays: Record<number, number> = {};
          empEntries.filter(e => e.startTime && e.endTime).forEach(e => {
            const w = getWeek(new Date(e.date), { weekStartsOn: 1 });
            weekDays[w] = (weekDays[w] || 0) + 1;
          });

          for (const entry of offDays) {
            if (remain <= tolerance) break;
            const { openMin: dOpenMin, closeMin: dCloseMin, closed } = getDayLimits(entry.date);
            if (closed) continue;

            // endDate: skip days after employee's last working day
            if (emp.endDate && entry.date > emp.endDate) continue;

            // Check 5 days/week limit
            const entryWeek = getWeek(new Date(entry.date), { weekStartsOn: 1 });
            if ((weekDays[entryWeek] || 0) >= 5) continue;

            // Target: fill remaining debt but max 10h gross
            const targetNet = Math.min(remain, 570); // max ~9.5h net (10h gross - 30min pause)
            const estGross = targetNet + 30;
            const gross = Math.min(estGross, maxGross, dCloseMin - dOpenMin);

            if (gross >= MIN_AUTO_SHIFT_MINUTES) {
              const pause = correctPause(gross);
              entry.startTime = toHHMM(dOpenMin);
              entry.endTime = toHHMM(dOpenMin + gross);
              entry.pauseMinutes = pause;
              entry.absenceCode = '';
              entry.remark = '';
              remain -= (gross - pause);
              weekDays[entryWeek] = (weekDays[entryWeek] || 0) + 1;
              changed = true;
            }
          }
        }
      }
    }
    if (!changed) break;
  }

  return optimized;
}

// ─────────────────────────────────────────────────────────────
// PDF Export: Monthly report with employee summary table
// ─────────────────────────────────────────────────────────────

export function exportToPdf(
  masterData: MasterData,
  allEntries: DailyEntry[],
  employees: Employee[],
  t: TranslateFn,
  language: Language = 'vi',
  holidays?: Set<string>
) {
  const doc = new jsPDF();
  const accuracies = calculateAllEmployeesAccuracy(employees, allEntries, holidays);
  const monthYearStr = `${masterData.month.toString().padStart(2, '0')}/${masterData.year}`;
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
  const isDE = language === 'de';

  // ── Header ──
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(isDE ? 'Monatsbericht' : 'Bao cao thang', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${isDE ? 'Firma' : 'Cong ty'}: ${masterData.companyName}`, 14, 30);
  doc.text(`${isDE ? 'Zeitraum' : 'Ky'}: ${monthYearStr}`, 14, 36);
  doc.text(`${isDE ? 'Erstellt am' : 'Ngay xuat'}: ${dateStr}`, 14, 42);

  // ── Summary table ──
  const headRow = [
    'Nr',
    isDE ? 'Name' : 'Ten',
    isDE ? 'Vertragsart' : 'Loai HD',
    isDE ? 'Soll/Woche' : 'HD/Tuan',
    isDE ? 'Soll/Monat' : 'HD/Thang',
    isDE ? 'Ist/Monat' : 'Thuc te',
    isDE ? 'Differenz' : 'Chenh lech',
    isDE ? 'Arbeitstage' : 'Ngay lam',
    isDE ? 'Krank' : 'Nghi om',
    isDE ? 'Urlaub' : 'Nghi phep',
  ];

  const bodyRows = accuracies.map((a, i) => {
    const emp = employees.find(e => e.id === a.employeeId);
    const contractLabel = emp?.contractType
      ? (emp.contractType === 'Vollzeit' ? (isDE ? 'Vollzeit' : 'Toan TG')
        : emp.contractType === 'Teilzeit' ? (isDE ? 'Teilzeit' : 'Ban TG')
        : 'Minijob')
      : '—';
    return [
      (i + 1).toString(),
      a.name,
      contractLabel,
      `${a.weeklyHours.toFixed(1)}h`,
      `${a.targetHours.toFixed(1)}h`,
      `${a.actualHours.toFixed(1)}h`,
      `${a.difference >= 0 ? '+' : ''}${a.difference.toFixed(1)}h`,
      a.workedDays.toString(),
      a.sickDays.toString(),
      a.vacationDays.toString(),
    ];
  });

  // Totals row
  const totalTarget = accuracies.reduce((s, a) => s + a.targetHours, 0);
  const totalActual = accuracies.reduce((s, a) => s + a.actualHours, 0);
  const totalDiff = totalActual - totalTarget;
  bodyRows.push([
    '',
    isDE ? 'GESAMT' : 'TONG',
    '',
    '',
    `${totalTarget.toFixed(1)}h`,
    `${totalActual.toFixed(1)}h`,
    `${totalDiff >= 0 ? '+' : ''}${totalDiff.toFixed(1)}h`,
    '',
    '',
    '',
  ]);

  autoTable(doc, {
    startY: 50,
    head: [headRow],
    body: bodyRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [41, 65, 122],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    // Bold the totals row (last row)
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === bodyRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [230, 235, 245];
      }
      // Color the difference column
      if (data.section === 'body' && data.column.index === 6) {
        const val = parseFloat(data.cell.raw as string);
        if (!isNaN(val)) {
          data.cell.styles.textColor = val >= 0 ? [0, 120, 60] : [180, 30, 30];
        }
      }
    },
  });

  // ── Footer ──
  const finalY = (doc as any).lastAutoTable?.finalY || 150;
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(
    isDE
      ? `Erstellt mit Restaurant Staff Scheduling — ${dateStr}`
      : `Xuat boi Restaurant Staff Scheduling — ${dateStr}`,
    14,
    finalY + 15
  );

  // ── Save ──
  const safeCompany = masterData.companyName.replace(/[^a-z0-9]/gi, '_') || 'Restaurant';
  const filename = `Monatsbericht_${safeCompany}_${masterData.year}-${masterData.month.toString().padStart(2, '0')}.pdf`;
  doc.save(filename);
}
