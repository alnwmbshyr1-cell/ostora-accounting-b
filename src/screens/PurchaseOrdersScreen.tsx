import React, { useState } from 'react';
import { Check, Lock, MessageCircle, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { DEFAULT_PRODUCT_IMAGE } from '../constants/permissions';
import { strings } from '../data/translations';
import { PaymentMethodType } from '../types/erp';
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
  const [poStatusFilter, setPoStatusFilter] = useState<'all' | 'ordered' | 'received'>('all');
  const [poModal, setPoModal] = useState(false);
  const [poForm, setPoForm] = useState({
    supplierId: '',
    supplierName: '',
    supplierPhone: '',
    productId: '',
    productName: '',
    quantity: '10',
    unitCost: '200',
    taxRate: String(defaultPurchaseTaxRate),
    branchId: state.branches[0]?.id ?? '',
    warehouseId: state.warehouses[0]?.id ?? '',
    paymentMethod: 'credit' as PaymentMethodType,
    paidAmount: '0',
    notes: '',
  });

  const poQtyNum = Math.max(0, parseInt(poForm.quantity, 10) || 0);
  const poCostNum = Math.max(0, parseFloat(poForm.unitCost) || 0);
  const poParsedRate = parseFloat(poForm.taxRate);
  const poTaxRate = Number.isFinite(poParsedRate)
    ? Math.max(0, Math.min(100, poParsedRate))
    : defaultPurchaseTaxRate;
  const poSubtotal = Number((poQtyNum * poCostNum).toFixed(2));
  const poVat = Number(((poSubtotal * poTaxRate) / 100).toFixed(2));
  const poTotal = Number((poSubtotal + poVat).toFixed(2));

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl">
          {(['all', 'ordered', 'received'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setPoStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                poStatusFilter === st ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t[st]}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            const pr = state.products[0];
            const sup = state.suppliers[0];
            setPoForm({
              supplierId: sup?.id ?? '',
              supplierName: sup?.name ?? '',
              supplierPhone: sup?.phone ?? '',
              productId: pr?.id ?? '',
              productName: pr?.name ?? '',
              quantity: '10',
              unitCost: String(pr?.cost ?? 200),
              taxRate: String(defaultPurchaseTaxRate),
              branchId: state.branches[0]?.id ?? '',
              warehouseId: state.warehouses[0]?.id ?? '',
              paymentMethod: 'credit',
              paidAmount: '0',
              notes: '',
            });
            setPoModal(true);
          }}
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
                <span className="font-mono font-bold text-slate-500">{po.id}</span>
                <span className={`inline-flex items-center gap-1 font-bold ${po.status === 'received' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {po.status === 'received' && <Lock className="w-3 h-3" />}
                  {po.status === 'received' ? t.received : t.ordered}
                </span>
              </div>
              <h4 className="font-extrabold text-base">{po.supplierName}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {po.productName} × {po.quantity} ·{' '}
                <span className="font-mono font-bold tabular-nums">{po.total.toFixed(2)} {cur}</span>
              </p>
              {po.vat !== undefined && (
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {t.subtotal}: {(po.subtotal ?? po.quantity * po.unitCost).toFixed(2)} · {t.vat} ({po.taxRate ?? defaultPurchaseTaxRate}%): {po.vat.toFixed(2)}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-[#1F332B]">
                {po.status !== 'received' && (
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
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printPdf}</span>
                </button>
                <a
                  href={buildWhatsAppLink(
                    po.supplierPhone,
                    isAr
                      ? `أمر شراء ${po.id} من ${state.settings.companyName}: ${po.productName} الكمية ${po.quantity} الإجمالي ${po.total} ${cur}.`
                      : `Purchase Order ${po.id} from ${state.settings.companyName}: ${po.productName} x ${po.quantity} (${po.total} ${cur}).`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{t.whatsapp}</span>
                </a>
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

      {poModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-md w-full p-6 space-y-3 my-auto">
            <h3 className="text-lg font-extrabold">{t.createPo}</h3>
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />
            <datalist id="ostora_po_suppliers">
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
            <input
              type="tel"
              maxLength={40}
              value={poForm.supplierPhone}
              onChange={(e) => setPoForm({ ...poForm, supplierPhone: e.target.value })}
              placeholder={t.phone}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />

            <div className="border border-slate-200 dark:border-[#1F332B] rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1">
              {state.products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setPoForm({
                      ...poForm,
                      productId: p.id,
                      productName: p.name,
                      unitCost: String(p.cost),
                    })
                  }
                  className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg text-start text-xs cursor-pointer ${
                    poForm.productId === p.id ? 'bg-[#0A3D2C] text-white' : 'hover:bg-slate-100 dark:hover:bg-[#1A2C24]'
                  }`}
                >
                  <img src={p.imageBase64 || DEFAULT_PRODUCT_IMAGE} alt={p.name} className="w-8 h-8 rounded object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{p.name}</p>
                    <p className="font-mono text-[10px] opacity-75">{p.barcode}</p>
                  </div>
                  <span className="font-mono font-bold">{p.cost} {cur}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <input
                type="number"
                min={1}
                value={poForm.quantity}
                onChange={(e) => setPoForm({ ...poForm, quantity: e.target.value })}
                placeholder={t.qty}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={poForm.unitCost}
                onChange={(e) => setPoForm({ ...poForm, unitCost: e.target.value })}
                placeholder={t.cost}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
              />
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={poForm.taxRate}
                  onChange={(e) => setPoForm({ ...poForm, taxRate: e.target.value })}
                  placeholder={`${t.vat} %`}
                  aria-label={t.defaultPurchaseTax}
                  className="w-full px-3 py-2.5 pe-7 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
                />
                <span className="absolute top-1/2 -translate-y-1/2 end-2.5 text-xs font-bold text-slate-400">%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={poForm.branchId}
                onChange={(e) => setPoForm({ ...poForm, branchId: e.target.value })}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
              >
                {state.branches.map((b) => (
                  <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
                ))}
              </select>
              <select
                value={poForm.warehouseId}
                onChange={(e) => setPoForm({ ...poForm, warehouseId: e.target.value })}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
              >
                {state.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{isAr ? w.nameAr : w.nameEn}</option>
                ))}
              </select>
              <select
                value={poForm.paymentMethod}
                onChange={(e) => setPoForm({ ...poForm, paymentMethod: e.target.value as PaymentMethodType })}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
              >
                <option value="credit">{t.payCredit}</option>
                <option value="cash">{t.payCash}</option>
                <option value="transfer">{t.payTransfer}</option>
                <option value="cheque">{t.payCheque}</option>
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                value={poForm.paidAmount}
                onChange={(e) => setPoForm({ ...poForm, paidAmount: e.target.value })}
                placeholder={isAr ? 'المدفوع مقدماً' : 'Paid Upfront'}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono"
              />
            </div>
            <input
              value={poForm.notes}
              onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
              placeholder={t.notes}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
            />

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0A120F] flex justify-between text-xs font-bold tabular-nums">
              <span>{t.vat} ({poTaxRate}%): {poVat.toFixed(2)} {cur}</span>
              <span className="text-[#0A3D2C] dark:text-[#C9A227]">{t.total}: {poTotal.toFixed(2)} {cur}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setPoModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!poForm.supplierName.trim() || !poForm.productName.trim() || poQtyNum <= 0) return;
                  actions.addPurchaseOrder({
                    supplierId: poForm.supplierId,
                    supplierName: poForm.supplierName.trim(),
                    supplierPhone: poForm.supplierPhone.trim(),
                    productId: poForm.productId,
                    productName: poForm.productName.trim(),
                    quantity: poQtyNum,
                    unitCost: poCostNum,
                    taxRate: poTaxRate,
                    branchId: poForm.branchId || undefined,
                    warehouseId: poForm.warehouseId || undefined,
                    paymentMethod: poForm.paymentMethod,
                    paidAmount: Math.max(0, parseFloat(poForm.paidAmount) || 0),
                    notes: poForm.notes.trim() || undefined,
                  });
                  setPoModal(false);
                  actions.notify(isAr ? 'تم إنشاء أمر الشراء' : 'Purchase Order created');
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
