import React, { useState } from 'react';
import { Edit2, Lock, Mail, MessageCircle, Plus, Printer, Trash2 } from 'lucide-react';
import { DEFAULT_PRODUCT_IMAGE } from '../constants/permissions';
import { useFirebase } from '../contexts/FirebaseContext';
import { strings } from '../data/translations';
import { LineItem, QuotationStatus } from '../types/erp';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

export const QuotationsScreen: React.FC<ScreenProps> = ({ store, onNavigate, onPrintQuotation }) => {
  const { user } = useFirebase();
  const isAdmin = user?.email === 'alnwmbshyr1@gmail.com';
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [qtModal, setQtModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [qtForm, setQtForm] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    discountPercent: '0',
    validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    status: 'sent' as QuotationStatus,
    notes: '',
    items: [] as LineItem[],
  });
  const [qtSelectedProdId, setQtSelectedProdId] = useState(state.products[0]?.id ?? '');
  const [qtItemQty, setQtItemQty] = useState('1');
  const [qtConfirmDelete, setQtConfirmDelete] = useState<{ type: 'one' | 'all'; id?: string } | null>(null);

  const salesTaxRate = state.settings.defaultSalesTaxRate ?? 15;
  const subtotalVal = qtForm.items.reduce((s, i) => s + i.total, 0);
  const discPct = Math.max(0, Math.min(100, parseFloat(qtForm.discountPercent) || 0));
  const discAmt = Number(((subtotalVal * discPct) / 100).toFixed(2));
  const vatAmt = Number((((subtotalVal - discAmt) * salesTaxRate) / 100).toFixed(2));
  const totalAmt = Number((subtotalVal - discAmt + vatAmt).toFixed(2));

  const statusColor = (st: QuotationStatus) => {
    if (st === 'accepted') return 'text-emerald-600';
    if (st === 'rejected' || st === 'expired') return 'text-red-600';
    if (st === 'sent') return 'text-amber-600';
    return 'text-slate-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        {state.quotations.length > 0 && (
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
            setQtSelectedProdId(defProd?.id ?? '');
            setQtItemQty('1');
            setQtForm({
              customerId: state.customers[0]?.id ?? '',
              customerName: state.customers[0]?.name ?? '',
              customerPhone: state.customers[0]?.phone ?? '',
              customerEmail: state.customers[0]?.email ?? '',
              discountPercent: '0',
              validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
              status: 'sent',
              notes: '',
              items: defProd
                ? [{ productId: defProd.id, productName: defProd.name, qty: 1, unitPrice: defProd.price, total: defProd.price }]
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

      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] overflow-x-auto">
        {state.quotations.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">{t.noData}</p>
        ) : (
          <table className="w-full text-xs sm:text-sm min-w-[760px]">
            <thead className="bg-[#0A3D2C]/5 dark:bg-[#C9A227]/10 border-b border-slate-200 dark:border-[#1F332B]">
              <tr>
                <th className="p-3 text-start">ID</th>
                <th className="p-3 text-start">{t.client}</th>
                <th className="p-3 text-end">{t.total}</th>
                <th className="p-3 text-start">{t.validUntil}</th>
                <th className="p-3 text-start">{t.status}</th>
                <th className="p-3 text-end">—</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
              {state.quotations.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50/70 dark:hover:bg-[#182821]">
                  <td className="p-3 font-mono font-bold text-slate-500">{q.id}</td>
                  <td className="p-3 font-bold">{q.customerName}</td>
                  <td className="p-3 text-end font-mono font-extrabold text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
                    {q.total.toFixed(2)} {cur}
                  </td>
                  <td className="p-3 font-mono text-xs">{q.validUntil}</td>
                  <td className={`p-3 font-bold ${statusColor(q.status)}`}>{t[q.status]}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {q.status !== 'accepted' && (
                        <button
                          onClick={() => {
                            const res = actions.convertQuotationToInvoice(q.id);
                            if (!res.ok) {
                              actions.notify(
                                isAr
                                  ? `${t.creditLimitExceeded} (${t.exceededBy}: ${(res.exceededBy ?? 0).toFixed(2)} ${cur})`
                                  : `${t.creditLimitExceeded} (${t.exceededBy}: ${(res.exceededBy ?? 0).toFixed(2)} ${cur})`,
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
                            ? `السلام عليكم ${q.customerName}، نرفق لكم عرض السعر رقم ${q.id} بقيمة إجمالية ${q.total.toFixed(2)} ${cur} (شامل الضريبة)، ساري حتى ${q.validUntil}.`
                            : `Dear ${q.customerName}, Quotation ${q.id} total ${q.total.toFixed(2)} ${cur}, valid until ${q.validUntil}.`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                        title={t.whatsapp}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={`mailto:${q.customerEmail}?subject=${encodeURIComponent(`Quotation ${q.id}`)}&body=${encodeURIComponent(`Total: ${q.total.toFixed(2)} ${cur}`)}`}
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
                            setQtForm({
                              customerId: q.customerId,
                              customerName: q.customerName,
                              customerPhone: q.customerPhone,
                              customerEmail: q.customerEmail,
                              discountPercent: String(q.discountPercent),
                              validUntil: q.validUntil,
                              status: q.status,
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
                      <button
                        onClick={() => setQtConfirmDelete({ type: 'one', id: q.id })}
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

      {qtModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-lg w-full p-6 space-y-3 my-auto">
            <h3 className="text-lg font-extrabold">{t.addQuotation}</h3>
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />
            <datalist id="qt-customers">
              {state.customers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>

            <div className="grid grid-cols-2 gap-2">
              <input maxLength={40} value={qtForm.customerPhone} onChange={(e) => setQtForm({ ...qtForm, customerPhone: e.target.value })} placeholder={t.phone} className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
              <input type="date" value={qtForm.validUntil} onChange={(e) => setQtForm({ ...qtForm, validUntil: e.target.value })} className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            </div>

            <div className="border border-slate-200 dark:border-[#1F332B] rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-slate-500">{t.addItem}</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {state.products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setQtSelectedProdId(p.id)}
                    className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg text-start text-xs cursor-pointer ${
                      qtSelectedProdId === p.id
                        ? 'bg-[#0A3D2C] text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-[#1A2C24]'
                    }`}
                  >
                    <img
                      src={p.imageBase64 || DEFAULT_PRODUCT_IMAGE}
                      alt={p.name}
                      className="w-8 h-8 rounded object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{p.name}</p>
                      <p className="font-mono text-[10px] opacity-75">{p.barcode}</p>
                    </div>
                    <span className="font-mono font-bold">{p.price} {cur}</span>
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
                  className="w-24 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const prod = state.products.find((p) => p.id === qtSelectedProdId);
                    const qty = parseInt(qtItemQty, 10) || 1;
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
                          total: Number((qty * prod.price).toFixed(2)),
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
                <div className="divide-y divide-slate-100 dark:divide-[#1F332B] text-xs pt-1">
                  {qtForm.items.map((it, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                      <span className="truncate">{it.productName} × {it.qty}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold">{it.total.toFixed(2)}</span>
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-500">{t.discountPercent}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={qtForm.discountPercent}
                  onChange={(e) => setQtForm({ ...qtForm, discountPercent: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">{t.status}</label>
                <select
                  value={qtForm.status}
                  onChange={(e) => setQtForm({ ...qtForm, status: e.target.value as QuotationStatus })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
                >
                  <option value="draft">{t.draft}</option>
                  <option value="sent">{t.sent}</option>
                  <option value="accepted">{t.accepted}</option>
                  <option value="rejected">{t.rejected}</option>
                  <option value="expired">{t.expired}</option>
                </select>
              </div>
            </div>

            <input
              maxLength={500}
              value={qtForm.notes}
              onChange={(e) => setQtForm({ ...qtForm, notes: e.target.value })}
              placeholder={t.notes}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0A120F] flex justify-between text-xs font-bold tabular-nums">
              <span>{t.vat} ({salesTaxRate}%): {vatAmt.toFixed(2)}</span>
              <span className="text-[#0A3D2C] dark:text-[#C9A227]">{t.total}: {totalAmt.toFixed(2)} {cur}</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setQtModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!qtForm.customerName.trim() || qtForm.items.length === 0) return;
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
                      status: qtForm.status,
                      notes: qtForm.notes.trim(),
                      date: new Date().toISOString(),
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
