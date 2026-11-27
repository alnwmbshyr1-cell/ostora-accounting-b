import React, { useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  Briefcase,
  Building2,
  CalendarCheck2,
  Cloud,
  CloudOff,
  CloudUpload,
  Coins,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Globe,
  ImagePlus,
  Lock,
  LogOut,
  MessageSquare,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  Trash2,
  Upload,
  UserPlus,
  Warehouse,
} from 'lucide-react';
import { DataImportModal } from '../components/DataImportModal';
import { ALL_ROUTES } from '../constants/permissions';
import { useFirebase } from '../contexts/FirebaseContext';
import { strings } from '../data/translations';
import { uploadAssetWithOfflineFallback } from '../services/firebaseExtras';
import { CountryCode, CurrencyCode, LanguageCode, RoleId } from '../types/erp';
import {
  buildDefaultRatesForBase,
  convertCurrencyAmount,
  CurrencyDecimalMode,
  CurrencyDisplayStyle,
  CurrencyNumberLocale,
  DEFAULT_ENABLED_CURRENCIES,
  formatCurrency,
  getCurrencyMeta,
  SUPPORTED_CURRENCIES,
} from '../utils/currencies';
import { downloadTextFile, exportMultiSheetExcel } from '../utils/export';
import { compressImageToBase64 } from '../utils/image';
import { COUNTRY_TAX_REGIMES, getCountryTaxRegime } from '../utils/taxRegimes';
import { ScreenProps } from './types';

