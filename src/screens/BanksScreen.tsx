import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Download,
  Edit2,
  FileSpreadsheet,
  Landmark,
  Plus,
  Printer,
  Scale,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { strings } from '../data/translations';
import { computeBankReconciliationDiff } from '../domain/accounting';
import { fromHalalas, toHalalas } from '../domain/halala';
import { BankAccount, CurrencyCode } from '../types/erp';
import { DEFAULT_ENABLED_CURRENCIES, formatCurrency, formatCurrencyNumber } from '../utils/currencies';
import { downloadTextFile } from '../utils/export';
import { ScreenProps } from './types';

const BANK_PRESETS = [
  { nameAr: 'مصرف الراجحي', nameEn: 'AlRajhi Bank', prefix: 'SA03-8000-' },
  { nameAr: 'البنك الأهلي السعودي (SNB)', nameEn: 'Saudi National Bank (SNB)', prefix: 'SA15-1000-' },
  { nameAr: 'بنك الرياض', nameEn: 'Riyad Bank', prefix: 'SA42-2000-' },
  { nameAr: 'STC Pay / محفظة رقمية', nameEn: 'STC Pay Wallet', prefix: 'STC-PAY-' },
];

interface StatementRow {
  id: string;
  date: string;
  ref: string;
  description: string;
  inAmount: number;
  outAmount: number;
  runningBalance: number;
}

