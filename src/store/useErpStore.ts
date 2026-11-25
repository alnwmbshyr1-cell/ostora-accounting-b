import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_ROUTES, DEFAULT_PERMISSIONS_MATRIX } from '../constants/permissions';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  buildDoubleEntryForInvoice,
  computeBankReconciliationDiff,
  computeInvoiceTotalsHalala,
  DEFAULT_CHART_OF_ACCOUNTS,
  isDateFiscalLocked,
} from '../domain/accounting';
import {
  fromHalalas,
  mulFxHalalas,
  toHalalas,
} from '../domain/halala';
import { dispatchSmartNotification } from '../services/firebaseExtras';
import {
  fetchCloudBackupSnapshotJson,
  listCloudBackupSnapshots,
  loadOrSeedWorkspace,
  pushFullStateToCloud,
  saveCloudBackupSnapshot,
  subscribeWorkspace,
  syncStateDiffToFirestore,
} from '../services/firebaseSync';
import {
  DailyBackupMeta,
  DailyBackupRecord,
  getDailySnapshot,
  getLatestDailySnapshot,
  getLocalDateKey,
  listDailySnapshotMeta,
  saveDailySnapshot,
} from '../utils/backupDb';
import { generateEan13 } from '../utils/barcode';
import {
  ALL_CURRENCY_CODES,
  buildDefaultRatesForBase,
  DEFAULT_ENABLED_CURRENCIES,
  fetchLiveExchangeRates,
} from '../utils/currencies';
import {
  ArchivedDocument,
  AuditLogEntry,
  BankAccount,
  Branch,
  ChartAccount,
  CloudBackupMeta,
  CompanySettings,
  CurrencyCode,
  Customer,
  Employee,
  Expense,
  Invoice,
  JournalEntry,
  PermissionsMatrix,
  PersistedState,
  Product,
  PurchaseOrder,
  Quotation,
  RecurringFrequency,
  RecurringInvoice,
  ReturnRecord,
  RoleId,
  RouteId,
  SmartAlert,
  StockMovement,
  StocktakeRecord,
  Supplier,
  Voucher,
  Warehouse,
} from '../types/erp';

export type { PersistedState } from '../types/erp';

const STORAGE_KEY = 'ostora_accounting_erp_state_v1';
export const AUTOSAVE_KEY = 'ostora_autosave';

function nextSequentialId(prefix: string, startBase: number, existingIds: string[]): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let maxNum = startBase;
  for (const id of existingIds) {
    const m = re.exec(id);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  return `${prefix}-${maxNum + 1}`;
}

