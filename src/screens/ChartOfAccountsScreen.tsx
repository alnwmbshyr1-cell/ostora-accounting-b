import React, { useMemo, useState } from 'react';
import { BookOpen, FolderTree, Plus, Search, Trash2, X } from 'lucide-react';
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
  const [modalOpen, setModalOpen] = useState(false);
  const [ledgerAccount, setLedgerAccount] = useState<ChartAccount | null>(null);

  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState<AccountCategory>('assets');
  const [parentCode, setParentCode] = useState('1000');

  const categoryLabels: Record<AccountCategory, { ar: string; en: string; color: string }> = {
    assets: { ar: 'الأصول (Assets)', en: 'Assets', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
    liabilities: { ar: 'الخصوم (Liabilities)', en: 'Liabilities', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
    equity: { ar: 'حقوق الملكية (Equity)', en: 'Equity', color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
    revenue: { ar: 'الإيرادات (Revenue)', en: 'Revenue', color: 'bg-teal-500/10 text-teal-700 dark:text-teal-300' },
    expenses: { ar: 'المصروفات (Expenses)', en: 'Expenses', color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.chartOfAccounts
      .filter((a) => (catFilter === 'all' || a.category === catFilter))
      .filter(
        (a) =>
          !q ||
          a.code.toLowerCase().includes(q) ||
          a.nameAr.toLowerCase().includes(q) ||
          a.nameEn.toLowerCase().includes(q),
      )
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [state.chartOfAccounts, query, catFilter]);

  const ledgerData = useMemo(() => {
    if (!ledgerAccount) return null;
    return computeAccountLedger(ledgerAccount.code, state.journals);
  }, [ledgerAccount, state.journals]);

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || (!nameAr.trim() && !nameEn.trim())) return;
    actions.saveChartAccount({
      code: code.trim(),
      nameAr: nameAr.trim() || nameEn.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      category,
      parentCode: parentCode.trim() || undefined,
      isSystem: false,
    });
    setCode('');
    setNameAr('');
    setNameEn('');
    setModalOpen(false);
    actions.notify(isAr ? 'تمت إضافة الحساب إلى الشجرة' : 'Account added to Chart of Accounts');
  };

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
            onClick={() => setModalOpen(true)}
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

      {/* Accounts Table */}
      <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-[#0A120F] text-slate-500 border-b border-slate-200 dark:border-[#1F332B]">
              <tr>
                <th className="p-3 text-start font-bold">{isAr ? 'رمز الحساب' : 'Code'}</th>
                <th className="p-3 text-start font-bold">{t.account}</th>
                <th className="p-3 text-start font-bold">{t.category}</th>
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
                    <td className="p-3 text-end font-mono tabular-nums">{summary.totalDebit.toLocaleString()}</td>
                    <td className="p-3 text-end font-mono tabular-nums">{summary.totalCredit.toLocaleString()}</td>
                    <td className="p-3 text-end font-mono font-extrabold tabular-nums">
                      {summary.netBalance.toLocaleString()} {cur}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setLedgerAccount(acc)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{t.generalLedger}</span>
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

      {/* Add Account Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[22px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">{t.addAccount}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAccount} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'الرمز' : 'Code'}</label>
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="1050"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.category}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AccountCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                  >
                    {CATEGORY_ORDER.map((c) => (
                      <option key={c} value={c}>
                        {isAr ? categoryLabels[c].ar : categoryLabels[c].en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.accountNameAr}</label>
                <input
                  required
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.accountNameEn}</label>
                <input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'رمز الحساب الأب' : 'Parent Code'}</label>
                <input
                  value={parentCode}
                  onChange={(e) => setParentCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold cursor-pointer">
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
