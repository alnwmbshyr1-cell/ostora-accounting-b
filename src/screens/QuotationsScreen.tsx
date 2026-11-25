import React, { useMemo, useState } from 'react';
import { Edit2, Layers, Lock, Mail, MessageCircle, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { DEFAULT_PRODUCT_IMAGE } from '../constants/permissions';
import { useFirebase } from '../contexts/FirebaseContext';
import { strings } from '../data/translations';
import { fromHalalas, toHalalas } from '../domain/halala';
import { CurrencyCode, LineItem, QuotationStatus } from '../types/erp';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

function addDaysIsoDate(baseDateStr: string, days: number): string {
  const base = baseDateStr ? new Date(`${baseDateStr}T12:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  base.setDate(base.getDate() + Math.max(0, days));
  return base.toISOString().slice(0, 10);
}

function diffDaysBetween(fromDateStr: string, toDateStr: string): number {
  const a = new Date(`${fromDateStr}T00:00:00`).getTime();
  const b = new Date(`${toDateStr}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 14;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export const QuotationsScreen: React.FC<ScreenProps> = ({ store, onNavigate, onPrintQuotation, onOpenBatchPrint }) => {
  const { user } = useFirebase();
  const isAdmin = user?.email === 'alnwmbshyr1@gmail.com';
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];
  const canDelete = state.currentRole !== 'accountant';

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuotationStatus>('all');
  const [qtModal, setQtModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [formError, setFormError] = useState('');
  const [qtForm, setQtForm] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    date: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    validityDays: '14',
    branchId: state.branches[0]?.id ?? '',
    salespersonName: state.employees.find((e) => e.role === 'salesman')?.name ?? '',
    currency: state.settings.currency as CurrencyCode,
    discountPercent: '0',
    status: 'sent' as QuotationStatus,
    terms: isAr ? 'الأسعار سارية حتى تاريخ الانتهاء الموضح أعلاه، والتسليم خلال 3 أيام عمل.' : 'Prices valid until expiry date. Delivery within 3 business days.',
    notes: '',
    items: [] as LineItem[],
  });
  const [qtSelectedProdId, setQtSelectedProdId] = useState(state.products[0]?.id ?? '');
  const [qtItemQty, setQtItemQty] = useState('1');
  const [qtConfirmDelete, setQtConfirmDelete] = useState<{ type: 'one' | 'all'; id?: string } | null>(null);

  const nextQtPreviewId = useMemo(() => {
    const nums = state.quotations.map((q) => {
      const m = q.id.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 200;
    });
    return `QT-${Math.max(200, ...nums) + 1}`;
  }, [state.quotations]);

  const qSearch = searchQuery.trim().toLowerCase();
  const visibleQuotations = state.quotations.filter((q) => {
    const matchesSearch =
      !qSearch ||
      q.id.toLowerCase().includes(qSearch) ||
      q.customerName.toLowerCase().includes(qSearch) ||
      q.customerPhone.toLowerCase().includes(qSearch) ||
      (q.notes ?? '').toLowerCase().includes(qSearch);
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const salesTaxRate = state.settings.defaultSalesTaxRate ?? 15;
  const subtotalH = qtForm.items.reduce((s, i) => s + toHalalas(i.total), 0);
  const discPct = Math.max(0, Math.min(100, parseFloat(qtForm.discountPercent) || 0));
  const discH = Math.round((subtotalH * discPct) / 100);
  const vatH = Math.round(((subtotalH - discH) * salesTaxRate) / 100);
  const totalH = Math.max(0, subtotalH - discH + vatH);

  const subtotalVal = fromHalalas(subtotalH);
  const discAmt = fromHalalas(discH);
  const vatAmt = fromHalalas(vatH);
  const totalAmt = fromHalalas(totalH);

  const updateLineItem = (idx: number, patch: Partial<LineItem>) => {
    setQtForm((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => {
        if (i !== idx) return it;
        const merged = { ...it, ...patch };
        const qty = Math.max(1, Number(merged.qty) || 1);
        const unitPriceH = Math.max(0, toHalalas(merged.unitPrice));
        const lineDiscPct = Math.max(0, Math.min(100, Number(merged.discountPercent) || 0));
        const grossH = Math.round(qty * unitPriceH);
        const lineDiscH = Math.round((grossH * lineDiscPct) / 100);
        const netH = Math.max(0, grossH - lineDiscH);
        return {
          ...merged,
          qty,
          discountPercent: lineDiscPct,
          discountAmount: fromHalalas(lineDiscH),
          total: fromHalalas(netH),
        };
      }),
    }));
  };

  const statusColor = (st: QuotationStatus) => {
    if (st === 'accepted') return 'text-emerald-600';
    if (st === 'rejected' || st === 'expired') return 'text-red-600';
    if (st === 'sent') return 'text-amber-600';
    return 'text-slate-500';
  };

  const enabledCurrencies = state.settings.enabledCurrencies ?? [state.settings.currency];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl p-1">
          {(['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                statusFilter === st ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {st === 'all' ? t.all : t[st]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {visibleQuotations.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const targets =
                  selectedIds.length > 0
                    ? visibleQuotations.filter((q) => selectedIds.includes(q.id))
                    : visibleQuotations;
                onOpenBatchPrint?.(targets.map((qt) => ({ kind: 'quotation', data: qt })));
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#C9A227] text-slate-950 font-extrabold text-xs cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>
                {selectedIds.length > 0
                  ? `${t.batchPrintSelected} (${selectedIds.length})`
                  : `${t.batchPrint} (${visibleQuotations.length})`}
              </span>
            </button>
          )}
          {state.quotations.length > 0 && canDelete && (
            <button
              onClick={() => setQtConfirmDelete({ type: 'all' })}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 text-xs font-bold cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.deleteAll}</span>
            </button>
          )}
          <button
            onClick={() => {
              const defProd = state.products[0];
              const today = new Date().toISOString().slice(0, 10);
              setFormError('');
              setQtSelectedProdId(defProd?.id ?? '');
              setQtItemQty('1');
              setQtForm({
                customerId: state.customers[0]?.id ?? '',
                customerName: state.customers[0]?.name ?? '',
                customerPhone: state.customers[0]?.phone ?? '',
                customerEmail: state.customers[0]?.email ?? '',
                date: today,
                validUntil: addDaysIsoDate(today, 14),
                validityDays: '14',
                branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
                salespersonName: state.employees.find((e) => e.role === 'salesman')?.name ?? '',
                currency: state.settings.currency,
                discountPercent: '0',
                status: 'sent',
                terms: isAr ? 'الأسعار سارية حتى تاريخ الانتهاء الموضح أعلاه، والتسليم خلال 3 أيام عمل.' : 'Prices valid until expiry date. Delivery within 3 business days.',
                notes: '',
                items: defProd
                  ? [{ productId: defProd.id, productName: defProd.name, qty: 1, unitPrice: defProd.price, discountPercent: 0, total: defProd.price }]
                  : [],
              });
              setQtModal({ open: true });
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addQuotation}</span>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.search}
          className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
        />
      </div>

      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] overflow-x-auto">
        {visibleQuotations.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">{t.noData}</p>
        ) : (
          <table className="w-full text-xs sm:text-sm min-w-[820px]">
            <thead className="bg-[#0A3D2C]/5 dark:bg-[#C9A227]/10 border-b border-slate-200 dark:border-[#1F332B]">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      visibleQuotations.length > 0 &&
                      visibleQuotations.every((q) => selectedIds.includes(q.id))
                    }
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? visibleQuotations.map((q) => q.id) : [])
                    }
                    className="w-4 h-4 rounded accent-[#0A3D2C] cursor-pointer"
                  />
                </th>
                <th className="p-3 text-start">ID</th>
                <th className="p-3 text-start">{t.client}</th>
                <th className="p-3 text-start">{t.date}</th>
                <th className="p-3 text-start">{t.validUntil}</th>
                <th className="p-3 text-end">{t.total}</th>
                <th className="p-3 text-start">{t.status}</th>
                <th className="p-3 text-end">—</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
              {visibleQuotations.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50/70 dark:hover:bg-[#182821]">
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(q.id)}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          prev.includes(q.id) ? prev.filter((x) => x !== q.id) : [...prev, q.id],
                        )
                      }
                      className="w-4 h-4 rounded accent-[#0A3D2C] cursor-pointer"
                    />
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-500">{q.id}</td>
                  <td className="p-3">
                    <div className="font-bold">{q.customerName}</div>
                    {q.salespersonName && <div className="text-[11px] text-slate-400">{q.salespersonName}</div>}
                  </td>
                  <td className="p-3 font-mono text-xs">{q.date.slice(0, 10)}</td>
                  <td className="p-3 font-mono text-xs">{q.validUntil}</td>
                  <td className="p-3 text-end font-mono font-extrabold text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
                    {q.total.toFixed(2)} {q.currency ?? cur}
                  </td>
                  <td className={`p-3 font-bold ${statusColor(q.status)}`}>{t[q.status]}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {q.status !== 'accepted' && (
                        <button
                          onClick={() => {
                            const res = actions.convertQuotationToInvoice(q.id);
                            if (!res.ok) {
                              actions.notify(
                                `${t.creditLimitExceeded} (${t.exceededBy}: ${(res.exceededBy ?? 0).toFixed(2)} ${cur})`,
                              );
                              return;
                            }
                            actions.notify(
                              isAr
                                ? `تم تحويل عرض السعر ${q.id} إلى فاتورة ضريبية وتحديث المخزون`
                                : `Quotation ${q.id} converted to Invoice`,
                            );
                            onNavigate('invoices');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#C9A227] text-slate-950 font-extrabold text-xs hover:opacity-95 cursor-pointer"
                        >
                          {t.convertToInvoice}
                        </button>
                      )}
                      <button
                        onClick={() => onPrintQuotation?.(q)}
                        className="p-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer"
                        title={t.printPdf}
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={buildWhatsAppLink(
                          q.customerPhone,
                          isAr
                            ? `السلام عليكم ${q.customerName}، نرفق لكم عرض السعر رقم ${q.id} بقيمة إجمالية ${q.total.toFixed(2)} ${q.currency ?? cur} (شامل الضريبة)، ساري حتى ${q.validUntil}.`
                            : `Dear ${q.customerName}, Quotation ${q.id} total ${q.total.toFixed(2)} ${q.currency ?? cur}, valid until ${q.validUntil}.`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                        title={t.whatsapp}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={`mailto:${q.customerEmail}?subject=${encodeURIComponent(`Quotation ${q.id}`)}&body=${encodeURIComponent(`Total: ${q.total.toFixed(2)} ${q.currency ?? cur}`)}`}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24]"
                        title={t.emailShare}
                      >
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                      </a>
                      {(q.status === 'accepted' || q.status === 'rejected') && !isAdmin ? (
                        <span
                          title={t.lockedRecordHint}
                          aria-label={t.lockedRecordHint}
                          className="p-1.5 rounded-lg text-slate-400 cursor-not-allowed"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            const dStr = q.date.slice(0, 10);
                            setFormError('');
                            setQtForm({
                              customerId: q.customerId,
                              customerName: q.customerName,
                              customerPhone: q.customerPhone,
                              customerEmail: q.customerEmail,
                              date: dStr,
                              validUntil: q.validUntil,
                              validityDays: String(q.validityDays ?? diffDaysBetween(dStr, q.validUntil)),
                              branchId: q.branchId ?? state.branches[0]?.id ?? '',
                              salespersonName: q.salespersonName ?? '',
                              currency: q.currency ?? state.settings.currency,
                              discountPercent: String(q.discountPercent),
                              status: q.status,
                              terms: q.terms ?? '',
                              notes: q.notes,
                              items: q.items,
                            });
                            setQtModal({ open: true, editId: q.id });
                          }}
                          aria-label={t.edit}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setQtConfirmDelete({ type: 'one', id: q.id })}
                          className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {qtModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-3xl w-full p-6 space-y-3 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">{qtModal.editId ? t.edit : t.addQuotation}</h3>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227]">
                {qtModal.editId ?? nextQtPreviewId}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-500">{t.client} *</label>
                <input
                  list="qt-customers"
                  maxLength={160}
                  value={qtForm.customerName}
                  onChange={(e) => {
                    const found = state.customers.find((c) => c.name === e.target.value);
                    setQtForm({
                      ...qtForm,
                      customerId: found?.id ?? '',
                      customerName: e.target.value,
                      customerPhone: found?.phone ?? qtForm.customerPhone,
                      customerEmail: found?.email ?? qtForm.customerEmail,
                    });
                  }}
                  placeholder={t.client}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                />
                <datalist id="qt-customers">
                  {state.customers.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.phone}</label>
                <input
                  maxLength={40}
                  value={qtForm.customerPhone}
                  onChange={(e) => setQtForm({ ...qtForm, customerPhone: e.target.value })}
                  placeholder={t.phone}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.date} *</label>
                <input
                  type="date"
                  value={qtForm.date}
                  onChange={(e) => {
                    const d = e.target.value;
                    const days = Math.max(1, parseInt(qtForm.validityDays, 10) || 14);
                    setQtForm({ ...qtForm, date: d, validUntil: addDaysIsoDate(d, days) });
                  }}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{isAr ? 'مدة الصلاحية (أيام)' : 'Validity (Days)'}</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={qtForm.validityDays}
                  onChange={(e) => {
                    const days = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setQtForm({
                      ...qtForm,
                      validityDays: e.target.value,
                      validUntil: addDaysIsoDate(qtForm.date, days),
                    });
                  }}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.validUntil} *</label>
                <input
                  type="date"
                  value={qtForm.validUntil}
                  onChange={(e) => {
                    const vu = e.target.value;
                    setQtForm({
                      ...qtForm,
                      validUntil: vu,
                      validityDays: String(diffDaysBetween(qtForm.date, vu)),
                    });
                  }}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.currency}</label>
                <select
                  value={qtForm.currency}
                  onChange={(e) => setQtForm({ ...qtForm, currency: e.target.value as CurrencyCode })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  {enabledCurrencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.branch}</label>
                <select
                  value={qtForm.branchId}
                  onChange={(e) => setQtForm({ ...qtForm, branchId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  {state.branches.map((b) => (
                    <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{isAr ? 'المندوب' : 'Salesperson'}</label>
                <input
                  value={qtForm.salespersonName}
                  onChange={(e) => setQtForm({ ...qtForm, salespersonName: e.target.value })}
                  placeholder={isAr ? 'اسم المندوب' : 'Salesperson'}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.email}</label>
                <input
                  type="email"
                  value={qtForm.customerEmail}
                  onChange={(e) => setQtForm({ ...qtForm, customerEmail: e.target.value })}
                  placeholder={t.email}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
            </div>

            {/* Product Picker & Editable Multi-line Table */}
            <div className="border border-slate-200 dark:border-[#1F332B] rounded-xl p-3 space-y-2.5">
              <p className="text-xs font-bold text-slate-500">{t.addItem} *</p>
              <div className="max-h-28 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {state.products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setQtSelectedProdId(p.id)}
                    className={`flex items-center gap-2 p-1.5 rounded-lg text-start text-xs cursor-pointer ${
                      qtSelectedProdId === p.id
                        ? 'bg-[#0A3D2C] text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-[#1A2C24]'
                    }`}
                  >
                    <img
                      src={p.imageBase64 || DEFAULT_PRODUCT_IMAGE}
                      alt={p.name}
                      className="w-7 h-7 rounded object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{p.name}</p>
                      <p className="font-mono text-[10px] opacity-75">{p.barcode}</p>
                    </div>
                    <span className="font-mono font-bold shrink-0">{p.price} {cur}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={qtItemQty}
                  onChange={(e) => setQtItemQty(e.target.value)}
                  placeholder={t.qty}
                  className="w-24 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const prod = state.products.find((p) => p.id === qtSelectedProdId);
                    const qty = Math.max(1, parseInt(qtItemQty, 10) || 1);
                    if (!prod) return;
                    setQtForm({
                      ...qtForm,
                      items: [
                        ...qtForm.items,
                        {
                          productId: prod.id,
                          productName: prod.name,
                          qty,
                          unitPrice: prod.price,
                          discountPercent: 0,
                          total: fromHalalas(Math.round(qty * toHalalas(prod.price))),
                        },
                      ],
                    });
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
                >
                  + {t.addItem}
                </button>
              </div>

              {qtForm.items.length > 0 && (
                <div className="overflow-x-auto pt-1">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-[#0A120F] text-slate-500">
                      <tr>
                        <th className="p-1.5 text-start">{t.product}</th>
                        <th className="p-1.5 text-center w-16">{t.qty}</th>
                        <th className="p-1.5 text-center w-24">{t.price}</th>
                        <th className="p-1.5 text-center w-16">{t.discountPercent}</th>
                        <th className="p-1.5 text-end">{t.total}</th>
                        <th className="p-1.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
                      {qtForm.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5 font-bold truncate max-w-[160px]">{it.productName}</td>
                          <td className="p-1">
                            <input
                              type="number"
                              min={1}
                              value={it.qty}
                              onChange={(e) => updateLineItem(idx, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                              className="w-full px-1.5 py-1 rounded bg-slate-50 dark:bg-[#0A120F] border text-center font-mono"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={it.unitPrice}
                              onChange={(e) => updateLineItem(idx, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                              className="w-full px-1.5 py-1 rounded bg-slate-50 dark:bg-[#0A120F] border text-center font-mono"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={it.discountPercent ?? 0}
                              onChange={(e) => updateLineItem(idx, { discountPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                              className="w-full px-1.5 py-1 rounded bg-slate-50 dark:bg-[#0A120F] border text-center font-mono"
                            />
                          </td>
                          <td className="p-1.5 text-end font-mono font-bold tabular-nums">{it.total.toFixed(2)}</td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setQtForm({
                                  ...qtForm,
                                  items: qtForm.items.filter((_, i) => i !== idx),
                                })
                              }
                              className="text-red-600 font-bold cursor-pointer"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-slate-500">{t.discountPercent}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={qtForm.discountPercent}
                  onChange={(e) => setQtForm({ ...qtForm, discountPercent: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">{t.status}</label>
                <select
                  value={qtForm.status}
                  onChange={(e) => setQtForm({ ...qtForm, status: e.target.value as QuotationStatus })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="draft">{t.draft}</option>
                  <option value="sent">{t.sent}</option>
                  <option value="accepted">{t.accepted}</option>
                  <option value="rejected">{t.rejected}</option>
                  <option value="expired">{t.expired}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <textarea
                rows={2}
                maxLength={500}
                value={qtForm.terms}
                onChange={(e) => setQtForm({ ...qtForm, terms: e.target.value })}
                placeholder={isAr ? 'الشروط والأحكام' : 'Terms & Conditions'}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
              <textarea
                rows={2}
                maxLength={500}
                value={qtForm.notes}
                onChange={(e) => setQtForm({ ...qtForm, notes: e.target.value })}
                placeholder={t.notes}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0A120F] flex flex-wrap justify-between gap-2 text-xs font-bold tabular-nums">
              <span>{t.subtotal}: {subtotalVal.toFixed(2)}</span>
              <span>{t.discountPercent}: -{discAmt.toFixed(2)}</span>
              <span>{t.vat} ({salesTaxRate}%): {vatAmt.toFixed(2)}</span>
              <span className="text-sm text-[#0A3D2C] dark:text-[#C9A227]">
                {t.total}: {totalAmt.toFixed(2)} {qtForm.currency}
              </span>
            </div>

            {formError && <p className="text-xs font-bold text-red-600">{formError}</p>}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setQtModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!qtForm.customerName.trim()) {
                    setFormError(isAr ? 'اسم العميل إلزامي *' : 'Customer name is required *');
                    return;
                  }
                  if (!qtForm.date || !qtForm.validUntil) {
                    setFormError(isAr ? 'تاريخ العرض وتاريخ الانتهاء إلزاميان *' : 'Dates are required *');
                    return;
                  }
                  if (qtForm.items.length === 0) {
                    setFormError(isAr ? 'أضف صنفاً واحداً على الأقل *' : 'Add at least one item *');
                    return;
                  }
                  actions.saveQuotation(
                    {
                      customerId: qtForm.customerId,
                      customerName: qtForm.customerName.trim(),
                      customerPhone: qtForm.customerPhone.trim(),
                      customerEmail: qtForm.customerEmail.trim(),
                      items: qtForm.items,
                      discountPercent: discPct,
                      subtotal: subtotalVal,
                      discountAmount: discAmt,
                      vat: vatAmt,
                      total: totalAmt,
                      validUntil: qtForm.validUntil,
                      validityDays: Math.max(1, parseInt(qtForm.validityDays, 10) || 14),
                      branchId: qtForm.branchId || undefined,
                      salespersonName: qtForm.salespersonName.trim() || undefined,
                      currency: qtForm.currency,
                      terms: qtForm.terms.trim() || undefined,
                      status: qtForm.status,
                      notes: qtForm.notes.trim(),
                      date: new Date(`${qtForm.date}T12:00:00`).toISOString(),
                    },
                    qtModal.editId,
                  );
                  setQtModal({ open: false });
                  actions.notify(isAr ? 'تم حفظ عرض السعر بنجاح' : 'Quotation saved');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {qtConfirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-red-600">{t.confirmDelete}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {qtConfirmDelete.type === 'all'
                ? isAr
                  ? `حذف جميع عروض الأسعار (${state.quotations.length})؟`
                  : `Delete all ${state.quotations.length} quotations?`
                : t.confirmDeleteMsg}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setQtConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (qtConfirmDelete.type === 'all') actions.deleteAllQuotations();
                  else if (qtConfirmDelete.id) actions.deleteQuotation(qtConfirmDelete.id);
                  setQtConfirmDelete(null);
                  actions.notify(isAr ? 'تم الحذف' : 'Deleted');
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold cursor-pointer"
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
