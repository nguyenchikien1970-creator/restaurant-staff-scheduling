import {
  generateSmartSchedule,
  analyzeScheduleWarnings,
  validateRow,
  optimizeSchedule,
  MIN_AUTO_SHIFT_MINUTES
} from './src/lib/utils';
import { Employee, RestaurantConfig, DailyEntry } from './src/types';

// Mock translation function
const t = (key: string) => key;

function getBaseConfig(): RestaurantConfig {
  return {
    openTime: '12:00',
    closeTime: '23:00',
    minStaff: 2,
    closedDays: [],
    daySchedules: {},
    lunchPeakStart: '12:00',
    dinnerPeakStart: '18:00',
    lunchPeakHeadcount: 3,
    dinnerPeakHeadcount: 3,
    busyDays: [5, 6], // Fri, Sat
    bundesland: 'BE'
  };
}

function getBaseEmployees(): Employee[] {
  return [
    { id: '1', name: 'Emp 1', personnelNumber: '001', weeklyHours: 40, contractType: 'fulltime', hourlyWage: 12 },
    { id: '2', name: 'Emp 2', personnelNumber: '002', weeklyHours: 20, contractType: 'parttime', hourlyWage: 12 },
  ];
}

async function runTests() {
  console.log("--- E2E Logic Test Suite ---");

  // --- Bugfix 1 ---
  console.log("\\nTesting Bugfix 1: Case 1 (Sunday open 14:00, lunchPeakStart 12:00)");
  let config1 = getBaseConfig();
  config1.daySchedules = {
    0: { openTime: '14:00', closeTime: '23:00', closed: false }
  };
  let emps = getBaseEmployees();
  let schedule1 = generateSmartSchedule(6, 2026, emps, config1, t);
  let sunShifts1 = schedule1.filter(s => new Date(s.date).getDay() === 0 && s.startTime !== '');
  let startsBefore14_1 = sunShifts1.some(s => {
    const startHour = parseInt(s.startTime.split(':')[0]);
    return startHour < 14;
  });
  console.log(`Case 1 Pass: ${!startsBefore14_1}`);
  if (startsBefore14_1) console.log("Failed. Found shifts: ", sunShifts1);

  console.log("\\nTesting Bugfix 1: Case 2 (Saturday open 14:00)");
  let config2 = getBaseConfig();
  config2.daySchedules = {
    6: { openTime: '14:00', closeTime: '23:00', closed: false }
  };
  let schedule2 = generateSmartSchedule(6, 2026, emps, config2, t);
  let satShifts2 = schedule2.filter(s => new Date(s.date).getDay() === 6 && s.startTime !== '');
  let startsBefore14_2 = satShifts2.some(s => {
    const startHour = parseInt(s.startTime.split(':')[0]);
    return startHour < 14;
  });
  console.log(`Case 2 Pass: ${!startsBefore14_2}`);
  if (startsBefore14_2) console.log("Failed. Found shifts: ", satShifts2);

  // --- Bugfix 2 ---
  console.log("\\nTesting Bugfix 2: Case 3 (Window 90 mins, 14:00 to 15:30)");
  let config3 = getBaseConfig();
  config3.openTime = '14:00';
  config3.closeTime = '15:30';
  let schedule3 = generateSmartSchedule(6, 2026, emps, config3, t);
  let has90Min = schedule3.some(s => {
    if (!s.startTime || !s.endTime) return false;
    let st = parseInt(s.startTime.split(':')[0])*60 + parseInt(s.startTime.split(':')[1]);
    let et = parseInt(s.endTime.split(':')[0])*60 + parseInt(s.endTime.split(':')[1]);
    return (et - st) === 90;
  });
  let noShiftsOrOnlyValid = schedule3.every(s => {
    if (!s.startTime) return true;
    let st = parseInt(s.startTime.split(':')[0])*60 + parseInt(s.startTime.split(':')[1]);
    let et = parseInt(s.endTime.split(':')[0])*60 + parseInt(s.endTime.split(':')[1]);
    return (et - st) >= 120;
  });
  console.log(`Case 3 Pass (no 90 min shifts): ${!has90Min && noShiftsOrOnlyValid}`);

  console.log("\\nTesting Bugfix 2: Case 4 (Window 120 mins, 14:00 to 16:00)");
  let config4 = getBaseConfig();
  config4.openTime = '14:00';
  config4.closeTime = '16:00';
  let schedule4 = generateSmartSchedule(6, 2026, emps, config4, t);
  let valid120 = true;
  schedule4.forEach(s => {
    if (s.startTime) {
      if (s.startTime !== '14:00' || s.endTime !== '16:00') valid120 = false;
      if (s.pauseMinutes !== 0) valid120 = false;
      let warnings = validateRow(s, 120);
      if (warnings.includes('warning.shiftUnder2h')) valid120 = false;
    }
  });
  console.log(`Case 4 Pass (shifts are 120 min, no pause, no warning): ${valid120}`);

  console.log("\\nTesting Bugfix 2: Case 5 (Check auto-generated shifts)");
  let config5 = getBaseConfig();
  let schedule5 = generateSmartSchedule(6, 2026, emps, config5, t);
  let hasInvalidAutoShift = schedule5.some(s => {
    if (!s.startTime || !s.endTime) return false;
    let st = parseInt(s.startTime.split(':')[0])*60 + parseInt(s.startTime.split(':')[1]);
    let et = parseInt(s.endTime.split(':')[0])*60 + parseInt(s.endTime.split(':')[1]);
    let gross = et - st;
    return gross > 0 && gross < 120;
  });
  console.log(`Case 5 Pass (no 60/75/90/105 min shifts): ${!hasInvalidAutoShift}`);

  // --- Manual and Optimizer ---
  console.log("\\nTesting Bugfix 2: Case 6 (Manual shift 14:00 - 15:30)");
  let manualEntry: DailyEntry = {
    employeeId: '1', date: '2026-06-01', startTime: '14:00', endTime: '15:30', pauseMinutes: 0, absenceCode: '', remark: ''
  };
  let warnings6 = validateRow(manualEntry, 90);
  console.log(`Case 6 Pass (Appends warning.shiftUnder2h, does not auto extend): ${warnings6.includes('warning.shiftUnder2h') && manualEntry.endTime === '15:30'}`);

  console.log("\\nTesting Bugfix 2: Case 7 (Day-level warning check)");
  let alerts = analyzeScheduleWarnings([manualEntry], emps, config1, t, 'vi');
  let hasDayWarning = alerts.some(a => a.type === 'short_shift' && a.message.includes('dưới 2 giờ'));
  console.log(`Case 7 Pass (Day warning generated): ${hasDayWarning}`);

  console.log("\\nTesting Bugfix 2: Case 8 (Optimizer does not create < 120min shift)");
  let optSchedule = optimizeSchedule([manualEntry], emps, config1, t, 'vi');
  let hasInvalidOptShift = optSchedule.some(s => {
    if (!s.startTime || !s.endTime) return false;
    let st = parseInt(s.startTime.split(':')[0])*60 + parseInt(s.startTime.split(':')[1]);
    let et = parseInt(s.endTime.split(':')[0])*60 + parseInt(s.endTime.split(':')[1]);
    let gross = et - st;
    return gross > 0 && gross < 120;
  });
  console.log(`Case 8 Pass (Optimizer respects MIN_AUTO_SHIFT_MINUTES): ${!hasInvalidOptShift}`);
}

runTests();
