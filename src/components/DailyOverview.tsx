import React, { useState, useMemo } from 'react';
import { DailyEntry, Employee, RestaurantConfig } from '../types';
import { generateMonthDates, getGermanHolidays, isDayClosed } from '../lib/utils';
import { ChevronLeft, ChevronRight, Users, Clock, Coffee, Calendar } from 'lucide-react';

type TranslateFn = (key: string) => string;

interface DailyOverviewProps {
  entries: DailyEntry[];
  employees: Employee[];
  config: RestaurantConfig;
  month: number;
  year: number;
  t: TranslateFn;
  language: 'vi' | 'de';
}

const DAY_LABELS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_LABELS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function DailyOverview({ entries, employees, config, month, year, t, language }: DailyOverviewProps) {
  const dates = useMemo(() => generateMonthDates(month, year), [month, year]);
  const holidays = useMemo(() => getGermanHolidays(year, config.bundesland), [year, config.bundesland]);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const dayLabels = language === 'de' ? DAY_LABELS_DE : DAY_LABELS_VI;

  const activeEmployees = employees.filter(e => e.isActive !== false);

  // Build day data
  const dayData = useMemo(() => {
    return dates.map(dateStr => {
      const dateObj = new Date(dateStr);
      const dow = dateObj.getDay();
      const isClosed = isDayClosed(config, dow);
      const isHoliday = holidays.has(dateStr);

      const dayEntries = entries.filter(e => e.date === dateStr);
      const working = dayEntries.filter(e => e.startTime && e.endTime && !['K', 'U', 'UU', 'F'].includes(e.absenceCode));
      const absent = dayEntries.filter(e => ['K', 'U', 'UU', 'F'].includes(e.absenceCode));

      return { dateStr, dateObj, dow, isClosed, isHoliday, dayEntries, working, absent };
    });
  }, [dates, entries, config.closedDays, config.daySchedules, holidays]);

  const selected = dayData[selectedDateIdx];

  // Navigate
  const goPrev = () => setSelectedDateIdx(Math.max(0, selectedDateIdx - 1));
  const goNext = () => setSelectedDateIdx(Math.min(dates.length - 1, selectedDateIdx + 1));

  // Compute total hours for a day
  const computeHours = (entry: DailyEntry): number => {
    if (!entry.startTime || !entry.endTime) return 0;
    const [sh, sm] = entry.startTime.split(':').map(Number);
    const [eh, em] = entry.endTime.split(':').map(Number);
    const gross = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(0, (gross - (entry.pauseMinutes || 0)) / 60);
  };

  // Get employee name by id
  const empName = (id: string) => activeEmployees.find(e => e.id === id)?.name || id;

  return (
    <div className="space-y-4">
      {/* ── Mini Calendar Grid ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
          <Calendar size={16} />
          {language === 'de' ? `Tagesübersicht — ${month}/${year}` : `Lịch tổng quát — Tháng ${month}/${year}`}
        </h3>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {dayLabels.map(d => (
            <div key={d} className="font-bold text-gray-500 py-1">{d}</div>
          ))}
          {/* padding for first day */}
          {Array.from({ length: dayData[0]?.dow || 0 }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {dayData.map((day, idx) => {
            const workCount = day.working.length;
            const isSelected = idx === selectedDateIdx;
            let bg = 'bg-white hover:bg-blue-50 cursor-pointer';
            if (day.isClosed) bg = 'bg-gray-100 text-gray-400';
            else if (workCount === 0) bg = 'bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer';
            else if (workCount < (config.minStaff || 1)) bg = 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 cursor-pointer';
            else bg = 'bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer';
            if (isSelected) bg = 'bg-blue-600 text-white';

            return (
              <button
                key={day.dateStr}
                onClick={() => setSelectedDateIdx(idx)}
                className={`rounded-lg py-1.5 text-xs font-medium transition-all ${bg} ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
              >
                <div>{day.dateObj.getDate()}</div>
                {!day.isClosed && !isSelected && (
                  <div className="text-[9px] mt-0.5 opacity-75">
                    {workCount > 0 ? `${workCount}👤` : '—'}
                  </div>
                )}
                {day.isHoliday && <div className="text-[8px]">🇩🇪</div>}
              </button>
            );
          })}
        </div>
        <div className="flex justify-center gap-3 mt-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span> {language === 'de' ? 'Besetzt' : 'Đủ người'}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></span> {language === 'de' ? 'Wenig' : 'Ít người'}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300"></span> {language === 'de' ? 'Keine' : 'Không có ai'}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-300"></span> {language === 'de' ? 'Geschlossen' : 'Đóng cửa'}</span>
        </div>
      </div>

      {/* ── Selected Day Detail ── */}
      {selected && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header with nav */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <button onClick={goPrev} disabled={selectedDateIdx === 0} className="p-1.5 rounded-lg hover:bg-white/60 disabled:opacity-30 transition">
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-800">
                {dayLabels[selected.dow]}, {selected.dateObj.getDate()}.{month}.{year}
              </div>
              <div className="text-xs text-gray-500">
                {selected.isClosed
                  ? (language === 'de' ? '🔒 Geschlossen (Ruhetag)' : '🔒 Đóng cửa (Ruhetag)')
                  : selected.isHoliday
                    ? (language === 'de' ? '🇩🇪 Feiertag' : '🇩🇪 Ngày lễ (Feiertag)')
                    : `${selected.working.length} ${language === 'de' ? 'Mitarbeiter' : 'nhân viên'}`
                }
              </div>
            </div>
            <button onClick={goNext} disabled={selectedDateIdx === dates.length - 1} className="p-1.5 rounded-lg hover:bg-white/60 disabled:opacity-30 transition">
              <ChevronRight size={20} />
            </button>
          </div>

          {selected.isClosed ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {language === 'de' ? 'Restaurant geschlossen' : 'Nhà hàng đóng cửa'}
            </div>
          ) : (
            <div className="p-4">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                  <Users size={16} className="mx-auto text-green-600 mb-1" />
                  <div className="text-xl font-bold text-green-700">{selected.working.length}</div>
                  <div className="text-[10px] text-green-600">{language === 'de' ? 'Anwesend' : 'Đi làm'}</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
                  <Coffee size={16} className="mx-auto text-orange-600 mb-1" />
                  <div className="text-xl font-bold text-orange-700">{selected.absent.length}</div>
                  <div className="text-[10px] text-orange-600">{language === 'de' ? 'Abwesend' : 'Vắng mặt'}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                  <Clock size={16} className="mx-auto text-blue-600 mb-1" />
                  <div className="text-xl font-bold text-blue-700">
                    {selected.working.reduce((sum, e) => sum + computeHours(e), 0).toFixed(1)}h
                  </div>
                  <div className="text-[10px] text-blue-600">{language === 'de' ? 'Gesamt' : 'Tổng giờ'}</div>
                </div>
              </div>

              {/* Working employees table */}
              {selected.working.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-green-700 uppercase mb-2 flex items-center gap-1">
                    <Users size={12} /> {language === 'de' ? 'Anwesende Mitarbeiter' : 'Nhân viên đi làm'}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-green-50 text-green-800">
                          <th className="text-left px-3 py-2 rounded-tl-lg">{language === 'de' ? 'Name' : 'Tên'}</th>
                          <th className="text-center px-3 py-2">{language === 'de' ? 'Beginn' : 'Bắt đầu'}</th>
                          <th className="text-center px-3 py-2">{language === 'de' ? 'Pause' : 'Nghỉ'}</th>
                          <th className="text-center px-3 py-2">{language === 'de' ? 'Ende' : 'Kết thúc'}</th>
                          <th className="text-center px-3 py-2 rounded-tr-lg">{language === 'de' ? 'Netto' : 'Giờ NET'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.working
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map((entry, i) => (
                          <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="px-3 py-2 font-medium text-gray-800">{empName(entry.employeeId)}</td>
                            <td className="px-3 py-2 text-center font-mono text-blue-600">{entry.startTime}</td>
                            <td className="px-3 py-2 text-center text-gray-500">{entry.pauseMinutes > 0 ? `${entry.pauseMinutes}′` : '—'}</td>
                            <td className="px-3 py-2 text-center font-mono text-blue-600">{entry.endTime}</td>
                            <td className="px-3 py-2 text-center font-bold">{computeHours(entry).toFixed(1)}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Absent employees */}
              {selected.absent.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-orange-700 uppercase mb-2 flex items-center gap-1">
                    <Coffee size={12} /> {language === 'de' ? 'Abwesende Mitarbeiter' : 'Nhân viên vắng mặt'}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selected.absent.map((entry, i) => {
                      const codeColors: Record<string, string> = {
                        K: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                        U: 'bg-green-100 text-green-800 border-green-200',
                        UU: 'bg-orange-100 text-orange-800 border-orange-200',
                        F: 'bg-purple-100 text-purple-800 border-purple-200',
                      };
                      return (
                        <span key={i} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border ${codeColors[entry.absenceCode] || 'bg-gray-100 text-gray-700'}`}>
                          {empName(entry.employeeId)}
                          <span className="font-bold">({entry.absenceCode})</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Timeline visualization */}
              {selected.working.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                    <Clock size={12} /> {language === 'de' ? 'Zeitleiste' : 'Timeline'}
                  </h4>
                  <div className="space-y-1.5">
                    {selected.working
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((entry, i) => {
                      const openH = parseInt(config.openTime?.split(':')[0] || '10');
                      const closeH = parseInt(config.closeTime?.split(':')[0] || '23') + 1;
                      const totalSpan = (closeH - openH) * 60;
                      const [sh, sm] = entry.startTime.split(':').map(Number);
                      const [eh, em] = entry.endTime.split(':').map(Number);
                      const startMin = (sh * 60 + sm) - openH * 60;
                      const endMin = (eh * 60 + em) - openH * 60;
                      const left = Math.max(0, (startMin / totalSpan) * 100);
                      const width = Math.max(2, ((endMin - startMin) / totalSpan) * 100);
                      const colors = ['bg-blue-400', 'bg-emerald-400', 'bg-violet-400', 'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-pink-400', 'bg-teal-400'];

                      return (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-28 text-xs text-gray-600 font-medium truncate text-right">{empName(entry.employeeId).split(' ').pop()}</div>
                          <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                            <div
                              className={`absolute h-full rounded-full ${colors[i % colors.length]} opacity-80`}
                              style={{ left: `${left}%`, width: `${width}%` }}
                            >
                              <span className="text-[9px] text-white font-bold px-1 truncate block leading-5">
                                {entry.startTime}–{entry.endTime}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Time axis */}
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-28" />
                      <div className="flex-1 flex justify-between text-[9px] text-gray-400 px-0.5">
                        {Array.from({ length: Math.min(12, parseInt(config.closeTime?.split(':')[0] || '23') - parseInt(config.openTime?.split(':')[0] || '10') + 1) }).map((_, i) => (
                          <span key={i}>{parseInt(config.openTime?.split(':')[0] || '10') + i}h</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

