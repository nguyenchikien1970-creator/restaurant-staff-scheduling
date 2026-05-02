import React, { useRef, useState, useEffect } from 'react';
import { RestaurantConfig, DayScheduleConfig } from '../types';
import { Clock, Users, Download, Upload, Database, BedDouble, Save, CheckCircle } from 'lucide-react';
import { useLanguage } from '../i18n';
import { BUNDESLAENDER, BUNDESLAND_NAMES } from '../lib/utils';

interface RestaurantSettingsProps {
  config: RestaurantConfig;
  onChange: (config: RestaurantConfig) => void;
  onDownloadBackup: () => void;
  onUploadBackup: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const DAYS_OF_WEEK = [
  { dow: 1, viLabel: 'Thứ 2', deLabel: 'Montag', short: 'Mo' },
  { dow: 2, viLabel: 'Thứ 3', deLabel: 'Dienstag', short: 'Di' },
  { dow: 3, viLabel: 'Thứ 4', deLabel: 'Mittwoch', short: 'Mi' },
  { dow: 4, viLabel: 'Thứ 5', deLabel: 'Donnerstag', short: 'Do' },
  { dow: 5, viLabel: 'Thứ 6', deLabel: 'Freitag', short: 'Fr' },
  { dow: 6, viLabel: 'Thứ 7', deLabel: 'Samstag', short: 'Sa' },
  { dow: 0, viLabel: 'CN', deLabel: 'Sonntag', short: 'So' },
];

function getDefaultDaySchedule(config: RestaurantConfig, dow: number): DayScheduleConfig {
  const isClosed = (config.closedDays ?? []).includes(dow);
  return {
    closed: isClosed,
    openTime: config.openTime,
    closeTime: config.closeTime,
  };
}

function getDaySchedule(config: RestaurantConfig, dow: number): DayScheduleConfig {
  if (config.daySchedules && config.daySchedules[dow]) {
    return config.daySchedules[dow];
  }
  return getDefaultDaySchedule(config, dow);
}

export function RestaurantSettings({ config, onChange, onDownloadBackup, onUploadBackup }: RestaurantSettingsProps) {
  const { t, language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local draft state for per-day editing
  const [draftSchedules, setDraftSchedules] = useState<Record<number, DayScheduleConfig>>(() => {
    const initial: Record<number, DayScheduleConfig> = {};
    DAYS_OF_WEEK.forEach(({ dow }) => {
      initial[dow] = getDaySchedule(config, dow);
    });
    return initial;
  });

  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync draft from config when config changes externally (e.g. backup restore)
  useEffect(() => {
    const newDraft: Record<number, DayScheduleConfig> = {};
    DAYS_OF_WEEK.forEach(({ dow }) => {
      newDraft[dow] = getDaySchedule(config, dow);
    });
    setDraftSchedules(newDraft);
    setHasChanges(false);
  }, [config.daySchedules, config.closedDays, config.openTime, config.closeTime]);

  const handleDayChange = (dow: number, field: keyof DayScheduleConfig, value: any) => {
    setDraftSchedules(prev => ({
      ...prev,
      [dow]: { ...prev[dow], [field]: value },
    }));
    setHasChanges(true);
    setSaved(false);
  };

  const handleToggleClosed = (dow: number) => {
    setDraftSchedules(prev => ({
      ...prev,
      [dow]: { ...prev[dow], closed: !prev[dow].closed },
    }));
    setHasChanges(true);
    setSaved(false);
  };

  const handleSave = () => {
    // Build closedDays array from draft
    const closedDays = DAYS_OF_WEEK
      .filter(({ dow }) => draftSchedules[dow]?.closed)
      .map(({ dow }) => dow);

    // Determine the "default" open/close from the first non-closed day, or keep existing
    const firstOpen = DAYS_OF_WEEK.find(({ dow }) => !draftSchedules[dow]?.closed);
    const defaultOpen = firstOpen ? draftSchedules[firstOpen.dow].openTime : config.openTime;
    const defaultClose = firstOpen ? draftSchedules[firstOpen.dow].closeTime : config.closeTime;

    onChange({
      ...config,
      openTime: defaultOpen,
      closeTime: defaultClose,
      closedDays,
      daySchedules: { ...draftSchedules },
    });
    setSaved(true);
    setHasChanges(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleGlobalChange = (field: keyof RestaurantConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const closedCount = DAYS_OF_WEEK.filter(({ dow }) => draftSchedules[dow]?.closed).length;

  return (
    <div className="space-y-6">
      {/* ── General Settings ── */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="text-orange-600" size={20} />
          <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
              {language === 'de' ? 'Standard-Öffnungszeit' : 'Giờ mở cửa mặc định'}
            </label>
            <input type="time" value={config.openTime} onChange={(e) => handleGlobalChange('openTime', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
              {language === 'de' ? 'Standard-Schließzeit' : 'Giờ đóng cửa mặc định'}
            </label>
            <input type="time" value={config.closeTime} onChange={(e) => handleGlobalChange('closeTime', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t('settings.minStaff')}</label>
            <div className="flex items-center gap-2">
              <Users size={16} className="text-gray-400" />
              <input type="number" min="1" max="10" value={config.minStaff}
                onChange={(e) => handleGlobalChange('minStaff', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t('settings.bundesland')}</label>
            <select value={config.bundesland || ''}
              onChange={(e) => handleGlobalChange('bundesland', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm">
              <option value="">{t('settings.selectBundesland')}</option>
              {BUNDESLAENDER.map(bl => (
                <option key={bl} value={bl}>{BUNDESLAND_NAMES[bl]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Headcount per time slot ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t('settings.lunchPeak')}</label>
            <input type="number" min="1" max="12"
              value={config.lunchPeakHeadcount ?? (config.minStaff + 2)}
              onChange={(e) => handleGlobalChange('lunchPeakHeadcount', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t('settings.dinnerPeak')}</label>
            <input type="number" min="1" max="12"
              value={config.dinnerPeakHeadcount ?? (config.minStaff + 2)}
              onChange={(e) => handleGlobalChange('dinnerPeakHeadcount', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t('settings.baseline')}</label>
            <input type="number" min="1" max="10"
              value={config.baselineHeadcount ?? config.minStaff}
              onChange={(e) => handleGlobalChange('baselineHeadcount', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t('settings.closing')}</label>
            <input type="number" min="1" max="6"
              value={config.closingHeadcount ?? 2}
              onChange={(e) => handleGlobalChange('closingHeadcount', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm" />
          </div>
        </div>

        {/* ── Busy Days & Peak Hours ── */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            🔥 {language === 'de' ? 'Stoßzeiten & Busy Days' : 'Ngày & Giờ Đông Khách'}
          </h3>

          {/* Busy days selection */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
              {language === 'de' ? 'Tage mit den meisten Gästen (klicken)' : 'Ngày đông khách nhất (bấm chọn)'}
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map(({ dow, viLabel, deLabel, short }) => {
                const isBusy = (config.busyDays || []).includes(dow);
                const isClosed = draftSchedules[dow]?.closed;
                return (
                  <button
                    key={dow}
                    type="button"
                    disabled={isClosed}
                    onClick={() => {
                      const current = config.busyDays || [];
                      const next = isBusy ? current.filter(d => d !== dow) : [...current, dow];
                      handleGlobalChange('busyDays', next);
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border ${
                      isClosed
                        ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'
                        : isBusy
                          ? 'bg-red-500 text-white border-red-500 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-red-300 hover:bg-red-50'
                    }`}
                  >
                    {short} {isBusy && '🔥'}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {language === 'de'
                ? 'An Busy Days werden mehr Mitarbeiter eingeplant.'
                : 'Ngày đông khách sẽ được xếp nhiều nhân viên hơn.'}
            </p>
          </div>

          {/* Peak hours config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lunch peak */}
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
              <label className="block text-xs font-bold text-orange-700 uppercase mb-2">
                🍽 {language === 'de' ? 'Mittagsstoßzeit' : 'Giờ cao điểm trưa'}
              </label>
              <div className="flex items-center gap-2">
                <input type="time" value={config.lunchPeakStart || '12:00'}
                  onChange={(e) => handleGlobalChange('lunchPeakStart', e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-orange-200 rounded text-sm outline-none focus:ring-1 focus:ring-orange-400" />
                <span className="text-gray-400 text-sm">→</span>
                <input type="time" value={config.lunchPeakEnd || '15:00'}
                  onChange={(e) => handleGlobalChange('lunchPeakEnd', e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-orange-200 rounded text-sm outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
            </div>

            {/* Dinner peak */}
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
              <label className="block text-xs font-bold text-purple-700 uppercase mb-2">
                🌙 {language === 'de' ? 'Abendstoßzeit' : 'Giờ cao điểm tối'}
              </label>
              <div className="flex items-center gap-2">
                <input type="time" value={config.dinnerPeakStart || '18:00'}
                  onChange={(e) => handleGlobalChange('dinnerPeakStart', e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-purple-200 rounded text-sm outline-none focus:ring-1 focus:ring-purple-400" />
                <span className="text-gray-400 text-sm">→</span>
                <input type="time" value={config.dinnerPeakEnd || '21:00'}
                  onChange={(e) => handleGlobalChange('dinnerPeakEnd', e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-purple-200 rounded text-sm outline-none focus:ring-1 focus:ring-purple-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Per-Day Schedule Configuration ── */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BedDouble size={20} className="text-red-500" />
            <h2 className="text-lg font-semibold">
              {language === 'de' ? 'Wochenplan — Ruhetage & Öffnungszeiten' : 'Lịch tuần — Ngày nghỉ & Giờ mở cửa'}
            </h2>
          </div>
          {closedCount > 0 && (
            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full font-medium">
              🔴 {closedCount} {language === 'de' ? 'Ruhetag(e)' : 'ngày nghỉ'}
            </span>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {language === 'de'
            ? 'Klicken Sie auf einen Tag, um ihn als Ruhetag zu markieren. Passen Sie die Öffnungszeiten pro Tag an.'
            : 'Nhấn vào ngày để đánh dấu nghỉ. Tuỳ chỉnh giờ mở/đóng cửa cho từng ngày.'}
        </p>

        <div className="space-y-2">
          {/* Header */}
          <div className="hidden md:grid md:grid-cols-[180px_100px_1fr_1fr] gap-3 px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
            <div>{language === 'de' ? 'Wochentag' : 'Ngày'}</div>
            <div className="text-center">{language === 'de' ? 'Ruhetag' : 'Nghỉ'}</div>
            <div>{language === 'de' ? 'Öffnungszeit' : 'Giờ mở cửa'}</div>
            <div>{language === 'de' ? 'Schließzeit' : 'Giờ đóng cửa'}</div>
          </div>

          {/* Day Rows */}
          {DAYS_OF_WEEK.map(({ dow, viLabel, deLabel, short }) => {
            const schedule = draftSchedules[dow];
            const isClosed = schedule?.closed ?? false;
            const label = language === 'de' ? deLabel : viLabel;

            return (
              <div
                key={dow}
                className={`grid grid-cols-1 md:grid-cols-[180px_100px_1fr_1fr] gap-3 px-3 py-3 rounded-lg border transition-all ${
                  isClosed
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-100 hover:border-orange-200'
                }`}
              >
                {/* Day Name */}
                <div className="flex items-center gap-2">
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                    isClosed
                      ? 'bg-red-500 text-white'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {short}
                  </span>
                  <span className={`font-medium text-sm ${isClosed ? 'text-red-700' : 'text-gray-800'}`}>
                    {label}
                  </span>
                </div>

                {/* Ruhetag Toggle */}
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleToggleClosed(dow)}
                    className={`relative w-14 h-7 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                      isClosed
                        ? 'bg-red-500 focus:ring-red-400'
                        : 'bg-gray-300 focus:ring-orange-400'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
                        isClosed ? 'translate-x-7' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Open Time */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 md:hidden">
                    {language === 'de' ? 'Öffnungszeit' : 'Giờ mở cửa'}
                  </label>
                  <input
                    type="time"
                    value={schedule?.openTime ?? config.openTime}
                    onChange={(e) => handleDayChange(dow, 'openTime', e.target.value)}
                    disabled={isClosed}
                    className={`w-full px-3 py-2 border rounded-md text-sm outline-none transition-colors ${
                      isClosed
                        ? 'bg-red-100 border-red-200 text-red-300 cursor-not-allowed'
                        : 'border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                    }`}
                  />
                </div>

                {/* Close Time */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 md:hidden">
                    {language === 'de' ? 'Schließzeit' : 'Giờ đóng cửa'}
                  </label>
                  <input
                    type="time"
                    value={schedule?.closeTime ?? config.closeTime}
                    onChange={(e) => handleDayChange(dow, 'closeTime', e.target.value)}
                    disabled={isClosed}
                    className={`w-full px-3 py-2 border rounded-md text-sm outline-none transition-colors ${
                      isClosed
                        ? 'bg-red-100 border-red-200 text-red-300 cursor-not-allowed'
                        : 'border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Save Button */}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${
              hasChanges
                ? 'bg-orange-600 text-white hover:bg-orange-700 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save size={16} />
            {language === 'de' ? 'Wochenplan speichern' : 'Lưu lịch tuần'}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium animate-pulse">
              <CheckCircle size={16} />
              {language === 'de' ? 'Gespeichert!' : 'Đã lưu!'}
            </span>
          )}
          {hasChanges && !saved && (
            <span className="text-xs text-orange-500 italic">
              {language === 'de' ? '(Ungespeicherte Änderungen)' : '(Có thay đổi chưa lưu)'}
            </span>
          )}
        </div>
      </div>

      {/* ── Backup Section ── */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Database className="text-purple-600" size={20} />
          <h2 className="text-lg font-semibold">{t('settings.backupTitle')}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">{t('settings.backupDesc')}</p>

        <div className="flex flex-wrap gap-4">
          <button onClick={onDownloadBackup}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm">
            <Download size={16} />
            {t('settings.downloadBackup')}
          </button>

          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
            <Upload size={16} />
            {t('settings.uploadBackup')}
          </button>

          <input type="file" ref={fileInputRef} onChange={onUploadBackup} accept=".json" className="hidden" />
        </div>
      </div>
    </div>
  );
}
