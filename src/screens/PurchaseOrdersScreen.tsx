import React, { useState } from 'react';
import { Check, MessageCircle, Plus, Printer, Trash2 } from 'lucide-react';
import { DEFAULT_PRODUCT_IMAGE } from '../constants/permissions';
import { strings } from '../data/translations';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

export const PurchaseOrdersScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const defaultPurchaseTaxRate = state.settings.defaultPurchaseTaxRate ?? 15;
  const [poModal, setPoModal] = useState(false);
  const [poForm, setPoForm] = useState({
    supplierName: '',
    supplierPhone: '',
    productId: '',
    productName: '',
    quantity: '10',
    unitCost: '200',
    taxRate: String(defaultPurchaseTaxRate),
  });

  const poQtyNum = parseInt(poForm.quantity, 10) || 0;
  const poCostNum = parseFloat(poForm.unitCost) || 0;
  const poParsedRate = parseFloat(poForm.taxRate);
  const poTaxRate = Number.isFinite(poParsedRate)
    ? Math.max(0, Math.min(100, poParsedRate))
    : defaultPurchaseTaxRate;
  const poSubtotal = Number((poQtyNum * poCostNum).toFixed(2));
  const poVat = Number(((poSubtotal * poTaxRate) / 100).toFixed(2));
  const poTotal = Number((poSubtotal + poVat).toFixed(2));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            const pr = state.products[0];
            setPoForm({
              supplierName: state.suppliers[0]?.name ?? '',
              supplierPhone: state.suppliers[0]?.phone ?? '',
              productId: pr?.id ?? '',
              productName: pr?.name ?? '',
              quantity: '10',
              unitCost: String(pr?.cost ?? 200),
              taxRate: String(defaultPurchaseTaxRate),
            });
            setPoModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.createPo}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.purchaseOrders.map((po) => (
          <div key={po.id} className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
            <div className="flex justify-between text-xs">
              <span className="font-mono font-bold text-slate-500">{po.id}</span>
              <span className={po.status === 'received' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
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
                    actions.notify(isAr ? 'تم استلام الكمية وتزويد المخزون' : 'PO received into stock');
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
            </div>
          </div>
        ))}
      </div>

      {poModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-md w-full p-6 space-y-3 my-auto">
            <h3 className="text-lg font-extrabold">{t.createPo}</h3>
            <input value={poForm.supplierName} onChange={(e) => setPoForm({ ...poForm, supplierName: e.target.value })} placeholder={t.suppliers} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <input value={poForm.supplierPhone} onChange={(e) => setPoForm({ ...poForm, supplierPhone: e.target.value })} placeholder={t.phone} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />

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
              <input type="number" value={poForm.quantity} onChange={(e) => setPoForm({ ...poForm, quantity: e.target.value })} placeholder={t.qty} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
              <input type="number" value={poForm.unitCost} onChange={(e) => setPoForm({ ...poForm, unitCost: e.target.value })} placeholder={t.cost} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
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
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0A120F] flex justify-between text-xs font-bold tabular-nums">
              <span>{t.vat} ({poTaxRate}%): {poVat.toFixed(2)} {cur}</span>
              <span className="text-[#0A3D2C] dark:text-[#C9A227]">{t.total}: {poTotal.toFixed(2)} {cur}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setPoModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!poForm.supplierName.trim() || !poForm.productName.trim()) return;
                  actions.addPurchaseOrder({
                    supplierId: '',
                    supplierName: poForm.supplierName.trim(),
                    supplierPhone: poForm.supplierPhone.trim(),
                    productId: poForm.productId,
                    productName: poForm.productName.trim(),
                    quantity: poQtyNum || 1,
                    unitCost: poCostNum,
                    taxRate: poTaxRate,
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