export const BanksScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];
  const canDelete = state.currentRole !== 'accountant';
  const enabledCurrencies = Array.from(
    new Set<CurrencyCode>([cur, ...(state.settings.enabledCurrencies ?? DEFAULT_ENABLED_CURRENCIES)]),
  );

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'bank' | 'cash'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [formError, setFormError] = useState('');

  const [accountModal, setAccountModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [accountForm, setAccountForm] = useState<{
    accountType: 'bank' | 'cash';
    bankName: string;
    nameAr: string;
    nameEn: string;
    accountNumber: string;
    iban: string;
    branchId: string;
    currency: CurrencyCode;
    openingBalance: string;
    balance: string;
    custodianName: string;
    status: 'active' | 'closed';
  }>({
    accountType: 'bank',
    bankName: '',
    nameAr: '',
    nameEn: '',
    accountNumber: '',
    iban: '',
    branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
    currency: cur,
    openingBalance: '0',
    balance: '0',
    custodianName: '',
    status: 'active',
  });

  const [reconcileModal, setReconcileModal] = useState<{ open: boolean; bankId: string; statementBalance: string }>({
    open: false,
    bankId: '',
    statementBalance: '',
  });

  const [transferModal, setTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromId: state.banks[0]?.id ?? 'cash',
    toId: state.banks[1]?.id ?? state.banks[0]?.id ?? 'alrajhi',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const [statementBank, setStatementBank] = useState<BankAccount | null>(null);

  const visibleBanks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.banks.filter((b) => {
      const accType = b.accountType ?? (b.id === 'cash' ? 'cash' : 'bank');
      const st = b.status ?? 'active';
      if (typeFilter !== 'all' && accType !== typeFilter) return false;
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (!q) return true;
      return (
        b.nameAr.toLowerCase().includes(q) ||
        b.nameEn.toLowerCase().includes(q) ||
        (b.bankName ?? '').toLowerCase().includes(q) ||
        b.accountNumber.toLowerCase().includes(q) ||
        (b.iban ?? '').toLowerCase().includes(q) ||
        (b.custodianName ?? '').toLowerCase().includes(q)
      );
    });
  }, [state.banks, search, typeFilter, statusFilter]);

  const totalTreasury = fromHalalas(state.banks.reduce((sumH, b) => sumH + toHalalas(b.balance), 0));

  const bankKpis = useMemo(() => {
    let banksH = 0;
    let cashH = 0;
    let unreconciledCount = 0;
    for (const b of state.banks) {
      const accType = b.accountType ?? (b.id === 'cash' ? 'cash' : 'bank');
      if (accType === 'cash') cashH += toHalalas(b.balance);
      else banksH += toHalalas(b.balance);
      if (!b.lastReconciledDate) unreconciledCount += 1;
    }
    return {
      total: totalTreasury,
      banksTotal: fromHalalas(banksH),
      cashTotal: fromHalalas(cashH),
      unreconciledCount,
    };
  }, [state.banks, totalTreasury]);

  const reconcileTarget = state.banks.find((b) => b.id === reconcileModal.bankId);
  const reconcilePreview = reconcileTarget
    ? computeBankReconciliationDiff(
        reconcileTarget,
        Number.isFinite(parseFloat(reconcileModal.statementBalance))
          ? parseFloat(reconcileModal.statementBalance)
          : reconcileTarget.balance,
      )
    : null;

  const statementRows: StatementRow[] = useMemo(() => {
    if (!statementBank) return [];
    const targetNameAr = statementBank.nameAr.toLowerCase();
    const targetNameEn = statementBank.nameEn.toLowerCase();
    const rawEvents: { id: string; date: string; ref: string; description: string; inH: number; outH: number }[] = [];

    for (const j of state.journals) {
      for (let idx = 0; idx < j.lines.length; idx++) {
        const line = j.lines[idx];
        const accLower = line.account.toLowerCase();
        if (
          accLower.includes(targetNameAr) ||
          accLower.includes(targetNameEn) ||
          accLower.includes(statementBank.id.toLowerCase())
        ) {
          rawEvents.push({
            id: `${j.id}-${idx}`,
            date: j.date,
            ref: j.reference || j.id,
            description: j.description,
            inH: toHalalas(line.debit),
            outH: toHalalas(line.credit),
          });
        }
      }
    }

    for (const exp of state.expenses) {
      if (exp.status === 'draft') continue;
      if (exp.paidFromBankId !== statementBank.id) continue;
      const alreadyInJournal = state.journals.some((j) => j.reference === exp.id);
      if (!alreadyInJournal) {
        rawEvents.push({
          id: exp.id,
          date: exp.date,
          ref: exp.expenseNumber ?? exp.id,
          description: exp.title,
          inH: 0,
          outH: toHalalas(exp.baseAmount ?? exp.amount),
        });
      }
    }

    for (const v of state.vouchers) {
      if (v.bankId !== statementBank.id) continue;
      const alreadyInJournal = state.journals.some((j) => j.reference === v.id);
      if (!alreadyInJournal) {
        rawEvents.push({
          id: v.id,
          date: v.date,
          ref: v.id,
          description: `${v.partyName} — ${v.reason}`,
          inH: v.type === 'receipt' ? toHalalas(v.amount) : 0,
          outH: v.type === 'payment' ? toHalalas(v.amount) : 0,
        });
      }
    }

    rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runH = toHalalas(statementBank.openingBalance ?? 0);
    const out: StatementRow[] = [];
    for (const ev of rawEvents) {
      runH += ev.inH - ev.outH;
      out.push({
        id: ev.id,
        date: ev.date,
        ref: ev.ref,
        description: ev.description,
        inAmount: fromHalalas(ev.inH),
        outAmount: fromHalalas(ev.outH),
        runningBalance: fromHalalas(runH),
      });
    }
    return out;
  }, [statementBank, state.journals, state.expenses, state.vouchers]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl px-4 py-2.5 flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500">{t.cashAndBanks}</span>
          <span className="font-mono font-extrabold text-base text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
            {formatCurrency(totalTreasury, cur, { isAr })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {state.banks.length >= 2 && (
            <button
              onClick={() => {
                setTransferForm({
                  fromId: state.banks[0]?.id ?? '',
                  toId: state.banks[1]?.id ?? '',
                  amount: '',
                  date: new Date().toISOString().slice(0, 10),
                  notes: '',
                });
                setTransferModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#0A3D2C] dark:border-[#C9A227] bg-white dark:bg-[#121E19] text-[#0A3D2C] dark:text-[#C9A227] font-bold text-sm cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>{t.transferFunds}</span>
            </button>
          )}
          <button
            onClick={() => {
              setFormError('');
              setAccountForm({
                accountType: 'bank',
                bankName: '',
                nameAr: '',
                nameEn: '',
                accountNumber: '',
                iban: '',
                branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
                currency: cur,
                openingBalance: '0',
                balance: '0',
                custodianName: '',
                status: 'active',
              });
              setAccountModal({ open: true });
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#C9A227]" />
            <span>{t.addBankAccount}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#121E19] border border-[#C9A227]/35 rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'إجمالي السيولة' : 'Total Liquidity'}</span>
          <span className="text-lg font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-[#C9A227] mt-1 block">
            {formatCurrency(bankKpis.total, cur, { isAr })}
          </span>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'أرصدة البنوك' : 'Bank Accounts Total'}</span>
          <span className="text-lg font-extrabold font-mono tabular-nums mt-1 block">
            {formatCurrency(bankKpis.banksTotal, cur, { isAr })}
          </span>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'أرصدة الصناديق النقدية' : 'Cash Boxes Total'}</span>
          <span className="text-lg font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1 block">
            {formatCurrency(bankKpis.cashTotal, cur, { isAr })}
          </span>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'حسابات بانتظار التسوية' : 'Pending Reconciliation'}</span>
          <span className="text-lg font-extrabold font-mono tabular-nums text-amber-600 mt-1 block">{bankKpis.unreconciledCount}</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث باسم الحساب، البنك، IBAN، أو مسؤول الصندوق...' : 'Search account, bank, IBAN, or custodian...'}
            className="w-full ps-9 pe-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | 'bank' | 'cash')}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'بنوك وصناديق' : 'All Types'}</option>
          <option value="bank">{isAr ? 'حساب بنكي' : 'Bank Account'}</option>
          <option value="cash">{isAr ? 'صندوق نقدي' : 'Cash Box'}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'closed')}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الحالات' : 'All Statuses'}</option>
          <option value="active">{isAr ? 'نشط' : 'Active'}</option>
          <option value="closed">{isAr ? 'مغلق' : 'Closed'}</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {visibleBanks.map((b) => {
          const accType = b.accountType ?? (b.id === 'cash' ? 'cash' : 'bank');
          const isCash = accType === 'cash' || b.id === 'cash';
          const accCur = b.currency ?? cur;
          const st = b.status ?? 'active';
          const brName = state.branches.find((br) => br.id === b.branchId)?.[isAr ? 'nameAr' : 'nameEn'];
          return (
            <div
              key={b.id}
              className={`rounded-[20px] p-6 space-y-3.5 border ${
                isCash
                  ? 'bg-[#C9A227]/15 border-[#C9A227] text-slate-900 dark:text-white'
                  : 'bg-[#0A3D2C] border-[#0A3D2C] text-white'
              } ${st === 'closed' ? 'opacity-75' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${isCash ? 'bg-[#0A3D2C] text-white' : 'bg-white/15 text-white'}`}>
                      {isCash ? <Wallet className="w-3 h-3" /> : <Landmark className="w-3 h-3" />}
                      {isCash ? (isAr ? 'صندوق نقدي' : 'Cash Box') : (isAr ? 'بنك' : 'Bank')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${st === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-200'}`}>
                      {st === 'active' ? (isAr ? 'نشط' : 'Active') : (isAr ? 'مغلق' : 'Closed')}
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold truncate">{isAr ? b.nameAr : b.nameEn}</h3>
                  <p className="text-[11px] opacity-75 truncate">{b.bankName ? `${b.bankName} · ` : ''}{isAr ? b.nameEn : b.nameAr}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setFormError('');
                      setAccountForm({
                        accountType: accType,
                        bankName: b.bankName ?? b.nameAr,
                        nameAr: b.nameAr,
                        nameEn: b.nameEn,
                        accountNumber: b.accountNumber,
                        iban: b.iban ?? '',
                        branchId: b.branchId ?? state.branches[0]?.id ?? '',
                        currency: accCur,
                        openingBalance: String(b.openingBalance ?? b.balance),
                        balance: String(b.balance),
                        custodianName: b.custodianName ?? '',
                        status: st,
                      });
                      setAccountModal({ open: true, editId: b.id });
                    }}
                    aria-label={t.edit}
                    className="p-1.5 rounded-lg hover:bg-black/10 cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-[#C9A227]" />
                  </button>
                  {b.id !== 'cash' && canDelete && (
                    <button
                      onClick={() => {
                        actions.deleteBankAccount(b.id);
                        actions.notify(isAr ? 'تم حذف الحساب البنكي' : 'Bank account deleted');
                      }}
                      aria-label={t.delete}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-red-300" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-0.5 text-[11px] font-mono opacity-80">
                <p>{b.accountNumber || '—'}</p>
                {b.iban && <p className="truncate">IBAN: {b.iban}</p>}
                {(brName || b.custodianName) && (
                  <p className="font-sans">
                    {brName ? `${brName}` : ''}
                    {b.custodianName ? ` · ${isAr ? 'المسؤول:' : 'Custodian:'} ${b.custodianName}` : ''}
                  </p>
                )}
              </div>

              <p
                className={`text-2xl font-extrabold font-mono tabular-nums ${
                  isCash ? 'text-[#0A3D2C] dark:text-[#C9A227]' : 'text-[#C9A227]'
                }`}
              >
                {formatCurrency(b.balance, accCur, { isAr })}
              </p>

              <div className="pt-2 border-t border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-mono opacity-80 flex items-center gap-1">
                  {b.lastReconciledDate ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      {isAr ? `آخر تسوية: ${b.lastReconciledDate}` : `Reconciled ${b.lastReconciledDate}`}
                    </>
                  ) : isAr ? (
                    'بانتظار التسوية'
                  ) : (
                    'Unreconciled'
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStatementBank(b)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                      isCash
                        ? 'bg-white text-[#0A3D2C] border border-[#0A3D2C]/20'
                        : 'bg-white/15 hover:bg-white/25 text-white'
                    }`}
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    <span>{isAr ? 'كشف حساب' : 'Statement'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReconcileModal({
                        open: true,
                        bankId: b.id,
                        statementBalance: String(b.balance),
                      })
                    }
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                      isCash
                        ? 'bg-[#0A3D2C] text-white'
                        : 'bg-white/15 hover:bg-white/25 text-white'
                    }`}
                  >
                    <Scale className="w-3 h-3" />
                    <span>{t.reconcileAccount}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Account Statement Modal */}
      {statementBank && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-4xl w-full p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-extrabold">
                  {isAr ? 'كشف حساب:' : 'Account Statement:'} {isAr ? statementBank.nameAr : statementBank.nameEn}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {statementBank.accountNumber} {statementBank.iban ? `· ${statementBank.iban}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const csv = ['Date,Reference,Description,In,Out,RunningBalance']
                      .concat(
                        statementRows.map(
                          (row) =>
                            `${row.date.slice(0, 10)},${row.ref},"${row.description.replace(/"/g, '""')}",${row.inAmount},${row.outAmount},${row.runningBalance}`,
                        ),
                      )
                      .join('\n');
                    downloadTextFile(`statement_${statementBank.id}.csv`, csv);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.exportCsv}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    actions.logAuditEvent('print', 'BankAccount', statementBank.id, `طباعة كشف حساب ${statementBank.nameAr}`, { screenName: 'البنوك والصناديق' });
                    window.print();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printPdf}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatementBank(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F]">
                <span className="text-slate-500 block">{isAr ? 'الرصيد الافتتاحي' : 'Opening Balance'}</span>
                <span className="font-mono font-extrabold text-sm tabular-nums">
                  {formatCurrency(statementBank.openingBalance ?? 0, statementBank.currency ?? cur, { isAr })}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F]">
                <span className="text-slate-500 block">{isAr ? 'عدد الحركات' : 'Transactions'}</span>
                <span className="font-mono font-extrabold text-sm tabular-nums">{statementRows.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15">
                <span className="text-slate-600 dark:text-slate-300 block">{isAr ? 'الرصيد الحالي' : 'Current Balance'}</span>
                <span className="font-mono font-extrabold text-sm text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
                  {formatCurrency(statementBank.balance, statementBank.currency ?? cur, { isAr })}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-[#1F332B] rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-[#0A120F] text-slate-500 font-bold">
                  <tr>
                    <th className="p-2.5 text-start">{t.date}</th>
                    <th className="p-2.5 text-start">{isAr ? 'المرجع' : 'Ref'}</th>
                    <th className="p-2.5 text-start">{isAr ? 'البيان' : 'Description'}</th>
                    <th className="p-2.5 text-end text-emerald-600">{isAr ? 'وارد (+)' : 'In (+)'}</th>
                    <th className="p-2.5 text-end text-red-600">{isAr ? 'صادر (-)' : 'Out (-)'}</th>
                    <th className="p-2.5 text-end">{isAr ? 'الرصيد' : 'Balance'} ({statementBank.currency ?? cur})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
                  {statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        {isAr ? 'لا توجد حركات مسجلة على هذا الحساب بعد' : 'No ledger transactions recorded yet'}
                      </td>
                    </tr>
                  ) : (
                    statementRows.map((row) => (
                      <tr key={row.id}>
                        <td className="p-2.5 font-mono whitespace-nowrap">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="p-2.5 font-mono text-[#0A3D2C] dark:text-[#C9A227]">{row.ref}</td>
                        <td className="p-2.5">{row.description}</td>
                        <td className="p-2.5 text-end font-mono text-emerald-600 tabular-nums">
                          {row.inAmount > 0 ? formatCurrencyNumber(row.inAmount, statementBank.currency ?? cur) : '—'}
                        </td>
                        <td className="p-2.5 text-end font-mono text-red-600 tabular-nums">
                          {row.outAmount > 0 ? formatCurrencyNumber(row.outAmount, statementBank.currency ?? cur) : '—'}
                        </td>
                        <td className="p-2.5 text-end font-mono font-bold tabular-nums">
                          {formatCurrency(row.runningBalance, statementBank.currency ?? cur, { isAr })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {reconcileModal.open && reconcileTarget && reconcilePreview && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
              <div>
                <h3 className="text-base font-extrabold">{t.reconcileAccount}</h3>
                <p className="text-xs text-slate-500">{isAr ? reconcileTarget.nameAr : reconcileTarget.nameEn}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 font-sans font-bold">
                {isAr ? 'الرصيد الدفتري في النظام:' : 'System Ledger Balance:'}
              </span>
              <span className="font-extrabold tabular-nums">
                {formatCurrency(reconcilePreview.systemBalance, reconcileTarget.currency ?? cur, { isAr })}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">
                {t.statementBalance} ({reconcileTarget.currency ?? cur})
              </label>
              <input
                type="number"
                step="0.01"
                value={reconcileModal.statementBalance}
                onChange={(e) => setReconcileModal({ ...reconcileModal, statementBalance: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
              />
            </div>

            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
                reconcilePreview.isMatched
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
              }`}
            >
              <span>{t.autoPostVariance}</span>
              <span className="font-mono tabular-nums">
                {reconcilePreview.variance > 0 ? '+' : ''}
                {formatCurrency(reconcilePreview.variance, reconcileTarget.currency ?? cur, { isAr })}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReconcileModal({ open: false, bankId: '', statementBalance: '' })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(reconcileModal.statementBalance);
                  if (!Number.isFinite(val)) return;
                  const ok = actions.reconcileBankAccount(reconcileTarget.id, val);
                  if (ok) {
                    setReconcileModal({ open: false, bankId: '', statementBalance: '' });
                    actions.notify(
                      isAr ? 'تمت تسوية الحساب وترحيل قيد الفروقات تلقائياً' : 'Account reconciled & variance posted',
                    );
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {accountModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-lg w-full p-6 space-y-3 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
                <h3 className="text-lg font-extrabold">
                  {accountModal.editId ? t.editBankAccount : t.addBankAccount}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAccountModal({ open: false })}
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

            {!accountModal.editId && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-500">{t.bankPresets}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {BANK_PRESETS.map((preset) => (
                    <button
                      key={preset.nameEn}
                      type="button"
                      onClick={() =>
                        setAccountForm({
                          ...accountForm,
                          accountType: 'bank',
                          bankName: preset.nameAr,
                          nameAr: preset.nameAr,
                          nameEn: preset.nameEn,
                          accountNumber: `${preset.prefix}${Math.floor(1000 + Math.random() * 8999)}`,
                        })
                      }
                      className="p-2 rounded-xl border border-slate-200 dark:border-[#1F332B] hover:border-[#0A3D2C] text-start text-xs font-bold cursor-pointer truncate"
                    >
                      {isAr ? preset.nameAr : preset.nameEn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'النوع' : 'Type'}</label>
                <select
                  value={accountForm.accountType}
                  onChange={(e) => setAccountForm({ ...accountForm, accountType: e.target.value as 'bank' | 'cash' })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="bank">{isAr ? 'بنك' : 'Bank'}</option>
                  <option value="cash">{isAr ? 'صندوق نقدي' : 'Cash Box'}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'اسم البنك / الخزينة' : 'Bank Name'} *</label>
                <input
                  value={accountForm.bankName}
                  maxLength={120}
                  onChange={(e) => {
                    setFormError('');
                    setAccountForm({ ...accountForm, bankName: e.target.value });
                  }}
                  placeholder={isAr ? 'مصرف الراجحي' : 'AlRajhi Bank'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.accountNameAr} *</label>
                <input
                  value={accountForm.nameAr}
                  maxLength={120}
                  onChange={(e) => {
                    setFormError('');
                    setAccountForm({ ...accountForm, nameAr: e.target.value });
                  }}
                  placeholder="مصرف الراجحي - جاري"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.accountNameEn} *</label>
                <input
                  value={accountForm.nameEn}
                  maxLength={120}
                  onChange={(e) => {
                    setFormError('');
                    setAccountForm({ ...accountForm, nameEn: e.target.value });
                  }}
                  placeholder="AlRajhi Current Account"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.accountNumberLabel}</label>
                <input
                  value={accountForm.accountNumber}
                  maxLength={64}
                  onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                  placeholder="SA03-8000-..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">IBAN</label>
                <input
                  value={accountForm.iban}
                  maxLength={80}
                  onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })}
                  placeholder="SA00 0000 ..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.branch}</label>
                <select
                  value={accountForm.branchId}
                  onChange={(e) => setAccountForm({ ...accountForm, branchId: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  {state.branches.map((br) => (
                    <option key={br.id} value={br.id}>{isAr ? br.nameAr : br.nameEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'العملة' : 'Currency'}</label>
                <select
                  value={accountForm.currency}
                  onChange={(e) => setAccountForm({ ...accountForm, currency: e.target.value as CurrencyCode })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  {enabledCurrencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.status}</label>
                <select
                  value={accountForm.status}
                  onChange={(e) => setAccountForm({ ...accountForm, status: e.target.value as 'active' | 'closed' })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                  <option value="closed">{isAr ? 'مغلق' : 'Closed'}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'الرصيد الافتتاحي' : 'Opening'}</label>
                <input
                  type="number"
                  step="0.01"
                  value={accountForm.openingBalance}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAccountForm((f) => ({
                      ...f,
                      openingBalance: v,
                      balance: accountModal.editId ? f.balance : v,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'الرصيد الحالي' : 'Current'}</label>
                <input
                  type="number"
                  step="0.01"
                  value={accountForm.balance}
                  onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{isAr ? 'مسؤول الصندوق' : 'Custodian'}</label>
                <input
                  value={accountForm.custodianName}
                  maxLength={120}
                  onChange={(e) => setAccountForm({ ...accountForm, custodianName: e.target.value })}
                  placeholder={isAr ? 'اسم أمين الصندوق' : 'Custodian'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setAccountModal({ open: false })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  const nameAr = accountForm.nameAr.trim() || accountForm.bankName.trim() || accountForm.nameEn.trim();
                  const nameEn = accountForm.nameEn.trim() || accountForm.bankName.trim() || accountForm.nameAr.trim();
                  if (!nameAr || !nameEn) {
                    setFormError(isAr ? 'اسم الحساب واسم البنك إلزاميان *' : 'Account & Bank name are required *');
                    return;
                  }
                  const parsedBal = parseFloat(accountForm.balance);
                  const parsedOpen = parseFloat(accountForm.openingBalance);
                  actions.saveBankAccount(
                    {
                      accountType: accountForm.accountType,
                      bankName: accountForm.bankName.trim() || nameAr,
                      nameAr,
                      nameEn,
                      accountNumber: accountForm.accountNumber.trim(),
                      iban: accountForm.iban.trim() || undefined,
                      branchId: accountForm.branchId || undefined,
                      currency: accountForm.currency,
                      openingBalance: Number.isFinite(parsedOpen) ? Number(parsedOpen.toFixed(2)) : 0,
                      balance: Number.isFinite(parsedBal) ? Number(parsedBal.toFixed(2)) : 0,
                      custodianName: accountForm.custodianName.trim() || undefined,
                      status: accountForm.status,
                    },
                    accountModal.editId,
                  );
                  setAccountModal({ open: false });
                  actions.notify(
                    accountModal.editId
                      ? isAr
                        ? 'تم تحديث بيانات الحساب'
                        : 'Account updated'
                      : isAr
                      ? 'تمت إضافة الحساب البنكي بنجاح'
                      : 'Bank account added',
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

      {transferModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-md w-full p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
              <h3 className="text-lg font-extrabold">{t.transferFunds}</h3>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{t.fromAccount}</label>
              <select
                value={transferForm.fromId}
                onChange={(e) => setTransferForm({ ...transferForm, fromId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              >
                {state.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isAr ? b.nameAr : b.nameEn} ({formatCurrency(b.balance, b.currency ?? cur, { isAr })})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{t.toAccount}</label>
              <select
                value={transferForm.toId}
                onChange={(e) => setTransferForm({ ...transferForm, toId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              >
                {state.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isAr ? b.nameAr : b.nameEn} ({formatCurrency(b.balance, b.currency ?? cur, { isAr })})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">
                  {t.amount} ({state.banks.find((b) => b.id === transferForm.fromId)?.currency ?? cur}) *
                </label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{t.date} *</label>
                <input
                  type="date"
                  value={transferForm.date}
                  onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{isAr ? 'سبب التحويل / الملاحظات' : 'Reason / Notes'}</label>
              <input
                value={transferForm.notes}
                maxLength={250}
                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                placeholder={isAr ? 'إيداع مبيعات / تغذية صندوق...' : 'Cash deposit / treasury funding...'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setTransferModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                disabled={!transferForm.fromId || !transferForm.toId || transferForm.fromId === transferForm.toId}
                onClick={() => {
                  const amt = parseFloat(transferForm.amount) || 0;
                  if (amt <= 0 || transferForm.fromId === transferForm.toId) return;
                  const ok = actions.transferBetweenBanks(
                    transferForm.fromId,
                    transferForm.toId,
                    amt,
                    transferForm.notes,
                    transferForm.date,
                  );
                  if (ok) {
                    setTransferModal(false);
                    actions.notify(
                      isAr
                        ? 'تم تنفيذ التحويل وإنشاء قيد محاسبي مزدوج'
                        : 'Transfer completed with automatic journal entry',
                    );
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer disabled:opacity-50"
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
