import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, getDaysInMonth, isValid, parse, differenceInMinutes, isAfter, addDays, getWeek } from "date-fns";
import { de } from "date-fns/locale";
import { vi } from "date-fns/locale";
import * as XLSX from 'xlsx';
import { DailyEntry, CalculatedEntry, MasterData, MonthlySummaryData, AbsenceCode, Employee, RestaurantConfig, DayScheduleConfig } from "../types";
import { TranslateFn, Language } from "../i18n";

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

  return dates.map(date => {
    const entry: DailyEntry = {
      employeeId, date, startTime: '', pauseMinutes: 0,
      endTime: '', absenceCode: '', remark: ''
    };
    if (selectedWork.includes(date)) {
      entry.startTime = startTime;
      entry.endTime = endTime;
      entry.pauseMinutes = 30;
    }
    return entry;
  });
}

export function calculateWorkedMinutes(startTime: string, endTime: string, pauseMinutes: number): number {
  if (!startTime || !endTime) return 0;
  const start = parse(startTime, 'HH:mm', new Date());
  let end = parse(endTime, 'HH:mm', new Date());
  if (!isValid(start) || !isValid(end)) return 0;
  if (isAfter(start, end)) {
    end = addDays(end, 1);
  }
  let diff = differenceInMinutes(end, start);
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
// Pause rules:
//   net ≤ 8h (480 min)  → Pause must be ≥ 30 min
//   net > 8h (480 min)  → Pause must be ≥ 45 min
export function validateRow(entry: DailyEntry, durationMinutes: number): string[] {
  const warnings: string[] = [];
  const isFullAbsence = ['K', 'U', 'UU', 'F'].includes(entry.absenceCode);

  if (!isFullAbsence) {
    if (entry.startTime && !entry.endTime) warnings.push('warning.endMissing');
    if (!entry.startTime && entry.endTime) warnings.push('warning.startMissing');
    if (entry.pauseMinutes < 0) warnings.push('warning.pauseNegative');
    // Only flag pause if we actually have a full shift recorded
    if (entry.startTime && entry.endTime && durationMinutes > 0) {
      if (durationMinutes > 480 && entry.pauseMinutes < 45) warnings.push('warning.pauseUnder45');
      else if (durationMinutes <= 480 && entry.pauseMinutes < 30) warnings.push('warning.pauseUnder30');
    }
  }
  return warnings;
}

export function processEntries(entries: DailyEntry[]): CalculatedEntry[] {
  return entries.map(entry => {
    const isFullAbsence = ['K', 'U', 'UU', 'F'].includes(entry.absenceCode);
    let durationMinutes = 0;
    if (!isFullAbsence || entry.absenceCode === 'SA' || entry.absenceCode === 'SU') {
      durationMinutes = calculateWorkedMinutes(entry.startTime, entry.endTime, entry.pauseMinutes);
    }
    return {
      ...entry, durationMinutes,
      durationTime: formatMinutesToTime(durationMinutes),
      durationDecimal: calculateDecimalHours(durationMinutes),
      warnings: validateRow(entry, durationMinutes)
    };
  });
}

export function calculateSummary(entries: CalculatedEntry[]): MonthlySummaryData {
  let totalNormalHours = 0, totalK = 0, totalU = 0, totalUU = 0, totalF = 0;
  let workedDays = 0, absenceDays = 0, totalBreakMinutes = 0, totalDecimalHours = 0;

  entries.forEach(entry => {
    totalDecimalHours += entry.durationDecimal;
    totalBreakMinutes += (entry.pauseMinutes || 0);
    if (entry.durationMinutes > 0) { workedDays++; totalNormalHours += entry.durationDecimal; }
    if (entry.absenceCode === 'K') totalK++;
    if (entry.absenceCode === 'U') totalU++;
    if (entry.absenceCode === 'UU') totalUU++;
    if (entry.absenceCode === 'F') totalF++;
    if (['K', 'U', 'UU', 'F'].includes(entry.absenceCode)) absenceDays++;
  });

  return { totalNormalHours, totalK, totalU, totalUU, totalF, calendarDays: entries.length, workedDays, absenceDays, totalBreakMinutes, totalDecimalHours };
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

  // Use Blob-based download for maximum browser compatibility
  // XLSX.writeFile() can silently fail on some browsers/environments
  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    console.error('Excel export error:', err);
    // Fallback to XLSX.writeFile
    XLSX.writeFile(wb, filename);
  }
}