export const SettingsScreen: React.FC<ScreenProps> = ({ store, onNavigate }) => {
  const { state, metrics, actions, idbSnapshots, cloudBackups, outgoingInvites, activeWorkspaceId } = store;
  const { user, signingIn, syncStatus, lastCloudSyncAt, authError, signInWithGoogle, signOutFirebase } = useFirebase();
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];
  const canDelete = state.currentRole !== 'accountant';

  const [importConfirmRaw, setImportConfirmRaw] = useState<string | null>(null);
  const [restoreSnapshotKey, setRestoreSnapshotKey] = useState<string | null>(null);
  const [dangerConfirm, setDangerConfirm] = useState<'deleteAll' | 'restoreDemo' | null>(null);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [updatingRates, setUpdatingRates] = useState(false);
  const [convAmount, setConvAmount] = useState('1000');
  const [convFrom, setConvFrom] = useState<CurrencyCode>(state.settings.currency);
  const [convTo, setConvTo] = useState<CurrencyCode>(state.settings.currency === 'USD' ? 'SAR' : 'USD');
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [savingCloudBackup, setSavingCloudBackup] = useState(false);
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompCountry, setNewCompCountry] = useState<CountryCode>(state.settings.countryCode ?? 'SA');
  const [newCompCurrency, setNewCompCurrency] = useState<CurrencyCode>(state.settings.currency);
  const [newCompTax, setNewCompTax] = useState('');
  const [closeYear, setCloseYear] = useState<number>(new Date().getFullYear());
  const [closeErr, setCloseErr] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<RoleId>('accountant');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [branchModal, setBranchModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [branchForm, setBranchForm] = useState({
    nameAr: '',
    nameEn: '',
    city: '',
    phone: '',
    managerName: '',
    isMain: false,
    active: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const roles: RoleId[] = ['owner', 'accountant', 'cashier', 'salesman', 'warehouse'];
  const todayStr = new Date().toISOString().slice(0, 10);
  const latestSnapshot = idbSnapshots[0];

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Company Profile & Logo */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#1F332B]">
          <div className="flex items-center gap-3">
            {state.settings.logoBase64 ? (
              <img
                src={state.settings.logoBase64}
                alt={state.settings.companyName}
                className="w-14 h-14 rounded-2xl object-contain bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] p-1"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-[#0A3D2C] text-[#C9A227] flex items-center justify-center font-extrabold text-xl">
                {state.settings.companyName.slice(0, 1)}
              </div>
            )}
            <div>
              <p className="text-sm font-extrabold">{t.companyLogo}</p>
              <p className="text-xs text-slate-500">
                {isAr ? 'يظهر في الشريط الجانبي والفواتير وتقارير PDF' : 'Shown in sidebar, invoices, and PDF reports'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
            >
              <ImagePlus className="w-4 h-4 text-[#C9A227]" />
              <span>{t.uploadImage}</span>
            </button>
            {state.settings.logoBase64 && (
              <button
                type="button"
                onClick={() => {
                  actions.updateSettings({ logoBase64: undefined });
                  actions.notify(isAr ? 'تمت إزالة الشعار' : 'Logo removed');
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold text-red-600 cursor-pointer"
              >
                {t.delete}
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const compressed = await compressImageToBase64(file);
                const uploaded = await uploadAssetWithOfflineFallback(user?.uid, 'logos', file.name, compressed);
                actions.updateSettings({ logoBase64: uploaded.url });
                actions.notify(isAr ? 'تم حفظ شعار الشركة بنجاح' : 'Company logo saved');
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div>
            <label className="text-xs font-bold text-slate-500">{isAr ? 'المدينة' : 'City'}</label>
            <input
              maxLength={80}
              value={state.settings.city ?? ''}
              onChange={(e) => actions.updateSettings({ city: e.target.value })}
              placeholder={isAr ? 'الرياض' : 'Riyadh'}
              className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />
          </div>
        </div>
      </div>

      {/* Multi-Company Switcher & Profile Manager */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
            <div>
              <h3 className="text-base font-extrabold">{isAr ? 'تعدد الشركات والكيانات' : 'Multi-Company Switcher'}</h3>
              <p className="text-[11px] text-slate-500">
                {isAr
                  ? 'أنشئ ملفات شركات متعددة وبدّل بينها مع حفظ الضريبة والعملة والرقم الضريبي لكل كيان'
                  : 'Create and switch between company profiles with independent currency and tax numbers'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNewCompanyOpen((v) => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>{isAr ? 'إضافة شركة' : 'Add Company'}</span>
          </button>
        </div>

        {(state.settings.companies ?? []).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(state.settings.companies ?? []).map((comp) => {
              const isActive = state.settings.companyId === comp.id || (!state.settings.companyId && comp.companyName === state.settings.companyName);
              return (
                <div
                  key={comp.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                    isActive
                      ? 'bg-[#0A3D2C]/5 dark:bg-[#C9A227]/10 border-[#0A3D2C] dark:border-[#C9A227]'
                      : 'bg-slate-50 dark:bg-[#0A120F] border-slate-200 dark:border-[#1F332B]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold truncate">{comp.companyName}</p>
                    <p className="text-[10px] font-mono text-slate-500 truncate">
                      {comp.countryCode ?? 'SA'} · {comp.currency} {comp.taxNumber ? `· VAT: ${comp.taxNumber}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isActive}
                    onClick={() => {
                      actions.switchCompanyProfile(comp.id);
                      actions.notify(isAr ? `تم التبديل إلى ${comp.companyName}` : `Switched to ${comp.companyName}`);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer disabled:cursor-default ${
                      isActive ? 'bg-[#0A3D2C] text-white' : 'border border-slate-200 dark:border-[#1F332B] hover:border-[#0A3D2C]'
                    }`}
                  >
                    {isActive ? (isAr ? 'نشطة ✓' : 'Active ✓') : isAr ? 'تبديل' : 'Switch'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            {isAr
              ? `الشركة النشطة حالياً: ${state.settings.companyName} (${state.settings.currency}). يمكنك إضافة شركة جديدة للتبديل السريع.`
              : `Current active company: ${state.settings.companyName} (${state.settings.currency}). Add another company profile to switch easily.`}
          </p>
        )}

        {newCompanyOpen && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <input
              value={newCompName}
              onChange={(e) => setNewCompName(e.target.value)}
              placeholder={isAr ? 'اسم الشركة الجديدة *' : 'New Company Name *'}
              className="sm:col-span-2 px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
            />
            <select
              value={newCompCountry}
              onChange={(e) => {
                const c = e.target.value as CountryCode;
                setNewCompCountry(c);
                setNewCompCurrency(getCountryTaxRegime(c).defaultCurrency);
              }}
              className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
            >
              {COUNTRY_TAX_REGIMES.map((r) => (
                <option key={r.countryCode} value={r.countryCode}>
                  {r.countryCode} — {isAr ? r.nameAr : r.nameEn}
                </option>
              ))}
            </select>
            <select
              value={newCompCurrency}
              onChange={(e) => setNewCompCurrency(e.target.value as CurrencyCode)}
              className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-mono font-bold"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
            <input
              value={newCompTax}
              onChange={(e) => setNewCompTax(e.target.value)}
              placeholder={isAr ? 'الرقم الضريبي (اختياري)' : 'Tax Number (optional)'}
              className="sm:col-span-3 px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => {
                if (!newCompName.trim()) {
                  actions.notify(isAr ? 'أدخل اسم الشركة الجديدة *' : 'Company name is required *');
                  return;
                }
                actions.saveCompanyProfile({
                  workspaceId: activeWorkspaceId ?? user?.uid ?? 'local',
                  companyName: newCompName.trim(),
                  countryCode: newCompCountry,
                  currency: newCompCurrency,
                  taxNumber: newCompTax.trim() || undefined,
                });
                setNewCompName('');
                setNewCompTax('');
                setNewCompanyOpen(false);
                actions.notify(isAr ? 'تم إضافة ملف الشركة بنجاح' : 'Company profile added');
              }}
              className="px-3 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
            >
              {t.save}
            </button>
          </div>
        )}
      </div>

      {/* Branches Management & Fiscal Period Lock */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
              <h3 className="text-base font-extrabold">{t.branchesManagement}</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setBranchForm({
                  nameAr: '',
                  nameEn: '',
                  city: '',
                  phone: '',
                  managerName: '',
                  isMain: false,
                  active: true,
                });
                setBranchModal({ open: true });
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.addBranch}</span>
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#1F332B] max-h-48 overflow-y-auto">
            {state.branches.map((br) => (
              <div key={br.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="font-bold truncate">
                    {isAr ? br.nameAr : br.nameEn} {br.isMain ? '★' : ''}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {br.city} {br.managerName ? `· ${br.managerName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setBranchForm({
                        nameAr: br.nameAr,
                        nameEn: br.nameEn,
                        city: br.city,
                        phone: br.phone,
                        managerName: br.managerName,
                        isMain: Boolean(br.isMain),
                        active: br.active,
                      });
                      setBranchModal({ open: true, editId: br.id });
                    }}
                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-[#1F332B] font-bold cursor-pointer"
                  >
                    {t.edit}
                  </button>
                  {canDelete && state.branches.length > 1 && (
                    <button
                      type="button"
                      onClick={() => actions.deleteBranch(br.id)}
                      className="p-1 text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-[#1F332B] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <Warehouse className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
              <span>
                {isAr
                  ? `المستودعات النشطة: ${state.warehouses.length}`
                  : `Active Warehouses: ${state.warehouses.length}`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('warehouses')}
              className="px-3 py-1 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
            >
              {isAr ? 'إدارة المستودعات ←' : 'Manage Warehouses →'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
            <h3 className="text-base font-extrabold">{t.fiscalLockTitle}</h3>
          </div>
          <p className="text-xs text-slate-500">{t.fiscalLockHint}</p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={state.settings.fiscalLockDate ?? ''}
              onChange={(e) => {
                actions.setFiscalLockDate(e.target.value);
                actions.notify(
                  e.target.value
                    ? isAr
                      ? `تم قفل الفترة المالية حتى ${e.target.value}`
                      : `Fiscal lock set to ${e.target.value}`
                    : isAr
                    ? 'تم فتح الفترة المالية'
                    : 'Fiscal lock cleared',
                );
              }}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
            />
            {state.settings.fiscalLockDate && (
              <button
                type="button"
                onClick={() => {
                  actions.setFiscalLockDate('');
                  actions.notify(isAr ? 'تم إلغاء قفل الفترة المالية' : 'Fiscal period unlocked');
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
              >
                {isAr ? 'فتح' : 'Unlock'}
              </button>
            )}
          </div>

          {/* Fiscal Year-End Closing */}
          <div className="pt-3 border-t border-slate-100 dark:border-[#1F332B] space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0A3D2C] dark:text-[#C9A227]">
              <CalendarCheck2 className="w-4 h-4" />
              <span>{isAr ? 'إقفال السنة المالية وترحيل الأرباح المبقاة' : 'Fiscal Year-End Closing'}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={2000}
                max={2100}
                value={closeYear}
                onChange={(e) => setCloseYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                className="w-28 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono font-bold"
              />
              <button
                type="button"
                onClick={() => {
                  setCloseErr('');
                  const res = actions.closeFiscalYear(closeYear);
                  if (!res.ok) {
                    const ids = res.unbalancedIds
                      .map((u) => (typeof u === 'string' ? u : u.journalId))
                      .join(', ');
                    setCloseErr(
                      isAr
                        ? `يوجد قيود غير متوازنة يجب تصحيحها أولاً: ${ids}`
                        : `Fix unbalanced journal(s) first: ${ids}`,
                    );
                  }
                }}
                className="flex-1 px-3 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إقفال السنة المالية' : 'Close Fiscal Year'}
              </button>
            </div>
            {closeErr && <p className="text-[11px] font-bold text-red-600">{closeErr}</p>}
          </div>
        </div>
      </div>

      {/* Language, Currency, Dark Mode */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] divide-y divide-slate-100 dark:divide-[#1F332B]">
        <div className="p-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
            <span className="text-sm font-bold">{t.language}</span>
          </div>
          <select
            value={state.settings.language ?? (isAr ? 'ar' : 'en')}
            onChange={(e) => {
              const lang = e.target.value as LanguageCode;
              actions.setLanguage(lang);
              actions.notify(lang === 'ar' || lang === 'ur' ? 'تم تحديث لغة النظام (RTL)' : 'Interface language updated');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
          >
            <option value="ar">العربية (RTL)</option>
            <option value="en">English (LTR)</option>
            <option value="fr">Français (LTR)</option>
            <option value="es">Español (LTR)</option>
            <option value="tr">Türkçe (LTR)</option>
            <option value="ur">اردو (RTL)</option>
          </select>
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
                {c.code} — {isAr ? c.nameAr : c.nameEn} ({formatCurrency(1250.5, c.code, { isAr })})
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

      {/* Multi-Currency, Display Formatting & Live Exchange Rates Panel */}
      {(() => {
        const baseCur = state.settings.currency;
        const enabledList = state.settings.enabledCurrencies ?? DEFAULT_ENABLED_CURRENCIES;
        const displayCur = state.settings.displayCurrency && enabledList.includes(state.settings.displayCurrency)
          ? state.settings.displayCurrency
          : baseCur;
        const displayStyle = state.settings.currencyDisplayStyle ?? 'symbol';
        const numberLocale = state.settings.currencyNumberLocale ?? 'auto';
        const decimalMode = state.settings.currencyDecimalMode ?? 'auto';
        const fxIntervalHours = state.settings.fxAutoIntervalHours ?? 6;
        const ratesSource = state.settings.lastRatesSource;
        const ratesMap = state.settings.exchangeRates ?? buildDefaultRatesForBase(baseCur);
        const foreignEnabled = enabledList.filter((c) => c !== baseCur);
        const convRaw = parseFloat(convAmount);
        const convNumeric = Number.isFinite(convRaw) && convRaw >= 0 ? convRaw : 0;
        const convertedResult = convertCurrencyAmount(convNumeric, convFrom, convTo, baseCur, ratesMap);

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
                    {ratesSource && (
                      <span className="ms-2 text-[#0A3D2C] dark:text-[#C9A227] font-bold">
                        · {ratesSource === 'live' ? (isAr ? 'سوق مباشر' : 'Live API') : isAr ? 'مرجعي' : 'Reference'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.settings.autoUpdateExchangeRates ?? true}
                    onChange={(e) => {
                      actions.updateSettings({ autoUpdateExchangeRates: e.target.checked });
                      actions.notify(
                        e.target.checked
                          ? isAr
                            ? 'تم تفعيل التحديث التلقائي لأسعار الصرف'
                            : 'Auto FX rate updates enabled'
                          : isAr
                          ? 'تم إيقاف التحديث التلقائي لأسعار الصرف'
                          : 'Auto FX rate updates paused',
                      );
                    }}
                    className="w-4 h-4 accent-[#0A3D2C] cursor-pointer"
                  />
                  <span>{isAr ? 'تحديث تلقائي للأسعار' : 'Auto-update rates'}</span>
                </label>
                {(state.settings.autoUpdateExchangeRates ?? true) && (
                  <select
                    value={fxIntervalHours}
                    onChange={(e) => actions.updateSettings({ fxAutoIntervalHours: Number(e.target.value) })}
                    aria-label={isAr ? 'فترة التحديث التلقائي' : 'Auto-update interval'}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                  >
                    <option value={1}>{isAr ? 'كل ساعة' : 'Every 1h'}</option>
                    <option value={6}>{isAr ? 'كل 6 ساعات' : 'Every 6h'}</option>
                    <option value={12}>{isAr ? 'كل 12 ساعة' : 'Every 12h'}</option>
                    <option value={24}>{isAr ? 'يومياً (24س)' : 'Daily (24h)'}</option>
                  </select>
                )}
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
                <button
                  type="button"
                  onClick={() => {
                    actions.resetDefaultExchangeRates(baseCur);
                    actions.notify(isAr ? 'تمت استعادة أسعار الصرف المرجعية الافتراضية' : 'Default reference FX rates restored');
                  }}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] hover:border-[#0A3D2C] dark:hover:border-[#C9A227] text-xs font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isAr ? 'استعادة الافتراضي' : 'Reset Rates'}</span>
                </button>
              </div>
            </div>

            {/* Currency Display Support & Formatting Preferences */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#0A3D2C] dark:text-[#C9A227]">
                  {isAr ? 'إعدادات عرض العملة وتنسيق الأرقام' : 'Currency Display & Number Formatting'}
                </span>
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                  {isAr ? 'معاينة:' : 'Preview:'} {formatCurrency(12500.5, displayCur, { isAr })} · {formatCurrency(840.25, 'USD', { isAr })}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {isAr ? 'عملة العرض الافتراضية' : 'Default Display Currency'}
                  </label>
                  <select
                    value={displayCur}
                    onChange={(e) => actions.updateSettings({ displayCurrency: e.target.value as CurrencyCode })}
                    className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                  >
                    {enabledList.map((c) => {
                      const m = getCurrencyMeta(c);
                      return (
                        <option key={c} value={c}>
                          {c} — {isAr ? m.nameAr : m.nameEn}
                          {c === baseCur ? (isAr ? ' (الأساسية)' : ' (Base)') : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {isAr ? 'أسلوب إظهار العملة' : 'Currency Display Style'}
                  </label>
                  <select
                    value={displayStyle}
                    onChange={(e) => actions.updateSettings({ currencyDisplayStyle: e.target.value as CurrencyDisplayStyle })}
                    className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                  >
                    <option value="symbol">{isAr ? 'رمز العملة (ر.س / $)' : 'Symbol (ر.س / $)'}</option>
                    <option value="code">{isAr ? 'كود العملة (SAR / USD)' : 'ISO Code (SAR / USD)'}</option>
                    <option value="both">{isAr ? 'الرمز والكود معاً' : 'Symbol + ISO Code'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {isAr ? 'نظام الأرقام والفواصل' : 'Number Format Locale'}
                  </label>
                  <select
                    value={numberLocale}
                    onChange={(e) => actions.updateSettings({ currencyNumberLocale: e.target.value as CurrencyNumberLocale })}
                    className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                  >
                    <option value="auto">{isAr ? 'تلقائي حسب العملة' : 'Auto per currency'}</option>
                    <option value="en-US">{isAr ? 'لاتيني (1,250.50)' : 'Western (1,250.50)'}</option>
                    <option value="ar-SA">{isAr ? 'عربي (١٬٢٥٠٫٥٠)' : 'Arabic (١٬٢٥٠٫٥٠)'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {isAr ? 'الخانات العشرية' : 'Decimal Precision'}
                  </label>
                  <select
                    value={decimalMode}
                    onChange={(e) => actions.updateSettings({ currencyDecimalMode: e.target.value as CurrencyDecimalMode })}
                    className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                  >
                    <option value="auto">{isAr ? 'تلقائي (2 للريال، 3 للدينار)' : 'Auto per currency ISO'}</option>
                    <option value="0">{isAr ? 'بدون كسور (0)' : '0 decimals'}</option>
                    <option value="2">{isAr ? 'خانتان (2)' : '2 decimals'}</option>
                    <option value="3">{isAr ? 'ثلاث خانات (3)' : '3 decimals'}</option>
                  </select>
                </div>
              </div>
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
                  const meta = getCurrencyMeta(code);
                  const val = ratesMap[code] ?? 1;
                  const inverse = val > 0 ? (1 / val).toFixed(4) : '—';
                  return (
                    <div
                      key={code}
                      className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-xs font-extrabold block">1 {code} =</span>
                          <span className="text-[10px] text-slate-500 truncate block">
                            {isAr ? meta.nameAr : meta.nameEn} · {formatCurrency(1250.5, code, { isAr })}
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
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-200/70 dark:border-[#1F332B] pt-1">
                        <span>1 {baseCur} = {inverse} {code}</span>
                        <span>{meta.maxDecimals} {isAr ? 'خانات' : 'dec'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Instant Currency Converter */}
            <div className="p-3.5 rounded-2xl bg-[#0A3D2C]/5 dark:bg-[#0A120F] border border-[#0A3D2C]/20 dark:border-[#1F332B] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#0A3D2C] dark:text-[#C9A227]">
                  {isAr ? 'محول العملات الفوري' : 'Quick Currency Converter'}
                </span>
                <span className="text-xs font-mono font-extrabold text-[#0A3D2C] dark:text-emerald-400 tabular-nums">
                  {formatCurrency(convNumeric, convFrom, { isAr })} = {formatCurrency(convertedResult, convTo, { isAr })}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={convAmount}
                  onChange={(e) => setConvAmount(e.target.value)}
                  className="sm:col-span-4 px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-mono font-bold tabular-nums"
                />
                <select
                  value={convFrom}
                  onChange={(e) => setConvFrom(e.target.value as CurrencyCode)}
                  className="sm:col-span-3 px-2.5 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  {enabledList.map((c) => (
                    <option key={c} value={c}>{c} — {isAr ? getCurrencyMeta(c).nameAr : getCurrencyMeta(c).nameEn}</option>
                  ))}
                </select>
                <div className="sm:col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      const prevFrom = convFrom;
                      setConvFrom(convTo);
                      setConvTo(prevFrom);
                    }}
                    title={isAr ? 'تبديل العملتين' : 'Swap currencies'}
                    className="p-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] hover:border-[#0A3D2C] dark:hover:border-[#C9A227] cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                  </button>
                </div>
                <select
                  value={convTo}
                  onChange={(e) => setConvTo(e.target.value as CurrencyCode)}
                  className="sm:col-span-4 px-2.5 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  {enabledList.map((c) => (
                    <option key={c} value={c}>{c} — {isAr ? getCurrencyMeta(c).nameAr : getCurrencyMeta(c).nameEn}</option>
                  ))}
                </select>
              </div>
            </div>
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

        {/* Country Tax Regime Preset Selector */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <p className="text-xs font-extrabold text-[#0A3D2C] dark:text-[#C9A227]">
              {isAr ? 'النظام الضريبي حسب الدولة' : 'Country Tax Regime'}
            </p>
            <p className="text-[11px] text-slate-500">
              {(() => {
                const reg = getCountryTaxRegime(state.settings.countryCode ?? 'SA');
                return `${isAr ? reg.taxAuthorityAr : reg.taxAuthorityEn} · ${reg.standardVatRate}% (${reg.defaultCurrency})`;
              })()}
            </p>
          </div>
          <select
            value={state.settings.countryCode ?? 'SA'}
            onChange={(e) => {
              const code = e.target.value as CountryCode;
              actions.applyCountryTaxRegime(code);
              const reg = getCountryTaxRegime(code);
              actions.notify(
                isAr
                  ? `تم تطبيق النظام الضريبي لـ ${reg.nameAr} (${reg.standardVatRate}% - ${reg.defaultCurrency})`
                  : `Applied ${reg.nameEn} tax regime (${reg.standardVatRate}% - ${reg.defaultCurrency})`,
              );
            }}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
          >
            {COUNTRY_TAX_REGIMES.map((r) => (
              <option key={r.countryCode} value={r.countryCode}>
                {r.countryCode} — {isAr ? r.nameAr : r.nameEn} ({r.standardVatRate}% VAT)
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-slate-500">{t.taxConfigHint}</p>
      </div>

      {/* Invoice Numbering, Print Configuration & Messaging Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
            <h3 className="text-base font-extrabold">
              {isAr ? 'إعدادات ترقيم وشروط الفواتير' : 'Invoice Numbering & Terms'}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-500">{isAr ? 'بادئة الترقيم' : 'Prefix'}</label>
              <input
                maxLength={12}
                value={state.settings.invoicePrefix ?? 'INV-'}
                onChange={(e) => actions.updateSettings({ invoicePrefix: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">{isAr ? 'صيغة الترقيم' : 'Number Format'}</label>
              <input
                maxLength={32}
                value={state.settings.invoiceNumberFormat ?? '{PREFIX}{NUM}'}
                onChange={(e) => actions.updateSettings({ invoiceNumberFormat: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">
              {isAr ? 'شروط وأحكام الفاتورة الافتراضية' : 'Default Invoice Terms'}
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={state.settings.invoiceTerms ?? ''}
              onChange={(e) => actions.updateSettings({ invoiceTerms: e.target.value })}
              placeholder={isAr ? 'البضاعة المباعة ترد وتستبدل خلال 7 أيام وفق الفاتورة...' : 'Goods returnable within 7 days with original receipt...'}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
            <h3 className="text-base font-extrabold">
              {isAr ? 'إعدادات الطباعة والرسائل' : 'Print & Messaging Settings'}
            </h3>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">{isAr ? 'حجم ورق الطباعة الافتراضي' : 'Default Paper Size'}</label>
            <select
              value={state.settings.printPaperSize ?? 'a4'}
              onChange={(e) =>
                actions.updateSettings({
                  printPaperSize: e.target.value as 'a4' | 'thermal_80' | 'thermal_58',
                })
              }
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
            >
              <option value="a4">{isAr ? 'ورق A4 قياسي' : 'Standard A4'}</option>
              <option value="thermal_80">{isAr ? 'حراري 80mm (كاشير)' : 'Thermal 80mm (POS)'}</option>
              <option value="thermal_58">{isAr ? 'حراري 58mm (محمول)' : 'Thermal 58mm (Mini)'}</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={state.settings.showQrOnPrint ?? true}
                onChange={(e) => actions.updateSettings({ showQrOnPrint: e.target.checked })}
                className="w-4 h-4 accent-[#0A3D2C] cursor-pointer"
              />
              <span>{isAr ? 'إظهار رمز QR بالطباعة' : 'Show ZATCA QR on Print'}</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={state.settings.showLogoOnPrint ?? true}
                onChange={(e) => actions.updateSettings({ showLogoOnPrint: e.target.checked })}
                className="w-4 h-4 accent-[#0A3D2C] cursor-pointer"
              />
              <span>{isAr ? 'إظهار الشعار بالطباعة' : 'Show Logo on Print'}</span>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div>
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{isAr ? 'إيميل الإرسال' : 'Sender Email'}</span>
              </label>
              <input
                type="email"
                maxLength={160}
                value={state.settings.senderEmail ?? state.settings.email}
                onChange={(e) => actions.updateSettings({ senderEmail: e.target.value })}
                className="mt-1 w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">
                {isAr ? 'قالب رسالة واتساب' : 'WhatsApp Message Template'}
              </label>
              <input
                maxLength={240}
                value={state.settings.whatsappTemplate ?? ''}
                onChange={(e) => actions.updateSettings({ whatsappTemplate: e.target.value })}
                placeholder={isAr ? 'مرحباً {customer}، فاتورتك رقم {id} بمبلغ {total}' : 'Hi {customer}, Invoice #{id} total {total}'}
                className="mt-1 w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3 overflow-x-auto">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
          <h3 className="text-base font-extrabold">{t.permissionsMatrix}</h3>
        </div>
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1F332B]">
              <th className="p-2.5 text-start">{isAr ? 'الصفحة' : 'Page'}</th>
              <th className="p-2.5 text-center">{t.roleOwner}</th>
              <th className="p-2.5 text-center">{t.roleAccountant}</th>
              <th className="p-2.5 text-center">{t.roleCashier}</th>
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

      {/* Team Invites (RBAC) & Push Notifications */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
            <div>
              <h3 className="text-base font-extrabold">{isAr ? 'دعوات الفريق والإشعارات الفورية' : 'Team Invites & Push Notifications'}</h3>
              <p className="text-[11px] text-slate-500">
                {isAr
                  ? 'ادعُ أعضاء فريقك بصلاحيات محددة عبر البريد الموثق وفعّل تنبيهات المتصفح'
                  : 'Invite workspace members with RBAC roles and enable push alerts'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={pushBusy}
            onClick={async () => {
              setPushBusy(true);
              try {
                const res = await actions.enablePushNotifications();
                actions.notify(
                  res.permission === 'granted'
                    ? isAr
                      ? 'تم تفعيل الإشعارات الفورية بنجاح'
                      : 'Push notifications enabled'
                    : isAr
                    ? `حالة الإشعارات: ${res.permission}`
                    : `Notification permission: ${res.permission}`,
                );
              } finally {
                setPushBusy(false);
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{isAr ? 'تفعيل الإشعارات الفورية' : 'Enable Push Alerts'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder={isAr ? 'البريد الإلكتروني للعضو *' : 'Team member email *'}
            className="sm:col-span-6 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as RoleId)}
            className="sm:col-span-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
          >
            <option value="owner">{t.roleOwner}</option>
            <option value="accountant">{t.roleAccountant}</option>
            <option value="cashier">{t.roleCashier}</option>
            <option value="salesman">{t.roleSalesman}</option>
            <option value="warehouse">{t.roleWarehouse}</option>
          </select>
          <button
            type="button"
            disabled={!user || sendingInvite}
            onClick={async () => {
              const clean = inviteEmail.trim();
              if (!clean || !clean.includes('@')) {
                actions.notify(isAr ? 'أدخل بريداً إلكترونياً صحيحاً *' : 'Enter a valid email *');
                return;
              }
              setSendingInvite(true);
              try {
                await actions.inviteWorkspaceMember(clean, inviteRole);
                setInviteEmail('');
              } finally {
                setSendingInvite(false);
              }
            }}
            className="sm:col-span-3 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isAr ? 'إرسال دعوة' : 'Send Invite'}</span>
          </button>
        </div>

        {!user && (
          <p className="text-[11px] text-amber-600 font-semibold">
            {isAr ? 'سجّل الدخول بحسابك السحابي لإرسال الدعوات وإدارتها.' : 'Sign in to Firebase Cloud to send and manage team invites.'}
          </p>
        )}

        {outgoingInvites.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-[#1F332B] border border-slate-200 dark:border-[#1F332B] rounded-xl overflow-hidden">
            {outgoingInvites.map((inv) => (
              <div key={inv.id} className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50/70 dark:bg-[#0A120F]/50">
                <div>
                  <span className="font-bold">{inv.email}</span>
                  <span className="text-[11px] text-slate-500 ms-2 font-mono">
                    {inv.role} · {inv.status}
                  </span>
                </div>
                {inv.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => void actions.revokePendingInvite(inv.id)}
                    className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 font-bold cursor-pointer"
                  >
                    {isAr ? 'إلغاء الدعوة' : 'Revoke'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
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
            onClick={() => setBulkImportOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#0A3D2C] dark:border-[#C9A227] text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{t.importDataBtn}</span>
          </button>
          <button
            onClick={() => setDangerConfirm('restoreDemo')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C9A227]/20 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.restoreDemo}</span>
          </button>
          {canDelete && (
            <button
              onClick={() => setDangerConfirm('deleteAll')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/10 text-red-600 text-xs font-bold cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.deleteAll}</span>
            </button>
          )}
        </div>

        {/* Firebase Cloud Daily Backups */}
        <div className="pt-3 border-t border-slate-100 dark:border-[#1F332B] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-extrabold text-slate-500">{t.cloudDailyBackup}</h4>
            <button
              type="button"
              disabled={!user || savingCloudBackup}
              onClick={async () => {
                setSavingCloudBackup(true);
                try {
                  const meta = await actions.saveCloudBackupNow();
                  actions.notify(
                    meta
                      ? isAr
                        ? `تم حفظ نسخة Firebase السحابية (${meta.dateKey})`
                        : `Saved Firebase cloud backup (${meta.dateKey})`
                      : isAr
                      ? 'سجل الدخول بحساب Google لحفظ نسخة سحابية'
                      : 'Sign in with Google to save cloud backups',
                  );
                } finally {
                  setSavingCloudBackup(false);
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>{t.backupNow}</span>
            </button>
          </div>
          {cloudBackups.length === 0 ? (
            <p className="text-xs text-slate-500">
              {user
                ? isAr
                  ? 'لا توجد نسخ سحابية يومية في Firebase بعد'
                  : 'No Firebase daily cloud backups saved yet'
                : t.cloudOfflineMode}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#1F332B] border border-slate-200 dark:border-[#1F332B] rounded-xl overflow-hidden max-h-44 overflow-y-auto">
              {cloudBackups.slice(0, 10).map((cb) => (
                <div
                  key={cb.id}
                  className="px-3.5 py-2 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#0A120F]/60 text-xs"
                >
                  <div className="font-mono tabular-nums">
                    <span className="font-bold">{cb.dateKey}</span>
                    <span className="text-slate-500 ms-2">
                      · {(cb.sizeBytes / 1024).toFixed(1)} KB · {cb.recordCount} {isAr ? 'سجل' : 'records'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await actions.restoreCloudBackupById(cb.id);
                      actions.notify(
                        ok
                          ? isAr
                            ? `تمت استعادة النسخة السحابية ${cb.dateKey}`
                            : `Restored cloud backup ${cb.dateKey}`
                          : isAr
                          ? 'تعذر استعادة النسخة السحابية'
                          : 'Could not restore cloud backup',
                      );
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0A3D2C] text-white font-bold cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{t.restoreSnapshot}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily IndexedDB Snapshot History */}
        <div className="pt-3 border-t border-slate-100 dark:border-[#1F332B] space-y-2">
          <h4 className="text-xs font-extrabold text-slate-500">{t.dailySnapshotsTitle}</h4>
          {idbSnapshots.length === 0 ? (
            <p className="text-xs text-slate-500">{t.snapshotEmpty}</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#1F332B] border border-slate-200 dark:border-[#1F332B] rounded-xl overflow-hidden max-h-52 overflow-y-auto">
              {idbSnapshots.slice(0, 10).map((snap) => (
                <div
                  key={snap.dateKey}
                  className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#0A120F]/60 text-xs"
                >
                  <div className="font-mono tabular-nums">
                    <span className="font-bold text-slate-800 dark:text-slate-100">{snap.dateKey}</span>
                    <span className="text-slate-500 ms-2">
                      · {(snap.sizeBytes / 1024).toFixed(1)} KB · {snap.createdAt.slice(11, 16)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        const rec = await actions.getDailySnapshotByDate(snap.dateKey);
                        if (rec) {
                          downloadTextFile(`ostora_backup_${rec.dateKey}.json`, rec.json, 'application/json');
                          actions.notify(
                            isAr ? `تم تنزيل نسخة ${rec.dateKey}` : `Downloaded ${rec.dateKey} snapshot`,
                          );
                        }
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] font-bold cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>{t.downloadSnapshot}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestoreSnapshotKey(snap.dateKey)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0A3D2C] text-white font-bold cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{t.restoreSnapshot}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
      {/* Confirm Daily Snapshot Restore Modal */}
      {restoreSnapshotKey && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold">{t.restoreSnapshot} · {restoreSnapshotKey}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t.confirmRestoreSnapshotMsg}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setRestoreSnapshotKey(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={async () => {
                  const key = restoreSnapshotKey;
                  setRestoreSnapshotKey(null);
                  const ok = await actions.restoreDailySnapshotByDate(key);
                  actions.notify(
                    ok
                      ? isAr
                        ? `تمت استعادة لقطة ${key} بنجاح`
                        : `Restored ${key} snapshot successfully`
                      : isAr
                      ? 'تعذر استعادة اللقطة المحددة'
                      : 'Could not restore selected snapshot',
                  );
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
              >
                {t.restoreSnapshot}
              </button>
            </div>
          </div>
        </div>
      )}

      {branchModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-md w-full p-6 space-y-3">
            <h3 className="text-lg font-extrabold">{branchModal.editId ? t.edit : t.addBranch}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                value={branchForm.nameAr}
                onChange={(e) => setBranchForm({ ...branchForm, nameAr: e.target.value })}
                placeholder={isAr ? 'اسم الفرع (عربي)' : 'Branch Name (AR)'}
                className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              />
              <input
                value={branchForm.nameEn}
                onChange={(e) => setBranchForm({ ...branchForm, nameEn: e.target.value })}
                placeholder={isAr ? 'اسم الفرع (انجليزي)' : 'Branch Name (EN)'}
                className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              />
              <input
                value={branchForm.city}
                onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                placeholder={isAr ? 'المدينة' : 'City'}
                className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              />
              <input
                value={branchForm.phone}
                onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                placeholder={t.phone}
                className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              />
            </div>
            <input
              value={branchForm.managerName}
              onChange={(e) => setBranchForm({ ...branchForm, managerName: e.target.value })}
              placeholder={isAr ? 'مدير الفرع' : 'Branch Manager'}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBranchModal({ open: false })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  const nameAr = branchForm.nameAr.trim() || branchForm.nameEn.trim();
                  const nameEn = branchForm.nameEn.trim() || branchForm.nameAr.trim();
                  if (!nameAr || !nameEn) return;
                  actions.saveBranch(
                    {
                      nameAr,
                      nameEn,
                      city: branchForm.city.trim(),
                      phone: branchForm.phone.trim(),
                      managerName: branchForm.managerName.trim(),
                      isMain: branchForm.isMain,
                      active: branchForm.active,
                    },
                    branchModal.editId,
                  );
                  setBranchModal({ open: false });
                  actions.notify(isAr ? 'تم حفظ بيانات الفرع' : 'Branch saved');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      <DataImportModal
        open={bulkImportOpen}
        defaultEntity="customers"
        allowEntitySwitch={true}
        store={store}
        onClose={() => setBulkImportOpen(false)}
      />
    </div>
  );
};
