import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_PERMISSIONS_MATRIX } from '../constants/permissions';
import { db } from '../firebase';
import {
  ALL_CURRENCY_CODES,
  buildDefaultRatesForBase,
  DEFAULT_ENABLED_CURRENCIES,
} from '../utils/currencies';
import {
  ArchivedDocument,
  AuditLogEntry,
  BankAccount,
  Branch,
  ChartAccount,
  CloudBackupMeta,
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
  RecurringInvoice,
  ReturnRecord,
  RoleId,
  RouteId,
  StockMovement,
  StocktakeRecord,
  Supplier,
  Voucher,
  Warehouse,
} from '../types/erp';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';

const SUBCOLLECTIONS = [
  'invoices',
  'recurringInvoices',
  'returns',
  'quotations',
  'customers',
  'suppliers',
  'purchaseOrders',
  'vouchers',
  'journals',
  'documents',
  'products',
  'employees',
  'expenses',
  'banks',
  'branches',
  'warehouses',
  'chartOfAccounts',
  'stockMovements',
  'stocktakes',
  'auditLogs',
] as const;

type SubcollectionName = (typeof SUBCOLLECTIONS)[number];

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function sanitizeId(raw: string | undefined, fallbackPrefix: string): string {
  const cleaned = (raw ?? '').trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
  if (cleaned.length >= 1 && cleaned.length <= 128 && ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}-${Date.now().toString(36)}`;
}

function clampString(raw: unknown, maxLen: number, fallback = ''): string {
  const s = typeof raw === 'string' ? raw : fallback;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function clampNonEmpty(raw: unknown, maxLen: number, fallback: string): string {
  const trimmed = clampString(raw, maxLen, fallback).trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLen) : fallback.slice(0, maxLen);
}

function clampNum(raw: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function sanitizePermissionsMatrix(matrix: PermissionsMatrix | undefined): PermissionsMatrix {
  const roles: RoleId[] = ['owner', 'accountant', 'cashier', 'salesman', 'warehouse'];
  const out = {} as PermissionsMatrix;
  for (const r of roles) {
    const src = matrix?.[r] ?? DEFAULT_PERMISSIONS_MATRIX[r] ?? [];
    out[r] = src
      .filter((x): x is RouteId => typeof x === 'string' && x.length > 0 && x.length <= 40)
      .slice(0, 40);
  }
  return out;
}

function sanitizeCurrencyCode(raw: unknown, fallback: CurrencyCode = 'SAR'): CurrencyCode {
  return ALL_CURRENCY_CODES.includes(raw as CurrencyCode) ? (raw as CurrencyCode) : fallback;
}

function sanitizeExchangeRates(
  raw: Record<string, number> | undefined,
  base: CurrencyCode,
): Record<string, number> {
  const defaults = buildDefaultRatesForBase(base);
  const out: Record<string, number> = {};
  for (const code of ALL_CURRENCY_CODES) {
    const val = raw?.[code];
    out[code] = code === base ? 1 : typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : defaults[code];
  }
  return out;
}

function sanitizeLineItems(items: Invoice['items'] | undefined) {
  return (items ?? []).slice(0, 50).map((it) => {
    const row: Record<string, unknown> = {
      productId: clampString(it.productId, 128),
      productName: clampNonEmpty(it.productName, 160, 'Item'),
      qty: clampNum(it.qty, 0),
      unitPrice: clampNum(it.unitPrice, 0),
      total: clampNum(it.total, 0),
    };
    if (it.barcode) row.barcode = clampString(it.barcode, 64);
    if (it.imageBase64 && it.imageBase64.length <= 250000) row.imageBase64 = it.imageBase64;
    if (it.category) row.category = clampString(it.category, 80);
    if (it.unit && ['piece', 'carton', 'kg', 'meter', 'liter', 'box'].includes(it.unit)) row.unit = it.unit;
    if (it.description) row.description = clampString(it.description, 200);
    if (typeof it.receivedQty === 'number' && Number.isFinite(it.receivedQty) && it.receivedQty >= 0) row.receivedQty = it.receivedQty;
    if (typeof it.availableStock === 'number' && Number.isFinite(it.availableStock) && it.availableStock >= 0) row.availableStock = it.availableStock;
    if (typeof it.costPrice === 'number' && Number.isFinite(it.costPrice) && it.costPrice >= 0) row.costPrice = it.costPrice;
    if (typeof it.wholesalePrice === 'number' && Number.isFinite(it.wholesalePrice) && it.wholesalePrice >= 0) row.wholesalePrice = it.wholesalePrice;
    if (typeof it.discountPercent === 'number' && Number.isFinite(it.discountPercent)) row.discountPercent = clampNum(it.discountPercent, 0, 100);
    if (typeof it.discountAmount === 'number' && Number.isFinite(it.discountAmount)) row.discountAmount = clampNum(it.discountAmount, 0);
    if (typeof it.taxRate === 'number' && Number.isFinite(it.taxRate)) row.taxRate = clampNum(it.taxRate, 0, 100);
    if (typeof it.taxAmount === 'number' && Number.isFinite(it.taxAmount)) row.taxAmount = clampNum(it.taxAmount, 0);
    if (it.expiryDate) row.expiryDate = clampString(it.expiryDate, 32);
    if (it.note) row.note = clampString(it.note, 200);
    return row;
  });
}

function sanitizeWorkspaceFields(uid: string, state: PersistedState) {
  const baseCurrency = sanitizeCurrencyCode(state.settings.currency, 'SAR');
  const rawEnabled = state.settings.enabledCurrencies ?? DEFAULT_ENABLED_CURRENCIES;
  const enabledCurrencies = Array.from(
    new Set<CurrencyCode>([
      baseCurrency,
      ...rawEnabled.filter((c): c is CurrencyCode => ALL_CURRENCY_CODES.includes(c)),
    ]),
  ).slice(0, 15);

  const payload: Record<string, unknown> = {
    ownerId: uid,
    companyName: clampNonEmpty(state.settings.companyName, 160, 'Ostora Accounting'),
    taxNumber: clampString(state.settings.taxNumber, 64),
    crNumber: clampString(state.settings.crNumber, 64),
    phone: clampString(state.settings.phone, 40),
    email: clampString(state.settings.email, 160),
    address: clampString(state.settings.address, 300),
    currency: baseCurrency,
    enabledCurrencies,
    exchangeRates: sanitizeExchangeRates(state.settings.exchangeRates, baseCurrency),
    isArabic: Boolean(state.settings.isArabic),
    isDarkMode: Boolean(state.settings.isDarkMode),
    monthlySalesGoal: clampNum(state.settings.monthlySalesGoal, 0),
    defaultSalesTaxRate: clampNum(state.settings.defaultSalesTaxRate, 0, 100),
    defaultPurchaseTaxRate: clampNum(state.settings.defaultPurchaseTaxRate, 0, 100),
    autoBackupDaily: Boolean(state.settings.autoBackupDaily),
    autoCloudSync: state.settings.autoCloudSync ?? true,
    autoSyncIntervalMinutes: clampNum(state.settings.autoSyncIntervalMinutes ?? 0, 0, 1440),
    activePlan: clampNonEmpty(state.activePlan, 40, 'trial'),
    trialStartIso: clampNonEmpty(state.trialStartIso, 64, new Date().toISOString()),
    currentRole: ['owner', 'accountant', 'cashier', 'salesman', 'warehouse'].includes(state.currentRole)
      ? state.currentRole
      : 'owner',
    permissionsMatrix: sanitizePermissionsMatrix(state.permissionsMatrix),
  };

  if (state.settings.lastBackupDate) {
    payload.lastBackupDate = clampString(state.settings.lastBackupDate, 64);
  }
  if (state.settings.lastRatesUpdate) {
    payload.lastRatesUpdate = clampString(state.settings.lastRatesUpdate, 64);
  }
  if (state.settings.logoBase64 && state.settings.logoBase64.length <= 250000) {
    payload.logoBase64 = state.settings.logoBase64;
  }
  if (state.settings.fiscalLockDate) {
    payload.fiscalLockDate = clampString(state.settings.fiscalLockDate, 32);
  }
  if (state.settings.defaultBranchId) {
    payload.defaultBranchId = clampString(state.settings.defaultBranchId, 128);
  }
  if (state.settings.defaultWarehouseId) {
    payload.defaultWarehouseId = clampString(state.settings.defaultWarehouseId, 128);
  }
  if (state.settings.receiptFooter) {
    payload.receiptFooter = clampString(state.settings.receiptFooter, 300);
  }

  return payload;
}

function sanitizeEntityForWrite(
  sub: SubcollectionName,
  uid: string,
  item: unknown,
  defaultTaxRate: number,
  defaultPurchaseTaxRate: number,
  baseCurrency: CurrencyCode,
): Record<string, unknown> {
  const validPayMethods = ['cash', 'credit', 'pos_card', 'transfer', 'cheque', 'installment', 'apple_pay'];
  switch (sub) {
    case 'invoices': {
      const inv = item as Invoice;
      const items = sanitizeLineItems(inv.items);
      const invCurrency = sanitizeCurrencyCode(inv.currency, baseCurrency);
      const exchangeRate =
        invCurrency === baseCurrency
          ? 1
          : clampNum(inv.exchangeRate ?? 1, 0.0001, 1000000);
      const total = clampNum(inv.total, 0);
      const baseTotal = clampNum(inv.baseTotal ?? Number((total * exchangeRate).toFixed(2)), 0);
      const out: Record<string, unknown> = {
        id: sanitizeId(inv.id, 'INV'),
        ownerId: uid,
        customerId: clampString(inv.customerId, 128),
        customerName: clampNonEmpty(inv.customerName, 160, 'Customer'),
        customerPhone: clampString(inv.customerPhone, 40),
        description: clampString(inv.description, 500),
        items,
        subtotal: clampNum(inv.subtotal, 0),
        taxRate: clampNum(inv.taxRate ?? defaultTaxRate, 0, 100),
        vat: clampNum(inv.vat, 0),
        total,
        currency: invCurrency,
        exchangeRate,
        baseTotal,
        status: ['draft', 'paid', 'partial', 'pending', 'overdue', 'cancelled'].includes(inv.status) ? inv.status : 'pending',
        date: clampNonEmpty(inv.date, 64, new Date().toISOString()),
      };
      if (inv.invoiceType && ['sales', 'return', 'quotation'].includes(inv.invoiceType)) out.invoiceType = inv.invoiceType;
      if (inv.invoiceDocKind && ['cash', 'credit', 'tax', 'simplified'].includes(inv.invoiceDocKind)) out.invoiceDocKind = inv.invoiceDocKind;
      if (inv.dueDate) out.dueDate = clampString(inv.dueDate, 64);
      if (inv.branchId) out.branchId = clampString(inv.branchId, 128);
      if (inv.branchName) out.branchName = clampString(inv.branchName, 120);
      if (inv.warehouseId) out.warehouseId = clampString(inv.warehouseId, 128);
      if (inv.warehouseName) out.warehouseName = clampString(inv.warehouseName, 120);
      if (inv.salespersonName) out.salespersonName = clampString(inv.salespersonName, 120);
      if (inv.shiftName) out.shiftName = clampString(inv.shiftName, 80);
      if (inv.paymentMethod && validPayMethods.includes(inv.paymentMethod)) {
        out.paymentMethod = inv.paymentMethod;
      }
      if (inv.referenceNumber) out.referenceNumber = clampString(inv.referenceNumber, 80);
      if (typeof inv.invoiceDiscountPercent === 'number') out.invoiceDiscountPercent = clampNum(inv.invoiceDiscountPercent, 0, 100);
      if (typeof inv.discountTotal === 'number') out.discountTotal = clampNum(inv.discountTotal, 0);
      if (typeof inv.shippingFee === 'number') out.shippingFee = clampNum(inv.shippingFee, 0);
      if (typeof inv.extraFee === 'number') out.extraFee = clampNum(inv.extraFee, 0);
      if (typeof inv.paidAmount === 'number') out.paidAmount = clampNum(inv.paidAmount, 0);
      if (typeof inv.remainingAmount === 'number') out.remainingAmount = clampNum(inv.remainingAmount, 0);
      if (inv.notes) out.notes = clampString(inv.notes, 500);
      if (inv.terms) out.terms = clampString(inv.terms, 500);
      if (inv.sellerSignature) out.sellerSignature = clampString(inv.sellerSignature, 160);
      if (inv.customerSignature) out.customerSignature = clampString(inv.customerSignature, 160);
      if (Array.isArray(inv.installments) && inv.installments.length > 0) {
        out.installments = inv.installments.slice(0, 36);
      }
      if (inv.createdByRole && ['owner', 'accountant', 'cashier', 'salesman', 'warehouse'].includes(inv.createdByRole)) {
        out.createdByRole = inv.createdByRole;
      }
      return out;
    }
    case 'returns': {
      const ret = item as ReturnRecord;
      const out: Record<string, unknown> = {
        id: sanitizeId(ret.id, 'RET'),
        ownerId: uid,
        type: ret.type === 'purchase' ? 'purchase' : 'sales',
        originalDocId: clampString(ret.originalDocId, 128),
        partyName: clampNonEmpty(ret.partyName, 160, 'Party'),
        partyPhone: clampString(ret.partyPhone, 40),
        productId: clampString(ret.productId, 128),
        productName: clampNonEmpty(ret.productName, 160, 'Product'),
        qty: clampNum(ret.qty, 0),
        unitPrice: clampNum(ret.unitPrice, 0),
        amount: clampNum(ret.amount, 0),
        reason: ['damaged', 'wrong_item', 'expired', 'not_matching', 'changed_mind', 'other'].includes(ret.reason)
          ? ret.reason
          : 'other',
        notes: clampString(ret.notes, 500),
        date: clampNonEmpty(ret.date, 64, new Date().toISOString()),
      };
      if (ret.warehouseId) out.warehouseId = clampString(ret.warehouseId, 128);
      if (ret.branchId) out.branchId = clampString(ret.branchId, 128);
      if (ret.itemCondition && ['good_restock', 'damaged_scrap'].includes(ret.itemCondition)) out.itemCondition = ret.itemCondition;
      if (ret.compensationMethod && ['cash_refund', 'replacement', 'account_credit'].includes(ret.compensationMethod)) {
        out.compensationMethod = ret.compensationMethod;
      }
      if (typeof ret.approved === 'boolean') out.approved = ret.approved;
      if (ret.photoBase64 && ret.photoBase64.length <= 250000) out.photoBase64 = ret.photoBase64;
      return out;
    }
    case 'quotations': {
      const qt = item as Quotation;
      const items = sanitizeLineItems(qt.items);
      if (items.length === 0) {
        items.push({ productId: '', productName: 'Item', qty: 1, unitPrice: 0, total: 0 });
      }
      const out: Record<string, unknown> = {
        id: sanitizeId(qt.id, 'QT'),
        ownerId: uid,
        customerId: clampString(qt.customerId, 128),
        customerName: clampNonEmpty(qt.customerName, 160, 'Customer'),
        customerPhone: clampString(qt.customerPhone, 40),
        customerEmail: clampString(qt.customerEmail, 160),
        items,
        discountPercent: clampNum(qt.discountPercent, 0, 100),
        subtotal: clampNum(qt.subtotal, 0),
        discountAmount: clampNum(qt.discountAmount, 0),
        vat: clampNum(qt.vat, 0),
        total: clampNum(qt.total, 0),
        validUntil: clampString(qt.validUntil, 64),
        status: ['draft', 'sent', 'accepted', 'rejected', 'expired'].includes(qt.status)
          ? qt.status
          : 'draft',
        notes: clampString(qt.notes, 500),
        date: clampNonEmpty(qt.date, 64, new Date().toISOString()),
      };
      if (typeof qt.validityDays === 'number') out.validityDays = clampNum(qt.validityDays, 0, 3650);
      if (qt.branchId) out.branchId = clampString(qt.branchId, 128);
      if (qt.salespersonName) out.salespersonName = clampString(qt.salespersonName, 120);
      if (qt.currency) out.currency = sanitizeCurrencyCode(qt.currency, baseCurrency);
      if (qt.terms) out.terms = clampString(qt.terms, 500);
      return out;
    }
    case 'customers': {
      const c = item as Customer;
      const out: Record<string, unknown> = {
        id: sanitizeId(c.id, 'C'),
        ownerId: uid,
        name: clampNonEmpty(c.name, 160, 'Customer'),
        phone: clampString(c.phone, 40),
        email: clampString(c.email, 160),
        debt: clampNum(c.debt, 0),
      };
      if (typeof c.creditLimit === 'number' && Number.isFinite(c.creditLimit) && c.creditLimit >= 0) {
        out.creditLimit = clampNum(c.creditLimit, 0);
      }
      if (c.code) out.code = clampString(c.code, 64);
      if (c.companyName) out.companyName = clampString(c.companyName, 160);
      if (c.photoBase64 && c.photoBase64.length <= 250000) out.photoBase64 = c.photoBase64;
      if (c.whatsapp) out.whatsapp = clampString(c.whatsapp, 40);
      if (c.landline) out.landline = clampString(c.landline, 40);
      if (c.website) out.website = clampString(c.website, 200);
      if (c.address) out.address = clampString(c.address, 300);
      if (c.district) out.district = clampString(c.district, 80);
      if (c.city) out.city = clampString(c.city, 80);
      if (c.country) out.country = clampString(c.country, 80);
      if (c.mapUrl) out.mapUrl = clampString(c.mapUrl, 300);
      if (c.gpsCoords) out.gpsCoords = clampString(c.gpsCoords, 80);
      if (c.customerType && ['individual', 'company', 'VIP', 'wholesale', 'retail', 'distributor'].includes(c.customerType)) {
        out.customerType = c.customerType;
      }
      if (c.taxNumber) out.taxNumber = clampString(c.taxNumber, 64);
      if (c.taxStatus && ['taxable', 'exempt'].includes(c.taxStatus)) out.taxStatus = c.taxStatus;
      if (c.nationalId) out.nationalId = clampString(c.nationalId, 64);
      if (c.crNumber) out.crNumber = clampString(c.crNumber, 64);
      if (c.birthDate) out.birthDate = clampString(c.birthDate, 32);
      if (typeof c.openingBalanceDebit === 'number') out.openingBalanceDebit = clampNum(c.openingBalanceDebit, 0);
      if (typeof c.openingBalanceCredit === 'number') out.openingBalanceCredit = clampNum(c.openingBalanceCredit, 0);
      if (typeof c.creditTermDays === 'number') out.creditTermDays = clampNum(c.creditTermDays, 0);
      if (c.preferredPaymentMethod && validPayMethods.includes(c.preferredPaymentMethod)) {
        out.preferredPaymentMethod = c.preferredPaymentMethod;
      }
      if (c.priceList) out.priceList = clampString(c.priceList, 64);
      if (typeof c.specialDiscountPercent === 'number') out.specialDiscountPercent = clampNum(c.specialDiscountPercent, 0, 100);
      if (c.currency) out.currency = sanitizeCurrencyCode(c.currency, baseCurrency);
      if (c.iban) out.iban = clampString(c.iban, 80);
      if (c.salesRep) out.salesRep = clampString(c.salesRep, 120);
      if (c.branchId) out.branchId = clampString(c.branchId, 128);
      if (c.leadSource) out.leadSource = clampString(c.leadSource, 80);
      if (c.firstDealDate) out.firstDealDate = clampString(c.firstDealDate, 32);
      if (c.rating && ['A', 'B', 'C'].includes(c.rating)) out.rating = c.rating;
      if (c.reminderDate) out.reminderDate = clampString(c.reminderDate, 32);
      if (c.attachmentBase64 && c.attachmentBase64.length <= 250000) out.attachmentBase64 = c.attachmentBase64;
      if (c.status && ['active', 'paused', 'blocked', 'potential'].includes(c.status)) out.status = c.status;
      if (c.notes) out.notes = clampString(c.notes, 500);
      if (c.callLogs) out.callLogs = clampString(c.callLogs, 1000);
      if (c.createdAtDate) out.createdAtDate = clampString(c.createdAtDate, 64);
      if (c.createdBy) out.createdBy = clampString(c.createdBy, 120);
      return out;
    }
    case 'suppliers': {
      const s = item as Supplier;
      const out: Record<string, unknown> = {
        id: sanitizeId(s.id, 'S'),
        ownerId: uid,
        name: clampNonEmpty(s.name, 160, 'Supplier'),
        phone: clampString(s.phone, 40),
        category: clampString(s.category, 100),
        payable: clampNum(s.payable, 0),
      };
      if (s.code) out.code = clampString(s.code, 64);
      if (s.companyName) out.companyName = clampString(s.companyName, 160);
      if (s.contactPerson) out.contactPerson = clampString(s.contactPerson, 120);
      if (s.photoBase64 && s.photoBase64.length <= 250000) out.photoBase64 = s.photoBase64;
      if (s.whatsapp) out.whatsapp = clampString(s.whatsapp, 40);
      if (s.email) out.email = clampString(s.email, 160);
      if (s.address) out.address = clampString(s.address, 300);
      if (s.city) out.city = clampString(s.city, 80);
      if (s.country) out.country = clampString(s.country, 80);
      if (s.mapUrl) out.mapUrl = clampString(s.mapUrl, 300);
      if (s.supplierType && ['primary', 'secondary', 'manufacturer', 'importer', 'local', 'distributor', 'services'].includes(s.supplierType)) {
        out.supplierType = s.supplierType;
      }
      if (s.taxNumber) out.taxNumber = clampString(s.taxNumber, 64);
      if (s.crNumber) out.crNumber = clampString(s.crNumber, 64);
      if (s.bankAccount) out.bankAccount = clampString(s.bankAccount, 80);
      if (s.bankName) out.bankName = clampString(s.bankName, 120);
      if (s.iban) out.iban = clampString(s.iban, 80);
      if (typeof s.openingBalance === 'number') out.openingBalance = clampNum(s.openingBalance, 0);
      if (typeof s.creditLimit === 'number') out.creditLimit = clampNum(s.creditLimit, 0);
      if (typeof s.paymentTermDays === 'number') out.paymentTermDays = clampNum(s.paymentTermDays, 0);
      if (s.preferredPaymentMethod && validPayMethods.includes(s.preferredPaymentMethod)) {
        out.preferredPaymentMethod = s.preferredPaymentMethod;
      }
      if (s.currency) out.currency = sanitizeCurrencyCode(s.currency, baseCurrency);
      if (s.supplyTerms) out.supplyTerms = clampString(s.supplyTerms, 300);
      if (typeof s.supplierDiscountPercent === 'number') out.supplierDiscountPercent = clampNum(s.supplierDiscountPercent, 0, 100);
      if (typeof s.leadTimeDays === 'number') out.leadTimeDays = clampNum(s.leadTimeDays, 0, 3650);
      if (s.suppliedItems) out.suppliedItems = clampString(s.suppliedItems, 400);
      if (typeof s.lastPurchasePrice === 'number') out.lastPurchasePrice = clampNum(s.lastPurchasePrice, 0);
      if (typeof s.qualityRating === 'number') out.qualityRating = clampNum(s.qualityRating, 1, 5);
      if (typeof s.speedRating === 'number') out.speedRating = clampNum(s.speedRating, 1, 5);
      if (s.attachmentBase64 && s.attachmentBase64.length <= 250000) out.attachmentBase64 = s.attachmentBase64;
      if (s.branchId) out.branchId = clampString(s.branchId, 128);
      if (s.repName) out.repName = clampString(s.repName, 120);
      if (s.status && ['active', 'paused', 'blocked', 'potential'].includes(s.status)) out.status = s.status;
      if (s.notes) out.notes = clampString(s.notes, 500);
      if (s.contractsNotes) out.contractsNotes = clampString(s.contractsNotes, 500);
      if (s.createdAtDate) out.createdAtDate = clampString(s.createdAtDate, 64);
      if (s.createdBy) out.createdBy = clampString(s.createdBy, 120);
      return out;
    }
    case 'purchaseOrders': {
      const po = item as PurchaseOrder;
      const subtotal = clampNum(po.subtotal ?? po.quantity * po.unitCost, 0);
      const taxRate = clampNum(po.taxRate ?? defaultPurchaseTaxRate, 0, 100);
      const vat = clampNum(po.vat ?? Number(((subtotal * taxRate) / 100).toFixed(2)), 0);
      const out: Record<string, unknown> = {
        id: sanitizeId(po.id, 'PO'),
        ownerId: uid,
        supplierId: clampString(po.supplierId, 128),
        supplierName: clampNonEmpty(po.supplierName, 160, 'Supplier'),
        supplierPhone: clampString(po.supplierPhone, 40),
        productId: clampString(po.productId, 128),
        productName: clampNonEmpty(po.productName, 160, 'Product'),
        quantity: clampNum(po.quantity, 0),
        unitCost: clampNum(po.unitCost, 0),
        subtotal,
        taxRate,
        vat,
        total: clampNum(po.total, 0),
        status: ['draft', 'approved', 'ordered', 'received', 'cancelled'].includes(po.status) ? po.status : 'ordered',
        date: clampNonEmpty(po.date, 64, new Date().toISOString()),
      };
      if (Array.isArray(po.items) && po.items.length > 0) out.items = sanitizeLineItems(po.items);
      if (typeof po.discountTotal === 'number') out.discountTotal = clampNum(po.discountTotal, 0);
      if (typeof po.shippingFee === 'number') out.shippingFee = clampNum(po.shippingFee, 0);
      if (po.expectedDeliveryDate) out.expectedDeliveryDate = clampString(po.expectedDeliveryDate, 64);
      if (typeof po.paymentTermDays === 'number') out.paymentTermDays = clampNum(po.paymentTermDays, 0);
      if (po.branchId) out.branchId = clampString(po.branchId, 128);
      if (po.warehouseId) out.warehouseId = clampString(po.warehouseId, 128);
      if (po.paymentMethod && validPayMethods.includes(po.paymentMethod)) {
        out.paymentMethod = po.paymentMethod;
      }
      if (po.notes) out.notes = clampString(po.notes, 500);
      if (typeof po.paidAmount === 'number') out.paidAmount = clampNum(po.paidAmount, 0);
      if (po.supplierInvoiceBase64 && po.supplierInvoiceBase64.length <= 250000) out.supplierInvoiceBase64 = po.supplierInvoiceBase64;
      return out;
    }
    case 'vouchers': {
      const v = item as Voucher;
      const out: Record<string, unknown> = {
        id: sanitizeId(v.id, 'VCH'),
        ownerId: uid,
        type: ['receipt', 'payment', 'journal'].includes(v.type) ? v.type : 'receipt',
        partyName: clampNonEmpty(v.partyName, 160, 'Party'),
        partyPhone: clampString(v.partyPhone, 40),
        amount: clampNum(v.amount, 0),
        reason: clampString(v.reason, 400),
        paymentMethod: clampString(v.paymentMethod, 80),
        date: clampNonEmpty(v.date, 64, new Date().toISOString()),
      };
      if (v.fromAccount) out.fromAccount = clampString(v.fromAccount, 160);
      if (v.toAccount) out.toAccount = clampString(v.toAccount, 160);
      if (v.partyType && ['customer', 'supplier', 'employee'].includes(v.partyType)) out.partyType = v.partyType;
      if (v.branchId) out.branchId = clampString(v.branchId, 128);
      if (v.bankId) out.bankId = clampString(v.bankId, 128);
      if (v.chequeNumber) out.chequeNumber = clampString(v.chequeNumber, 64);
      if (v.chequeDueDate) out.chequeDueDate = clampString(v.chequeDueDate, 32);
      if (v.attachmentBase64 && v.attachmentBase64.length <= 250000) out.attachmentBase64 = v.attachmentBase64;
      if (v.status && ['draft', 'approved'].includes(v.status)) out.status = v.status;
      return out;
    }
    case 'journals': {
      const j = item as JournalEntry;
      const lines = (j.lines ?? []).slice(0, 50).map((l) => {
        const line: Record<string, unknown> = {
          account: clampNonEmpty(l.account, 160, 'Account'),
          debit: clampNum(l.debit, 0),
          credit: clampNum(l.credit, 0),
        };
        if (l.description) line.description = clampString(l.description, 200);
        return line;
      });
      if (lines.length === 0) {
        lines.push({ account: 'General', debit: 0, credit: 0 });
      }
      const out: Record<string, unknown> = {
        id: sanitizeId(j.id, 'JRN'),
        ownerId: uid,
        reference: clampString(j.reference, 120),
        description: clampNonEmpty(j.description, 400, 'Journal Entry'),
        date: clampNonEmpty(j.date, 64, new Date().toISOString()),
        lines,
      };
      if (j.entryType && ['manual', 'auto'].includes(j.entryType)) out.entryType = j.entryType;
      if (j.branchId) out.branchId = clampString(j.branchId, 128);
      if (j.costCenter) out.costCenter = clampString(j.costCenter, 120);
      if (j.status && ['draft', 'approved'].includes(j.status)) out.status = j.status;
      if (j.attachmentBase64 && j.attachmentBase64.length <= 250000) out.attachmentBase64 = j.attachmentBase64;
      return out;
    }
    case 'products': {
      const p = item as Product;
      const out: Record<string, unknown> = {
        id: sanitizeId(p.id, 'P'),
        ownerId: uid,
        name: clampNonEmpty(p.name, 160, 'Product'),
        sku: clampString(p.sku, 64),
        barcode: clampString(p.barcode, 64),
        qty: clampNum(p.qty, 0),
        cost: clampNum(p.cost, 0),
        price: clampNum(p.price, 0),
      };
      if (p.nameEn) out.nameEn = clampString(p.nameEn, 160);
      if (p.description) out.description = clampString(p.description, 400);
      if (p.imageBase64 && p.imageBase64.length <= 250000) out.imageBase64 = p.imageBase64;
      if (typeof p.openingQty === 'number') out.openingQty = clampNum(p.openingQty, 0);
      if (typeof p.retailPrice === 'number') out.retailPrice = clampNum(p.retailPrice, 0);
      if (typeof p.vipPrice === 'number') out.vipPrice = clampNum(p.vipPrice, 0);
      if (typeof p.minPrice === 'number') out.minPrice = clampNum(p.minPrice, 0);
      if (p.category) out.category = clampString(p.category, 80);
      if (p.brand) out.brand = clampString(p.brand, 80);
      if (p.unit && ['piece', 'carton', 'kg', 'meter', 'liter', 'box'].includes(p.unit)) out.unit = p.unit;
      if (p.subUnit) out.subUnit = clampString(p.subUnit, 40);
      if (typeof p.subUnitFactor === 'number') out.subUnitFactor = clampNum(p.subUnitFactor, 0);
      if (typeof p.wholesalePrice === 'number') out.wholesalePrice = clampNum(p.wholesalePrice, 0);
      if (typeof p.isTaxable === 'boolean') out.isTaxable = p.isTaxable;
      if (typeof p.taxRate === 'number') out.taxRate = clampNum(p.taxRate, 0, 100);
      if (typeof p.minStock === 'number') out.minStock = clampNum(p.minStock, 0);
      if (typeof p.maxStock === 'number') out.maxStock = clampNum(p.maxStock, 0);
      if (p.shelfLocation) out.shelfLocation = clampString(p.shelfLocation, 64);
      if (p.expiryDate) out.expiryDate = clampString(p.expiryDate, 32);
      if (p.batchNumber) out.batchNumber = clampString(p.batchNumber, 64);
      if (p.serialNumber) out.serialNumber = clampString(p.serialNumber, 64);
      if (p.status && ['active', 'paused', 'service'].includes(p.status)) out.status = p.status;
      if (p.supplierId) out.supplierId = clampString(p.supplierId, 128);
      if (p.branchId) out.branchId = clampString(p.branchId, 128);
      if (p.warehouseId) out.warehouseId = clampString(p.warehouseId, 128);
      return out;
    }
    case 'employees': {
      const e = item as Employee;
      const out: Record<string, unknown> = {
        id: sanitizeId(e.id, 'E'),
        ownerId: uid,
        name: clampNonEmpty(e.name, 160, 'Employee'),
        roleTitle: clampString(e.roleTitle, 100),
        role: ['owner', 'accountant', 'cashier', 'salesman', 'warehouse'].includes(e.role) ? e.role : 'accountant',
        permissions: (e.permissions ?? [])
          .filter((x): x is RouteId => typeof x === 'string' && x.length > 0 && x.length <= 40)
          .slice(0, 40),
        phone: clampString(e.phone, 40),
        salary: clampNum(e.salary, 0),
      };
      if (e.code) out.code = clampString(e.code, 64);
      if (e.department) out.department = clampString(e.department, 100);
      if (e.email) out.email = clampString(e.email, 160);
      if (e.nationalId) out.nationalId = clampString(e.nationalId, 64);
      if (e.branchId) out.branchId = clampString(e.branchId, 128);
      if (e.hireDate) out.hireDate = clampString(e.hireDate, 32);
      if (e.bankAccount) out.bankAccount = clampString(e.bankAccount, 80);
      if (e.status && ['active', 'on_leave', 'terminated'].includes(e.status)) out.status = e.status;
      if (e.notes) out.notes = clampString(e.notes, 400);
      if (e.lastPaidDate) {
        out.lastPaidDate = clampString(e.lastPaidDate, 64);
      }
      return out;
    }
    case 'expenses': {
      const ex = item as Expense;
      const out: Record<string, unknown> = {
        id: sanitizeId(ex.id, 'EXP'),
        ownerId: uid,
        title: clampNonEmpty(ex.title, 160, 'Expense'),
        category: clampString(ex.category, 80),
        amount: clampNum(ex.amount, 0),
        paidFromBankId: clampString(ex.paidFromBankId, 128),
        date: clampNonEmpty(ex.date, 64, new Date().toISOString()),
      };
      if (ex.branchId) out.branchId = clampString(ex.branchId, 128);
      return out;
    }
    case 'banks': {
      const b = item as BankAccount;
      const out: Record<string, unknown> = {
        id: sanitizeId(b.id, 'BNK'),
        ownerId: uid,
        nameAr: clampNonEmpty(b.nameAr, 120, 'حساب بنكي'),
        nameEn: clampNonEmpty(b.nameEn, 120, 'Bank Account'),
        accountNumber: clampString(b.accountNumber, 64),
        balance: typeof b.balance === 'number' && Number.isFinite(b.balance) ? b.balance : 0,
      };
      if (b.lastReconciledDate) out.lastReconciledDate = clampString(b.lastReconciledDate, 64);
      return out;
    }
    case 'recurringInvoices': {
      const rec = item as RecurringInvoice;
      const items = sanitizeLineItems(rec.items);
      const out: Record<string, unknown> = {
        id: sanitizeId(rec.id, 'REC'),
        ownerId: uid,
        customerId: clampString(rec.customerId, 128),
        customerName: clampNonEmpty(rec.customerName, 160, 'Customer'),
        customerPhone: clampString(rec.customerPhone, 40),
        description: clampString(rec.description, 500),
        items,
        subtotal: clampNum(rec.subtotal, 0),
        taxRate: clampNum(rec.taxRate ?? defaultTaxRate, 0, 100),
        currency: sanitizeCurrencyCode(rec.currency, baseCurrency),
        frequency: ['weekly', 'monthly', 'quarterly', 'yearly'].includes(rec.frequency)
          ? rec.frequency
          : 'monthly',
        nextRunDate: clampNonEmpty(rec.nextRunDate, 64, new Date().toISOString().slice(0, 10)),
        targetStatus: ['draft', 'paid', 'partial', 'pending', 'overdue', 'cancelled'].includes(rec.targetStatus)
          ? rec.targetStatus
          : 'pending',
        autoGenerate: Boolean(rec.autoGenerate),
        active: Boolean(rec.active),
        generatedCount: clampNum(rec.generatedCount, 0),
        notes: clampString(rec.notes, 500),
        date: clampNonEmpty(rec.date, 64, new Date().toISOString()),
      };
      if (rec.templateName) out.templateName = clampString(rec.templateName, 160);
      if (rec.startDate) out.startDate = clampString(rec.startDate, 32);
      if (rec.endDate) out.endDate = clampString(rec.endDate, 32);
      if (typeof rec.maxOccurrences === 'number') out.maxOccurrences = clampNum(rec.maxOccurrences, 0, 10000);
      if (typeof rec.issueDay === 'number') out.issueDay = clampNum(rec.issueDay, 1, 31);
      if (typeof rec.autoSendWhatsApp === 'boolean') out.autoSendWhatsApp = rec.autoSendWhatsApp;
      if (typeof rec.autoSendEmail === 'boolean') out.autoSendEmail = rec.autoSendEmail;
      if (typeof rec.notifyDaysBefore === 'number') out.notifyDaysBefore = clampNum(rec.notifyDaysBefore, 0, 90);
      if (rec.lastGeneratedDate) {
        out.lastGeneratedDate = clampString(rec.lastGeneratedDate, 64);
      }
      return out;
    }
    case 'documents': {
      const d = item as ArchivedDocument;
      const out: Record<string, unknown> = {
        id: sanitizeId(d.id, 'DOC'),
        ownerId: uid,
        title: clampNonEmpty(d.title, 160, 'Document'),
        docType: ['contract', 'receipt', 'tax_cert', 'id_doc', 'invoice_scan', 'cr_doc', 'other'].includes(d.docType)
          ? d.docType
          : 'other',
        partyName: clampString(d.partyName, 160),
        referenceId: clampString(d.referenceId, 128),
        fileName: clampString(d.fileName, 200),
        fileType: clampString(d.fileType, 120),
        fileSizeBytes: clampNum(d.fileSizeBytes, 0),
        notes: clampString(d.notes, 500),
        date: clampNonEmpty(d.date, 64, new Date().toISOString()),
      };
      if (d.partyType && ['customer', 'supplier', 'employee'].includes(d.partyType)) out.partyType = d.partyType;
      if (d.expiryDate) out.expiryDate = clampString(d.expiryDate, 32);
      if (d.fileDataBase64 && d.fileDataBase64.length <= 250000) {
        out.fileDataBase64 = d.fileDataBase64;
      }
      return out;
    }
    case 'branches': {
      const b = item as Branch;
      const out: Record<string, unknown> = {
        id: sanitizeId(b.id, 'BR'),
        ownerId: uid,
        nameAr: clampNonEmpty(b.nameAr, 120, 'الفرع الرئيسي'),
        nameEn: clampNonEmpty(b.nameEn, 120, 'Main Branch'),
        city: clampString(b.city, 80),
        phone: clampString(b.phone, 40),
        managerName: clampString(b.managerName, 120),
        active: Boolean(b.active),
      };
      if (typeof b.isMain === 'boolean') out.isMain = b.isMain;
      return out;
    }
    case 'warehouses': {
      const w = item as Warehouse;
      const out: Record<string, unknown> = {
        id: sanitizeId(w.id, 'WH'),
        ownerId: uid,
        nameAr: clampNonEmpty(w.nameAr, 120, 'المستودع الرئيسي'),
        nameEn: clampNonEmpty(w.nameEn, 120, 'Main Warehouse'),
        branchId: clampString(w.branchId, 128),
        location: clampString(w.location, 160),
        managerName: clampString(w.managerName, 120),
        active: Boolean(w.active),
      };
      if (w.code) out.code = clampString(w.code, 64);
      if (w.city) out.city = clampString(w.city, 80);
      if (w.address) out.address = clampString(w.address, 200);
      if (w.warehouseType && ['main', 'sub'].includes(w.warehouseType)) out.warehouseType = w.warehouseType;
      return out;
    }
    case 'chartOfAccounts': {
      const a = item as ChartAccount;
      const out: Record<string, unknown> = {
        id: sanitizeId(a.id, 'COA'),
        ownerId: uid,
        code: clampNonEmpty(a.code, 32, '1000'),
        nameAr: clampNonEmpty(a.nameAr, 160, 'حساب'),
        nameEn: clampNonEmpty(a.nameEn, 160, 'Account'),
        category: ['assets', 'liabilities', 'equity', 'revenue', 'expenses'].includes(a.category)
          ? a.category
          : 'assets',
      };
      if (a.parentCode) out.parentCode = clampString(a.parentCode, 32);
      if (typeof a.level === 'number') out.level = clampNum(a.level, 1, 10);
      if (a.normalBalance && ['debit', 'credit'].includes(a.normalBalance)) out.normalBalance = a.normalBalance;
      if (typeof a.openingBalance === 'number' && Number.isFinite(a.openingBalance)) out.openingBalance = a.openingBalance;
      if (a.costCenter) out.costCenter = clampString(a.costCenter, 120);
      if (a.branchId) out.branchId = clampString(a.branchId, 128);
      if (typeof a.allowPosting === 'boolean') out.allowPosting = a.allowPosting;
      if (a.notes) out.notes = clampString(a.notes, 300);
      if (typeof a.isSystem === 'boolean') out.isSystem = a.isSystem;
      return out;
    }
    case 'stockMovements': {
      const m = item as StockMovement;
      const out: Record<string, unknown> = {
        id: sanitizeId(m.id, 'MOV'),
        ownerId: uid,
        productId: clampString(m.productId, 128),
        productName: clampNonEmpty(m.productName, 160, 'Product'),
        movementType: ['sale', 'purchase', 'return_in', 'return_out', 'transfer', 'stocktake'].includes(m.movementType)
          ? m.movementType
          : 'sale',
        qtyDelta: typeof m.qtyDelta === 'number' && Number.isFinite(m.qtyDelta) ? m.qtyDelta : 0,
        referenceId: clampString(m.referenceId, 128),
        notes: clampString(m.notes, 400),
        date: clampNonEmpty(m.date, 64, new Date().toISOString()),
      };
      if (m.fromWarehouseId) out.fromWarehouseId = clampString(m.fromWarehouseId, 128);
      if (m.toWarehouseId) out.toWarehouseId = clampString(m.toWarehouseId, 128);
      if (m.reason) out.reason = clampString(m.reason, 200);
      return out;
    }
    case 'stocktakes': {
      const st = item as StocktakeRecord;
      const out: Record<string, unknown> = {
        id: sanitizeId(st.id, 'STK'),
        ownerId: uid,
        warehouseId: clampString(st.warehouseId, 128),
        warehouseName: clampString(st.warehouseName, 120),
        productId: clampString(st.productId, 128),
        productName: clampNonEmpty(st.productName, 160, 'Product'),
        systemQty: clampNum(st.systemQty, 0),
        actualQty: clampNum(st.actualQty, 0),
        varianceQty: typeof st.varianceQty === 'number' && Number.isFinite(st.varianceQty) ? st.varianceQty : 0,
        varianceValue: typeof st.varianceValue === 'number' && Number.isFinite(st.varianceValue) ? st.varianceValue : 0,
        notes: clampString(st.notes, 400),
        date: clampNonEmpty(st.date, 64, new Date().toISOString()),
      };
      if (st.countedBy) out.countedBy = clampString(st.countedBy, 120);
      if (st.reason) out.reason = clampString(st.reason, 200);
      return out;
    }
    case 'auditLogs': {
      const log = item as AuditLogEntry;
      return {
        id: sanitizeId(log.id, 'AUD'),
        ownerId: uid,
        actor: clampNonEmpty(log.actor, 160, 'User'),
        actorRole: ['owner', 'accountant', 'cashier', 'salesman', 'warehouse'].includes(log.actorRole)
          ? log.actorRole
          : 'owner',
        action: ['create', 'update', 'delete', 'pay', 'receive', 'transfer', 'reconcile', 'stocktake', 'fiscal_lock', 'backup'].includes(log.action)
          ? log.action
          : 'update',
        entity: clampNonEmpty(log.entity, 80, 'Record'),
        entityId: clampString(log.entityId, 128),
        summary: clampNonEmpty(log.summary, 400, 'Action logged'),
        timestamp: clampNonEmpty(log.timestamp, 64, new Date().toISOString()),
      };
    }
  }
}

export async function upsertUserProfile(user: User): Promise<void> {
  if (!user.emailVerified) return;
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    const displayName = clampNonEmpty(user.displayName || user.email?.split('@')[0], 120, 'User');
    const email = clampNonEmpty(user.email, 256, 'user@example.com');
    const photoUrl = user.photoURL ? clampString(user.photoURL, 512) : undefined;

    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid: user.uid,
        email,
        displayName,
        role: 'user',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (photoUrl) payload.photoUrl = photoUrl;
      await setDoc(userRef, payload);
    } else {
      const patch: Record<string, unknown> = {
        displayName,
        email,
        updatedAt: serverTimestamp(),
      };
      if (photoUrl) patch.photoUrl = photoUrl;
      await updateDoc(userRef, patch);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function loadOrSeedWorkspace(
  uid: string,
  localState: PersistedState,
): Promise<Partial<PersistedState>> {
  const wsPath = `workspaces/${uid}`;
  const wsRef = doc(db, 'workspaces', uid);

  let wsSnap;
  try {
    wsSnap = await getDoc(wsRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, wsPath);
  }

  if (!wsSnap.exists()) {
    try {
      await setDoc(wsRef, {
        ...sanitizeWorkspaceFields(uid, localState),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, wsPath);
    }

    await seedAllSubcollections(uid, localState);
    return localState;
  }

  const wsData = wsSnap.data();
  const loaded: Partial<PersistedState> = {
    onboardingSeen: true,
    isLoggedIn: true,
    currentRole: (wsData.currentRole as RoleId) ?? localState.currentRole,
    activePlan: (wsData.activePlan as string) ?? localState.activePlan,
    trialStartIso: (wsData.trialStartIso as string) ?? localState.trialStartIso,
    permissionsMatrix: (wsData.permissionsMatrix as PermissionsMatrix) ?? localState.permissionsMatrix,
    settings: {
      ...localState.settings,
      companyName: (wsData.companyName as string) ?? localState.settings.companyName,
      taxNumber: (wsData.taxNumber as string) ?? localState.settings.taxNumber,
      crNumber: (wsData.crNumber as string) ?? localState.settings.crNumber,
      phone: (wsData.phone as string) ?? localState.settings.phone,
      email: (wsData.email as string) ?? localState.settings.email,
      address: (wsData.address as string) ?? localState.settings.address,
      currency: (wsData.currency as PersistedState['settings']['currency']) ?? localState.settings.currency,
      enabledCurrencies:
        (wsData.enabledCurrencies as CurrencyCode[] | undefined) ?? localState.settings.enabledCurrencies,
      exchangeRates:
        (wsData.exchangeRates as Record<string, number> | undefined) ?? localState.settings.exchangeRates,
      lastRatesUpdate:
        (wsData.lastRatesUpdate as string | undefined) ?? localState.settings.lastRatesUpdate,
      isArabic: typeof wsData.isArabic === 'boolean' ? wsData.isArabic : localState.settings.isArabic,
      isDarkMode: typeof wsData.isDarkMode === 'boolean' ? wsData.isDarkMode : localState.settings.isDarkMode,
      monthlySalesGoal: Number(wsData.monthlySalesGoal ?? localState.settings.monthlySalesGoal),
      defaultSalesTaxRate: Number(wsData.defaultSalesTaxRate ?? localState.settings.defaultSalesTaxRate),
      defaultPurchaseTaxRate: Number(wsData.defaultPurchaseTaxRate ?? localState.settings.defaultPurchaseTaxRate),
      autoBackupDaily:
        typeof wsData.autoBackupDaily === 'boolean'
          ? wsData.autoBackupDaily
          : localState.settings.autoBackupDaily,
      lastBackupDate: (wsData.lastBackupDate as string | undefined) ?? localState.settings.lastBackupDate,
      autoCloudSync:
        typeof wsData.autoCloudSync === 'boolean'
          ? wsData.autoCloudSync
          : (localState.settings.autoCloudSync ?? true),
      autoSyncIntervalMinutes: Number(
        wsData.autoSyncIntervalMinutes ?? localState.settings.autoSyncIntervalMinutes ?? 0,
      ),
      logoBase64: (wsData.logoBase64 as string | undefined) ?? localState.settings.logoBase64,
      fiscalLockDate: (wsData.fiscalLockDate as string | undefined) ?? localState.settings.fiscalLockDate,
      defaultBranchId: (wsData.defaultBranchId as string | undefined) ?? localState.settings.defaultBranchId,
      defaultWarehouseId: (wsData.defaultWarehouseId as string | undefined) ?? localState.settings.defaultWarehouseId,
      receiptFooter: (wsData.receiptFooter as string | undefined) ?? localState.settings.receiptFooter,
    },
  };

  for (const sub of SUBCOLLECTIONS) {
    const subPath = `workspaces/${uid}/${sub}`;
    try {
      const q = query(collection(db, 'workspaces', uid, sub), where('ownerId', '==', uid));
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => stripFirestoreMeta(d.data()));
      if (docs.length > 0 || !['branches', 'warehouses', 'chartOfAccounts'].includes(sub)) {
        (loaded as Record<string, unknown>)[sub] = docs;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, subPath);
    }
  }

  return loaded;
}

async function seedAllSubcollections(uid: string, state: PersistedState): Promise<void> {
  const ops: { path: string; sub: SubcollectionName; id: string; payload: Record<string, unknown> }[] = [];

  for (const sub of SUBCOLLECTIONS) {
    const items = (state[sub] as unknown[]) ?? [];
    for (const item of items) {
      const sanitized = sanitizeEntityForWrite(
        sub,
        uid,
        item,
        state.settings.defaultSalesTaxRate,
        state.settings.defaultPurchaseTaxRate,
        state.settings.currency,
      );
      const id = String(sanitized.id);
      ops.push({
        path: `workspaces/${uid}/${sub}/${id}`,
        sub,
        id,
        payload: {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }
  }

  for (let i = 0; i < ops.length; i += 400) {
    const chunk = ops.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const op of chunk) {
      batch.set(doc(db, 'workspaces', uid, op.sub, op.id), op.payload);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `workspaces/${uid}/seedBatch`);
    }
  }
}

function stripFirestoreMeta<T extends Record<string, unknown>>(docData: T): T {
  const copy = { ...docData };
  delete copy.ownerId;
  delete copy.createdAt;
  delete copy.updatedAt;
  return copy;
}

export function subscribeWorkspace(
  uid: string,
  onPatch: (patch: Partial<PersistedState>) => void,
  onSyncError: (err: Error) => void,
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  const wsPath = `workspaces/${uid}`;
  unsubs.push(
    onSnapshot(
      doc(db, 'workspaces', uid),
      (snap) => {
        if (!snap.exists() || snap.metadata.hasPendingWrites) return;
        const wsData = snap.data();
        onPatch({
          currentRole: wsData.currentRole as RoleId,
          activePlan: wsData.activePlan as string,
          trialStartIso: wsData.trialStartIso as string,
          permissionsMatrix: wsData.permissionsMatrix as PermissionsMatrix,
          settings: {
            companyName: wsData.companyName as string,
            taxNumber: wsData.taxNumber as string,
            crNumber: wsData.crNumber as string,
            phone: wsData.phone as string,
            email: wsData.email as string,
            address: wsData.address as string,
            currency: wsData.currency as PersistedState['settings']['currency'],
            enabledCurrencies: wsData.enabledCurrencies as CurrencyCode[] | undefined,
            exchangeRates: wsData.exchangeRates as Record<string, number> | undefined,
            lastRatesUpdate: wsData.lastRatesUpdate as string | undefined,
            isArabic: Boolean(wsData.isArabic),
            isDarkMode: Boolean(wsData.isDarkMode),
            monthlySalesGoal: Number(wsData.monthlySalesGoal ?? 120000),
            defaultSalesTaxRate: Number(wsData.defaultSalesTaxRate ?? 15),
            defaultPurchaseTaxRate: Number(wsData.defaultPurchaseTaxRate ?? 15),
            autoBackupDaily: Boolean(wsData.autoBackupDaily),
            lastBackupDate: wsData.lastBackupDate as string | undefined,
            autoCloudSync:
              typeof wsData.autoCloudSync === 'boolean' ? wsData.autoCloudSync : true,
            autoSyncIntervalMinutes: Number(wsData.autoSyncIntervalMinutes ?? 0),
            logoBase64: wsData.logoBase64 as string | undefined,
            fiscalLockDate: wsData.fiscalLockDate as string | undefined,
            defaultBranchId: wsData.defaultBranchId as string | undefined,
            defaultWarehouseId: wsData.defaultWarehouseId as string | undefined,
            receiptFooter: wsData.receiptFooter as string | undefined,
          },
        });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, wsPath);
        } catch (wrapped) {
          onSyncError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      },
    ),
  );

  for (const sub of SUBCOLLECTIONS) {
    const subPath = `workspaces/${uid}/${sub}`;
    const q = query(collection(db, 'workspaces', uid, sub), where('ownerId', '==', uid));
    unsubs.push(
      onSnapshot(
        q,
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const items = snap.docs.map((d) => stripFirestoreMeta(d.data()));
          if (items.length > 0 || !['branches', 'warehouses', 'chartOfAccounts'].includes(sub)) {
            onPatch({ [sub]: items } as Partial<PersistedState>);
          }
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, subPath);
          } catch (wrapped) {
            onSyncError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
          }
        },
      ),
    );
  }

  return () => {
    for (const u of unsubs) u();
  };
}

function stableEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isTerminalStateLocked(sub: SubcollectionName, prevItem: Record<string, unknown>, isUserAdmin: boolean): boolean {
  if (isUserAdmin) return false;
  if (sub === 'invoices' && prevItem.status === 'paid') return true;
  if (sub === 'purchaseOrders' && prevItem.status === 'received') return true;
  if (sub === 'quotations' && (prevItem.status === 'accepted' || prevItem.status === 'rejected')) return true;
  return false;
}

export async function syncStateDiffToFirestore(
  uid: string,
  userEmail: string | null | undefined,
  prev: PersistedState,
  next: PersistedState,
): Promise<void> {
  const isUserAdmin = userEmail === 'alnwmbshyr1@gmail.com';
  const prevWs = sanitizeWorkspaceFields(uid, prev);
  const nextWs = sanitizeWorkspaceFields(uid, next);

  if (!stableEqual(prevWs, nextWs)) {
    const wsPath = `workspaces/${uid}`;
    const wsPatch: Record<string, unknown> = { ...nextWs, updatedAt: serverTimestamp() };
    for (const optKey of ['logoBase64', 'fiscalLockDate', 'defaultBranchId', 'defaultWarehouseId', 'receiptFooter']) {
      if (prevWs[optKey] !== undefined && nextWs[optKey] === undefined) {
        wsPatch[optKey] = deleteField();
      }
    }
    try {
      await updateDoc(doc(db, 'workspaces', uid), wsPatch);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, wsPath);
    }
  }

  for (const sub of SUBCOLLECTIONS) {
    const prevList = ((prev[sub] as { id: string }[]) ?? []);
    const nextList = ((next[sub] as { id: string }[]) ?? []);
    const prevMap = new Map(prevList.map((item) => [sanitizeId(item.id, sub), item]));
    const nextMap = new Map(nextList.map((item) => [sanitizeId(item.id, sub), item]));

    for (const [id, nextRaw] of nextMap.entries()) {
      const nextSanitized = sanitizeEntityForWrite(
        sub,
        uid,
        nextRaw,
        next.settings.defaultSalesTaxRate,
        next.settings.defaultPurchaseTaxRate,
        next.settings.currency,
      );
      const prevRaw = prevMap.get(id);
      const docPath = `workspaces/${uid}/${sub}/${id}`;

      if (!prevRaw) {
        try {
          await setDoc(doc(db, 'workspaces', uid, sub, id), {
            ...nextSanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, docPath);
        }
      } else {
        // Audit logs, stock movements, and stocktakes are append-only in Firestore rules
        if (sub === 'auditLogs' || sub === 'stockMovements' || sub === 'stocktakes') {
          continue;
        }
        const prevSanitized = sanitizeEntityForWrite(
          sub,
          uid,
          prevRaw,
          prev.settings.defaultSalesTaxRate,
          prev.settings.defaultPurchaseTaxRate,
          prev.settings.currency,
        );
        if (!stableEqual(prevSanitized, nextSanitized)) {
          if (isTerminalStateLocked(sub, prevSanitized, isUserAdmin)) {
            continue;
          }
          const patch: Record<string, unknown> = { ...nextSanitized };
          delete patch.id;
          delete patch.ownerId;
          for (const prevKey of Object.keys(prevSanitized)) {
            if (prevKey !== 'id' && prevKey !== 'ownerId' && nextSanitized[prevKey] === undefined) {
              patch[prevKey] = deleteField();
            }
          }
          try {
            await updateDoc(doc(db, 'workspaces', uid, sub, id), {
              ...patch,
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, docPath);
          }
        }
      }
    }

    if (sub !== 'auditLogs') {
      for (const id of prevMap.keys()) {
        if (!nextMap.has(id)) {
          const docPath = `workspaces/${uid}/${sub}/${id}`;
          try {
            await deleteDoc(doc(db, 'workspaces', uid, sub, id));
          } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, docPath);
          }
        }
      }
    }
  }
}

export async function pushFullStateToCloud(uid: string, state: PersistedState): Promise<void> {
  const wsPath = `workspaces/${uid}`;
  const wsRef = doc(db, 'workspaces', uid);
  try {
    const snap = await getDoc(wsRef);
    if (!snap.exists()) {
      await setDoc(wsRef, {
        ...sanitizeWorkspaceFields(uid, state),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(wsRef, {
        ...sanitizeWorkspaceFields(uid, state),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, wsPath);
  }

  await seedAllSubcollections(uid, state);
}

export async function saveCloudBackupSnapshot(
  uid: string,
  state: PersistedState,
  dateKey: string,
): Promise<CloudBackupMeta | null> {
  const backupId = sanitizeId(`BKP-${dateKey}`, 'BKP');
  const payloadJson = JSON.stringify(state);
  if (payloadJson.length > 840000) {
    return null;
  }
  const recordCount =
    state.invoices.length +
    state.customers.length +
    state.suppliers.length +
    state.products.length +
    state.journals.length;
  const sizeBytes = new Blob([payloadJson]).size;
  const refDoc = doc(db, 'workspaces', uid, 'cloudBackups', backupId);
  try {
    const existing = await getDoc(refDoc);
    if (existing.exists()) {
      await updateDoc(refDoc, {
        dateKey,
        recordCount,
        sizeBytes,
        payloadJson,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(refDoc, {
        id: backupId,
        ownerId: uid,
        dateKey,
        recordCount,
        sizeBytes,
        payloadJson,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return {
      id: backupId,
      dateKey,
      createdAt: new Date().toISOString(),
      recordCount,
      sizeBytes,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workspaces/${uid}/cloudBackups/${backupId}`);
  }
}

export async function listCloudBackupSnapshots(uid: string): Promise<CloudBackupMeta[]> {
  try {
    const q = query(collection(db, 'workspaces', uid, 'cloudBackups'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: String(data.id ?? d.id),
          dateKey: String(data.dateKey ?? ''),
          createdAt: String(data.dateKey ?? ''),
          recordCount: Number(data.recordCount ?? 0),
          sizeBytes: Number(data.sizeBytes ?? 0),
        };
      })
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  } catch {
    return [];
  }
}

export async function fetchCloudBackupSnapshotJson(uid: string, backupId: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'workspaces', uid, 'cloudBackups', sanitizeId(backupId, 'BKP')));
    if (!snap.exists()) return null;
    return String(snap.data().payloadJson ?? '');
  } catch {
    return null;
  }
}
