import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CheckSquare,
  Copy,
  Download,
  Edit2,
  Layers,
  Lock,
  Mail,
  MessageCircle,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { QrMatrix } from '../components/QrMatrix';
import { DEFAULT_PRODUCT_IMAGE } from '../constants/permissions';
import { useFirebase } from '../contexts/FirebaseContext';
import { strings } from '../data/translations';
import { computeInvoiceTotalsHalala } from '../domain/accounting';
import { fromHalalas, toHalalas } from '../domain/halala';
import {
  CurrencyCode,
  Invoice,
  InvoiceDocKind,
  InvoiceDocType,
  InvoiceStatus,
  LineItem,
  PaymentMethodType,
  TaxTreatment,
  UnitOfMeasure,
} from '../types/erp';
import {
  DEFAULT_ENABLED_CURRENCIES,
  formatCurrency,
  formatCurrencyNumber,
  getCurrencyMeta,
} from '../utils/currencies';
import { downloadTextFile } from '../utils/export';
import { buildWhatsAppLink } from '../utils/messaging';
import { numberToWordsTafqeet } from '../utils/tafqeet';
import { resolveEffectiveTaxRate } from '../utils/taxRegimes';
import { buildZatcaTlvBase64, buildZatcaUblXml, generateZatcaUuid, validateZatcaPhase1 } from '../utils/zatca';
import { ScreenProps } from './types';

