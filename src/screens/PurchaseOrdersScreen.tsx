import React, { useMemo, useState } from 'react';
import { Check, CheckCircle2, Edit2, Lock, MessageCircle, Paperclip, Plus, Printer, Search, Trash2, UserPlus, X } from 'lucide-react';
import { DEFAULT_PRODUCT_IMAGE } from '../constants/permissions';
import { strings } from '../data/translations';
import { computeInvoiceTotalsHalala } from '../domain/accounting';
import { fromHalalas, toHalalas } from '../domain/halala';
import { LineItem, PaymentMethodType, PurchaseOrder, PurchaseOrderStatus } from '../types/erp';
import { formatCurrency, formatCurrencyNumber } from '../utils/currencies';
import { compressImageToBase64 } from '../utils/image';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

export const PurchaseOrdersScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];
  const canDelete = state.currentRole !== 'accountant';

  const defaultPurchaseTaxRate = state.settings.defaultPurchaseTaxRate ?? 15;
  const [poSearch, setPoSearch] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState<'all' | PurchaseOrderStatus>('all');
  const [poModal, setPoModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [previewPo, setPreviewPo] = useState<PurchaseOrder | null>(null);
  const [quickSupOpen, setQuickSupOpen] = useState(false);
  const [quickSupName, setQuickSupName] = useState('');
  const [quickSupPhone, setQuickSupPhone] = useState('');
  const [quickSupTax, setQuickSupTax] = useState('');
  const [formError, setFormError] = useState('');

  const [poForm, setPoForm] = useState({
    supplierId: '',
    supplierName: '',
    supplierPhone: '',
    date: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: '',
    paymentTermDays: '30',
    branchId: state.branches[0]?.id ?? '',
    warehouseId: state.warehouses[0]?.id ?? '',
    paymentMethod: 'credit' as PaymentMethodType,
    status: 'ordered' as PurchaseOrderStatus,
    taxRate: String(defaultPurchaseTaxRate),
    discountTotal: '0',
    shippingFee: '0',
    paidAmount: '0',
    notes: '',
    supplierInvoiceBase64: '',
    items: [] as LineItem[],
  });

  const [selectedProdId, setSelectedProdId] = useState(state.products[0]?.id ?? '');
  const [itemQty, setItemQty] = useState('10');

  const nextPoPreviewId = useMemo(() => {
    const nums = state.purchaseOrders.map((p) => {
      const m = p.id.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 300;
    });
    return `PO-${Math.max(300, ...nums) + 1}`;
  }, [state.purchaseOrders]);

  const itemsSubH = poForm.items.reduce((s, i) => s + toHalalas(i.total), 0);
  const poParsedRate = parseFloat(poForm.taxRate);
  const poTaxRate = Number.isFinite(poParsedRate) ? Math.max(0, Math.min(100, poParsedRate)) : defaultPurchaseTaxRate;
  const calc = computeInvoiceTotalsHalala({
    subtotal: fromHalalas(itemsSubH),
    discountTotal: Math.max(0, parseFloat(poForm.discountTotal) || 0),
    shippingFee: Math.max(0, parseFloat(poForm.shippingFee) || 0),
    taxRate: poTaxRate,
    fxRate: 1,
    paidAmount: Math.max(0, parseFloat(poForm.paidAmount) || 0),
    status: 'pending',
  });

  const updateLine = (idx: number, patch: Partial<LineItem>) => {
    setPoForm((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => {
        if (i !== idx) return it;
        const merged = { ...it, ...patch };
        const qty = Math.max(1, Number(merged.qty) || 1);
        const unitCostH = Math.max(0, toHalalas(merged.unitPrice));
        const discPct = Math.max(0, Math.min(100, Number(merged.discountPercent) || 0));
        const grossH = Math.round(qty * unitCostH);
        const discH = Math.round((grossH * discPct) / 100);
        return {
          ...merged,
          qty,
          discountPercent: discPct,
          discountAmount: fromHalalas(discH),
          total: fromHalalas(Math.max(0, grossH - discH)),
        };
      }),
    }));
  };

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const b64 = await compressImageToBase64(file);
      setPoForm((prev) => ({ ...prev, supplierInvoiceBase64: b64 }));
      return;
    }
    if (file.size > 180 * 1024) {
      actions.notify(isAr ? 'الحد الأقصى لحجم الملف 180KB' : 'Max attachment size is 180KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPoForm((prev) => ({ ...prev, supplierInvoiceBase64: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const poStatusLabel = (st: PurchaseOrderStatus) => {
    const map: Record<PurchaseOrderStatus, string> = {
      draft: t.draft,
      approved: isAr ? 'معتمد' : 'Approved',
      ordered: t.ordered,
      received: t.received,
      cancelled: t.cancelled,
    };
    return map[st];
  };

  const q = poSearch.trim().toLowerCase();
  const visibleOrders = state.purchaseOrders.filter((po) => {
    const okStatus = poStatusFilter === 'all' || po.status === poStatusFilter;
    const okQ =
      !q ||
      po.supplierName.toLowerCase().includes(q) ||
      po.productName.toLowerCase().includes(q) ||
      po.id.toLowerCase().includes(q);
    return okStatus && okQ;
  });

  const openCreateModal = () => {
    const pr = state.products[0];
    const sup = state.suppliers[0];
    setFormError('');
    setSelectedProdId(pr?.id ?? '');
    setItemQty('10');
    setPoForm({
      supplierId: sup?.id ?? '',
      supplierName: sup?.name ?? '',
      supplierPhone: sup?.phone ?? '',
      date: new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: '',
      paymentTermDays: String(sup?.paymentTermDays ?? 30),
      branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
      warehouseId: state.settings.defaultWarehouseId ?? state.warehouses[0]?.id ?? '',
      paymentMethod: 'credit',
      status: 'ordered',
      taxRate: String(defaultPurchaseTaxRate),
      discountTotal: '0',
      shippingFee: '0',
      paidAmount: '0',
      notes: '',
      supplierInvoiceBase64: '',
      items: pr
        ? [{ productId: pr.id, productName: pr.name, qty: 10, unitPrice: pr.cost, discountPercent: 0, total: fromHalalas(Math.round(10 * toHalalas(pr.cost))) }]
        : [],
    });
    setPoModal({ open: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={poSearch}
            onChange={(e) => setPoSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 p-1 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl">
          {(['all', 'draft', 'approved', 'ordered', 'received', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setPoStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                poStatusFilter === st ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {st === 'all' ? t.all : poStatusLabel(st)}
            </button>
          ))}
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.createPo}</span>
        </button>
      </div>

      {visibleOrders.length === 0 ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
          {t.noData}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleOrders.map((po) => (
            <div key={po.id} className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="font-mono font-bold text-slate-500">{po.id} · {po.date.slice(0, 10)}</span>
                <span
                  className={`inline-flex items-center gap-1 font-bold ${
                    po.status === 'received'
                      ? 'text-emerald-600'
                      : po.status === 'cancelled'
                      ? 'text-red-600'
                      : po.status === 'approved'
                      ? 'text-blue-600'
                      : 'text-amber-600'
                  }`}
                >
                  {po.status === 'received' && <Lock className="w-3 h-3" />}
                  {poStatusLabel(po.status)}
                </span>
              </div>
              <h4 className="font-extrabold text-base">{po.supplierName}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {po.items && po.items.length > 1
                  ? `${po.items.length} ${isAr ? 'أصناف' : 'items'} (${po.productName}...)`
                  : `${po.productName} × ${po.quantity}`}{' '}
                · <span className="font-mono font-bold tabular-nums">{formatCurrency(po.total, cur, { isAr })}</span>
              </p>
              {po.vat !== undefined && (
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {t.subtotal}: {formatCurrency(po.subtotal ?? po.quantity * po.unitCost, cur, { isAr })} · {t.vat} ({po.taxRate ?? defaultPurchaseTaxRate}%): {formatCurrency(po.vat, cur, { isAr })}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-[#1F332B]">
                {(po.status === 'draft' || po.status === 'ordered') && (
                  <button
                    onClick={() => {
                      actions.updatePurchaseOrderStatus(po.id, 'approved');
                      actions.notify(isAr ? 'تم اعتماد أمر الشراء' : 'PO Approved');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/10 text-blue-700 dark:text-blue-400 text-xs font-bold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t.approvePo}</span>
                  </button>
                )}
                {po.status !== 'received' && po.status !== 'cancelled' && (
                  <button
                    onClick={() => {
                      actions.receivePurchaseOrder(po.id);
                      actions.notify(
                        isAr
                          ? 'تم استلام الكمية وتزويد المخزون وتسجيل القيد'
                          : 'PO received into stock & journal posted',
                      );
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{t.receive}</span>
                  </button>
                )}
                <button
                  onClick={() => setPreviewPo(po)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printPdf}</span>
                </button>
                <a
                  href={buildWhatsAppLink(
                    po.supplierPhone,
                    isAr
                      ? `أمر شراء ${po.id} من ${state.settings.companyName}: ${po.productName} الكمية ${po.quantity} الإجمالي ${formatCurrency(po.total, cur, { isAr })}.`
                      : `Purchase Order ${po.id} from ${state.settings.companyName}: ${po.productName} x ${po.quantity} (${formatCurrency(po.total, cur, { isAr })}).`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{t.whatsapp}</span>
                </a>
                {po.status !== 'received' && (
                  <button
                    onClick={() => {
                      setFormError('');
                      setPoForm({
                        supplierId: po.supplierId,
                        supplierName: po.supplierName,
                        supplierPhone: po.supplierPhone,
                        date: po.date.slice(0, 10),
                        expectedDeliveryDate: po.expectedDeliveryDate ?? '',
                        paymentTermDays: String(po.paymentTermDays ?? 30),
                        branchId: po.branchId ?? state.branches[0]?.id ?? '',
                        warehouseId: po.warehouseId ?? state.warehouses[0]?.id ?? '',
                        paymentMethod: po.paymentMethod ?? 'credit',
                        status: po.status,
                        taxRate: String(po.taxRate ?? defaultPurchaseTaxRate),
                        discountTotal: String(po.discountTotal ?? 0),
                        shippingFee: String(po.shippingFee ?? 0),
                        paidAmount: String(po.paidAmount ?? 0),
                        notes: po.notes ?? '',
                        supplierInvoiceBase64: po.supplierInvoiceBase64 ?? '',
                        items:
                          po.items && po.items.length > 0
                            ? po.items
                            : [
                                {
                                  productId: po.productId,
                                  productName: po.productName,
                                  qty: po.quantity,
                                  unitPrice: po.unitCost,
                                  discountPercent: 0,
                                  total: fromHalalas(Math.round(po.quantity * toHalalas(po.unitCost))),
                                },
                              ],
                      });
                      setPoModal({ open: true, editId: po.id });
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => {
                      actions.deletePurchaseOrder(po.id);
                      actions.notify(isAr ? 'تم حذف أمر الشراء' : 'Purchase Order deleted');
                    }}
                    className="ms-auto p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                    aria-label={t.delete}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PO Create/Edit Modal */}
      {poModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-3xl w-full p-6 space-y-3 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">{poModal.editId ? t.edit : t.createPo}</h3>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227]">
                {poModal.editId ?? nextPoPreviewId}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-500">{t.suppliers} *</label>
                <div className="mt-1 flex gap-1.5">
                  <input
                    list="ostora_po_suppliers"
                    maxLength={160}
                    value={poForm.supplierName}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = state.suppliers.find((s) => s.name === val);
                      setPoForm({
                        ...poForm,
                        supplierId: match ? match.id : '',
                        supplierName: val,
                        supplierPhone: match ? match.phone : poForm.supplierPhone,
                      });
                    }}
                    placeholder={t.suppliers}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setQuickSupName('');
                      setQuickSupPhone('');
                      setQuickSupTax('');
                      setQuickSupOpen(true);
                    }}
                    title={t.addSupplier}
                    className="px-3 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <datalist id="ostora_po_suppliers">
                  {state.suppliers.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.phone}</label>
                <input
                  type="tel"
                  maxLength={40}
                  value={poForm.supplierPhone}
                  onChange={(e) => setPoForm({ ...poForm, supplierPhone: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.date} *</label>
                <input type="date" value={poForm.date} onChange={(e) => setPoForm({ ...poForm, date: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{isAr ? 'التسليم المتوقع' : 'Expected Delivery'}</label>
                <input type="date" value={poForm.expectedDeliveryDate} onChange={(e) => setPoForm({ ...poForm, expectedDeliveryDate: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.branch}</label>
                <select value={poForm.branchId} onChange={(e) => setPoForm({ ...poForm, branchId: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                  {state.branches.map((b) => <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.warehouse}</label>
                <select value={poForm.warehouseId} onChange={(e) => setPoForm({ ...poForm, warehouseId: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                  {state.warehouses.map((w) => <option key={w.id} value={w.id}>{isAr ? w.nameAr : w.nameEn}</option>)}
                </select>
              </div>
            </div>

            {/* Multi-line Items Builder */}
            <div className="border border-slate-200 dark:border-[#1F332B] rounded-xl p-3 space-y-2.5">
              <p className="text-xs font-bold text-slate-500">{t.addItem} *</p>
              <div className="max-h-28 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {state.products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProdId(p.id)}
                    className={`flex items-center gap-2 p-1.5 rounded-lg text-start text-xs cursor-pointer ${
                      selectedProdId === p.id ? 'bg-[#0A3D2C] text-white' : 'hover:bg-slate-100 dark:hover:bg-[#1A2C24]'
                    }`}
                  >
                    <img src={p.imageBase64 || DEFAULT_PRODUCT_IMAGE} alt={p.name} className="w-7 h-7 rounded object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{p.name}</p>
                      <p className="font-mono text-[10px] opacity-75">{p.barcode}</p>
                    </div>
                    <span className="font-mono font-bold shrink-0">{formatCurrency(p.cost, cur, { isAr })}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                  placeholder={t.qty}
                  className="w-24 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const pr = state.products.find((p) => p.id === selectedProdId);
                    const qty = Math.max(1, parseInt(itemQty, 10) || 1);
                    if (!pr) return;
                    setPoForm({
                      ...poForm,
                      items: [
                        ...poForm.items,
                        {
                          productId: pr.id,
                          productName: pr.name,
                          qty,
                          unitPrice: pr.cost,
                          discountPercent: 0,
                          total: fromHalalas(Math.round(qty * toHalalas(pr.cost))),
                        },
                      ],
                    });
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
                >
                  + {t.addItem}
                </button>
              </div>

              {poForm.items.length > 0 && (
                <div className="overflow-x-auto pt-1">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-[#0A120F] text-slate-500">
                      <tr>
                        <th className="p-1.5 text-start">{t.product}</th>
                        <th className="p-1.5 text-center w-16">{t.qty}</th>
                        <th className="p-1.5 text-center w-24">{t.cost}</th>
                        <th className="p-1.5 text-center w-16">{t.discountPercent}</th>
                        <th className="p-1.5 text-end">{t.total}</th>
                        <th className="p-1.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
                      {poForm.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5 font-bold truncate max-w-[160px]">{it.productName}</td>
                          <td className="p-1">
                            <input type="number" min={1} value={it.qty} onChange={(e) => updateLine(idx, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })} className="w-full px-1.5 py-1 rounded bg-slate-50 dark:bg-[#0A120F] border text-center font-mono" />
                          </td>
                          <td className="p-1">
                            <input type="number" min={0} step="0.01" value={it.unitPrice} onChange={(e) => updateLine(idx, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })} className="w-full px-1.5 py-1 rounded bg-slate-50 dark:bg-[#0A120F] border text-center font-mono" />
                          </td>
                          <td className="p-1">
                            <input type="number" min={0} max={100} value={it.discountPercent ?? 0} onChange={(e) => updateLine(idx, { discountPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })} className="w-full px-1.5 py-1 rounded bg-slate-50 dark:bg-[#0A120F] border text-center font-mono" />
                          </td>
                          <td className="p-1.5 text-end font-mono font-bold tabular-nums">{formatCurrency(it.total, cur, { isAr })}</td>
                          <td className="p-1.5 text-center">
                            <button type="button" onClick={() => setPoForm({ ...poForm, items: poForm.items.filter((_, i) => i !== idx) })} className="text-red-600 font-bold cursor-pointer">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500">{isAr ? 'خصم إضافي' : 'Discount'}</label>
                <input type="number" min={0} step="0.01" value={poForm.discountTotal} onChange={(e) => setPoForm({ ...poForm, discountTotal: e.target.value })} className="mt-1 w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{isAr ? 'الشحن' : 'Shipping'}</label>
                <input type="number" min={0} step="0.01" value={poForm.shippingFee} onChange={(e) => setPoForm({ ...poForm, shippingFee: e.target.value })} className="mt-1 w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.vat} %</label>
                <input type="number" min={0} max={100} step="0.5" value={poForm.taxRate} onChange={(e) => setPoForm({ ...poForm, taxRate: e.target.value })} className="mt-1 w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t.paymentMethodLabel}</label>
                <select value={poForm.paymentMethod} onChange={(e) => setPoForm({ ...poForm, paymentMethod: e.target.value as PaymentMethodType })} className="mt-1 w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                  <option value="credit">{t.payCredit}</option>
                  <option value="cash">{t.payCash}</option>
                  <option value="transfer">{t.payTransfer}</option>
                  <option value="cheque">{t.payCheque}</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{isAr ? 'المدفوع' : 'Paid'}</label>
                <input type="number" min={0} step="0.01" value={poForm.paidAmount} onChange={(e) => setPoForm({ ...poForm, paidAmount: e.target.value })} className="mt-1 w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold cursor-pointer">
                <Paperclip className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                <span>{isAr ? 'إرفاق فاتورة المورد' : 'Attach Vendor Invoice'}</span>
                <input type="file" accept="image/*,application/pdf" onChange={handleAttachment} className="hidden" />
              </label>
              {poForm.supplierInvoiceBase64 && (
                <span className="text-xs text-emerald-600 font-bold">✓ {isAr ? 'مرفق محفوظ' : 'Attached'}</span>
              )}
              <select value={poForm.status} onChange={(e) => setPoForm({ ...poForm, status: e.target.value as PurchaseOrderStatus })} className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold">
                <option value="draft">{t.draft}</option>
                <option value="approved">{isAr ? 'معتمد' : 'Approved'}</option>
                <option value="ordered">{t.ordered}</option>
                <option value="cancelled">{t.cancelled}</option>
              </select>
            </div>

            <input value={poForm.notes} onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })} placeholder={t.notes} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0A120F] flex flex-wrap justify-between gap-2 text-xs font-bold tabular-nums">
              <span>{t.subtotal}: {formatCurrency(calc.subtotal, cur, { isAr })}</span>
              <span>{t.vat} ({poTaxRate}%): {formatCurrency(calc.vat, cur, { isAr })}</span>
              <span className="text-sm text-[#0A3D2C] dark:text-[#C9A227]">{t.total}: {formatCurrency(calc.total, cur, { isAr })}</span>
              <span>{isAr ? 'المتبقي:' : 'Due:'} {formatCurrency(calc.remainingAmount, cur, { isAr })}</span>
            </div>

            {formError && <p className="text-xs font-bold text-red-600">{formError}</p>}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setPoModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!poForm.supplierName.trim()) {
                    setFormError(isAr ? 'اسم المورد إلزامي *' : 'Supplier name is required *');
                    return;
                  }
                  if (!poForm.date) {
                    setFormError(isAr ? 'التاريخ إلزامي *' : 'Date is required *');
                    return;
                  }
                  if (poForm.items.length === 0) {
                    setFormError(isAr ? 'أضف صنفاً واحداً على الأقل *' : 'Add at least one item *');
                    return;
                  }
                  const firstLine = poForm.items[0];
                  const totalQty = poForm.items.reduce((s, i) => s + i.qty, 0);
                  actions.savePurchaseOrder(
                    {
                      supplierId: poForm.supplierId,
                      supplierName: poForm.supplierName.trim(),
                      supplierPhone: poForm.supplierPhone.trim(),
                      productId: firstLine.productId,
                      productName: firstLine.productName,
                      quantity: totalQty,
                      unitCost: firstLine.unitPrice,
                      items: poForm.items,
                      discountTotal: Math.max(0, parseFloat(poForm.discountTotal) || 0),
                      shippingFee: Math.max(0, parseFloat(poForm.shippingFee) || 0),
                      taxRate: poTaxRate,
                      date: new Date(`${poForm.date}T12:00:00`).toISOString(),
                      expectedDeliveryDate: poForm.expectedDeliveryDate || undefined,
                      paymentTermDays: parseInt(poForm.paymentTermDays, 10) || 30,
                      branchId: poForm.branchId || undefined,
                      warehouseId: poForm.warehouseId || undefined,
                      paymentMethod: poForm.paymentMethod,
                      paidAmount: Math.max(0, parseFloat(poForm.paidAmount) || 0),
                      status: poForm.status,
                      notes: poForm.notes.trim() || undefined,
                      supplierInvoiceBase64: poForm.supplierInvoiceBase64 || undefined,
                    },
                    poModal.editId,
                  );
                  setPoModal({ open: false });
                  actions.notify(isAr ? 'تم حفظ أمر الشراء بنجاح' : 'Purchase Order saved');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Supplier Modal */}
      {quickSupOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border rounded-[20px] max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm">{t.addSupplier}</h4>
              <button onClick={() => setQuickSupOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <input value={quickSupName} onChange={(e) => setQuickSupName(e.target.value)} placeholder={`${t.fullName} *`} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold" />
            <input type="tel" value={quickSupPhone} onChange={(e) => setQuickSupPhone(e.target.value)} placeholder={`${t.phone} *`} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
            <input value={quickSupTax} onChange={(e) => setQuickSupTax(e.target.value)} placeholder={t.taxNumber} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
            <button
              onClick={() => {
                if (!quickSupName.trim() || !quickSupPhone.trim()) return;
                actions.saveSupplier({
                  name: quickSupName.trim(),
                  phone: quickSupPhone.trim(),
                  taxNumber: quickSupTax.trim() || undefined,
                  category: isAr ? 'عام' : 'General',
                  payable: 0,
                  status: 'active',
                });
                setPoForm((prev) => ({
                  ...prev,
                  supplierName: quickSupName.trim(),
                  supplierPhone: quickSupPhone.trim(),
                }));
                setQuickSupOpen(false);
                actions.notify(isAr ? 'تمت إضافة المورد وتحديده' : 'Supplier added & selected');
              }}
              className="w-full py-2.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
            >
              {t.save}
            </button>
          </div>
        </div>
      )}

      {/* Printable PO Preview Modal */}
      {previewPo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-[20px] max-w-2xl w-full p-6 space-y-4 my-auto">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-[#0A3D2C]">{state.settings.companyName}</h3>
                <p className="text-xs text-slate-500">{isAr ? 'أمر شراء رسمي' : 'Purchase Order'}: {previewPo.id} · {previewPo.date.slice(0, 10)}</p>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer">
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printPdf}</span>
                </button>
                <button onClick={() => setPreviewPo(null)} className="p-1 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><strong>{t.suppliers}:</strong> {previewPo.supplierName}</div>
              <div><strong>{t.phone}:</strong> {previewPo.supplierPhone}</div>
            </div>
            <table className="w-full text-xs border">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-start">{t.product}</th>
                  <th className="p-2 text-end">{t.qty}</th>
                  <th className="p-2 text-end">{t.cost}</th>
                  <th className="p-2 text-end">{t.total}</th>
                </tr>
              </thead>
              <tbody>
                {(previewPo.items && previewPo.items.length > 0
                  ? previewPo.items
                  : [{ productId: previewPo.productId, productName: previewPo.productName, qty: previewPo.quantity, unitPrice: previewPo.unitCost, total: previewPo.quantity * previewPo.unitCost }]
                ).map((it, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{it.productName}</td>
                    <td className="p-2 text-end font-mono">{it.qty}</td>
                    <td className="p-2 text-end font-mono">{formatCurrencyNumber(it.unitPrice, cur)}</td>
                    <td className="p-2 text-end font-mono font-bold">{formatCurrencyNumber(it.total, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-6 text-xs font-bold pt-2 border-t">
              <span>{t.vat}: {formatCurrency(previewPo.vat ?? 0, cur, { isAr })}</span>
              <span className="text-base text-[#0A3D2C]">{t.total}: {formatCurrency(previewPo.total, cur, { isAr })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
