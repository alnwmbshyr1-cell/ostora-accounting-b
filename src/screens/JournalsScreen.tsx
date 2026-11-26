import React, { useMemo, useState } from 'react';
import { BookOpen, Edit2, Paperclip, Plus, Search, Trash2, X } from 'lucide-react';
import { strings } from '../data/translations';
import { computeAccountLedger, computeTrialBalanceFromJournals } from '../domain/accounting';
import { fromHalalas, toHalalas } from '../domain/halala';
import { JournalLine } from '../types/erp';
import { formatCurrency, formatCurrencyNumber } from '../utils/currencies';
import { compressImageToBase64 } from '../utils/image';
import { ScreenProps } from './types';

export const JournalsScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];
  const canDelete = state.currentRole !== 'accountant';

  const [viewMode, setViewMode] = useState<'entries' | 'ledger'>('entries');
  const [entrySearch, setEntrySearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'manual' | 'auto'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'draft'>('all');
  const [ledgerFilter, setLedgerFilter] = useState('');
  const [jrnModal, setJrnModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [jrnForm, setJrnForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    entryType: 'manual' as 'manual' | 'auto',
    description: '',
    reference: 'MANUAL',
    branchId: state.branches[0]?.id ?? '',
    costCenter: '',
    status: 'approved' as 'draft' | 'approved',
    attachmentBase64: '',
  });
  const [jrnLines, setJrnLines] = useState<{ account: string; debit: string; credit: string; description: string }[]>([
    { account: '1010 - النقدية والبنوك', debit: '', credit: '0', description: '' },
    { account: '4010 - إيرادات المبيعات', debit: '0', credit: '', description: '' },
  ]);
  const [jrnError, setJrnError] = useState('');

  const nextJrnPreviewId = useMemo(() => {
    const nums = state.journals.map((j) => {
      const m = j.id.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 700;
    });
    return `JRN-${Math.max(700, ...nums) + 1}`;
  }, [state.journals]);

  const trialSummary = useMemo(() => computeTrialBalanceFromJournals(state.journals), [state.journals]);
  const ledgerSummary = useMemo(
    () => computeAccountLedger(ledgerFilter, state.journals),
    [ledgerFilter, state.journals],
  );

  const qSearch = entrySearch.trim().toLowerCase();
  const visibleJournals = state.journals.filter((j) => {
    const inferredType = j.entryType ?? (j.reference === 'MANUAL' ? 'manual' : 'auto');
    if (typeFilter !== 'all' && inferredType !== typeFilter) return false;
    if (statusFilter !== 'all' && (j.status ?? 'approved') !== statusFilter) return false;
    if (!qSearch) return true;
    return (
      j.id.toLowerCase().includes(qSearch) ||
      j.reference.toLowerCase().includes(qSearch) ||
      j.description.toLowerCase().includes(qSearch) ||
      j.lines.some((l) => l.account.toLowerCase().includes(qSearch))
    );
  });

  const sumDebitH = jrnLines.reduce((s, l) => s + Math.max(0, toHalalas(parseFloat(l.debit) || 0)), 0);
  const sumCreditH = jrnLines.reduce((s, l) => s + Math.max(0, toHalalas(parseFloat(l.credit) || 0)), 0);
  const isBalanced = sumDebitH > 0 && sumDebitH === sumCreditH;

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const b64 = await compressImageToBase64(file);
      setJrnForm((prev) => ({ ...prev, attachmentBase64: b64 }));
      return;
    }
    if (file.size > 180 * 1024) {
      actions.notify(isAr ? 'الحد الأقصى لحجم الملف 180KB' : 'Max attachment size is 180KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setJrnForm((prev) => ({ ...prev, attachmentBase64: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('entries')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              viewMode === 'entries'
                ? 'bg-[#0A3D2C] text-white'
                : 'bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B]'
            }`}
          >
            {t.journals} ({state.journals.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('ledger')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              viewMode === 'ledger'
                ? 'bg-[#0A3D2C] text-white'
                : 'bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t.generalLedger}</span>
          </button>
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold tabular-nums ${
              trialSummary.isBalanced
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
            }`}
          >
            {t.trialBalance}: {formatCurrencyNumber(trialSummary.totalDebit, cur)} = {formatCurrency(trialSummary.totalCredit, cur, { isAr })}
          </span>
        </div>

        <button
          onClick={() => {
            setJrnError('');
            setJrnForm({
              date: new Date().toISOString().slice(0, 10),
              entryType: 'manual',
              description: '',
              reference: 'MANUAL',
              branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
              costCenter: '',
              status: 'approved',
              attachmentBase64: '',
            });
            setJrnLines([
              { account: '1010 - النقدية والبنوك', debit: '', credit: '0', description: '' },
              { account: '4010 - إيرادات المبيعات', debit: '0', credit: '', description: '' },
            ]);
            setJrnModal({ open: true });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addJournal}</span>
        </button>
      </div>

      {viewMode === 'entries' && (
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
            <input
              type="text"
              value={entrySearch}
              onChange={(e) => setEntrySearch(e.target.value)}
              placeholder={t.search}
              className="w-full ps-10 pe-4 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs sm:text-sm outline-none focus:border-[#0A3D2C]"
            />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | 'manual' | 'auto')} className="px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold">
            <option value="all">{isAr ? 'كل الأنواع' : 'All Types'}</option>
            <option value="manual">{isAr ? 'قيد يدوي' : 'Manual'}</option>
            <option value="auto">{isAr ? 'قيد آلي' : 'Automatic'}</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'approved' | 'draft')} className="px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold">
            <option value="all">{t.all}</option>
            <option value="approved">{isAr ? 'معتمد' : 'Approved'}</option>
            <option value="draft">{t.draft}</option>
          </select>
        </div>
      )}

      {viewMode === 'ledger' ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                value={ledgerFilter}
                onChange={(e) => setLedgerFilter(e.target.value)}
                placeholder={isAr ? 'فلتر برقم الحساب أو الاسم (مثال: 1010، عملاء)...' : 'Filter account code or name (e.g. 1010)...'}
                className="w-full ps-9 pe-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
            </div>
            <select
              value={ledgerFilter}
              onChange={(e) => setLedgerFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
            >
              <option value="">{isAr ? 'كافة الحسابات' : 'All Accounts'}</option>
              {state.chartOfAccounts.map((acc) => (
                <option key={acc.id} value={acc.code}>
                  {acc.code} - {isAr ? acc.nameAr : acc.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1F332B] text-slate-500">
                  <th className="p-2 text-start">{t.date}</th>
                  <th className="p-2 text-start">{t.account}</th>
                  <th className="p-2 text-start">{t.reason}</th>
                  <th className="p-2 text-end">{t.debit}</th>
                  <th className="p-2 text-end">{t.credit}</th>
                  <th className="p-2 text-end">{isAr ? 'الرصيد التراكمي' : 'Running'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
                {ledgerSummary.rows.map((r, i) => (
                  <tr key={`${r.journalId}-${i}`}>
                    <td className="p-2 font-mono text-slate-500">{r.date.slice(0, 10)}</td>
                    <td className="p-2 font-bold">{r.account}</td>
                    <td className="p-2">{r.description}</td>
                    <td className="p-2 text-end font-mono font-bold text-emerald-600 tabular-nums">
                      {r.debit > 0 ? formatCurrencyNumber(r.debit, cur) : '—'}
                    </td>
                    <td className="p-2 text-end font-mono font-bold text-red-600 tabular-nums">
                      {r.credit > 0 ? formatCurrencyNumber(r.credit, cur) : '—'}
                    </td>
                    <td className="p-2 text-end font-mono font-extrabold tabular-nums">
                      {formatCurrency(r.runningBalance, cur, { isAr })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleJournals.length === 0 ? (
            <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
              {t.noData}
            </div>
          ) : (
            visibleJournals.map((j) => {
              const totalD = fromHalalas(j.lines.reduce((s, l) => s + toHalalas(l.debit), 0));
              const totalC = fromHalalas(j.lines.reduce((s, l) => s + toHalalas(l.credit), 0));
              return (
                <div
                  key={j.id}
                  className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3"
                >
                  <div className="flex justify-between items-center gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-500">
                          {j.id} · {j.reference} · {j.date.slice(0, 10)}
                        </span>
                        {j.status === 'draft' && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-bold">{t.draft}</span>
                        )}
                        {j.costCenter && (
                          <span className="px-1.5 py-0.5 rounded bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227] text-[10px] font-bold">{j.costCenter}</span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-base mt-0.5">{j.description}</h4>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setJrnError('');
                          setJrnForm({
                            date: j.date.slice(0, 10),
                            entryType: j.entryType ?? (j.reference === 'MANUAL' ? 'manual' : 'auto'),
                            description: j.description,
                            reference: j.reference,
                            branchId: j.branchId ?? state.branches[0]?.id ?? '',
                            costCenter: j.costCenter ?? '',
                            status: j.status ?? 'approved',
                            attachmentBase64: j.attachmentBase64 ?? '',
                          });
                          setJrnLines(
                            j.lines.map((l) => ({
                              account: l.account,
                              debit: l.debit ? String(l.debit) : '0',
                              credit: l.credit ? String(l.credit) : '0',
                              description: l.description ?? '',
                            })),
                          );
                          setJrnModal({ open: true, editId: j.id });
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4 text-slate-500" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => actions.deleteJournal(j.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-[#1F332B] text-xs">
                    {j.lines.map((l, idx) => (
                      <div key={idx} className="py-2 grid grid-cols-12 gap-2">
                        <div className="col-span-6">
                          <span className="font-medium block">{l.account}</span>
                          {l.description && <span className="text-[10px] text-slate-400">{l.description}</span>}
                        </div>
                        <span className="col-span-3 text-end font-mono font-bold text-emerald-600 tabular-nums">
                          {l.debit > 0 ? formatCurrencyNumber(l.debit, cur) : '—'}
                        </span>
                        <span className="col-span-3 text-end font-mono font-bold text-red-600 tabular-nums">
                          {l.credit > 0 ? formatCurrencyNumber(l.credit, cur) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-500 tabular-nums">
                    {t.debit}: {formatCurrency(totalD, cur, { isAr })} · {t.credit}: {formatCurrency(totalC, cur, { isAr })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {jrnModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-3xl w-full p-6 space-y-3 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold">{jrnModal.editId ? t.edit : t.addJournal}</h3>
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227]">
                  {jrnModal.editId ?? nextJrnPreviewId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setJrnLines([...jrnLines, { account: '', debit: '0', credit: '0', description: '' }])}
                className="px-3 py-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
              >
                + {t.addItem}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.date} *</label>
                <input type="date" value={jrnForm.date} onChange={(e) => setJrnForm({ ...jrnForm, date: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{isAr ? 'المرجع' : 'Reference'}</label>
                <input value={jrnForm.reference} maxLength={120} onChange={(e) => setJrnForm({ ...jrnForm, reference: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.branch}</label>
                <select value={jrnForm.branchId} onChange={(e) => setJrnForm({ ...jrnForm, branchId: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                  {state.branches.map((b) => <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.costCenter}</label>
                <input value={jrnForm.costCenter} onChange={(e) => setJrnForm({ ...jrnForm, costCenter: e.target.value })} placeholder={t.costCenter} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500">{t.reason} *</label>
              <input
                value={jrnForm.description}
                maxLength={400}
                onChange={(e) => setJrnForm({ ...jrnForm, description: e.target.value })}
                placeholder={t.reason}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold"
              />
            </div>

            <datalist id="ostora_coa_accounts">
              {state.chartOfAccounts.map((acc) => (
                <option key={acc.id} value={`${acc.code} - ${isAr ? acc.nameAr : acc.nameEn}`} />
              ))}
            </datalist>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {jrnLines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                  <input
                    list="ostora_coa_accounts"
                    value={line.account}
                    maxLength={160}
                    onChange={(e) => {
                      const next = [...jrnLines];
                      next[idx] = { ...next[idx], account: e.target.value };
                      setJrnLines(next);
                    }}
                    placeholder={`${t.account} *`}
                    className="col-span-4 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
                  />
                  <input
                    value={line.description}
                    maxLength={160}
                    onChange={(e) => {
                      const next = [...jrnLines];
                      next[idx] = { ...next[idx], description: e.target.value };
                      setJrnLines(next);
                    }}
                    placeholder={isAr ? 'بيان السطر' : 'Line note'}
                    className="col-span-3 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.debit}
                    onChange={(e) => {
                      const next = [...jrnLines];
                      next[idx] = { ...next[idx], debit: e.target.value };
                      setJrnLines(next);
                    }}
                    placeholder={t.debit}
                    className="col-span-2 px-2 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.credit}
                    onChange={(e) => {
                      const next = [...jrnLines];
                      next[idx] = { ...next[idx], credit: e.target.value };
                      setJrnLines(next);
                    }}
                    placeholder={t.credit}
                    className="col-span-2 px-2 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono"
                  />
                  <button
                    type="button"
                    disabled={jrnLines.length <= 2}
                    onClick={() => setJrnLines(jrnLines.filter((_, i) => i !== idx))}
                    className="col-span-1 p-1 text-red-500 disabled:opacity-30 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold cursor-pointer">
                <Paperclip className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                <span>{isAr ? 'مرفق مستند القيد' : 'Attach Voucher'}</span>
                <input type="file" accept="image/*,application/pdf" onChange={handleAttachment} className="hidden" />
              </label>
              {jrnForm.attachmentBase64 && (
                <span className="text-xs text-emerald-600 font-bold">✓ {isAr ? 'مرفق محفوظ' : 'Attached'}</span>
              )}
              <select value={jrnForm.status} onChange={(e) => setJrnForm({ ...jrnForm, status: e.target.value as 'draft' | 'approved' })} className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold">
                <option value="approved">{isAr ? 'معتمد (ترحيل)' : 'Approved'}</option>
                <option value="draft">{t.draft}</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0A120F] flex flex-wrap items-center justify-between gap-2 text-xs font-mono font-bold tabular-nums">
              <span>
                {t.debit}: {formatCurrencyNumber(fromHalalas(sumDebitH), cur)} · {t.credit}: {formatCurrencyNumber(fromHalalas(sumCreditH), cur)} · {isAr ? 'الفرق:' : 'Diff:'} {formatCurrency(fromHalalas(Math.abs(sumDebitH - sumCreditH)), cur, { isAr })}
              </span>
              <span className={isBalanced ? 'text-emerald-600' : 'text-amber-600'}>
                {isBalanced ? (isAr ? 'متوازن ✓' : 'Balanced ✓') : isAr ? 'غير متوازن' : 'Unbalanced'}
              </span>
            </div>

            {jrnError && <p className="text-xs font-bold text-red-600">{jrnError}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setJrnModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!jrnForm.description.trim()) {
                    setJrnError(isAr ? 'وصف / بيان القيد إلزامي *' : 'Journal description is required *');
                    return;
                  }
                  const parsed: JournalLine[] = jrnLines
                    .map((l) => ({
                      account: l.account.trim(),
                      debit: fromHalalas(Math.max(0, toHalalas(parseFloat(l.debit) || 0))),
                      credit: fromHalalas(Math.max(0, toHalalas(parseFloat(l.credit) || 0))),
                      ...(l.description.trim() ? { description: l.description.trim() } : {}),
                    }))
                    .filter((l) => l.account && (l.debit > 0 || l.credit > 0));
                  const dH = parsed.reduce((s, l) => s + toHalalas(l.debit), 0);
                  const cH = parsed.reduce((s, l) => s + toHalalas(l.credit), 0);
                  if (parsed.length < 2 || dH <= 0 || dH !== cH) {
                    setJrnError(t.unbalancedError);
                    return;
                  }
                  const res = actions.saveJournal(
                    {
                      reference: jrnForm.reference.trim() || 'MANUAL',
                      description: jrnForm.description.trim(),
                      date: new Date(`${jrnForm.date || new Date().toISOString().slice(0, 10)}T12:00:00`).toISOString(),
                      entryType: jrnForm.entryType,
                      branchId: jrnForm.branchId || undefined,
                      costCenter: jrnForm.costCenter.trim() || undefined,
                      status: jrnForm.status,
                      attachmentBase64: jrnForm.attachmentBase64 || undefined,
                      lines: parsed,
                    },
                    jrnModal.editId,
                  );
                  if (!res.ok) {
                    setJrnError(t.unbalancedError);
                    return;
                  }
                  setJrnModal({ open: false });
                  actions.notify(isAr ? 'تم حفظ القيد المحاسبي' : 'Journal entry saved');
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