function makeAuditEntry(
  p: PersistedState,
  actorName: string,
  action: AuditLogEntry['action'],
  entity: string,
  entityId: string,
  summary: string,
): AuditLogEntry {
  return {
    id: `AUD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    actor: actorName || p.currentRole,
    actorRole: p.currentRole,
    action,
    entity,
    entityId,
    summary,
    timestamp: new Date().toISOString(),
  };
}

function advanceScheduleDate(dateStr: string, frequency: RecurringFrequency): string {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? new Date(`${dateStr}T00:00:00`)
    : new Date();
  if (Number.isNaN(base.getTime())) {
    return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  }
  const d = new Date(base.getTime());
  if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (frequency === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  } else if (frequency === 'quarterly') {
    d.setMonth(d.getMonth() + 3);
  } else {
    d.setFullYear(d.getFullYear() + 1);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function runDueRecurringInState(
  p: PersistedState,
  todayKey: string,
): { nextState: PersistedState; generated: number; skipped: number } {
  const dueTemplates = p.recurringInvoices.filter(
    (r) => r.active && r.autoGenerate && r.nextRunDate <= todayKey,
  );
  if (dueTemplates.length === 0) {
    return { nextState: p, generated: 0, skipped: 0 };
  }

  let invoices = [...p.invoices];
  let customers = [...p.customers];
  let products = [...p.products];
  let banks = [...p.banks];
  let journals = [...p.journals];
  let stockMovements = [...(p.stockMovements ?? [])];
  const updatedRecMap = new Map<string, RecurringInvoice>();
  const nowIso = new Date().toISOString();
  let generated = 0;
  let skipped = 0;

  for (const tpl of dueTemplates) {
    const curRate = Math.max(0, Math.min(100, tpl.taxRate ?? p.settings.defaultSalesTaxRate ?? 15));
    const curInvCurrency = tpl.currency ?? p.settings.currency;
    const curFxRate =
      curInvCurrency === p.settings.currency
        ? 1
        : Math.max(0.0001, p.settings.exchangeRates?.[curInvCurrency] ?? 1);
    const calc = computeInvoiceTotalsHalala({
      subtotal: tpl.subtotal,
      taxRate: curRate,
      fxRate: curFxRate,
      status: tpl.targetStatus,
    });

    const targetCustomer = customers.find(
      (c) =>
        (tpl.customerId && c.id === tpl.customerId) ||
        c.name.trim() === tpl.customerName.trim(),
    );

    if (
      tpl.targetStatus !== 'paid' &&
      targetCustomer &&
      typeof targetCustomer.creditLimit === 'number' &&
      Number.isFinite(targetCustomer.creditLimit) &&
      fromHalalas(toHalalas(targetCustomer.debt) + toHalalas(calc.remainingAmount)) > targetCustomer.creditLimit
    ) {
      skipped += 1;
      continue;
    }

    const newInvId = nextSequentialId('INV', 1000, invoices.map((x) => x.id));
    const newInv: Invoice = {
      id: newInvId,
      customerId: targetCustomer?.id ?? tpl.customerId,
      customerName: tpl.customerName,
      customerPhone: tpl.customerPhone,
      description:
        tpl.description || `${p.settings.isArabic ? 'فاتورة متكررة' : 'Recurring'} (${tpl.id})`,
      items: tpl.items ?? [],
      subtotal: calc.subtotal,
      taxRate: curRate,
      vat: calc.vat,
      total: calc.total,
      currency: curInvCurrency,
      exchangeRate: curFxRate,
      baseTotal: calc.baseTotal,
      paidAmount: calc.paidAmount,
      remainingAmount: calc.remainingAmount,
      status: tpl.targetStatus,
      date: nowIso,
      invoiceType: 'sales',
      branchId: p.settings.defaultBranchId ?? p.branches[0]?.id,
      warehouseId: p.settings.defaultWarehouseId ?? p.warehouses[0]?.id,
    };
    invoices = [newInv, ...invoices];

    if (calc.remainingAmount > 0) {
      customers = customers.map((c) =>
        (targetCustomer && c.id === targetCustomer.id) ||
        c.name.trim() === tpl.customerName.trim()
          ? { ...c, debt: fromHalalas(toHalalas(c.debt) + toHalalas(calc.remainingAmount)) }
          : c,
      );
    }

    if (tpl.items?.length) {
      products = products.map((pr) => {
        const sold = tpl.items.find(
          (it) => it.productId === pr.id || it.productName === pr.name,
        );
        if (sold) {
          stockMovements = [
            {
              id: nextSequentialId('MOV', 100, stockMovements.map((m) => m.id)),
              productId: pr.id,
              productName: pr.name,
              movementType: 'sale',
              qtyDelta: -sold.qty,
              referenceId: newInvId,
              notes: `Recurring ${tpl.id}`,
              date: nowIso,
            },
            ...stockMovements,
          ];
          return { ...pr, qty: Math.max(0, pr.qty - sold.qty) };
        }
        return pr;
      });
    }

    const targetBank =
      banks.find((b) => b.id === 'alrajhi') ??
      banks.find((b) => b.id === 'cash') ??
      banks[0];
    if (calc.paidAmount > 0 && targetBank) {
      banks = banks.map((b) =>
        b.id === targetBank.id
          ? { ...b, balance: fromHalalas(toHalalas(b.balance) + toHalalas(calc.paidAmount)) }
          : b,
      );
    }

    const bankLabel = targetBank ? (p.settings.isArabic ? targetBank.nameAr : targetBank.nameEn) : 'Cash';
    const lines = buildDoubleEntryForInvoice({
      customerName: tpl.customerName,
      bankLabel,
      baseTotal: calc.baseTotal,
      baseSubtotal: calc.baseSubtotal,
      baseVat: calc.baseVat,
      paidAmountBase: calc.paidAmount,
      remainingAmountBase: calc.remainingAmount,
      status: tpl.targetStatus,
    });
    if (lines.length > 0) {
      const autoJournal: JournalEntry = {
        id: nextSequentialId('JRN', 700, journals.map((x) => x.id)),
        reference: newInvId,
        description: p.settings.isArabic
          ? `فاتورة متكررة ${newInvId} (${tpl.id}) - ${tpl.customerName}`
          : `Recurring Invoice ${newInvId} (${tpl.id}) - ${tpl.customerName}`,
        date: nowIso,
        lines,
      };
      journals = [autoJournal, ...journals];
    }

    updatedRecMap.set(tpl.id, {
      ...tpl,
      nextRunDate: advanceScheduleDate(tpl.nextRunDate, tpl.frequency),
      lastGeneratedDate: nowIso.slice(0, 10),
      generatedCount: (tpl.generatedCount ?? 0) + 1,
    });
    generated += 1;
  }

  if (generated === 0) {
    return { nextState: p, generated: 0, skipped };
  }

  const recurringInvoices = p.recurringInvoices.map((r) => updatedRecMap.get(r.id) ?? r);
  return {
    nextState: {
      ...p,
      invoices,
      recurringInvoices,
      customers,
      products,
      banks,
      journals,
      stockMovements,
    },
    generated,
    skipped,
  };
}

function createDemoState(prevSettings?: CompanySettings): PersistedState {
  const now = Date.now();
  const isoDaysAgo = (d: number) => new Date(now - d * 86400000).toISOString();
  const isoDaysAhead = (d: number) => new Date(now + d * 86400000).toISOString().slice(0, 10);

  return {
    onboardingSeen: true,
    isLoggedIn: true,
    currentRole: 'owner',
    activePlan: 'trial',
    trialStartIso: new Date().toISOString(),
    permissionsMatrix: structuredClone(DEFAULT_PERMISSIONS_MATRIX),
    settings: prevSettings ?? {
      companyName: 'مؤسسة الأسطورة للتجارة والمقاولات',
      taxNumber: '310482910400003',
      crNumber: '1010592831',
      phone: '0501234567',
      email: 'finance@ostora.systems',
      address: 'الرياض، حي العليا، المملكة العربية السعودية',
      currency: 'SAR',
      enabledCurrencies: [...DEFAULT_ENABLED_CURRENCIES],
      exchangeRates: buildDefaultRatesForBase('SAR'),
      isArabic: true,
      isDarkMode: false,
      monthlySalesGoal: 120000,
      defaultSalesTaxRate: 15,
      defaultPurchaseTaxRate: 15,
      autoBackupDaily: true,
      lastBackupDate: undefined,
      autoCloudSync: true,
      autoSyncIntervalMinutes: 0,
      defaultBranchId: 'BR-1',
      defaultWarehouseId: 'WH-1',
    },
    branches: [
      { id: 'BR-1', nameAr: 'الفرع الرئيسي - الرياض', nameEn: 'Main Branch - Riyadh', city: 'الرياض', phone: '0501234567', managerName: 'سارة القحطاني', isMain: true, active: true },
      { id: 'BR-2', nameAr: 'فرع جدة', nameEn: 'Jeddah Branch', city: 'جدة', phone: '0508877665', managerName: 'خالد العتيبي', isMain: false, active: true },
    ],
    warehouses: [
      { id: 'WH-1', nameAr: 'المستودع المركزي - الرياض', nameEn: 'Central Warehouse - Riyadh', branchId: 'BR-1', location: 'المنطقة الصناعية الثانية', managerName: 'عبدالله الدوسري', active: true },
      { id: 'WH-2', nameAr: 'مستودع جدة اللوجستي', nameEn: 'Jeddah Logistics Warehouse', branchId: 'BR-2', location: 'حي الخمرة', managerName: 'ماجد الحربي', active: true },
    ],
    chartOfAccounts: structuredClone(DEFAULT_CHART_OF_ACCOUNTS),
    stockMovements: [
      { id: 'MOV-101', productId: 'P-01', productName: 'أجهزة نقاط بيع ذكية POS', movementType: 'sale', qtyDelta: -10, fromWarehouseId: 'WH-1', referenceId: 'INV-1001', notes: 'توريد شركة النخبة', date: isoDaysAgo(2) },
      { id: 'MOV-102', productId: 'P-01', productName: 'أجهزة نقاط بيع ذكية POS', movementType: 'sale', qtyDelta: -15, fromWarehouseId: 'WH-1', referenceId: 'INV-1002', notes: 'نظام كاشير متاجر الريادة', date: isoDaysAgo(5) },
    ],
    stocktakes: [],
    auditLogs: [
      {
        id: 'AUD-INIT-1',
        actor: 'System',
        actorRole: 'owner',
        action: 'create',
        entity: 'Workspace',
        entityId: 'MAIN',
        summary: 'تأسيس بيئة أسطورة المحاسبة (Clean Architecture + Double Entry + Halala Int)',
        timestamp: isoDaysAgo(5),
      },
    ],
    customers: [
      { id: 'C-101', code: 'CUST-101', name: 'شركة النخبة التجارية', companyName: 'النخبة القابضة', phone: '0504412398', whatsapp: '966504412398', email: 'accounts@nokhba.sa', city: 'الرياض', country: 'السعودية', customerType: 'VIP', debt: 18400, creditLimit: 50000, creditTermDays: 30, preferredPaymentMethod: 'transfer', salesRep: 'سارة القحطاني', branchId: 'BR-1', status: 'active' },
      { id: 'C-102', code: 'CUST-102', name: 'مؤسسة الفجر للمقاولات', companyName: 'الفجر للمقاولات', phone: '0558231904', whatsapp: '966558231904', email: 'finance@fajr.sa', city: 'جدة', country: 'السعودية', customerType: 'company', debt: 9200, creditLimit: 25000, creditTermDays: 15, preferredPaymentMethod: 'credit', salesRep: 'سارة القحطاني', branchId: 'BR-2', status: 'active' },
      { id: 'C-103', code: 'CUST-103', name: 'متاجر الريادة الحديثة', companyName: 'الريادة للتجزئة', phone: '0531187420', whatsapp: '966531187420', email: 'pay@riyadah.sa', city: 'الدمام', country: 'السعودية', customerType: 'wholesale', debt: 0, creditLimit: 40000, creditTermDays: 30, preferredPaymentMethod: 'pos_card', salesRep: 'سارة القحطاني', branchId: 'BR-1', status: 'active' },
    ],
    suppliers: [
      { id: 'S-201', code: 'SUP-201', name: 'مصنع الخليج للتجهيزات', companyName: 'الخليج الصناعية', phone: '0549012234', email: 'orders@gulf-mfg.sa', category: 'مواد خام', city: 'الجبيل', country: 'السعودية', supplierType: 'manufacturer', payable: 14500, paymentTermDays: 30, bankName: 'مصرف الراجحي', status: 'active' },
      { id: 'S-202', code: 'SUP-202', name: 'شركة التقنية السحابية', companyName: 'CloudTech KSA', phone: '0567721109', email: 'billing@cloudtech.sa', category: 'أجهزة ومعدات', city: 'الرياض', country: 'السعودية', supplierType: 'importer', payable: 4800, paymentTermDays: 15, bankName: 'البنك الأهلي', status: 'active' },
    ],
    products: [
      { id: 'P-01', name: 'أجهزة نقاط بيع ذكية POS', sku: 'POS-900', barcode: '6281001009004', category: 'أجهزة كاشير', unit: 'piece', qty: 24, cost: 850, price: 1450, wholesalePrice: 1320, taxRate: 15, minStock: 10, maxStock: 100, warehouseId: 'WH-1' },
      { id: 'P-02', name: 'طابعة فواتير حرارية 80mm', sku: 'PRT-80', barcode: '6281001000803', category: 'طابعات', unit: 'piece', qty: 7, cost: 220, price: 390, wholesalePrice: 340, taxRate: 15, minStock: 10, maxStock: 80, warehouseId: 'WH-1' },
      { id: 'P-03', name: 'ماسح باركود لاسلكي 2D', sku: 'SCN-2D', barcode: '6281001000209', category: 'ماسحات', unit: 'piece', qty: 18, cost: 160, price: 310, wholesalePrice: 270, taxRate: 15, minStock: 8, maxStock: 60, warehouseId: 'WH-1' },
      { id: 'P-04', name: 'درج نقدية فولاذي 5 خانات', sku: 'DRW-05', barcode: '6281001000056', category: 'ملحقات', unit: 'piece', qty: 5, cost: 140, price: 260, wholesalePrice: 230, taxRate: 15, minStock: 8, maxStock: 40, warehouseId: 'WH-2' },
    ],
    invoices: [
      {
        id: 'INV-1001',
        customerId: 'C-101',
        customerName: 'شركة النخبة التجارية',
        customerPhone: '0504412398',
        description: 'توريد 10 أجهزة نقاط بيع ذكية',
        items: [
          { productId: 'P-01', productName: 'أجهزة نقاط بيع ذكية POS', qty: 10, unitPrice: 1450, total: 14500, unit: 'piece', costPrice: 850 },
          { productId: 'P-02', productName: 'طابعة فواتير حرارية 80mm', qty: 4, unitPrice: 375, total: 1500, unit: 'piece', costPrice: 220 },
        ],
        subtotal: 16000,
        vat: 2400,
        total: 18400,
        paidAmount: 0,
        remainingAmount: 18400,
        paymentMethod: 'credit',
        branchId: 'BR-1',
        branchName: 'الفرع الرئيسي - الرياض',
        warehouseId: 'WH-1',
        status: 'pending',
        date: isoDaysAgo(2),
        dueDate: isoDaysAhead(28),
        invoiceType: 'sales',
      },
      {
        id: 'INV-1002',
        customerId: 'C-103',
        customerName: 'متاجر الريادة الحديثة',
        customerPhone: '0531187420',
        description: 'نظام كاشير متكامل مع طابعات',
        items: [
          { productId: 'P-01', productName: 'أجهزة نقاط بيع ذكية POS', qty: 15, unitPrice: 1450, total: 21750, unit: 'piece', costPrice: 850 },
          { productId: 'P-03', productName: 'ماسح باركود لاسلكي 2D', qty: 9, unitPrice: 305.56, total: 2750, unit: 'piece', costPrice: 160 },
        ],
        subtotal: 24500,
        vat: 3675,
        total: 28175,
        paidAmount: 28175,
        remainingAmount: 0,
        paymentMethod: 'pos_card',
        branchId: 'BR-1',
        branchName: 'الفرع الرئيسي - الرياض',
        warehouseId: 'WH-1',
        status: 'paid',
        date: isoDaysAgo(5),
        invoiceType: 'sales',
      },
      {
        id: 'INV-1003',
        customerId: 'C-102',
        customerName: 'مؤسسة الفجر للمقاولات',
        customerPhone: '0558231904',
        description: 'عقد صيانة وتجهيز فروع',
        items: [
          { productId: 'P-04', productName: 'درج نقدية فولاذي 5 خانات', qty: 10, unitPrice: 260, total: 2600, unit: 'piece', costPrice: 140 },
          { productId: 'P-03', productName: 'ماسح باركود لاسلكي 2D', qty: 18, unitPrice: 300, total: 5400, unit: 'piece', costPrice: 160 },
        ],
        subtotal: 8000,
        vat: 1200,
        total: 9200,
        paidAmount: 0,
        remainingAmount: 9200,
        paymentMethod: 'credit',
        branchId: 'BR-2',
        branchName: 'فرع جدة',
        warehouseId: 'WH-2',
        status: 'overdue',
        date: isoDaysAgo(19),
        dueDate: isoDaysAgo(4).slice(0, 10),
        invoiceType: 'sales',
      },
    ],
    returns: [
      {
        id: 'RET-401',
        type: 'sales',
        originalDocId: 'INV-1001',
        partyName: 'شركة النخبة التجارية',
        partyPhone: '0504412398',
        productId: 'P-02',
        productName: 'طابعة فواتير حرارية 80mm',
        qty: 1,
        unitPrice: 375,
        amount: 431.25,
        reason: 'damaged',
        notes: 'تلف أثناء الشحن - تم استبدالها وإصدار إشعار دائن',
        date: isoDaysAgo(1),
      },
    ],
    quotations: [
      {
        id: 'QT-201',
        customerId: 'C-101',
        customerName: 'شركة النخبة التجارية',
        customerPhone: '0504412398',
        customerEmail: 'accounts@nokhba.sa',
        items: [
          { productId: 'P-01', productName: 'أجهزة نقاط بيع ذكية POS', qty: 5, unitPrice: 1450, total: 7250 },
          { productId: 'P-03', productName: 'ماسح باركود لاسلكي 2D', qty: 5, unitPrice: 310, total: 1550 },
        ],
        discountPercent: 5,
        subtotal: 8800,
        discountAmount: 440,
        vat: 1254,
        total: 9614,
        validUntil: isoDaysAhead(14),
        status: 'sent',
        notes: 'يشمل التركيب والتدريب لمدة 3 أشهر',
        date: isoDaysAgo(1),
      },
    ],
    purchaseOrders: [
      {
        id: 'PO-301',
        supplierId: 'S-201',
        supplierName: 'مصنع الخليج للتجهيزات',
        supplierPhone: '0549012234',
        productId: 'P-02',
        productName: 'طابعة فواتير حرارية 80mm',
        quantity: 15,
        unitCost: 215,
        subtotal: 3225,
        taxRate: 15,
        vat: 483.75,
        total: 3708.75,
        branchId: 'BR-1',
        warehouseId: 'WH-1',
        status: 'ordered',
        date: isoDaysAgo(1),
      },
    ],
    vouchers: [
      {
        id: 'VCH-501',
        type: 'receipt',
        partyName: 'متاجر الريادة الحديثة',
        partyPhone: '0531187420',
        amount: 28175,
        reason: 'سداد الفاتورة INV-1002',
        paymentMethod: 'AlRajhi Bank',
        date: isoDaysAgo(4),
      },
      {
        id: 'VCH-502',
        type: 'payment',
        partyName: 'شركة التقنية السحابية',
        partyPhone: '0567721109',
        amount: 4200,
        reason: 'دفعة من مستحقات التوريد',
        paymentMethod: 'AlAhli Bank',
        date: isoDaysAgo(3),
      },
    ],
    journals: [
      {
        id: 'JRN-701',
        reference: 'INV-1002',
        description: 'إثبات مبيعات نقدية متاجر الريادة',
        date: isoDaysAgo(5),
        lines: [
          { account: '1010 - مصرف الراجحي', debit: 28175, credit: 0 },
          { account: '4010 - إيرادات المبيعات', debit: 0, credit: 24500 },
          { account: '2020 - ضريبة القيمة المضافة', debit: 0, credit: 3675 },
        ],
      },
    ],
    recurringInvoices: [
      {
        id: 'REC-101',
        customerId: 'C-101',
        customerName: 'شركة النخبة التجارية',
        customerPhone: '0504412398',
        description: 'اشتراك دعم فني وصيانة أنظمة نقاط البيع (شهري)',
        items: [],
        subtotal: 2500,
        taxRate: 15,
        currency: 'SAR',
        frequency: 'monthly',
        nextRunDate: isoDaysAhead(5),
        lastGeneratedDate: isoDaysAgo(25).slice(0, 10),
        targetStatus: 'pending',
        autoGenerate: true,
        active: true,
        generatedCount: 3,
        notes: 'يجدد تلقائياً أول كل شهر ميلادي',
        date: isoDaysAgo(30),
      },
      {
        id: 'REC-102',
        customerId: 'C-103',
        customerName: 'متاجر الريادة الحديثة',
        customerPhone: '0531187420',
        description: 'باقة ربط سحابي واستضافة خوادم الفروع (ربع سنوي)',
        items: [],
        subtotal: 4800,
        taxRate: 15,
        currency: 'SAR',
        frequency: 'quarterly',
        nextRunDate: isoDaysAhead(21),
        targetStatus: 'paid',
        autoGenerate: false,
        active: true,
        generatedCount: 1,
        notes: 'تشمل الدعم على مدار الساعة',
        date: isoDaysAgo(14),
      },
    ],
    documents: [
      {
        id: 'DOC-101',
        title: 'عقد توريد وصيانة أنظمة نقاط البيع - النخبة',
        docType: 'contract',
        partyName: 'شركة النخبة التجارية',
        referenceId: 'INV-1001',
        fileName: 'nokhba_supply_contract.pdf',
        fileType: 'application/pdf',
        fileSizeBytes: 42800,
        notes: 'عقد موقع لمدة 12 شهراً شامل الضمان والتدريب',
        date: isoDaysAgo(12),
      },
      {
        id: 'DOC-102',
        title: 'شهادة التسجيل في ضريبة القيمة المضافة (ZATCA)',
        docType: 'tax_cert',
        partyName: 'مؤسسة الأسطورة للتجارة والمقاولات',
        referenceId: '310482910400003',
        fileName: 'zatca_vat_certificate.pdf',
        fileType: 'application/pdf',
        fileSizeBytes: 31200,
        notes: 'شهادة ضريبية سارية المفعول للمنشأة',
        date: isoDaysAgo(30),
      },
    ],
    employees: [
      {
        id: 'E-01',
        name: 'خالد العتيبي',
        roleTitle: 'محاسب مالي',
        role: 'accountant',
        permissions: [...DEFAULT_PERMISSIONS_MATRIX.accountant],
        phone: '0509981234',
        salary: 8500,
      },
      {
        id: 'E-02',
        name: 'سارة القحطاني',
        roleTitle: 'مديرة مبيعات',
        role: 'salesman',
        permissions: [...DEFAULT_PERMISSIONS_MATRIX.salesman],
        phone: '0552218743',
        salary: 9200,
      },
      {
        id: 'E-03',
        name: 'فيصل الشمري',
        roleTitle: 'أمين صندوق وكاشير POS',
        role: 'cashier',
        permissions: [...DEFAULT_PERMISSIONS_MATRIX.cashier],
        phone: '0543321980',
        salary: 5800,
      },
    ],
    expenses: [
      { id: 'EXP-901', title: 'إيجار المكتب الرئيسي', category: 'إيجارات', amount: 12000, paidFromBankId: 'alrajhi', date: isoDaysAgo(10), branchId: 'BR-1' },
      { id: 'EXP-902', title: 'فواتير الكهرباء والإنترنت', category: 'مرافق', amount: 1450, paidFromBankId: 'cash', date: isoDaysAgo(6), branchId: 'BR-1' },
    ],
    banks: [
      { id: 'alrajhi', nameAr: 'مصرف الراجحي', nameEn: 'AlRajhi Bank', accountNumber: 'SA44 8000 0219 6080 1044', balance: 142500 },
      { id: 'alahli', nameAr: 'البنك الأهلي السعودي', nameEn: 'AlAhli (SNB)', accountNumber: 'SA19 1000 0011 8920 3310', balance: 68900 },
      { id: 'cash', nameAr: 'الصندوق النقدي', nameEn: 'Main Cash Box', accountNumber: 'CASH-01', balance: 19450 },
    ],
  };
}

function hydrateState(rawObj: Partial<PersistedState>): PersistedState {
  const demo = createDemoState();
  const mergedQuotations = (rawObj.quotations ?? demo.quotations).map((q) => {
    if (q.status === 'sent' && q.validUntil && new Date(q.validUntil) < new Date(new Date().toDateString())) {
      return { ...q, status: 'expired' as const };
    }
    return q;
  });
  const rawMatrix = rawObj.permissionsMatrix ?? demo.permissionsMatrix;
  const mergedPermissionsMatrix: PermissionsMatrix = {
    owner: Array.from(new Set<RouteId>([...(rawMatrix.owner ?? []), ...ALL_ROUTES])),
    accountant: rawMatrix.accountant ?? [...DEFAULT_PERMISSIONS_MATRIX.accountant],
    cashier: rawMatrix.cashier ?? [...DEFAULT_PERMISSIONS_MATRIX.cashier],
    salesman: rawMatrix.salesman ?? [...DEFAULT_PERMISSIONS_MATRIX.salesman],
    warehouse: rawMatrix.warehouse ?? [...DEFAULT_PERMISSIONS_MATRIX.warehouse],
  };
  return {
    ...demo,
    ...rawObj,
    currentRole: (['owner', 'accountant', 'cashier', 'salesman', 'warehouse'].includes(rawObj.currentRole as string)
      ? rawObj.currentRole
      : 'owner') as RoleId,
    permissionsMatrix: mergedPermissionsMatrix,
    recurringInvoices: rawObj.recurringInvoices ?? demo.recurringInvoices,
    documents: rawObj.documents ?? demo.documents,
    returns: rawObj.returns ?? demo.returns,
    quotations: mergedQuotations,
    branches: rawObj.branches && rawObj.branches.length > 0 ? rawObj.branches : demo.branches,
    warehouses: rawObj.warehouses && rawObj.warehouses.length > 0 ? rawObj.warehouses : demo.warehouses,
    chartOfAccounts: rawObj.chartOfAccounts && rawObj.chartOfAccounts.length > 0 ? rawObj.chartOfAccounts : demo.chartOfAccounts,
    stockMovements: rawObj.stockMovements ?? demo.stockMovements,
    stocktakes: rawObj.stocktakes ?? demo.stocktakes,
    auditLogs: rawObj.auditLogs && rawObj.auditLogs.length > 0 ? rawObj.auditLogs : demo.auditLogs,
    products: (rawObj.products ?? demo.products).map((p) => ({
      ...p,
      barcode: p.barcode || generateEan13(),
    })),
    employees: (rawObj.employees ?? demo.employees).map((e) => ({
      ...e,
      roleTitle: e.roleTitle ?? (e as unknown as { role?: string }).role ?? 'Staff',
      role: (['owner', 'accountant', 'cashier', 'salesman', 'warehouse'].includes(e.role) ? e.role : 'accountant') as RoleId,
      permissions: e.permissions ?? DEFAULT_PERMISSIONS_MATRIX.accountant,
    })),
    settings: {
      ...demo.settings,
      ...(rawObj.settings ?? {}),
      enabledCurrencies:
        rawObj.settings?.enabledCurrencies && rawObj.settings.enabledCurrencies.length > 0
          ? Array.from(
              new Set<CurrencyCode>([
                rawObj.settings?.currency ?? demo.settings.currency,
                ...rawObj.settings.enabledCurrencies.filter((c) => ALL_CURRENCY_CODES.includes(c)),
              ]),
            )
          : [...DEFAULT_ENABLED_CURRENCIES],
      exchangeRates: {
        ...buildDefaultRatesForBase(rawObj.settings?.currency ?? demo.settings.currency),
        ...(rawObj.settings?.exchangeRates ?? {}),
        [rawObj.settings?.currency ?? demo.settings.currency]: 1,
      },
      defaultSalesTaxRate: Number.isFinite(rawObj.settings?.defaultSalesTaxRate)
        ? Number(rawObj.settings!.defaultSalesTaxRate)
        : 15,
      defaultPurchaseTaxRate: Number.isFinite(rawObj.settings?.defaultPurchaseTaxRate)
        ? Number(rawObj.settings!.defaultPurchaseTaxRate)
        : 15,
      autoCloudSync:
        typeof rawObj.settings?.autoCloudSync === 'boolean'
          ? rawObj.settings.autoCloudSync
          : true,
      autoSyncIntervalMinutes: Number.isFinite(rawObj.settings?.autoSyncIntervalMinutes)
        ? Math.max(0, Number(rawObj.settings!.autoSyncIntervalMinutes))
        : 0,
    },
  };
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return hydrateState(JSON.parse(raw) as Partial<PersistedState>);
    }
  } catch {
    // Fallback to demo state
  }
  return createDemoState();
}

export function useErpStore() {
  const {
    user,
    authReady,
    setSyncStatus,
    setLastCloudSyncAt,
    signOutFirebase,
  } = useFirebase();

  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [idbSnapshots, setIdbSnapshots] = useState<DailyBackupMeta[]>([]);
  const [cloudBackups, setCloudBackups] = useState<CloudBackupMeta[]>([]);
  const [fatalSyncError, setFatalSyncError] = useState<Error | null>(null);
  const latestStateRef = useRef<PersistedState>(state);
  latestStateRef.current = state;

  const lastSyncedStateRef = useRef<PersistedState | null>(null);
  const cloudHydratedUidRef = useRef<string | null>(null);
  const applyingRemoteRef = useRef(false);

  if (fatalSyncError) {
    throw fatalSyncError;
  }

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? '' : prev)), 3200);
  }, []);

  const actorLabel = user?.email ?? user?.displayName ?? state.currentRole;

  const guardDeleteAllowed = useCallback((): boolean => {
    const cur = latestStateRef.current;
    if (cur.currentRole === 'accountant') {
      notify(
        cur.settings.isArabic
          ? 'صلاحية المحاسب تمنع الحذف حفاظاً على السلامة المالية.'
          : 'Accountant role is restricted from deleting financial records.',
      );
      return false;
    }
    return true;
  }, [notify]);

  const guardFiscalOpen = useCallback(
    (dateIso?: string): boolean => {
      const cur = latestStateRef.current;
      if (isDateFiscalLocked(dateIso, cur.settings.fiscalLockDate)) {
        notify(
          cur.settings.isArabic
            ? `الفترة المالية مقفلة حتى ${cur.settings.fiscalLockDate} — لا يمكن الحفظ أو التعديل.`
            : `Fiscal period is locked through ${cur.settings.fiscalLockDate}.`,
        );
        return false;
      }
      return true;
    },
    [notify],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  useEffect(() => {
    const saveSnapshot = () => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), state }));
      } catch {
        // Ignore quota errors
      }
    };
    saveSnapshot();
    const interval = setInterval(saveSnapshot, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state]);

  const saveDailySnapshotToIndexedDb = useCallback(
    async (force = false): Promise<DailyBackupRecord | null> => {
      const dateKey = getLocalDateKey();
      if (!force) {
        const existing = await getDailySnapshot(dateKey);
        if (existing) {
          const metaList = await listDailySnapshotMeta();
          setIdbSnapshots(metaList);
          return existing;
        }
      }

      const nowIso = new Date().toISOString();
      const snapshotPayload: PersistedState = {
        ...latestStateRef.current,
        settings: {
          ...latestStateRef.current.settings,
          lastBackupDate: nowIso,
        },
      };
      const json = JSON.stringify(snapshotPayload, null, 2);
      const record: DailyBackupRecord = {
        id: dateKey,
        dateKey,
        createdAt: nowIso,
        sizeBytes: new Blob([json]).size,
        json,
      };

      const saved = await saveDailySnapshot(record);
      if (!saved) return null;

      const metaList = await listDailySnapshotMeta();
      setIdbSnapshots(metaList);
      setState((p) => ({
        ...p,
        settings: {
          ...p.settings,
          lastBackupDate: nowIso,
        },
      }));
      return record;
    },
    [],
  );

  useEffect(() => {
    let active = true;
    listDailySnapshotMeta().then((list) => {
      if (active) setIdbSnapshots(list);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!state.settings.autoBackupDaily) return;

    const runCheck = () => {
      void saveDailySnapshotToIndexedDb(false);
    };

    runCheck();
    const hourlyTimer = setInterval(runCheck, 60 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runCheck();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(hourlyTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [state.settings.autoBackupDaily, saveDailySnapshotToIndexedDb]);

  // Daily automatic Firebase Cloud Backup when signed in
  useEffect(() => {
    if (!authReady || !user || !state.settings.autoBackupDaily) return;
    if (cloudHydratedUidRef.current !== user.uid) return;
    const todayKey = getLocalDateKey();
    let active = true;
    listCloudBackupSnapshots(user.uid).then((list) => {
      if (!active) return;
      setCloudBackups(list);
      if (!list.some((b) => b.dateKey === todayKey)) {
        void saveCloudBackupSnapshot(user.uid, latestStateRef.current, todayKey).then((meta) => {
          if (meta && active) {
            setCloudBackups((prev) => [meta, ...prev.filter((x) => x.id !== meta.id)]);
          }
        });
      }
    });
    return () => {
      active = false;
    };
  }, [authReady, user, state.settings.autoBackupDaily]);

  useEffect(() => {
    document.documentElement.dir = state.settings.isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = state.settings.isArabic ? 'ar' : 'en';
    if (state.settings.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.settings.isArabic, state.settings.isDarkMode]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      cloudHydratedUidRef.current = null;
      lastSyncedStateRef.current = null;
      setSyncStatus('offline');
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    setSyncStatus('syncing');

    loadOrSeedWorkspace(user.uid, latestStateRef.current)
      .then((cloudPatch) => {
        if (cancelled) return;
        const hydrated = hydrateState({ ...latestStateRef.current, ...cloudPatch });
        applyingRemoteRef.current = true;
        lastSyncedStateRef.current = hydrated;
        cloudHydratedUidRef.current = user.uid;
        setState(hydrated);
        setSyncStatus('synced');
        setLastCloudSyncAt(new Date().toISOString());

        void listCloudBackupSnapshots(user.uid).then((bList) => {
          if (!cancelled) setCloudBackups(bList);
        });

        unsubscribe = subscribeWorkspace(
          user.uid,
          (remotePatch) => {
            if (cancelled) return;
            applyingRemoteRef.current = true;
            setState((prev) => {
              const merged = hydrateState({ ...prev, ...remotePatch });
              lastSyncedStateRef.current = merged;
              return merged;
            });
            setSyncStatus('synced');
            setLastCloudSyncAt(new Date().toISOString());
          },
          (err) => {
            if (cancelled) return;
            setSyncStatus('error');
            setFatalSyncError(err);
          },
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setSyncStatus('error');
        setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [authReady, user, setSyncStatus, setLastCloudSyncAt]);

  const autoCloudSyncEnabled = state.settings.autoCloudSync ?? true;
  const autoSyncIntervalMinutes = Math.max(0, state.settings.autoSyncIntervalMinutes ?? 0);

  useEffect(() => {
    if (!authReady || !user) return;
    if (cloudHydratedUidRef.current !== user.uid || !lastSyncedStateRef.current) return;

    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }

    const syncPreferenceChanged =
      (lastSyncedStateRef.current.settings.autoCloudSync ?? true) !== autoCloudSyncEnabled ||
      (lastSyncedStateRef.current.settings.autoSyncIntervalMinutes ?? 0) !== autoSyncIntervalMinutes;

    if (!autoCloudSyncEnabled && !syncPreferenceChanged) {
      return;
    }

    if (autoCloudSyncEnabled && autoSyncIntervalMinutes > 0 && !syncPreferenceChanged) {
      return;
    }

    const timer = setTimeout(() => {
      const prevSynced = lastSyncedStateRef.current;
      const nextState = latestStateRef.current;
      if (!prevSynced) return;
      setSyncStatus('syncing');
      syncStateDiffToFirestore(user.uid, user.email, prevSynced, nextState)
        .then(() => {
          lastSyncedStateRef.current = nextState;
          setSyncStatus('synced');
          setLastCloudSyncAt(new Date().toISOString());
        })
        .catch((err) => {
          setSyncStatus('error');
          setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
        });
    }, 450);

    return () => clearTimeout(timer);
  }, [
    state,
    authReady,
    user,
    autoCloudSyncEnabled,
    autoSyncIntervalMinutes,
    setSyncStatus,
    setLastCloudSyncAt,
  ]);

  useEffect(() => {
    if (!authReady || !user) return;
    if (!autoCloudSyncEnabled || autoSyncIntervalMinutes <= 0) return;

    const intervalMs = autoSyncIntervalMinutes * 60 * 1000;
    const timer = setInterval(() => {
      if (cloudHydratedUidRef.current !== user.uid) return;
      const prevSynced = lastSyncedStateRef.current;
      const nextState = latestStateRef.current;
      if (!prevSynced || prevSynced === nextState) return;
      setSyncStatus('syncing');
      syncStateDiffToFirestore(user.uid, user.email, prevSynced, nextState)
        .then(() => {
          lastSyncedStateRef.current = nextState;
          setSyncStatus('synced');
          setLastCloudSyncAt(new Date().toISOString());
        })
        .catch((err) => {
          setSyncStatus('error');
          setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
        });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    authReady,
    user,
    autoCloudSyncEnabled,
    autoSyncIntervalMinutes,
    setSyncStatus,
    setLastCloudSyncAt,
  ]);

  useEffect(() => {
    if (!state.isLoggedIn) return;
    if (user && cloudHydratedUidRef.current !== user.uid) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const hasDue = state.recurringInvoices.some(
      (r) => r.active && r.autoGenerate && r.nextRunDate <= todayKey,
    );
    if (!hasDue) return;
    const timer = setTimeout(() => {
      let count = 0;
      setState((p) => {
        const res = runDueRecurringInState(p, todayKey);
        count = res.generated;
        return res.generated > 0 ? res.nextState : p;
      });
      if (count > 0) {
        const msg = latestStateRef.current.settings.isArabic
          ? `تم إصدار ${count} فاتورة متكررة مستحقة تلقائياً`
          : `Auto-issued ${count} due recurring invoice(s)`;
        notify(msg);
        dispatchSmartNotification('أسطورة المحاسبة', msg);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [state.isLoggedIn, state.recurringInvoices, user, notify]);

  const allowedRoutes = useMemo(() => {
    return state.permissionsMatrix[state.currentRole] ?? DEFAULT_PERMISSIONS_MATRIX.owner;
  }, [state.permissionsMatrix, state.currentRole]);

  const hasPermission = (route: RouteId): boolean => allowedRoutes.includes(route);

  const metrics = useMemo(() => {
    let totalSalesH = 0;
    let revExVatH = 0;
    let vatOutputH = 0;
    for (const inv of state.invoices) {
      if (inv.status === 'cancelled' || inv.invoiceType === 'quotation') continue;
      const fx = inv.exchangeRate ?? 1;
      const sign = inv.invoiceType === 'return' ? -1 : 1;
      totalSalesH += mulFxHalalas(toHalalas(inv.total), fx) * sign;
      revExVatH += mulFxHalalas(toHalalas(inv.subtotal), fx) * sign;
      vatOutputH += mulFxHalalas(toHalalas(inv.vat), fx) * sign;
    }
    let customerDebtH = 0;
    for (const c of state.customers) customerDebtH += toHalalas(c.debt);
    let supplierDebtH = 0;
    for (const sp of state.suppliers) supplierDebtH += toHalalas(sp.payable);
    let stockValueH = 0;
    for (const p of state.products) stockValueH += Math.round(toHalalas(p.cost) * p.qty);
    let totalExpensesH = 0;
    for (const e of state.expenses) totalExpensesH += toHalalas(e.amount);
    let totalBanksH = 0;
    for (const b of state.banks) totalBanksH += toHalalas(b.balance);

    const totalSales = fromHalalas(totalSalesH);
    const revenueExVat = fromHalalas(revExVatH);
    const vatOutput = fromHalalas(vatOutputH);
    const customerDebt = fromHalalas(customerDebtH);
    const supplierDebt = fromHalalas(supplierDebtH);
    const stockValue = fromHalalas(stockValueH);
    const totalExpenses = fromHalalas(totalExpensesH);
    const totalCashAndBanks = fromHalalas(totalBanksH);
    const netProfit = fromHalalas(revExVatH - totalExpensesH);

    let score = 62;
    if (netProfit > 0) score += 18;
    if (totalCashAndBanks > supplierDebt) score += 12;
    score -= state.invoices.filter((i) => i.status === 'overdue').length * 5;
    score -= state.products.filter((p) => p.qty <= (p.minStock ?? 10)).length * 3;
    const healthScore = Math.max(15, Math.min(98, Math.round(score)));

    const elapsedDays = Math.floor((Date.now() - new Date(state.trialStartIso).getTime()) / 86400000);
    const trialDaysRemaining = Math.max(0, Math.min(30, 30 - elapsedDays));

    const alerts: SmartAlert[] = [];
    const lowStock = state.products.filter((p) => p.qty <= (p.minStock ?? 10));
    if (lowStock.length > 0) {
      alerts.push({
        id: 'alert_low_stock',
        titleAr: `${lowStock.length} أصناف وصلت للحد الأدنى للمخزون`,
        titleEn: `${lowStock.length} products reached low stock threshold`,
        subtitleAr: `أبرزها: ${lowStock[0].name} (${lowStock[0].qty} وحدة)`,
        subtitleEn: `Top item: ${lowStock[0].name} (${lowStock[0].qty} units)`,
        actionRoute: 'inventory',
        severity: 'warning',
      });
    }
    const overdue = state.invoices.filter((i) => i.status === 'overdue');
    if (overdue.length > 0) {
      alerts.push({
        id: 'alert_overdue',
        titleAr: `${overdue.length} فواتير متأخرة السداد تحتاج متابعة`,
        titleEn: `${overdue.length} overdue invoices require collection`,
        subtitleAr: `إجمالي المتأخرات ${overdue.reduce((s, i) => s + i.total, 0).toFixed(0)} ${state.settings.currency}`,
        subtitleEn: `Overdue total ${overdue.reduce((s, i) => s + i.total, 0).toFixed(0)} ${state.settings.currency}`,
        actionRoute: 'invoices',
        severity: 'danger',
      });
    }
    if (customerDebt > 15000) {
      alerts.push({
        id: 'alert_debt',
        titleAr: 'ارتفاع ذمم العملاء المدينة',
        titleEn: 'Elevated customer receivables balance',
        subtitleAr: 'أرسل تذكيرات واتساب لتحصيل السيولة',
        subtitleEn: 'Send WhatsApp payment reminders to boost cashflow',
        actionRoute: 'customers',
        severity: 'info',
      });
    }

    const dataSizeKb = Number((new Blob([JSON.stringify(state)]).size / 1024).toFixed(1));

    return {
      totalSales,
      revenueExVat,
      vatOutput,
      customerDebt,
      supplierDebt,
      stockValue,
      totalExpenses,
      totalCashAndBanks,
      netProfit,
      healthScore,
      trialDaysRemaining,
      dataSizeKb,
      smartAlerts: alerts.filter((a) => !dismissedAlerts.includes(a.id)),
    };
  }, [state, dismissedAlerts]);

  const actions = {
    notify,
    toggleLanguage: () =>
      setState((p) => ({ ...p, settings: { ...p.settings, isArabic: !p.settings.isArabic } })),
    toggleDarkMode: () =>
      setState((p) => ({ ...p, settings: { ...p.settings, isDarkMode: !p.settings.isDarkMode } })),
    updateSettings: (patch: Partial<CompanySettings>) =>
      setState((p) => {
        const nextCurrency = patch.currency ?? p.settings.currency;
        let nextEnabled = patch.enabledCurrencies ?? p.settings.enabledCurrencies ?? DEFAULT_ENABLED_CURRENCIES;
        if (!nextEnabled.includes(nextCurrency)) {
          nextEnabled = [nextCurrency, ...nextEnabled];
        }
        let nextRates = patch.exchangeRates ?? p.settings.exchangeRates ?? buildDefaultRatesForBase(nextCurrency);
        if (patch.currency && patch.currency !== p.settings.currency) {
          const prevBase = p.settings.currency;
          const oldFactorForNewBase = nextRates[nextCurrency] || buildDefaultRatesForBase(prevBase)[nextCurrency] || 1;
          const rebased: Record<string, number> = {};
          for (const code of ALL_CURRENCY_CODES) {
            if (code === nextCurrency) {
              rebased[code] = 1;
            } else {
              const oldVal = nextRates[code] ?? buildDefaultRatesForBase(prevBase)[code] ?? 1;
              rebased[code] = Number((oldVal / oldFactorForNewBase).toFixed(4));
            }
          }
          nextRates = rebased;
        }
        return {
          ...p,
          settings: {
            ...p.settings,
            ...patch,
            enabledCurrencies: nextEnabled,
            exchangeRates: nextRates,
          },
        };
      }),
    setFiscalLockDate: (fiscalLockDate: string) =>
      setState((p) => ({
        ...p,
        settings: { ...p.settings, fiscalLockDate: fiscalLockDate || undefined },
        auditLogs: [
          makeAuditEntry(
            p,
            actorLabel,
            'fiscal_lock',
            'FiscalPeriod',
            fiscalLockDate || 'OPEN',
            fiscalLockDate
              ? `قفل الفترة المالية حتى تاريخ ${fiscalLockDate}`
              : 'إلغاء قفل الفترة المالية',
          ),
          ...p.auditLogs,
        ],
      })),
    refreshLiveExchangeRates: async (targetBase?: CurrencyCode) => {
      const base = targetBase ?? latestStateRef.current.settings.currency;
      const result = await fetchLiveExchangeRates(base);
      setState((p) => ({
        ...p,
        settings: {
          ...p.settings,
          exchangeRates: {
            ...(p.settings.exchangeRates ?? {}),
            ...result.rates,
            [base]: 1,
          },
          lastRatesUpdate: result.updatedAt,
        },
      }));
      return result;
    },
    setLoggedIn: (v: boolean) => setState((p) => ({ ...p, isLoggedIn: v })),
    setCurrentRole: (role: RoleId) => setState((p) => ({ ...p, currentRole: role })),
    logoutPreserveData: () => {
      setState((p) => ({ ...p, isLoggedIn: false }));
      if (user) {
        void signOutFirebase();
      }
    },
    syncNowToCloud: async () => {
      if (!user) return false;
      setSyncStatus('syncing');
      try {
        await pushFullStateToCloud(user.uid, latestStateRef.current);
        lastSyncedStateRef.current = latestStateRef.current;
        setSyncStatus('synced');
        setLastCloudSyncAt(new Date().toISOString());
        return true;
      } catch (err) {
        setSyncStatus('error');
        setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
        return false;
      }
    },
    saveCloudBackupNow: async (): Promise<CloudBackupMeta | null> => {
      if (!user) return null;
      const dateKey = getLocalDateKey();
      const meta = await saveCloudBackupSnapshot(user.uid, latestStateRef.current, dateKey);
      if (meta) {
        setCloudBackups((prev) => [meta, ...prev.filter((x) => x.id !== meta.id)]);
        setState((p) => ({
          ...p,
          settings: { ...p.settings, lastBackupDate: meta.createdAt },
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'backup', 'CloudBackup', meta.id, `نسخة سحابية تلقائية ${dateKey}`),
            ...p.auditLogs,
          ],
        }));
      }
      return meta;
    },
    restoreCloudBackupById: async (backupId: string): Promise<boolean> => {
      if (!user) return false;
      const json = await fetchCloudBackupSnapshotJson(user.uid, backupId);
      if (!json) return false;
      const parsed = JSON.parse(json) as Partial<PersistedState>;
      const inner = (parsed as { state?: Partial<PersistedState> }).state ?? parsed;
      setState(hydrateState(inner));
      return true;
    },
    setOnboardingSeen: (v: boolean) => setState((p) => ({ ...p, onboardingSeen: v })),
    setActivePlan: (plan: string) => setState((p) => ({ ...p, activePlan: plan })),
    dismissAlert: (id: string) => setDismissedAlerts((prev) => [...prev, id]),

    toggleRolePermission: (role: RoleId, route: RouteId) =>
      setState((p) => {
        const current = p.permissionsMatrix[role] ?? [];
        const exists = current.includes(route);
        const updated = exists ? current.filter((r) => r !== route) : [...current, route];
        return {
          ...p,
          permissionsMatrix: {
            ...p.permissionsMatrix,
            [role]: updated,
          },
        };
      }),

    checkCustomerCreditLimit: (
      customerName: string,
      customerId: string | undefined,
      baseTotal: number,
      status: Invoice['status'],
      editId?: string,
      paidAmountBase?: number,
    ) => {
      const s = latestStateRef.current;
      const customer = s.customers.find(
        (c) => (customerId && c.id === customerId) || c.name.trim() === customerName.trim(),
      );
      const unpaidBase =
        status === 'paid' || status === 'cancelled'
          ? 0
          : Math.max(0, fromHalalas(toHalalas(baseTotal) - toHalalas(paidAmountBase ?? 0)));

      if (!customer || typeof customer.creditLimit !== 'number' || !Number.isFinite(customer.creditLimit)) {
        return {
          allowed: true,
          customer,
          currentDebt: customer?.debt ?? 0,
          creditLimit: undefined as number | undefined,
          projectedDebt: fromHalalas(toHalalas(customer?.debt ?? 0) + toHalalas(unpaidBase)),
          exceededBy: 0,
        };
      }
      let prevUnpaidH = 0;
      if (editId) {
        const prevInv = s.invoices.find((x) => x.id === editId);
        if (
          prevInv &&
          prevInv.status !== 'paid' &&
          prevInv.status !== 'cancelled' &&
          ((prevInv.customerId && prevInv.customerId === customer.id) ||
            prevInv.customerName.trim() === customer.name.trim())
        ) {
          const prevBase = prevInv.baseTotal ?? fromHalalas(mulFxHalalas(toHalalas(prevInv.total), prevInv.exchangeRate ?? 1));
          prevUnpaidH = toHalalas(prevInv.remainingAmount ?? prevBase);
        }
      }
      const projectedH = Math.max(0, toHalalas(customer.debt) - prevUnpaidH + toHalalas(unpaidBase));
      const limitH = toHalalas(customer.creditLimit);
      const allowed = status === 'paid' || status === 'cancelled' || projectedH <= limitH;
      const exceededBy = allowed ? 0 : fromHalalas(projectedH - limitH);
      return {
        allowed,
        customer,
        currentDebt: customer.debt,
        creditLimit: customer.creditLimit,
        projectedDebt: fromHalalas(projectedH),
        exceededBy,
      };
    },

    saveInvoice: (inv: Omit<Invoice, 'id' | 'vat' | 'total'>, editId?: string) => {
      if (!guardFiscalOpen(inv.date)) {
        return { ok: false as const, fiscalLocked: true };
      }
      const s = latestStateRef.current;
      const rate = Math.max(0, Math.min(100, inv.taxRate ?? s.settings.defaultSalesTaxRate ?? 15));
      const invCurrency = inv.currency ?? s.settings.currency;
      const fxRate =
        invCurrency === s.settings.currency
          ? 1
          : Math.max(0.0001, inv.exchangeRate ?? s.settings.exchangeRates?.[invCurrency] ?? 1);

      const calc = computeInvoiceTotalsHalala({
        subtotal: inv.subtotal,
        discountTotal: inv.discountTotal,
        shippingFee: inv.shippingFee,
        extraFee: inv.extraFee,
        taxRate: rate,
        fxRate,
        paidAmount: inv.paidAmount,
        status: inv.status,
      });

      const matchedCustomer = s.customers.find(
        (c) => (inv.customerId && c.id === inv.customerId) || c.name.trim() === inv.customerName.trim(),
      );
      if (
        inv.status !== 'paid' &&
        inv.status !== 'cancelled' &&
        inv.invoiceType !== 'return' &&
        inv.invoiceType !== 'quotation' &&
        matchedCustomer &&
        typeof matchedCustomer.creditLimit === 'number' &&
        Number.isFinite(matchedCustomer.creditLimit)
      ) {
        let prevUnpaidH = 0;
        if (editId) {
          const prevInv = s.invoices.find((x) => x.id === editId);
          if (
            prevInv &&
            prevInv.status !== 'paid' &&
            prevInv.status !== 'cancelled' &&
            ((prevInv.customerId && prevInv.customerId === matchedCustomer.id) ||
              prevInv.customerName.trim() === matchedCustomer.name.trim())
          ) {
            prevUnpaidH = toHalalas(prevInv.remainingAmount ?? prevInv.baseTotal ?? prevInv.total);
          }
        }
        const projectedDebtH = Math.max(0, toHalalas(matchedCustomer.debt) - prevUnpaidH + toHalalas(calc.remainingAmount));
        const limitH = toHalalas(matchedCustomer.creditLimit);
        if (projectedDebtH > limitH) {
          return {
            ok: false as const,
            creditLimit: matchedCustomer.creditLimit,
            projectedDebt: fromHalalas(projectedDebtH),
            exceededBy: fromHalalas(projectedDebtH - limitH),
          };
        }
      }

      setState((p) => {
        const targetCustomer = p.customers.find(
          (c) => (inv.customerId && c.id === inv.customerId) || c.name.trim() === inv.customerName.trim(),
        );

        if (editId) {
          const prevInv = p.invoices.find((x) => x.id === editId);
          const prevUnpaidH =
            prevInv && prevInv.status !== 'paid' && prevInv.status !== 'cancelled'
              ? toHalalas(prevInv.remainingAmount ?? prevInv.baseTotal ?? prevInv.total)
              : 0;
          const nextUnpaidH =
            inv.status !== 'paid' && inv.status !== 'cancelled' ? toHalalas(calc.remainingAmount) : 0;

          const updatedCustomers = p.customers.map((c) => {
            const matchesPrev =
              prevInv &&
              ((prevInv.customerId && prevInv.customerId === c.id) ||
                prevInv.customerName.trim() === c.name.trim());
            const matchesNext =
              (inv.customerId && inv.customerId === c.id) ||
              inv.customerName.trim() === c.name.trim();
            if (!matchesPrev && !matchesNext) return c;
            const deltaH = (matchesNext ? nextUnpaidH : 0) - (matchesPrev ? prevUnpaidH : 0);
            return { ...c, debt: Math.max(0, fromHalalas(toHalalas(c.debt) + deltaH)) };
          });

          return {
            ...p,
            invoices: p.invoices.map((x) =>
              x.id === editId
                ? {
                    ...inv,
                    customerId: targetCustomer?.id ?? inv.customerId,
                    id: editId,
                    subtotal: calc.subtotal,
                    discountTotal: calc.discountTotal,
                    shippingFee: calc.shippingFee,
                    extraFee: calc.extraFee,
                    taxRate: rate,
                    vat: calc.vat,
                    total: calc.total,
                    currency: invCurrency,
                    exchangeRate: fxRate,
                    baseTotal: calc.baseTotal,
                    paidAmount: calc.paidAmount,
                    remainingAmount: calc.remainingAmount,
                  }
                : x,
            ),
            customers: updatedCustomers,
            auditLogs: [
              makeAuditEntry(p, actorLabel, 'update', 'Invoice', editId, `تعديل فاتورة ${editId} (${inv.customerName})`),
              ...p.auditLogs,
            ],
          };
        }

        const newInvId = nextSequentialId('INV', 1000, p.invoices.map((x) => x.id));
        const newInv: Invoice = {
          ...inv,
          customerId: targetCustomer?.id ?? inv.customerId,
          id: newInvId,
          subtotal: calc.subtotal,
          discountTotal: calc.discountTotal,
          shippingFee: calc.shippingFee,
          extraFee: calc.extraFee,
          taxRate: rate,
          vat: calc.vat,
          total: calc.total,
          currency: invCurrency,
          exchangeRate: fxRate,
          baseTotal: calc.baseTotal,
          paidAmount: calc.paidAmount,
          remainingAmount: calc.remainingAmount,
          branchId: inv.branchId ?? p.settings.defaultBranchId ?? p.branches[0]?.id,
          warehouseId: inv.warehouseId ?? p.settings.defaultWarehouseId ?? p.warehouses[0]?.id,
          createdByRole: p.currentRole,
        };

        const isReturnDoc = inv.invoiceType === 'return';
        const isQuotationDoc = inv.invoiceType === 'quotation';
        const debtSign = isReturnDoc ? -1 : 1;

        const updatedCustomers =
          !isQuotationDoc && calc.remainingAmount > 0
            ? p.customers.map((c) =>
                (targetCustomer && c.id === targetCustomer.id) || c.name.trim() === inv.customerName.trim()
                  ? { ...c, debt: Math.max(0, fromHalalas(toHalalas(c.debt) + toHalalas(calc.remainingAmount) * debtSign)) }
                  : c,
              )
            : p.customers;

        let nextMovements = [...p.stockMovements];
        const updatedProducts =
          !isQuotationDoc && inv.items?.length
            ? p.products.map((pr) => {
                const sold = inv.items?.find((it) => it.productId === pr.id || it.productName === pr.name);
                if (!sold) return pr;
                const qtyDelta = isReturnDoc ? sold.qty : -sold.qty;
                nextMovements = [
                  {
                    id: nextSequentialId('MOV', 100, nextMovements.map((m) => m.id)),
                    productId: pr.id,
                    productName: pr.name,
                    movementType: isReturnDoc ? 'return_in' : 'sale',
                    qtyDelta,
                    fromWarehouseId: newInv.warehouseId,
                    referenceId: newInvId,
                    notes: `${inv.customerName}`,
                    date: inv.date,
                  },
                  ...nextMovements,
                ];
                return { ...pr, qty: Math.max(0, pr.qty + qtyDelta) };
              })
            : p.products;

        const targetBank =
          (inv.paymentMethod === 'cash'
            ? p.banks.find((b) => b.id === 'cash')
            : p.banks.find((b) => b.id === 'alrajhi')) ??
          p.banks.find((b) => b.id === 'cash') ??
          p.banks[0];

        const updatedBanks =
          !isQuotationDoc && calc.paidAmount > 0 && targetBank
            ? p.banks.map((b) =>
                b.id === targetBank.id
                  ? { ...b, balance: fromHalalas(toHalalas(b.balance) + toHalalas(calc.paidAmount) * debtSign) }
                  : b,
              )
            : p.banks;

        const bankLabel = targetBank ? (p.settings.isArabic ? targetBank.nameAr : targetBank.nameEn) : 'Cash';
        const lines = !isQuotationDoc
          ? buildDoubleEntryForInvoice({
              customerName: inv.customerName,
              bankLabel,
              baseTotal: calc.baseTotal,
              baseSubtotal: calc.baseSubtotal,
              baseVat: calc.baseVat,
              paidAmountBase: calc.paidAmount,
              remainingAmountBase: calc.remainingAmount,
              status: inv.status,
            })
          : [];

        const nextJournals =
          lines.length > 0
            ? [
                {
                  id: nextSequentialId('JRN', 700, p.journals.map((x) => x.id)),
                  reference: newInvId,
                  description: p.settings.isArabic
                    ? `فاتورة مبيعات ${newInvId} - ${inv.customerName}`
                    : `Sales Invoice ${newInvId} - ${inv.customerName}`,
                  date: inv.date,
                  lines: isReturnDoc
                    ? lines.map((l) => ({ account: l.account, debit: l.credit, credit: l.debit }))
                    : lines,
                },
                ...p.journals,
              ]
            : p.journals;

        return {
          ...p,
          invoices: [newInv, ...p.invoices],
          customers: updatedCustomers,
          products: updatedProducts,
          banks: updatedBanks,
          journals: nextJournals,
          stockMovements: nextMovements,
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'create', 'Invoice', newInvId, `إصدار فاتورة ${newInvId} بقيمة ${calc.total} (${inv.customerName})`),
            ...p.auditLogs,
          ],
        };
      });
      return { ok: true as const };
    },

    deleteInvoice: (id: string) => {
      if (!guardDeleteAllowed()) return;
      const target = latestStateRef.current.invoices.find((i) => i.id === id);
      if (target && !guardFiscalOpen(target.date)) return;
      setState((p) => ({
        ...p,
        invoices: p.invoices.filter((i) => i.id !== id),
        auditLogs: [
          makeAuditEntry(p, actorLabel, 'delete', 'Invoice', id, `حذف الفاتورة ${id}`),
          ...p.auditLogs,
        ],
      }));
    },

    deleteAllInvoices: () => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        invoices: [],
        auditLogs: [
          makeAuditEntry(p, actorLabel, 'delete', 'Invoice', 'ALL', 'حذف كافة الفواتير'),
          ...p.auditLogs,
        ],
      }));
    },

    recordInvoicePayment: (invoiceId: string, amountBase: number, bankId?: string) => {
      const s = latestStateRef.current;
      const inv = s.invoices.find((x) => x.id === invoiceId);
      if (!inv || inv.status === 'paid' || inv.status === 'cancelled') return false;
      const nowIso = new Date().toISOString();
      if (!guardFiscalOpen(nowIso)) return false;

      const totalBase = inv.baseTotal ?? fromHalalas(mulFxHalalas(toHalalas(inv.total), inv.exchangeRate ?? 1));
      const currentPaidH = toHalalas(inv.paidAmount ?? 0);
      const remainingH = Math.max(0, toHalalas(totalBase) - currentPaidH);
      const payH = Math.min(remainingH, Math.max(0, toHalalas(amountBase)));
      if (payH <= 0) return false;

      setState((p) => {
        const target = p.invoices.find((x) => x.id === invoiceId);
        if (!target) return p;
        const targetBank =
          (bankId ? p.banks.find((b) => b.id === bankId) : undefined) ??
          p.banks.find((b) => b.id === 'alrajhi') ??
          p.banks.find((b) => b.id === 'cash') ??
          p.banks[0];
        const payAmt = fromHalalas(payH);
        const newPaid = fromHalalas(currentPaidH + payH);
        const newRem = fromHalalas(Math.max(0, remainingH - payH));
        const nextStatus: Invoice['status'] = newRem === 0 ? 'paid' : 'partial';

        const voucherId = nextSequentialId('VCH', 500, p.vouchers.map((x) => x.id));
        const journalId = nextSequentialId('JRN', 700, p.journals.map((x) => x.id));
        const bankLabel = targetBank ? (p.settings.isArabic ? targetBank.nameAr : targetBank.nameEn) : 'Cash';

        const newVoucher: Voucher = {
          id: voucherId,
          type: 'receipt',
          partyName: target.customerName,
          partyPhone: target.customerPhone,
          amount: payAmt,
          reason: p.settings.isArabic ? `دفعة من الفاتورة ${target.id}` : `Payment for ${target.id}`,
          paymentMethod: targetBank?.nameEn ?? 'Cash',
          date: nowIso,
        };
        const newJournal: JournalEntry = {
          id: journalId,
          reference: target.id,
          description: p.settings.isArabic
            ? `تحصيل دفعة فاتورة ${target.id} - ${target.customerName}`
            : `Partial payment ${target.id} - ${target.customerName}`,
          date: nowIso,
          lines: [
            { account: `1010 - ${bankLabel}`, debit: payAmt, credit: 0 },
            { account: `1020 - ذمم العملاء (${target.customerName})`, debit: 0, credit: payAmt },
          ],
        };

        return {
          ...p,
          invoices: p.invoices.map((i) =>
            i.id === invoiceId
              ? { ...i, status: nextStatus, paidAmount: newPaid, remainingAmount: newRem }
              : i,
          ),
          customers: p.customers.map((c) =>
            (target.customerId && c.id === target.customerId) || c.name.trim() === target.customerName.trim()
              ? { ...c, debt: Math.max(0, fromHalalas(toHalalas(c.debt) - payH)) }
              : c,
          ),
          banks: targetBank
            ? p.banks.map((b) =>
                b.id === targetBank.id ? { ...b, balance: fromHalalas(toHalalas(b.balance) + payH) } : b,
              )
            : p.banks,
          vouchers: [newVoucher, ...p.vouchers],
          journals: [newJournal, ...p.journals],
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'pay', 'Invoice', invoiceId, `تحصيل ${payAmt} من الفاتورة ${invoiceId}`),
            ...p.auditLogs,
          ],
        };
      });
      return true;
    },

    markInvoicePaid: (id: string) => {
      const target = latestStateRef.current.invoices.find((i) => i.id === id);
      if (!target || target.status === 'paid') return;
      const nowIso = new Date().toISOString();
      if (!guardFiscalOpen(nowIso)) return;
      const totalBase = target.baseTotal ?? fromHalalas(mulFxHalalas(toHalalas(target.total), target.exchangeRate ?? 1));
      const remaining = target.remainingAmount ?? fromHalalas(Math.max(0, toHalalas(totalBase) - toHalalas(target.paidAmount ?? 0)));

      setState((p) => {
        const curInv = p.invoices.find((i) => i.id === id);
        if (!curInv || curInv.status === 'paid') return p;
        const settledBaseAmount = remaining;
        const targetBank =
          p.banks.find((b) => b.id === 'alrajhi') ??
          p.banks.find((b) => b.id === 'cash') ??
          p.banks[0];
        const voucherId = nextSequentialId('VCH', 500, p.vouchers.map((x) => x.id));
        const journalId = nextSequentialId('JRN', 700, p.journals.map((x) => x.id));
        const bankLabel = targetBank ? (p.settings.isArabic ? targetBank.nameAr : targetBank.nameEn) : 'Cash';
        const newVoucher: Voucher = {
          id: voucherId,
          type: 'receipt',
          partyName: curInv.customerName,
          partyPhone: curInv.customerPhone,
          amount: settledBaseAmount,
          reason: p.settings.isArabic ? `تحصيل الفاتورة ${curInv.id}` : `Settlement for ${curInv.id}`,
          paymentMethod: targetBank?.nameEn ?? 'Cash',
          date: nowIso,
        };
        const newJournal: JournalEntry = {
          id: journalId,
          reference: curInv.id,
          description: p.settings.isArabic
            ? `سداد الفاتورة ${curInv.id} - ${curInv.customerName}`
            : `Invoice ${curInv.id} payment - ${curInv.customerName}`,
          date: nowIso,
          lines: [
            { account: `1010 - ${bankLabel}`, debit: settledBaseAmount, credit: 0 },
            { account: `1020 - ذمم العملاء (${curInv.customerName})`, debit: 0, credit: settledBaseAmount },
          ],
        };
        return {
          ...p,
          invoices: p.invoices.map((i) =>
            i.id === id ? { ...i, status: 'paid' as const, paidAmount: totalBase, remainingAmount: 0 } : i,
          ),
          customers: p.customers.map((c) =>
            (curInv.customerId && c.id === curInv.customerId) || c.name.trim() === curInv.customerName.trim()
              ? { ...c, debt: Math.max(0, fromHalalas(toHalalas(c.debt) - toHalalas(settledBaseAmount))) }
              : c,
          ),
          banks: targetBank
            ? p.banks.map((b) =>
                b.id === targetBank.id ? { ...b, balance: fromHalalas(toHalalas(b.balance) + toHalalas(settledBaseAmount)) } : b,
              )
            : p.banks,
          vouchers: [newVoucher, ...p.vouchers],
          journals: [newJournal, ...p.journals],
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'pay', 'Invoice', id, `سداد كامل للفاتورة ${id} (${settledBaseAmount})`),
            ...p.auditLogs,
          ],
        };
      });
    },

    saveRecurringInvoice: (rec: Omit<RecurringInvoice, 'id' | 'generatedCount'>, editId?: string) =>
      setState((p) => {
        if (editId) {
          return {
            ...p,
            recurringInvoices: p.recurringInvoices.map((r) => (r.id === editId ? { ...r, ...rec, id: editId } : r)),
          };
        }
        const newId = nextSequentialId('REC', 100, p.recurringInvoices.map((x) => x.id));
        const newRec: RecurringInvoice = { ...rec, id: newId, generatedCount: 0 };
        return {
          ...p,
          recurringInvoices: [newRec, ...p.recurringInvoices],
        };
      }),
    toggleRecurringInvoiceActive: (id: string) =>
      setState((p) => ({
        ...p,
        recurringInvoices: p.recurringInvoices.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
      })),
    deleteRecurringInvoice: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        recurringInvoices: p.recurringInvoices.filter((r) => r.id !== id),
      }));
    },
    generateInvoiceFromRecurring: (id: string) => {
      const s = latestStateRef.current;
      const rec = s.recurringInvoices.find((r) => r.id === id);
      if (!rec) return { ok: false as const, reason: 'not_found' as const };

      const rate = Math.max(0, Math.min(100, rec.taxRate ?? s.settings.defaultSalesTaxRate ?? 15));
      const invCurrency = rec.currency ?? s.settings.currency;
      const fxRate =
        invCurrency === s.settings.currency
          ? 1
          : Math.max(0.0001, s.settings.exchangeRates?.[invCurrency] ?? 1);
      const calc = computeInvoiceTotalsHalala({
        subtotal: rec.subtotal,
        taxRate: rate,
        fxRate,
        status: rec.targetStatus,
      });

      const matchedCustomer = s.customers.find(
        (c) => (rec.customerId && c.id === rec.customerId) || c.name.trim() === rec.customerName.trim(),
      );
      if (
        rec.targetStatus !== 'paid' &&
        matchedCustomer &&
        typeof matchedCustomer.creditLimit === 'number' &&
        Number.isFinite(matchedCustomer.creditLimit)
      ) {
        const projectedDebtH = toHalalas(matchedCustomer.debt) + toHalalas(calc.remainingAmount);
        const limitH = toHalalas(matchedCustomer.creditLimit);
        if (projectedDebtH > limitH) {
          return {
            ok: false as const,
            reason: 'credit_limit' as const,
            creditLimit: matchedCustomer.creditLimit,
            projectedDebt: fromHalalas(projectedDebtH),
            exceededBy: fromHalalas(projectedDebtH - limitH),
          };
        }
      }

      const predictedInvId = nextSequentialId('INV', 1000, s.invoices.map((x) => x.id));
      const nowIso = new Date().toISOString();

      setState((p) => {
        const currentRec = p.recurringInvoices.find((r) => r.id === id);
        if (!currentRec) return p;

        const targetCustomer = p.customers.find(
          (c) =>
            (currentRec.customerId && c.id === currentRec.customerId) ||
            c.name.trim() === currentRec.customerName.trim(),
        );
        const newInvId = nextSequentialId('INV', 1000, p.invoices.map((x) => x.id));
        const newInv: Invoice = {
          id: newInvId,
          customerId: targetCustomer?.id ?? currentRec.customerId,
          customerName: currentRec.customerName,
          customerPhone: currentRec.customerPhone,
          description: currentRec.description || `${p.settings.isArabic ? 'فاتورة متكررة' : 'Recurring'} (${currentRec.id})`,
          items: currentRec.items ?? [],
          subtotal: calc.subtotal,
          taxRate: rate,
          vat: calc.vat,
          total: calc.total,
          currency: invCurrency,
          exchangeRate: fxRate,
          baseTotal: calc.baseTotal,
          paidAmount: calc.paidAmount,
          remainingAmount: calc.remainingAmount,
          status: currentRec.targetStatus,
          date: nowIso,
          invoiceType: 'sales',
        };

        const updatedCustomers =
          calc.remainingAmount > 0
            ? p.customers.map((c) =>
                (targetCustomer && c.id === targetCustomer.id) ||
                c.name.trim() === currentRec.customerName.trim()
                  ? { ...c, debt: fromHalalas(toHalalas(c.debt) + toHalalas(calc.remainingAmount)) }
                  : c,
              )
            : p.customers;

        const updatedProducts = currentRec.items?.length
          ? p.products.map((pr) => {
              const sold = currentRec.items.find(
                (it) => it.productId === pr.id || it.productName === pr.name,
              );
              return sold ? { ...pr, qty: Math.max(0, pr.qty - sold.qty) } : pr;
            })
          : p.products;

        const targetBank =
          p.banks.find((b) => b.id === 'alrajhi') ??
          p.banks.find((b) => b.id === 'cash') ??
          p.banks[0];
        const updatedBanks =
          calc.paidAmount > 0 && targetBank
            ? p.banks.map((b) =>
                b.id === targetBank.id
                  ? { ...b, balance: fromHalalas(toHalalas(b.balance) + toHalalas(calc.paidAmount)) }
                  : b,
              )
            : p.banks;

        const bankLabel = targetBank ? (p.settings.isArabic ? targetBank.nameAr : targetBank.nameEn) : 'Cash';
        const autoJournal: JournalEntry = {
          id: nextSequentialId('JRN', 700, p.journals.map((x) => x.id)),
          reference: newInvId,
          description: p.settings.isArabic
            ? `فاتورة متكررة ${newInvId} (${currentRec.id}) - ${currentRec.customerName}`
            : `Recurring Invoice ${newInvId} (${currentRec.id}) - ${currentRec.customerName}`,
          date: nowIso,
          lines: buildDoubleEntryForInvoice({
            customerName: currentRec.customerName,
            bankLabel,
            baseTotal: calc.baseTotal,
            baseSubtotal: calc.baseSubtotal,
            baseVat: calc.baseVat,
            paidAmountBase: calc.paidAmount,
            remainingAmountBase: calc.remainingAmount,
            status: currentRec.targetStatus,
          }),
        };

        const nextRunDate = advanceScheduleDate(currentRec.nextRunDate, currentRec.frequency);
        const updatedRecurring = p.recurringInvoices.map((r) =>
          r.id === id
            ? {
                ...r,
                nextRunDate,
                lastGeneratedDate: nowIso.slice(0, 10),
                generatedCount: (r.generatedCount ?? 0) + 1,
              }
            : r,
        );

        return {
          ...p,
          invoices: [newInv, ...p.invoices],
          recurringInvoices: updatedRecurring,
          customers: updatedCustomers,
          products: updatedProducts,
          banks: updatedBanks,
          journals: [autoJournal, ...p.journals],
        };
      });

      return { ok: true as const, invoiceId: predictedInvId };
    },
    processDueRecurringInvoices: () => {
      const todayKey = new Date().toISOString().slice(0, 10);
      const s = latestStateRef.current;
      const preview = runDueRecurringInState(s, todayKey);
      if (preview.generated > 0) {
        setState((p) => runDueRecurringInState(p, todayKey).nextState);
      }
      return { generated: preview.generated, skipped: preview.skipped };
    },

    saveArchivedDocument: (docItem: Omit<ArchivedDocument, 'id'>, editId?: string) =>
      setState((p) => {
        if (editId) {
          return {
            ...p,
            documents: p.documents.map((d) => (d.id === editId ? { ...docItem, id: editId } : d)),
          };
        }
        const newId = nextSequentialId('DOC', 100, p.documents.map((x) => x.id));
        return {
          ...p,
          documents: [{ ...docItem, id: newId }, ...p.documents],
        };
      }),
    deleteArchivedDocument: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        documents: p.documents.filter((d) => d.id !== id),
      }));
    },

    saveReturn: (ret: Omit<ReturnRecord, 'id'>, editId?: string) => {
      if (!guardFiscalOpen(ret.date)) return;
      setState((p) => {
        if (editId) {
          return {
            ...p,
            returns: p.returns.map((r) => (r.id === editId ? { ...ret, id: editId } : r)),
          };
        }
        const newId = nextSequentialId('RET', 400, p.returns.map((x) => x.id));
        const newRet: ReturnRecord = { ...ret, id: newId };
        const amtH = toHalalas(ret.amount);

        let nextMovements = [...p.stockMovements];
        const updatedProducts = p.products.map((pr) => {
          if (pr.id === ret.productId || pr.name === ret.productName) {
            const delta = ret.type === 'sales' ? ret.qty : -ret.qty;
            nextMovements = [
              {
                id: nextSequentialId('MOV', 100, nextMovements.map((m) => m.id)),
                productId: pr.id,
                productName: pr.name,
                movementType: ret.type === 'sales' ? 'return_in' : 'return_out',
                qtyDelta: delta,
                referenceId: newId,
                notes: ret.notes || ret.partyName,
                date: ret.date,
              },
              ...nextMovements,
            ];
            return { ...pr, qty: Math.max(0, pr.qty + delta) };
          }
          return pr;
        });

        const updatedCustomers =
          ret.type === 'sales'
            ? p.customers.map((c) =>
                c.name.trim() === ret.partyName.trim()
                  ? { ...c, debt: Math.max(0, fromHalalas(toHalalas(c.debt) - amtH)) }
                  : c,
              )
            : p.customers;

        const updatedSuppliers =
          ret.type === 'purchase'
            ? p.suppliers.map((s) =>
                s.name.trim() === ret.partyName.trim()
                  ? { ...s, payable: Math.max(0, fromHalalas(toHalalas(s.payable) - amtH)) }
                  : s,
              )
            : p.suppliers;

        const cleanAmt = fromHalalas(amtH);
        const autoJournal: JournalEntry = {
          id: nextSequentialId('JRN', 700, p.journals.map((x) => x.id)),
          reference: newId,
          description:
            ret.type === 'sales'
              ? `مرتجع مبيعات - ${ret.partyName} (${ret.productName})`
              : `مرتجع مشتريات - ${ret.partyName} (${ret.productName})`,
          date: ret.date,
          lines:
            ret.type === 'sales'
              ? [
                  { account: '4020 - مردودات ومسموحات المبيعات', debit: cleanAmt, credit: 0 },
                  { account: `1020 - ذمم العملاء (${ret.partyName})`, debit: 0, credit: cleanAmt },
                ]
              : [
                  { account: `2010 - ذمم الموردين (${ret.partyName})`, debit: cleanAmt, credit: 0 },
                  { account: '5020 - مردودات المشتريات', debit: 0, credit: cleanAmt },
                ],
        };

        return {
          ...p,
          returns: [newRet, ...p.returns],
          products: updatedProducts,
          customers: updatedCustomers,
          suppliers: updatedSuppliers,
          journals: [autoJournal, ...p.journals],
          stockMovements: nextMovements,
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'create', 'Return', newId, `مرتجع ${ret.type} رقم ${newId} بقيمة ${cleanAmt}`),
            ...p.auditLogs,
          ],
        };
      });
    },
    deleteReturn: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        returns: p.returns.filter((r) => r.id !== id),
        auditLogs: [makeAuditEntry(p, actorLabel, 'delete', 'Return', id, `حذف المرتجع ${id}`), ...p.auditLogs],
      }));
    },
    deleteAllReturns: () => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({ ...p, returns: [] }));
    },

    saveQuotation: (qt: Omit<Quotation, 'id'>, editId?: string) =>
      setState((p) => ({
        ...p,
        quotations: editId
          ? p.quotations.map((x) => (x.id === editId ? { ...qt, id: editId } : x))
          : [{ ...qt, id: nextSequentialId('QT', 200, p.quotations.map((x) => x.id)) }, ...p.quotations],
      })),
    deleteQuotation: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({ ...p, quotations: p.quotations.filter((q) => q.id !== id) }));
    },
    deleteAllQuotations: () => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({ ...p, quotations: [] }));
    },
    convertQuotationToInvoice: (qtId: string) => {
      const s = latestStateRef.current;
      const qt = s.quotations.find((q) => q.id === qtId);
      if (!qt) return { ok: false as const };
      const netSubH = Math.max(0, toHalalas(qt.subtotal) - toHalalas(qt.discountAmount));
      const salesRate = Math.max(0, Math.min(100, s.settings.defaultSalesTaxRate ?? 15));
      const calc = computeInvoiceTotalsHalala({
        subtotal: fromHalalas(netSubH),
        taxRate: salesRate,
        fxRate: 1,
        status: 'pending',
      });
      const matchedCustomer = s.customers.find(
        (c) => (qt.customerId && c.id === qt.customerId) || c.name.trim() === qt.customerName.trim(),
      );
      if (
        matchedCustomer &&
        typeof matchedCustomer.creditLimit === 'number' &&
        Number.isFinite(matchedCustomer.creditLimit)
      ) {
        const projectedDebtH = toHalalas(matchedCustomer.debt) + toHalalas(calc.total);
        const limitH = toHalalas(matchedCustomer.creditLimit);
        if (projectedDebtH > limitH) {
          return {
            ok: false as const,
            creditLimit: matchedCustomer.creditLimit,
            exceededBy: fromHalalas(projectedDebtH - limitH),
          };
        }
      }

      setState((p) => {
        const qItem = p.quotations.find((q) => q.id === qtId);
        if (!qItem) return p;
        const targetCust = p.customers.find(
          (c) => (qItem.customerId && c.id === qItem.customerId) || c.name.trim() === qItem.customerName.trim(),
        );
        const newInvId = nextSequentialId('INV', 1000, p.invoices.map((x) => x.id));
        const nowIso = new Date().toISOString();
        const newInv: Invoice = {
          id: newInvId,
          customerId: targetCust?.id ?? qItem.customerId,
          customerName: qItem.customerName,
          customerPhone: qItem.customerPhone,
          description: `${qItem.id} · ${qItem.items.map((i) => `${i.productName} ×${i.qty}`).join(', ')}`,
          items: qItem.items,
          subtotal: calc.subtotal,
          taxRate: salesRate,
          vat: calc.vat,
          total: calc.total,
          paidAmount: 0,
          remainingAmount: calc.total,
          status: 'pending',
          date: nowIso,
          invoiceType: 'sales',
        };
        const updatedProducts = p.products.map((pr) => {
          const item = qItem.items.find((i) => i.productId === pr.id || i.productName === pr.name);
          return item ? { ...pr, qty: Math.max(0, pr.qty - item.qty) } : pr;
        });
        const updatedCustomers = p.customers.map((c) =>
          (targetCust && c.id === targetCust.id) || c.name.trim() === qItem.customerName.trim()
            ? { ...c, debt: fromHalalas(toHalalas(c.debt) + toHalalas(calc.total)) }
            : c,
        );
        const autoJournal: JournalEntry = {
          id: nextSequentialId('JRN', 700, p.journals.map((x) => x.id)),
          reference: newInvId,
          description: `تحويل عرض السعر ${qItem.id} إلى فاتورة ${newInvId}`,
          date: nowIso,
          lines: [
            { account: `1020 - ذمم العملاء (${qItem.customerName})`, debit: calc.total, credit: 0 },
            { account: '4010 - إيرادات المبيعات', debit: 0, credit: calc.subtotal },
            ...(calc.vat > 0 ? [{ account: '2020 - ضريبة القيمة المضافة', debit: 0, credit: calc.vat }] : []),
          ],
        };
        return {
          ...p,
          quotations: p.quotations.map((q) => (q.id === qtId ? { ...q, status: 'accepted' } : q)),
          invoices: [newInv, ...p.invoices],
          products: updatedProducts,
          customers: updatedCustomers,
          journals: [autoJournal, ...p.journals],
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'create', 'Invoice', newInvId, `تحويل عرض سعر ${qItem.id} إلى فاتورة ${newInvId}`),
            ...p.auditLogs,
          ],
        };
      });
      return { ok: true as const };
    },

    saveCustomer: (c: Omit<Customer, 'id'>, editId?: string) =>
      setState((p) => {
        const nextId = editId ?? nextSequentialId('C', 100, p.customers.map((x) => x.id));
        return {
          ...p,
          customers: editId
            ? p.customers.map((x) => (x.id === editId ? { ...c, id: editId } : x))
            : [{ ...c, id: nextId, createdAtDate: c.createdAtDate ?? new Date().toISOString().slice(0, 10), createdBy: c.createdBy ?? actorLabel }, ...p.customers],
          auditLogs: [
            makeAuditEntry(p, actorLabel, editId ? 'update' : 'create', 'Customer', nextId, `${editId ? 'تحديث' : 'إضافة'} عميل ${c.name}`),
            ...p.auditLogs,
          ],
        };
      }),
    importCustomersBulk: (items: Omit<Customer, 'id'>[]) => {
      if (items.length === 0) return 0;
      setState((p) => {
        const ids = p.customers.map((x) => x.id);
        const created: Customer[] = items.map((c) => {
          const nextId = nextSequentialId('C', 100, ids);
          ids.push(nextId);
          return { ...c, id: nextId };
        });
        return { ...p, customers: [...created, ...p.customers] };
      });
      return items.length;
    },
    deleteCustomer: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        customers: p.customers.filter((c) => c.id !== id),
        auditLogs: [makeAuditEntry(p, actorLabel, 'delete', 'Customer', id, `حذف العميل ${id}`), ...p.auditLogs],
      }));
    },

    saveSupplier: (s: Omit<Supplier, 'id'>, editId?: string) =>
      setState((p) => {
        const nextId = editId ?? nextSequentialId('S', 200, p.suppliers.map((x) => x.id));
        return {
          ...p,
          suppliers: editId
            ? p.suppliers.map((x) => (x.id === editId ? { ...s, id: editId } : x))
            : [{ ...s, id: nextId, createdAtDate: s.createdAtDate ?? new Date().toISOString().slice(0, 10), createdBy: s.createdBy ?? actorLabel }, ...p.suppliers],
          auditLogs: [
            makeAuditEntry(p, actorLabel, editId ? 'update' : 'create', 'Supplier', nextId, `${editId ? 'تحديث' : 'إضافة'} مورد ${s.name}`),
            ...p.auditLogs,
          ],
        };
      }),
    importSuppliersBulk: (items: Omit<Supplier, 'id'>[]) => {
      if (items.length === 0) return 0;
      setState((p) => {
        const ids = p.suppliers.map((x) => x.id);
        const created: Supplier[] = items.map((s) => {
          const nextId = nextSequentialId('S', 200, ids);
          ids.push(nextId);
          return { ...s, id: nextId };
        });
        return { ...p, suppliers: [...created, ...p.suppliers] };
      });
      return items.length;
    },
    deleteSupplier: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        suppliers: p.suppliers.filter((s) => s.id !== id),
        auditLogs: [makeAuditEntry(p, actorLabel, 'delete', 'Supplier', id, `حذف المورد ${id}`), ...p.auditLogs],
      }));
    },

    addPurchaseOrder: (
      po: Omit<PurchaseOrder, 'id' | 'subtotal' | 'vat' | 'total' | 'status' | 'date'>,
    ) => {
      const nowIso = new Date().toISOString();
      if (!guardFiscalOpen(nowIso)) return;
      setState((p) => {
        const rate = Math.max(0, Math.min(100, po.taxRate ?? p.settings.defaultPurchaseTaxRate ?? 15));
        const calc = computeInvoiceTotalsHalala({
          subtotal: fromHalalas(Math.round(po.quantity * toHalalas(po.unitCost))),
          taxRate: rate,
          fxRate: 1,
          status: 'pending',
        });
        const newId = nextSequentialId('PO', 300, p.purchaseOrders.map((x) => x.id));
        return {
          ...p,
          purchaseOrders: [
            {
              ...po,
              id: newId,
              subtotal: calc.subtotal,
              taxRate: rate,
              vat: calc.vat,
              total: calc.total,
              status: 'ordered',
              date: nowIso,
            },
            ...p.purchaseOrders,
          ],
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'create', 'PurchaseOrder', newId, `أمر شراء ${newId} - ${po.supplierName}`),
            ...p.auditLogs,
          ],
        };
      });
    },
    receivePurchaseOrder: (poId: string) => {
      const nowIso = new Date().toISOString();
      if (!guardFiscalOpen(nowIso)) return;
      setState((p) => {
        const target = p.purchaseOrders.find((x) => x.id === poId);
        if (!target || target.status === 'received') return p;
        const matched = p.products.some(
          (pr) => pr.id === target.productId || pr.name === target.productName,
        );
        const updatedProducts = matched
          ? p.products.map((pr) =>
              pr.id === target.productId || pr.name === target.productName
                ? { ...pr, qty: pr.qty + target.quantity, cost: target.unitCost }
                : pr,
            )
          : [
              {
                id: nextSequentialId('P', 10, p.products.map((x) => x.id)),
                name: target.productName,
                sku: `SKU-${target.quantity}`,
                barcode: generateEan13(),
                qty: target.quantity,
                cost: target.unitCost,
                price: fromHalalas(Math.round(toHalalas(target.unitCost) * 1.25)),
                warehouseId: target.warehouseId ?? p.warehouses[0]?.id,
              },
              ...p.products,
            ];
        const poTotalH = toHalalas(target.total);
        const paidH = Math.min(poTotalH, Math.max(0, toHalalas(target.paidAmount ?? 0)));
        const remH = poTotalH - paidH;
        const updatedSuppliers = p.suppliers.map((s) =>
          (target.supplierId && s.id === target.supplierId) ||
          s.name.trim() === target.supplierName.trim()
            ? { ...s, payable: fromHalalas(toHalalas(s.payable) + remH) }
            : s,
        );
        const poSubH = toHalalas(target.subtotal ?? fromHalalas(Math.round(target.quantity * toHalalas(target.unitCost))));
        const poVatH = Math.max(0, poTotalH - poSubH);
        const autoJournal: JournalEntry = {
          id: nextSequentialId('JRN', 700, p.journals.map((x) => x.id)),
          reference: target.id,
          description: p.settings.isArabic
            ? `استلام أمر شراء ${target.id} - ${target.supplierName}`
            : `PO ${target.id} received - ${target.supplierName}`,
          date: nowIso,
          lines: [
            { account: `1030 - المخزون (${target.productName})`, debit: fromHalalas(poSubH), credit: 0 },
            ...(poVatH > 0 ? [{ account: '1040 - ضريبة مدخلات المشتريات', debit: fromHalalas(poVatH), credit: 0 }] : []),
            ...(paidH > 0 ? [{ account: '1010 - الصندوق النقدي', debit: 0, credit: fromHalalas(paidH) }] : []),
            ...(remH > 0 ? [{ account: `2010 - ذمم الموردين (${target.supplierName})`, debit: 0, credit: fromHalalas(remH) }] : []),
          ],
        };
        const movement: StockMovement = {
          id: nextSequentialId('MOV', 100, p.stockMovements.map((m) => m.id)),
          productId: target.productId,
          productName: target.productName,
          movementType: 'purchase',
          qtyDelta: target.quantity,
          toWarehouseId: target.warehouseId ?? p.warehouses[0]?.id,
          referenceId: target.id,
          notes: target.supplierName,
          date: nowIso,
        };
        return {
          ...p,
          purchaseOrders: p.purchaseOrders.map((x) => (x.id === poId ? { ...x, status: 'received' } : x)),
          products: updatedProducts,
          suppliers: updatedSuppliers,
          journals: [autoJournal, ...p.journals],
          stockMovements: [movement, ...p.stockMovements],
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'receive', 'PurchaseOrder', poId, `استلام أمر شراء ${poId} (${target.productName} ×${target.quantity})`),
            ...p.auditLogs,
          ],
        };
      });
    },
    deletePurchaseOrder: (poId: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        purchaseOrders: p.purchaseOrders.filter((po) => po.id !== poId),
        auditLogs: [makeAuditEntry(p, actorLabel, 'delete', 'PurchaseOrder', poId, `حذف أمر الشراء ${poId}`), ...p.auditLogs],
      }));
    },

    saveVoucher: (v: Omit<Voucher, 'id'>, editId?: string) => {
      if (!guardFiscalOpen(v.date)) return;
      setState((p) => {
        if (editId) {
          return {
            ...p,
            vouchers: p.vouchers.map((x) => (x.id === editId ? { ...v, id: editId } : x)),
            auditLogs: [makeAuditEntry(p, actorLabel, 'update', 'Voucher', editId, `تعديل سند ${editId}`), ...p.auditLogs],
          };
        }
        const newId = nextSequentialId('VCH', 500, p.vouchers.map((x) => x.id));
        const cleanAmt = fromHalalas(toHalalas(v.amount));
        const amtH = toHalalas(cleanAmt);
        const newV: Voucher = { ...v, id: newId, amount: cleanAmt };
        const matchedBank = p.banks.find(
          (b) =>
            b.id === v.paymentMethod ||
            b.nameEn.toLowerCase() === v.paymentMethod.trim().toLowerCase() ||
            b.nameAr.trim() === v.paymentMethod.trim(),
        );
        const bankDeltaH = v.type === 'receipt' ? amtH : -amtH;
        const updatedBanks = matchedBank
          ? p.banks.map((b) =>
              b.id === matchedBank.id ? { ...b, balance: fromHalalas(toHalalas(b.balance) + bankDeltaH) } : b,
            )
          : p.banks;
        const updatedCustomers =
          v.type === 'receipt'
            ? p.customers.map((c) =>
                c.name.trim() === v.partyName.trim()
                  ? { ...c, debt: Math.max(0, fromHalalas(toHalalas(c.debt) - amtH)) }
                  : c,
              )
            : p.customers;
        const updatedSuppliers =
          v.type === 'payment'
            ? p.suppliers.map((s) =>
                s.name.trim() === v.partyName.trim()
                  ? { ...s, payable: Math.max(0, fromHalalas(toHalalas(s.payable) - amtH)) }
                  : s,
              )
            : p.suppliers;
        const bankLabel = matchedBank
          ? `1010 - ${p.settings.isArabic ? matchedBank.nameAr : matchedBank.nameEn}`
          : `1010 - ${v.paymentMethod || 'Cash'}`;
        const autoJournal: JournalEntry = {
          id: nextSequentialId('JRN', 700, p.journals.map((x) => x.id)),
          reference: newId,
          description:
            v.type === 'receipt'
              ? p.settings.isArabic
                ? `سند قبض ${newId} - ${v.partyName}`
                : `Receipt ${newId} - ${v.partyName}`
              : p.settings.isArabic
              ? `سند صرف ${newId} - ${v.partyName}`
              : `Payment ${newId} - ${v.partyName}`,
          date: v.date,
          lines:
            v.type === 'receipt'
              ? [
                  { account: bankLabel, debit: cleanAmt, credit: 0 },
                  { account: `1020 - ذمم العملاء (${v.partyName})`, debit: 0, credit: cleanAmt },
                ]
              : [
                  { account: `2010 - ذمم الموردين (${v.partyName})`, debit: cleanAmt, credit: 0 },
                  { account: bankLabel, debit: 0, credit: cleanAmt },
                ],
        };
        return {
          ...p,
          vouchers: [newV, ...p.vouchers],
          customers: updatedCustomers,
          suppliers: updatedSuppliers,
          banks: updatedBanks,
          journals: [autoJournal, ...p.journals],
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'create', 'Voucher', newId, `سند ${v.type === 'receipt' ? 'قبض' : 'صرف'} ${newId} بمبلغ ${cleanAmt}`),
            ...p.auditLogs,
          ],
        };
      });
    },
    deleteVoucher: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        vouchers: p.vouchers.filter((v) => v.id !== id),
        auditLogs: [makeAuditEntry(p, actorLabel, 'delete', 'Voucher', id, `حذف السند ${id}`), ...p.auditLogs],
      }));
    },

    saveJournal: (j: Omit<JournalEntry, 'id'>, editId?: string) => {
      if (!guardFiscalOpen(j.date)) return;
      setState((p) => {
        const nextId = editId ?? nextSequentialId('JRN', 700, p.journals.map((x) => x.id));
        return {
          ...p,
          journals: editId
            ? p.journals.map((x) => (x.id === editId ? { ...j, id: editId } : x))
            : [{ ...j, id: nextId }, ...p.journals],
          auditLogs: [
            makeAuditEntry(p, actorLabel, editId ? 'update' : 'create', 'Journal', nextId, `قيد يومي ${nextId}: ${j.description}`),
            ...p.auditLogs,
          ],
        };
      });
    },
    deleteJournal: (id: string) => {
      if (!guardDeleteAllowed()) return;
      const target = latestStateRef.current.journals.find((j) => j.id === id);
      if (target && !guardFiscalOpen(target.date)) return;
      setState((p) => ({
        ...p,
        journals: p.journals.filter((j) => j.id !== id),
        auditLogs: [makeAuditEntry(p, actorLabel, 'delete', 'Journal', id, `حذف القيد ${id}`), ...p.auditLogs],
      }));
    },

    saveProduct: (pr: Omit<Product, 'id'>, editId?: string) =>
      setState((p) => {
        const nextId = editId ?? nextSequentialId('P', 10, p.products.map((x) => x.id));
        return {
          ...p,
          products: editId
            ? p.products.map((x) => (x.id === editId ? { ...pr, id: editId } : x))
            : [{ ...pr, id: nextId }, ...p.products],
          auditLogs: [
            makeAuditEntry(p, actorLabel, editId ? 'update' : 'create', 'Product', nextId, `${editId ? 'تعديل' : 'إضافة'} صنف ${pr.name}`),
            ...p.auditLogs,
          ],
        };
      }),
    importProductsBulk: (items: Omit<Product, 'id'>[]) => {
      if (items.length === 0) return 0;
      setState((p) => {
        const ids = p.products.map((x) => x.id);
        const created: Product[] = items.map((pr) => {
          const nextId = nextSequentialId('P', 10, ids);
          ids.push(nextId);
          return { ...pr, id: nextId };
        });
        return { ...p, products: [...created, ...p.products] };
      });
      return items.length;
    },
    addTenStock: (id: string) =>
      setState((p) => {
        const target = p.products.find((pr) => pr.id === id);
        if (!target) return p;
        const mov: StockMovement = {
          id: nextSequentialId('MOV', 100, p.stockMovements.map((m) => m.id)),
          productId: target.id,
          productName: target.name,
          movementType: 'purchase',
          qtyDelta: 10,
          toWarehouseId: target.warehouseId ?? p.warehouses[0]?.id,
          referenceId: 'QUICK-ADD',
          notes: '+10 Quick Restock',
          date: new Date().toISOString(),
        };
        return {
          ...p,
          products: p.products.map((pr) => (pr.id === id ? { ...pr, qty: pr.qty + 10 } : pr)),
          stockMovements: [mov, ...p.stockMovements],
        };
      }),
    deleteProduct: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        products: p.products.filter((pr) => pr.id !== id),
        auditLogs: [makeAuditEntry(p, actorLabel, 'delete', 'Product', id, `حذف الصنف ${id}`), ...p.auditLogs],
      }));
    },

    transferStockBetweenWarehouses: (
      productId: string,
      fromWarehouseId: string,
      toWarehouseId: string,
      qty: number,
      notes: string,
    ) => {
      if (!productId || !fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId || qty <= 0) {
        return false;
      }
      setState((p) => {
        const prod = p.products.find((x) => x.id === productId);
        if (!prod) return p;
        const nowIso = new Date().toISOString();
        const mov: StockMovement = {
          id: nextSequentialId('MOV', 100, p.stockMovements.map((m) => m.id)),
          productId: prod.id,
          productName: prod.name,
          movementType: 'transfer',
          qtyDelta: qty,
          fromWarehouseId,
          toWarehouseId,
          referenceId: `TRF-${Date.now().toString(36).slice(-4).toUpperCase()}`,
          notes: notes || `تحويل ${qty} وحدة`,
          date: nowIso,
        };
        return {
          ...p,
          products: p.products.map((pr) => (pr.id === productId ? { ...pr, warehouseId: toWarehouseId } : pr)),
          stockMovements: [mov, ...p.stockMovements],
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'transfer', 'Inventory', productId, `تحويل مخزني ${qty} من ${prod.name}`),
            ...p.auditLogs,
          ],
        };
      });
      return true;
    },

    recordStocktake: (warehouseId: string, productId: string, actualQty: number, notes: string) => {
      const nowIso = new Date().toISOString();
      if (!guardFiscalOpen(nowIso)) return false;
      setState((p) => {
        const prod = p.products.find((x) => x.id === productId);
        if (!prod) return p;
        const wh = p.warehouses.find((w) => w.id === warehouseId);
        const varianceQty = actualQty - prod.qty;
        const varianceValueH = Math.round(toHalalas(prod.cost) * varianceQty);
        const varianceValue = fromHalalas(varianceValueH);
        const stkId = nextSequentialId('STK', 100, p.stocktakes.map((s) => s.id));
        const rec: StocktakeRecord = {
          id: stkId,
          warehouseId: wh?.id ?? warehouseId,
          warehouseName: wh ? (p.settings.isArabic ? wh.nameAr : wh.nameEn) : warehouseId,
          productId: prod.id,
          productName: prod.name,
          systemQty: prod.qty,
          actualQty,
          varianceQty,
          varianceValue,
          notes: notes || (p.settings.isArabic ? 'تسوية جرد فعلي' : 'Physical stocktake adjustment'),
          date: nowIso,
        };
        const mov: StockMovement = {
          id: nextSequentialId('MOV', 100, p.stockMovements.map((m) => m.id)),
          productId: prod.id,
          productName: prod.name,
          movementType: 'stocktake',
          qtyDelta: varianceQty,
          toWarehouseId: warehouseId,
          referenceId: stkId,
          notes: `System ${prod.qty} -> Actual ${actualQty}`,
          date: nowIso,
        };
        const absVal = Math.abs(varianceValue);
        const nextJournals =
          absVal > 0
            ? [
                {
                  id: nextSequentialId('JRN', 700, p.journals.map((j) => j.id)),
                  reference: stkId,
                  description: `تسوية جرد ${stkId} - ${prod.name} (فرق ${varianceQty})`,
                  date: nowIso,
                  lines:
                    varianceQty > 0
                      ? [
                          { account: `1030 - المخزون (${prod.name})`, debit: absVal, credit: 0 },
                          { account: '5040 - فروقات جرد وتسوية نقدية', debit: 0, credit: absVal },
                        ]
                      : [
                          { account: '5040 - فروقات جرد وتسوية نقدية', debit: absVal, credit: 0 },
                          { account: `1030 - المخزون (${prod.name})`, debit: 0, credit: absVal },
                        ],
                },
                ...p.journals,
              ]
            : p.journals;

        return {
          ...p,
          products: p.products.map((x) => (x.id === productId ? { ...x, qty: actualQty } : x)),
          stocktakes: [rec, ...p.stocktakes],
          stockMovements: [mov, ...p.stockMovements],
          journals: nextJournals,
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'stocktake', 'Product', productId, `جرد فعلي ${prod.name}: نظام ${prod.qty} / فعلي ${actualQty}`),
            ...p.auditLogs,
          ],
        };
      });
      return true;
    },

    saveBranch: (br: Omit<Branch, 'id'>, editId?: string) =>
      setState((p) => {
        const id = editId ?? nextSequentialId('BR', 1, p.branches.map((x) => x.id));
        return {
          ...p,
          branches: editId ? p.branches.map((x) => (x.id === editId ? { ...br, id } : x)) : [{ ...br, id }, ...p.branches],
        };
      }),
    deleteBranch: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        branches: p.branches.length > 1 ? p.branches.filter((b) => b.id !== id) : p.branches,
      }));
    },

    saveWarehouse: (wh: Omit<Warehouse, 'id'>, editId?: string) =>
      setState((p) => {
        const id = editId ?? nextSequentialId('WH', 1, p.warehouses.map((x) => x.id));
        return {
          ...p,
          warehouses: editId ? p.warehouses.map((x) => (x.id === editId ? { ...wh, id } : x)) : [{ ...wh, id }, ...p.warehouses],
        };
      }),
    deleteWarehouse: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        warehouses: p.warehouses.length > 1 ? p.warehouses.filter((w) => w.id !== id) : p.warehouses,
      }));
    },

    saveChartAccount: (acc: Omit<ChartAccount, 'id'>, editId?: string) =>
      setState((p) => {
        const id = editId ?? `COA-${acc.code.replace(/[^a-zA-Z0-9]/g, '') || Date.now().toString(36)}`;
        return {
          ...p,
          chartOfAccounts: editId
            ? p.chartOfAccounts.map((x) => (x.id === editId ? { ...acc, id } : x))
            : [...p.chartOfAccounts, { ...acc, id }],
        };
      }),
    deleteChartAccount: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        chartOfAccounts: p.chartOfAccounts.filter((x) => x.id !== id || x.isSystem),
      }));
    },

    saveEmployee: (emp: Omit<Employee, 'id'>, editId?: string) =>
      setState((p) => ({
        ...p,
        employees: editId
          ? p.employees.map((x) => (x.id === editId ? { ...emp, id: editId } : x))
          : [{ ...emp, id: nextSequentialId('E', 10, p.employees.map((x) => x.id)) }, ...p.employees],
      })),
    paySalary: (id: string) => {
      const nowIso = new Date().toISOString();
      if (!guardFiscalOpen(nowIso)) return;
      setState((p) => {
        const emp = p.employees.find((e) => e.id === id);
        if (!emp) return p;
        const targetBank =
          p.banks.find((b) => b.id === 'alrajhi') ??
          p.banks.find((b) => b.id === 'cash') ??
          p.banks[0];
        const bankId = targetBank?.id ?? 'alrajhi';
        const expId = nextSequentialId('EXP', 900, p.expenses.map((x) => x.id));
        const salH = toHalalas(emp.salary);
        const cleanSalary = fromHalalas(salH);
        const newExp: Expense = {
          id: expId,
          title: p.settings.isArabic ? `راتب ${emp.name}` : `Salary - ${emp.name}`,
          category: p.settings.isArabic ? 'الرواتب والأجور' : 'Payroll',
          amount: cleanSalary,
          paidFromBankId: bankId,
          date: nowIso,
        };
        const autoJournal: JournalEntry = {
          id: nextSequentialId('JRN', 700, p.journals.map((x) => x.id)),
          reference: expId,
          description: p.settings.isArabic ? `صرف راتب ${emp.name}` : `Salary payment - ${emp.name}`,
          date: nowIso,
          lines: [
            { account: '5030 - الرواتب والأجور', debit: cleanSalary, credit: 0 },
            {
              account: `1010 - ${targetBank ? (p.settings.isArabic ? targetBank.nameAr : targetBank.nameEn) : bankId}`,
              debit: 0,
              credit: cleanSalary,
            },
          ],
        };
        return {
          ...p,
          employees: p.employees.map((e) => (e.id === id ? { ...e, lastPaidDate: nowIso } : e)),
          banks: targetBank
            ? p.banks.map((b) => (b.id === bankId ? { ...b, balance: fromHalalas(toHalalas(b.balance) - salH) } : b))
            : p.banks,
          expenses: [newExp, ...p.expenses],
          journals: [autoJournal, ...p.journals],
          auditLogs: [makeAuditEntry(p, actorLabel, 'pay', 'Employee', id, `صرف راتب ${emp.name} (${cleanSalary})`), ...p.auditLogs],
        };
      });
    },
    deleteEmployee: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({ ...p, employees: p.employees.filter((e) => e.id !== id) }));
    },

    saveExpense: (exp: Omit<Expense, 'id'>, editId?: string) => {
      if (!guardFiscalOpen(exp.date)) return;
      setState((p) => {
        if (editId) {
          const prevExp = p.expenses.find((x) => x.id === editId);
          const updatedBanks = p.banks.map((b) => {
            let deltaH = 0;
            if (prevExp && prevExp.paidFromBankId === b.id) deltaH += toHalalas(prevExp.amount);
            if (exp.paidFromBankId === b.id) deltaH -= toHalalas(exp.amount);
            return deltaH !== 0 ? { ...b, balance: fromHalalas(toHalalas(b.balance) + deltaH) } : b;
          });
          return {
            ...p,
            expenses: p.expenses.map((x) => (x.id === editId ? { ...exp, id: editId } : x)),
            banks: updatedBanks,
            auditLogs: [makeAuditEntry(p, actorLabel, 'update', 'Expense', editId, `تعديل مصروف ${exp.title}`), ...p.auditLogs],
          };
        }
        const newId = nextSequentialId('EXP', 900, p.expenses.map((x) => x.id));
        const expH = toHalalas(exp.amount);
        const cleanAmt = fromHalalas(expH);
        const paidBank = p.banks.find((b) => b.id === exp.paidFromBankId);
        const updatedBanks = paidBank
          ? p.banks.map((b) =>
              b.id === paidBank.id ? { ...b, balance: fromHalalas(toHalalas(b.balance) - expH) } : b,
            )
          : p.banks;
        const autoJournal: JournalEntry = {
          id: nextSequentialId('JRN', 700, p.journals.map((x) => x.id)),
          reference: newId,
          description: `${exp.title} (${exp.category || (p.settings.isArabic ? 'مصروف' : 'Expense')})`,
          date: exp.date,
          lines: [
            { account: `5010 - مصروفات (${exp.category || 'تشغيل'})`, debit: cleanAmt, credit: 0 },
            {
              account: `1010 - ${paidBank ? (p.settings.isArabic ? paidBank.nameAr : paidBank.nameEn) : exp.paidFromBankId}`,
              debit: 0,
              credit: cleanAmt,
            },
          ],
        };
        return {
          ...p,
          expenses: [{ ...exp, id: newId, amount: cleanAmt }, ...p.expenses],
          banks: updatedBanks,
          journals: [autoJournal, ...p.journals],
          auditLogs: [makeAuditEntry(p, actorLabel, 'create', 'Expense', newId, `مصروف ${exp.title} (${cleanAmt})`), ...p.auditLogs],
        };
      });
    },
    deleteExpense: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        expenses: p.expenses.filter((e) => e.id !== id),
        auditLogs: [makeAuditEntry(p, actorLabel, 'delete', 'Expense', id, `حذف المصروف ${id}`), ...p.auditLogs],
      }));
    },

    updateBankBalance: (id: string, balance: number) =>
      setState((p) => ({
        ...p,
        banks: p.banks.map((b) => (b.id === id ? { ...b, balance: fromHalalas(toHalalas(balance)) } : b)),
      })),
    saveBankAccount: (account: Omit<BankAccount, 'id'>, editId?: string) =>
      setState((p) => ({
        ...p,
        banks: editId
          ? p.banks.map((b) => (b.id === editId ? { ...account, id: editId } : b))
          : [{ ...account, id: `BNK-${Date.now().toString(36)}` }, ...p.banks],
      })),
    deleteBankAccount: (id: string) => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        banks: id === 'cash' ? p.banks : p.banks.filter((b) => b.id !== id),
      }));
    },
    reconcileBankAccount: (bankId: string, statementBalance: number) => {
      const nowIso = new Date().toISOString();
      if (!guardFiscalOpen(nowIso)) return false;
      setState((p) => {
        const bank = p.banks.find((b) => b.id === bankId);
        if (!bank) return p;
        const diff = computeBankReconciliationDiff(bank, statementBalance);
        const absVar = Math.abs(diff.variance);
        const bankLabel = p.settings.isArabic ? bank.nameAr : bank.nameEn;
        const nextJournals =
          absVar > 0
            ? [
                {
                  id: nextSequentialId('JRN', 700, p.journals.map((j) => j.id)),
                  reference: `REC-${bank.id}`,
                  description: p.settings.isArabic
                    ? `تسوية تلقائية لحساب ${bankLabel} (فرق ${diff.variance})`
                    : `Auto-reconciliation for ${bankLabel} (variance ${diff.variance})`,
                  date: nowIso,
                  lines:
                    diff.variance > 0
                      ? [
                          { account: `1010 - ${bankLabel}`, debit: absVar, credit: 0 },
                          { account: '5040 - فروقات جرد وتسوية نقدية', debit: 0, credit: absVar },
                        ]
                      : [
                          { account: '5040 - فروقات جرد وتسوية نقدية', debit: absVar, credit: 0 },
                          { account: `1010 - ${bankLabel}`, debit: 0, credit: absVar },
                        ],
                },
                ...p.journals,
              ]
            : p.journals;

        return {
          ...p,
          banks: p.banks.map((b) =>
            b.id === bankId
              ? { ...b, balance: diff.statementBalance, lastReconciledDate: nowIso.slice(0, 10) }
              : b,
          ),
          journals: nextJournals,
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'reconcile', 'BankAccount', bankId, `تسوية ${bankLabel} من ${diff.systemBalance} إلى ${diff.statementBalance}`),
            ...p.auditLogs,
          ],
        };
      });
      return true;
    },
    transferBetweenBanks: (fromId: string, toId: string, amount: number, notes?: string) => {
      if (!fromId || !toId || fromId === toId || !Number.isFinite(amount) || amount <= 0) {
        return false;
      }
      const nowIso = new Date().toISOString();
      if (!guardFiscalOpen(nowIso)) return false;
      const amtH = toHalalas(amount);
      const cleanAmt = fromHalalas(amtH);
      setState((p) => {
        const fromAcc = p.banks.find((b) => b.id === fromId);
        const toAcc = p.banks.find((b) => b.id === toId);
        if (!fromAcc || !toAcc) return p;
        const fromLabel = p.settings.isArabic ? fromAcc.nameAr : fromAcc.nameEn;
        const toLabel = p.settings.isArabic ? toAcc.nameAr : toAcc.nameEn;
        const refId = `TRF-${Date.now().toString(36).slice(-4).toUpperCase()}`;
        const autoJournal: JournalEntry = {
          id: nextSequentialId('JRN', 700, p.journals.map((x) => x.id)),
          reference: refId,
          description: notes?.trim()
            ? notes.trim()
            : p.settings.isArabic
            ? `تحويل نقدي من ${fromLabel} إلى ${toLabel}`
            : `Funds transfer from ${fromLabel} to ${toLabel}`,
          date: nowIso,
          lines: [
            { account: `1010 - ${toLabel}`, debit: cleanAmt, credit: 0 },
            { account: `1010 - ${fromLabel}`, debit: 0, credit: cleanAmt },
          ],
        };
        return {
          ...p,
          banks: p.banks.map((b) => {
            if (b.id === fromId) return { ...b, balance: fromHalalas(toHalalas(b.balance) - amtH) };
            if (b.id === toId) return { ...b, balance: fromHalalas(toHalalas(b.balance) + amtH) };
            return b;
          }),
          journals: [autoJournal, ...p.journals],
          auditLogs: [
            makeAuditEntry(p, actorLabel, 'transfer', 'BankAccount', refId, `تحويل ${cleanAmt} من ${fromLabel} إلى ${toLabel}`),
            ...p.auditLogs,
          ],
        };
      });
      return true;
    },

    exportBackupJson: () => {
      const nowIso = new Date().toISOString();
      const snapshotPayload: PersistedState = {
        ...state,
        settings: { ...state.settings, lastBackupDate: nowIso },
      };
      const json = JSON.stringify(snapshotPayload, null, 2);
      const dateKey = getLocalDateKey();
      void saveDailySnapshot({
        id: dateKey,
        dateKey,
        createdAt: nowIso,
        sizeBytes: new Blob([json]).size,
        json,
      }).then(() => listDailySnapshotMeta().then(setIdbSnapshots));
      setState((p) => ({ ...p, settings: { ...p.settings, lastBackupDate: nowIso } }));
      return json;
    },
    saveDailySnapshotToIndexedDb: () => saveDailySnapshotToIndexedDb(true),
    getLatestIndexedDbBackup: async (): Promise<DailyBackupRecord | null> => {
      const latest = await getLatestDailySnapshot();
      if (latest) return latest;
      return saveDailySnapshotToIndexedDb(true);
    },
    getDailySnapshotByDate: (dateKey: string): Promise<DailyBackupRecord | null> =>
      getDailySnapshot(dateKey),
    restoreDailySnapshotByDate: async (dateKey: string): Promise<boolean> => {
      const snap = await getDailySnapshot(dateKey);
      if (!snap) return false;
      const parsed = JSON.parse(snap.json) as Partial<PersistedState>;
      const inner = (parsed as { state?: Partial<PersistedState> }).state ?? parsed;
      setState(hydrateState(inner));
      return true;
    },
    importBackupJson: (raw: string) => {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const inner = (parsed as { state?: Partial<PersistedState> }).state ?? parsed;
      setState(hydrateState(inner));
    },
    restoreFromAutosave: () => {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { state?: Partial<PersistedState> };
      if (!parsed.state) return false;
      setState({ ...hydrateState(parsed.state), isLoggedIn: true, onboardingSeen: true });
      return true;
    },
    deleteAllData: () => {
      if (!guardDeleteAllowed()) return;
      setState((p) => ({
        ...p,
        invoices: [],
        recurringInvoices: [],
        returns: [],
        quotations: [],
        customers: [],
        suppliers: [],
        purchaseOrders: [],
        vouchers: [],
        journals: [],
        documents: [],
        products: [],
        employees: [],
        expenses: [],
        auditLogs: [
          makeAuditEntry(p, actorLabel, 'delete', 'WorkspaceData', 'ALL', 'مسح سجلات المعاملات مع الحفاظ على سجل التدقيق'),
          ...p.auditLogs,
        ],
      }));
    },
    restoreDemoData: () => setState((p) => createDemoState(p.settings)),
  };

  return {
    state,
    metrics,
    actions,
    allowedRoutes,
    hasPermission,
    toastMsg,
    idbSnapshots,
    cloudBackups,
  };
}
