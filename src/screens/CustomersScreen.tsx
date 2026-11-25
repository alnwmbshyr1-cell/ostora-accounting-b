import React, { useRef, useState } from 'react';
import { Download, Edit2, MessageCircle, Plus, Receipt, Search, Trash2, Upload } from 'lucide-react';
import { strings } from '../data/translations';
import { parseCustomersCsv } from '../utils/csvImport';
import { downloadTextFile } from '../utils/export';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

export const CustomersScreen: React.FC<ScreenProps> = ({ store, onNavigate }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [custSearch, setCustSearch] = useState('');
  const [custModal, setCustModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [custForm, setCustForm] = useState({ name: '', phone: '', email: '', debt: '0', creditLimit: '' });
  const csvInputRef = useRef<HTMLInputElement>(null);

  const q = custSearch.trim().toLowerCase();
  const visibleCustomers = state.customers.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q),
  );

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const raw = await file.text();
      const { items } = parseCustomersCsv(raw);
      if (items.length === 0) {
        actions.notify(
          isAr ? 'لم يتم العثور على عملاء صالحين في ملف CSV' : 'No valid customer rows found in CSV',
        );
        return;
      }
      const added = actions.importCustomersBulk(items);
      actions.notify(
        isAr ? `تم استيراد ${added} عميل من ملف CSV` : `Imported ${added} customers from CSV`,
      );
    } catch {
      actions.notify(isAr ? 'تعذر قراءة ملف CSV' : 'Failed to parse CSV file');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={custSearch}
            onChange={(e) => setCustSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const csv = ['ID,Name,Phone,Email,Debt,CreditLimit']
                .concat(
                  state.customers.map(
                    (c) => `${c.id},"${c.name}",${c.phone},${c.email},${c.debt},${c.creditLimit ?? ''}`,
                  ),
                )
                .join('\n');
              downloadTextFile('ostora_customers.csv', csv);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{t.exportCsv}</span>
          </button>
          <button
            onClick={() => csvInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#0A3D2C] dark:border-[#C9A227] bg-white dark:bg-[#121E19] text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{t.importCsv}</span>
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsvFile}
          />
        </div>
        <button
          onClick={() => {
            setCustForm({ name: '', phone: '', email: '', debt: '0', creditLimit: '' });
            setCustModal({ open: true });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addCustomer}</span>
        </button>
      </div>

      {visibleCustomers.length === 0 ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
          {t.noData}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleCustomers.map((c) => {
          const hasLimit = typeof c.creditLimit === 'number' && Number.isFinite(c.creditLimit);
          const limitVal = hasLimit ? (c.creditLimit as number) : 0;
          const avail = hasLimit ? Math.max(0, limitVal - c.debt) : null;
          const pct = hasLimit
            ? limitVal > 0
              ? Math.min(100, Math.round((c.debt / limitVal) * 100))
              : c.debt > 0
              ? 100
              : 0
            : 0;
          const isOverOrAtLimit = hasLimit && c.debt >= limitVal && (c.debt > limitVal || limitVal === 0);

          return (
            <div key={c.id} className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#0A3D2C] text-white font-extrabold flex items-center justify-center shrink-0">
                  {c.name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-sm truncate">{c.name}</h4>
                  <p className="text-xs text-slate-500 font-mono">{c.phone}</p>
                </div>
                <div className="text-end">
                  <span className={`font-mono font-extrabold text-sm tabular-nums block ${c.debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {c.debt.toLocaleString()} {cur}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {t.creditLimit}: {hasLimit ? `${limitVal.toLocaleString()} ${cur}` : t.unlimitedCredit}
                  </span>
                </div>
              </div>

              {hasLimit && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                    <span className={isOverOrAtLimit ? 'text-red-600 font-bold' : 'text-slate-500'}>
                      {t.availableCredit}: {(avail ?? 0).toLocaleString()} {cur}
                    </span>
                    <span className={pct >= 90 ? 'text-red-600 font-bold' : 'text-slate-500'}>{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#0A120F] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 95 ? 'bg-red-600' : pct >= 75 ? 'bg-amber-500' : 'bg-[#0A3D2C] dark:bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#1F332B]">
                <a
                  href={buildWhatsAppLink(
                    c.phone,
                    isAr
                      ? `السلام عليكم ${c.name}، تذكير بالرصيد المستحق ${c.debt.toFixed(2)} ${cur} لدى ${state.settings.companyName}.`
                      : `Dear ${c.name}, reminder of balance ${c.debt.toFixed(2)} ${cur} with ${state.settings.companyName}.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{t.whatsappReminder}</span>
                </a>
                <button
                  onClick={() => {
                    if (c.debt > 0) {
                      const defaultBankId =
                        state.banks.find((b) => b.id === 'alrajhi')?.id ??
                        state.banks[0]?.id ??
                        'cash';
                      actions.saveVoucher({
                        type: 'receipt',
                        partyName: c.name,
                        partyPhone: c.phone,
                        amount: c.debt,
                        reason: isAr ? 'سداد رصيد عميل' : 'Customer debt settlement',
                        paymentMethod: defaultBankId,
                        date: new Date().toISOString(),
                      });
                    }
                    onNavigate('vouchers');
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>{t.createReceipt}</span>
                </button>
                <div className="ms-auto flex gap-1">
                  <button
                    onClick={() => {
                      setCustForm({
                        name: c.name,
                        phone: c.phone,
                        email: c.email,
                        debt: String(c.debt),
                        creditLimit: typeof c.creditLimit === 'number' ? String(c.creditLimit) : '',
                      });
                      setCustModal({ open: true, editId: c.id });
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </button>
                  <button onClick={() => actions.deleteCustomer(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {custModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-md w-full p-6 space-y-3">
            <h3 className="text-lg font-extrabold">{custModal.editId ? t.edit : t.addCustomer}</h3>
            <input maxLength={160} value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} placeholder={t.fullName} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <input type="tel" maxLength={40} value={custForm.phone} onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })} placeholder={t.phone} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <input type="email" maxLength={160} value={custForm.email} onChange={(e) => setCustForm({ ...custForm, email: e.target.value })} placeholder={t.email} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{t.debt} ({cur})</label>
              <input type="number" min={0} value={custForm.debt} onChange={(e) => setCustForm({ ...custForm, debt: e.target.value })} placeholder={t.debt} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{t.creditLimit} ({cur})</label>
              <input
                type="number"
                min={0}
                value={custForm.creditLimit}
                onChange={(e) => setCustForm({ ...custForm, creditLimit: e.target.value })}
                placeholder={t.unlimitedCredit}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
              />
              <p className="text-[11px] text-slate-500 mt-1">{t.creditLimitHint}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setCustModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!custForm.name.trim()) return;
                  const parsedLimit = custForm.creditLimit.trim() === '' ? undefined : Math.max(0, parseFloat(custForm.creditLimit) || 0);
                  actions.saveCustomer(
                    {
                      name: custForm.name.trim(),
                      phone: custForm.phone.trim(),
                      email: custForm.email.trim(),
                      debt: Math.max(0, parseFloat(custForm.debt) || 0),
                      ...(parsedLimit !== undefined ? { creditLimit: parsedLimit } : {}),
                    },
                    custModal.editId,
                  );
                  setCustModal({ open: false });
                  actions.notify(isAr ? 'تم حفظ بيانات العميل' : 'Customer saved');
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
