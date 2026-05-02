import React, { useState } from 'react';
import { Employee, ContractType, deriveContractType } from '../types';
import { Plus, Trash2, Users } from 'lucide-react';
import { useLanguage } from '../i18n';

interface StaffManagementProps {
  employees: Employee[];
  onChange: (employees: Employee[]) => void;
}

/** Format a number to 2 decimal places using comma as separator (German style) */
function formatDecimalComma(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/** Parse a comma‑separated decimal string back to number */
function parseDecimalComma(str: string): number {
  // Accept both comma and dot
  const normalized = str.replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

export function StaffManagement({ employees, onChange }: StaffManagementProps) {
  const { t, language } = useLanguage();
  const [newName, setNewName] = useState('');
  const [newPersonnelNumber, setNewPersonnelNumber] = useState('');
  const [newHoursStr, setNewHoursStr] = useState('40,00');
  const [newContractType, setNewContractType] = useState<ContractType | ''>('');

  const addEmployee = () => {
    if (!newName) return;
    const hours = parseDecimalComma(newHoursStr);
    const newEmployee: Employee = {
      id: Math.random().toString(36).substr(2, 9),
      name: newName,
      personnelNumber: newPersonnelNumber || (employees.length + 1).toString().padStart(3, '0'),
      weeklyHours: hours,
      contractType: newContractType || deriveContractType(hours),
      isActive: true,
    };
    onChange([...employees, newEmployee]);
    setNewName('');
    setNewPersonnelNumber('');
    setNewHoursStr('40,00');
    setNewContractType('');
  };

  const removeEmployee = (id: string) => onChange(employees.filter(e => e.id !== id));

  const updateEmployee = (id: string, field: keyof Employee, value: any) => {
    onChange(employees.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Users className="text-blue-600" size={20} />
        <h2 className="text-lg font-semibold">{t('staff.title')} ({employees.length}/20)</h2>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-md border border-gray-200">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t('staff.employeeName')}</label>
            <input
              type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder={t('staff.namePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t('staff.personnelNumber')}</label>
            <input
              type="text" value={newPersonnelNumber} onChange={(e) => setNewPersonnelNumber(e.target.value)}
              placeholder="001"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t('staff.hoursPerWeek')}</label>
            <input
              type="text"
              inputMode="decimal"
              value={newHoursStr}
              onChange={(e) => setNewHoursStr(e.target.value)}
              onBlur={() => setNewHoursStr(formatDecimalComma(parseDecimalComma(newHoursStr)))}
              placeholder="40,00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t('staff.contractType')}</label>
            <select
              value={newContractType}
              onChange={(e) => setNewContractType(e.target.value as ContractType | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            >
              <option value="">{language === 'de' ? 'Auto' : 'Tự động'}</option>
              <option value="Vollzeit">{t('staff.vollzeit')}</option>
              <option value="Teilzeit">{t('staff.teilzeit')}</option>
              <option value="Minijob">{t('staff.minijob')}</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={addEmployee} disabled={employees.length >= 20}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300"
            >
              <Plus size={16} />
              {t('staff.add')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-3">{t('staff.name')}</th>
                <th className="px-4 py-3">{t('staff.id')}</th>
                <th className="px-4 py-3">{t('staff.hoursPerWeek')}</th>
                <th className="px-4 py-3">{t('staff.contractType')}</th>
                <th className="px-4 py-3 text-right">{t('staff.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.map((emp) => (
                <DecimalEmployeeRow
                  key={emp.id}
                  emp={emp}
                  onUpdate={updateEmployee}
                  onRemove={removeEmployee}
                />
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">
                    {t('staff.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Row component that manages its own local decimal string state */
interface DecimalEmployeeRowProps {
  emp: Employee;
  onUpdate: (id: string, field: keyof Employee, value: any) => void;
  onRemove: (id: string) => void;
}

const DecimalEmployeeRow: React.FC<DecimalEmployeeRowProps> = ({ emp, onUpdate, onRemove }) => {
  const [hoursStr, setHoursStr] = useState(formatDecimalComma(emp.weeklyHours));

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <input type="text" value={emp.name} onChange={(e) => onUpdate(emp.id, 'name', e.target.value)}
          className="w-full bg-transparent border-none focus:ring-0 p-0 font-medium" />
      </td>
      <td className="px-4 py-3">
        <input type="text" value={emp.personnelNumber} onChange={(e) => onUpdate(emp.id, 'personnelNumber', e.target.value)}
          className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-500" />
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          inputMode="decimal"
          value={hoursStr}
          onChange={(e) => setHoursStr(e.target.value)}
          onBlur={() => {
            const parsed = parseDecimalComma(hoursStr);
            setHoursStr(formatDecimalComma(parsed));
            onUpdate(emp.id, 'weeklyHours', parsed);
          }}
          className="w-20 bg-transparent border-none focus:ring-0 p-0"
        />
      </td>
      <td className="px-4 py-3">
        <select
          value={emp.contractType || deriveContractType(emp.weeklyHours)}
          onChange={(e) => onUpdate(emp.id, 'contractType', e.target.value)}
          className="bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-600"
        >
          <option value="Vollzeit">Vollzeit</option>
          <option value="Teilzeit">Teilzeit</option>
          <option value="Minijob">Minijob</option>
        </select>
      </td>
      <td className="px-4 py-3 text-right">
        <button onClick={() => onRemove(emp.id)} className="text-red-500 hover:text-red-700 p-1">
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
};
