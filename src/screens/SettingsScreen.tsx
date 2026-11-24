import React, { useRef, useState } from 'react';
import { CloudUpload, Database, Download, FileSpreadsheet, Percent, RotateCcw, Shield, Trash2, Upload } from 'lucide-react';
import { ALL_ROUTES } from '../constants/permissions';
import { strings } from '../data/translations';
import { CurrencyCode, RoleId } from '../types/erp';
import { downloadTextFile, exportMultiSheetExcel } from '../utils/export';
import { ScreenProps } from './types';

export const SettingsScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, metrics, actions, idbSnapshots } = store;
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];

  const [importConfirmRaw, setImportConfirmRaw] = useState<string | null>(null);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const roles: RoleId[] = ['owner', 'accountant', 'salesman', 'warehouse'];
  const todayStr = new Date().toISOString().slice(0, 10);
  const latestSnapshot = idbSnapshots[0];

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Company Profile */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-500">{t.companyName}</label>
          <input
            value={state.settings.companyName}
            onChange={(e) => actions.updateSettings({ companyName: e.target.value })}
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">{t.taxNumber}</label>
          <input
            value={state.settings.taxNumber}
            onChange={(e) => actions.updateSettings({ taxNumber: e.target.value })}
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">{t.crNumber}</label>
          <input
            value={state.settings.crNumber}
            onChange={(e) => actions.updateSettings({ crNumber: e.target.value })}
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">{t.phone}</label>
          <input
            value={state.settings.phone}
            onChange={(e) => actions.updateSettings({ phone: e.target.value })}
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">{t.email}</label>
          <input
            value={state.settings.email}
            onChange={(e) => actions.updateSettings({ email: e.target.value })}
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">{t.address}</label>
          <input
            value={state.settings.address}
            onChange={(e) => actions.updateSettings({ address: e.target.value })}
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
          />
        </div>
      </div>

      {/* Language, Currency, Dark Mode */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] divide-y divide-slate-100 dark:divide-[#1F332B]">
        <div className="p-4 flex items-center justify-between">
          <span className="text-sm font-bold">{t.language}</span>
          <button
            onClick={actions.toggleLanguage}
            className="px-3.5 py-1.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
          >
            {isAr ? 'العربية (RTL) → EN' : 'English (LTR) → عربي'}
          </button>
        </div>
        <div className="p-4 flex items-center justify-between">
          <span className="text-sm font-bold">{t.currency}</span>
          <select
            value={state.settings.currency}
            onChange={(e) => actions.updateSettings({ currency: e.target.value as CurrencyCode })}
            className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-bold"
          >
            {(['SAR', 'YER', 'EGP', 'AED'] as CurrencyCode[]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="p-4 flex items-center justify-between">
          <span className="text-sm font-bold">{t.darkMode}</span>
          <button
            onClick={actions.toggleDarkMode}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
          >
            {state.settings.isDarkMode ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* VAT & Tax Configuration Panel */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
            <h3 className="text-base font-extrabold">{t.taxConfigSection}</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { rate: 0, label: isAr ? '0% معفى' : '0% Exempt' },
              { rate: 5, label: '5%' },
              { rate: 14, label: '14%' },
              { rate: 15, label: isAr ? '15% الزكاة' : '15% ZATCA' },
            ].map((preset) => {
              const active =
                state.settings.defaultSalesTaxRate === preset.rate &&
                state.settings.defaultPurchaseTaxRate === preset.rate;
              return (
                <button
                  key={preset.rate}
                  type="button"
                  onClick={() => {
                    actions.updateSettings({
                      defaultSalesTaxRate: preset.rate,
                      defaultPurchaseTaxRate: preset.rate,
                    });
                    actions.notify(
                      isAr
                        ? `تم تعيين الضريبة الافتراضية إلى ${preset.rate}%`
                        : `Default tax rate set to ${preset.rate}%`,
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#0A3D2C] text-white'
                      : 'bg-slate-100 dark:bg-[#0A120F] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1A2C24]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500">{t.defaultSalesTax}</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={state.settings.defaultSalesTaxRate}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                const val = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
                actions.updateSettings({ defaultSalesTaxRate: val });
              }}
              className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">{t.defaultPurchaseTax}</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={state.settings.defaultPurchaseTaxRate}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                const val = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
                actions.updateSettings({ defaultPurchaseTaxRate: val });
              }}
              className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">{t.taxConfigHint}</p>
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3 overflow-x-auto">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
          <h3 className="text-base font-extrabold">{t.permissionsMatrix}</h3>
        </div>
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1F332B]">
              <th className="p-2.5 text-start">{isAr ? 'الصفحة' : 'Page'}</th>
              <th className="p-2.5 text-center">{t.roleOwner}</th>
              <th className="p-2.5 text-center">{t.roleAccountant}</th>
              <th className="p-2.5 text-center">{t.roleSalesman}</th>
              <th className="p-2.5 text-center">{t.roleWarehouse}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
            {ALL_ROUTES.map((rt) => (
              <tr key={rt}>
                <td className="p-2.5 font-bold">{t[rt]}</td>
                {roles.map((roleId) => {
                  const allowed = (state.permissionsMatrix[roleId] ?? []).includes(rt);
                  return (
                    <td key={roleId} className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allowed}
                        disabled={roleId === 'owner' && rt === 'settings'}
                        onChange={() => {
                          actions.toggleRolePermission(roleId, rt);
                          actions.notify(isAr ? 'تم تحديث مصفوفة الصلاحيات' : 'Permissions matrix updated');
                        }}
                        className="w-4 h-4 accent-[#0A3D2C] cursor-pointer"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cloud Backup & Sync Section */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-extrabold">{t.backupSection}</h3>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {t.lastBackup}: {state.settings.lastBackupDate ? state.settings.lastBackupDate.slice(0, 10) : '—'} ·{' '}
            {t.dataSize}: {metrics.dataSizeKb} KB
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-y border-slate-100 dark:border-[#1F332B]">
          <div>
            <span className="text-sm font-bold block">{t.autoBackupDaily}</span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {t.latestSnapshot}:{' '}
              {latestSnapshot
                ? `${latestSnapshot.dateKey} (${(latestSnapshot.sizeBytes / 1024).toFixed(1)} KB · ${idbSnapshots.length} ${isAr ? 'أيام' : 'days'})`
                : t.snapshotEmpty}
            </span>
          </div>
          <input
            type="checkbox"
            checked={state.settings.autoBackupDaily}
            onChange={(e) => {
              actions.updateSettings({ autoBackupDaily: e.target.checked });
              actions.notify(isAr ? 'تم تحديث إعداد النسخ التلقائي' : 'Auto backup updated');
            }}
            className="w-4 h-4 accent-[#0A3D2C] cursor-pointer"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            disabled={downloadingBackup}
            onClick={async () => {
              setDownloadingBackup(true);
              try {
                const snapshot = await actions.getLatestIndexedDbBackup();
                if (snapshot) {
                  downloadTextFile(`ostora_backup_${snapshot.dateKey}.json`, snapshot.json, 'application/json');
                  actions.notify(
                    isAr
                      ? `تم تنزيل ostora_backup_${snapshot.dateKey}.json`
                      : `Downloaded ostora_backup_${snapshot.dateKey}.json`,
                  );
                } else {
                  const fallbackJson = actions.exportBackupJson();
                  downloadTextFile(`ostora_backup_${todayStr}.json`, fallbackJson, 'application/json');
                  actions.notify(
                    isAr
                      ? `تم تنزيل ostora_backup_${todayStr}.json`
                      : `Downloaded ostora_backup_${todayStr}.json`,
                  );
                }
              } finally {
                setDownloadingBackup(false);
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>{t.downloadBackup}</span>
          </button>
          <button
            onClick={async () => {
              const saved = await actions.saveDailySnapshotToIndexedDb();
              if (saved) {
                actions.notify(
                  isAr
                    ? `تم حفظ لقطة ${saved.dateKey} في IndexedDB`
                    : `Saved ${saved.dateKey} snapshot to IndexedDB`,
                );
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
          >
            <Database className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
            <span>{t.saveDailySnapshotNow}</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{t.importJson}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              file.text().then((txt) => setImportConfirmRaw(txt));
              e.target.value = '';
            }}
          />
          <button
            onClick={async () => {
              const jsonStr = actions.exportBackupJson();
              const file = new File([jsonStr], `ostora_backup_${todayStr}.json`, { type: 'application/json' });
              if (navigator.share && navigator.canShare?.({ files: [file] })) {
                try {
                  await navigator.share({ title: 'Ostora Accounting Backup', files: [file] });
                  actions.notify(isAr ? 'تمت المشاركة لـ Google Drive' : 'Shared to Google Drive');
                  return;
                } catch {
                  // fallback to download
                }
              }
              downloadTextFile(`ostora_gdrive_${todayStr}.json`, jsonStr, 'application/json');
              actions.notify(isAr ? 'تم تجهيز الملف للرفع على Google Drive' : 'Backup ready for Google Drive upload');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
          >
            <CloudUpload className="w-4 h-4" />
            <span>{t.backupGdrive}</span>
          </button>
          <button
            onClick={() => {
              exportMultiSheetExcel(`ostora_all_data_${todayStr}.xls`, [
                {
                  name: 'Invoices',
                  rows: [
                    ['ID', 'Customer', 'Subtotal', 'VAT', 'Total', 'Status', 'Date'],
                    ...state.invoices.map((i) => [i.id, i.customerName, i.subtotal, i.vat, i.total, i.status, i.date]),
                  ],
                },
                {
                  name: 'Returns',
                  rows: [
                    ['ID', 'Type', 'Original', 'Party', 'Product', 'Qty', 'Amount', 'Reason'],
                    ...state.returns.map((r) => [
                      r.id,
                      r.type,
                      r.originalDocId,
                      r.partyName,
                      r.productName,
                      r.qty,
                      r.amount,
                      r.reason,
                    ]),
                  ],
                },
                {
                  name: 'Quotations',
                  rows: [
                    ['ID', 'Customer', 'Total', 'ValidUntil', 'Status'],
                    ...state.quotations.map((q) => [q.id, q.customerName, q.total, q.validUntil, q.status]),
                  ],
                },
                {
                  name: 'Customers',
                  rows: [
                    ['ID', 'Name', 'Phone', 'Email', 'Debt'],
                    ...state.customers.map((c) => [c.id, c.name, c.phone, c.email, c.debt]),
                  ],
                },
                {
                  name: 'Suppliers',
                  rows: [
                    ['ID', 'Name', 'Phone', 'Category', 'Payable'],
                    ...state.suppliers.map((s) => [s.id, s.name, s.phone, s.category, s.payable]),
                  ],
                },
                {
                  name: 'Inventory',
                  rows: [
                    ['ID', 'Name', 'SKU', 'Barcode', 'Qty', 'Cost', 'Price'],
                    ...state.products.map((p) => [p.id, p.name, p.sku, p.barcode, p.qty, p.cost, p.price]),
                  ],
                },
                {
                  name: 'Vouchers',
                  rows: [
                    ['ID', 'Type', 'Party', 'Amount', 'Reason'],
                    ...state.vouchers.map((v) => [v.id, v.type, v.partyName, v.amount, v.reason]),
                  ],
                },
                {
                  name: 'Expenses',
                  rows: [
                    ['ID', 'Title', 'Category', 'Amount', 'Date'],
                    ...state.expenses.map((e) => [e.id, e.title, e.category, e.amount, e.date]),
                  ],
                },
              ]);
              actions.notify(isAr ? 'تم تصدير جميع الجداول إلى Excel' : 'All sheets exported to Excel');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-600/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t.exportAllExcel}</span>
          </button>
          <button
            onClick={() => {
              actions.restoreDemoData();
              actions.notify(isAr ? 'تمت استعادة البيانات التجريبية' : 'Demo data restored');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C9A227]/20 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.restoreDemo}</span>
          </button>
          <button
            onClick={() => {
              actions.deleteAllData();
              actions.notify(isAr ? 'تم مسح جميع السجلات' : 'All records cleared');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/10 text-red-600 text-xs font-bold cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.deleteAll}</span>
          </button>
        </div>
      </div>

      {/* Confirm Import Replacement Modal */}
      {importConfirmRaw && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold">{t.importJson}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t.replaceConfirmMsg}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setImportConfirmRaw(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  actions.importBackupJson(importConfirmRaw);
                  setImportConfirmRaw(null);
                  actions.notify(isAr ? 'تم استيراد النسخة الاحتياطية بنجاح' : 'Backup restored successfully');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