export const InvoicesScreen: React.FC<ScreenProps> = ({ store, onPrintInvoice, onOpenBatchPrint }) => {
  const { user } = useFirebase();
  const isAdmin = user?.email === 'alnwmbshyr1@gmail.com';
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];
  const canDelete = state.currentRole !== 'accountant';
  const isSalesman = state.currentRole === 'salesman';

  const enabledCurrencies = Array.from(
    new Set<CurrencyCode>([
      cur,
      ...(state.settings.enabledCurrencies ?? DEFAULT_ENABLED_CURRENCIES),
    ]),
  );
  const ratesMap = state.settings.exchangeRates ?? {};

  const defaultSalesTaxRate = state.settings.defaultSalesTaxRate ?? 15;
  const [invSearch, setInvSearch] = useState('');
  const [invFilter, setInvFilter] = useState<'all' | InvoiceStatus>('all');
  const [kindFilter, setKindFilter] = useState<'all' | InvoiceDocKind>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [showCostMargin, setShowCostMargin] = useState(false);
  const [payModalInv, setPayModalInv] = useState<Invoice | null>(null);
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payBankId, setPayBankId] = useState(state.banks[0]?.id ?? 'cash');
  const [invModal, setInvModal] = useState<{ open: boolean; edit?: Invoice }>({ open: false });
  const [invModalSection, setInvModalSection] = useState<'all' | 'basic' | 'items' | 'tax_branch' | 'payment'>('all');

  // Quick-add customer inline modal
  const [quickCustOpen, setQuickCustOpen] = useState(false);
  const [quickCustForm, setQuickCustForm] = useState({ name: '', phone: '', taxNumber: '', city: '' });

  // Inline line-item barcode/product search
  const [itemBarcodeQuery, setItemBarcodeQuery] = useState('');

  const [invForm, setInvForm] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    description: '',
    subtotal: '',
    taxRate: String(defaultSalesTaxRate),
    currency: cur as CurrencyCode,
    exchangeRate: '1',
    status: 'pending' as InvoiceStatus,
    invoiceType: 'sales' as InvoiceDocType,
    invoiceDocKind: 'tax' as InvoiceDocKind,
    date: new Date().toISOString().slice(0, 10),
    dueDate: '',
    branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
    warehouseId: state.settings.defaultWarehouseId ?? state.warehouses[0]?.id ?? '',
    salespersonName: state.currentRole as string,
    shiftName: isAr ? 'الصباحية' : 'Morning',
    paymentMethod: 'cash' as PaymentMethodType,
    referenceNumber: '',
    invoiceDiscountPercent: '0',
    discountTotal: '0',
    shippingFee: '0',
    extraFee: '0',
    paidAmount: '0',
    notes: '',
    terms: '',
    taxTreatment: 'standard' as TaxTreatment,
    costCenter: '',
    items: [] as LineItem[],
  });

  const [invProdId, setInvProdId] = useState(state.products[0]?.id ?? '');
  const [invProdQty, setInvProdQty] = useState('1');
  const [invProdUnit, setInvProdUnit] = useState<UnitOfMeasure>('piece');
  const [invProdDiscPct, setInvProdDiscPct] = useState('0');
  const [invProdDesc, setInvProdDesc] = useState('');
  const [formError, setFormError] = useState('');
  const [refreshingFx, setRefreshingFx] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'one' | 'all'; id?: string } | null>(null);
  const [voidModalInv, setVoidModalInv] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [qrInvoice, setQrInvoice] = useState<Invoice | null>(null);
  const [copiedQrTlv, setCopiedQrTlv] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!invModal.open || invModal.edit) return;
    if (invForm.currency === cur) {
      setInvForm((f) => (f.exchangeRate === '1' ? f : { ...f, exchangeRate: '1' }));
      return;
    }
    const latestRate = ratesMap[invForm.currency];
    if (latestRate && latestRate > 0) {
      setInvForm((f) => ({ ...f, exchangeRate: String(latestRate) }));
    }
  }, [invModal.open, invModal.edit, invForm.currency, cur, ratesMap]);

  const salesmanCustomerNames = new Set(
    state.customers
      .filter((c) => !c.salesRep || c.salesRep === state.currentRole || c.salesRep === user?.email)
      .map((c) => c.name),
  );

  const filtered = state.invoices.filter((inv) => {
    if (isSalesman && inv.createdByRole !== 'salesman' && !salesmanCustomerNames.has(inv.customerName)) {
      return false;
    }
    const okFilter = invFilter === 'all' || inv.status === invFilter;
    const okKind = kindFilter === 'all' || (inv.invoiceDocKind ?? 'tax') === kindFilter;
    const okBranch = branchFilter === 'all' || inv.branchId === branchFilter;
    const q = invSearch.toLowerCase();
    const okSearch =
      !q ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.id.toLowerCase().includes(q) ||
      (inv.referenceNumber ?? '').toLowerCase().includes(q);
    return okFilter && okKind && okBranch && okSearch;
  });

  const subNum = parseFloat(invForm.subtotal) || 0;
  const parsedRate = parseFloat(invForm.taxRate);
  const baseTaxRate = Number.isFinite(parsedRate) ? Math.max(0, Math.min(100, parsedRate)) : defaultSalesTaxRate;
  const activeTaxRate = resolveEffectiveTaxRate(baseTaxRate, invForm.taxTreatment);
  const parsedFx = parseFloat(invForm.exchangeRate);
  const activeFxRate =
    invForm.currency === cur ? 1 : Number.isFinite(parsedFx) && parsedFx > 0 ? parsedFx : ratesMap[invForm.currency] ?? 1;
  const calc = computeInvoiceTotalsHalala({
    subtotal: subNum,
    discountTotal: parseFloat(invForm.discountTotal) || 0,
    shippingFee: parseFloat(invForm.shippingFee) || 0,
    extraFee: parseFloat(invForm.extraFee) || 0,
    taxRate: activeTaxRate,
    fxRate: activeFxRate,
    paidAmount: parseFloat(invForm.paidAmount) || 0,
    status: invForm.status,
  });
  const vatNum = calc.vat;
  const totalNum = calc.total;
  const convertedBaseTotal = calc.baseTotal;
  const totalLineQty = invForm.items.reduce((s, it) => s + it.qty, 0);

  const creditCheck = actions.checkCustomerCreditLimit(
    invForm.customerName,
    invForm.customerId,
    convertedBaseTotal,
    invForm.status,
    invModal.edit?.id,
    calc.paidAmount,
  );

  const nextPredictedId = `INV-${
    Math.max(
      1000,
      ...state.invoices.map((i) => parseInt(i.id.replace(/\D/g, ''), 10) || 1000),
    ) + 1
  }`;

  const filteredModalProducts = state.products.filter((p) => {
    const q = itemBarcodeQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q)
    );
  });

  const addLineProduct = (productId: string, qtyOverride?: number) => {
    const pr = state.products.find((p) => p.id === productId);
    if (!pr) return;
    const qty = qtyOverride ?? (parseFloat(invProdQty) || 1);
    const discPct = Math.max(0, Math.min(100, parseFloat(invProdDiscPct) || 0));
    const grossH = Math.round(toHalalas(pr.price) * qty);
    const discH = Math.round((grossH * discPct) / 100);
    const lineNet = fromHalalas(Math.max(0, grossH - discH));
    const lineTaxRate = pr.isTaxable === false ? 0 : activeTaxRate;
    const lineTaxAmt = fromHalalas(Math.round((toHalalas(lineNet) * lineTaxRate) / 100));

    const nextItems: LineItem[] = [
      ...invForm.items,
      {
        productId: pr.id,
        productName: pr.name,
        description: invProdDesc.trim() || pr.description || undefined,
        qty,
        unit: invProdUnit,
        availableStock: pr.qty,
        unitPrice: pr.price,
        costPrice: pr.cost,
        wholesalePrice: pr.wholesalePrice,
        barcode: pr.barcode,
        discountPercent: discPct || undefined,
        discountAmount: discH > 0 ? fromHalalas(discH) : undefined,
        taxRate: lineTaxRate,
        taxAmount: lineTaxAmt,
        total: lineNet,
      },
    ];
    const nextSub = fromHalalas(nextItems.reduce((s, it) => s + toHalalas(it.total), 0));
    setInvForm((f) => ({
      ...f,
      items: nextItems,
      subtotal: nextSub.toFixed(2),
      description: nextItems.map((it) => `${it.productName} ×${it.qty}`).join(' · '),
    }));
    setInvProdDesc('');
    setInvProdDiscPct('0');
  };

  const updateModalLine = (idx: number, patch: Partial<LineItem>) => {
    setInvForm((f) => {
      const nextItems = f.items.map((it, i) => {
        if (i !== idx) return it;
        const merged = { ...it, ...patch };
        const qty = Math.max(0.01, Number(merged.qty) || 1);
        const unitPrice = Math.max(0, Number(merged.unitPrice) || 0);
        const discPct = Math.max(0, Math.min(100, Number(merged.discountPercent) || 0));
        const grossH = Math.round(toHalalas(unitPrice) * qty);
        const discH = Math.round((grossH * discPct) / 100);
        const lineNet = fromHalalas(Math.max(0, grossH - discH));
        const lineTaxRate = merged.taxRate ?? activeTaxRate;
        const lineTaxAmt = fromHalalas(Math.round((toHalalas(lineNet) * lineTaxRate) / 100));
        return {
          ...merged,
          qty,
          unitPrice,
          discountPercent: discPct || undefined,
          discountAmount: discH > 0 ? fromHalalas(discH) : undefined,
          taxAmount: lineTaxAmt,
          total: lineNet,
        };
      });
      const nextSub = fromHalalas(nextItems.reduce((s, it) => s + toHalalas(it.total), 0));
      return {
        ...f,
        items: nextItems,
        subtotal: nextSub.toFixed(2),
        description: nextItems.map((it) => `${it.productName} ×${it.qty}`).join(' · '),
      };
    });
  };

  const totalLineCostBase = fromHalalas(
    invForm.items.reduce((s, it) => s + Math.round(toHalalas(it.costPrice ?? 0) * it.qty), 0),
  );
  const estNetMarginPct =
    calc.baseSubtotal > 0
      ? Number((((calc.baseSubtotal - totalLineCostBase) / calc.baseSubtotal) * 100).toFixed(1))
      : 0;

  const invKpis = (() => {
    let totalH = 0;
    let paidH = 0;
    let remH = 0;
    let vatH = 0;
    for (const inv of filtered) {
      if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
      const fx = inv.exchangeRate ?? 1;
      const sign = inv.invoiceType === 'return' ? -1 : 1;
      const baseTotH = inv.baseTotal !== undefined ? toHalalas(inv.baseTotal) : Math.round(toHalalas(inv.total) * fx);
      const basePaidH = inv.status === 'paid' ? baseTotH : Math.min(baseTotH, Math.round(toHalalas(inv.paidAmount ?? 0) * fx));
      const baseRemH = inv.status === 'paid' ? 0 : Math.max(0, baseTotH - basePaidH);
      totalH += baseTotH * sign;
      paidH += basePaidH * sign;
      remH += baseRemH * sign;
      vatH += Math.round(toHalalas(inv.vat) * fx) * sign;
    }
    return {
      total: fromHalalas(totalH),
      paid: fromHalalas(paidH),
      remaining: fromHalalas(remH),
      vat: fromHalalas(vatH),
    };
  })();

  const handleSaveInvoice = (mode: 'draft' | 'save' | 'saveAndPrint') => {
    setFormError('');
    if (!invForm.customerName.trim()) {
      setFormError(isAr ? 'الرجاء إدخال اسم العميل *' : 'Customer name is required *');
      return;
    }
    if (!invForm.date) {
      setFormError(isAr ? 'تاريخ الفاتورة مطلوب *' : 'Invoice date is required *');
      return;
    }
    if (subNum <= 0) {
      setFormError(isAr ? 'يجب إضافة صنف واحد أو مبلغ فرعي أكبر من 0 *' : 'Subtotal must be greater than 0 *');
      return;
    }
    const targetStatus: InvoiceStatus = mode === 'draft' ? 'draft' : invForm.status === 'draft' ? 'pending' : invForm.status;

    if (targetStatus !== 'draft' && !creditCheck.allowed) {
      actions.notify(
        `${t.creditLimitExceeded} (${t.exceededBy}: ${creditCheck.exceededBy.toFixed(2)} ${cur})`,
      );
      return;
    }

    const br = state.branches.find((b) => b.id === invForm.branchId);
    const wh = state.warehouses.find((w) => w.id === invForm.warehouseId);
    const isoDate =
      invForm.date === new Date().toISOString().slice(0, 10)
        ? invModal.edit?.date ?? new Date().toISOString()
        : new Date(`${invForm.date}T12:00:00`).toISOString();

    const payload: Omit<Invoice, 'id' | 'vat' | 'total'> = {
      customerId: creditCheck.customer?.id ?? invForm.customerId ?? invModal.edit?.customerId ?? '',
      customerName: invForm.customerName.trim(),
      customerPhone: invForm.customerPhone.trim(),
      description: invForm.description.trim(),
      items: invForm.items,
      subtotal: subNum,
      invoiceDiscountPercent: parseFloat(invForm.invoiceDiscountPercent) || undefined,
      discountTotal: parseFloat(invForm.discountTotal) || 0,
      shippingFee: parseFloat(invForm.shippingFee) || 0,
      extraFee: parseFloat(invForm.extraFee) || 0,
      paidAmount: targetStatus === 'draft' ? 0 : calc.paidAmount,
      remainingAmount: targetStatus === 'draft' ? 0 : calc.remainingAmount,
      taxRate: activeTaxRate,
      currency: invForm.currency,
      exchangeRate: activeFxRate,
      baseTotal: convertedBaseTotal,
      status: targetStatus,
      invoiceType: invForm.invoiceType,
      invoiceDocKind: invForm.invoiceDocKind,
      dueDate: invForm.dueDate || undefined,
      branchId: br?.id,
      branchName: br ? (isAr ? br.nameAr : br.nameEn) : undefined,
      warehouseId: wh?.id,
      warehouseName: wh ? (isAr ? wh.nameAr : wh.nameEn) : undefined,
      salespersonName: invForm.salespersonName || state.currentRole,
      shiftName: invForm.shiftName || undefined,
      paymentMethod: invForm.paymentMethod,
      referenceNumber: invForm.referenceNumber.trim() || undefined,
      notes: invForm.notes || undefined,
      terms: invForm.terms || undefined,
      taxTreatment: invForm.taxTreatment,
      costCenter: invForm.costCenter.trim() || undefined,
      date: isoDate,
    };

    const result = actions.saveInvoice(payload, invModal.edit?.id);
    if (!result.ok) {
      actions.notify(result.fiscalLocked ? t.fiscalLockBlocked : t.creditLimitExceeded);
      return;
    }

    setInvModal({ open: false });

    if (result.lowStockItems && result.lowStockItems.length > 0) {
      actions.notify(
        isAr
          ? `تم حفظ الفاتورة · تنبيه مخزون منخفض: ${result.lowStockItems.join('، ')}`
          : `Invoice saved · Low stock alert: ${result.lowStockItems.join(', ')}`,
        4800,
      );
    } else {
      actions.notify(
        targetStatus === 'draft'
          ? isAr ? 'تم حفظ المسودة دون خصم مخزون أو قيد' : 'Draft saved'
          : isAr ? 'تم حفظ الفاتورة والقيد والمخزون' : 'Invoice, journal & stock updated',
      );
    }

    if (mode === 'saveAndPrint' && onPrintInvoice) {
      onPrintInvoice({
        ...payload,
        id: result.invoiceId,
        vat: vatNum,
        total: totalNum,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <p className="text-[11px] font-bold text-slate-500">{isAr ? 'إجمالي الفواتير المفلترة' : 'Filtered Sales Total'}</p>
          <p className="text-lg font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-[#C9A227] mt-1">
            {formatCurrency(invKpis.total, cur, { isAr })}
          </p>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <p className="text-[11px] font-bold text-slate-500">{isAr ? 'المحصل الفعلي' : 'Collected'}</p>
          <p className="text-lg font-extrabold font-mono tabular-nums text-emerald-600 mt-1">
            {formatCurrency(invKpis.paid, cur, { isAr })}
          </p>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <p className="text-[11px] font-bold text-slate-500">{isAr ? 'المتبقي للتحصيل' : 'Outstanding'}</p>
          <p className="text-lg font-extrabold font-mono tabular-nums text-amber-600 mt-1">
            {formatCurrency(invKpis.remaining, cur, { isAr })}
          </p>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <p className="text-[11px] font-bold text-slate-500">{isAr ? 'ضريبة المخرجات' : 'Output VAT'}</p>
          <p className="text-lg font-extrabold font-mono tabular-nums mt-1">
            {formatCurrency(invKpis.vat, cur, { isAr })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={invSearch}
            onChange={(e) => setInvSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as 'all' | InvoiceDocKind)}
          className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الأنواع' : 'All Kinds'}</option>
          <option value="tax">{isAr ? 'ضريبية' : 'Tax'}</option>
          <option value="simplified">{isAr ? 'مبسطة' : 'Simplified'}</option>
          <option value="cash">{t.payCash}</option>
          <option value="credit">{t.payCredit}</option>
        </select>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الفروع' : 'All Branches'}</option>
          {state.branches.map((b) => (
            <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
          ))}
        </select>
        <button
          onClick={() => {
            setFormError('');
            setItemBarcodeQuery('');
            setInvProdId(state.products[0]?.id ?? '');
            setInvProdQty('1');
            setInvForm({
              customerId: state.customers[0]?.id ?? '',
              customerName: state.customers[0]?.name ?? '',
              customerPhone: state.customers[0]?.phone ?? '',
              description: '',
              subtotal: '',
              taxRate: String(defaultSalesTaxRate),
              currency: cur,
              exchangeRate: '1',
              status: 'pending',
              invoiceType: 'sales',
              invoiceDocKind: 'tax',
              date: new Date().toISOString().slice(0, 10),
              dueDate: '',
              branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
              warehouseId: state.settings.defaultWarehouseId ?? state.warehouses[0]?.id ?? '',
              salespersonName: state.currentRole,
              shiftName: isAr ? 'الصباحية' : 'Morning',
              paymentMethod: 'cash',
              referenceNumber: '',
              invoiceDiscountPercent: '0',
              discountTotal: '0',
              shippingFee: '0',
              extraFee: '0',
              paidAmount: '0',
              notes: '',
              terms: '',
              taxTreatment: 'standard',
              costCenter: '',
              items: [],
            });
            setInvModalSection('all');
            setInvModal({ open: true });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm hover:opacity-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addInvoice}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            const csv = ['ID,Date,Kind,Customer,Currency,Subtotal,VAT,Total,Paid,Remaining,Status']
              .concat(
                filtered.map(
                  (inv) =>
                    `${inv.id},${inv.date.slice(0, 10)},${inv.invoiceDocKind ?? 'tax'},"${inv.customerName}",${inv.currency ?? cur},${inv.subtotal},${inv.vat},${inv.total},${inv.paidAmount ?? 0},${inv.remainingAmount ?? 0},${inv.status}`,
                ),
              )
              .join('\n');
            downloadTextFile(`ostora_invoices_${new Date().toISOString().slice(0, 10)}.csv`, csv);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{t.exportCsv}</span>
        </button>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const items =
                selectedIds.length > 0
                  ? filtered.filter((i) => selectedIds.includes(i.id))
                  : filtered;
              onOpenBatchPrint?.(items.map((inv) => ({ kind: 'invoice', data: inv })));
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#C9A227] text-slate-950 font-extrabold text-xs hover:opacity-90 cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>
              {selectedIds.length > 0
                ? `${t.batchPrintSelected} (${filtered.filter((i) => selectedIds.includes(i.id)).length})`
                : `${t.batchPrint} (${filtered.length})`}
            </span>
          </button>
        )}
        {state.invoices.length > 0 && canDelete && (
          <button
            onClick={() => setConfirmDelete({ type: 'all' })}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 font-bold text-xs hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.deleteAll}</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl w-fit">
          {(['all', 'draft', 'paid', 'partial', 'pending', 'overdue', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setInvFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                invFilter === st
                  ? 'bg-[#0A3D2C] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2C24]'
              }`}
            >
              {t[st]}
            </button>
          ))}
        </div>

        {filtered.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const allIds = filtered.map((i) => i.id);
              const allSelected = allIds.every((id) => selectedIds.includes(id));
              setSelectedIds(allSelected ? [] : allIds);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
          >
            {filtered.every((i) => selectedIds.includes(i.id)) ? (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                <span>{t.clearSelection}</span>
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5" />
                <span>{t.selectAll}</span>
              </>
            )}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
          {t.noData}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((inv) => {
            const isSelected = selectedIds.includes(inv.id);
            return (
              <div
                key={inv.id}
                className={`bg-white dark:bg-[#121E19] border rounded-[20px] p-5 space-y-3 transition-colors ${
                  isSelected
                    ? 'border-[#C9A227] ring-1 ring-[#C9A227]/40'
                    : 'border-slate-200 dark:border-[#1F332B]'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          prev.includes(inv.id)
                            ? prev.filter((x) => x !== inv.id)
                            : [...prev, inv.id],
                        )
                      }
                      className="w-4 h-4 rounded accent-[#0A3D2C] cursor-pointer"
                    />
                    <span className="font-mono font-bold text-slate-500">
                      {inv.id} · {inv.date.slice(0, 10)}
                    </span>
                  </label>
                  <span
                    className={`font-bold ${
                      inv.status === 'paid'
                        ? 'text-emerald-600'
                        : inv.status === 'overdue'
                        ? 'text-red-600'
                        : inv.status === 'draft'
                        ? 'text-slate-500'
                        : 'text-amber-600'
                    }`}
                  >
                    {t[inv.status]}
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-base">{inv.customerName}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{inv.description || '—'}</p>
                  {inv.status === 'cancelled' && (inv.voidReason || inv.reversalJournalId) && (
                    <p className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 text-red-700 dark:text-red-400 text-[11px] font-bold">
                      <span>{isAr ? 'ملغاة:' : 'Voided:'} {inv.voidReason || '—'}</span>
                      {inv.reversalJournalId && <span className="font-mono">({inv.reversalJournalId})</span>}
                    </p>
                  )}
                </div>
                <div className="flex items-baseline justify-between text-xs pt-1">
                  {(() => {
                    const invCur = inv.currency ?? cur;
                    const invTaxPct =
                      inv.taxRate ??
                      (inv.subtotal > 0 ? Number(((inv.vat / inv.subtotal) * 100).toFixed(1)) : defaultSalesTaxRate);
                    return (
                      <>
                        <span className="text-slate-500 font-mono tabular-nums">
                          {t.subtotal}: {formatCurrencyNumber(inv.subtotal, invCur)} · {t.vat} ({invTaxPct}%): {formatCurrencyNumber(inv.vat, invCur)}
                        </span>
                        <div className="text-end">
                          <span className="text-lg font-extrabold text-[#0A3D2C] dark:text-[#C9A227] font-mono tabular-nums block">
                            {formatCurrency(inv.total, invCur, { isAr })}
                          </span>
                          {inv.currency && inv.currency !== cur && (
                            <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                              ≈ {formatCurrency(inv.baseTotal ?? inv.total * (inv.exchangeRate ?? 1), cur, { isAr })}
                            </span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-[#1F332B] flex flex-wrap items-center gap-2">
                  {inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft' && (
                    <>
                      <button
                        onClick={() => {
                          actions.markInvoicePaid(inv.id);
                          actions.notify(
                            isAr
                              ? `تم تحصيل الفاتورة ${inv.id} وإصدار سند قبض وقيد مزدوج`
                              : `Invoice ${inv.id} marked paid with auto receipt & journal`,
                          );
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#C9A227] text-slate-950 text-xs font-extrabold cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تحصيل كامل' : 'Mark Paid'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setPayModalInv(inv);
                          setPayAmountInput(String(inv.remainingAmount ?? inv.total));
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#C9A227] text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
                      >
                        <span>{isAr ? 'دفعة جزئية' : 'Partial Pay'}</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => onPrintInvoice?.(inv)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{t.printPdf}</span>
                  </button>
                  <button
                    onClick={() => {
                      setCopiedQrTlv(false);
                      setQrInvoice(inv);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1F332B] hover:border-[#0A3D2C] dark:hover:border-[#C9A227] text-xs font-bold cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                    <span>{t.quickScanQr}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const xml =
                        inv.zatcaXml ||
                        buildZatcaUblXml({
                          invoiceId: inv.id,
                          uuid: inv.zatcaUuid || generateZatcaUuid(),
                          icv: inv.icv ?? 1,
                          pih: inv.pih || '0',
                          issueDateIso: inv.date,
                          currency: inv.currency ?? cur,
                          sellerName: state.settings.companyName,
                          sellerVat: state.settings.taxNumber,
                          sellerAddress: state.settings.address,
                          customerName: inv.customerName,
                          subtotal: inv.subtotal,
                          vat: inv.vat,
                          total: inv.total,
                          taxRate: inv.taxRate ?? defaultSalesTaxRate,
                          invoiceType: inv.invoiceType,
                          items: inv.items,
                        });
                      downloadTextFile(`zatca_${inv.id}.xml`, xml, 'application/xml;charset=utf-8');
                      actions.notify(isAr ? `تم تنزيل ملف ZATCA XML (${inv.id})` : `Downloaded ZATCA XML (${inv.id})`);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                    <span>{isAr ? 'تنزيل XML' : 'XML'}</span>
                  </button>
                  {inv.status !== 'draft' && inv.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => {
                        setVoidReason('');
                        setVoidModalInv(inv);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs font-bold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isAr ? 'إلغاء (قيد عكسي)' : 'Void & Reverse'}</span>
                    </button>
                  )}
                  <a
                    href={buildWhatsAppLink(
                      inv.customerPhone,
                      isAr
                        ? `السلام عليكم ${inv.customerName}، الفاتورة الضريبية رقم ${inv.id} بإجمالي ${formatCurrency(inv.total, inv.currency ?? cur, { isAr: true })} (شامل ${inv.taxRate ?? (inv.subtotal > 0 ? Number(((inv.vat / inv.subtotal) * 100).toFixed(1)) : defaultSalesTaxRate)}% ضريبة) من ${state.settings.companyName}.`
                        : `Hello ${inv.customerName}, Tax Invoice ${inv.id} total ${formatCurrency(inv.total, inv.currency ?? cur, { isAr: false })} from ${state.settings.companyName}.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{t.whatsapp}</span>
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(`Invoice ${inv.id}`)}&body=${encodeURIComponent(`Total: ${formatCurrency(inv.total, inv.currency ?? cur, { isAr })}`)}`}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24]"
                    title={t.emailShare}
                  >
                    <Mail className="w-4 h-4 text-slate-500" />
                  </a>
                  <div className="ms-auto flex items-center gap-1">
                    {inv.status === 'paid' && !isAdmin ? (
                      <span
                        title={t.lockedRecordHint}
                        aria-label={t.lockedRecordHint}
                        className="p-1.5 rounded-lg text-slate-400 cursor-not-allowed"
                      >
                        <Lock className="w-4 h-4" />
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setFormError('');
                          const existingRate =
                            inv.taxRate ??
                            (inv.subtotal > 0
                              ? Number(((inv.vat / inv.subtotal) * 100).toFixed(1))
                              : defaultSalesTaxRate);
                          const invCur = inv.currency ?? cur;
                          setInvForm({
                            customerId: inv.customerId,
                            customerName: inv.customerName,
                            customerPhone: inv.customerPhone,
                            description: inv.description,
                            subtotal: String(inv.subtotal),
                            taxRate: String(existingRate),
                            currency: invCur,
                            exchangeRate: String(invCur === cur ? 1 : inv.exchangeRate ?? ratesMap[invCur] ?? 1),
                            status: inv.status,
                            invoiceType: inv.invoiceType ?? 'sales',
                            invoiceDocKind: inv.invoiceDocKind ?? 'tax',
                            date: inv.date.slice(0, 10),
                            dueDate: inv.dueDate ?? '',
                            branchId: inv.branchId ?? state.branches[0]?.id ?? '',
                            warehouseId: inv.warehouseId ?? state.warehouses[0]?.id ?? '',
                            salespersonName: inv.salespersonName ?? state.currentRole,
                            shiftName: inv.shiftName ?? '',
                            paymentMethod: inv.paymentMethod ?? 'cash',
                            referenceNumber: inv.referenceNumber ?? '',
                            invoiceDiscountPercent: String(inv.invoiceDiscountPercent ?? 0),
                            discountTotal: String(inv.discountTotal ?? 0),
                            shippingFee: String(inv.shippingFee ?? 0),
                            extraFee: String(inv.extraFee ?? 0),
                            paidAmount: String(inv.paidAmount ?? 0),
                            notes: inv.notes ?? '',
                            terms: inv.terms ?? '',
                            taxTreatment: inv.taxTreatment ?? 'standard',
                            costCenter: inv.costCenter ?? '',
                            items: inv.items ?? [],
                          });
                          setInvModalSection('all');
                          setInvModal({ open: true, edit: inv });
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                        aria-label={t.edit}
                      >
                        <Edit2 className="w-4 h-4 text-slate-500" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => setConfirmDelete({ type: 'one', id: inv.id })}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        aria-label={t.delete}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full ERP Invoice Create / Edit Modal */}
      {invModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-3xl w-full p-6 space-y-3 my-auto max-h-[94vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-extrabold">{invModal.edit ? t.editInvoice : t.addInvoice}</h3>
                <p className="text-xs font-mono text-slate-500">
                  {invModal.edit ? invModal.edit.id : nextPredictedId}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-[#0A120F] p-1 rounded-xl">
                {(
                  [
                    ['all', t.all],
                    ['basic', isAr ? 'العميل والتاريخ' : 'Client & Date'],
                    ['items', isAr ? 'الأصناف' : 'Items'],
                    ['tax_branch', isAr ? 'الفرع والضريبة' : 'Branch & Tax'],
                    ['payment', isAr ? 'العملة والدفع' : 'Currency & Pay'],
                  ] as const
                ).map(([sec, lbl]) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setInvModalSection(sec)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                      invModalSection === sec
                        ? 'bg-[#0A3D2C] text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <button onClick={() => setInvModal({ open: false })} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-700 text-xs font-bold">
                {formError}
              </div>
            )}

            {(invModalSection === 'all' || invModalSection === 'basic') && (
              <>
            {/* Header Metadata: Date*, Due Date, Kind, Customer* + Quick Add */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.date} *</label>
                <input
                  type="date"
                  value={invForm.date}
                  onChange={(e) => setInvForm({ ...invForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
                <input
                  type="date"
                  value={invForm.dueDate}
                  onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{isAr ? 'نوع الفاتورة' : 'Invoice Kind'}</label>
                <select
                  value={invForm.invoiceDocKind}
                  onChange={(e) => setInvForm({ ...invForm, invoiceDocKind: e.target.value as InvoiceDocKind })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="tax">{isAr ? 'ضريبية' : 'Tax'}</option>
                  <option value="simplified">{isAr ? 'مبسطة' : 'Simplified'}</option>
                  <option value="cash">{isAr ? 'نقدية' : 'Cash'}</option>
                  <option value="credit">{isAr ? 'آجلة' : 'Credit'}</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{isAr ? 'تصنيف المستند' : 'Doc Category'}</label>
                <select
                  value={invForm.invoiceType}
                  onChange={(e) => setInvForm({ ...invForm, invoiceType: e.target.value as InvoiceDocType })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="sales">{isAr ? 'فاتورة مبيعات' : 'Sales Invoice'}</option>
                  <option value="return">{isAr ? 'مرتجع مبيعات' : 'Sales Return'}</option>
                  <option value="quotation">{isAr ? 'عرض سعر' : 'Quotation'}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-6">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.client} *</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    maxLength={160}
                    list="ostora_invoice_customers"
                    value={invForm.customerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = state.customers.find((c) => c.name === val);
                      setInvForm({
                        ...invForm,
                        customerId: match ? match.id : '',
                        customerName: val,
                        customerPhone: match ? match.phone : invForm.customerPhone,
                      });
                    }}
                    placeholder={`${t.client} *`}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setQuickCustOpen(true)}
                    title={t.addCustomer}
                    className="px-2.5 py-2 rounded-xl bg-[#0A3D2C] text-white cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
                <datalist id="ostora_invoice_customers">
                  {state.customers.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>
              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.phone}</label>
                <input
                  type="tel"
                  maxLength={40}
                  value={invForm.customerPhone}
                  onChange={(e) => setInvForm({ ...invForm, customerPhone: e.target.value })}
                  placeholder={t.phone}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{isAr ? 'المندوب' : 'Salesperson'}</label>
                <input
                  type="text"
                  value={invForm.salespersonName}
                  onChange={(e) => setInvForm({ ...invForm, salespersonName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
            </div>
              </>
            )}

            {(invModalSection === 'all' || invModalSection === 'items') && (
            /* Items Builder with Barcode Scan, Description, Unit, Stock, Discount % */
            <div className="border border-slate-200 dark:border-[#1F332B] rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-500">{t.product} *</p>
                <input
                  type="text"
                  value={itemBarcodeQuery}
                  onChange={(e) => setItemBarcodeQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const q = itemBarcodeQuery.trim().toLowerCase();
                      const exact = state.products.find(
                        (p) => p.barcode.toLowerCase() === q || p.sku.toLowerCase() === q,
                      );
                      if (exact) {
                        addLineProduct(exact.id, 1);
                        setItemBarcodeQuery('');
                      }
                    }
                  }}
                  placeholder={isAr ? 'بحث بالباركود أو الاسم...' : 'Scan barcode or search product...'}
                  className="w-56 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>

              <div className="max-h-28 overflow-y-auto space-y-1">
                {filteredModalProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setInvProdId(p.id);
                      setInvProdUnit(p.unit ?? 'piece');
                    }}
                    className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg text-start text-xs cursor-pointer ${
                      invProdId === p.id ? 'bg-[#0A3D2C] text-white' : 'hover:bg-slate-100 dark:hover:bg-[#1A2C24]'
                    }`}
                  >
                    <img src={p.imageBase64 || DEFAULT_PRODUCT_IMAGE} alt={p.name} className="w-7 h-7 rounded object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{p.name}</p>
                      <p className="font-mono text-[10px] opacity-75">
                        {p.barcode} · {isAr ? 'متوفر:' : 'Avail:'} {p.qty}
                      </p>
                    </div>
                    <span className="font-mono font-bold">{formatCurrency(p.price, cur, { isAr })}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
                <input
                  type="text"
                  value={invProdDesc}
                  onChange={(e) => setInvProdDesc(e.target.value)}
                  placeholder={isAr ? 'وصف البند' : 'Line desc'}
                  className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
                <input
                  type="number"
                  min={1}
                  value={invProdQty}
                  onChange={(e) => setInvProdQty(e.target.value)}
                  placeholder={`${t.qty}*`}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
                <select
                  value={invProdUnit}
                  onChange={(e) => setInvProdUnit(e.target.value as UnitOfMeasure)}
                  className="px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  <option value="piece">{t.unitPiece}</option>
                  <option value="carton">{t.unitCarton}</option>
                  <option value="kg">{t.unitKg}</option>
                  <option value="meter">{t.unitMeter}</option>
                  <option value="liter">{t.unitLiter}</option>
                  <option value="box">{t.unitBox}</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={invProdDiscPct}
                  onChange={(e) => setInvProdDiscPct(e.target.value)}
                  placeholder={`${t.discountPercent}`}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => addLineProduct(invProdId)}
                  className="py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
                >
                  + {t.addItem}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowCostMargin((v) => !v)}
                  className="font-bold text-[#0A3D2C] dark:text-[#C9A227] underline cursor-pointer"
                >
                  {showCostMargin
                    ? (isAr ? 'إخفاء سعر الشراء والربح' : 'Hide Cost & Margin')
                    : (isAr ? 'إظهار سعر الشراء والهامش المخفي' : 'Show Hidden Cost & Margin')}
                </button>
                <span className="font-mono text-slate-500">
                  {isAr ? 'إجمالي الكمية:' : 'Total Qty:'} {totalLineQty}
                </span>
              </div>

              {invForm.items.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-[#1F332B] overflow-x-auto max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-[#0A120F]">
                      <tr>
                        <th className="p-1.5 text-start">{t.product}</th>
                        <th className="p-1.5 text-center w-16">{t.qty}</th>
                        <th className="p-1.5 text-center w-24">{t.price}</th>
                        <th className="p-1.5 text-center w-16">{t.discountPercent}</th>
                        <th className="p-1.5 text-end">{t.total}</th>
                        <th className="p-1.5 w-7"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
                      {invForm.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5">
                            <span className="font-bold block truncate max-w-[160px]">{it.productName}</span>
                            {showCostMargin && it.costPrice !== undefined && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {t.cost}: {it.costPrice}
                              </span>
                            )}
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              min={0.1}
                              step="1"
                              value={it.qty}
                              onChange={(e) => updateModalLine(idx, { qty: Math.max(0.1, parseFloat(e.target.value) || 1) })}
                              className="w-full px-1.5 py-1 rounded bg-slate-50 dark:bg-[#0A120F] border text-center font-mono"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={it.unitPrice}
                              onChange={(e) => updateModalLine(idx, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                              className="w-full px-1.5 py-1 rounded bg-slate-50 dark:bg-[#0A120F] border text-center font-mono"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.5"
                              value={it.discountPercent ?? 0}
                              onChange={(e) => updateModalLine(idx, { discountPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                              className="w-full px-1.5 py-1 rounded bg-slate-50 dark:bg-[#0A120F] border text-center font-mono"
                            />
                          </td>
                          <td className="p-1.5 text-end font-mono font-bold tabular-nums">
                            {formatCurrency(it.total, invForm.currency, { isAr })}
                          </td>
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const nextItems = invForm.items.filter((_, i) => i !== idx);
                                const nextSub = fromHalalas(nextItems.reduce((s, x) => s + toHalalas(x.total), 0));
                                setInvForm({
                                  ...invForm,
                                  items: nextItems,
                                  subtotal: nextItems.length ? nextSub.toFixed(2) : '',
                                  description: nextItems.map((x) => `${x.productName} ×${x.qty}`).join(' · '),
                                });
                              }}
                              className="text-red-500 hover:text-red-700 cursor-pointer"
                              aria-label={t.delete}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            )}

            {(invModalSection === 'all' || invModalSection === 'tax_branch') && (
              <>
            {/* Branch*, Warehouse*, Payment Method, Reference# */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.branch} *</label>
                <select
                  value={invForm.branchId}
                  onChange={(e) => setInvForm({ ...invForm, branchId: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  {state.branches.map((b) => (
                    <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.warehouse} *</label>
                <select
                  value={invForm.warehouseId}
                  onChange={(e) => setInvForm({ ...invForm, warehouseId: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  {state.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{isAr ? w.nameAr : w.nameEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.paymentMethodLabel}</label>
                <select
                  value={invForm.paymentMethod}
                  onChange={(e) => setInvForm({ ...invForm, paymentMethod: e.target.value as PaymentMethodType })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="cash">{t.payCash}</option>
                  <option value="credit">{t.payCredit}</option>
                  <option value="pos_card">{t.payCard}</option>
                  <option value="transfer">{t.payTransfer}</option>
                  <option value="apple_pay">{t.payApplePay}</option>
                  <option value="cheque">{t.payCheque}</option>
                  <option value="installment">{t.payInstallment}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.referenceNumber}</label>
                <input
                  type="text"
                  value={invForm.referenceNumber}
                  onChange={(e) => setInvForm({ ...invForm, referenceNumber: e.target.value })}
                  placeholder="REF / PO"
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            </div>
              </>
            )}

            {(invModalSection === 'all' || invModalSection === 'payment') && (
              <>
            {/* Invoice Discount % & Amount, Shipping, Extra, Paid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.discountPercent}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={invForm.invoiceDiscountPercent}
                  onChange={(e) => {
                    const pct = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                    const disc = fromHalalas(Math.round((toHalalas(subNum) * pct) / 100));
                    setInvForm({
                      ...invForm,
                      invoiceDiscountPercent: e.target.value,
                      discountTotal: String(disc),
                    });
                  }}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{isAr ? 'مبلغ الخصم' : 'Discount'}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={invForm.discountTotal}
                  onChange={(e) => {
                    const amt = Math.max(0, parseFloat(e.target.value) || 0);
                    const pct = subNum > 0 ? Number(((amt / subNum) * 100).toFixed(2)) : 0;
                    setInvForm({
                      ...invForm,
                      discountTotal: e.target.value,
                      invoiceDiscountPercent: String(pct),
                    });
                  }}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{isAr ? 'الشحن' : 'Shipping'}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={invForm.shippingFee}
                  onChange={(e) => setInvForm({ ...invForm, shippingFee: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{isAr ? 'رسوم إضافية' : 'Extra'}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={invForm.extraFee}
                  onChange={(e) => setInvForm({ ...invForm, extraFee: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{isAr ? 'المدفوع' : 'Paid'}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={invForm.paidAmount}
                  onChange={(e) => setInvForm({ ...invForm, paidAmount: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.reason}</label>
                <input
                  type="text"
                  maxLength={500}
                  value={invForm.description}
                  onChange={(e) => setInvForm({ ...invForm, description: e.target.value })}
                  placeholder={t.reason}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{isAr ? 'الشروط والأحكام' : 'Terms & Conditions'}</label>
                <input
                  type="text"
                  maxLength={500}
                  value={invForm.terms}
                  onChange={(e) => setInvForm({ ...invForm, terms: e.target.value })}
                  placeholder={isAr ? 'الشروط والأحكام' : 'Terms & Conditions'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{isAr ? 'المعاملة الضريبية' : 'Tax Treatment'}</label>
                <select
                  value={invForm.taxTreatment}
                  onChange={(e) => setInvForm({ ...invForm, taxTreatment: e.target.value as TaxTreatment })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="standard">{isAr ? 'خاضع للضريبة الأساسية' : 'Standard Rated'}</option>
                  <option value="zero">{isAr ? 'نسبة صفرية (0%)' : 'Zero Rated (0%)'}</option>
                  <option value="exempt">{isAr ? 'معفى من الضريبة' : 'Tax Exempt'}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.costCenter}</label>
                <input
                  type="text"
                  maxLength={120}
                  value={invForm.costCenter}
                  onChange={(e) => setInvForm({ ...invForm, costCenter: e.target.value })}
                  placeholder={isAr ? 'مثال: CC-SALES' : 'e.g. CC-SALES'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            </div>

            {/* Currency, Rate, Subtotal, VAT%, Status */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="sm:col-span-1">
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.invoiceCurrency}</label>
                <select
                  value={invForm.currency}
                  onChange={(e) => {
                    const nextCur = e.target.value as CurrencyCode;
                    const nextFx = nextCur === cur ? 1 : ratesMap[nextCur] ?? 1;
                    setInvForm({ ...invForm, currency: nextCur, exchangeRate: String(nextFx) });
                  }}
                  className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  {Array.from(new Set<CurrencyCode>([...enabledCurrencies, invForm.currency])).map((code) => {
                    const meta = getCurrencyMeta(code);
                    return (
                      <option key={code} value={code}>{code} — {isAr ? meta.nameAr : meta.nameEn}</option>
                    );
                  })}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-500">{t.exchangeRate}</label>
                  {invForm.currency !== cur && (
                    <button
                      type="button"
                      disabled={refreshingFx}
                      onClick={async () => {
                        setRefreshingFx(true);
                        try {
                          const res = await actions.refreshLiveExchangeRates(cur);
                          const liveRate = res.rates[invForm.currency];
                          if (liveRate) setInvForm((f) => ({ ...f, exchangeRate: String(liveRate) }));
                        } finally {
                          setRefreshingFx(false);
                        }
                      }}
                      className="text-[10px] font-bold text-[#0A3D2C] dark:text-[#C9A227] flex items-center gap-0.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${refreshingFx ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min={0.0001}
                  step={0.0001}
                  disabled={invForm.currency === cur}
                  value={invForm.exchangeRate}
                  onChange={(e) => setInvForm({ ...invForm, exchangeRate: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.subtotal} *</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={invForm.subtotal}
                  onChange={(e) => setInvForm({ ...invForm, subtotal: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.vat} %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={invForm.taxRate}
                  onChange={(e) => setInvForm({ ...invForm, taxRate: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">{t.status}</label>
                <select
                  value={invForm.status}
                  onChange={(e) => setInvForm({ ...invForm, status: e.target.value as InvoiceStatus })}
                  className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="draft">{t.draft}</option>
                  <option value="paid">{t.paid}</option>
                  <option value="partial">{t.partial}</option>
                  <option value="pending">{t.pending}</option>
                  <option value="overdue">{t.overdue}</option>
                  <option value="cancelled">{t.cancelled}</option>
                </select>
              </div>
            </div>
              </>
            )}

            {/* Summary Box */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0A120F] space-y-1 text-xs font-bold tabular-nums">
              <div className="flex flex-wrap justify-between gap-2">
                <span>{t.vat} ({activeTaxRate}%): {formatCurrency(vatNum, invForm.currency, { isAr })}</span>
                <span>{isAr ? 'المتبقي:' : 'Remaining:'} {formatCurrency(calc.remainingAmount, invForm.currency, { isAr })}</span>
                <span className="text-[#0A3D2C] dark:text-[#C9A227]">{t.total}: {formatCurrency(totalNum, invForm.currency, { isAr })}</span>
              </div>
              {showCostMargin && invForm.items.length > 0 && (
                <div className="flex justify-between text-[11px] text-emerald-700 dark:text-emerald-400 pt-1 border-t border-slate-200 dark:border-[#1F332B]">
                  <span>{isAr ? 'تكلفة البضاعة التقديرية:' : 'Est. COGS:'} {formatCurrency(totalLineCostBase, cur, { isAr })}</span>
                  <span>{isAr ? 'هامش الربح:' : 'Gross Margin:'} {estNetMarginPct}%</span>
                </div>
              )}
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-[#1F332B]">
                {numberToWordsTafqeet(totalNum, invForm.currency, isAr ? 'ar' : 'en')}
              </p>
              {invForm.currency !== cur && (
                <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200 dark:border-[#1F332B]">
                  <span>{t.equivalentBase}</span>
                  <span className="font-mono">{formatCurrency(convertedBaseTotal, cur, { isAr })} (×{activeFxRate})</span>
                </div>
              )}
            </div>

            {creditCheck.customer && creditCheck.creditLimit !== undefined && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  !creditCheck.allowed
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-900 text-red-700 dark:text-red-300'
                    : 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {!creditCheck.allowed && <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{t.creditLimit}: {formatCurrency(creditCheck.creditLimit, cur, { isAr })}</span>
                  </span>
                  <span className="font-mono tabular-nums">{t.debt}: {formatCurrency(creditCheck.currentDebt, cur, { isAr })}</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                  <span>{t.projectedBalance}: {formatCurrency(creditCheck.projectedDebt, cur, { isAr })}</span>
                  {!creditCheck.allowed && (
                    <span className="font-extrabold">{t.exceededBy}: +{formatCurrency(creditCheck.exceededBy, cur, { isAr })}</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => setInvModal({ open: false })}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] font-bold text-xs cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => handleSaveInvoice('draft')}
                className="px-4 py-2.5 rounded-xl border border-[#0A3D2C] text-[#0A3D2C] dark:text-[#C9A227] dark:border-[#C9A227] font-bold text-xs cursor-pointer"
              >
                {t.saveDraft}
              </button>
              <button
                type="button"
                disabled={!creditCheck.allowed}
                onClick={() => handleSaveInvoice('save')}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-xs sm:text-sm cursor-pointer disabled:opacity-50"
              >
                {t.save}
              </button>
              <button
                type="button"
                disabled={!creditCheck.allowed}
                onClick={() => handleSaveInvoice('saveAndPrint')}
                className="px-4 py-2.5 rounded-xl bg-[#C9A227] text-slate-950 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{t.saveAndPrint}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Quick-Add Customer Modal */}
      {quickCustOpen && (
        <div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-sm w-full p-5 space-y-3">
            <h3 className="text-base font-extrabold">{t.addCustomer}</h3>
            <input
              type="text"
              value={quickCustForm.name}
              onChange={(e) => setQuickCustForm({ ...quickCustForm, name: e.target.value })}
              placeholder={`${t.fullName} *`}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />
            <input
              type="tel"
              value={quickCustForm.phone}
              onChange={(e) => setQuickCustForm({ ...quickCustForm, phone: e.target.value })}
              placeholder={`${t.phone} *`}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />
            <input
              type="text"
              value={quickCustForm.taxNumber}
              onChange={(e) => setQuickCustForm({ ...quickCustForm, taxNumber: e.target.value })}
              placeholder={t.taxNumber}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
            />
            <div className="flex gap-2">
              <button onClick={() => setQuickCustOpen(false)} className="flex-1 py-2 rounded-xl border text-xs font-bold cursor-pointer">
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!quickCustForm.name.trim() || !quickCustForm.phone.trim()) return;
                  actions.saveCustomer({
                    name: quickCustForm.name.trim(),
                    phone: quickCustForm.phone.trim(),
                    email: '',
                    taxNumber: quickCustForm.taxNumber.trim() || undefined,
                    debt: 0,
                    status: 'active',
                  });
                  setInvForm((f) => ({
                    ...f,
                    customerId: '',
                    customerName: quickCustForm.name.trim(),
                    customerPhone: quickCustForm.phone.trim(),
                  }));
                  setQuickCustForm({ name: '', phone: '', taxNumber: '', city: '' });
                  setQuickCustOpen(false);
                }}
                className="flex-1 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {payModalInv && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-sm w-full p-6 space-y-3">
            <h3 className="text-base font-extrabold">{isAr ? `تحصيل دفعة · ${payModalInv.id}` : `Record Payment · ${payModalInv.id}`}</h3>
            <p className="text-xs text-slate-500">
              {payModalInv.customerName} · {isAr ? 'المتبقي:' : 'Remaining:'}{' '}
              {formatCurrency(payModalInv.remainingAmount ?? payModalInv.total, payModalInv.currency ?? cur, { isAr })}
            </p>
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={payAmountInput}
              onChange={(e) => setPayAmountInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono"
            />
            <select
              value={payBankId}
              onChange={(e) => setPayBankId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold"
            >
              {state.banks.map((b) => (
                <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
              ))}
            </select>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setPayModalInv(null)} className="flex-1 py-2.5 rounded-xl border text-xs font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  const ok = actions.recordInvoicePayment(payModalInv.id, parseFloat(payAmountInput) || 0, payBankId);
                  if (ok) {
                    setPayModalInv(null);
                    actions.notify(isAr ? 'تم تسجيل الدفعة وإصدار القيد والسند' : 'Partial payment recorded');
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-red-600">{t.confirmDelete}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t.confirmDeleteMsg}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] font-bold text-sm cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (confirmDelete.type === 'all') actions.deleteAllInvoices();
                  else if (confirmDelete.id) actions.deleteInvoice(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm cursor-pointer"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrInvoice && (() => {
        const tlvBase64 = buildZatcaTlvBase64(
          state.settings.companyName,
          state.settings.taxNumber,
          qrInvoice.date,
          qrInvoice.total.toFixed(2),
          qrInvoice.vat.toFixed(2),
          qrInvoice.invoiceHash || qrInvoice.ecdsaSignature
            ? { invoiceHash: qrInvoice.invoiceHash, ecdsaSignature: qrInvoice.ecdsaSignature }
            : undefined,
        );
        const zatcaCheck = validateZatcaPhase1(state.settings.companyName, state.settings.taxNumber);

        return (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold truncate">{t.zatcaQrTitle}</h3>
                  <p className="text-xs text-slate-500 font-mono truncate">
                    {qrInvoice.id} · {qrInvoice.customerName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQrInvoice(null)}
                  aria-label={t.cancel}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col items-center gap-2.5 py-2">
                <QrMatrix data={tlvBase64} size={200} />
                <div className="text-center space-y-0.5">
                  <p className="text-base font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-[#C9A227]">
                    {formatCurrency(qrInvoice.total, qrInvoice.currency ?? cur, { isAr })}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {t.vat}: {formatCurrency(qrInvoice.vat, qrInvoice.currency ?? cur, { isAr })}
                  </p>
                </div>
                {qrInvoice.zatcaUuid && (
                  <p className="text-[10px] font-mono bg-slate-100 dark:bg-[#0A120F] px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300">
                    Phase-2 UUID: {qrInvoice.zatcaUuid.slice(0, 18)}… {qrInvoice.icv ? `· ICV #${qrInvoice.icv}` : ''}
                  </p>
                )}
                <div className={`flex items-center gap-1.5 text-xs font-bold ${zatcaCheck.isCompliant ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {zatcaCheck.isCompliant ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>
                    {zatcaCheck.isCompliant
                      ? qrInvoice.invoiceHash
                        ? (isAr ? 'متوافق مع المرحلة الأولى والثانية ZATCA' : 'ZATCA Phase-1 & Phase-2 Compliant')
                        : (isAr ? 'متوافق مع المرحلة الأولى ZATCA' : 'ZATCA Phase-1 Compliant')
                      : isAr ? zatcaCheck.warningsAr[0] : zatcaCheck.warningsEn[0]}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!navigator.clipboard) return;
                    await navigator.clipboard.writeText(tlvBase64);
                    setCopiedQrTlv(true);
                    setTimeout(() => setCopiedQrTlv(false), 2000);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                >
                  {copiedQrTlv ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedQrTlv ? (isAr ? 'تم النسخ' : 'Copied') : t.copyTlvBase64}</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const dataUrl = await QRCode.toDataURL(tlvBase64, {
                      errorCorrectionLevel: 'M',
                      margin: 4,
                      width: 360,
                      color: { dark: '#000000', light: '#FFFFFF' },
                    });
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = `zatca_qr_${qrInvoice.id}.png`;
                    a.click();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.downloadQrPng}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const inv = qrInvoice;
                  setQrInvoice(null);
                  onPrintInvoice?.(inv);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{t.openPrintPreview}</span>
              </button>
            </div>
          </div>
        );
      })()}

      {voidModalInv && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-rose-600">
              {isAr ? `إلغاء فاتورة بقيد عكسي · ${voidModalInv.id}` : `Void & Reverse Invoice · ${voidModalInv.id}`}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {isAr
                ? 'سيتم عكس القيد المحاسبي وإرجاع المخزون وتسوية رصيد العميل مع الاحتفاظ بسجل التدقيق.'
                : 'This posts a reversing journal entry, restores inventory, and settles customer balance with full audit trail.'}
            </p>
            <input
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder={isAr ? 'سبب الإلغاء *' : 'Void reason *'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVoidModalInv(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] font-bold text-xs cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  const ok = actions.voidInvoice(voidModalInv.id, voidReason || (isAr ? 'إبطال فاتورة محاسبياً' : 'Accounting void'));
                  if (ok) {
                    actions.notify(isAr ? `تم إبطال الفاتورة ${voidModalInv.id} وتوليد القيد العكسي` : `Voided ${voidModalInv.id} with reversal journal`);
                    setVoidModalInv(null);
                  } else {
                    actions.notify(t.fiscalLockBlocked);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs cursor-pointer"
              >
                {isAr ? 'تأكيد الإبطال' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
