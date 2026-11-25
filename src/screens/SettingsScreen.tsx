import React, { useRef, useState } from 'react';
import { Cloud, CloudOff, CloudUpload, Coins, Database, Download, FileSpreadsheet, LogOut, Percent, RefreshCw, RotateCcw, Shield, Trash2, Upload } from 'lucide-react';
import { ALL_ROUTES } from '../constants/permissions';
import { useFirebase } from '../contexts/FirebaseContext';
import { strings } from '../data/translations';
import { CurrencyCode, RoleId } from '../types/erp';
import {
  buildDefaultRatesForBase,
  DEFAULT_ENABLED_CURRENCIES,
  SUPPORTED_CURRENCIES,
} from '../utils/currencies';
import { downloadTextFile, exportMultiSheetExcel } from '../utils/export';
import { ScreenProps } from './types';

export const SettingsScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, metrics, actions, idbSnapshots } = store;
  const { user, signingIn, syncStatus, lastCloudSyncAt, authError, signInWithGoogle, signOutFirebase } = useFirebase();
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];

  const [importConfirmRaw, setImportConfirmRaw] = useState<string | null>(null);
  const [dangerConfirm, setDangerConfirm] = useState<'deleteAll' | 'restoreDemo' | null>(null);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [updatingRates, setUpdatingRates] = useState(false);
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
            maxLength={160}
            value={state.settings.companyName}
            onChange={(e) => actions.updateSettings({ companyName: e.target.value })}
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">{t.taxNumber}</label>
          <input
            maxLength={64}
            value={state.settings.taxNumber}
            onChange={(e) => actions.updateSettings({ taxNumber: e.target.value })}
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">{t.crNumber}</label>
          <input
            maxLength={64}
            value={state.settings.crNumber}
            onChange={(e) => actions.updateSettings({ crNumber: e.target.value })}
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">{t.phone}</label>
          <input
            maxLength={40}
            value={state.settings.phone}
            onChange={(e) => actions.updateSettings({ phone: e.target.value })}
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">{t.email}</label>
          <input
            maxLength={160}
            value={state.settings.email}
            onChange={(e) => actions.updateSettings({ email: e.target.value })}
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">{t.address}</label>
          <input
            maxLength={300}
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
        <div className="p-4 flex items-center justify-between gap-3">
          <span className="text-sm font-bold">{t.baseCurrency}</span>
          <select
            value={state.settings.currency}
            onChange={(e) => actions.updateSettings({ currency: e.target.value as CurrencyCode })}
            className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-bold"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {isAr ? c.nameAr : c.nameEn}
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

      {/* Multi-Currency & Live Exchange Rates Panel */}
      {(() => {
        const baseCur = state.settings.currency;
        const enabledList = state.settings.enabledCurrencies ?? DEFAULT_ENABLED_CURRENCIES;
        const ratesMap = state.settings.exchangeRates ?? buildDefaultRatesForBase(baseCur);
        const foreignEnabled = enabledList.filter((c) => c !== baseCur);

        return (
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
                <div>
                  <h3 className="text-base font-extrabold">{t.multiCurrencySection}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {t.lastUpdatedRates}:{' '}
                    {state.settings.lastRatesUpdate ? state.settings.lastRatesUpdate.slice(0, 16).replace('T', ' ') : '—'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={updatingRates}
                onClick={async () => {
                  setUpdatingRates(true);
                  try {
                    const res = await actions.refreshLiveExchangeRates(baseCur);
                    actions.notify(
                      res.source === 'live'
                        ? isAr
                          ? `تم تحديث أسعار الصرف مباشرة مقابل ${baseCur}`
                          : `Live exchange rates updated against ${baseCur}`
                        : isAr
                        ? 'تم تحميل الأسعار المرجعية (وضع غير متصل)'
                        : 'Loaded reference exchange rates (offline fallback)',
                    );
                  } finally {
                    setUpdatingRates(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${updatingRates ? 'animate-spin' : ''}`} />
                <span>{updatingRates ? t.fetchingRates : t.fetchLiveRates}</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 block">{t.enabledCurrencies}</label>
              <div className="flex flex-wrap gap-1.5">
                {SUPPORTED_CURRENCIES.map((c) => {
                  const isBase = c.code === baseCur;
                  const active = isBase || enabledList.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      disabled={isBase}
                      onClick={() => {
                        const next = active
                          ? enabledList.filter((x) => x !== c.code)
                          : [...enabledList, c.code];
                        actions.updateSettings({ enabledCurrencies: next });
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:cursor-default ${
                        active
                          ? 'bg-[#0A3D2C] text-white border-[#0A3D2C]'
                          : 'bg-slate-50 dark:bg-[#0A120F] border-slate-200 dark:border-[#1F332B] text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {c.code} · {isAr ? c.nameAr : c.nameEn}
                      {isBase ? (isAr ? ' (أساسية)' : ' (Base)') : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {foreignEnabled.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {foreignEnabled.map((code) => {
                  const meta = SUPPORTED_CURRENCIES.find((m) => m.code === code);
                  const val = ratesMap[code] ?? 1;
                  return (
                    <div
                      key={code}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B]"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-extrabold block">1 {code} =</span>
                        <span className="text-[10px] text-slate-500 truncate block">
                          {isAr ? meta?.nameAr : meta?.nameEn}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min={0.0001}
                          step={0.0001}
                          value={val}
                          onChange={(e) => {
                            const num = parseFloat(e.target.value);
                            if (!Number.isFinite(num) || num <= 0) return;
                            actions.updateSettings({
                              exchangeRates: {
                                ...ratesMap,
                                [code]: num,
                              },
                            });
                          }}
                          className="w-24 px-2 py-1 rounded-lg bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums text-end"
                        />
                        <span className="text-xs font-mono font-bold text-slate-500">{baseCur}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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

      {/* Firebase Cloud Sync & Google Account */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {user ? (
              <Cloud className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <CloudOff className="w-5 h-5 text-slate-400" />
            )}
            <h3 className="text-base font-extrabold">{t.cloudSyncTitle}</h3>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            {user
              ? syncStatus === 'syncing'
                ? t.syncingCloud
                : `${t.syncedCloud}${lastCloudSyncAt ? ` · ${lastCloudSyncAt.slice(11, 19)}` : ''}`
              : t.cloudOfflineMode}
          </span>
        </div>

        {user ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-slate-800 dark:text-slate-100">
                {user.displayName || user.email}
              </p>
              <p className="text-slate-500 font-mono">{user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={syncingNow || syncStatus === 'syncing'}
                onClick={async () => {
                  setSyncingNow(true);
                  try {
                    const ok = await actions.syncNowToCloud();
                    if (ok) {
                      actions.notify(isAr ? 'تمت مزامنة البيانات مع Firebase' : 'Synced workspace to Firebase');
                    }
                  } finally {
                    setSyncingNow(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingNow || syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                <span>{t.syncNow}</span>
              </button>
              <button
                type="button"
                onClick={() => void signOutFirebase()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold text-red-600 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.disconnectGoogle}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-500">
              {isAr
                ? 'اربط حساب Google لحفظ ومزامنة الفواتير والعملاء والمخزون عبر الأجهزة بشكل فوري.'
                : 'Connect your Google account to back up and sync invoices, customers, and inventory across devices.'}
            </p>
            <button
              type="button"
              disabled={signingIn}
              onClick={async () => {
                const signedUser = await signInWithGoogle();
                if (signedUser) {
                  actions.notify(isAr ? 'تم الربط والمزامنة مع Firebase' : 'Connected to Firebase Cloud');
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              <Cloud className="w-4 h-4" />
              <span>{t.connectGoogleCloud}</span>
            </button>
          </div>
        )}
        {/* Auto-Sync Settings */}
        <div className="mt-2 pt-3 border-t border-slate-100 dark:border-[#1F332B] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.autoSyncSettingsTitle}</p>
              <p className="text-xs text-slate-500">
                {(state.settings.autoCloudSync ?? true)
                  ? (state.settings.autoSyncIntervalMinutes ?? 0) === 0
                    ? `${t.autoSyncIntervalLabel}: ${t.syncInstant}`
                    : `${t.autoSyncIntervalLabel}: ${
                        state.settings.autoSyncIntervalMinutes === 1
                          ? t.syncEvery1m
                          : state.settings.autoSyncIntervalMinutes === 5
                          ? t.syncEvery5m
                          : t.syncEvery15m
                      }`
                  : t.syncManualOnly}
              </p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t.autoCloudSyncToggle}</span>
              <input
                type="checkbox"
                checked={state.settings.autoCloudSync ?? true}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  actions.updateSettings({ autoCloudSync: enabled });
                  actions.notify(
                    enabled
                      ? isAr
                        ? 'تم تفعيل المزامنة التلقائية مع السحابة'
                        : 'Automatic cloud sync enabled'
                      : isAr
                      ? 'تم إيقاف المزامنة التلقائية (يدوي فقط)'
                      : 'Automatic cloud sync paused (manual only)',
                  );
                }}
                className="w-4 h-4 accent-[#0A3D2C] cursor-pointer"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-500">{t.autoSyncIntervalLabel}</label>
            <select
              disabled={!(state.settings.autoCloudSync ?? true)}
              value={state.settings.autoSyncIntervalMinutes ?? 0}
              onChange={(e) => {
                const mins = Number(e.target.value);
                actions.updateSettings({ autoSyncIntervalMinutes: mins });
                actions.notify(
                  isAr
                    ? 'تم تحديث وتيرة المزامنة التلقائية'
                    : 'Auto-sync frequency updated',
                );
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold disabled:opacity-50"
            >
              <option value={0}>{t.syncInstant}</option>
              <option value={1}>{t.syncEvery1m}</option>
              <option value={5}>{t.syncEvery5m}</option>
              <option value={15}>{t.syncEvery15m}</option>
            </select>
          </div>
        </div>

        {authError && <p className="text-xs text-red-600 font-semibold">{authError}</p>}
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
            onClick={() => setDangerConfirm('restoreDemo')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C9A227]/20 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.restoreDemo}</span>
          </button>
          <button
            onClick={() => setDangerConfirm('deleteAll')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/10 text-red-600 text-xs font-bold cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.deleteAll}</span>
          </button>
        </div>
      </div>

      {/* Confirm Destructive Data Action Modal */}
      {dangerConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-red-600">
              {dangerConfirm === 'deleteAll' ? t.confirmDelete : t.restoreDemo}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {dangerConfirm === 'deleteAll'
                ? isAr
                  ? 'سيؤدي هذا الإجراء إلى مسح جميع الفواتير والعملاء والمخزون والقيود الحالية. هل أنت متأكد؟'
                  : 'This will permanently clear all invoices, customers, inventory, and ledger entries. Continue?'
                : t.replaceConfirmMsg}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDangerConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  if (dangerConfirm === 'deleteAll') {
                    actions.deleteAllData();
                    actions.notify(isAr ? 'تم مسح جميع السجلات' : 'All records cleared');
                  } else {
                    actions.restoreDemoData();
                    actions.notify(isAr ? 'تمت استعادة البيانات التجريبية' : 'Demo data restored');
                  }
                  setDangerConfirm(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold cursor-pointer ${
                  dangerConfirm === 'deleteAll' ? 'bg-red-600' : 'bg-[#0A3D2C]'
                }`}
              >
                {dangerConfirm === 'deleteAll' ? t.delete : t.restoreDemo}
              </button>
            </div>
          </div>
        </div>
      )}

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
