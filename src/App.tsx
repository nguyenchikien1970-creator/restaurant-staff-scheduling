import { useState, useEffect } from 'react';
import { MasterData, DailyEntry, CalculatedEntry, MonthlySummaryData, Employee, RestaurantConfig } from './types';
import { generateMonthDates, processEntries, calculateSummary, exportToExcel, generateSmartSchedule, analyzeScheduleWarnings, optimizeSchedule, ScheduleAlert } from './lib/utils';
import { MasterDataForm } from './components/MasterDataForm';
import { DailyEntriesTable } from './components/DailyEntriesTable';
import { MonthlySummary } from './components/MonthlySummary';
import { StaffManagement } from './components/StaffManagement';
import { RestaurantSettings } from './components/RestaurantSettings';
import { LoginPage, getStoredAuth, clearAuth } from './components/LoginPage';
import { FileSpreadsheet, Calendar, UserCheck, Settings, Globe, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, LogOut, Wrench } from 'lucide-react';
import { useLanguage } from './i18n';

const STORAGE_KEY = 'arbeitszeit_data_v2';

export default function App() {
  const { language, setLanguage, t } = useLanguage();

  // ── Auth state ──
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!getStoredAuth());
  const [userEmail, setUserEmail] = useState(() => getStoredAuth()?.email ?? '');

  const handleLogin = (email: string) => {
    setIsLoggedIn(true);
    setUserEmail(email);
  };

  const handleLogout = () => {
    clearAuth();
    setIsLoggedIn(false);
    setUserEmail('');
  };

  const [masterData, setMasterData] = useState<MasterData>({
    companyName: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    restaurantConfig: { openTime: '12:00', closeTime: '23:00', minStaff: 1, closedDays: [] },
    employees: []
  });

  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'staff' | 'settings' | 'schedule'>('staff');
  const [scheduleAlerts, setScheduleAlerts] = useState<ScheduleAlert[]>([]);
  const [alertsExpanded, setAlertsExpanded] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.masterData) setMasterData(parsed.masterData);
        if (parsed.entries) setEntries(parsed.entries);
      } catch (e) { console.error("Failed to load saved data", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ masterData, entries }));
  }, [masterData, entries]);

  const handleMasterDataChange = (newData: MasterData) => setMasterData(newData);

  const handleEmployeesChange = (employees: Employee[]) => {
    setMasterData(prev => ({ ...prev, employees }));
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
    const optimizedEntries = optimizeSchedule(
      entries, masterData.employees, masterData.restaurantConfig, t, language
    );
    setEntries(optimizedEntries);
    // Re-analyze after optimization
    const newAlerts = analyzeScheduleWarnings(
      optimizedEntries, masterData.employees, masterData.restaurantConfig, t, language
    );
    setScheduleAlerts(newAlerts);
    setAlertsExpanded(true);
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
      localStorage.removeItem(STORAGE_KEY);
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

  const selectedEmployee = masterData.employees.find(e => e.id === selectedEmployeeId);
  const currentEmployeeEntries = entries.filter(e => e.employeeId === selectedEmployeeId);
  const calculatedEntries = processEntries(currentEmployeeEntries);
  const summary = calculateSummary(calculatedEntries);

  // ── Login gate ──
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans text-gray-900">
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
        </div>

        {/* Tab Content */}
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
                  <div className="flex flex-wrap gap-2 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                    <span className="text-sm font-medium text-gray-500 w-full mb-2">{t('schedule.selectEmployee')}</span>
                    {masterData.employees.map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedEmployeeId === emp.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {emp.name}
                      </button>
                    ))}
                  </div>

                  {selectedEmployee ? (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-800">{t('schedule.timesheet')} {selectedEmployee.name}</h3>
                        <div className="text-sm text-gray-500">
                          {t('schedule.contract')} <span className="font-bold text-gray-900">{selectedEmployee.weeklyHours.toFixed(2).replace('.', ',')}{t('schedule.hPerWeek')}</span>
                        </div>
                      </div>
                      <MonthlySummary summary={summary} weeklyHours={selectedEmployee.weeklyHours} />
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
        </div>
      </div>
    </div>
  );
}
