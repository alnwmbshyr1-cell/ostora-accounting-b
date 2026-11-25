import React, { useState } from 'react';
import { Edit2, FileSpreadsheet, MessageCircle, Plus, Printer, Trash2 } from 'lucide-react';
import { strings } from '../data/translations';
import { ReturnReason, ReturnRecord, ReturnType as ReturnKind } from '../types/erp';
import { exportMultiSheetExcel } from '../utils/export';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

export const ReturnsScreen: React.FC<ScreenProps> = ({ store, onPrintReturn }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [retTab, setRetTab] = useState<ReturnKind>('sales');
  const [retModal, setRetModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [retForm, setRetForm] = useState({
    originalDocId: '',
    productName: '',
    qty: '1',
    reason: 'damaged' as ReturnReason,
    notes: '',
  });
  const [retError, setRetError] = useState('');
  const [retConfirmDelete, setRetConfirmDelete] = useState<{ type: 'one' | 'all'; id?: string } | null>(null);

  const list = state.returns.filter((r) => r.type === retTab);

  const reasonLabel = (r: ReturnReason) => {
    const map: Record<ReturnReason, string> = {
      damaged: t.reasonDamaged,
      wrong_item: t.reasonWrongItem,
      expired: t.reasonExpired,
      changed_mind: t.reasonChangedMind,
      other: t.reasonOther,
    };
    return map[r];
  };

  const sourceDocs =
    retTab === 'sales'
      ? state.invoices.map((i) => ({
          id: i.id,
          partyName: i.customerName,
          partyPhone: i.customerPhone,
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
          items: [
            {
              productId: po.productId || state.products[0]?.id || '',
              productName: po.productName,
              qty: po.quantity,
              unitPrice: po.unitCost,
              total: po.total,
            },
          ],
        }));

  const selectedDoc = sourceDocs.find((d) => d.id === retForm.originalDocId) ?? sourceDocs[0];
  const selectedItem =
    selectedDoc?.items.find((it) => it.productName === retForm.productName) ??
    selectedDoc?.items[0];
  const maxQty = selectedItem?.qty ?? 1;

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
          <button
            onClick={() => {
              exportMultiSheetExcel('ostora_returns.xls', [
                {
                  name: 'Returns',
                  rows: [
                    ['ID', 'Type', 'Original ID', 'Party', 'Product', 'Qty', 'Amount', 'Reason', 'Date'],
                    ...list.map((r) => [
                      r.id,
                      r.type,
                      r.originalDocId,
                      r.partyName,
                      r.productName,
                      r.qty,
                      r.amount,
                      reasonLabel(r.reason),
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
                notes: '',
              });
              setRetModal({ open: true });
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addReturn}</span>
          </button>
          {list.length > 0 && (
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

      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] overflow-x-auto">
        {list.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">{t.noData}</p>
        ) : (
          <table className="w-full text-xs sm:text-sm min-w-[760px]">
            <thead className="bg-[#0A3D2C]/5 dark:bg-[#C9A227]/10 border-b border-slate-200 dark:border-[#1F332B]">
              <tr>
                <th className="p-3 text-start">ID</th>
                <th className="p-3 text-start">{t.originalInvoice}</th>
                <th className="p-3 text-start">{retTab === 'sales' ? t.client : t.suppliers}</th>
                <th className="p-3 text-start">{t.product}</th>
                <th className="p-3 text-end">{t.qty}</th>
                <th className="p-3 text-end">{t.amount}</th>
                <th className="p-3 text-start">{t.reason}</th>
                <th className="p-3 text-start">{t.date}</th>
                <th className="p-3 text-end">—</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
              {list.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-[#182821]">
                  <td className="p-3 font-mono font-bold text-slate-500">{r.id}</td>
                  <td className="p-3 font-mono">{r.originalDocId}</td>
                  <td className="p-3 font-bold">{r.partyName}</td>
                  <td className="p-3">{r.productName}</td>
                  <td className="p-3 text-end font-mono tabular-nums">{r.qty}</td>
                  <td className="p-3 text-end font-mono font-extrabold text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
                    {r.amount.toFixed(2)} {cur}
                  </td>
                  <td className="p-3">{reasonLabel(r.reason)}</td>
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
                            ? `إشعار مرتجع رقم ${r.id} للمستند ${r.originalDocId}: الصنف ${r.productName} (الكمية ${r.qty}) بمبلغ ${r.amount.toFixed(2)} ${cur}.`
                            : `Return Notice ${r.id} for ${r.originalDocId}: ${r.productName} x${r.qty}, Credit ${r.amount.toFixed(2)} ${cur}.`,
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
                            notes: r.notes,
                          });
                          setRetModal({ open: true, editId: r.id });
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button
                        onClick={() => setRetConfirmDelete({ type: 'one', id: r.id })}
                        className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {retModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-md w-full p-6 space-y-3">
            <h3 className="text-lg font-extrabold">{t.addReturn} ({retTab === 'sales' ? t.salesReturns : t.purchaseReturns})</h3>

            <div>
              <label className="text-xs font-bold text-slate-500">{t.originalInvoice}</label>
              <select
                value={selectedDoc?.id ?? ''}
                onChange={(e) => {
                  const doc = sourceDocs.find((d) => d.id === e.target.value);
                  setRetForm({
                    ...retForm,
                    originalDocId: e.target.value,
                    productName: doc?.items[0]?.productName ?? '',
                  });
                }}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              >
                {sourceDocs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} · {d.partyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">{t.product}</label>
              <select
                value={selectedItem?.productName ?? ''}
                onChange={(e) => setRetForm({ ...retForm, productName: e.target.value })}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              >
                {(selectedDoc?.items ?? []).map((it) => (
                  <option key={it.productName} value={it.productName}>
                    {it.productName} ({t.qty}: {it.qty})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500">
                  {t.qty} (max {maxQty})
                </label>
                <input
                  type="number"
                  min={1}
                  max={maxQty}
                  value={retForm.qty}
                  onChange={(e) => setRetForm({ ...retForm, qty: e.target.value })}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">{t.reason}</label>
                <select
                  value={retForm.reason}
                  onChange={(e) => setRetForm({ ...retForm, reason: e.target.value as ReturnReason })}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
                >
                  <option value="damaged">{t.reasonDamaged}</option>
                  <option value="wrong_item">{t.reasonWrongItem}</option>
                  <option value="expired">{t.reasonExpired}</option>
                  <option value="changed_mind">{t.reasonChangedMind}</option>
                  <option value="other">{t.reasonOther}</option>
                </select>
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
                  const q = parseInt(retForm.qty, 10) || 0;
                  if (!selectedDoc || !selectedItem) return;
                  if (q <= 0 || q > maxQty) {
                    setRetError(
                      isAr
                        ? `الكمية يجب أن تكون بين 1 و ${maxQty}`
                        : `Quantity must be between 1 and ${maxQty}`,
                    );
                    return;
                  }
                  const matchedDocRate =
                    retTab === 'sales'
                      ? state.invoices.find((i) => i.id === selectedDoc.id)?.taxRate ??
                        state.settings.defaultSalesTaxRate ??
                        15
                      : state.purchaseOrders.find((p) => p.id === selectedDoc.id)?.taxRate ??
                        state.settings.defaultPurchaseTaxRate ??
                        15;
                  const amount = Number((q * selectedItem.unitPrice * (1 + matchedDocRate / 100)).toFixed(2));
                  const record: Omit<ReturnRecord, 'id'> = {
                    type: retTab,
                    originalDocId: selectedDoc.id,
                    partyName: selectedDoc.partyName,
                    partyPhone: selectedDoc.partyPhone,
                    productId: selectedItem.productId,
                    productName: selectedItem.productName,
                    qty: q,
                    unitPrice: selectedItem.unitPrice,
                    amount,
                    reason: retForm.reason,
                    notes: retForm.notes.trim(),
                    date: new Date().toISOString(),
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
