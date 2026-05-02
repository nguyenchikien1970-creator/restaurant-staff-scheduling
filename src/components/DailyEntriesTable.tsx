import { DailyEntry, AbsenceCode, CalculatedEntry } from "../types";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { de } from "date-fns/locale";
import { Copy } from "lucide-react";
import { useLanguage } from "../i18n";

interface Props {
  entries: CalculatedEntry[];
  onChange: (index: number, entry: DailyEntry) => void;
  onCopyPrevious: (index: number) => void;
}

const ABSENCE_CODE_KEYS: { value: AbsenceCode; key: string }[] = [
  { value: '', key: 'absence.none' },
  { value: 'K', key: 'absence.K' },
  { value: 'U', key: 'absence.U' },
  { value: 'UU', key: 'absence.UU' },
  { value: 'F', key: 'absence.F' },
  { value: 'SA', key: 'absence.SA' },
  { value: 'SU', key: 'absence.SU' },
];

export function DailyEntriesTable({ entries, onChange, onCopyPrevious }: Props) {
  const { language, t } = useLanguage();
  const dateLocale = language === 'de' ? de : vi;

  if (entries.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500">
        {t('daily.noData')}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider w-32">{t('daily.date')}</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider w-24">{t('daily.start')}</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider w-24">{t('daily.break')}</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider w-24">{t('daily.end')}</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider w-24">{t('daily.total')}</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider w-32">{t('daily.status')}</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">{t('daily.remark')}</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider w-10"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry, index) => {
              const dateObj = new Date(entry.date);
              const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
              const isFullAbsence = ['K', 'U', 'UU', 'F'].includes(entry.absenceCode);
              const hasErrors = entry.warnings.some(w => w.includes('over10h') || w.includes('restUnder11h'));
              const hasWarnings = entry.warnings.length > 0;
              const rowBg = hasErrors ? 'bg-red-50' : hasWarnings ? 'bg-yellow-50' : isWeekend ? 'bg-gray-50' : '';

              return (
                <tr key={entry.date} className={`${rowBg} hover:bg-blue-50 transition-colors`}>
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                    {format(dateObj, 'EE, dd.MM.', { locale: dateLocale })}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input type="time"
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-1 border disabled:bg-gray-100 disabled:text-gray-400"
                      value={entry.startTime}
                      onChange={(e) => onChange(index, { ...entry, startTime: e.target.value })}
                      disabled={isFullAbsence} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input type="number" min="0" step="5"
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-1 border disabled:bg-gray-100 disabled:text-gray-400"
                      value={entry.pauseMinutes}
                      onChange={(e) => onChange(index, { ...entry, pauseMinutes: Number(e.target.value) })}
                      disabled={isFullAbsence} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input type="time"
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-1 border disabled:bg-gray-100 disabled:text-gray-400"
                      value={entry.endTime}
                      onChange={(e) => onChange(index, { ...entry, endTime: e.target.value })}
                      disabled={isFullAbsence} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono font-medium">
                    {entry.durationTime}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <select
                        className={`flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-1 border ${entry.absenceCode ? 'bg-yellow-50 font-medium' : ''}`}
                        value={entry.absenceCode}
                        onChange={(e) => onChange(index, { ...entry, absenceCode: e.target.value as AbsenceCode })}
                      >
                        {ABSENCE_CODE_KEYS.map(c => (
                          <option key={c.value} value={c.value}>{t(c.key)}</option>
                        ))}
                      </select>
                      <div className="flex gap-0.5">
                        {([
                          { code: 'K' as AbsenceCode, color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200', label: 'K' },
                          { code: 'U' as AbsenceCode, color: 'bg-green-100 text-green-700 hover:bg-green-200', label: 'U' },
                          { code: 'UU' as AbsenceCode, color: 'bg-orange-100 text-orange-700 hover:bg-orange-200', label: 'UU' },
                          { code: 'F' as AbsenceCode, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200', label: 'F' },
                        ]).map(({ code, color, label }) => (
                          <button key={code} type="button"
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${entry.absenceCode === code ? 'ring-2 ring-offset-1 ring-blue-400 ' + color : color + ' opacity-60'}`}
                            onClick={() => {
                              if (entry.absenceCode === code) {
                                onChange(index, { ...entry, absenceCode: '' as AbsenceCode, remark: '' });
                              } else {
                                onChange(index, { ...entry, absenceCode: code, startTime: '', endTime: '', pauseMinutes: 0, remark: t(`absence.${code}`) });
                              }
                            }}
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <input type="text"
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-1 border"
                        value={entry.remark}
                        onChange={(e) => onChange(index, { ...entry, remark: e.target.value })}
                        placeholder={t('daily.remarkPlaceholder')} />
                      {entry.warnings.length > 0 && (
                        <div className="text-xs font-medium flex items-center gap-1">
                          <span className={hasErrors ? 'text-red-600' : 'text-amber-600'}>⚠</span>
                          <span className={hasErrors ? 'text-red-600' : 'text-amber-600'}>
                            {entry.warnings.map(w => t(w)).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    {index > 0 && (
                      <button onClick={() => onCopyPrevious(index)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title={t('daily.copyPrevious')}>
                        <Copy size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
