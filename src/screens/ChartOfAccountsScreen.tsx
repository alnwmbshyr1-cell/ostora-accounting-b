import React, { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Edit2, FolderTree, Plus, Search, Trash2, X } from 'lucide-react';
import { strings } from '../data/translations';
import { computeAccountLedger } from '../domain/accounting';
import { AccountCategory, ChartAccount } from '../types/erp';
import { ScreenProps } from './types';

const CATEGORY_ORDER: AccountCategory[] = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];

export const ChartOfAccountsScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];
  const cur = state.settings.currency;
  const canDelete = state.currentRole !== 'accountant';

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | AccountCategory>('all');
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const [collapsedCodes, setCollapsedCodes] = useState<string[]>([]);
  const [modalState, setModalState] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [ledgerAccount, setLedgerAccount] = useState<ChartAccount | null>(null);
  const [formError, setFormError] = useState('');

  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState<AccountCategory>('assets');
  const [parentCode, setParentCode] = useState('1000');
  const [level, setLevel] = useState('2');
  const [normalBalance, setNormalBalance] = useState<'debit' | 'credit'>('debit');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [costCenter, setCostCenter] = useState('');
  const [branchId, setBranchId] = useState(state.branches[0]?.id ?? '');
  const [allowPosting, setAllowPosting] = useState(true);
  const [notes, setNotes] = useState('');

  const categoryLabels: Record<AccountCategory, { ar: string; en: string; color: string }> = {
    assets: { ar: 'الأصول (Assets)', en: 'Assets', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
    liabilities: { ar: 'الخصوم (Liabilities)', en: 'Liabilities', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
    equity: { ar: 'حقوق الملكية (Equity)', en: 'Equity', color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
    revenue: { ar: 'الإيرادات (Revenue)', en: 'Revenue', color: 'bg-teal-500/10 text-teal-700 dark:text-teal-300' },
    expenses: { ar: 'المصروفات (Expenses)', en: 'Expenses', color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  };

  const defaultNormalBalance = (cat: AccountCategory): 'debit' | 'credit' =>
    cat === 'assets' || cat === 'expenses' ? 'debit' : 'credit';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.chartOfAccounts
      .filter((a) => catFilter === 'all' || a.category === catFilter)
      .filter(
        (a) =>
          !q ||
          a.code.toLowerCase().includes(q) ||
          a.nameAr.toLowerCase().includes(q) ||
          a.nameEn.toLowerCase().includes(q) ||
          (a.costCenter ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [state.chartOfAccounts, query, catFilter]);

  const ledgerData = useMemo(() => {
    if (!ledgerAccount) return null;
    return computeAccountLedger(ledgerAccount.code, state.journals);
  }, [ledgerAccount, state.journals]);

  const openAddChild = (parent?: ChartAccount) => {
    setFormError('');
    if (parent) {
      const siblingCodes = state.chartOfAccounts
        .filter((a) => a.parentCode === parent.code)
        .map((a) => parseInt(a.code, 10))
        .filter((n) => !Number.isNaN(n));
      const baseCode = parseInt(parent.code, 10);
      const nextChildCode =
        siblingCodes.length > 0
          ? String(Math.max(...siblingCodes) + 1)
          : !Number.isNaN(baseCode)
          ? String(baseCode + 1)
          : `${parent.code}1`;
      setCode(nextChildCode);
      setCategory(parent.category);
      setParentCode(parent.code);
      setLevel(String((parent.level ?? 1) + 1));
      setNormalBalance(parent.normalBalance ?? defaultNormalBalance(parent.category));
    } else {
      setCode('');
      setCategory('assets');
      setParentCode('1000');
      setLevel('2');
      setNormalBalance('debit');
    }
    setNameAr('');
    setNameEn('');
    setOpeningBalance('0');
    setCostCenter('');
    setBranchId(state.branches[0]?.id ?? '');
    setAllowPosting(true);
    setNotes('');
    setModalState({ open: true });
  };

  const openEditAccount = (acc: ChartAccount) => {
    setFormError('');
    setCode(acc.code);
    setNameAr(acc.nameAr);
    setNameEn(acc.nameEn);
    setCategory(acc.category);
    setParentCode(acc.parentCode ?? '');
    setLevel(String(acc.level ?? (acc.parentCode ? 2 : 1)));
    setNormalBalance(acc.normalBalance ?? defaultNormalBalance(acc.category));
    setOpeningBalance(String(acc.openingBalance ?? 0));
    setCostCenter(acc.costCenter ?? '');
    setBranchId(acc.branchId ?? state.branches[0]?.id ?? '');
    setAllowPosting(acc.allowPosting !== false);
    setNotes(acc.notes ?? '');
    setModalState({ open: true, editId: acc.id });
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !nameAr.trim()) {
      setFormError(isAr ? 'رمز الحساب والاسم العربي إلزاميان *' : 'Account code and name are required *');
      return;
    }
    const existing = modalState.editId ? state.chartOfAccounts.find((a) => a.id === modalState.editId) : undefined;
    actions.saveChartAccount(
      {
        code: code.trim(),
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || nameAr.trim(),
        category,
        parentCode: parentCode.trim() || undefined,
        level: Math.max(1, parseInt(level, 10) || 1),
        normalBalance,
        openingBalance: parseFloat(openingBalance) || 0,
        costCenter: costCenter.trim() || undefined,
        branchId: branchId || undefined,
        allowPosting,
        notes: notes.trim() || undefined,
        isSystem: existing?.isSystem ?? false,
      },
      modalState.editId,
    );
    setModalState({ open: false });
    actions.notify(isAr ? 'تم حفظ الحساب في الشجرة بنجاح' : 'Account saved in Chart of Accounts');
  };

  const toggleCollapse = (accCode: string) => {
    setCollapsedCodes((prev) =>
      prev.includes(accCode) ? prev.filter((c) => c !== accCode) : [...prev, accCode],
    );
  };

  const rootAccounts = filtered.filter((a) => !a.parentCode);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, ChartAccount[]>();
    for (const acc of filtered) {
      if (acc.parentCode) {
        const list = map.get(acc.parentCode) ?? [];
        list.push(acc);
        map.set(acc.parentCode, list);
      }
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#0A3D2C] text-[#C9A227] flex items-center justify-center">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold">{t.chart_of_accounts}</h2>
            <p className="text-[11px] text-slate-500">
              {isAr
                ? `${state.chartOfAccounts.length} حساب موحد: أصول، خصوم، حقوق ملكية، إيرادات، مصاريف`
                : `${state.chartOfAccounts.length} unified accounts across 5 IFRS categories`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-[#0A120F]">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${viewMode === 'table' ? 'bg-[#0A3D2C] text-white' : ''}`}
            >
              {isAr ? 'جدول' : 'Table'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${viewMode === 'tree' ? 'bg-[#0A3D2C] text-white' : ''}`}
            >
              {isAr ? 'شجري' : 'Tree'}
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search}
              className="ps-8 pe-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => openAddChild()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#C9A227]" />
            <span>{t.addAccount}</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCatFilter('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
            catFilter === 'all'
              ? 'bg-[#0A3D2C] text-white'
              : 'bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B]'
          }`}
        >
          {t.all} ({state.chartOfAccounts.length})
        </button>
        {CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCatFilter(cat)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              catFilter === cat
                ? 'bg-[#0A3D2C] text-white'
                : 'bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B]'
            }`}
          >
            {isAr ? categoryLabels[cat].ar : categoryLabels[cat].en}
          </button>
        ))}
      </div>

      {viewMode === 'tree' ? (
        <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 space-y-2">
          {(rootAccounts.length > 0 ? rootAccounts : filtered).map((root) => {
            const children = childrenByParent.get(root.code) ?? [];
            const isCollapsed = collapsedCodes.includes(root.code);
            const rootSummary = computeAccountLedger(root.code, state.journals);
            return (
              <div key={root.id} className="border border-slate-100 dark:border-[#1F332B] rounded-xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50/70 dark:bg-[#0E1814]">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(root.code)}
                    className="flex items-center gap-2 text-start cursor-pointer"
                  >
                    {children.length > 0 ? (
                      isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    ) : (
                      <span className="w-4" />
                    )}
                    <span className="font-mono font-bold text-[#0A3D2C] dark:text-[#C9A227]">{root.code}</span>
                    <span className="font-extrabold text-sm">{isAr ? root.nameAr : root.nameEn}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${categoryLabels[root.category].color}`}>
                      {isAr ? categoryLabels[root.category].ar : categoryLabels[root.category].en}
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold tabular-nums">
                      {rootSummary.netBalance.toLocaleString()} {cur}
                    </span>
                    <button
                      type="button"
                      onClick={() => openAddChild(root)}
                      className="px-2 py-1 rounded-lg bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227] text-[11px] font-bold cursor-pointer"
                    >
                      + {isAr ? 'حساب فرعي' : 'Sub'}
                    </button>
                  </div>
                </div>
                {!isCollapsed && children.length > 0 && (
                  <div className="divide-y divide-slate-100 dark:divide-[#1F332B]">
                    {children.map((child) => {
                      const summary = computeAccountLedger(child.code, state.journals);
                      return (
                        <div key={child.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5 ps-9 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-500">↳ {child.code}</span>
                            <span className="font-bold">{isAr ? child.nameAr : child.nameEn}</span>
                            {child.costCenter && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0A120F] text-[10px]">
                                {child.costCenter}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold tabular-nums">
                              {summary.netBalance.toLocaleString()} {cur}
                            </span>
                            <button
                              type="button"
                              onClick={() => setLedgerAccount(child)}
                              className="px-2 py-1 rounded bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227] font-bold cursor-pointer"
                            >
                              {t.generalLedger}
                            </button>
                            <button type="button" onClick={() => openEditAccount(child)} className="p-1 text-slate-500 cursor-pointer">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-[#0A120F] text-slate-500 border-b border-slate-200 dark:border-[#1F332B]">
                <tr>
                  <th className="p-3 text-start font-bold">{isAr ? 'رمز الحساب' : 'Code'}</th>
                  <th className="p-3 text-start font-bold">{t.account}</th>
                  <th className="p-3 text-start font-bold">{t.category}</th>
                  <th className="p-3 text-start font-bold">{isAr ? 'الطبيعة / مركز التكلفة' : 'Normal / CC'}</th>
                  <th className="p-3 text-end font-bold">{t.debit}</th>
                  <th className="p-3 text-end font-bold">{t.credit}</th>
                  <th className="p-3 text-end font-bold">{isAr ? 'الرصيد' : 'Balance'}</th>
                  <th className="p-3 text-center font-bold">{t.generalLedger}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
                {filtered.map((acc) => {
                  const summary = computeAccountLedger(acc.code, state.journals);
                  const isRoot = !acc.parentCode;
                  const nb = acc.normalBalance ?? defaultNormalBalance(acc.category);
                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-[#1A2C24]/50 ${
                        isRoot ? 'bg-slate-50/40 dark:bg-[#0E1814] font-extrabold' : ''
                      }`}
                    >
                      <td className="p-3 font-mono font-bold text-[#0A3D2C] dark:text-[#C9A227]">
                        {acc.parentCode ? `↳ ${acc.code}` : acc.code}
                      </td>
                      <td className="p-3">
                        <p className="font-bold">{isAr ? acc.nameAr : acc.nameEn}</p>
                        <p className="text-[10px] text-slate-400">{isAr ? acc.nameEn : acc.nameAr}</p>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${categoryLabels[acc.category].color}`}>
                          {isAr ? categoryLabels[acc.category].ar : categoryLabels[acc.category].en}
                        </span>
                      </td>
                      <td className="p-3 text-[11px]">
                        <span className="font-bold">{nb === 'debit' ? t.debit : t.credit}</span>
                        {acc.costCenter && <span className="block text-slate-400">{acc.costCenter}</span>}
                      </td>
                      <td className="p-3 text-end font-mono tabular-nums">{summary.totalDebit.toLocaleString()}</td>
                      <td className="p-3 text-end font-mono tabular-nums">{summary.totalCredit.toLocaleString()}</td>
                      <td className="p-3 text-end font-mono font-extrabold tabular-nums">
                        {summary.netBalance.toLocaleString()} {cur}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openAddChild(acc)}
                            title={isAr ? 'إضافة حساب فرعي' : 'Add Child Account'}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLedgerAccount(acc)}
                            className="px-2 py-1.5 rounded-lg bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{t.generalLedger}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditAccount(acc)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] text-slate-500 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!acc.isSystem && canDelete && (
                            <button
                              type="button"
                              onClick={() => actions.deleteChartAccount(acc.id)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Account Modal */}
      {modalState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-[22px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-5 space-y-3 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">{modalState.editId ? t.edit : t.addAccount}</h3>
              <button onClick={() => setModalState({ open: false })} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAccount} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'رمز الحساب *' : 'Code *'}</label>
                  <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="1050" className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono font-bold" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.category} *</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const nextCat = e.target.value as AccountCategory;
                      setCategory(nextCat);
                      setNormalBalance(defaultNormalBalance(nextCat));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
                  >
                    {CATEGORY_ORDER.map((c) => (
                      <option key={c} value={c}>{isAr ? categoryLabels[c].ar : categoryLabels[c].en}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.accountNameAr} *</label>
                  <input required value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.accountNameEn}</label>
                  <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'الحساب الأب' : 'Parent Account'}</label>
                  <select value={parentCode} onChange={(e) => setParentCode(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono">
                    <option value="">{isAr ? 'حساب رئيسي (بدون أب)' : 'Root Account'}</option>
                    {state.chartOfAccounts.map((a) => (
                      <option key={a.id} value={a.code}>{a.code} - {isAr ? a.nameAr : a.nameEn}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'المستوى' : 'Level'}</label>
                  <input type="number" min={1} max={6} value={level} onChange={(e) => setLevel(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'طبيعة الحساب' : 'Normal Balance'}</label>
                  <select value={normalBalance} onChange={(e) => setNormalBalance(e.target.value as 'debit' | 'credit')} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold">
                    <option value="debit">{t.debit}</option>
                    <option value="credit">{t.credit}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'رصيد افتتاحي' : 'Opening Balance'}</label>
                  <input type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.costCenter}</label>
                  <input value={costCenter} onChange={(e) => setCostCenter(e.target.value)} placeholder={isAr ? 'مثال: المبيعات' : 'e.g. Sales'} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.branch}</label>
                  <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    {state.branches.map((b) => <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>)}
                  </select>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input type="checkbox" checked={allowPosting} onChange={(e) => setAllowPosting(e.target.checked)} className="w-4 h-4 accent-[#0A3D2C] rounded" />
                <span>{isAr ? 'يقبل الترحيل المباشر في القيود' : 'Allow direct journal posting'}</span>
              </label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.notes} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />

              {formError && <p className="text-xs font-bold text-red-600">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalState({ open: false })} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold cursor-pointer">
                  {t.cancel}
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer">
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account General Ledger Drawer/Modal */}
      {ledgerAccount && ledgerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[86vh] flex flex-col rounded-[22px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1F332B]">
              <div>
                <h3 className="text-sm font-extrabold">
                  {t.generalLedger}: {ledgerAccount.code} - {isAr ? ledgerAccount.nameAr : ledgerAccount.nameEn}
                </h3>
                <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                  {t.debit}: {ledgerData.totalDebit.toLocaleString()} · {t.credit}: {ledgerData.totalCredit.toLocaleString()} · {isAr ? 'الصافي' : 'Net'}: {ledgerData.netBalance.toLocaleString()} {cur}
                </p>
              </div>
              <button onClick={() => setLedgerAccount(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto mt-3">
              {ledgerData.rows.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-400">{t.noData}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-[#0A120F] text-slate-500">
                    <tr>
                      <th className="p-2.5 text-start">{t.date}</th>
                      <th className="p-2.5 text-start">{isAr ? 'القيد' : 'Ref'}</th>
                      <th className="p-2.5 text-start">{t.reason}</th>
                      <th className="p-2.5 text-end">{t.debit}</th>
                      <th className="p-2.5 text-end">{t.credit}</th>
                      <th className="p-2.5 text-end">{isAr ? 'الرصيد التراكمي' : 'Running'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
                    {ledgerData.rows.map((r, i) => (
                      <tr key={`${r.journalId}-${i}`}>
                        <td className="p-2.5 font-mono">{r.date.slice(0, 10)}</td>
                        <td className="p-2.5 font-mono font-bold">{r.journalId}</td>
                        <td className="p-2.5">{r.description}</td>
                        <td className="p-2.5 text-end font-mono tabular-nums">{r.debit > 0 ? r.debit.toLocaleString() : '—'}</td>
                        <td className="p-2.5 text-end font-mono tabular-nums">{r.credit > 0 ? r.credit.toLocaleString() : '—'}</td>
                        <td className="p-2.5 text-end font-mono font-bold tabular-nums">{r.runningBalance.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
