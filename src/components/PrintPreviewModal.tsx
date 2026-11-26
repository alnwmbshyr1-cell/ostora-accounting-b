import React, { useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, Eye, Printer, ShieldCheck, X } from 'lucide-react';
import {
  buildZatcaTlvBase64,
  decodeZatcaTlvBase64,
  validateZatcaPhase1,
} from '../utils/zatca';
import { formatCurrency, formatCurrencyNumber } from '../utils/currencies';
import { CompanySettings, Invoice, Quotation, ReturnRecord, Voucher } from '../types/erp';
import { QrMatrix } from './QrMatrix';

interface PrintPreviewProps {
  invoice?: Invoice | null;
  voucher?: Voucher | null;
  returnRecord?: ReturnRecord | null;
  quotation?: Quotation | null;
  company: CompanySettings;
  onClose: () => void;
}

export const PrintPreviewModal: React.FC<PrintPreviewProps> = ({
  invoice,
  voucher,
  returnRecord,
  quotation,
  company,
  onClose,
}) => {
  const [showTlvDetails, setShowTlvDetails] = useState(false);
  const [copiedTlv, setCopiedTlv] = useState(false);

  const zatcaQrBase64 = useMemo(() => {
    if (invoice) {
      return buildZatcaTlvBase64(
        company.companyName,
        company.taxNumber,
        invoice.date,
        invoice.total.toFixed(2),
        invoice.vat.toFixed(2),
      );
    }
    if (returnRecord) {
      const rate = company.defaultSalesTaxRate ?? 15;
      const vatAmt = rate > 0 ? (returnRecord.amount * rate) / (100 + rate) : 0;
      return buildZatcaTlvBase64(
        company.companyName,
        company.taxNumber,
        returnRecord.date,
        returnRecord.amount.toFixed(2),
        vatAmt.toFixed(2),
      );
    }
    return '';
  }, [invoice, returnRecord, company.companyName, company.taxNumber, company.defaultSalesTaxRate]);

  const decodedTags = useMemo(
    () => (zatcaQrBase64 ? decodeZatcaTlvBase64(zatcaQrBase64) : []),
    [zatcaQrBase64],
  );

  const zatcaValidation = useMemo(
    () => validateZatcaPhase1(company.companyName, company.taxNumber),
    [company.companyName, company.taxNumber],
  );

  if (!invoice && !voucher && !returnRecord && !quotation) return null;

  const isAr = company.isArabic;

  const docTitle = invoice
    ? 'TAX INVOICE'
    : returnRecord
    ? isAr
      ? 'إشعار دائن / CREDIT NOTE'
      : 'CREDIT NOTE'
    : quotation
    ? isAr
      ? 'عرض سعر / QUOTATION'
      : 'QUOTATION'
    : voucher?.type === 'receipt'
    ? 'RECEIPT VOUCHER'
    : 'PAYMENT VOUCHER';

  const docId = invoice?.id ?? returnRecord?.id ?? quotation?.id ?? voucher?.id ?? '';
  const docDate = invoice?.date ?? returnRecord?.date ?? quotation?.date ?? voucher?.date ?? '';

  const handleDownloadQrPng = async () => {
    if (!zatcaQrBase64) return;
    const dataUrl = await QRCode.toDataURL(zatcaQrBase64, {
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 360,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `zatca_qr_${docId}.png`;
    a.click();
  };

  const handleCopyTlv = async () => {
    if (!zatcaQrBase64 || !navigator.clipboard) return;
    await navigator.clipboard.writeText(zatcaQrBase64);
    setCopiedTlv(true);
    setTimeout(() => setCopiedTlv(false), 2000);
  };

  return (
    <div className="print-modal-root fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="print-modal-card bg-white text-slate-900 rounded-[20px] max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 my-auto">
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-[#0A3D2C] text-white">
          <span className="font-bold text-sm">
            {docTitle} · {docId}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A227] text-slate-950 font-bold text-xs hover:opacity-90 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isAr ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6 text-sm" dir={isAr ? 'rtl' : 'ltr'}>
          {/* Company Header */}
          <div className="bg-[#0A3D2C] text-white p-5 rounded-2xl flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-start gap-3">
              {company.logoBase64 && (
                <img
                  src={company.logoBase64}
                  alt={company.companyName}
                  className="w-14 h-14 rounded-xl border-2 border-[#C9A227] object-cover shrink-0 bg-white"
                />
              )}
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
            </div>
            <div className={isAr ? 'sm:text-left' : 'sm:text-right'}>
              <p className="text-[#C9A227] text-lg font-extrabold tracking-wide">{docTitle}</p>
              <p className="font-mono text-xs mt-1">{docId}</p>
              <p className="font-mono text-xs text-white/75">
                {new Date(docDate).toLocaleDateString()}
              </p>
              {invoice?.dueDate && (
                <p className="font-mono text-[11px] text-[#F4D573]">
                  {isAr ? 'الاستحقاق:' : 'Due:'} {invoice.dueDate}
                </p>
              )}
              {quotation && (
                <p className="font-mono text-xs text-[#F4D573] mt-1">
                  {isAr ? 'صالح حتى:' : 'Valid Until:'} {quotation.validUntil}
                </p>
              )}
            </div>
          </div>

          {/* TAX INVOICE */}
          {invoice && (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border border-slate-200 rounded-xl p-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-500">
                    {isAr ? 'فاتورة إلى / BILL TO' : 'BILL TO'}
                  </p>
                  <p className="text-base font-extrabold">{invoice.customerName}</p>
                  <p className="text-xs text-slate-600 font-mono">{invoice.customerPhone}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-slate-600">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold uppercase">{invoice.status}</span>
                    {invoice.paymentMethod && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">{invoice.paymentMethod}</span>
                    )}
                    {invoice.branchName && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#0A3D2C] font-bold">{invoice.branchName}</span>
                    )}
                    {invoice.warehouseName && (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold">{invoice.warehouseName}</span>
                    )}
                    {invoice.salespersonName && (
                      <span className="px-2 py-0.5 rounded bg-slate-100">{invoice.salespersonName}</span>
                    )}
                    {invoice.shiftName && (
                      <span className="px-2 py-0.5 rounded bg-slate-100">{invoice.shiftName}</span>
                    )}
                    {invoice.invoiceDocKind && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#0A3D2C] font-bold uppercase">{invoice.invoiceDocKind}</span>
                    )}
                    {invoice.referenceNumber && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono">{isAr ? 'مرجع:' : 'Ref:'} {invoice.referenceNumber}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <QrMatrix data={zatcaQrBase64} size={124} />
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-[#0A3D2C]" />
                    <span>{isAr ? 'رمز الزكاة والدخل (المرحلة 1)' : 'ZATCA Phase-1 QR'}</span>
                  </span>
                  <div className="no-print flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowTlvDetails((v) => !v)}
                      className="px-2 py-1 rounded-md border border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>TLV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyTlv()}
                      className="px-2 py-1 rounded-md border border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedTlv ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedTlv ? (isAr ? 'نُسخ' : 'Copied') : 'Base64'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadQrPng()}
                      className="px-2 py-1 rounded-md border border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>PNG</span>
                    </button>
                  </div>
                </div>
              </div>

              {showTlvDetails && (
                <div className="no-print bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#0A3D2C]">
                      {isAr ? 'بيانات ZATCA المرحلة الأولى (TLV Base64)' : 'ZATCA Phase-1 TLV Decoded Tags'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        zatcaValidation.isCompliant
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {zatcaValidation.isCompliant
                        ? isAr
                          ? 'متوافق'
                          : 'Compliant'
                        : (isAr ? zatcaValidation.warningsAr[0] : zatcaValidation.warningsEn[0])}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {decodedTags.map((tag) => (
                      <div key={tag.tag} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] font-bold text-slate-400">
                          Tag {tag.tag} · {isAr ? tag.labelAr : tag.labelEn}
                        </span>
                        <p className="font-mono text-[11px] font-semibold text-slate-800 truncate">{tag.value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="font-mono text-[10px] text-slate-500 break-all bg-white border border-slate-200 rounded-lg p-2">
                    {zatcaQrBase64}
                  </p>
                </div>
              )}

              {(() => {
                const effRate =
                  invoice.taxRate ??
                  (invoice.subtotal > 0
                    ? Number(((invoice.vat / invoice.subtotal) * 100).toFixed(1))
                    : company.defaultSalesTaxRate ?? 15);
                const invCur = invoice.currency ?? company.currency;
                const fxRate = invoice.exchangeRate ?? 1;
                const baseTotal = invoice.baseTotal ?? Number((invoice.total * fxRate).toFixed(2));
                return (
                  <>
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
                        {invoice.items && invoice.items.length > 0 ? (
                          invoice.items.map((it, idx) => {
                            const lineRate = it.taxRate ?? effRate;
                            const itemVat = it.taxAmount ?? (it.total * lineRate) / 100;
                            return (
                              <tr key={idx} className="border-b border-slate-200">
                                <td className="p-3">
                                  <div className="font-semibold">
                                    {it.productName} × {it.qty}
                                    {it.unit ? <span className="text-[11px] text-slate-500 ms-1">({it.unit})</span> : null}
                                  </div>
                                  {it.description && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">{it.description}</p>
                                  )}
                                  {((it.discountPercent ?? 0) > 0 || (it.discountAmount ?? 0) > 0) && (
                                    <p className="text-[10px] text-amber-700 font-mono">
                                      {isAr ? 'خصم:' : 'Disc:'}{' '}
                                      {it.discountPercent ? `${it.discountPercent}% ` : ''}
                                      {it.discountAmount ? `(-${formatCurrencyNumber(it.discountAmount, invCur)})` : ''}
                                    </p>
                                  )}
                                </td>
                                <td className="p-3 text-end font-mono tabular-nums">{formatCurrencyNumber(it.total, invCur)}</td>
                                <td className="p-3 text-end font-mono tabular-nums">
                                  {formatCurrencyNumber(itemVat, invCur)}
                                </td>
                                <td className="p-3 text-end font-mono font-bold tabular-nums">
                                  {formatCurrency(it.total + itemVat, invCur, { isAr })}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr className="border-b border-slate-200">
                            <td className="p-3">{invoice.description || 'Accounting & Supply Services'}</td>
                            <td className="p-3 text-end font-mono tabular-nums">{formatCurrencyNumber(invoice.subtotal, invCur)}</td>
                            <td className="p-3 text-end font-mono tabular-nums">{formatCurrencyNumber(invoice.vat, invCur)}</td>
                            <td className="p-3 text-end font-mono font-bold tabular-nums">
                              {formatCurrency(invoice.total, invCur, { isAr })}
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
                            {formatCurrency(invoice.subtotal, invCur, { isAr })}
                          </span>
                        </div>
                        {(invoice.discountTotal ?? 0) > 0 && (
                          <div className="flex justify-between text-xs text-amber-700">
                            <span>{isAr ? 'الخصم' : 'Discount'}</span>
                            <span className="font-mono tabular-nums">-{formatCurrency(invoice.discountTotal ?? 0, invCur, { isAr })}</span>
                          </div>
                        )}
                        {(invoice.shippingFee ?? 0) > 0 && (
                          <div className="flex justify-between text-xs">
                            <span>{isAr ? 'الشحن والتوصيل' : 'Shipping'}</span>
                            <span className="font-mono tabular-nums">{formatCurrency(invoice.shippingFee ?? 0, invCur, { isAr })}</span>
                          </div>
                        )}
                        {(invoice.extraFee ?? 0) > 0 && (
                          <div className="flex justify-between text-xs">
                            <span>{isAr ? 'رسوم إضافية' : 'Extra Fees'}</span>
                            <span className="font-mono tabular-nums">{formatCurrency(invoice.extraFee ?? 0, invCur, { isAr })}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs">
                          <span>{isAr ? `ضريبة القيمة المضافة ${effRate}%` : `VAT ${effRate}%`}</span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(invoice.vat, invCur, { isAr })}
                          </span>
                        </div>
                        <div className="border-t border-slate-300 pt-2 flex justify-between font-extrabold text-sm text-[#0A3D2C]">
                          <span>{isAr ? 'الإجمالي المستحق' : 'TOTAL'}</span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(invoice.total, invCur, { isAr })}
                          </span>
                        </div>
                        {(invoice.paidAmount ?? 0) > 0 && (
                          <div className="flex justify-between text-xs text-emerald-700">
                            <span>{isAr ? 'المدفوع' : 'Paid'}</span>
                            <span className="font-mono font-bold tabular-nums">{formatCurrency(invoice.paidAmount ?? 0, invCur, { isAr })}</span>
                          </div>
                        )}
                        {(invoice.remainingAmount ?? 0) > 0 && (
                          <div className="flex justify-between text-xs text-rose-700">
                            <span>{isAr ? 'المتبقي' : 'Remaining'}</span>
                            <span className="font-mono font-bold tabular-nums">{formatCurrency(invoice.remainingAmount ?? 0, invCur, { isAr })}</span>
                          </div>
                        )}
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
                    {(invoice.notes || invoice.terms) && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                        {invoice.notes && <p><span className="font-bold">{isAr ? 'ملاحظات:' : 'Notes:'}</span> {invoice.notes}</p>}
                        {invoice.terms && <p><span className="font-bold">{isAr ? 'الشروط والأحكام:' : 'Terms:'}</span> {invoice.terms}</p>}
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}

          {/* CREDIT NOTE (RETURN RECORD) */}
          {returnRecord && (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border border-slate-200 rounded-xl p-4">
                <div>
                  <p className="text-xs font-bold text-slate-500">
                    {returnRecord.type === 'sales'
                      ? isAr
                        ? 'إشعار دائن للعميل / CREDIT NOTE TO'
                        : 'CREDIT NOTE TO'
                      : isAr
                      ? 'إشعار مرتجع للمورد / DEBIT NOTE TO'
                      : 'PURCHASE RETURN TO'}
                  </p>
                  <p className="text-base font-extrabold mt-1">{returnRecord.partyName}</p>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    {isAr ? 'المرجع الأصلي:' : 'Original Doc:'} {returnRecord.originalDocId}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {isAr ? 'السبب:' : 'Reason:'} {returnRecord.reason}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <QrMatrix data={zatcaQrBase64} size={124} />
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-[#0A3D2C]" />
                    <span>{isAr ? 'رمز الزكاة والدخل (المرحلة 1)' : 'ZATCA Phase-1 QR'}</span>
                  </span>
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
                    <td className="p-3">{returnRecord.productName}</td>
                    <td className="p-3 text-end font-mono tabular-nums">{returnRecord.qty}</td>
                    <td className="p-3 text-end font-mono tabular-nums">{formatCurrencyNumber(returnRecord.unitPrice, company.currency)}</td>
                    <td className="p-3 text-end font-mono font-bold tabular-nums">
                      {formatCurrency(returnRecord.amount, company.currency, { isAr })}
                    </td>
                  </tr>
                </tbody>
              </table>
              {returnRecord.notes && (
                <p className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3">
                  {isAr ? 'ملاحظات:' : 'Notes:'} {returnRecord.notes}
                </p>
              )}
            </>
          )}

          {/* QUOTATION */}
          {quotation && (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border border-slate-200 rounded-xl p-4">
                <div>
                  <p className="text-xs font-bold text-slate-500">
                    {isAr ? 'عرض سعر مقدم إلى:' : 'QUOTATION FOR:'}
                  </p>
                  <p className="text-base font-extrabold mt-1">{quotation.customerName}</p>
                  <p className="text-xs text-slate-600 font-mono">{quotation.customerPhone} · {quotation.customerEmail}</p>
                </div>
                <div className="text-xs font-mono">
                  <p className="font-bold text-[#0A3D2C]">{isAr ? 'صالح حتى:' : 'Valid Until:'} {quotation.validUntil}</p>
                  <p className="uppercase mt-1">{quotation.status}</p>
                </div>
              </div>

              {(() => {
                const qtCur = quotation.currency ?? company.currency;
                return (
                  <>
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
                        {quotation.items.map((it, idx) => (
                          <tr key={idx} className="border-b border-slate-200">
                            <td className="p-3">{it.productName}</td>
                            <td className="p-3 text-end font-mono tabular-nums">{it.qty}</td>
                            <td className="p-3 text-end font-mono tabular-nums">{formatCurrencyNumber(it.unitPrice, qtCur)}</td>
                            <td className="p-3 text-end font-mono font-bold tabular-nums">{formatCurrencyNumber(it.total, qtCur)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex justify-end">
                      <div className="w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span>{isAr ? 'المجموع الفرعي' : 'Subtotal'}</span>
                          <span className="font-mono tabular-nums">{formatCurrency(quotation.subtotal, qtCur, { isAr })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{isAr ? `الخصم (${quotation.discountPercent}%)` : `Discount (${quotation.discountPercent}%)`}</span>
                          <span className="font-mono tabular-nums">-{formatCurrency(quotation.discountAmount, qtCur, { isAr })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>
                            {(() => {
                              const netQ = Math.max(0, quotation.subtotal - quotation.discountAmount);
                              const qRate = netQ > 0 ? Number(((quotation.vat / netQ) * 100).toFixed(1)) : company.defaultSalesTaxRate ?? 15;
                              return isAr ? `ضريبة ${qRate}%` : `VAT ${qRate}%`;
                            })()}
                          </span>
                          <span className="font-mono tabular-nums">{formatCurrency(quotation.vat, qtCur, { isAr })}</span>
                        </div>
                        <div className="border-t border-slate-300 pt-2 flex justify-between font-extrabold text-sm text-[#0A3D2C]">
                          <span>{isAr ? 'الإجمالي' : 'TOTAL'}</span>
                          <span className="font-mono tabular-nums">{formatCurrency(quotation.total, qtCur, { isAr })}</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
              {quotation.notes && (
                <p className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3">
                  {isAr ? 'شروط وملاحظات:' : 'Terms & Notes:'} {quotation.notes}
                </p>
              )}
            </>
          )}

          {/* VOUCHER */}
          {voucher && (
            <div className="space-y-5">
              <div className="border-2 border-[#C9A227] rounded-2xl p-6 text-center bg-amber-50/40">
                <p className="text-xs text-slate-500 font-semibold">
                  {voucher.type === 'receipt'
                    ? isAr
                      ? 'مبلغ سند القبض'
                      : 'RECEIPT AMOUNT'
                    : isAr
                    ? 'مبلغ سند الصرف'
                    : 'PAYMENT AMOUNT'}
                </p>
                <p className="text-3xl font-extrabold text-[#0A3D2C] font-mono tabular-nums mt-1">
                  {formatCurrency(voucher.amount, company.currency, { isAr })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500">{isAr ? 'الطرف:' : 'Party:'}</span>
                  <p className="font-bold text-sm mt-0.5">{voucher.partyName}</p>
                </div>
                <div>
                  <span className="text-slate-500">{isAr ? 'طريقة الدفع:' : 'Method:'}</span>
                  <p className="font-bold text-sm mt-0.5">{voucher.paymentMethod}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">{isAr ? 'البيان:' : 'Reason:'}</span>
                  <p className="font-bold text-sm mt-0.5">{voucher.reason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Signatures + Official Stamp + ZATCA Footer */}
          <div className="pt-6 grid grid-cols-3 gap-6 text-center text-xs text-slate-600 items-end">
            <div>
              <p className="font-bold text-[#0A3D2C] h-6">{invoice?.sellerSignature || ''}</p>
              <div className="border-b border-slate-400 h-2 mb-2" />
              <span>{isAr ? 'توقيع البائع / المحاسب' : 'Seller Signature'}</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#0A3D2C]/50 flex items-center justify-center text-[9px] font-extrabold text-[#0A3D2C] uppercase rotate-[-8deg] p-1">
                {company.companyName.slice(0, 14)}
              </div>
              <span className="mt-1">{isAr ? 'الختم الرسمي' : 'Official Stamp'}</span>
            </div>
            <div>
              <p className="font-bold text-[#0A3D2C] h-6">{invoice?.customerSignature || ''}</p>
              <div className="border-b border-slate-400 h-2 mb-2" />
              <span>{isAr ? 'توقيع المستلم / العميل' : 'Recipient Signature'}</span>
            </div>
          </div>

          <div className="border-t-2 border-[#C9A227] pt-3 text-center text-[11px] text-slate-500">
            ZATCA Phase-1 Compliant E-Invoice · Generated by Ostora Systems (com.ostora.accounting)
          </div>
        </div>
      </div>
    </div>
  );
};
