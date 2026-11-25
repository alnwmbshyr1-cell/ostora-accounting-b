import React, { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Edit2,
  Pause,
  Play,
  Plus,
  Repeat,
  Search,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { DEFAULT_PRODUCT_IMAGE } from '../constants/permissions';
import { strings } from '../data/translations';
import {
  CurrencyCode,
  InvoiceStatus,
  LineItem,
  RecurringFrequency,
  RecurringInvoice,
} from '../types/erp';
import { DEFAULT_ENABLED_CURRENCIES, getCurrencyMeta } from '../utils/currencies';
import { ScreenProps } from './types';

export const RecurringInvoicesScreen: React.FC<ScreenProps> = ({ store }) => {
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
  const defaultTaxRate = state.settings.defaultSalesTaxRate ?? 15;
  const todayKey = new Date().toISOString().slice(0, 10);

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'due' | 'paused'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [prodId, setProdId] = useState(state.products[0]?.id ?? '');
  const [prodQty, setProdQty] = useState('1');

  const [form, setForm] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    description: '',
    items: [] as LineItem[],
    subtotal: '',
    taxRate: String(defaultTaxRate),
    currency: cur as CurrencyCode,
    frequency: 'monthly' as RecurringFrequency,
    nextRunDate: new Date().toISOString().slice(0, 10),
    targetStatus: 'pending' as InvoiceStatus,
    autoGenerate: true,
    active: true,
    notes: '',
  });

  const freqLabel = (f: RecurringFrequency) => {
    if (f === 'weekly') return t.freqWeekly;
    if (f === 'monthly') return t.freqMonthly;
    if (f === 'quarterly') return t.freqQuarterly;
    return t.freqYearly;
  };

  const openCreateModal = () => {
    const firstCust = state.customers[0];
    setEditId(undefined);
    setProdId(state.products[0]?.id ?? '');
    setProdQty('1');
    setForm({
      customerId: firstCust?.id ?? '',
      customerName: firstCust?.name ?? '',
      customerPhone: firstCust?.phone ?? '',
      description: '',
      items: [],
      subtotal: '',
      taxRate: String(defaultTaxRate),
      currency: cur,
      frequency: 'monthly',
      nextRunDate: new Date().toISOString().slice(0, 10),
      targetStatus: 'pending',
      autoGenerate: true,
      active: true,
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (rec: RecurringInvoice) => {
    setEditId(rec.id);
    setProdId(state.products[0]?.id ?? '');
    setProdQty('1');
    setForm({
      customerId: rec.customerId,
      customerName: rec.customerName,
      customerPhone: rec.customerPhone,
      description: rec.description,
      items: rec.items ?? [],
      subtotal: String(rec.subtotal),
      taxRate: String(rec.taxRate),
      currency: rec.currency,
      frequency: rec.frequency,
      nextRunDate: rec.nextRunDate,
      targetStatus: rec.targetStatus,
      autoGenerate: rec.autoGenerate,
      active: rec.active,
      notes: rec.notes,
    });
    setModalOpen(true);
  };

  const filtered = state.recurringInvoices.filter((rec) => {
    const isDue = rec.active && rec.nextRunDate <= todayKey;
    if (filterTab === 'active' && !rec.active) return false;
    if (filterTab === 'paused' && rec.active) return false;
    if (filterTab === 'due' && !isDue) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      rec.id.toLowerCase().includes(q) ||
      rec.customerName.toLowerCase().includes(q) ||
      rec.description.toLowerCase().includes(q)
    );
  });

  const activeCount = state.recurringInvoices.filter((r) => r.active).length;
  const dueCount = state.recurringInvoices.filter((r) => r.active && r.nextRunDate <= todayKey).length;
  const estMonthlyValue = state.recurringInvoices
    .filter((r) => r.active)
    .reduce((sum, r) => {
      const total = r.subtotal * (1 + r.taxRate / 100);
      const fx =
        r.currency === cur ? 1 : state.settings.exchangeRates?.[r.currency] ?? 1;
      const base = total * fx;
      const mult =
        r.frequency === 'weekly'
          ? 4.33
          : r.frequency === 'monthly'
          ? 1
          : r.frequency === 'quarterly'
          ? 1 / 3
          : 1 / 12;
      return sum + base * mult;
    }, 0);

  const subNum = parseFloat(form.subtotal) || 0;
  const rateNum = Math.max(0, Math.min(100, parseFloat(form.taxRate) || 0));
  const vatNum = Number(((subNum * rateNum) / 100).toFixed(2));
  const totalNum = Number((subNum + vatNum).toFixed(2));

  return (
    <div className="space-y-4">
      {/* Compact Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">{isAr ? 'القوالب النشطة' : 'Active Schedules'}</p>
            <p className="text-2xl font-extrabold font-mono tabular-nums mt-0.5">{activeCount}</p>
          </div>
          <Repeat className="w-6 h-6 text-[#0A3D2C] dark:text-[#C9A227]" />
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">{t.dueNowBadge}</p>
            <p className={`text-2xl font-extrabold font-mono tabular-nums mt-0.5 ${dueCount > 0 ? 'text-amber-600' : ''}`}>
              {dueCount}
            </p>
          </div>
          <CalendarClock className="w-6 h-6 text-amber-600" />
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              {isAr ? 'إيراد شهري متوقع' : 'Est. Monthly Run-Rate'}
            </p>
            <p className="text-xl font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-[#C9A227] mt-0.5">
              {estMonthlyValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur}
            </p>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        {dueCount > 0 && (
          <button
            onClick={() => {
              const res = actions.processDueRecurringInvoices();
              if (res.generated > 0) {
                actions.notify(
                  isAr
                    ? `تم إصدار ${res.generated} فاتورة متكررة بنجاح${res.skipped > 0 ? ` (تم تخطي ${res.skipped} لتجاوز الحد الائتماني)` : ''}`
                    : `Issued ${res.generated} recurring invoice(s)${res.skipped > 0 ? ` (${res.skipped} skipped due to credit limit)` : ''}`,
                );
              } else {
                actions.notify(
                  isAr
                    ? 'تعذر إصدار المستحق بسبب تجاوز الحد الائتماني'
                    : 'Due invoices skipped due to customer credit limit',
                );
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#C9A227] text-slate-950 font-extrabold text-xs sm:text-sm cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>{t.runDueInvoices} ({dueCount})</span>
          </button>
        )}
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm hover:opacity-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addRecurringInvoice}</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl w-fit">
        {(['all', 'active', 'due', 'paused'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              filterTab === tab
                ? 'bg-[#0A3D2C] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2C24]'
            }`}
          >
            {tab === 'all'
              ? t.all
              : tab === 'active'
              ? t.activeTemplate
              : tab === 'due'
              ? t.dueNowBadge
              : t.pausedTemplate}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
          {t.noData}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((rec) => {
            const total = rec.subtotal * (1 + rec.taxRate / 100);
            const isDue = rec.active && rec.nextRunDate <= todayKey;
            return (
              <div
                key={rec.id}
                className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-bold text-slate-500">
                    {rec.id} · {freqLabel(rec.frequency)}
                  </span>
                  <span
                    className={`flex items-center gap-1 font-bold ${
                      !rec.active
                        ? 'text-slate-500'
                        : isDue
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {!rec.active ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>{t.pausedTemplate}</span>
                      </>
                    ) : isDue ? (
                      <>
                        <CalendarClock className="w-3.5 h-3.5" />
                        <span>{t.dueNowBadge}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t.activeTemplate}</span>
                      </>
                    )}
                  </span>
                </div>

                <div>
                  <h4 className="font-extrabold text-base">{rec.customerName}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{rec.description || '—'}</p>
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs pt-1">
                  <div className="space-y-0.5 text-slate-500 font-mono tabular-nums">
                    <p>
                      {t.nextRunDate}: <span className="font-bold text-slate-800 dark:text-slate-200">{rec.nextRunDate}</span>
                    </p>
                    <p>
                      {t.generatedCountLabel}: {rec.generatedCount}
                      {rec.lastGeneratedDate ? ` · ${t.lastGeneratedDate}: ${rec.lastGeneratedDate}` : ''}
                    </p>
                  </div>
                  <div className="text-end">
                    <span className="text-lg font-extrabold text-[#0A3D2C] dark:text-[#C9A227] font-mono tabular-nums block">
                      {total.toFixed(2)} {rec.currency}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {rec.autoGenerate ? (isAr ? 'إصدار تلقائي' : 'Auto-issue') : isAr ? 'إصدار يدوي' : 'Manual'} · {t[rec.targetStatus]}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-[#1F332B] flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      const res = actions.generateInvoiceFromRecurring(rec.id);
                      if (!res.ok) {
                        actions.notify(
                          res.reason === 'credit_limit'
                            ? `${t.creditLimitExceeded} (${t.exceededBy}: ${(res.exceededBy ?? 0).toFixed(2)} ${cur})`
                            : isAr ? 'تعذر إصدار الفاتورة' : 'Failed to issue invoice',
                        );
                        return;
                      }
                      actions.notify(
                        isAr
                          ? `تم إصدار الفاتورة ${res.invoiceId} وتحديث الموعد القادم`
                          : `Issued invoice ${res.invoiceId} and advanced schedule`,
                      );
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#C9A227] text-slate-950 text-xs font-extrabold cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{t.issueNow}</span>
                  </button>

                  <button
                    onClick={() => actions.toggleRecurringInvoiceActive(rec.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
                  >
                    {rec.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{rec.active ? t.pause : t.resume}</span>
                  </button>

                  <div className="ms-auto flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(rec)}
                      aria-label={t.edit}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                      onClick={() => {
                        actions.deleteRecurringInvoice(rec.id);
                        actions.notify(isAr ? 'تم حذف القالب المتكرر' : 'Recurring template deleted');
                      }}
                      aria-label={t.delete}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-lg w-full p-6 space-y-3 my-auto">
            <h3 className="text-lg font-extrabold">
              {editId ? t.editRecurringInvoice : t.addRecurringInvoice}
            </h3>

            <input
              type="text"
              maxLength={160}
              list="ostora_rec_customers"
              value={form.customerName}
              onChange={(e) => {
                const val = e.target.value;
                const match = state.customers.find((c) => c.name === val);
                setForm({
                  ...form,
                  customerId: match ? match.id : '',
                  customerName: val,
                  customerPhone: match ? match.phone : form.customerPhone,
                });
              }}
              placeholder={t.client}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />
            <datalist id="ostora_rec_customers">
              {state.customers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>

            <input
              type="tel"
              maxLength={40}
              value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              placeholder={t.phone}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />

            {/* Optional Line Items Picker */}
            <div className="border border-slate-200 dark:border-[#1F332B] rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-slate-500">{t.product} ({isAr ? 'اختياري' : 'Optional'})</p>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {state.products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProdId(p.id)}
                    className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-start text-xs cursor-pointer ${
                      prodId === p.id ? 'bg-[#0A3D2C] text-white' : 'hover:bg-slate-100 dark:hover:bg-[#1A2C24]'
                    }`}
                  >
                    <img src={p.imageBase64 || DEFAULT_PRODUCT_IMAGE} alt={p.name} className="w-7 h-7 rounded object-cover shrink-0" />
                    <span className="flex-1 truncate font-bold">{p.name}</span>
                    <span className="font-mono font-bold">{p.price} {cur}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={prodQty}
                  onChange={(e) => setProdQty(e.target.value)}
                  className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const pr = state.products.find((p) => p.id === prodId);
                    const qty = parseInt(prodQty, 10) || 1;
                    if (!pr) return;
                    const nextItems = [
                      ...form.items,
                      { productId: pr.id, productName: pr.name, qty, unitPrice: pr.price, total: Number((qty * pr.price).toFixed(2)) },
                    ];
                    const nextSub = nextItems.reduce((s, it) => s + it.total, 0);
                    setForm({
                      ...form,
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
              {form.items.length > 0 && (
                <div className="pt-1 border-t border-slate-100 dark:border-[#1F332B] space-y-1 max-h-20 overflow-y-auto">
                  {form.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="truncate">{it.productName} ×{it.qty}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold tabular-nums">{it.total.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextItems = form.items.filter((_, i) => i !== idx);
                            const nextSub = nextItems.reduce((s, x) => s + x.total, 0);
                            setForm({
                              ...form,
                              items: nextItems,
                              subtotal: nextItems.length ? nextSub.toFixed(2) : form.subtotal,
                            });
                          }}
                          className="text-red-500 cursor-pointer"
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
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t.reason}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.subtotal}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.subtotal}
                  onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.vat} %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.taxRate}
                  onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.invoiceCurrency}</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value as CurrencyCode })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  {enabledCurrencies.map((code) => {
                    const meta = getCurrencyMeta(code);
                    return (
                      <option key={code} value={code}>
                        {code} — {isAr ? meta.nameAr : meta.nameEn}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.frequency}</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value as RecurringFrequency })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="weekly">{t.freqWeekly}</option>
                  <option value="monthly">{t.freqMonthly}</option>
                  <option value="quarterly">{t.freqQuarterly}</option>
                  <option value="yearly">{t.freqYearly}</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.nextRunDate}</label>
                <input
                  type="date"
                  value={form.nextRunDate}
                  onChange={(e) => setForm({ ...form, nextRunDate: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.targetInvoiceStatus}</label>
                <select
                  value={form.targetStatus}
                  onChange={(e) => setForm({ ...form, targetStatus: e.target.value as InvoiceStatus })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="pending">{t.pending}</option>
                  <option value="paid">{t.paid}</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={form.autoGenerate}
                onChange={(e) => setForm({ ...form, autoGenerate: e.target.checked })}
                className="rounded accent-[#0A3D2C] w-4 h-4"
              />
              <span>{t.autoGenerateToggle}</span>
            </label>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0A120F] flex justify-between text-xs font-bold tabular-nums">
              <span>{t.vat} ({rateNum}%): {vatNum.toFixed(2)} {form.currency}</span>
              <span className="text-[#0A3D2C] dark:text-[#C9A227]">{t.total}: {totalNum.toFixed(2)} {form.currency}</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  if (!form.customerName.trim() || subNum <= 0) return;
                  actions.saveRecurringInvoice(
                    {
                      customerId: form.customerId,
                      customerName: form.customerName.trim(),
                      customerPhone: form.customerPhone.trim(),
                      description: form.description.trim(),
                      items: form.items,
                      subtotal: subNum,
                      taxRate: rateNum,
                      currency: form.currency,
                      frequency: form.frequency,
                      nextRunDate: form.nextRunDate || todayKey,
                      targetStatus: form.targetStatus,
                      autoGenerate: form.autoGenerate,
                      active: form.active,
                      notes: form.notes.trim(),
                      date: new Date().toISOString(),
                    },
                    editId,
                  );
                  setModalOpen(false);
                  actions.notify(
                    isAr ? 'تم حفظ الفاتورة المتكررة بنجاح' : 'Recurring invoice schedule saved',
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
