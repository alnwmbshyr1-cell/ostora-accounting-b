import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  Plus,
  Printer,
  Receipt,
  Scale,
  Trash2,
  X,
} from 'lucide-react';
import { strings } from '../data/translations';
import { computeInvoiceTotalsHalala, isDateFiscalLocked } from '../domain/accounting';
import { fromHalalas, mulFxHalalas, toHalalas } from '../domain/halala';
import { ErpStore } from '../screens/types';
import {
  CurrencyCode,
  ExpenseStatus,
  ExpenseType,
  Invoice,
  InvoiceStatus,
  JournalLine,
  LineItem,
  PaymentMethodType,
  TaxTreatment,
} from '../types/erp';
import { DEFAULT_ENABLED_CURRENCIES, formatCurrency, formatCurrencyNumber } from '../utils/currencies';
import { resolveEffectiveTaxRate } from '../utils/taxRegimes';

type QuickActionKind = 'invoice' | 'expense' | 'journal';

interface DashboardQuickActionsFabProps {
  store: ErpStore;
  onPrintInvoice?: (inv: Invoice) => void;
}

export const DashboardQuickActionsFab: React.FC<DashboardQuickActionsFabProps> = ({
  store,
  onPrintInvoice,
}) => {
  const { state, actions, hasPermission } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const canInvoice = hasPermission('invoices');
  const canExpense = hasPermission('expenses');
  const canJournal = hasPermission('journals');

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<QuickActionKind | null>(null);
  const [formError, setFormError] = useState('');

  const enabledCurrencies = useMemo(
    () =>
      Array.from(
        new Set<CurrencyCode>([cur, ...(state.settings.enabledCurrencies ?? DEFAULT_ENABLED_CURRENCIES)]),
      ),
    [cur, state.settings.enabledCurrencies],
  );
  const ratesMap = state.settings.exchangeRates ?? {};
  const todayStr = () => new Date().toISOString().slice(0, 10);

  // ---------------- Quick Invoice State ----------------
  const defaultSalesTaxRate = state.settings.defaultSalesTaxRate ?? 15;
  const [invForm, setInvForm] = useState({
    customerId: 'CASH',
    customerName: isAr ? 'عميل نقدي' : 'Walk-in Customer',
    customerPhone: '',
    date: todayStr(),
    status: 'paid' as InvoiceStatus,
    paymentMethod: 'cash' as PaymentMethodType,
    currency: cur as CurrencyCode,
    taxTreatment: (state.settings.taxTreatmentDefault ?? 'standard') as TaxTreatment,
    taxRate: String(defaultSalesTaxRate),
    paidAmount: '0',
    subtotalOverride: '',
    notes: '',
    branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
    warehouseId: state.settings.defaultWarehouseId ?? state.warehouses[0]?.id ?? '',
  });
  const [invItems, setInvItems] = useState<LineItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>(state.products[0]?.id ?? '');
  const [selectedProductQty, setSelectedProductQty] = useState('1');

  // ---------------- Quick Expense State ----------------
  const defaultPurchaseTaxRate = state.settings.defaultPurchaseTaxRate ?? 15;
  const [expForm, setExpForm] = useState({
    title: '',
    expenseType: 'other' as ExpenseType,
    beneficiary: '',
    amount: '',
    currency: cur as CurrencyCode,
    taxTreatment: 'standard' as TaxTreatment,
    taxRate: String(defaultPurchaseTaxRate),
    paymentMethod: 'cash' as PaymentMethodType,
    paidFromBankId: state.banks[0]?.id ?? 'cash',
    status: 'paid' as ExpenseStatus,
    date: todayStr(),
    branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
    costCenter: 'CC-MAIN',
    notes: '',
  });

  // ---------------- Quick Journal State ----------------
  const defaultDebitAccount = useMemo(() => {
    const acc = state.chartOfAccounts.find((a) => a.code === '1010') ?? state.chartOfAccounts[0];
    return acc ? `${acc.code} - ${isAr ? acc.nameAr : acc.nameEn}` : '1010 - النقدية والبنوك';
  }, [state.chartOfAccounts, isAr]);

  const defaultCreditAccount = useMemo(() => {
    const acc = state.chartOfAccounts.find((a) => a.code === '4010') ?? state.chartOfAccounts[1];
    return acc ? `${acc.code} - ${isAr ? acc.nameAr : acc.nameEn}` : '4010 - إيرادات المبيعات';
  }, [state.chartOfAccounts, isAr]);

  const [jrnForm, setJrnForm] = useState({
    date: todayStr(),
    reference: 'MANUAL',
    description: '',
    status: 'approved' as 'approved' | 'draft',
    branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
    costCenter: '',
  });
  const [jrnLines, setJrnLines] = useState<{ account: string; debit: string; credit: string; description: string }[]>([
    { account: defaultDebitAccount, debit: '', credit: '0', description: '' },
    { account: defaultCreditAccount, debit: '0', credit: '', description: '' },
  ]);

  const resetFormForKind = (kind: QuickActionKind) => {
    setFormError('');
    if (kind === 'invoice') {
      setInvForm({
        customerId: 'CASH',
        customerName: isAr ? 'عميل نقدي' : 'Walk-in Customer',
        customerPhone: '',
        date: todayStr(),
        status: 'paid',
        paymentMethod: 'cash',
        currency: cur,
        taxTreatment: state.settings.taxTreatmentDefault ?? 'standard',
        taxRate: String(state.settings.defaultSalesTaxRate ?? 15),
        paidAmount: '0',
        subtotalOverride: '',
        notes: '',
        branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
        warehouseId: state.settings.defaultWarehouseId ?? state.warehouses[0]?.id ?? '',
      });
      setInvItems([]);
      setSelectedProductId(state.products[0]?.id ?? '');
      setSelectedProductQty('1');
    } else if (kind === 'expense') {
      setExpForm({
        title: '',
        expenseType: 'other',
        beneficiary: '',
        amount: '',
        currency: cur,
        taxTreatment: 'standard',
        taxRate: String(state.settings.defaultPurchaseTaxRate ?? 15),
        paymentMethod: 'cash',
        paidFromBankId: state.banks[0]?.id ?? 'cash',
        status: 'paid',
        date: todayStr(),
        branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
        costCenter: 'CC-MAIN',
        notes: '',
      });
    } else {
      setJrnForm({
        date: todayStr(),
        reference: 'MANUAL',
        description: '',
        status: 'approved',
        branchId: state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
        costCenter: '',
      });
      setJrnLines([
        { account: defaultDebitAccount, debit: '', credit: '0', description: '' },
        { account: defaultCreditAccount, debit: '0', credit: '', description: '' },
      ]);
    }
  };

  const openQuickAction = (kind: QuickActionKind) => {
    setMenuOpen(false);
    resetFormForKind(kind);
    setActiveModal(kind);
  };

  // Close menu or modal on Escape
  useEffect(() => {
    if (!menuOpen && !activeModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeModal) setActiveModal(null);
        else setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, activeModal]);

  if (!canInvoice && !canExpense && !canJournal) {
    return null;
  }

  // ---------------- Invoice Calculations ----------------
  const invItemsSubtotal = fromHalalas(invItems.reduce((s, it) => s + toHalalas(it.total), 0));
  const invSubtotal = invItems.length > 0 ? invItemsSubtotal : Math.max(0, parseFloat(invForm.subtotalOverride) || 0);
  const invBaseTaxRate = Math.max(0, Math.min(100, parseFloat(invForm.taxRate) || 0));
  const invEffectiveTaxRate = resolveEffectiveTaxRate(invBaseTaxRate, invForm.taxTreatment);
  const invFxRate = invForm.currency === cur ? 1 : Math.max(0.0001, ratesMap[invForm.currency] ?? 1);
  const invCalc = computeInvoiceTotalsHalala({
    subtotal: invSubtotal,
    taxRate: invEffectiveTaxRate,
    fxRate: invFxRate,
    paidAmount: parseFloat(invForm.paidAmount) || 0,
    status: invForm.status,
  });
  const invCreditCheck = actions.checkCustomerCreditLimit(
    invForm.customerName,
    invForm.customerId,
    invCalc.baseTotal,
    invForm.status,
    undefined,
    invCalc.paidAmount,
  );

  // ---------------- Expense Calculations ----------------
  const expAmountNum = Math.max(0, parseFloat(expForm.amount) || 0);
  const expBaseTaxRate = Math.max(0, Math.min(100, parseFloat(expForm.taxRate) || 0));
  const expEffectiveTaxRate = resolveEffectiveTaxRate(expBaseTaxRate, expForm.taxTreatment);
  const expFxRate = expForm.currency === cur ? 1 : Math.max(0.0001, ratesMap[expForm.currency] ?? 1);
  const expAmtH = toHalalas(expAmountNum);
  const expBaseAmtH = expForm.currency === cur ? expAmtH : mulFxHalalas(expAmtH, expFxRate);
  const expVatH = expEffectiveTaxRate > 0 ? Math.round((expAmtH * expEffectiveTaxRate) / (100 + expEffectiveTaxRate)) : 0;
  const expNetH = Math.max(0, expAmtH - expVatH);

  const nextExpenseNumber = (() => {
    const nums = state.expenses
      .map((e) => {
        const m = (e.expenseNumber || e.id).match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => Number.isFinite(n));
    return `EXP-${new Date().getFullYear()}-${String(Math.max(900, ...nums) + 1).padStart(4, '0')}`;
  })();

  const expenseTypeLabel = (type: ExpenseType) => {
    switch (type) {
      case 'rent':
        return isAr ? 'إيجار' : 'Rent';
      case 'electricity':
        return isAr ? 'كهرباء ومرافق' : 'Electricity & Utilities';
      case 'salaries':
        return isAr ? 'رواتب وأجور' : 'Salaries & Payroll';
      case 'maintenance':
        return isAr ? 'صيانة وتشغيل' : 'Maintenance';
      case 'marketing':
        return isAr ? 'تسويق وإعلان' : 'Marketing';
      default:
        return isAr ? 'مصروفات عامة' : 'General Expense';
    }
  };

  // ---------------- Journal Calculations ----------------
  const jrnSumDebitH = jrnLines.reduce((s, l) => s + Math.max(0, toHalalas(parseFloat(l.debit) || 0)), 0);
  const jrnSumCreditH = jrnLines.reduce((s, l) => s + Math.max(0, toHalalas(parseFloat(l.credit) || 0)), 0);
  const jrnBalanced = jrnSumDebitH > 0 && jrnSumDebitH === jrnSumCreditH;

  // ---------------- Handlers ----------------
  const handleAddProductToQuickInvoice = () => {
    const pr = state.products.find((p) => p.id === selectedProductId);
    if (!pr) return;
    const qty = Math.max(0.01, parseFloat(selectedProductQty) || 1);
    const lineNet = fromHalalas(Math.round(toHalalas(pr.price) * qty));
    const lineTaxRate = pr.isTaxable === false ? 0 : invEffectiveTaxRate;
    const lineTaxAmt = fromHalalas(Math.round((toHalalas(lineNet) * lineTaxRate) / 100));

    setInvItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.productId === pr.id);
      if (existingIdx >= 0) {
        return prev.map((it, i) => {
          if (i !== existingIdx) return it;
          const nextQty = Number((it.qty + qty).toFixed(2));
          const nextNet = fromHalalas(Math.round(toHalalas(it.unitPrice) * nextQty));
          const nextTax = fromHalalas(Math.round((toHalalas(nextNet) * (it.taxRate ?? invEffectiveTaxRate)) / 100));
          return { ...it, qty: nextQty, total: nextNet, taxAmount: nextTax };
        });
      }
      return [
        ...prev,
        {
          productId: pr.id,
          productName: pr.name,
          qty,
          unit: pr.unit ?? 'piece',
          availableStock: pr.qty,
          unitPrice: pr.price,
          costPrice: pr.cost,
          wholesalePrice: pr.wholesalePrice,
          barcode: pr.barcode,
          taxRate: lineTaxRate,
          taxAmount: lineTaxAmt,
          total: lineNet,
        },
      ];
    });
    setSelectedProductQty('1');
  };

  const updateQuickInvoiceItem = (idx: number, qty: number, unitPrice: number) => {
    const cleanQty = Math.max(0.01, qty || 1);
    const cleanPrice = Math.max(0, unitPrice || 0);
    setInvItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const net = fromHalalas(Math.round(toHalalas(cleanPrice) * cleanQty));
        const rate = it.taxRate ?? invEffectiveTaxRate;
        const tax = fromHalalas(Math.round((toHalalas(net) * rate) / 100));
        return { ...it, qty: cleanQty, unitPrice: cleanPrice, total: net, taxAmount: tax };
      }),
    );
  };

  const handleSaveQuickInvoice = (andPrint: boolean) => {
    setFormError('');
    if (!invForm.customerName.trim()) {
      setFormError(isAr ? 'الرجاء إدخال اسم العميل *' : 'Customer name is required *');
      return;
    }
    if (!invForm.date) {
      setFormError(isAr ? 'تاريخ الفاتورة مطلوب *' : 'Invoice date is required *');
      return;
    }
    if (invSubtotal <= 0) {
      setFormError(
        isAr
          ? 'أضف صنفاً واحداً على الأقل أو أدخل مبلغاً فرعياً أكبر من 0 *'
          : 'Add at least one item or enter a subtotal greater than 0 *',
      );
      return;
    }
    if (invForm.status !== 'draft' && !invCreditCheck.allowed) {
      setFormError(
        `${t.creditLimitExceeded} (${t.exceededBy}: ${invCreditCheck.exceededBy.toFixed(2)} ${cur})`,
      );
      return;
    }

    const isoDate =
      invForm.date === todayStr()
        ? new Date().toISOString()
        : new Date(`${invForm.date}T12:00:00`).toISOString();
    const br = state.branches.find((b) => b.id === invForm.branchId);
    const wh = state.warehouses.find((w) => w.id === invForm.warehouseId);
    const autoDescription =
      invItems.length > 0
        ? invItems.map((it) => `${it.productName} ×${it.qty}`).join(' · ')
        : invForm.notes.trim() || (isAr ? 'فاتورة سريعة من لوحة التحكم' : 'Quick Dashboard Invoice');

    const payload: Omit<Invoice, 'id' | 'vat' | 'total'> = {
      customerId: invCreditCheck.customer?.id ?? invForm.customerId ?? 'CASH',
      customerName: invForm.customerName.trim(),
      customerPhone: invForm.customerPhone.trim(),
      description: autoDescription,
      items: invItems,
      subtotal: invSubtotal,
      discountTotal: 0,
      shippingFee: 0,
      extraFee: 0,
      paidAmount: invForm.status === 'draft' ? 0 : invCalc.paidAmount,
      remainingAmount: invForm.status === 'draft' ? 0 : invCalc.remainingAmount,
      taxRate: invEffectiveTaxRate,
      currency: invForm.currency,
      exchangeRate: invFxRate,
      baseTotal: invCalc.baseTotal,
      status: invForm.status,
      invoiceType: 'sales',
      invoiceDocKind: invForm.status === 'paid' ? 'simplified' : 'tax',
      branchId: br?.id,
      branchName: br ? (isAr ? br.nameAr : br.nameEn) : undefined,
      warehouseId: wh?.id,
      warehouseName: wh ? (isAr ? wh.nameAr : wh.nameEn) : undefined,
      salespersonName: state.currentRole,
      paymentMethod: invForm.paymentMethod,
      notes: invForm.notes.trim() || undefined,
      taxTreatment: invForm.taxTreatment,
      date: isoDate,
    };

    const result = actions.saveInvoice(payload);
    if (!result.ok) {
      setFormError(
        result.fiscalLocked
          ? t.fiscalLockBlocked
          : result.planLimitReached
          ? result.message || (isAr ? 'تم بلوغ حد الباقة' : 'Plan limit reached')
          : t.creditLimitExceeded,
      );
      return;
    }

    setActiveModal(null);
    if (result.lowStockItems && result.lowStockItems.length > 0) {
      actions.notify(
        isAr
          ? `تم حفظ الفاتورة · تنبيه مخزون منخفض: ${result.lowStockItems.join('، ')}`
          : `Invoice saved · Low stock alert: ${result.lowStockItems.join(', ')}`,
        4800,
      );
    } else {
      actions.notify(
        invForm.status === 'draft'
          ? isAr ? 'تم حفظ المسودة دون خصم مخزون أو قيد' : 'Draft saved'
          : isAr ? 'تم حفظ الفاتورة والقيد والمخزون' : 'Invoice, journal & stock updated',
      );
    }

    if (andPrint && onPrintInvoice) {
      onPrintInvoice({
        ...payload,
        id: result.invoiceId,
        vat: invCalc.vat,
        total: invCalc.total,
      });
    }
  };

  const handleSaveQuickExpense = () => {
    setFormError('');
    if (!expForm.title.trim()) {
      setFormError(isAr ? 'بيان المصروف إلزامي *' : 'Expense title is required *');
      return;
    }
    if (expAmountNum <= 0) {
      setFormError(isAr ? 'المبلغ إلزامي ويجب أن يكون أكبر من صفر *' : 'Amount must be greater than 0 *');
      return;
    }
    const isoDate =
      expForm.date === todayStr()
        ? new Date().toISOString()
        : new Date(`${expForm.date}T12:00:00`).toISOString();

    if (isDateFiscalLocked(isoDate, state.settings.fiscalLockDate)) {
      setFormError(t.fiscalLockBlocked);
      return;
    }

    actions.saveExpense({
      expenseNumber: nextExpenseNumber,
      title: expForm.title.trim(),
      category: expenseTypeLabel(expForm.expenseType),
      expenseType: expForm.expenseType,
      beneficiary: expForm.beneficiary.trim() || undefined,
      branchId: expForm.branchId || undefined,
      costCenter: expForm.costCenter.trim() || undefined,
      amount: expAmountNum,
      taxRate: expEffectiveTaxRate,
      taxTreatment: expForm.taxTreatment,
      currency: expForm.currency,
      exchangeRate: expFxRate,
      baseAmount: fromHalalas(expBaseAmtH),
      paymentMethod: expForm.paymentMethod,
      paidFromBankId: expForm.paidFromBankId || 'cash',
      status: expForm.status,
      date: isoDate,
      notes: expForm.notes.trim() || undefined,
    });

    setActiveModal(null);
    actions.notify(
      expForm.status === 'draft'
        ? isAr
          ? 'تم حفظ المصروف كمسودة دون خصم الرصيد'
          : 'Expense saved as draft'
        : isAr
        ? 'تم حفظ المصروف وترحيل القيد وتحديث الرصيد'
        : 'Expense saved, journal posted & account updated',
    );
  };

  const handleSaveQuickJournal = () => {
    setFormError('');
    if (!jrnForm.description.trim()) {
      setFormError(isAr ? 'وصف / بيان القيد إلزامي *' : 'Journal description is required *');
      return;
    }
    const isoDate =
      jrnForm.date === todayStr()
        ? new Date().toISOString()
        : new Date(`${jrnForm.date}T12:00:00`).toISOString();

    if (isDateFiscalLocked(isoDate, state.settings.fiscalLockDate)) {
      setFormError(t.fiscalLockBlocked);
      return;
    }

    const parsed: JournalLine[] = jrnLines
      .map((l) => ({
        account: l.account.trim(),
        debit: fromHalalas(Math.max(0, toHalalas(parseFloat(l.debit) || 0))),
        credit: fromHalalas(Math.max(0, toHalalas(parseFloat(l.credit) || 0))),
        ...(l.description.trim() ? { description: l.description.trim() } : {}),
      }))
      .filter((l) => l.account && (l.debit > 0 || l.credit > 0));

    const dH = parsed.reduce((s, l) => s + toHalalas(l.debit), 0);
    const cH = parsed.reduce((s, l) => s + toHalalas(l.credit), 0);
    if (parsed.length < 2 || dH <= 0 || dH !== cH) {
      setFormError(t.unbalancedError);
      return;
    }

    const res = actions.saveJournal({
      reference: jrnForm.reference.trim() || 'MANUAL',
      description: jrnForm.description.trim(),
      date: isoDate,
      entryType: 'manual',
      branchId: jrnForm.branchId || undefined,
      costCenter: jrnForm.costCenter.trim() || undefined,
      status: jrnForm.status,
      lines: parsed,
    });

    if (!res.ok) {
      setFormError(t.unbalancedError);
      return;
    }

    setActiveModal(null);
    actions.notify(isAr ? 'تم حفظ القيد المحاسبي' : 'Journal entry saved');
  };

  const quickMenuItems: {
    id: QuickActionKind;
    visible: boolean;
    label: string;
    subtitle: string;
    icon: React.FC<{ className?: string }>;
    accentClass: string;
  }[] = [
    {
      id: 'invoice',
      visible: canInvoice,
      label: isAr ? 'فاتورة جديدة' : 'New Invoice',
      subtitle: isAr ? 'تحديث فوري للمخزون والقيد' : 'Auto stock & journal entry',
      icon: FileText,
      accentClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    },
    {
      id: 'expense',
      visible: canExpense,
      label: isAr ? 'مصروف جديد' : 'New Expense',
      subtitle: isAr ? 'خصم مباشر من البنك أو الصندوق' : 'Debits bank/cash & posts VAT',
      icon: Receipt,
      accentClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    },
    {
      id: 'journal',
      visible: canJournal,
      label: isAr ? 'قيد يومية جديد' : 'New Journal Entry',
      subtitle: isAr ? 'قيد مزدوج متوازن بالهللة' : 'Balanced double-entry ledger',
      icon: BookOpen,
      accentClass: 'bg-[#0A3D2C]/12 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227]',
    },
  ];

  const visibleMenuItems = quickMenuItems.filter((item) => item.visible);

  return (
    <>
      {/* Backdrop when popover menu is open */}
      {menuOpen && (
        <div
          className="no-print fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-[1px]"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Floating Quick Actions Menu Button & Popover */}
      <div className="no-print fixed bottom-20 lg:bottom-6 end-4 sm:end-6 z-40 flex flex-col items-end gap-2.5">
        <div
          role="menu"
          aria-label={isAr ? 'إجراءات الإنشاء السريع' : 'Quick create actions'}
          className={`flex flex-col gap-2 w-64 origin-bottom-end transition-[opacity,transform] duration-150 ${
            menuOpen
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
              : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
          }`}
        >
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                tabIndex={menuOpen ? 0 : -1}
                onClick={() => openQuickAction(item.id)}
                className="w-full min-h-[52px] flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] hover:border-[#0A3D2C] dark:hover:border-[#C9A227] shadow-xl shadow-slate-950/12 dark:shadow-black/45 text-start cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
              >
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.accentClass}`}>
                  <Icon className="w-4.5 h-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {item.label}
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {item.subtitle}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={isAr ? 'إجراءات سريعة' : 'Quick Actions'}
          onClick={() => setMenuOpen((prev) => !prev)}
          className="h-12 min-w-[48px] px-4 rounded-2xl bg-[#0A3D2C] hover:bg-[#083022] text-white border border-[#C9A227]/45 shadow-lg shadow-[#0A3D2C]/30 dark:shadow-black/50 flex items-center gap-2 font-extrabold text-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0A120F]"
        >
          <span
            className={`w-6 h-6 rounded-lg bg-[#C9A227] text-slate-950 flex items-center justify-center transition-transform duration-150 ${
              menuOpen ? 'rotate-45' : 'rotate-0'
            }`}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </span>
          <span>{isAr ? 'إجراءات سريعة' : 'Quick Actions'}</span>
        </button>
      </div>

      {/* In-Place Quick Create Modal */}
      {activeModal && (
        <div
          className="no-print fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-action-modal-title"
            className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
          >
            {/* Modal Header & Quick Switcher */}
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#121E19]/95 backdrop-blur-xs border-b border-slate-200 dark:border-[#1F332B] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0A3D2C] text-[#C9A227] flex items-center justify-center shrink-0">
                  {activeModal === 'invoice' ? (
                    <FileText className="w-4.5 h-4.5" />
                  ) : activeModal === 'expense' ? (
                    <Receipt className="w-4.5 h-4.5" />
                  ) : (
                    <BookOpen className="w-4.5 h-4.5" />
                  )}
                </div>
                <div>
                  <h2 id="quick-action-modal-title" className="text-base font-extrabold">
                    {activeModal === 'invoice'
                      ? isAr ? 'إنشاء فاتورة سريعة' : 'Quick New Invoice'
                      : activeModal === 'expense'
                      ? isAr ? 'تسجيل مصروف سريع' : 'Quick New Expense'
                      : isAr ? 'إنشاء قيد يومية سريع' : 'Quick Journal Entry'}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {isAr ? 'حفظ وترحيل محاسبي مباشر من لوحة التحكم' : 'Direct posting without leaving the dashboard'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {visibleMenuItems.length > 1 && (
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B]">
                    {visibleMenuItems.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          resetFormForKind(tab.id);
                          setActiveModal(tab.id);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          activeModal === tab.id
                            ? 'bg-[#0A3D2C] text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#121E19]'
                        }`}
                      >
                        {tab.id === 'invoice'
                          ? isAr ? 'فاتورة' : 'Invoice'
                          : tab.id === 'expense'
                          ? isAr ? 'مصروف' : 'Expense'
                          : isAr ? 'قيد' : 'Journal'}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                  onClick={() => setActiveModal(null)}
                  className="w-9 h-9 rounded-xl border border-slate-200 dark:border-[#1F332B] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* ==================== QUICK INVOICE FORM ==================== */}
              {activeModal === 'invoice' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        {isAr ? 'اختيار عميل' : 'Select Customer'}
                      </label>
                      <select
                        value={invForm.customerId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          if (cid === 'CASH') {
                            setInvForm((f) => ({
                              ...f,
                              customerId: 'CASH',
                              customerName: isAr ? 'عميل نقدي' : 'Walk-in Customer',
                              customerPhone: '',
                            }));
                            return;
                          }
                          const found = state.customers.find((c) => c.id === cid);
                          setInvForm((f) => ({
                            ...f,
                            customerId: cid,
                            customerName: found?.name ?? f.customerName,
                            customerPhone: found?.phone ?? '',
                          }));
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      >
                        <option value="CASH">{isAr ? 'عميل نقدي مباشر (CASH)' : 'Walk-in Cash Customer'}</option>
                        {state.customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        {t.customerName} *
                      </label>
                      <input
                        type="text"
                        value={invForm.customerName}
                        onChange={(e) => setInvForm({ ...invForm, customerName: e.target.value })}
                        placeholder={t.customerName}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* Quick Product Picker */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] space-y-2.5">
                    <p className="text-xs font-extrabold text-[#0A3D2C] dark:text-[#C9A227]">
                      {isAr ? 'أصناف الفاتورة (اختياري — أو أدخل المبلغ مباشرة)' : 'Line Items (Optional — or enter subtotal directly)'}
                    </p>
                    {state.products.length > 0 ? (
                      <div className="flex flex-wrap sm:flex-nowrap gap-2">
                        <select
                          value={selectedProductId}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                          className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                        >
                          {state.products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {formatCurrencyNumber(p.price, cur)} ({isAr ? 'متاح:' : 'Stock:'} {p.qty})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0.01}
                          step="1"
                          value={selectedProductQty}
                          onChange={(e) => setSelectedProductQty(e.target.value)}
                          aria-label={t.qty}
                          className="w-20 px-2.5 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-mono font-bold text-center tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={handleAddProductToQuickInvoice}
                          className="px-3.5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isAr ? 'إضافة صنف' : 'Add Item'}</span>
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        {isAr ? 'لا توجد أصناف مسجلة بعد — يمكنك إدخال المبلغ الفرعي أدناه.' : 'No inventory products yet — enter subtotal below.'}
                      </p>
                    )}

                    {invItems.length > 0 && (
                      <div className="divide-y divide-slate-200 dark:divide-[#1F332B] bg-white dark:bg-[#121E19] rounded-xl border border-slate-200 dark:border-[#1F332B]">
                        {invItems.map((it, idx) => (
                          <div key={`${it.productId}-${idx}`} className="p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-bold min-w-[120px] flex-1 truncate">{it.productName}</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0.01}
                                step="1"
                                value={it.qty}
                                onChange={(e) => updateQuickInvoiceItem(idx, parseFloat(e.target.value), it.unitPrice)}
                                aria-label={t.qty}
                                className="w-16 px-2 py-1 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] font-mono text-center tabular-nums"
                              />
                              <span className="text-slate-400">×</span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={it.unitPrice}
                                onChange={(e) => updateQuickInvoiceItem(idx, it.qty, parseFloat(e.target.value))}
                                aria-label={t.price}
                                className="w-24 px-2 py-1 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] font-mono tabular-nums"
                              />
                              <span className="font-mono font-extrabold tabular-nums min-w-[72px] text-end">
                                {formatCurrencyNumber(it.total, invForm.currency)}
                              </span>
                              <button
                                type="button"
                                aria-label={isAr ? 'حذف الصنف' : 'Remove item'}
                                onClick={() => setInvItems((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        {t.subtotal} *
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={invItems.length > 0}
                        value={invItems.length > 0 ? invItemsSubtotal.toFixed(2) : invForm.subtotalOverride}
                        onChange={(e) => setInvForm({ ...invForm, subtotalOverride: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono font-bold tabular-nums disabled:opacity-75"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.status}</label>
                      <select
                        value={invForm.status}
                        onChange={(e) => setInvForm({ ...invForm, status: e.target.value as InvoiceStatus })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      >
                        <option value="paid">{t.paid}</option>
                        <option value="pending">{t.pending}</option>
                        <option value="partial">{t.partial}</option>
                        <option value="draft">{t.draft}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.paymentMethod}</label>
                      <select
                        value={invForm.paymentMethod}
                        onChange={(e) => setInvForm({ ...invForm, paymentMethod: e.target.value as PaymentMethodType })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      >
                        <option value="cash">{isAr ? 'نقدي' : 'Cash'}</option>
                        <option value="pos_card">{isAr ? 'شبكة / بطاقة' : 'POS Card'}</option>
                        <option value="transfer">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                        <option value="credit">{isAr ? 'آجل' : 'Credit'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.date}</label>
                      <input
                        type="date"
                        value={invForm.date}
                        onChange={(e) => setInvForm({ ...invForm, date: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.currency}</label>
                      <select
                        value={invForm.currency}
                        onChange={(e) => setInvForm({ ...invForm, currency: e.target.value as CurrencyCode })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      >
                        {enabledCurrencies.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        {isAr ? 'المعاملة الضريبية' : 'Tax Treatment'}
                      </label>
                      <select
                        value={invForm.taxTreatment}
                        onChange={(e) => setInvForm({ ...invForm, taxTreatment: e.target.value as TaxTreatment })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      >
                        <option value="standard">{isAr ? `خاضع (${invForm.taxRate}%)` : `Standard (${invForm.taxRate}%)`}</option>
                        <option value="zero">{isAr ? 'صفري (0%)' : 'Zero-rated (0%)'}</option>
                        <option value="exempt">{isAr ? 'معفى' : 'Exempt'}</option>
                      </select>
                    </div>
                    {invForm.status === 'partial' ? (
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">
                          {isAr ? 'الدفعة المستلمة' : 'Paid Amount'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={invForm.paidAmount}
                          onChange={(e) => setInvForm({ ...invForm, paidAmount: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.notes}</label>
                        <input
                          type="text"
                          value={invForm.notes}
                          onChange={(e) => setInvForm({ ...invForm, notes: e.target.value })}
                          placeholder={isAr ? 'ملاحظات اختيارية' : 'Optional note'}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {invForm.status !== 'draft' && !invCreditCheck.allowed && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        {t.creditLimitExceeded} ({t.exceededBy}: {formatCurrency(invCreditCheck.exceededBy, cur, { isAr })})
                      </span>
                    </div>
                  )}

                  {/* Invoice Live Summary */}
                  <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#0A120F] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap gap-4 font-mono tabular-nums">
                      <span>
                        {t.subtotal}: <strong>{formatCurrency(invCalc.subtotal, invForm.currency, { isAr })}</strong>
                      </span>
                      <span>
                        {t.vat} ({invEffectiveTaxRate}%): <strong>{formatCurrency(invCalc.vat, invForm.currency, { isAr })}</strong>
                      </span>
                    </div>
                    <div className="font-mono font-extrabold text-sm tabular-nums text-[#0A3D2C] dark:text-[#C9A227]">
                      {t.total}: {formatCurrency(invCalc.total, invForm.currency, { isAr })}
                      {invForm.currency !== cur && (
                        <span className="ms-2 text-[11px] text-slate-500">
                          (≈ {formatCurrency(invCalc.baseTotal, cur, { isAr })})
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ==================== QUICK EXPENSE FORM ==================== */}
              {activeModal === 'expense' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        {t.expenseTitle} *
                      </label>
                      <input
                        type="text"
                        value={expForm.title}
                        onChange={(e) => setExpForm({ ...expForm, title: e.target.value })}
                        placeholder={isAr ? 'مثال: فواتير كهرباء، صيانة، إيجار...' : 'e.g. Office utilities, maintenance...'}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        {isAr ? 'تصنيف المصروف' : 'Expense Type'}
                      </label>
                      <select
                        value={expForm.expenseType}
                        onChange={(e) => setExpForm({ ...expForm, expenseType: e.target.value as ExpenseType })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      >
                        <option value="other">{isAr ? 'مصروفات عامة' : 'General Expense'}</option>
                        <option value="rent">{isAr ? 'إيجار' : 'Rent'}</option>
                        <option value="electricity">{isAr ? 'كهرباء ومرافق' : 'Electricity & Utilities'}</option>
                        <option value="salaries">{isAr ? 'رواتب وأجور' : 'Salaries'}</option>
                        <option value="maintenance">{isAr ? 'صيانة' : 'Maintenance'}</option>
                        <option value="marketing">{isAr ? 'تسويق' : 'Marketing'}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        {t.amount} *
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={expForm.amount}
                        onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono font-bold tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.currency}</label>
                      <select
                        value={expForm.currency}
                        onChange={(e) => setExpForm({ ...expForm, currency: e.target.value as CurrencyCode })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      >
                        {enabledCurrencies.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        {isAr ? 'الضريبة' : 'VAT Treatment'}
                      </label>
                      <select
                        value={expForm.taxTreatment}
                        onChange={(e) => setExpForm({ ...expForm, taxTreatment: e.target.value as TaxTreatment })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      >
                        <option value="standard">{isAr ? `شامل (${expForm.taxRate}%)` : `Standard (${expForm.taxRate}%)`}</option>
                        <option value="zero">{isAr ? 'صفري (0%)' : 'Zero (0%)'}</option>
                        <option value="exempt">{isAr ? 'معفى' : 'Exempt'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.date}</label>
                      <input
                        type="date"
                        value={expForm.date}
                        onChange={(e) => setExpForm({ ...expForm, date: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.paidFrom}</label>
                      <select
                        value={expForm.paidFromBankId}
                        onChange={(e) => setExpForm({ ...expForm, paidFromBankId: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      >
                        {state.banks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {isAr ? b.nameAr : b.nameEn} ({formatCurrencyNumber(b.balance, cur)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.paymentMethod}</label>
                      <select
                        value={expForm.paymentMethod}
                        onChange={(e) => setExpForm({ ...expForm, paymentMethod: e.target.value as PaymentMethodType })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      >
                        <option value="cash">{isAr ? 'نقدي' : 'Cash'}</option>
                        <option value="pos_card">{isAr ? 'بطاقة / شبكة' : 'Card / POS'}</option>
                        <option value="transfer">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                        <option value="cheque">{isAr ? 'شيك' : 'Cheque'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.status}</label>
                      <select
                        value={expForm.status}
                        onChange={(e) => setExpForm({ ...expForm, status: e.target.value as ExpenseStatus })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      >
                        <option value="paid">{isAr ? 'مدفوع' : 'Paid'}</option>
                        <option value="approved">{isAr ? 'معتمد' : 'Approved'}</option>
                        <option value="draft">{t.draft}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        {isAr ? 'المستفيد (اختياري)' : 'Beneficiary (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={expForm.beneficiary}
                        onChange={(e) => setExpForm({ ...expForm, beneficiary: e.target.value })}
                        placeholder={isAr ? 'اسم المورد أو الجهة' : 'Payee name'}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.notes}</label>
                      <input
                        type="text"
                        value={expForm.notes}
                        onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })}
                        placeholder={isAr ? 'ملاحظات إضافية' : 'Optional notes'}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                      />
                    </div>
                  </div>

                  {/* Expense Live Summary */}
                  <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#0A120F] flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
                    <div className="flex flex-wrap gap-4">
                      <span>
                        {isAr ? 'صافي المصروف:' : 'Net:'}{' '}
                        <strong>{formatCurrency(fromHalalas(expNetH), expForm.currency, { isAr })}</strong>
                      </span>
                      <span>
                        {isAr ? 'ضريبة المدخلات:' : 'Input VAT:'}{' '}
                        <strong>{formatCurrency(fromHalalas(expVatH), expForm.currency, { isAr })}</strong>
                      </span>
                    </div>
                    <div className="font-extrabold text-sm text-[#0A3D2C] dark:text-[#C9A227]">
                      {t.total}: {formatCurrency(fromHalalas(expAmtH), expForm.currency, { isAr })}
                      {expForm.currency !== cur && (
                        <span className="ms-2 text-[11px] text-slate-500">
                          (≈ {formatCurrency(fromHalalas(expBaseAmtH), cur, { isAr })})
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ==================== QUICK JOURNAL ENTRY FORM ==================== */}
              {activeModal === 'journal' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.date}</label>
                      <input
                        type="date"
                        value={jrnForm.date}
                        onChange={(e) => setJrnForm({ ...jrnForm, date: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        {isAr ? 'المرجع' : 'Reference'}
                      </label>
                      <input
                        type="text"
                        value={jrnForm.reference}
                        onChange={(e) => setJrnForm({ ...jrnForm, reference: e.target.value })}
                        placeholder="MANUAL"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.status}</label>
                      <select
                        value={jrnForm.status}
                        onChange={(e) => setJrnForm({ ...jrnForm, status: e.target.value as 'approved' | 'draft' })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                      >
                        <option value="approved">{isAr ? 'معتمد (ترحيل)' : 'Approved'}</option>
                        <option value="draft">{t.draft}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      {isAr ? 'بيان / وصف القيد *' : 'Journal Description *'}
                    </label>
                    <input
                      type="text"
                      value={jrnForm.description}
                      onChange={(e) => setJrnForm({ ...jrnForm, description: e.target.value })}
                      placeholder={isAr ? 'مثال: إثبات تسوية عهدة أو تحويل داخلي' : 'e.g. Petty cash replenishment'}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                    />
                  </div>

                  <datalist id="quick-journal-accounts">
                    {state.chartOfAccounts.map((acc) => (
                      <option key={acc.id} value={`${acc.code} - ${isAr ? acc.nameAr : acc.nameEn}`} />
                    ))}
                  </datalist>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">{isAr ? 'أطراف القيد المحاسبي' : 'Journal Lines'}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setJrnLines((prev) => [...prev, { account: '', debit: '0', credit: '0', description: '' }])
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAr ? 'سطر جديد' : 'Add Line'}</span>
                      </button>
                    </div>

                    {jrnLines.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                        <input
                          type="text"
                          list="quick-journal-accounts"
                          value={line.account}
                          onChange={(e) => {
                            const next = [...jrnLines];
                            next[idx] = { ...next[idx], account: e.target.value };
                            setJrnLines(next);
                          }}
                          placeholder={t.account}
                          className="col-span-5 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.debit}
                          onChange={(e) => {
                            const next = [...jrnLines];
                            next[idx] = { ...next[idx], debit: e.target.value };
                            setJrnLines(next);
                          }}
                          placeholder={t.debit}
                          aria-label={t.debit}
                          className="col-span-3 px-2 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.credit}
                          onChange={(e) => {
                            const next = [...jrnLines];
                            next[idx] = { ...next[idx], credit: e.target.value };
                            setJrnLines(next);
                          }}
                          placeholder={t.credit}
                          aria-label={t.credit}
                          className="col-span-3 px-2 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                        />
                        <button
                          type="button"
                          disabled={jrnLines.length <= 2}
                          aria-label={isAr ? 'حذف السطر' : 'Remove line'}
                          onClick={() => setJrnLines((prev) => prev.filter((_, i) => i !== idx))}
                          className="col-span-1 p-1.5 text-red-500 disabled:opacity-30 cursor-pointer flex items-center justify-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Balance Summary + Auto-Balance */}
                  <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#0A120F] flex flex-wrap items-center justify-between gap-2 text-xs font-mono font-bold tabular-nums">
                    <span>
                      {t.debit}: {formatCurrencyNumber(fromHalalas(jrnSumDebitH), cur)} · {t.credit}:{' '}
                      {formatCurrencyNumber(fromHalalas(jrnSumCreditH), cur)} · {isAr ? 'الفرق:' : 'Diff:'}{' '}
                      {formatCurrency(fromHalalas(Math.abs(jrnSumDebitH - jrnSumCreditH)), cur, { isAr })}
                    </span>
                    <div className="flex items-center gap-2">
                      {!jrnBalanced && (jrnSumDebitH > 0 || jrnSumCreditH > 0) && jrnLines.length >= 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...jrnLines];
                            const lastIdx = next.length - 1;
                            const otherDebitH = next
                              .slice(0, lastIdx)
                              .reduce((s, l) => s + Math.max(0, toHalalas(parseFloat(l.debit) || 0)), 0);
                            const otherCreditH = next
                              .slice(0, lastIdx)
                              .reduce((s, l) => s + Math.max(0, toHalalas(parseFloat(l.credit) || 0)), 0);
                            if (otherDebitH > otherCreditH) {
                              next[lastIdx] = {
                                ...next[lastIdx],
                                debit: '0',
                                credit: String(fromHalalas(otherDebitH - otherCreditH)),
                              };
                            } else if (otherCreditH > otherDebitH) {
                              next[lastIdx] = {
                                ...next[lastIdx],
                                debit: String(fromHalalas(otherCreditH - otherDebitH)),
                                credit: '0',
                              };
                            }
                            setJrnLines(next);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#C9A227] text-slate-950 font-sans text-[11px] font-extrabold cursor-pointer"
                        >
                          <Scale className="w-3 h-3" />
                          <span>{isAr ? 'موازنة تلقائية' : 'Auto-Balance'}</span>
                        </button>
                      )}
                      <span className={`inline-flex items-center gap-1 ${jrnBalanced ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {jrnBalanced && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {jrnBalanced ? (isAr ? 'متوازن' : 'Balanced') : isAr ? 'غير متوازن' : 'Unbalanced'}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {formError && (
                <p className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {formError}
                </p>
              )}

              {/* Modal Footer Buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-[#1F332B]">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 min-w-[100px] py-2.5 px-4 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-[#0A120F]"
                >
                  {t.cancel}
                </button>

                {activeModal === 'invoice' && onPrintInvoice && (
                  <button
                    type="button"
                    onClick={() => handleSaveQuickInvoice(true)}
                    className="flex-1 min-w-[140px] py-2.5 px-4 rounded-xl bg-[#C9A227] text-slate-950 text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer hover:brightness-95"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{isAr ? 'حفظ وطباعة' : 'Save & Print'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (activeModal === 'invoice') handleSaveQuickInvoice(false);
                    else if (activeModal === 'expense') handleSaveQuickExpense();
                    else handleSaveQuickJournal();
                  }}
                  className="flex-1 min-w-[120px] py-2.5 px-4 rounded-xl bg-[#0A3D2C] text-white text-sm font-extrabold cursor-pointer hover:bg-[#083022]"
                >
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