export function generateSmartSchedule(
  month: number, year: number, employees: Employee[], config: RestaurantConfig, t: TranslateFn
): DailyEntry[] {
  const dates = generateMonthDates(month, year);
  const daysInMonth = dates.length;

  // ─────────────────────────────────────────────────────────────
  // PHASE 1: Pre-plan which days each employee WORKS vs RESTS
  // ─────────────────────────────────────────────────────────────

  // workPlan[empId][dayIndex] = 'work' | 'urlaub' | 'off' | 'closed'
  // 'closed' = Ruhetag des Restaurants → zählt auch als Ruhetag für Mitarbeiter
  const workPlan: Record<string, ('work' | 'urlaub' | 'off' | 'closed')[]> = {};

  // Day metadata — uses per-day schedule for open/close times
  const dayMeta = dates.map((d, i) => {
    const date = new Date(d);
    const dow = date.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    const isFriday = dow === 5;
    const isWeekday = dow >= 1 && dow <= 4; // Mon–Thu only (best rest days)
    const dayOC = getDayOpenClose(config, dow);
    const isRestaurantClosed = dayOC.closed;
    const rawOpen = parse(dayOC.openTime, 'HH:mm', new Date());
    const rawClose = parse(dayOC.closeTime, 'HH:mm', new Date());
    const openTimeDate = new Date(Math.round(rawOpen.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000));
    const closeTimeDate = new Date(Math.round(rawClose.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000));
    return { d, i, dow, isWeekend, isFriday, isWeekday, isRestaurantClosed, openTimeDate, closeTimeDate };
  });

  // Initialize workPlan: Ruhetage → 'closed', all other days → 'work'
  employees.forEach(emp => {
    workPlan[emp.id] = dates.map((_, i) =>
      dayMeta[i].isRestaurantClosed ? 'closed' : 'work'
    );
  });

  // ── 1a. Vacation days: spread across mid-month WEEKDAYS (Mon-Thu) that are NOT closed days
  const restCandidateDays = dayMeta.filter(x => x.isWeekday && !x.isRestaurantClosed).map(x => x.i);

  employees.forEach((emp, empIdx) => {
    const pool1 = restCandidateDays.filter(i => new Date(dates[i]).getDate() >= 8 && new Date(dates[i]).getDate() <= 15);
    const pool2 = restCandidateDays.filter(i => new Date(dates[i]).getDate() >= 16 && new Date(dates[i]).getDate() <= 23);
    if (pool1.length > 0) workPlan[emp.id][pool1[empIdx % pool1.length]] = 'urlaub';
    if (pool2.length > 0) workPlan[emp.id][pool2[(empIdx + 2) % pool2.length]] = 'urlaub';
  });

  // ── 1b. Rest days: distribute on Mon–Thu ONLY, staggered so coverage is always maintained
  employees.forEach((emp, empIdx) => {
    const avgHoursPerDay = emp.weeklyHours / 5;
    const targetWorkDays = Math.round(emp.weeklyHours * 4.33 / avgHoursPerDay);
    // Ruhetage ('closed') count as rest days too → subtract along with urlaub
    const nonWorkDays = workPlan[emp.id].filter(s => s === 'urlaub' || s === 'closed').length;
    const currentWorkDays = daysInMonth - nonWorkDays;
    const neededRestDays = Math.max(0, currentWorkDays - targetWorkDays);

    if (neededRestDays === 0) return;

    // Candidates: Mon–Thu only, not already urlaub, spread evenly across the month
    const candidates = restCandidateDays.filter(i => workPlan[emp.id][i] === 'work');

    // Stagger by employee index so different employees rest on different days
    const step = Math.max(1, Math.floor(candidates.length / neededRestDays));
    let restAssigned = 0;
    let ptr = empIdx % step;

    while (restAssigned < neededRestDays && ptr < candidates.length) {
      const dayIdx = candidates[ptr];
      // Only rest if we won't drop below minStaff
      const workingOnDay = employees.filter(e => workPlan[e.id][dayIdx] === 'work').length;
      if (workingOnDay > config.minStaff) {
        workPlan[emp.id][dayIdx] = 'off';
        restAssigned++;
      }
      ptr += step;
    }

    // Fallback: if still need more rest days, re-scan less strictly
    if (restAssigned < neededRestDays) {
      for (const dayIdx of candidates) {
        if (restAssigned >= neededRestDays) break;
        if (workPlan[emp.id][dayIdx] === 'work') {
          const workingOnDay = employees.filter(e => workPlan[e.id][dayIdx] === 'work').length;
          if (workingOnDay > Math.max(1, config.minStaff)) {
            workPlan[emp.id][dayIdx] = 'off';
            restAssigned++;
          }
        }
      }
    }
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 2: Assign shift times based on work plan
  // ─────────────────────────────────────────────────────────────

  const minutesAssigned: Record<string, number> = {};
  employees.forEach(emp => { minutesAssigned[emp.id] = 0; });

  const allEntries: DailyEntry[] = [];

  dates.forEach((dateStr, dayIndex) => {
    const meta = dayMeta[dayIndex];
    const isWeekend = meta.isWeekend;
    const isFriday = meta.isFriday;
    const isPeakDay = isWeekend || isFriday; // Extra staff on Fri/Sat/Sun

    const dayEntries: Record<string, DailyEntry> = {};

    employees.forEach(emp => {
      const status = workPlan[emp.id][dayIndex];
      dayEntries[emp.id] = {
        employeeId: emp.id,
        date: dateStr,
        startTime: '',
        pauseMinutes: 0,
        endTime: '',
        absenceCode: status === 'urlaub' ? 'U' : '',
        remark: status === 'urlaub'
          ? t('remark.vacation')
          : status === 'closed'
            ? t('remark.closedDay')
            : '',
      };
    });

    // If restaurant is closed today (Ruhetag): push entries and skip shift assignment
    if (meta.isRestaurantClosed) {
      Object.values(dayEntries).forEach(entry => allEntries.push(entry));
      return;
    }

    // Collect workers for today, sorted by remaining debt (highest debt → first)
    const workers = employees
      .filter(emp => workPlan[emp.id][dayIndex] === 'work')
      .map(emp => {
        const targetTotal = emp.weeklyHours * 4.33 * 60;
        const remainingWorkDays = workPlan[emp.id].slice(dayIndex).filter(s => s === 'work').length;
        const debt = targetTotal - minutesAssigned[emp.id];
        const targetToday = Math.max(120, Math.min(600, Math.round(debt / Math.max(1, remainingWorkDays))));
        return { emp, debt, targetToday };
      })
      .sort((a, b) => b.debt - a.debt);

    // Use per-day open/close times
    const { openTimeDate, closeTimeDate } = meta;

    workers.forEach(({ emp, targetToday }, idx) => {
      const entry = dayEntries[emp.id];
      const netMinutes = targetToday;

      // Determine initial pause based on target net work time
      // Rule: net ≤ 8h → 30 min pause; net > 8h → 45 min pause
      const initialPause = netMinutes > 480 ? 45 : 30;

      let startTime: string;

      if (idx < config.minStaff) {
        // Opening crew: stagger from open time
        const startOffset = idx * 30;
        const start = new Date(openTimeDate.getTime() + startOffset * 60000);
        startTime = format(start, 'HH:mm');
      } else if (isPeakDay) {
        // Peak day extra staff: alternate lunch (11:30) and dinner (17:30) shifts
        const isLunchShift = idx % 2 === 0;
        const baseStr = isLunchShift ? '11:30' : '17:30';
        const base = parse(baseStr, 'HH:mm', new Date());
        const stagger = (Math.floor(idx / 2)) * 15;
        const start = new Date(base.getTime() + stagger * 60000);
        const actualStart = isAfter(openTimeDate, start) ? openTimeDate : start;
        startTime = format(actualStart, 'HH:mm');
      } else {
        // Weekday extra: lean toward dinner shift coverage
        const base = parse('17:30', 'HH:mm', new Date());
        const stagger = (idx - config.minStaff) * 20;
        const start = new Date(base.getTime() + stagger * 60000);
        const actualStart = isAfter(openTimeDate, start) ? openTimeDate : start;
        startTime = format(actualStart, 'HH:mm');
      }

      const startDate = parse(startTime, 'HH:mm', new Date());
      let end = new Date(startDate.getTime() + (netMinutes + initialPause) * 60000);
      end = new Date(Math.round(end.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000));
      if (isAfter(end, closeTimeDate)) end = closeTimeDate;
      const endTime = format(end, 'HH:mm');

      const e = parse(endTime, 'HH:mm', new Date());
      const grossDuration = differenceInMinutes(e, startDate);

      // Recalculate correct pause for the actual gross shift (after clamping)
      let actualPause = initialPause;
      const netWithInitial = grossDuration - initialPause;
      if (netWithInitial > 480 && actualPause < 45) actualPause = 45;
      else if (netWithInitial <= 480 && actualPause > 30) actualPause = 30;

      if (grossDuration >= 90) {
        entry.startTime = startTime;
        entry.endTime = endTime;
        entry.pauseMinutes = actualPause;
        minutesAssigned[emp.id] += Math.max(0, grossDuration - actualPause);
      }
    });

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
  type: 'understaffed' | 'gap' | 'empty';
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

    // ── Check 2: Understaffed (below minStaff)
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

    // ── Check 3: Coverage gaps – only during PEAK HOURS
    // Off-peak periods (15:00–17:00, after 21:30) are covered by the owner → no warning needed
    // Peak windows: Lunch 11:30–15:00, Dinner 17:00–21:30
    const PEAK_WINDOWS = [
      { start: 11 * 60 + 30, end: 15 * 60 },       // 11:30 – 15:00
      { start: 17 * 60,       end: 21 * 60 + 30 },  // 17:00 – 21:30
    ];

    const openMinutes  = openTime.getHours() * 60 + openTime.getMinutes();
    const closeMinutes = closeTime.getHours() * 60 + closeTime.getMinutes();
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
  });

  return alerts;
}

// ─────────────────────────────────────────────────────────────
// Schedule Optimizer: fix coverage gaps + balance hours
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

  // ── PHASE 1–3: Fix coverage gaps, understaffing ──

  Object.keys(byDate).sort().forEach(dateStr => {
    const dateObj = new Date(dateStr);
    const dow = dateObj.getDay();
    if (isDayClosed(config, dow)) return;

    const dayOC = getDayOpenClose(config, dow);
    const openTime = parse(dayOC.openTime, 'HH:mm', new Date());
    const closeTime = parse(dayOC.closeTime, 'HH:mm', new Date());
    const openMin = openTime.getHours() * 60 + openTime.getMinutes();
    const closeMin = closeTime.getHours() * 60 + closeTime.getMinutes();

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
        entry.startTime = toHHMM(startMinutes);
        entry.endTime = toHHMM(Math.min(startMinutes + shiftLength, closeMin));
        entry.pauseMinutes = shiftLength > 510 ? 45 : 30;
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
        if (shiftEnd - shiftStart >= 90) {
          best.entry.startTime = toHHMM(shiftStart);
          best.entry.endTime = toHHMM(shiftEnd);
          best.entry.pauseMinutes = (shiftEnd - shiftStart - 30) > 480 ? 45 : 30;
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
          entry.startTime = toHHMM(openMin);
          entry.endTime = toHHMM(Math.min(openMin + shiftLen, closeMin));
          entry.pauseMinutes = shiftLen > 510 ? 45 : 30;
          entry.absenceCode = '';
          entry.remark = '';
        });
    }
  });

  // ── PHASE 4: HOURS BALANCING — minimize deviation ──
  // Tolerance: ±30 min. Up to 6 passes for convergence.

  const TOLERANCE = 30;

  for (let pass = 0; pass < 6; pass++) {
    let changed = false;

    const devs = employees.map(emp => {
      const target = emp.weeklyHours * 4.33 * 60;
      const actual = getMonthlyMinutes(emp.id);
      return { emp, delta: actual - target };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    for (const { emp, delta } of devs) {
      if (Math.abs(delta) <= TOLERANCE) continue;

      const empEntries = optimized.filter(e => e.employeeId === emp.id);

      if (delta > TOLERANCE) {
        // OVER target → reduce hours
        let remain = delta;

        // A) Shorten longest shifts
        const shifts = empEntries
          .filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode))
          .map(e => {
            const s = parse(e.startTime, 'HH:mm', new Date());
            const en = parse(e.endTime, 'HH:mm', new Date());
            const net = differenceInMinutes(en, s) - (e.pauseMinutes || 0);
            return { entry: e, net, sMin: s.getHours() * 60 + s.getMinutes(), eMin: en.getHours() * 60 + en.getMinutes() };
          })
          .sort((a, b) => b.net - a.net);

        for (const sh of shifts) {
          if (remain <= TOLERANCE) break;
          const trim = Math.floor(Math.min(remain, sh.net - 120) / 15) * 15;
          if (trim < 15) continue;

          const dayE = byDate[sh.entry.date] || [];
          const others = dayE.filter(e => e.employeeId !== emp.id && e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode)).length;
          if (others >= 1) {
            const newEnd = sh.eMin - trim;
            if (newEnd > sh.sMin + 90) {
              sh.entry.endTime = toHHMM(newEnd);
              const newNet = (newEnd - sh.sMin) - sh.entry.pauseMinutes;
              if (newNet <= 480 && sh.entry.pauseMinutes > 30) sh.entry.pauseMinutes = 30;
              remain -= trim;
              changed = true;
            }
          }
        }

        // B) Remove shortest shifts (→ rest day)
        if (remain > 60) {
          const short = empEntries
            .filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode))
            .map(e => {
              const s = parse(e.startTime, 'HH:mm', new Date());
              const en = parse(e.endTime, 'HH:mm', new Date());
              return { entry: e, net: differenceInMinutes(en, s) - (e.pauseMinutes || 0) };
            })
            .sort((a, b) => a.net - b.net);

          for (const sh of short) {
            if (remain <= TOLERANCE) break;
            const dayE = byDate[sh.entry.date] || [];
            const others = dayE.filter(e => e.employeeId !== emp.id && e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode)).length;
            if (others >= config.minStaff) {
              remain -= sh.net;
              sh.entry.startTime = '';
              sh.entry.endTime = '';
              sh.entry.pauseMinutes = 0;
              sh.entry.absenceCode = '';
              sh.entry.remark = '';
              changed = true;
            }
          }
        }

      } else {
        // UNDER target → add hours
        let remain = Math.abs(delta);

        // A) Extend shortest shifts
        const shifts = empEntries
          .filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode))
          .map(e => {
            const s = parse(e.startTime, 'HH:mm', new Date());
            const en = parse(e.endTime, 'HH:mm', new Date());
            return { entry: e, gross: differenceInMinutes(en, s), sMin: s.getHours() * 60 + s.getMinutes(), eMin: en.getHours() * 60 + en.getMinutes() };
          })
          .sort((a, b) => a.gross - b.gross);

        for (const sh of shifts) {
          if (remain <= TOLERANCE) break;
          const dow = new Date(sh.entry.date).getDay();
          const oc = getDayOpenClose(config, dow);
          const dOpen = parse(oc.openTime, 'HH:mm', new Date());
          const dClose = parse(oc.closeTime, 'HH:mm', new Date());
          const dOpenMin = dOpen.getHours() * 60 + dOpen.getMinutes();
          const dCloseMin = dClose.getHours() * 60 + dClose.getMinutes();
          const maxGross = 10 * 60 + 45;

          // Extend at end
          const extEnd = Math.floor(Math.min(remain, dCloseMin - sh.eMin, maxGross - sh.gross) / 15) * 15;
          if (extEnd >= 15) {
            sh.entry.endTime = toHHMM(sh.eMin + extEnd);
            sh.eMin += extEnd; sh.gross += extEnd;
            if (sh.gross - sh.entry.pauseMinutes > 480 && sh.entry.pauseMinutes < 45) sh.entry.pauseMinutes = 45;
            remain -= extEnd;
            changed = true;
          }
          if (remain <= TOLERANCE) break;
          // Extend at start
          const extStart = Math.floor(Math.min(remain, sh.sMin - dOpenMin, maxGross - sh.gross) / 15) * 15;
          if (extStart >= 15) {
            sh.entry.startTime = toHHMM(sh.sMin - extStart);
            sh.sMin -= extStart; sh.gross += extStart;
            if (sh.gross - sh.entry.pauseMinutes > 480 && sh.entry.pauseMinutes < 45) sh.entry.pauseMinutes = 45;
            remain -= extStart;
            changed = true;
          }
        }

        // B) Convert off days to work days
        if (remain > 60) {
          const offDays = empEntries.filter(e => !e.startTime && !e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode));
          for (const entry of offDays) {
            if (remain <= TOLERANCE) break;
            const dow = new Date(entry.date).getDay();
            if (isDayClosed(config, dow)) continue;
            const oc = getDayOpenClose(config, dow);
            const dOpen = parse(oc.openTime, 'HH:mm', new Date());
            const dClose = parse(oc.closeTime, 'HH:mm', new Date());
            const dOpenMin = dOpen.getHours() * 60 + dOpen.getMinutes();
            const dCloseMin = dClose.getHours() * 60 + dClose.getMinutes();
            const targetNet = Math.min(remain, 480);
            const pause = 30;
            const gross = Math.min(targetNet + pause, dCloseMin - dOpenMin);
            if (gross >= 90) {
              entry.startTime = toHHMM(dOpenMin);
              entry.endTime = toHHMM(dOpenMin + gross);
              entry.pauseMinutes = pause;
              entry.absenceCode = '';
              entry.remark = '';
              remain -= (gross - pause);
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

