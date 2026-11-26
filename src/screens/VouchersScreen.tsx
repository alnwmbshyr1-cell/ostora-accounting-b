import React, { useMemo, useState } from 'react';
import { CheckCircle2, Edit2, Layers, MessageCircle, Paperclip, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { strings } from '../data/translations';
import { fromHalalas, toHalalas } from '../domain/halala';
import { VoucherType } from '../types/erp';
import { formatCurrency } from '../utils/currencies';
import { compressImageToBase64 } from '../utils/image';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

export const VouchersScreen: React.FC<ScreenProps> = ({ store, onPrintVoucher, onOpenBatchPrint }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];
  const canDelete = state.currentRole !== 'accountant';

  const [vchTab, setVchTab] = useState<VoucherType>('receipt');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'approved'>('all');
  const [vchSearch, setVchSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [vchModal, setVchModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [formError, setFormError] = useState('');
  const [vchForm, setVchForm] = useState({
    type: 'receipt' as VoucherType,
    date: new Date().toISOString().slice(0, 10),
    partyType: 'customer' as 'customer' | 'supplier' | 'employee',
    partyName: '',
    partyPhone: '',
    fromAccount: '',
    toAccount: '',
    branchId: state.branches[0]?.id ?? '',
    bankId: state.banks[0]?.id ?? 'cash',
    amount: '',
    reason: '',
    paymentMethod: state.banks[0]?.id ?? 'cash',
    chequeNumber: '',
    chequeDueDate: '',
    attachmentBase64: '',
    status: 'approved' as 'draft' | 'approved',
  });

  const nextVchPreviewId = useMemo(() => {
    const nums = state.vouchers.map((v) => {
      const m = v.id.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 500;
    });
    return `VCH-${Math.max(500, ...nums) + 1}`;
  }, [state.vouchers]);

  const q = vchSearch.trim().toLowerCase();
  const items = state.vouchers.filter((v) => {
    if (v.type !== vchTab) return false;
    if (statusFilter !== 'all' && (v.status ?? 'approved') !== statusFilter) return false;
    if (!q) return true;
    return (
      v.partyName.toLowerCase().includes(q) ||
      v.reason.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q) ||
      (v.chequeNumber ?? '').toLowerCase().includes(q)
    );
  });

  const partySuggestions =
    vchForm.partyType === 'customer'
      ? state.customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))
      : vchForm.partyType === 'supplier'
      ? state.suppliers.map((s) => ({ id: s.id, name: s.name, phone: s.phone }))
      : state.employees.map((e) => ({ id: e.id, name: e.name, phone: e.phone }));

  const formatPaymentLabel = (pm: string) => {
    const bank = state.banks.find((b) => b.id === pm || b.nameEn === pm || b.nameAr === pm);
    if (bank) return isAr ? bank.nameAr : bank.nameEn;
    if (pm === 'cash') return t.payCash;
    if (pm === 'pos_card') return t.payCard;
    if (pm === 'transfer') return t.payTransfer;
    if (pm === 'cheque' || pm === 'Cheque') return t.payCheque;
    if (pm === 'apple_pay') return t.payApplePay;
    return pm;
  };

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const b64 = await compressImageToBase64(file);
      setVchForm((prev) => ({ ...prev, attachmentBase64: b64 }));
      return;
    }
    if (file.size > 180 * 1024) {
      actions.notify(isAr ? 'الحد الأقصى لحجم الملف 180KB' : 'Max attachment size is 180KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setVchForm((prev) => ({ ...prev, attachmentBase64: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const openModalForTab = (type: VoucherType) => {
    setFormError('');
    const defaultPartyType = type === 'receipt' ? 'customer' : type === 'payment' ? 'supplier' : 'customer';
    setVchForm({
      type,
      date: new Date().toISOString().slice(0, 10),
      partyType: defaultPartyType,
      partyName: '',
      partyPhone: '',
      fromAccount: type === 'receipt' ? '1020 - ذمم العملاء (المدينون)' : '1010 - النقدية والبنوك',
      toAccount: type === 'receipt' ? '1010 - النقدية والبنوك' : '2010 - ذمم الموردين (الدائنون)',
      branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
      bankId: state.banks[0]?.id ?? 'cash',
      amount: '',
      reason: '',
      paymentMethod: 'cash',
      chequeNumber: '',
      chequeDueDate: '',
      attachmentBase64: '',
      status: 'approved',
    });
    setVchModal({ open: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2.5">
        <div className="flex p-1 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl">
          <button
            onClick={() => setVchTab('receipt')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              vchTab === 'receipt' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.receiptVoucher}
          </button>
          <button
            onClick={() => setVchTab('payment')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              vchTab === 'payment' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.paymentVoucher}
          </button>
          <button
            onClick={() => setVchTab('journal')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              vchTab === 'journal' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.journalVoucher}
          </button>
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={vchSearch}
            onChange={(e) => setVchSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-10 pe-4 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'draft' | 'approved')}
          className="px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{t.all}</option>
          <option value="approved">{isAr ? 'معتمد' : 'Approved'}</option>
          <option value="draft">{t.draft}</option>
        </select>

        {items.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const targets =
                selectedIds.length > 0
                  ? items.filter((v) => selectedIds.includes(v.id))
                  : items;
              onOpenBatchPrint?.(targets.map((v) => ({ kind: 'voucher', data: v })));
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#C9A227] text-slate-950 font-extrabold text-xs cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>
              {selectedIds.length > 0
                ? `${t.batchPrintSelected} (${items.filter((v) => selectedIds.includes(v.id)).length})`
                : `${t.batchPrint} (${items.length})`}
            </span>
          </button>
        )}

        <button
          onClick={() => openModalForTab(vchTab)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addVoucher}</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
          {t.noData}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((v) => (
            <div key={v.id} className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-2.5">
              <div className="flex justify-between items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(v.id)}
                    onChange={() =>
                      setSelectedIds((prev) =>
                        prev.includes(v.id) ? prev.filter((x) => x !== v.id) : [...prev, v.id],
                      )
                    }
                    className="w-4 h-4 rounded accent-[#0A3D2C] cursor-pointer"
                  />
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {v.id} · {formatPaymentLabel(v.bankId || v.paymentMethod)} · {v.date.slice(0, 10)}
                  </span>
                  {v.status === 'draft' ? (
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-bold">{t.draft}</span>
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                </label>
                <span className={`font-mono text-lg font-extrabold tabular-nums ${v.type === 'receipt' ? 'text-emerald-600' : v.type === 'payment' ? 'text-red-600' : 'text-[#0A3D2C] dark:text-[#C9A227]'}`}>
                  {formatCurrency(v.amount, cur, { isAr })}
                </span>
              </div>
              <h4 className="font-extrabold text-base">{v.partyName}</h4>
              <p className="text-xs text-slate-500">{v.reason || '—'}</p>
              {v.chequeNumber && (
                <p className="text-[11px] font-mono text-amber-600">
                  {t.payCheque}: #{v.chequeNumber} {v.chequeDueDate ? `(${v.chequeDueDate})` : ''}
                </p>
              )}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#1F332B]">
                <button
                  onClick={() => onPrintVoucher?.(v)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printPdf}</span>
                </button>
                <a
                  href={buildWhatsAppLink(
                    v.partyPhone,
                    `${v.type === 'receipt' ? t.receiptVoucher : v.type === 'payment' ? t.paymentVoucher : t.journalVoucher} ${v.id}: ${formatCurrency(v.amount, cur, { isAr })} - ${v.reason}`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{t.whatsapp}</span>
                </a>
                <div className="ms-auto flex gap-1">
                  <button
                    onClick={() => {
                      setFormError('');
                      setVchForm({
                        type: v.type,
                        date: v.date.slice(0, 10),
                        partyType: v.partyType ?? (v.type === 'receipt' ? 'customer' : 'supplier'),
                        partyName: v.partyName,
                        partyPhone: v.partyPhone,
                        fromAccount: v.fromAccount ?? '',
                        toAccount: v.toAccount ?? '',
                        branchId: v.branchId ?? state.branches[0]?.id ?? '',
                        bankId: v.bankId ?? state.banks[0]?.id ?? 'cash',
                        amount: String(v.amount),
                        reason: v.reason,
                        paymentMethod: v.paymentMethod,
                        chequeNumber: v.chequeNumber ?? '',
                        chequeDueDate: v.chequeDueDate ?? '',
                        attachmentBase64: v.attachmentBase64 ?? '',
                        status: v.status ?? 'approved',
                      });
                      setVchModal({ open: true, editId: v.id });
                    }}
                    aria-label={t.edit}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => actions.deleteVoucher(v.id)}
                      aria-label={t.delete}
                      className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {vchModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-2xl w-full p-6 space-y-3 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {vchModal.editId ? t.edit : t.addVoucher} ({vchForm.type === 'receipt' ? t.receiptVoucher : vchForm.type === 'payment' ? t.paymentVoucher : t.journalVoucher})
              </h3>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227]">
                {vchModal.editId ?? nextVchPreviewId}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.date} *</label>
                <input type="date" value={vchForm.date} onChange={(e) => setVchForm({ ...vchForm, date: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{isAr ? 'نوع الطرف' : 'Party Type'}</label>
                <select
                  value={vchForm.partyType}
                  onChange={(e) => setVchForm({ ...vchForm, partyType: e.target.value as 'customer' | 'supplier' | 'employee' })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
                >
                  <option value="customer">{t.client}</option>
                  <option value="supplier">{t.suppliers}</option>
                  <option value="employee">{t.employees}</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.branch}</label>
                <select value={vchForm.branchId} onChange={(e) => setVchForm({ ...vchForm, branchId: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                  {state.branches.map((b) => <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.partyNameLabel} *</label>
                <input
                  list="ostora_voucher_parties"
                  maxLength={160}
                  value={vchForm.partyName}
                  onChange={(e) => {
                    const val = e.target.value;
                    const matched = partySuggestions.find((p) => p.name === val);
                    setVchForm({
                      ...vchForm,
                      partyName: val,
                      partyPhone: matched ? matched.phone : vchForm.partyPhone,
                    });
                  }}
                  placeholder={t.partyNameLabel}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold"
                />
                <datalist id="ostora_voucher_parties">
                  {partySuggestions.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.phone}</label>
                <input
                  type="tel"
                  maxLength={40}
                  value={vchForm.partyPhone}
                  onChange={(e) => setVchForm({ ...vchForm, partyPhone: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.fromAccount}</label>
                <select value={vchForm.fromAccount} onChange={(e) => setVchForm({ ...vchForm, fromAccount: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                  <option value="">{isAr ? 'تلقائي حسب الطرف' : 'Auto by Party'}</option>
                  {state.chartOfAccounts.map((acc) => (
                    <option key={acc.id} value={`${acc.code} - ${isAr ? acc.nameAr : acc.nameEn}`}>
                      {acc.code} - {isAr ? acc.nameAr : acc.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.toAccount}</label>
                <select value={vchForm.toAccount} onChange={(e) => setVchForm({ ...vchForm, toAccount: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                  <option value="">{isAr ? 'تلقائي حسب الصندوق' : 'Auto by Cashbox'}</option>
                  {state.chartOfAccounts.map((acc) => (
                    <option key={acc.id} value={`${acc.code} - ${isAr ? acc.nameAr : acc.nameEn}`}>
                      {acc.code} - {isAr ? acc.nameAr : acc.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.cashAndBanks}</label>
                <select
                  value={vchForm.bankId}
                  onChange={(e) => setVchForm({ ...vchForm, bankId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
                >
                  {state.banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {isAr ? b.nameAr : b.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.paymentMethodLabel}</label>
                <select
                  value={vchForm.paymentMethod}
                  onChange={(e) => setVchForm({ ...vchForm, paymentMethod: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
                >
                  <option value="cash">{t.payCash}</option>
                  <option value="transfer">{t.payTransfer}</option>
                  <option value="pos_card">{t.payCard}</option>
                  <option value="apple_pay">{t.payApplePay}</option>
                  <option value="cheque">{t.payCheque}</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.amount} * ({cur})</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={vchForm.amount}
                  onChange={(e) => setVchForm({ ...vchForm, amount: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono font-bold tabular-nums"
                />
              </div>
            </div>

            {vchForm.paymentMethod === 'cheque' && (
              <div className="grid grid-cols-2 gap-2.5 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <input
                  value={vchForm.chequeNumber}
                  onChange={(e) => setVchForm({ ...vchForm, chequeNumber: e.target.value })}
                  placeholder={isAr ? 'رقم الشيك *' : 'Cheque Number *'}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#0A120F] border text-xs font-mono"
                />
                <input
                  type="date"
                  value={vchForm.chequeDueDate}
                  onChange={(e) => setVchForm({ ...vchForm, chequeDueDate: e.target.value })}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#0A120F] border text-xs font-mono"
                />
              </div>
            )}

            <input
              maxLength={400}
              value={vchForm.reason}
              onChange={(e) => setVchForm({ ...vchForm, reason: e.target.value })}
              placeholder={`${t.reason} *`}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold cursor-pointer">
                <Paperclip className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                <span>{isAr ? 'إرفاق صورة الإيصال' : 'Attach Receipt'}</span>
                <input type="file" accept="image/*,application/pdf" onChange={handleAttachment} className="hidden" />
              </label>
              {vchForm.attachmentBase64 && (
                <span className="text-xs text-emerald-600 font-bold">✓ {isAr ? 'مرفق محفوظ' : 'Attached'}</span>
              )}
              <select value={vchForm.status} onChange={(e) => setVchForm({ ...vchForm, status: e.target.value as 'draft' | 'approved' })} className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold">
                <option value="approved">{isAr ? 'معتمد (ترحيل فوري)' : 'Approved (Post Now)'}</option>
                <option value="draft">{t.draft}</option>
              </select>
            </div>

            {formError && <p className="text-xs font-bold text-red-600">{formError}</p>}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setVchModal({ open: false })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  const cleanAmt = fromHalalas(toHalalas(parseFloat(vchForm.amount) || 0));
                  if (!vchForm.partyName.trim()) {
                    setFormError(isAr ? 'اسم الطرف إلزامي *' : 'Party name is required *');
                    return;
                  }
                  if (cleanAmt <= 0) {
                    setFormError(isAr ? 'أدخل مبلغاً أكبر من صفر *' : 'Amount must be greater than zero *');
                    return;
                  }
                  if (!vchForm.reason.trim()) {
                    setFormError(isAr ? 'البيان / السبب إلزامي *' : 'Reason is required *');
                    return;
                  }
                  actions.saveVoucher(
                    {
                      type: vchForm.type,
                      partyName: vchForm.partyName.trim(),
                      partyPhone: vchForm.partyPhone.trim(),
                      partyType: vchForm.partyType,
                      fromAccount: vchForm.fromAccount || undefined,
                      toAccount: vchForm.toAccount || undefined,
                      branchId: vchForm.branchId || undefined,
                      bankId: vchForm.bankId || undefined,
                      paymentMethod: vchForm.paymentMethod,
                      chequeNumber: vchForm.paymentMethod === 'cheque' ? vchForm.chequeNumber.trim() || undefined : undefined,
                      chequeDueDate: vchForm.paymentMethod === 'cheque' ? vchForm.chequeDueDate || undefined : undefined,
                      attachmentBase64: vchForm.attachmentBase64 || undefined,
                      status: vchForm.status,
                      reason: vchForm.reason.trim(),
                      amount: cleanAmt,
                      date: new Date(`${vchForm.date || new Date().toISOString().slice(0, 10)}T12:00:00`).toISOString(),
                    },
                    vchModal.editId,
                  );
                  setVchModal({ open: false });
                  actions.notify(
                    isAr ? 'تم حفظ السند وتحديث الرصيد والقيود' : 'Voucher saved & ledger updated',
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
