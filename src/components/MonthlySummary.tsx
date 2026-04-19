import { MonthlySummaryData } from "../types";
import { useLanguage } from "../i18n";

interface Props {
  summary: MonthlySummaryData;
  weeklyHours: number;
}

export function MonthlySummary({ summary, weeklyHours }: Props) {
  const { t } = useLanguage();
  const targetMonthlyHours = weeklyHours * 4.33;
  const diff = summary.totalNormalHours - targetMonthlyHours;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">{t('summary.title')}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
          <div className="text-sm text-blue-600 font-medium mb-1">{t('summary.actualHours')}</div>
          <div className="text-2xl font-bold text-blue-900">{summary.totalNormalHours.toFixed(2)} h</div>
        </div>
        <div className="bg-indigo-50 p-4 rounded-md border border-indigo-100">
          <div className="text-sm text-indigo-600 font-medium mb-1">{t('summary.targetHours')}</div>
          <div className="text-2xl font-bold text-indigo-900">{targetMonthlyHours.toFixed(2)} h</div>
        </div>
        <div className={`p-4 rounded-md border ${diff >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
          <div className={`text-sm font-medium mb-1 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{t('summary.difference')}</div>
          <div className={`text-2xl font-bold ${diff >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
            {diff >= 0 ? '+' : ''}{diff.toFixed(2)} h
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
          <div className="text-sm text-gray-600 font-medium mb-1">{t('summary.workedDays')}</div>
          <div className="text-2xl font-bold text-gray-900">{summary.workedDays}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-md border border-yellow-100">
          <div className="text-sm text-yellow-700 font-medium mb-1">{t('summary.sickDays')}</div>
          <div className="text-2xl font-bold text-yellow-900">{summary.totalK}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-md border border-green-100">
          <div className="text-sm text-green-700 font-medium mb-1">{t('summary.vacationDays')}</div>
          <div className="text-2xl font-bold text-green-900">{summary.totalU}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-md border border-purple-100">
          <div className="text-sm text-purple-700 font-medium mb-1">{t('summary.holidays')}</div>
          <div className="text-2xl font-bold text-purple-900">{summary.totalF}</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-md border border-orange-100">
          <div className="text-sm text-orange-700 font-medium mb-1">{t('summary.unpaidLeave')}</div>
          <div className="text-2xl font-bold text-orange-900">{summary.totalUU}</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
          <div className="text-sm text-gray-600 font-medium mb-1">{t('summary.totalBreak')}</div>
          <div className="text-2xl font-bold text-gray-900">{summary.totalBreakMinutes} {t('summary.minutes')}</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
          <div className="text-sm text-gray-600 font-medium mb-1">{t('summary.calendarDays')}</div>
          <div className="text-2xl font-bold text-gray-900">{summary.calendarDays}</div>
        </div>
      </div>
    </div>
  );
}
