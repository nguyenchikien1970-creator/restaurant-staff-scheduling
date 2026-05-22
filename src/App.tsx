import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { MasterData, DailyEntry, CalculatedEntry, MonthlySummaryData, Employee, RestaurantConfig } from './types';
import { generateMonthDates, processEntries, calculateSummary, exportToExcel, exportToPdf, generateSmartSchedule, analyzeScheduleWarnings, optimizeSchedule, ScheduleAlert, calculateAllEmployeesAccuracy, EmployeeAccuracy, getGermanHolidays } from './lib/utils';
import { StaffManagement } from './components/StaffManagement';

// Lazy-loaded components — only fetched when user navigates to them
const MasterDataForm = React.lazy(() => import('./components/MasterDataForm').then(m => ({ default: m.MasterDataForm })));
const DailyEntriesTable = React.lazy(() => import('./components/DailyEntriesTable').then(m => ({ default: m.DailyEntriesTable })));
const MonthlySummary = React.lazy(() => import('./components/MonthlySummary').then(m => ({ default: m.MonthlySummary })));
const RestaurantSettings = React.lazy(() => import('./components/RestaurantSettings').then(m => ({ default: m.RestaurantSettings })));
const DailyOverview = React.lazy(() => import('./components/DailyOverview').then(m => ({ default: m.DailyOverview })));
import { LoginPage } from './components/LoginPage';
import { useLocalData } from './hooks/useLocalData';
import { FileSpreadsheet, FileText, Calendar, UserCheck, Settings, Globe, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, LogOut, Wrench, Loader2, RefreshCw, LayoutGrid } from 'lucide-react';
import { useLanguage } from './i18n';

