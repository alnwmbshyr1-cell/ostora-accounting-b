import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Lock,
  Mail,
  MessageCircle,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { DEFAULT_PRODUCT_IMAGE } from '../constants/permissions';
import { useFirebase } from '../contexts/FirebaseContext';
import { strings } from '../data/translations';
import { CurrencyCode, Invoice, InvoiceStatus, LineItem } from '../types/erp';
import { DEFAULT_ENABLED_CURRENCIES, getCurrencyMeta } from '../utils/currencies';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

export const InvoicesScreen: React.FC<ScreenProps> = ({ store, onPrintInvoice }) => {
  const { user } = useFirebase();
  const isAdmin = user?.email === 'alnwmbshyr1@gmail.com';
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const enabledCurrencies = Array.from(
    new Set<CurrencyCode>([
      cur,
      ...(state.settings.enabledCurrencies ?? DEFAULT_ENABLED_CURRENCIES),
    ]),
  );
  const ratesMap = state.settings.exchangeRates ?? {};

  const defaultSalesTaxRate = state.settings.defaultSalesTaxRate ?? 15;
  const [invSearch, setInvSearch] = useState('');
  const [invFilter, setInvFilter] = useState<'all' | InvoiceStatus>('all');
  const [invModal, setInvModal] = useState<{ open: boolean; edit?: Invoice }>({ open: false });
  const [invForm, setInvForm] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    description: '',
    subtotal: '',
    taxRate: String(defaultSalesTaxRate),
    currency: cur as CurrencyCode,
    exchangeRate: '1',
    status: 'pending' as InvoiceStatus,
    items: [] as LineItem[],
  });
  const [invProdId, setInvProdId] = useState(state.products[0]?.id ?? '');
  const [invProdQty, setInvProdQty] = useState('1');
  const [refreshingFx, setRefreshingFx] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'one' | 'all'; id?: string } | null>(null);

  const filtered = state.invoices.filter((inv) => {
    const okFilter = invFilter === 'all' || inv.status === invFilter;
    const q = invSearch.toLowerCase();
    const okSearch = !q || inv.customerName.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q);
    return okFilter && okSearch;
  });

  const subNum = parseFloat(invForm.subtotal) || 0;
  const parsedRate = parseFloat(invForm.taxRate);
  const activeTaxRate = Number.isFinite(parsedRate) ? Math.max(0, Math.min(100, parsedRate)) : defaultSalesTaxRate;
  const vatNum = Number(((subNum * activeTaxRate) / 100).toFixed(2));
  const totalNum = Number((subNum + vatNum).toFixed(2));
  const parsedFx = parseFloat(invForm.exchangeRate);
  const activeFxRate =
    invForm.currency === cur ? 1 : Number.isFinite(parsedFx) && parsedFx > 0 ? parsedFx : ratesMap[invForm.currency] ?? 1;
  const convertedBaseTotal = Number((totalNum * activeFxRate).toFixed(2));
  const creditCheck = actions.checkCustomerCreditLimit(
    invForm.customerName,
    invForm.customerId,
    convertedBaseTotal,
    invForm.status,
    invModal.edit?.id,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={invSearch}
            onChange={(e) => setInvSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <button
          onClick={() => {
            setInvProdId(state.products[0]?.id ?? '');
            setInvProdQty('1');
            setInvForm({
              customerId: state.customers[0]?.id ?? '',
              customerName: state.customers[0]?.name ?? '',
              customerPhone: state.customers[0]?.phone ?? '',
              description: '',
              subtotal: '',
              taxRate: String(defaultSalesTaxRate),
              currency: cur,
              exchangeRate: '1',
              status: 'pending',
              items: [],
            });
            setInvModal({ open: true });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm hover:opacity-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addInvoice}</span>
        </button>
        {state.invoices.length > 0 && (
          <button
            onClick={() => setConfirmDelete({ type: 'all' })}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 font-bold text-xs hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.deleteAll}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl w-fit">
        {(['all', 'paid', 'pending', 'overdue'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setInvFilter(st)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              invFilter === st
                ? 'bg-[#0A3D2C] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2C24]'
            }`}
          >
            {t[st]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
          {t.noData}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((inv) => (
            <div
              key={inv.id}
              className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-slate-500">{inv.id}</span>
                <span
                  className={`font-bold ${
                    inv.status === 'paid'
                      ? 'text-emerald-600'
                      : inv.status === 'overdue'
                      ? 'text-red-600'
                      : 'text-amber-600'
                  }`}
                >
                  {t[inv.status]}
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-base">{inv.customerName}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{inv.description || '—'}</p>
              </div>
              <div className="flex items-baseline justify-between text-xs pt-1">
                <span className="text-slate-500 font-mono tabular-nums">
                  {t.subtotal}: {inv.subtotal.toFixed(2)} · {t.vat} (
                  {inv.taxRate ?? (inv.subtotal > 0 ? Number(((inv.vat / inv.subtotal) * 100).toFixed(1)) : defaultSalesTaxRate)}
                  %): {inv.vat.toFixed(2)}
                </span>
                <div className="text-end">
                  <span className="text-lg font-extrabold text-[#0A3D2C] dark:text-[#C9A227] font-mono tabular-nums block">
                    {inv.total.toFixed(2)} {inv.currency ?? cur}
                  </span>
                  {inv.currency && inv.currency !== cur && (
                    <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                      ≈ {(inv.baseTotal ?? inv.total * (inv.exchangeRate ?? 1)).toFixed(2)} {cur}
                    </span>
                  )}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-[#1F332B] flex flex-wrap items-center gap-2">
                {inv.status !== 'paid' && (
                  <button
                    onClick={() => {
                      actions.markInvoicePaid(inv.id);
                      actions.notify(
                        isAr
                          ? `تم تحصيل الفاتورة ${inv.id} وإصدار سند قبض وقيد مزدوج`
                          : `Invoice ${inv.id} marked paid with auto receipt & journal`,
                      );
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#C9A227] text-slate-950 text-xs font-extrabold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تحصيل' : 'Mark Paid'}</span>
                  </button>
                )}
                <button
                  onClick={() => onPrintInvoice?.(inv)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printPdf}</span>
                </button>
                <a
                  href={buildWhatsAppLink(
                    inv.customerPhone,
                    isAr
                      ? `السلام عليكم ${inv.customerName}، الفاتورة الضريبية رقم ${inv.id} بإجمالي ${inv.total.toFixed(2)} ${inv.currency ?? cur} (شامل ${inv.taxRate ?? (inv.subtotal > 0 ? Number(((inv.vat / inv.subtotal) * 100).toFixed(1)) : defaultSalesTaxRate)}% ضريبة) من ${state.settings.companyName}.`
                      : `Hello ${inv.customerName}, Tax Invoice ${inv.id} total ${inv.total.toFixed(2)} ${inv.currency ?? cur} from ${state.settings.companyName}.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{t.whatsapp}</span>
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Invoice ${inv.id}`)}&body=${encodeURIComponent(`Total: ${inv.total.toFixed(2)} ${inv.currency ?? cur}`)}`}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24]"
                  title={t.emailShare}
                >
                  <Mail className="w-4 h-4 text-slate-500" />
                </a>
                <div className="ms-auto flex items-center gap-1">
                  {inv.status === 'paid' && !isAdmin ? (
                    <span
                      title={t.lockedRecordHint}
                      aria-label={t.lockedRecordHint}
                      className="p-1.5 rounded-lg text-slate-400 cursor-not-allowed"
                    >
                      <Lock className="w-4 h-4" />
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        const existingRate =
                          inv.taxRate ??
                          (inv.subtotal > 0
                            ? Number(((inv.vat / inv.subtotal) * 100).toFixed(1))
                            : defaultSalesTaxRate);
                        const invCur = inv.currency ?? cur;
                        setInvForm({
                          customerId: inv.customerId,
                          customerName: inv.customerName,
                          customerPhone: inv.customerPhone,
                          description: inv.description,
                          subtotal: String(inv.subtotal),
                          taxRate: String(existingRate),
                          currency: invCur,
                          exchangeRate: String(invCur === cur ? 1 : inv.exchangeRate ?? ratesMap[invCur] ?? 1),
                          status: inv.status,
                          items: inv.items ?? [],
                        });
                        setInvModal({ open: true, edit: inv });
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                      aria-label={t.edit}
                    >
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete({ type: 'one', id: inv.id })}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                    aria-label={t.delete}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {invModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-lg w-full p-6 space-y-3 my-auto">
            <h3 className="text-lg font-extrabold">{invModal.edit ? t.editInvoice : t.addInvoice}</h3>
            <input
              type="text"
              maxLength={160}
              list="ostora_invoice_customers"
              value={invForm.customerName}
              onChange={(e) => {
                const val = e.target.value;
                const match = state.customers.find((c) => c.name === val);
                setInvForm({
                  ...invForm,
                  customerId: match ? match.id : '',
                  customerName: val,
                  customerPhone: match ? match.phone : invForm.customerPhone,
                });
              }}
              placeholder={t.client}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />
            <datalist id="ostora_invoice_customers">
              {state.customers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            <input
              type="tel"
              maxLength={40}
              value={invForm.customerPhone}
              onChange={(e) => setInvForm({ ...invForm, customerPhone: e.target.value })}
              placeholder={t.phone}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />

            <div className="border border-slate-200 dark:border-[#1F332B] rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-slate-500">{t.product}</p>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {state.products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setInvProdId(p.id)}
                    className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg text-start text-xs cursor-pointer ${
                      invProdId === p.id ? 'bg-[#0A3D2C] text-white' : 'hover:bg-slate-100 dark:hover:bg-[#1A2C24]'
                    }`}
                  >
                    <img src={p.imageBase64 || DEFAULT_PRODUCT_IMAGE} alt={p.name} className="w-8 h-8 rounded object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{p.name}</p>
                      <p className="font-mono text-[10px] opacity-75">{p.barcode}</p>
                    </div>
                    <span className="font-mono font-bold">{p.price} {cur}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="number" min={1} value={invProdQty} onChange={(e) => setInvProdQty(e.target.value)} className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs" />
                <button
                  type="button"
                  onClick={() => {
                    const pr = state.products.find((p) => p.id === invProdId);
                    const qty = parseInt(invProdQty, 10) || 1;
                    if (!pr) return;
                    const nextItems = [
                      ...invForm.items,
                      { productId: pr.id, productName: pr.name, qty, unitPrice: pr.price, total: Number((qty * pr.price).toFixed(2)) },
                    ];
                    const nextSub = nextItems.reduce((s, it) => s + it.total, 0);
                    setInvForm({
                      ...invForm,
                      items: nextItems,
                      subtotal: nextSub.toFixed(2),
                      description: nextItems.map((it) => `${it.productName} ×${it.qty}`).join(' · '),
                    });
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
                >
                  + {t.addItem}
                </button>
              </div>
              {invForm.items.length > 0 && (
                <div className="pt-1.5 border-t border-slate-100 dark:border-[#1F332B] space-y-1 max-h-24 overflow-y-auto">
                  {invForm.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="truncate">{it.productName} ×{it.qty}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold tabular-nums">{it.total.toFixed(2)} {cur}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextItems = invForm.items.filter((_, i) => i !== idx);
                            const nextSub = nextItems.reduce((s, x) => s + x.total, 0);
                            setInvForm({
                              ...invForm,
                              items: nextItems,
                              subtotal: nextItems.length ? nextSub.toFixed(2) : '',
                              description: nextItems.map((x) => `${x.productName} ×${x.qty}`).join(' · '),
                            });
                          }}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                          aria-label={t.delete}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <input
              type="text"
              maxLength={500}
              value={invForm.description}
              onChange={(e) => setInvForm({ ...invForm, description: e.target.value })}
              placeholder={t.reason}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.invoiceCurrency}</label>
                <select
                  value={invForm.currency}
                  onChange={(e) => {
                    const nextCur = e.target.value as CurrencyCode;
                    const nextFx = nextCur === cur ? 1 : ratesMap[nextCur] ?? 1;
                    setInvForm({
                      ...invForm,
                      currency: nextCur,
                      exchangeRate: String(nextFx),
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  {Array.from(new Set<CurrencyCode>([...enabledCurrencies, invForm.currency])).map((code) => {
                    const meta = getCurrencyMeta(code);
                    return (
                      <option key={code} value={code}>
                        {code} — {isAr ? meta.nameAr : meta.nameEn}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-500">
                    {t.exchangeRate} (1 {invForm.currency} → {cur})
                  </label>
                  {invForm.currency !== cur && (
                    <button
                      type="button"
                      disabled={refreshingFx}
                      onClick={async () => {
                        setRefreshingFx(true);
                        try {
                          const res = await actions.refreshLiveExchangeRates(cur);
                          const liveRate = res.rates[invForm.currency];
                          if (liveRate) {
                            setInvForm((f) => ({ ...f, exchangeRate: String(liveRate) }));
                          }
                        } finally {
                          setRefreshingFx(false);
                        }
                      }}
                      className="text-[10px] font-bold text-[#0A3D2C] dark:text-[#C9A227] flex items-center gap-0.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshingFx ? 'animate-spin' : ''}`} />
                      <span>{isAr ? 'مباشر' : 'Live'}</span>
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min={0.0001}
                  step={0.0001}
                  disabled={invForm.currency === cur}
                  value={invForm.exchangeRate}
                  onChange={(e) => setInvForm({ ...invForm, exchangeRate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <input
                type="number"
                min={0}
                step="0.01"
                value={invForm.subtotal}
                onChange={(e) => setInvForm({ ...invForm, subtotal: e.target.value })}
                placeholder={t.subtotal}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
              />
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={invForm.taxRate}
                  onChange={(e) => setInvForm({ ...invForm, taxRate: e.target.value })}
                  placeholder={`${t.vat} %`}
                  aria-label={t.defaultSalesTax}
                  className="w-full px-3 py-2.5 pe-7 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
                />
                <span className="absolute top-1/2 -translate-y-1/2 end-2.5 text-xs font-bold text-slate-400">%</span>
              </div>
              <select
                value={invForm.status}
                onChange={(e) => setInvForm({ ...invForm, status: e.target.value as InvoiceStatus })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              >
                <option value="paid">{t.paid}</option>
                <option value="pending">{t.pending}</option>
                <option value="overdue">{t.overdue}</option>
              </select>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0A120F] space-y-1 text-xs font-bold tabular-nums">
              <div className="flex justify-between">
                <span>{t.vat} ({activeTaxRate}%): {vatNum.toFixed(2)} {invForm.currency}</span>
                <span className="text-[#0A3D2C] dark:text-[#C9A227]">{t.total}: {totalNum.toFixed(2)} {invForm.currency}</span>
              </div>
              {invForm.currency !== cur && (
                <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200 dark:border-[#1F332B]">
                  <span>{t.equivalentBase}</span>
                  <span className="font-mono">{convertedBaseTotal.toFixed(2)} {cur} (×{activeFxRate})</span>
                </div>
              )}
            </div>
            {creditCheck.customer && creditCheck.creditLimit !== undefined && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  !creditCheck.allowed
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-900 text-red-700 dark:text-red-300'
                    : 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {!creditCheck.allowed && <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>
                      {t.creditLimit}: {creditCheck.creditLimit.toLocaleString()} {cur}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums">
                    {t.debt}: {creditCheck.currentDebt.toLocaleString()} {cur}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                  <span>
                    {t.projectedBalance}: {creditCheck.projectedDebt.toLocaleString()} {cur}
                  </span>
                  {!creditCheck.allowed && (
                    <span className="font-extrabold">
                      {t.exceededBy}: +{creditCheck.exceededBy.toLocaleString()} {cur}
                    </span>
                  )}
                </div>
                {!creditCheck.allowed && (
                  <p className="font-bold pt-0.5">
                    {isAr
                      ? `${t.creditLimitExceeded} قم بسداد الفواتير السابقة أو اختر الحالة "مدفوعة" أو خفّض قيمة الفاتورة.`
                      : `${t.creditLimitExceeded} Settle existing debt, mark invoice as Paid, or reduce the amount.`}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setInvModal({ open: false })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] font-bold text-sm cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                disabled={!creditCheck.allowed}
                onClick={() => {
                  if (!invForm.customerName.trim() || subNum <= 0) return;
                  if (!creditCheck.allowed) {
                    actions.notify(
                      isAr
                        ? `${t.creditLimitExceeded} (${t.exceededBy}: ${creditCheck.exceededBy.toFixed(2)} ${cur})`
                        : `${t.creditLimitExceeded} (${t.exceededBy}: ${creditCheck.exceededBy.toFixed(2)} ${cur})`,
                    );
                    return;
                  }
                  const result = actions.saveInvoice(
                    {
                      customerId: creditCheck.customer?.id ?? invForm.customerId ?? invModal.edit?.customerId ?? '',
                      customerName: invForm.customerName.trim(),
                      customerPhone: invForm.customerPhone.trim(),
                      description: invForm.description.trim(),
                      items: invForm.items,
                      subtotal: subNum,
                      taxRate: activeTaxRate,
                      currency: invForm.currency,
                      exchangeRate: activeFxRate,
                      baseTotal: convertedBaseTotal,
                      status: invForm.status,
                      date: invModal.edit?.date ?? new Date().toISOString(),
                    },
                    invModal.edit?.id,
                  );
                  if (!result.ok) {
                    actions.notify(t.creditLimitExceeded);
                    return;
                  }
                  setInvModal({ open: false });
                  actions.notify(isAr ? 'تم حفظ الفاتورة بنجاح' : 'Invoice saved');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-red-600">{t.confirmDelete}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t.confirmDeleteMsg}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] font-bold text-sm cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (confirmDelete.type === 'all') actions.deleteAllInvoices();
                  else if (confirmDelete.id) actions.deleteInvoice(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm cursor-pointer"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
