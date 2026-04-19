import { MasterData } from "../types";
import { useLanguage } from "../i18n";

interface Props {
  data: MasterData;
  onChange: (data: MasterData) => void;
}

export function MasterDataForm({ data, onChange }: Props) {
  const { t } = useLanguage();

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">{t('master.title')}</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('master.companyName')}</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            value={data.companyName}
            onChange={(e) => onChange({ ...data, companyName: e.target.value })}
            placeholder={t('master.companyPlaceholder')}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('master.month')}</label>
            <select
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              value={data.month}
              onChange={(e) => onChange({ ...data, month: Number(e.target.value) })}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {t(`month.${m}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('master.year')}</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              value={data.year}
              onChange={(e) => onChange({ ...data, year: Number(e.target.value) })}
              min={2000}
              max={2100}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
