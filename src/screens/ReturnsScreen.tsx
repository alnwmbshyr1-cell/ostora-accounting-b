import React, { useMemo, useState } from 'react';
import { CheckCircle2, Edit2, FileSpreadsheet, ImagePlus, Layers, MessageCircle, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import { strings } from '../data/translations';
import { fromHalalas, toHalalas } from '../domain/halala';
import { ReturnReason, ReturnRecord, ReturnType as ReturnKind } from '../types/erp';
import { formatCurrency } from '../utils/currencies';
import { exportMultiSheetExcel } from '../utils/export';
import { compressImageToBase64 } from '../utils/image';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

export const ReturnsScreen: React.FC<ScreenProps> = ({ store, onPrintReturn, onOpenBatchPrint }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];
  const canDelete = state.currentRole !== 'accountant';

  const [retTab, setRetTab] = useState<ReturnKind>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [condFilter, setCondFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [retModal, setRetModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [retForm, setRetForm] = useState({
    originalDocId: '',
    productName: '',
    qty: '1',
    reason: 'damaged' as ReturnReason,
    date: new Date().toISOString().slice(0, 10),
    warehouseId: state.warehouses[0]?.id ?? '',
    branchId: state.branches[0]?.id ?? '',
    itemCondition: 'good_restock' as 'good_restock' | 'damaged_scrap',
    compensationMethod: 'account_credit' as 'cash_refund' | 'replacement' | 'account_credit',
    approved: true,
    photoBase64: '',
    notes: '',
  });
  const [retError, setRetError] = useState('');
  const [retConfirmDelete, setRetConfirmDelete] = useState<{ type: 'one' | 'all'; id?: string } | null>(null);

  const nextRetPreviewId = useMemo(() => {
    const nums = state.returns.map((r) => {
      const m = r.id.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 400;
    });
    return `RET-${Math.max(400, ...nums) + 1}`;
  }, [state.returns]);

  const tabList = state.returns.filter((r) => r.type === retTab);
  const q = searchQuery.trim().toLowerCase();
  const list = tabList.filter((r) => {
    const matchesSearch =
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.originalDocId.toLowerCase().includes(q) ||
      r.partyName.toLowerCase().includes(q) ||
      r.productName.toLowerCase().includes(q);
    const matchesReason = reasonFilter === 'all' || r.reason === reasonFilter;
    const cond = r.itemCondition ?? 'good_restock';
    const matchesCond = condFilter === 'all' || cond === condFilter;
    return matchesSearch && matchesReason && matchesCond;
  });

  const reasonLabel = (r: ReturnReason) => {
    const map: Record<ReturnReason, string> = {
      damaged: t.reasonDamaged,
      wrong_item: t.reasonWrongItem,
      expired: t.reasonExpired,
      not_matching: isAr ? 'غير مطابق للمواصفات' : 'Not Matching Specs',
      changed_mind: t.reasonChangedMind,
      other: t.reasonOther,
    };
    return map[r] ?? t.reasonOther;
  };

  const conditionLabel = (cond?: 'good_restock' | 'damaged_scrap') =>
    cond === 'damaged_scrap' ? t.itemConditionDamaged : t.itemConditionGood;

  const compLabel = (comp?: 'cash_refund' | 'replacement' | 'account_credit') => {
    if (comp === 'cash_refund') return t.compCashRefund;
    if (comp === 'replacement') return t.compReplacement;
    return t.compAccountCredit;
  };

  const sourceDocs =
    retTab === 'sales'
      ? state.invoices.map((i) => ({
          id: i.id,
          partyName: i.customerName,
          partyPhone: i.customerPhone,
          branchId: i.branchId ?? state.branches[0]?.id ?? '',
          warehouseId: i.warehouseId ?? state.warehouses[0]?.id ?? '',
          total: i.total,
          items:
            i.items && i.items.length > 0
              ? i.items
              : state.products.slice(0, 2).map((p) => ({
                  productId: p.id,
                  productName: p.name,
                  qty: 5,
                  unitPrice: p.price,
                  total: p.price * 5,
                })),
        }))
      : state.purchaseOrders.map((po) => ({
          id: po.id,
          partyName: po.supplierName,
          partyPhone: po.supplierPhone,
          branchId: po.branchId ?? state.branches[0]?.id ?? '',
          warehouseId: po.warehouseId ?? state.warehouses[0]?.id ?? '',
          total: po.total,
          items:
            po.items && po.items.length > 0
              ? po.items
              : [
                  {
                    productId: po.productId || state.products[0]?.id || '',
                    productName: po.productName,
                    qty: po.quantity,
                    unitPrice: po.unitCost,
                    total: fromHalalas(Math.round(po.quantity * toHalalas(po.unitCost))),
                  },
                ],
        }));

  const selectedDoc = sourceDocs.find((d) => d.id === retForm.originalDocId) ?? sourceDocs[0];
  const selectedItem =
    selectedDoc?.items.find((it) => it.productName === retForm.productName) ??
    selectedDoc?.items[0];
  const maxQty = Math.max(1, selectedItem?.qty ?? 1);
  const qtyNum = Math.max(0, parseInt(retForm.qty, 10) || 0);
  const matchedDocRate = selectedDoc
    ? retTab === 'sales'
      ? state.invoices.find((i) => i.id === selectedDoc.id)?.taxRate ?? state.settings.defaultSalesTaxRate ?? 15
      : state.purchaseOrders.find((p) => p.id === selectedDoc.id)?.taxRate ?? state.settings.defaultPurchaseTaxRate ?? 15
    : 15;
  const previewNetH = selectedItem ? Math.round(qtyNum * toHalalas(selectedItem.unitPrice)) : 0;
  const previewTotalH = Math.round(previewNetH * (1 + matchedDocRate / 100));

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await compressImageToBase64(file);
    setRetForm((prev) => ({ ...prev, photoBase64: b64 }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex p-1 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl">
          <button
            onClick={() => setRetTab('sales')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              retTab === 'sales' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.salesReturns}
          </button>
          <button
            onClick={() => setRetTab('purchase')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              retTab === 'purchase' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.purchaseReturns}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {list.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const targets =
                  selectedIds.length > 0
                    ? list.filter((r) => selectedIds.includes(r.id))
                    : list;
                onOpenBatchPrint?.(targets.map((r) => ({ kind: 'return', data: r })));
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C9A227] text-slate-950 font-extrabold text-xs cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>
                {selectedIds.length > 0
                  ? `${t.batchPrintSelected} (${list.filter((r) => selectedIds.includes(r.id)).length})`
                  : `${t.batchPrint} (${list.length})`}
              </span>
            </button>
          )}
          <button
            onClick={() => {
              exportMultiSheetExcel('ostora_returns.xls', [
                {
                  name: 'Returns',
                  rows: [
                    ['ID', 'Type', 'Original ID', 'Party', 'Product', 'Qty', 'Amount', 'Reason', 'Condition', 'Compensation', 'Approved', 'Date'],
                    ...list.map((r) => [
                      r.id,
                      r.type,
                      r.originalDocId,
                      r.partyName,
                      r.productName,
                      r.qty,
                      r.amount,
                      reasonLabel(r.reason),
                      conditionLabel(r.itemCondition),
                      compLabel(r.compensationMethod),
                      r.approved === false ? 'Pending' : 'Approved',
                      r.date.slice(0, 10),
                    ]),
                  ],
                },
              ]);
              actions.notify(isAr ? 'تم تصدير المرتجعات إلى Excel' : 'Returns exported to Excel');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t.exportExcel}</span>
          </button>
          <button
            onClick={() => {
              const firstDoc = sourceDocs[0];
              setRetError('');
              setRetForm({
                originalDocId: firstDoc?.id ?? '',
                productName: firstDoc?.items[0]?.productName ?? '',
                qty: '1',
                reason: 'damaged',
                date: new Date().toISOString().slice(0, 10),
                warehouseId: firstDoc?.warehouseId || state.warehouses[0]?.id || '',
                branchId: firstDoc?.branchId || state.branches[0]?.id || '',
                itemCondition: 'good_restock',
                compensationMethod: 'account_credit',
                approved: true,
                photoBase64: '',
                notes: '',
              });
              setRetModal({ open: true });
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addReturn}</span>
          </button>
          {list.length > 0 && canDelete && (
            <button
              onClick={() => setRetConfirmDelete({ type: 'all' })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 text-xs font-bold cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.deleteAll}</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search}
            className="w-full ps-10 pe-4 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs sm:text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الأسباب' : 'All Reasons'}</option>
          <option value="damaged">{t.reasonDamaged}</option>
          <option value="wrong_item">{t.reasonWrongItem}</option>
          <option value="expired">{t.reasonExpired}</option>
          <option value="not_matching">{isAr ? 'غير مطابق' : 'Not Matching'}</option>
          <option value="changed_mind">{t.reasonChangedMind}</option>
          <option value="other">{t.reasonOther}</option>
        </select>
        <select
          value={condFilter}
          onChange={(e) => setCondFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الحالات' : 'All Conditions'}</option>
          <option value="good_restock">{t.itemConditionGood}</option>
          <option value="damaged_scrap">{t.itemConditionDamaged}</option>
        </select>
      </div>

      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] overflow-x-auto">
        {list.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">{t.noData}</p>
        ) : (
          <table className="w-full text-xs sm:text-sm min-w-[920px]">
            <thead className="bg-[#0A3D2C]/5 dark:bg-[#C9A227]/10 border-b border-slate-200 dark:border-[#1F332B]">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={list.length > 0 && list.every((r) => selectedIds.includes(r.id))}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? list.map((r) => r.id) : [])
                    }
                    className="w-4 h-4 rounded accent-[#0A3D2C] cursor-pointer"
                  />
                </th>
                <th className="p-3 text-start">ID</th>
                <th className="p-3 text-start">{t.originalInvoice}</th>
                <th className="p-3 text-start">{retTab === 'sales' ? t.client : t.suppliers}</th>
                <th className="p-3 text-start">{t.product}</th>
                <th className="p-3 text-end">{t.qty}</th>
                <th className="p-3 text-end">{t.amount}</th>
                <th className="p-3 text-start">{t.reason}</th>
                <th className="p-3 text-start">{isAr ? 'الحالة والتسوية' : 'Condition / Refund'}</th>
                <th className="p-3 text-start">{t.date}</th>
                <th className="p-3 text-end">—</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
              {list.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-[#182821]">
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(r.id)}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id],
                        )
                      }
                      className="w-4 h-4 rounded accent-[#0A3D2C] cursor-pointer"
                    />
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span>{r.id}</span>
                      {r.approved !== false && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    </div>
                  </td>
                  <td className="p-3 font-mono">{r.originalDocId}</td>
                  <td className="p-3 font-bold">{r.partyName}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {r.photoBase64 && (
                        <img src={r.photoBase64} alt={r.productName} className="w-7 h-7 rounded object-cover border shrink-0" />
                      )}
                      <span>{r.productName}</span>
                    </div>
                  </td>
                  <td className="p-3 text-end font-mono tabular-nums">{r.qty}</td>
                  <td className="p-3 text-end font-mono font-extrabold text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
                    {formatCurrency(r.amount, cur, { isAr })}
                  </td>
                  <td className="p-3">{reasonLabel(r.reason)}</td>
                  <td className="p-3 text-[11px]">
                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold ${r.itemCondition === 'damaged_scrap' ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}`}>
                      {conditionLabel(r.itemCondition)}
                    </span>
                    <div className="text-slate-400 mt-0.5">{compLabel(r.compensationMethod)}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{r.date.slice(0, 10)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onPrintReturn?.(r)}
                        title={t.printCreditNote}
                        className="p-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={buildWhatsAppLink(
                          r.partyPhone,
                          isAr
                            ? `إشعار مرتجع رقم ${r.id} للمستند ${r.originalDocId}: الصنف ${r.productName} (الكمية ${r.qty}) بمبلغ ${formatCurrency(r.amount, cur, { isAr })}.`
                            : `Return Notice ${r.id} for ${r.originalDocId}: ${r.productName} x${r.qty}, Credit ${formatCurrency(r.amount, cur, { isAr })}.`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => {
                          setRetError('');
                          setRetForm({
                            originalDocId: r.originalDocId,
                            productName: r.productName,
                            qty: String(r.qty),
                            reason: r.reason,
                            date: r.date.slice(0, 10),
                            warehouseId: r.warehouseId ?? state.warehouses[0]?.id ?? '',
                            branchId: r.branchId ?? state.branches[0]?.id ?? '',
                            itemCondition: r.itemCondition ?? 'good_restock',
                            compensationMethod: r.compensationMethod ?? 'account_credit',
                            approved: r.approved !== false,
                            photoBase64: r.photoBase64 ?? '',
                            notes: r.notes,
                          });
                          setRetModal({ open: true, editId: r.id });
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => setRetConfirmDelete({ type: 'one', id: r.id })}
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

      {retModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-2xl w-full p-6 space-y-3 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {retModal.editId ? t.edit : t.addReturn} ({retTab === 'sales' ? t.salesReturns : t.purchaseReturns})
              </h3>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227]">
                {retModal.editId ?? nextRetPreviewId}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500">{t.originalInvoice} *</label>
                <select
                  value={selectedDoc?.id ?? ''}
                  onChange={(e) => {
                    const doc = sourceDocs.find((d) => d.id === e.target.value);
                    setRetForm({
                      ...retForm,
                      originalDocId: e.target.value,
                      productName: doc?.items[0]?.productName ?? '',
                      branchId: doc?.branchId || retForm.branchId,
                      warehouseId: doc?.warehouseId || retForm.warehouseId,
                    });
                  }}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  {sourceDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · {d.partyName} ({formatCurrency(d.total, cur, { isAr })})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">{t.date} *</label>
                <input
                  type="date"
                  value={retForm.date}
                  onChange={(e) => setRetForm({ ...retForm, date: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            </div>

            {selectedDoc && (
              <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] flex flex-wrap justify-between text-xs">
                <span>
                  <strong className="text-slate-500">{retTab === 'sales' ? t.client : t.suppliers}:</strong>{' '}
                  <b>{selectedDoc.partyName}</b>
                </span>
                <span className="font-mono text-slate-500">{selectedDoc.partyPhone}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-500">{t.product} *</label>
                <select
                  value={selectedItem?.productName ?? ''}
                  onChange={(e) => setRetForm({ ...retForm, productName: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  {(selectedDoc?.items ?? []).map((it) => (
                    <option key={it.productName} value={it.productName}>
                      {it.productName} ({t.qty}: {it.qty} · {it.unitPrice} {cur})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  {t.qty} * (max {maxQty})
                </label>
                <input
                  type="number"
                  min={1}
                  max={maxQty}
                  value={retForm.qty}
                  onChange={(e) => setRetForm({ ...retForm, qty: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500">{t.reason} *</label>
                <select
                  value={retForm.reason}
                  onChange={(e) => setRetForm({ ...retForm, reason: e.target.value as ReturnReason })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  <option value="damaged">{t.reasonDamaged}</option>
                  <option value="wrong_item">{t.reasonWrongItem}</option>
                  <option value="expired">{t.reasonExpired}</option>
                  <option value="not_matching">{isAr ? 'غير مطابق للمواصفات' : 'Not Matching Specs'}</option>
                  <option value="changed_mind">{t.reasonChangedMind}</option>
                  <option value="other">{t.reasonOther}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">{isAr ? 'حالة الصنف المرتجع' : 'Item Condition'}</label>
                <select
                  value={retForm.itemCondition}
                  onChange={(e) =>
                    setRetForm({
                      ...retForm,
                      itemCondition: e.target.value as 'good_restock' | 'damaged_scrap',
                    })
                  }
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  <option value="good_restock">{t.itemConditionGood}</option>
                  <option value="damaged_scrap">{t.itemConditionDamaged}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">{isAr ? 'طريقة التعويض / التسوية' : 'Compensation'}</label>
                <select
                  value={retForm.compensationMethod}
                  onChange={(e) =>
                    setRetForm({
                      ...retForm,
                      compensationMethod: e.target.value as 'cash_refund' | 'replacement' | 'account_credit',
                    })
                  }
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  <option value="account_credit">{t.compAccountCredit}</option>
                  <option value="cash_refund">{t.compCashRefund}</option>
                  <option value="replacement">{t.compReplacement}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500">{t.branch}</label>
                <select
                  value={retForm.branchId}
                  onChange={(e) => setRetForm({ ...retForm, branchId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  {state.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {isAr ? b.nameAr : b.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">{t.warehouse}</label>
                <select
                  value={retForm.warehouseId}
                  onChange={(e) => setRetForm({ ...retForm, warehouseId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  {state.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isAr ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B]">
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={retForm.approved}
                  onChange={(e) => setRetForm({ ...retForm, approved: e.target.checked })}
                  className="w-4 h-4 accent-[#0A3D2C] rounded"
                />
                <span>{isAr ? 'اعتماد المرتجع وترحيل القيد والمخزون فوراً' : 'Approve & post stock/journal immediately'}</span>
              </label>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer">
                  <ImagePlus className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                  <span>{isAr ? 'إرفاق صورة التلف' : 'Damaged Photo'}</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
                {retForm.photoBase64 && (
                  <div className="relative inline-flex items-center gap-1">
                    <img src={retForm.photoBase64} alt="Return" className="w-8 h-8 rounded object-cover border" />
                    <button
                      type="button"
                      onClick={() => setRetForm({ ...retForm, photoBase64: '' })}
                      className="text-red-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <textarea
              rows={2}
              maxLength={500}
              value={retForm.notes}
              onChange={(e) => setRetForm({ ...retForm, notes: e.target.value })}
              placeholder={t.notes}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />

            <div className="p-3 rounded-xl bg-[#0A3D2C]/5 dark:bg-[#C9A227]/10 flex flex-wrap justify-between items-center gap-2 text-xs font-bold tabular-nums">
              <span>{t.vat} ({matchedDocRate}%): {formatCurrency(fromHalalas(Math.max(0, previewTotalH - previewNetH)), cur, { isAr })}</span>
              <span className="text-sm text-[#0A3D2C] dark:text-[#C9A227]">
                {t.total}: {formatCurrency(fromHalalas(previewTotalH), cur, { isAr })}
              </span>
            </div>

            {retError && <p className="text-xs font-bold text-red-600">{retError}</p>}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setRetModal({ open: false })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  const qNum = parseInt(retForm.qty, 10) || 0;
                  if (!selectedDoc || !selectedItem) {
                    setRetError(isAr ? 'اختر الفاتورة والصنف أولاً *' : 'Please select document and item *');
                    return;
                  }
                  if (!retForm.date) {
                    setRetError(isAr ? 'تاريخ المرتجع إلزامي *' : 'Return date is required *');
                    return;
                  }
                  if (qNum <= 0 || qNum > maxQty) {
                    setRetError(
                      isAr
                        ? `الكمية يجب أن تكون بين 1 و ${maxQty}`
                        : `Quantity must be between 1 and ${maxQty}`,
                    );
                    return;
                  }
                  const amount = fromHalalas(
                    Math.round(Math.round(qNum * toHalalas(selectedItem.unitPrice)) * (1 + matchedDocRate / 100)),
                  );
                  const record: Omit<ReturnRecord, 'id'> = {
                    type: retTab,
                    originalDocId: selectedDoc.id,
                    partyName: selectedDoc.partyName,
                    partyPhone: selectedDoc.partyPhone,
                    productId: selectedItem.productId,
                    productName: selectedItem.productName,
                    qty: qNum,
                    unitPrice: selectedItem.unitPrice,
                    amount,
                    reason: retForm.reason,
                    warehouseId: retForm.warehouseId || undefined,
                    branchId: retForm.branchId || undefined,
                    itemCondition: retForm.itemCondition,
                    compensationMethod: retForm.compensationMethod,
                    approved: retForm.approved,
                    photoBase64: retForm.photoBase64 || undefined,
                    notes: retForm.notes.trim(),
                    date: new Date(`${retForm.date}T12:00:00`).toISOString(),
                  };
                  actions.saveReturn(record, retModal.editId);
                  setRetModal({ open: false });
                  actions.notify(
                    isAr
                      ? 'تم تسجيل المرتجع وتحديث المخزون والقيود بنجاح'
                      : 'Return recorded, stock & journal updated',
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

      {retConfirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-red-600">{t.confirmDelete}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {retConfirmDelete.type === 'all'
                ? isAr
                  ? `هل أنت متأكد من حذف جميع المرتجعات (${state.returns.length} سجل)؟`
                  : `Delete all ${state.returns.length} return records?`
                : t.confirmDeleteMsg}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setRetConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (retConfirmDelete.type === 'all') actions.deleteAllReturns();
                  else if (retConfirmDelete.id) actions.deleteReturn(retConfirmDelete.id);
                  setRetConfirmDelete(null);
                  actions.notify(isAr ? 'تم الحذف بنجاح' : 'Deleted successfully');
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
