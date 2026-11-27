import React, { useRef, useState } from 'react';
import { FileDown, Layers, Printer, ShieldCheck, X } from 'lucide-react';
import { BatchPrintItem, CompanySettings } from '../types/erp';
import { formatCurrency, formatCurrencyNumber } from '../utils/currencies';
import { exportElementToPdf } from '../utils/export';
import { numberToWordsTafqeet } from '../utils/tafqeet';
import { buildZatcaTlvBase64 } from '../utils/zatca';
import { QrMatrix } from './QrMatrix';

interface BatchPrintModalProps {
  items: BatchPrintItem[];
  company: CompanySettings;
  onClose: () => void;
}

export const BatchPrintModal: React.FC<BatchPrintModalProps> = ({
  items,
  company,
  onClose,
}) => {
  const [pdfBusy, setPdfBusy] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  const isAr = company.isArabic;

  return (
    <div className="print-modal-root fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex flex-col items-center justify-start p-4 overflow-y-auto">
      <div className="print-modal-card bg-white text-slate-900 rounded-[20px] max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
        <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-[#0A3D2C] text-white border-b border-white/10">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#C9A227]" />
            <span className="font-bold text-sm">
              {isAr ? 'الطابعة المجمعة للمستندات (A4)' : 'Document Batch Printer (A4)'}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/15 font-mono text-xs font-bold tabular-nums">
              {items.length} {isAr ? 'مستند' : items.length === 1 ? 'doc' : 'docs'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pdfBusy}
              onClick={async () => {
                if (!printableRef.current) return;
                setPdfBusy(true);
                try {
                  await exportElementToPdf(printableRef.current, `ostora_batch_${items.length}_docs.pdf`);
                } finally {
                  setPdfBusy(false);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 text-white font-bold text-xs hover:bg-white/25 cursor-pointer disabled:opacity-60"
            >
              <FileDown className="w-4 h-4" />
              <span>{pdfBusy ? (isAr ? 'جاري التصدير...' : 'Exporting...') : isAr ? 'تحميل PDF' : 'Download PDF'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#C9A227] text-slate-950 font-bold text-xs hover:opacity-90 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>
                {isAr
                  ? `طباعة الكل (${items.length})`
                  : `Print All (${items.length})`}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div ref={printableRef} className="divide-y-8 divide-slate-200 print:divide-y-0" dir={isAr ? 'rtl' : 'ltr'}>
          {items.map((item, idx) => {
            const sheetKey = `${item.kind}-${item.data.id}-${idx}`;

            if (item.kind === 'invoice') {
              const inv = item.data;
              const invCur = inv.currency ?? company.currency;
              const fxRate = inv.exchangeRate ?? 1;
              const baseTotal = inv.baseTotal ?? Number((inv.total * fxRate).toFixed(2));
              const effRate =
                inv.taxRate ??
                (inv.subtotal > 0
                  ? Number(((inv.vat / inv.subtotal) * 100).toFixed(1))
                  : company.defaultSalesTaxRate ?? 15);
              const tlv = buildZatcaTlvBase64(
                company.companyName,
                company.taxNumber,
                inv.date,
                inv.total.toFixed(2),
                inv.vat.toFixed(2),
                {
                  invoiceHash: inv.invoiceHash,
                  ecdsaSignature: inv.ecdsaSignature,
                },
              );

              return (
                <section key={sheetKey} className="batch-print-sheet p-6 sm:p-8 space-y-5 text-sm bg-white">
                  <div className="no-print flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      {isAr ? `مستند ${idx + 1} من ${items.length}` : `Sheet ${idx + 1} of ${items.length}`}
                    </span>
                    <span>TAX INVOICE · {inv.id}</span>
                  </div>

                  <div className="bg-[#0A3D2C] text-white p-5 rounded-2xl flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-extrabold">{company.companyName}</h2>
                      <p className="text-xs text-white/80 mt-1 tabular-nums">
                        VAT: {company.taxNumber} · CR: {company.crNumber}
                      </p>
                      <p className="text-xs text-white/80">
                        {company.phone} · {company.email}
                      </p>
                      <p className="text-xs text-white/75">{company.address}</p>
                    </div>
                    <div className={isAr ? 'sm:text-left' : 'sm:text-right'}>
                      <p className="text-[#C9A227] text-lg font-extrabold tracking-wide">TAX INVOICE</p>
                      <p className="font-mono text-xs mt-1">{inv.id}</p>
                      <p className="font-mono text-xs text-white/75">
                        {new Date(inv.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border border-slate-200 rounded-xl p-4">
                    <div>
                      <p className="text-xs font-bold text-slate-500">
                        {isAr ? 'فاتورة إلى / BILL TO' : 'BILL TO'}
                      </p>
                      <p className="text-base font-extrabold mt-1">{inv.customerName}</p>
                      <p className="text-xs text-slate-600 font-mono mt-0.5">{inv.customerPhone}</p>
                      <p className="text-xs text-slate-600 mt-0.5 uppercase">Status: {inv.status}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <QrMatrix data={tlv} size={110} />
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-[#0A3D2C]" />
                        <span>{isAr ? 'رمز ZATCA' : 'ZATCA QR'}</span>
                      </span>
                    </div>
                  </div>

                  <table className="w-full border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-[#0A3D2C] text-white">
                        <th className="p-2.5 text-start">{isAr ? 'البيان' : 'Description'}</th>
                        <th className="p-2.5 text-end">{isAr ? 'المبلغ' : 'Subtotal'}</th>
                        <th className="p-2.5 text-end">{isAr ? `ضريبة ${effRate}%` : `VAT ${effRate}%`}</th>
                        <th className="p-2.5 text-end">{isAr ? 'الإجمالي' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.items && inv.items.length > 0 ? (
                        inv.items.map((it, lineIdx) => {
                          const itemVat = (it.total * effRate) / 100;
                          return (
                            <tr key={lineIdx} className="border-b border-slate-200">
                              <td className="p-2.5">
                                {it.productName} × {it.qty}
                              </td>
                               <td className="p-2.5 text-end font-mono tabular-nums">{formatCurrencyNumber(it.total, invCur)}</td>
                              <td className="p-2.5 text-end font-mono tabular-nums">{formatCurrencyNumber(itemVat, invCur)}</td>
                              <td className="p-2.5 text-end font-mono font-bold tabular-nums">
                                {formatCurrency(it.total + itemVat, invCur, { isAr })}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr className="border-b border-slate-200">
                          <td className="p-2.5">{inv.description || 'Accounting & Supply Services'}</td>
                          <td className="p-2.5 text-end font-mono tabular-nums">{formatCurrencyNumber(inv.subtotal, invCur)}</td>
                          <td className="p-2.5 text-end font-mono tabular-nums">{formatCurrencyNumber(inv.vat, invCur)}</td>
                          <td className="p-2.5 text-end font-mono font-bold tabular-nums">
                            {formatCurrency(inv.total, invCur, { isAr })}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <div className="flex justify-end">
                    <div className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>{isAr ? 'المجموع الفرعي' : 'Subtotal'}</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(inv.subtotal, invCur, { isAr })}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>{isAr ? `ضريبة القيمة المضافة ${effRate}%` : `VAT ${effRate}%`}</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(inv.vat, invCur, { isAr })}
                        </span>
                      </div>
                      <div className="border-t border-slate-300 pt-2 flex justify-between font-extrabold text-sm text-[#0A3D2C]">
                        <span>{isAr ? 'الإجمالي المستحق' : 'TOTAL'}</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(inv.total, invCur, { isAr })}
                        </span>
                      </div>
                      {invCur !== company.currency && (
                        <div className="border-t border-slate-200 pt-2 flex justify-between text-[11px] text-slate-600 font-mono">
                          <span>1 {invCur} = {fxRate.toFixed(4)} {company.currency}</span>
                          <span className="font-bold">
                            ≈ {formatCurrency(baseTotal, company.currency, { isAr })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-[#0A3D2C]/5 border border-[#0A3D2C]/20 rounded-xl px-4 py-2 text-xs font-bold text-[#0A3D2C]">
                    {isAr ? 'المبلغ بالحروف:' : 'Amount in Words:'}{' '}
                    <span className="font-extrabold">{numberToWordsTafqeet(inv.total, invCur, isAr ? 'ar' : 'en')}</span>
                  </div>

                  <div className="pt-4 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
                    <div>
                      <div className="border-b border-slate-400 h-7 mb-1.5" />
                      <span>{isAr ? 'توقيع المحاسب / الإدارة' : 'Authorized Signature'}</span>
                    </div>
                    <div>
                      <div className="border-b border-slate-400 h-7 mb-1.5" />
                      <span>{isAr ? 'توقيع المستلم / العميل' : 'Recipient Signature'}</span>
                    </div>
                  </div>
                </section>
              );
            }

            if (item.kind === 'return') {
              const ret = item.data;
              const rate = company.defaultSalesTaxRate ?? 15;
              const vatAmt = rate > 0 ? (ret.amount * rate) / (100 + rate) : 0;
              const tlv = buildZatcaTlvBase64(
                company.companyName,
                company.taxNumber,
                ret.date,
                ret.amount.toFixed(2),
                vatAmt.toFixed(2),
              );

              return (
                <section key={sheetKey} className="batch-print-sheet p-6 sm:p-8 space-y-5 text-sm bg-white">
                  <div className="no-print flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      {isAr ? `مستند ${idx + 1} من ${items.length}` : `Sheet ${idx + 1} of ${items.length}`}
                    </span>
                    <span>CREDIT NOTE · {ret.id}</span>
                  </div>

                  <div className="bg-[#0A3D2C] text-white p-5 rounded-2xl flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-extrabold">{company.companyName}</h2>
                      <p className="text-xs text-white/80 mt-1 tabular-nums">
                        VAT: {company.taxNumber} · CR: {company.crNumber}
                      </p>
                      <p className="text-xs text-white/75">{company.address}</p>
                    </div>
                    <div className={isAr ? 'sm:text-left' : 'sm:text-right'}>
                      <p className="text-[#C9A227] text-lg font-extrabold">
                        {isAr ? 'إشعار دائن / CREDIT NOTE' : 'CREDIT NOTE'}
                      </p>
                      <p className="font-mono text-xs mt-1">{ret.id}</p>
                      <p className="font-mono text-xs text-white/75">
                        {new Date(ret.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border border-slate-200 rounded-xl p-4">
                    <div>
                      <p className="text-xs font-bold text-slate-500">
                        {ret.type === 'sales' ? (isAr ? 'العميل:' : 'CUSTOMER:') : isAr ? 'المورد:' : 'SUPPLIER:'}
                      </p>
                      <p className="text-base font-extrabold mt-1">{ret.partyName}</p>
                      <p className="text-xs text-slate-600 font-mono mt-0.5">
                        {isAr ? 'المرجع الأصلي:' : 'Original Doc:'} {ret.originalDocId}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <QrMatrix data={tlv} size={104} />
                      <span className="text-[10px] font-bold text-slate-500">ZATCA QR</span>
                    </div>
                  </div>

                  <table className="w-full border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-[#0A3D2C] text-white">
                        <th className="p-2.5 text-start">{isAr ? 'الصنف المرتجع' : 'Returned Item'}</th>
                        <th className="p-2.5 text-end">{isAr ? 'الكمية' : 'Qty'}</th>
                        <th className="p-2.5 text-end">{isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
                        <th className="p-2.5 text-end">{isAr ? 'المبلغ الإجمالي' : 'Credit Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="p-3">{ret.productName}</td>
                        <td className="p-3 text-end font-mono tabular-nums">{ret.qty}</td>
                        <td className="p-3 text-end font-mono tabular-nums">{formatCurrencyNumber(ret.unitPrice, company.currency)}</td>
                        <td className="p-3 text-end font-mono font-bold tabular-nums">
                          {formatCurrency(ret.amount, company.currency, { isAr })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              );
            }

            if (item.kind === 'quotation') {
              const qt = item.data;
              const qtCur = qt.currency ?? company.currency;
              return (
                <section key={sheetKey} className="batch-print-sheet p-6 sm:p-8 space-y-5 text-sm bg-white">
                  <div className="no-print flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      {isAr ? `مستند ${idx + 1} من ${items.length}` : `Sheet ${idx + 1} of ${items.length}`}
                    </span>
                    <span>QUOTATION · {qt.id}</span>
                  </div>

                  <div className="bg-[#0A3D2C] text-white p-5 rounded-2xl flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-extrabold">{company.companyName}</h2>
                      <p className="text-xs text-white/80 mt-1 tabular-nums">
                        VAT: {company.taxNumber} · CR: {company.crNumber}
                      </p>
                      <p className="text-xs text-white/75">{company.address}</p>
                    </div>
                    <div className={isAr ? 'sm:text-left' : 'sm:text-right'}>
                      <p className="text-[#C9A227] text-lg font-extrabold">
                        {isAr ? 'عرض سعر / QUOTATION' : 'QUOTATION'}
                      </p>
                      <p className="font-mono text-xs mt-1">{qt.id}</p>
                      <p className="font-mono text-xs text-[#F4D573]">
                        {isAr ? 'صالح حتى:' : 'Valid Until:'} {qt.validUntil}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center border border-slate-200 rounded-xl p-4">
                    <div>
                      <p className="text-xs font-bold text-slate-500">{isAr ? 'مقدم إلى:' : 'QUOTATION FOR:'}</p>
                      <p className="text-base font-extrabold mt-1">{qt.customerName}</p>
                      <p className="text-xs text-slate-600 font-mono">{qt.customerPhone} · {qt.customerEmail}</p>
                    </div>
                    <span className="font-mono text-xs uppercase font-bold text-[#0A3D2C]">{qt.status}</span>
                  </div>

                  <table className="w-full border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-[#0A3D2C] text-white">
                        <th className="p-2.5 text-start">{isAr ? 'الصنف' : 'Item'}</th>
                        <th className="p-2.5 text-end">{isAr ? 'الكمية' : 'Qty'}</th>
                        <th className="p-2.5 text-end">{isAr ? 'السعر' : 'Unit Price'}</th>
                        <th className="p-2.5 text-end">{isAr ? 'الإجمالي' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qt.items.map((it, lineIdx) => (
                        <tr key={lineIdx} className="border-b border-slate-200">
                          <td className="p-2.5">{it.productName}</td>
                          <td className="p-2.5 text-end font-mono tabular-nums">{it.qty}</td>
                          <td className="p-2.5 text-end font-mono tabular-nums">{formatCurrencyNumber(it.unitPrice, qtCur)}</td>
                          <td className="p-2.5 text-end font-mono font-bold tabular-nums">{formatCurrencyNumber(it.total, qtCur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end">
                    <div className="w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span>{isAr ? 'المجموع الفرعي' : 'Subtotal'}</span>
                        <span className="font-mono tabular-nums">{formatCurrency(qt.subtotal, qtCur, { isAr })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{isAr ? `الخصم (${qt.discountPercent}%)` : `Discount (${qt.discountPercent}%)`}</span>
                        <span className="font-mono tabular-nums">-{formatCurrency(qt.discountAmount, qtCur, { isAr })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{isAr ? 'الضريبة' : 'VAT'}</span>
                        <span className="font-mono tabular-nums">{formatCurrency(qt.vat, qtCur, { isAr })}</span>
                      </div>
                      <div className="border-t border-slate-300 pt-1.5 flex justify-between font-extrabold text-sm text-[#0A3D2C]">
                        <span>{isAr ? 'الإجمالي' : 'TOTAL'}</span>
                        <span className="font-mono tabular-nums">{formatCurrency(qt.total, qtCur, { isAr })}</span>
                      </div>
                    </div>
                  </div>
                </section>
              );
            }

            // VOUCHER
            const v = item.data;
            return (
              <section key={sheetKey} className="batch-print-sheet p-6 sm:p-8 space-y-5 text-sm bg-white">
                <div className="no-print flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>
                    {isAr ? `مستند ${idx + 1} من ${items.length}` : `Sheet ${idx + 1} of ${items.length}`}
                  </span>
                  <span>{v.type === 'receipt' ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER'} · {v.id}</span>
                </div>

                <div className="bg-[#0A3D2C] text-white p-5 rounded-2xl flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold">{company.companyName}</h2>
                    <p className="text-xs text-white/80 mt-1 tabular-nums">
                      VAT: {company.taxNumber} · CR: {company.crNumber}
                    </p>
                  </div>
                  <div className={isAr ? 'sm:text-left' : 'sm:text-right'}>
                    <p className="text-[#C9A227] text-lg font-extrabold">
                      {v.type === 'receipt' ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER'}
                    </p>
                    <p className="font-mono text-xs mt-1">{v.id}</p>
                    <p className="font-mono text-xs text-white/75">
                      {new Date(v.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="border-2 border-[#C9A227] rounded-2xl p-6 text-center bg-amber-50/40">
                  <p className="text-xs text-slate-500 font-semibold">
                    {v.type === 'receipt'
                      ? isAr ? 'مبلغ سند القبض' : 'RECEIPT AMOUNT'
                      : isAr ? 'مبلغ سند الصرف' : 'PAYMENT AMOUNT'}
                  </p>
                  <p className="text-3xl font-extrabold text-[#0A3D2C] font-mono tabular-nums mt-1">
                    {formatCurrency(v.amount, company.currency, { isAr })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-500">{isAr ? 'الطرف:' : 'Party:'}</span>
                    <p className="font-bold text-sm mt-0.5">{v.partyName}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">{isAr ? 'طريقة الدفع:' : 'Method:'}</span>
                    <p className="font-bold text-sm mt-0.5">{v.paymentMethod}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">{isAr ? 'البيان:' : 'Reason:'}</span>
                    <p className="font-bold text-sm mt-0.5">{v.reason || '—'}</p>
                  </div>
                </div>

                <div className="pt-4 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
                  <div>
                    <div className="border-b border-slate-400 h-7 mb-1.5" />
                    <span>{isAr ? 'توقيع المحاسب' : 'Accountant Signature'}</span>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 h-7 mb-1.5" />
                    <span>{isAr ? 'توقيع المستلم' : 'Recipient Signature'}</span>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