export default function App() {
  const { language, setLanguage, t } = useLanguage();

  // ── Auth state (localStorage) ──
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('auth_email');
    if (savedEmail) {
      setIsLoggedIn(true);
      setUserEmail(savedEmail);
    }
    setAuthLoading(false);
  }, []);

  const handleLogin = (email: string) => {
    setIsLoggedIn(true);
    setUserEmail(email);
    localStorage.setItem('auth_email', email);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_email');
    setIsLoggedIn(false);
    setUserEmail('');
  };

  // ── Local Data Hook ──
  const {
    loading: dataLoading,
    loadError,
    saveStatus,
    saveMessage,
    masterData, setMasterData,
    entries, setEntries,
    saveConfig, saveEmployee, addEmployee, deleteEmployee, saveEntries,
    loadData, loadPreviousMonthEntries,
  } = useLocalData();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'staff' | 'settings' | 'schedule' | 'daily'>('staff');
  const [scheduleAlerts, setScheduleAlerts] = useState<ScheduleAlert[]>([]);
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  // Compute holidays set for special hours tracking
  const holidays = React.useMemo(() =>
    getGermanHolidays(masterData.year, masterData.restaurantConfig.bundesland),
    [masterData.year, masterData.restaurantConfig.bundesland]
  );

  // Compute accuracy for all employees (memoized by entries)
  const employeeAccuracies: EmployeeAccuracy[] = React.useMemo(() => {
    if (entries.length === 0 || masterData.employees.length === 0) return [];
    return calculateAllEmployeesAccuracy(masterData.employees, entries, holidays);
  }, [entries, masterData.employees, holidays]);

  // Auto-save config when masterData changes (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveConfig(masterData);
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [masterData.companyName, masterData.restaurantConfig]);

  const handleMasterDataChange = (newData: MasterData) => setMasterData(newData);

  const handleEmployeesChange = async (employees: Employee[]) => {
    const prev = masterData.employees;
    setMasterData(md => ({ ...md, employees }));

    // Detect added employees
    for (const emp of employees) {
      const existed = prev.find(p => p.id === emp.id);
      if (!existed) {
        const created = await addEmployee(emp);
        if (created) {
          // Update local state with DB-generated id
          setMasterData(md => ({
            ...md,
            employees: md.employees.map(e => e.id === emp.id ? created : e),
          }));
        }
      } else if (existed.name !== emp.name || existed.weeklyHours !== emp.weeklyHours || existed.personnelNumber !== emp.personnelNumber) {
        await saveEmployee(emp);
      }
    }

    // Detect removed employees
    for (const old of prev) {
      if (!employees.find(e => e.id === old.id)) {
        await deleteEmployee(old.id);
      }
    }

    if (selectedEmployeeId && !employees.find(e => e.id === selectedEmployeeId)) {
      setSelectedEmployeeId(null);
    }
  };

  const handleConfigChange = (restaurantConfig: RestaurantConfig) => {
    setMasterData(prev => ({ ...prev, restaurantConfig }));
  };

  const handleDownloadBackup = () => {
    const data = { masterData, entries };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_nhahang_${masterData.year}_${masterData.month}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUploadBackup = (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.masterData) setMasterData(parsed.masterData);
        if (parsed.entries) setEntries(parsed.entries);
        alert(t('alert.restoreSuccess'));
      } catch (err) { alert(t('alert.invalidFile')); }
    };
    reader.readAsText(file);
  };

  const handleGenerateSchedule = () => {
    if (masterData.employees.length === 0) {
      alert(t('alert.addEmployeeFirst'));
      return;
    }
    const newEntries = generateSmartSchedule(
      masterData.month, masterData.year, masterData.employees, masterData.restaurantConfig, t
    );
    setEntries(newEntries);
    saveEntries(newEntries, masterData.month, masterData.year);
    // Analyze warnings after generation
    const alerts = analyzeScheduleWarnings(
      newEntries, masterData.employees, masterData.restaurantConfig, t, language
    );
    setScheduleAlerts(alerts);
    setAlertsExpanded(true);
    setActiveTab('schedule');
    if (masterData.employees.length > 0) {
      setSelectedEmployeeId(masterData.employees[0].id);
    }
  };

  const handleOptimizeSchedule = () => {
    if (entries.length === 0) return;
    let current = [...entries];
    let passes = 0;
    let prevAvg = -1;

    // Run until convergence (no improvement) or max 20 safety limit
    for (let i = 0; i < 20; i++) {
      passes++;
      current = optimizeSchedule(
        current, masterData.employees, masterData.restaurantConfig, t, language
      );
      const accs = calculateAllEmployeesAccuracy(masterData.employees, current);
      const avgAcc = accs.length > 0 ? Math.round(accs.reduce((s, a) => s + a.accuracy, 0) / accs.length) : 0;
      // Stop if target reached or no improvement
      if (avgAcc >= 98 || avgAcc <= prevAvg) break;
      prevAvg = avgAcc;
    }

    setEntries(current);
    saveEntries(current, masterData.month, masterData.year);
    const newAlerts = analyzeScheduleWarnings(
      current, masterData.employees, masterData.restaurantConfig, t, language
    );
    setScheduleAlerts(newAlerts);
    setAlertsExpanded(true);

    // Show result
    const finalAccs = calculateAllEmployeesAccuracy(masterData.employees, current);
    const avgFinal = finalAccs.length > 0 ? Math.round(finalAccs.reduce((s, a) => s + a.accuracy, 0) / finalAccs.length) : 0;
    alert(t('schedule.optimizeResult').replace('{passes}', passes.toString()).replace('{accuracy}', avgFinal.toString()));
  };

  const handleCheckErrors = () => {
    if (entries.length === 0) return;
    const alerts = analyzeScheduleWarnings(
      entries, masterData.employees, masterData.restaurantConfig, t, language
    );
    setScheduleAlerts(alerts);
    setAlertsExpanded(true);
    if (alerts.length === 0) {
      alert(t('schedule.noAlerts'));
    }
  };

  const handleCopyPreviousMonth = async () => {
    const prevEntries = await loadPreviousMonthEntries(masterData.month, masterData.year);
    if (prevEntries.length === 0) {
      alert(t('schedule.copyNoData'));
      return;
    }
    // Map previous month dates to current month: keep employee, times, but update date
    const currentDates = generateMonthDates(masterData.month, masterData.year);
    const mapped: DailyEntry[] = [];
    const empGroups: Record<string, DailyEntry[]> = {};
    prevEntries.forEach(e => {
      if (!empGroups[e.employeeId]) empGroups[e.employeeId] = [];
      empGroups[e.employeeId].push(e);
    });
    Object.entries(empGroups).forEach(([empId, prevEmpEntries]) => {
      currentDates.forEach((dateStr, i) => {
        const src = prevEmpEntries[i % prevEmpEntries.length];
        mapped.push({ ...src, date: dateStr, employeeId: empId });
      });
    });
    setEntries(mapped);
    saveEntries(mapped, masterData.month, masterData.year);
    alert(t('schedule.copySuccess'));
  };

  const handlePrintWeek = () => {
    const dates = generateMonthDates(masterData.month, masterData.year);
    const emps = masterData.employees.filter(e => e.isActive !== false);
    // Build weekly grid
    let html = `<html><head><title>Wochenplan</title><style>
      @page { size: landscape; margin: 10mm; }
      body { font-family: Arial, sans-serif; font-size: 10px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th, td { border: 1px solid #333; padding: 3px 5px; text-align: center; }
      th { background: #f0f0f0; font-weight: bold; }
      .name { text-align: left; font-weight: bold; min-width: 100px; }
      h2 { margin: 4px 0; font-size: 13px; }
      .absence { color: #c00; font-weight: bold; }
    </style></head><body>`;
    html += `<h2>${masterData.companyName} — ${masterData.month}/${masterData.year}</h2>`;

    // Group by weeks
    const weeks: string[][] = [];
    let currentWeek: string[] = [];
    dates.forEach((d, i) => {
      const dow = new Date(d).getDay();
      currentWeek.push(d);
      if (dow === 0 || i === dates.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    const dayLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

    weeks.forEach((weekDates, wi) => {
      html += `<table><tr><th class="name">Mitarbeiter</th>`;
      weekDates.forEach(d => {
        const dt = new Date(d);
        html += `<th>${dayLabels[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}</th>`;
      });
      html += `</tr>`;
      emps.forEach(emp => {
        html += `<tr><td class="name">${emp.name}</td>`;
        weekDates.forEach(d => {
          const entry = entries.find(e => e.employeeId === emp.id && e.date === d);
          if (!entry || (!entry.startTime && !entry.absenceCode)) {
            html += `<td>—</td>`;
          } else if (entry.absenceCode) {
            html += `<td class="absence">${entry.absenceCode}</td>`;
          } else {
            html += `<td>${entry.startTime}-${entry.endTime}</td>`;
          }
        });
        html += `</tr>`;
      });
      html += `</table>`;
    });

    html += `</body></html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  const handleEntryChange = (index: number, updatedEntry: DailyEntry) => {
    const employeeEntries = entries.filter(e => e.employeeId === selectedEmployeeId);
    const otherEntries = entries.filter(e => e.employeeId !== selectedEmployeeId);
    const newEmployeeEntries = [...employeeEntries];
    newEmployeeEntries[index] = updatedEntry;
    setEntries([...otherEntries, ...newEmployeeEntries]);
  };

  const handleCopyPrevious = (index: number) => {
    if (index === 0) return;
    const employeeEntries = entries.filter(e => e.employeeId === selectedEmployeeId);
    const prev = employeeEntries[index - 1];
    const current = employeeEntries[index];
    handleEntryChange(index, {
      ...current, startTime: prev.startTime, pauseMinutes: prev.pauseMinutes,
      endTime: prev.endTime, absenceCode: prev.absenceCode
    });
  };

  const handleReset = () => {
    if (confirm(t('alert.confirmReset'))) {
      setEntries([]);
      setMasterData({
        companyName: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
        restaurantConfig: { openTime: '12:00', closeTime: '23:00', minStaff: 1, closedDays: [], daySchedules: {} }, employees: []
      });
      setSelectedEmployeeId(null);
      saveEntries([], masterData.month, masterData.year);
    }
  };

  const handleExport = () => {
    if (entries.length === 0) { alert(t('alert.noDataExport')); return; }
    try {
      exportToExcel(masterData, entries, masterData.employees, t, language);
    } catch (err) {
      console.error('Export failed:', err);
      alert(language === 'de'
        ? 'Fehler beim Excel-Export. Bitte versuchen Sie es erneut.'
        : 'Lỗi xuất Excel. Vui lòng thử lại.');
    }
  };

  const handlePdfExport = () => {
    if (entries.length === 0) { alert(t('alert.noDataExport')); return; }
    try {
      const holidays = getGermanHolidays(masterData.year, masterData.restaurantConfig.bundesland);
      exportToPdf(masterData, entries, masterData.employees, t, language, holidays);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert(language === 'de'
        ? 'Fehler beim PDF-Export. Bitte versuchen Sie es erneut.'
        : 'L\u1ed7i xu\u1ea5t PDF. Vui l\u00f2ng th\u1eed l\u1ea1i.');
    }
  };

  const selectedEmployee = masterData.employees.find(e => e.id === selectedEmployeeId);
  const currentEmployeeEntries = entries.filter(e => e.employeeId === selectedEmployeeId);
  const calculatedEntries = processEntries(currentEmployeeEntries);
  const summary = calculateSummary(calculatedEntries, holidays);

  // ── Auth loading ──
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-orange-500" size={40} />
      </div>
    );
  }

  // ── Login gate ──
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // ── Data loading ──
  if (dataLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <Loader2 className="animate-spin text-orange-500" size={40} />
        <p className="text-gray-500 text-sm">{language === 'de' ? 'Daten werden geladen...' : 'Đang tải dữ liệu...'}</p>
      </div>
    );
  }

  // ── Load error with retry ──
  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <AlertCircle className="text-red-500" size={48} />
        <p className="text-red-600 font-medium">{language === 'de' ? 'Fehler beim Laden der Daten' : 'Lỗi tải dữ liệu'}</p>
        <p className="text-gray-500 text-sm max-w-md text-center">{loadError}</p>
        <button
          onClick={() => loadData()}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <RefreshCw size={16} />
          {language === 'de' ? 'Erneut versuchen' : 'Thử lại'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans text-gray-900">
      {/* Floating save status indicator */}
      {saveStatus !== 'idle' && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
          saveStatus === 'saving' ? 'bg-blue-500 text-white' :
          saveStatus === 'saved' ? 'bg-green-500 text-white' :
          'bg-red-500 text-white'
        }`}>
          {saveStatus === 'saving' && <Loader2 className="animate-spin" size={16} />}
          {saveStatus === 'saving' && (language === 'de' ? 'Wird gespeichert...' : 'Đang lưu...')}
          {saveStatus === 'saved' && (language === 'de' ? '✓ Gespeichert' : '✓ Đã lưu')}
          {saveStatus === 'error' && (language === 'de' ? `✗ Fehler: ${saveMessage}` : `✗ Lỗi: ${saveMessage}`)}
        </div>
      )}
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{t('app.title')}</h1>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wider animate-pulse">
                {t('app.autoSaved')}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1 font-medium">{t('app.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
              <button
                onClick={() => setLanguage('vi')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  language === 'vi'
                    ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="text-base">🇻🇳</span>
                VN
              </button>
              <button
                onClick={() => setLanguage('de')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  language === 'de'
                    ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="text-base">🇩🇪</span>
                DE
              </button>
            </div>

            <button
              onClick={handlePdfExport}
              disabled={entries.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm"
            >
              <FileText size={16} />
              {t('app.exportPdf')}
            </button>

            <button
              onClick={handleExport}
              disabled={entries.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm"
            >
              <FileSpreadsheet size={16} />
              {t('app.exportExcel')}
            </button>

            {/* User info + Logout */}
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <span className="text-xs text-gray-500 hidden sm:block max-w-[150px] truncate" title={userEmail}>{userEmail}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title={language === 'de' ? 'Abmelden' : 'Đăng xuất'}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'staff' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <UserCheck size={18} />
            {t('tab.staff')}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Settings size={18} />
            {t('tab.settings')}
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Calendar size={18} />
            {t('tab.schedule')}
          </button>
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'daily' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <LayoutGrid size={18} />
            {t('tab.dailyOverview')}
          </button>
        </div>

        {/* Tab Content */}
        <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="animate-spin text-orange-500" size={32} /></div>}>
        <div className="space-y-6">
          {activeTab === 'staff' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <MasterDataForm data={masterData} onChange={handleMasterDataChange} />
              </div>
              <div className="lg:col-span-2">
                <StaffManagement employees={masterData.employees} onChange={handleEmployeesChange} />
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <RestaurantSettings
                config={masterData.restaurantConfig}
                onChange={handleConfigChange}
                onDownloadBackup={handleDownloadBackup}
                onUploadBackup={handleUploadBackup}
              />
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                <h3 className="text-blue-800 font-semibold mb-2">{t('settings.autoScheduleTitle')}</h3>
                <p className="text-blue-700 text-sm mb-4">{t('settings.autoScheduleDesc')}</p>
                <button
                  onClick={handleGenerateSchedule}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  {t('settings.generateSchedule')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-6">

              {/* ── Schedule Alerts Panel ── */}
              {scheduleAlerts.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-orange-200 overflow-hidden">
                  <button
                    onClick={() => setAlertsExpanded(!alertsExpanded)}
                    className="w-full flex items-center justify-between px-5 py-4 bg-orange-50 hover:bg-orange-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="text-orange-500" size={20} />
                      <span className="font-semibold text-orange-800">
                        {language === 'de'
                          ? `${scheduleAlerts.length} Planungshinweis${scheduleAlerts.length !== 1 ? 'e' : ''} gefunden`
                          : `Phát hiện ${scheduleAlerts.length} vấn đề trong lịch`}
                      </span>
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        {scheduleAlerts.filter(a => a.severity === 'error').length} {language === 'de' ? 'Fehler' : 'lỗi nghiêm trọng'}
                      </span>
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                        {scheduleAlerts.filter(a => a.severity === 'warning').length} {language === 'de' ? 'Warnungen' : 'cảnh báo'}
                      </span>
                    </div>
                    {alertsExpanded ? <ChevronUp size={18} className="text-orange-600" /> : <ChevronDown size={18} className="text-orange-600" />}
                  </button>

                  {/* Optimize Button */}
                  <div className="px-5 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200 flex items-center justify-between">
                    <p className="text-sm text-green-800 font-medium">
                      {language === 'de'
                        ? '🔧 Automatische Optimierung kann diese Probleme beheben'
                        : '🔧 Tối ưu tự động có thể khắc phục các vấn đề này'}
                    </p>
                    <button
                      onClick={handleOptimizeSchedule}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                    >
                      <Wrench size={16} />
                      {language === 'de' ? 'Zeitplan optimieren' : 'Tối ưu lịch'}
                    </button>
                  </div>

                  {alertsExpanded && (
                    <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                      {scheduleAlerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-3 px-5 py-3 ${
                            alert.severity === 'error' ? 'bg-red-50' : 'bg-yellow-50'
                          }`}
                        >
                          {alert.severity === 'error'
                            ? <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                            : <AlertTriangle size={16} className="text-yellow-600 mt-0.5 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs font-bold mr-2 ${
                              alert.severity === 'error' ? 'text-red-700' : 'text-yellow-700'
                            }`}>{alert.dateLabel}</span>
                            <span className={`text-sm ${
                              alert.severity === 'error' ? 'text-red-800' : 'text-yellow-800'
                            }`}>{alert.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {masterData.employees.length > 0 ? (
                <>
                  {/* ── Schedule Action Buttons ── */}
                  <div className="flex flex-wrap gap-2 p-3 bg-white rounded-lg shadow-sm border border-gray-200">
                    <button
                      onClick={handleGenerateSchedule}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Calendar size={16} />
                      {t('settings.generateSchedule')}
                    </button>
                    <button
                      onClick={handleCheckErrors}
                      disabled={entries.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors text-sm font-medium disabled:bg-gray-300"
                    >
                      <AlertTriangle size={16} />
                      {t('schedule.checkErrors')}
                    </button>
                    <button
                      onClick={handleOptimizeSchedule}
                      disabled={entries.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-sm font-medium disabled:bg-gray-300"
                    >
                      <Wrench size={16} />
                      {t('schedule.optimize')}
                    </button>
                    <button
                      onClick={handleCopyPreviousMonth}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      <RefreshCw size={16} />
                      {t('schedule.copyPrevMonth')}
                    </button>
                    <button
                      onClick={handlePrintWeek}
                      disabled={entries.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium disabled:bg-gray-300"
                    >
                      <FileSpreadsheet size={16} />
                      {t('schedule.printWeek')}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="text-sm font-medium text-gray-500">{t('schedule.selectEmployee')}</span>
                      {employeeAccuracies.length > 0 && (
                        <button
                          onClick={() => setOverviewExpanded(!overviewExpanded)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                        >
                          {overviewExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {t('schedule.toggleOverview')}
                        </button>
                      )}
                    </div>
                    {masterData.employees.map(emp => {
                      const acc = employeeAccuracies.find(a => a.employeeId === emp.id);
                      const pct = acc?.accuracy ?? 0;
                      const badge = pct >= 98 ? 'bg-green-100 text-green-700' : pct >= 95 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                      return (
                        <button
                          key={emp.id}
                          onClick={() => setSelectedEmployeeId(emp.id)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${selectedEmployeeId === emp.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          {emp.name}
                          {acc && entries.length > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedEmployeeId === emp.id ? 'bg-white/20 text-white' : badge}`}>
                              {pct}%
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Overview table (collapsible) ── */}
                  {overviewExpanded && employeeAccuracies.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                          <tr>
                            <th className="px-3 py-2 text-left">{t('staff.name')}</th>
                            <th className="px-3 py-2 text-right">{t('staff.hoursPerWeek')}</th>
                            <th className="px-3 py-2 text-right">{t('summary.targetHours')}</th>
                            <th className="px-3 py-2 text-right">{t('summary.actualHours')}</th>
                            <th className="px-3 py-2 text-right">{t('summary.difference')}</th>
                            <th className="px-3 py-2 text-center">%</th>
                            <th className="px-3 py-2 text-center">🌙</th>
                            <th className="px-3 py-2 text-center">☀️</th>
                            <th className="px-3 py-2 text-center">🎄</th>
                            <th className="px-3 py-2 text-center">U</th>
                            <th className="px-3 py-2 text-center">K</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {employeeAccuracies.map(a => {
                            const color = a.accuracy >= 98 ? 'text-green-600' : a.accuracy >= 95 ? 'text-yellow-600' : 'text-red-600';
                            return (
                              <tr key={a.employeeId} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedEmployeeId(a.employeeId)}>
                                <td className="px-3 py-2 font-medium">{a.name}</td>
                                <td className="px-3 py-2 text-right text-gray-500">{a.weeklyHours.toFixed(1)}</td>
                                <td className="px-3 py-2 text-right">{a.targetHours.toFixed(1)}</td>
                                <td className="px-3 py-2 text-right font-medium">{a.actualHours.toFixed(1)}</td>
                                <td className={`px-3 py-2 text-right font-medium ${a.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {a.difference >= 0 ? '+' : ''}{a.difference.toFixed(1)}
                                </td>
                                <td className={`px-3 py-2 text-center font-bold ${color}`}>{a.accuracy}%</td>
                                <td className="px-3 py-2 text-center text-violet-600 font-medium">{a.nightHours > 0 ? a.nightHours.toFixed(1) : '-'}</td>
                                <td className="px-3 py-2 text-center text-amber-600 font-medium">{a.sundayHours > 0 ? a.sundayHours.toFixed(1) : '-'}</td>
                                <td className="px-3 py-2 text-center text-red-600 font-medium">{a.holidayHours > 0 ? a.holidayHours.toFixed(1) : '-'}</td>
                                <td className="px-3 py-2 text-center text-gray-500">{a.vacationDays}</td>
                                <td className="px-3 py-2 text-center text-gray-500">{a.sickDays}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedEmployee ? (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-800">{t('schedule.timesheet')} {selectedEmployee.name}</h3>
                        <div className="text-sm text-gray-500">
                          {t('schedule.contract')} <span className="font-bold text-gray-900">{selectedEmployee.weeklyHours.toFixed(2).replace('.', ',')}{t('schedule.hPerWeek')}</span>
                        </div>
                      </div>
                      <MonthlySummary summary={summary} weeklyHours={selectedEmployee.weeklyHours} contractType={selectedEmployee.contractType} hourlyWage={selectedEmployee.hourlyWage} />
                      <DailyEntriesTable entries={calculatedEntries} onChange={handleEntryChange} onCopyPrevious={handleCopyPrevious} />
                    </div>
                  ) : (
                    <div className="bg-white p-12 rounded-lg border border-dashed border-gray-300 text-center text-gray-500">
                      {t('schedule.selectPrompt')}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white p-12 rounded-lg border border-dashed border-gray-300 text-center text-gray-500">
                  {t('schedule.noEmployees')}
                </div>
              )}
            </div>
          )}

          {activeTab === 'daily' && (
            <div className="p-4">
              <DailyOverview
                entries={entries}
                employees={masterData.employees}
                config={masterData.restaurantConfig}
                month={masterData.month}
                year={masterData.year}
                t={t}
                language={language}
              />
            </div>
          )}
        </div>
        </Suspense>
      </div>
    </div>
  );
}
