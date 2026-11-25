import React, { useState } from 'react';
import { Edit2, MessageCircle, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { strings } from '../data/translations';
import { VoucherType } from '../types/erp';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

export const VouchersScreen: React.FC<ScreenProps> = ({ store, onPrintVoucher }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [vchTab, setVchTab] = useState<VoucherType>('receipt');
  const [vchSearch, setVchSearch] = useState('');
  const [vchModal, setVchModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [vchForm, setVchForm] = useState({
    type: 'receipt' as VoucherType,
    partyName: '',
    partyPhone: '',
    amount: '',
    reason: '',
    paymentMethod: state.banks[0]?.id ?? 'cash',
  });

  const q = vchSearch.trim().toLowerCase();
  const items = state.vouchers.filter((v) => {
    if (v.type !== vchTab) return false;
    if (!q) return true;
    return (
      v.partyName.toLowerCase().includes(q) ||
      v.reason.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q)
    );
  });

  const partySuggestions = vchForm.type === 'receipt' ? state.customers : state.suppliers;

  const formatPaymentLabel = (pm: string) => {
    const bank = state.banks.find((b) => b.id === pm || b.nameEn === pm || b.nameAr === pm);
    if (bank) return isAr ? bank.nameAr : bank.nameEn;
    return pm;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex p-1 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl">
          <button
            onClick={() => setVchTab('receipt')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              vchTab === 'receipt' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.receiptVoucher}
          </button>
          <button
            onClick={() => setVchTab('payment')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              vchTab === 'payment' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.paymentVoucher}
          </button>
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={vchSearch}
            onChange={(e) => setVchSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-10 pe-4 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>

        <button
          onClick={() => {
            setVchForm({
              type: vchTab,
              partyName: '',
              partyPhone: '',
              amount: '',
              reason: '',
              paymentMethod: state.banks[0]?.id ?? 'cash',
            });
            setVchModal({ open: true });
          }}
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
                <span className="font-mono text-xs font-bold text-slate-500">
                  {v.id} · {formatPaymentLabel(v.paymentMethod)}
                </span>
                <span className={`font-mono text-lg font-extrabold tabular-nums ${v.type === 'receipt' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {v.amount.toFixed(2)} {cur}
                </span>
              </div>
              <h4 className="font-extrabold text-base">{v.partyName}</h4>
              <p className="text-xs text-slate-500">{v.reason || '—'}</p>
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
                    `${v.type === 'receipt' ? t.receiptVoucher : t.paymentVoucher} ${v.id}: ${v.amount.toFixed(2)} ${cur} - ${v.reason}`,
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
                      setVchForm({
                        type: v.type,
                        partyName: v.partyName,
                        partyPhone: v.partyPhone,
                        amount: String(v.amount),
                        reason: v.reason,
                        paymentMethod: v.paymentMethod,
                      });
                      setVchModal({ open: true, editId: v.id });
                    }}
                    aria-label={t.edit}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </button>
                  <button
                    onClick={() => actions.deleteVoucher(v.id)}
                    aria-label={t.delete}
                    className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {vchModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-md w-full p-6 space-y-3">
            <h3 className="text-lg font-extrabold">
              {vchModal.editId ? t.edit : t.addVoucher} ({vchForm.type === 'receipt' ? t.receiptVoucher : t.paymentVoucher})
            </h3>
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
              placeholder={vchForm.type === 'receipt' ? t.client : t.suppliers}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />
            <datalist id="ostora_voucher_parties">
              {partySuggestions.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>

            <input
              type="tel"
              maxLength={40}
              value={vchForm.partyPhone}
              onChange={(e) => setVchForm({ ...vchForm, partyPhone: e.target.value })}
              placeholder={t.phone}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{t.paymentMethodLabel}</label>
              <select
                value={vchForm.paymentMethod}
                onChange={(e) => setVchForm({ ...vchForm, paymentMethod: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              >
                {state.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isAr ? b.nameAr : b.nameEn}
                  </option>
                ))}
                <option value="Bank Transfer">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                <option value="Cheque">{isAr ? 'شيك' : 'Cheque'}</option>
              </select>
            </div>

            <input
              type="number"
              min={0.01}
              step="0.01"
              value={vchForm.amount}
              onChange={(e) => setVchForm({ ...vchForm, amount: e.target.value })}
              placeholder={t.amount}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
            />
            <input
              maxLength={400}
              value={vchForm.reason}
              onChange={(e) => setVchForm({ ...vchForm, reason: e.target.value })}
              placeholder={t.reason}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setVchModal({ open: false })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  const amt = parseFloat(vchForm.amount) || 0;
                  if (!vchForm.partyName.trim() || amt <= 0) return;
                  actions.saveVoucher(
                    {
                      ...vchForm,
                      partyName: vchForm.partyName.trim(),
                      partyPhone: vchForm.partyPhone.trim(),
                      reason: vchForm.reason.trim(),
                      amount: amt,
                      date: new Date().toISOString(),
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
