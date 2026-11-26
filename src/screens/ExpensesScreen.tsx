import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Edit2,
  FileImage,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { strings } from '../data/translations';
import { getExpenseBaseAmount } from '../domain/accounting';
import { fromHalalas, mulFxHalalas, toHalalas } from '../domain/halala';
import {
  CurrencyCode,
  ExpenseStatus,
  ExpenseType,
  PaymentMethodType,
} from '../types/erp';
import { DEFAULT_ENABLED_CURRENCIES, formatCurrency, getCurrencyMeta } from '../utils/currencies';
import { compressImageToBase64 } from '../utils/image';
import { ScreenProps } from './types';

export const ExpensesScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const enabledCurrencies = Array.from(
    new Set<CurrencyCode>([cur, ...(state.settings.enabledCurrencies ?? DEFAULT_ENABLED_CURRENCIES)]),
  );
  const ratesMap = state.settings.exchangeRates ?? {};

  const [expSearch, setExpSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ExpenseType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ExpenseStatus>('all');
  const [expModal, setExpModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [refreshingFx, setRefreshingFx] = useState(false);
  const [formError, setFormError] = useState('');

  const nextExpenseNumber = useMemo(() => {
    const nums = state.expenses
      .map((e) => {
        const m = (e.expenseNumber || e.id).match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => Number.isFinite(n));
    return `EXP-${new Date().getFullYear()}-${String(Math.max(900, ...nums) + 1).padStart(4, '0')}`;
  }, [state.expenses]);

  const [expForm, setExpForm] = useState<{
    expenseNumber: string;
    date: string;
    expenseType: ExpenseType;
    title: string;
    category: string;
    beneficiary: string;
    branchId: string;
    costCenter: string;
    amount: string;
    currency: CurrencyCode;
    exchangeRate: string;
    paymentMethod: PaymentMethodType;
    paidFromBankId: string;
    status: ExpenseStatus;
    attachmentBase64: string;
    notes: string;
    isRecurringMonthly: boolean;
    reminderDate: string;
  }>({
    expenseNumber: '',
    date: new Date().toISOString().slice(0, 10),
    expenseType: 'other',
    title: '',
    category: '',
    beneficiary: '',
    branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
    costCenter: 'CC-MAIN',
    amount: '',
    currency: cur,
    exchangeRate: '1',
    paymentMethod: 'cash',
    paidFromBankId: state.banks[0]?.id ?? 'cash',
    status: 'paid',
    attachmentBase64: '',
    notes: '',
    isRecurringMonthly: false,
    reminderDate: '',
  });

  // Sync exchange rate automatically when base rates update for new expenses
  useEffect(() => {
    if (!expModal.open || expModal.editId) return;
    if (expForm.currency === cur) {
      setExpForm((f) => (f.exchangeRate === '1' ? f : { ...f, exchangeRate: '1' }));
      return;
    }
    const latestRate = ratesMap[expForm.currency];
    if (latestRate && latestRate > 0) {
      setExpForm((f) => ({ ...f, exchangeRate: String(latestRate) }));
    }
  }, [expModal.open, expModal.editId, expForm.currency, cur, ratesMap]);

  const expenseTypeLabel = (type?: ExpenseType) => {
    switch (type) {
      case 'rent':
        return isAr ? 'إيجار' : 'Rent';
      case 'electricity':
        return isAr ? 'كهرباء ومرافق' : 'Electricity';
      case 'salaries':
        return isAr ? 'رواتب' : 'Salaries';
      case 'maintenance':
        return isAr ? 'صيانة' : 'Maintenance';
      case 'marketing':
        return isAr ? 'تسويق' : 'Marketing';
      default:
        return isAr ? 'أخرى' : 'Other';
    }
  };

  const statusBadge = (st?: ExpenseStatus) => {
    const s = st ?? 'paid';
    if (s === 'draft') {
      return {
        label: isAr ? 'مسودة' : 'Draft',
        cls: 'bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
    }
    if (s === 'approved') {
      return {
        label: isAr ? 'معتمد' : 'Approved',
        cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
      };
    }
    return {
      label: isAr ? 'مدفوع' : 'Paid',
      cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    };
  };

  const categories = Array.from(new Set(state.expenses.map((e) => e.category).filter(Boolean)));
  const q = expSearch.trim().toLowerCase();
  const visibleExpenses = state.expenses.filter((e) => {
    if (catFilter !== 'all' && e.category !== catFilter) return false;
    if (typeFilter !== 'all' && (e.expenseType ?? 'other') !== typeFilter) return false;
    if (statusFilter !== 'all' && (e.status ?? 'paid') !== statusFilter) return false;
    if (!q) return true;
    return (
      e.title.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      (e.expenseNumber ?? '').toLowerCase().includes(q) ||
      (e.beneficiary ?? '').toLowerCase().includes(q) ||
      (e.costCenter ?? '').toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q)
    );
  });

  const totalShown = fromHalalas(
    visibleExpenses.reduce((sumH, e) => sumH + toHalalas(getExpenseBaseAmount(e)), 0),
  );

  const bankLabel = (bankId: string) => {
    const found = state.banks.find((b) => b.id === bankId);
    if (!found) return bankId;
    return isAr ? found.nameAr : found.nameEn;
  };

  const parsedFx = parseFloat(expForm.exchangeRate);
  const activeFxRate =
    expForm.currency === cur ? 1 : Number.isFinite(parsedFx) && parsedFx > 0 ? parsedFx : ratesMap[expForm.currency] ?? 1;
  const parsedAmt = parseFloat(expForm.amount) || 0;
  const equivBaseAmt = fromHalalas(
    expForm.currency === cur ? toHalalas(parsedAmt) : mulFxHalalas(toHalalas(parsedAmt), activeFxRate),
  );

  const canDelete = state.currentRole !== 'accountant';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={expSearch}
            onChange={(e) => setExpSearch(e.target.value)}
            placeholder={isAr ? 'بحث برقم المصروف، البيان، المستفيد، أو مركز التكلفة...' : 'Search expense#, title, beneficiary, or cost center...'}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2">
          <span className="text-slate-500">{t.totalExpensesLabel}:</span>
          <span className="font-mono text-red-600 font-extrabold tabular-nums">
            {formatCurrency(totalShown, cur, { isAr })}
          </span>
        </div>
        <button
          onClick={() => {
            setFormError('');
            setExpForm({
              expenseNumber: nextExpenseNumber,
              date: new Date().toISOString().slice(0, 10),
              expenseType: 'other',
              title: '',
              category: isAr ? 'تشغيل' : 'Operations',
              beneficiary: '',
              branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
              costCenter: 'CC-MAIN',
              amount: '',
              currency: cur,
              exchangeRate: '1',
              paymentMethod: 'cash',
              paidFromBankId: state.banks[0]?.id ?? 'cash',
              status: 'paid',
              attachmentBase64: '',
              notes: '',
              isRecurringMonthly: false,
              reminderDate: '',
            });
            setExpModal({ open: true });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#C9A227]" />
          <span>{t.addExpense}</span>
        </button>
      </div>

      {/* Filters Row */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-3 flex flex-wrap items-center gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | ExpenseType)}
          className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الأنواع' : 'All Types'}</option>
          <option value="rent">{expenseTypeLabel('rent')}</option>
          <option value="electricity">{expenseTypeLabel('electricity')}</option>
          <option value="salaries">{expenseTypeLabel('salaries')}</option>
          <option value="maintenance">{expenseTypeLabel('maintenance')}</option>
          <option value="marketing">{expenseTypeLabel('marketing')}</option>
          <option value="other">{expenseTypeLabel('other')}</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | ExpenseStatus)}
          className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الحالات' : 'All Statuses'}</option>
          <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
          <option value="approved">{isAr ? 'معتمد' : 'Approved'}</option>
          <option value="paid">{isAr ? 'مدفوع' : 'Paid'}</option>
        </select>

        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setCatFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                catFilter === 'all' ? 'bg-[#0A3D2C] text-white' : 'bg-slate-100 dark:bg-[#0A120F] text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.all}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  catFilter === cat ? 'bg-[#0A3D2C] text-white' : 'bg-slate-100 dark:bg-[#0A120F] text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] divide-y divide-slate-100 dark:divide-[#1F332B]">
        {visibleExpenses.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">{t.noData}</p>
        ) : (
          visibleExpenses.map((e) => {
            const st = statusBadge(e.status);
            const expCur = e.currency ?? cur;
            const brName = state.branches.find((b) => b.id === e.branchId)?.[isAr ? 'nameAr' : 'nameEn'];
            return (
              <div key={e.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-[#C9A227]">{e.expenseNumber ?? e.id}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-[#0A120F] text-slate-600 dark:text-slate-300">
                      {expenseTypeLabel(e.expenseType)}
                    </span>
                    {e.isRecurringMonthly && (
                      <span className="text-[10px] text-[#0A3D2C] dark:text-[#C9A227] font-bold flex items-center gap-0.5">
                        <Repeat className="w-3 h-3" /> {isAr ? 'شهري' : 'Monthly'}
                      </span>
                    )}
                    {e.reminderDate && (
                      <span className="text-[10px] text-amber-600 font-mono flex items-center gap-0.5">
                        <Bell className="w-3 h-3" /> {e.reminderDate}
                      </span>
                    )}
                    {e.attachmentBase64 && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                        <FileImage className="w-3 h-3" /> {isAr ? 'مرفق' : 'Receipt'}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm truncate">{e.title}</h4>
                  <p className="text-xs text-slate-500">
                    {e.category}
                    {e.beneficiary ? ` · ${e.beneficiary}` : ''}
                    {` · ${bankLabel(e.paidFromBankId)}`}
                    {brName ? ` · ${brName}` : ''}
                    {e.costCenter ? ` · ${e.costCenter}` : ''}
                    {` · ${new Date(e.date).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-end">
                    <span className="font-mono font-extrabold text-sm text-red-600 tabular-nums block">
                      {formatCurrency(e.amount, expCur, { isAr })}
                    </span>
                    {expCur !== cur && (
                      <span className="text-[10px] font-mono text-slate-400 tabular-nums block">
                        ≈ {formatCurrency(getExpenseBaseAmount(e), cur, { isAr })}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setFormError('');
                      setExpForm({
                        expenseNumber: e.expenseNumber ?? e.id,
                        date: e.date.slice(0, 10),
                        expenseType: e.expenseType ?? 'other',
                        title: e.title,
                        category: e.category,
                        beneficiary: e.beneficiary ?? '',
                        branchId: e.branchId ?? state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
                        costCenter: e.costCenter ?? 'CC-MAIN',
                        amount: String(e.amount),
                        currency: expCur,
                        exchangeRate: String(e.exchangeRate ?? (expCur === cur ? 1 : ratesMap[expCur] ?? 1)),
                        paymentMethod: e.paymentMethod ?? 'cash',
                        paidFromBankId: e.paidFromBankId || state.banks[0]?.id || 'cash',
                        status: e.status ?? 'paid',
                        attachmentBase64: e.attachmentBase64 ?? '',
                        notes: e.notes ?? '',
                        isRecurringMonthly: Boolean(e.isRecurringMonthly),
                        reminderDate: e.reminderDate ?? '',
                      });
                      setExpModal({ open: true, editId: e.id });
                    }}
                    aria-label={t.edit}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => actions.deleteExpense(e.id)}
                      aria-label={t.delete}
                      className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {expModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-2xl w-full p-6 space-y-3 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">{expModal.editId ? t.edit : t.addExpense}</h3>
              <button
                type="button"
                onClick={() => setExpModal({ open: false })}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs font-bold text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'رقم المصروف' : 'Expense#'}</label>
                <input
                  value={expForm.expenseNumber}
                  onChange={(e) => setExpForm({ ...expForm, expenseNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.date} *</label>
                <input
                  type="date"
                  value={expForm.date}
                  onChange={(e) => setExpForm({ ...expForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'نوع المصروف' : 'Expense Type'}</label>
                <select
                  value={expForm.expenseType}
                  onChange={(e) => {
                    const nextType = e.target.value as ExpenseType;
                    setExpForm({
                      ...expForm,
                      expenseType: nextType,
                      category: expenseTypeLabel(nextType),
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="rent">{expenseTypeLabel('rent')}</option>
                  <option value="electricity">{expenseTypeLabel('electricity')}</option>
                  <option value="salaries">{expenseTypeLabel('salaries')}</option>
                  <option value="maintenance">{expenseTypeLabel('maintenance')}</option>
                  <option value="marketing">{expenseTypeLabel('marketing')}</option>
                  <option value="other">{expenseTypeLabel('other')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.reason} *</label>
                <input
                  value={expForm.title}
                  maxLength={160}
                  onChange={(e) => {
                    setFormError('');
                    setExpForm({ ...expForm, title: e.target.value });
                  }}
                  placeholder={isAr ? 'بيان المصروف' : 'Expense description'}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'المستفيد' : 'Beneficiary'}</label>
                <input
                  value={expForm.beneficiary}
                  maxLength={160}
                  onChange={(e) => setExpForm({ ...expForm, beneficiary: e.target.value })}
                  placeholder={isAr ? 'اسم الجهة أو المورد المستفيد' : 'Beneficiary name'}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.category}</label>
                <input
                  value={expForm.category}
                  maxLength={80}
                  onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                  placeholder={t.category}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.branch}</label>
                <select
                  value={expForm.branchId}
                  onChange={(e) => setExpForm({ ...expForm, branchId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  {state.branches.map((b) => (
                    <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'مركز التكلفة' : 'Cost Center'}</label>
                <input
                  value={expForm.costCenter}
                  maxLength={120}
                  onChange={(e) => setExpForm({ ...expForm, costCenter: e.target.value })}
                  placeholder="CC-MAIN"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            </div>

            {/* Amount, Multi-Currency & Live Rate */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B]">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.amount} *</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={expForm.amount}
                  onChange={(e) => {
                    setFormError('');
                    setExpForm({ ...expForm, amount: e.target.value });
                  }}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'العملة' : 'Currency'}</label>
                <select
                  value={expForm.currency}
                  onChange={(e) => {
                    const nextC = e.target.value as CurrencyCode;
                    const fx = nextC === cur ? 1 : ratesMap[nextC] ?? 1;
                    setExpForm({ ...expForm, currency: nextC, exchangeRate: String(fx) });
                  }}
                  className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  {Array.from(new Set<CurrencyCode>([...enabledCurrencies, expForm.currency])).map((code) => {
                    const meta = getCurrencyMeta(code);
                    return (
                      <option key={code} value={code}>{code} — {isAr ? meta.nameAr : meta.nameEn}</option>
                    );
                  })}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[10px] font-bold text-slate-500">{t.exchangeRate}</label>
                  {expForm.currency !== cur && (
                    <button
                      type="button"
                      disabled={refreshingFx}
                      onClick={async () => {
                        setRefreshingFx(true);
                        try {
                          const res = await actions.refreshLiveExchangeRates(cur);
                          const live = res.rates[expForm.currency];
                          if (live) setExpForm((f) => ({ ...f, exchangeRate: String(live) }));
                        } finally {
                          setRefreshingFx(false);
                        }
                      }}
                      className="text-[10px] font-bold text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshingFx ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min={0.0001}
                  step={0.0001}
                  disabled={expForm.currency === cur}
                  value={expForm.exchangeRate}
                  onChange={(e) => setExpForm({ ...expForm, exchangeRate: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-mono disabled:opacity-60"
                />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-500">{isAr ? 'المعادل بالأساسية' : 'Base Equiv.'}</span>
                <span className="text-xs font-extrabold font-mono text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
                  {formatCurrency(equivBaseAmt, cur, { isAr })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.paymentMethodLabel}</label>
                <select
                  value={expForm.paymentMethod}
                  onChange={(e) => setExpForm({ ...expForm, paymentMethod: e.target.value as PaymentMethodType })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="cash">{t.payCash}</option>
                  <option value="pos_card">{t.payCard}</option>
                  <option value="transfer">{t.payTransfer}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.paidFromAccount}</label>
                <select
                  value={expForm.paidFromBankId}
                  onChange={(e) => setExpForm({ ...expForm, paidFromBankId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  {state.banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {isAr ? b.nameAr : b.nameEn} ({formatCurrency(b.balance, b.currency ?? cur, { isAr })})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.status}</label>
                <select
                  value={expForm.status}
                  onChange={(e) => setExpForm({ ...expForm, status: e.target.value as ExpenseStatus })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
                  <option value="approved">{isAr ? 'معتمد' : 'Approved'}</option>
                  <option value="paid">{isAr ? 'مدفوع' : 'Paid'}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B]">
                <input
                  type="checkbox"
                  checked={expForm.isRecurringMonthly}
                  onChange={(e) => setExpForm({ ...expForm, isRecurringMonthly: e.target.checked })}
                />
                <span>{isAr ? 'تكرار المصروف شهرياً' : 'Recurring Monthly'}</span>
              </label>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'تاريخ التنبيه' : 'Reminder Date'}</label>
                <input
                  type="date"
                  value={expForm.reminderDate}
                  onChange={(e) => setExpForm({ ...expForm, reminderDate: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#1F332B] text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-[#0A120F]">
                <Upload className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                <span>{expForm.attachmentBase64 ? (isAr ? 'تم إرفاق الفاتورة ✓' : 'Receipt Attached ✓') : (isAr ? 'مرفق فاتورة المصروف' : 'Attach Receipt')}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const compressed = await compressImageToBase64(file);
                    setExpForm((prev) => ({ ...prev, attachmentBase64: compressed }));
                  }}
                />
              </label>
            </div>

            {expForm.attachmentBase64 && (
              <div className="flex items-center gap-2">
                <img src={expForm.attachmentBase64} alt="Receipt" className="h-14 rounded-lg border border-slate-200 dark:border-[#1F332B]" />
                <button
                  type="button"
                  onClick={() => setExpForm({ ...expForm, attachmentBase64: '' })}
                  className="text-xs text-red-600 font-bold cursor-pointer"
                >
                  {isAr ? 'إزالة المرفق' : 'Remove'}
                </button>
              </div>
            )}

            <textarea
              rows={2}
              maxLength={500}
              value={expForm.notes}
              onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })}
              placeholder={t.notes}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setExpModal({ open: false })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  const amt = parseFloat(expForm.amount) || 0;
                  if (!expForm.title.trim()) {
                    setFormError(isAr ? 'بيان المصروف إلزامي *' : 'Expense title is required *');
                    return;
                  }
                  if (amt <= 0) {
                    setFormError(isAr ? 'المبلغ إلزامي ويجب أن يكون أكبر من صفر *' : 'Amount must be > 0 *');
                    return;
                  }
                  actions.saveExpense(
                    {
                      expenseNumber: expForm.expenseNumber.trim() || nextExpenseNumber,
                      title: expForm.title.trim(),
                      category: expForm.category.trim() || expenseTypeLabel(expForm.expenseType),
                      expenseType: expForm.expenseType,
                      beneficiary: expForm.beneficiary.trim() || undefined,
                      branchId: expForm.branchId || undefined,
                      costCenter: expForm.costCenter.trim() || undefined,
                      amount: amt,
                      currency: expForm.currency,
                      exchangeRate: activeFxRate,
                      baseAmount: equivBaseAmt,
                      paymentMethod: expForm.paymentMethod,
                      paidFromBankId: expForm.paidFromBankId || 'cash',
                      status: expForm.status,
                      date: expForm.date ? new Date(expForm.date).toISOString() : new Date().toISOString(),
                      attachmentBase64: expForm.attachmentBase64 || undefined,
                      notes: expForm.notes.trim() || undefined,
                      isRecurringMonthly: expForm.isRecurringMonthly,
                      reminderDate: expForm.reminderDate || undefined,
                    },
                    expModal.editId,
                  );
                  setExpModal({ open: false });
                  actions.notify(
                    expForm.status === 'draft'
                      ? isAr
                        ? 'تم حفظ المصروف كمسودة دون خصم الرصيد'
                        : 'Expense saved as draft'
                      : isAr
                      ? 'تم حفظ المصروف وترحيل القيد المحاسبي وتحديث الرصيد'
                      : 'Expense saved, journal posted & account updated',
                  );
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
