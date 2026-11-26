export type InvoiceStatus = 'draft' | 'paid' | 'partial' | 'pending' | 'overdue' | 'cancelled';
export type InvoiceDocType = 'sales' | 'return' | 'quotation';
export type InvoiceDocKind = 'cash' | 'credit' | 'tax' | 'simplified';
export type PaymentMethodType =
  | 'cash'
  | 'credit'
  | 'pos_card'
  | 'transfer'
  | 'cheque'
  | 'installment'
  | 'apple_pay';
export type UnitOfMeasure = 'piece' | 'carton' | 'kg' | 'meter' | 'liter' | 'box';
export type CustomerType = 'individual' | 'company' | 'VIP' | 'wholesale' | 'retail' | 'distributor';
export type SupplierType = 'primary' | 'secondary' | 'manufacturer' | 'importer' | 'local' | 'distributor' | 'services';
export type PartyStatus = 'active' | 'paused' | 'blocked' | 'potential';
export type AccountCategory = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
export type VoucherType = 'receipt' | 'payment' | 'journal';
export type PurchaseOrderStatus = 'draft' | 'approved' | 'ordered' | 'received' | 'cancelled';
export type CurrencyCode =
  | 'SAR'
  | 'YER'
  | 'EGP'
  | 'AED'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'KWD'
  | 'QAR'
  | 'BHD'
  | 'OMR'
  | 'JOD'
  | 'TRY';
export type RoleId = 'owner' | 'accountant' | 'cashier' | 'salesman' | 'warehouse';
export type ReturnType = 'sales' | 'purchase';
export type ReturnReason = 'damaged' | 'wrong_item' | 'expired' | 'not_matching' | 'changed_mind' | 'other';
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type ArchivedDocumentType =
  | 'contract'
  | 'receipt'
  | 'tax_cert'
  | 'id_doc'
  | 'invoice_scan'
  | 'cr_doc'
  | 'other';

export type RouteId =
  | 'dashboard'
  | 'pos'
  | 'invoices'
  | 'recurring_invoices'
  | 'returns'
  | 'quotations'
  | 'customers'
  | 'suppliers'
  | 'purchase_orders'
  | 'vouchers'
  | 'chart_of_accounts'
  | 'journals'
  | 'documents'
  | 'inventory'
  | 'warehouses'
  | 'employees'
  | 'expenses'
  | 'banks'
  | 'reports'
  | 'ai_analytics'
  | 'audit_log'
  | 'settings'
  | 'subscription'
  | 'help';

export type PermissionsMatrix = Record<RoleId, RouteId[]>;

export interface LineItem {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  total: number;
  barcode?: string;
  imageBase64?: string;
  category?: string;
  unit?: UnitOfMeasure;
  description?: string;
  receivedQty?: number;
  availableStock?: number;
  costPrice?: number;
  wholesalePrice?: number;
  discountPercent?: number;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  expiryDate?: string;
  note?: string;
}

export interface InstallmentItem {
  id: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: 'paid' | 'pending' | 'overdue';
}

export interface Invoice {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  description: string;
  items?: LineItem[];
  subtotal: number;
  taxRate?: number;
  vat: number;
  total: number;
  currency?: CurrencyCode;
  exchangeRate?: number;
  baseTotal?: number;
  status: InvoiceStatus;
  date: string;
  invoiceType?: InvoiceDocType;
  invoiceDocKind?: InvoiceDocKind;
  dueDate?: string;
  branchId?: string;
  branchName?: string;
  warehouseId?: string;
  warehouseName?: string;
  salespersonName?: string;
  shiftName?: string;
  paymentMethod?: PaymentMethodType;
  referenceNumber?: string;
  invoiceDiscountPercent?: number;
  discountTotal?: number;
  shippingFee?: number;
  extraFee?: number;
  paidAmount?: number;
  remainingAmount?: number;
  notes?: string;
  terms?: string;
  sellerSignature?: string;
  customerSignature?: string;
  installments?: InstallmentItem[];
  createdByRole?: RoleId;
}

export interface ReturnRecord {
  id: string;
  type: ReturnType;
  originalDocId: string;
  partyName: string;
  partyPhone: string;
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  amount: number;
  reason: ReturnReason;
  notes: string;
  date: string;
  warehouseId?: string;
  branchId?: string;
  itemCondition?: 'good_restock' | 'damaged_scrap';
  compensationMethod?: 'cash_refund' | 'replacement' | 'account_credit';
  approved?: boolean;
  photoBase64?: string;
}

export interface Quotation {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  items: LineItem[];
  discountPercent: number;
  subtotal: number;
  discountAmount: number;
  vat: number;
  total: number;
  validUntil: string;
  validityDays?: number;
  branchId?: string;
  salespersonName?: string;
  currency?: CurrencyCode;
  terms?: string;
  status: QuotationStatus;
  notes: string;
  date: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  debt: number;
  creditLimit?: number;
  code?: string;
  companyName?: string;
  photoBase64?: string;
  whatsapp?: string;
  landline?: string;
  website?: string;
  address?: string;
  district?: string;
  city?: string;
  country?: string;
  mapUrl?: string;
  gpsCoords?: string;
  customerType?: CustomerType;
  taxNumber?: string;
  taxStatus?: 'taxable' | 'exempt';
  nationalId?: string;
  crNumber?: string;
  birthDate?: string;
  openingBalanceDebit?: number;
  openingBalanceCredit?: number;
  creditTermDays?: number;
  preferredPaymentMethod?: PaymentMethodType;
  priceList?: string;
  specialDiscountPercent?: number;
  currency?: CurrencyCode;
  iban?: string;
  salesRep?: string;
  branchId?: string;
  leadSource?: string;
  firstDealDate?: string;
  rating?: 'A' | 'B' | 'C';
  reminderDate?: string;
  attachmentBase64?: string;
  status?: PartyStatus;
  notes?: string;
  callLogs?: string;
  createdAtDate?: string;
  createdBy?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  category: string;
  payable: number;
  code?: string;
  companyName?: string;
  contactPerson?: string;
  photoBase64?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  mapUrl?: string;
  supplierType?: SupplierType;
  taxNumber?: string;
  crNumber?: string;
  bankAccount?: string;
  bankName?: string;
  iban?: string;
  openingBalance?: number;
  creditLimit?: number;
  paymentTermDays?: number;
  preferredPaymentMethod?: PaymentMethodType;
  currency?: CurrencyCode;
  supplyTerms?: string;
  supplierDiscountPercent?: number;
  leadTimeDays?: number;
  suppliedItems?: string;
  lastPurchasePrice?: number;
  qualityRating?: number;
  speedRating?: number;
  attachmentBase64?: string;
  branchId?: string;
  repName?: string;
  status?: PartyStatus;
  notes?: string;
  contractsNotes?: string;
  createdAtDate?: string;
  createdBy?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  items?: LineItem[];
  subtotal?: number;
  discountTotal?: number;
  shippingFee?: number;
  taxRate?: number;
  vat?: number;
  total: number;
  status: PurchaseOrderStatus;
  date: string;
  expectedDeliveryDate?: string;
  paymentTermDays?: number;
  branchId?: string;
  warehouseId?: string;
  paymentMethod?: PaymentMethodType;
  notes?: string;
  paidAmount?: number;
  supplierInvoiceBase64?: string;
}

export interface Voucher {
  id: string;
  type: VoucherType;
  partyName: string;
  partyPhone: string;
  amount: number;
  reason: string;
  paymentMethod: string;
  date: string;
  fromAccount?: string;
  toAccount?: string;
  partyType?: 'customer' | 'supplier' | 'employee';
  branchId?: string;
  bankId?: string;
  chequeNumber?: string;
  chequeDueDate?: string;
  attachmentBase64?: string;
  status?: 'draft' | 'approved';
}

export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntry {
  id: string;
  reference: string;
  description: string;
  date: string;
  lines: JournalLine[];
  entryType?: 'manual' | 'auto';
  branchId?: string;
  costCenter?: string;
  status?: 'draft' | 'approved';
  attachmentBase64?: string;
}

export interface Product {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  sku: string;
  barcode: string;
  imageBase64?: string;
  qty: number;
  openingQty?: number;
  cost: number;
  price: number;
  retailPrice?: number;
  vipPrice?: number;
  minPrice?: number;
  category?: string;
  brand?: string;
  unit?: UnitOfMeasure;
  subUnit?: string;
  subUnitFactor?: number;
  wholesalePrice?: number;
  isTaxable?: boolean;
  taxRate?: number;
  minStock?: number;
  maxStock?: number;
  shelfLocation?: string;
  expiryDate?: string;
  batchNumber?: string;
  serialNumber?: string;
  status?: 'active' | 'paused' | 'service';
  supplierId?: string;
  branchId?: string;
  warehouseId?: string;
}

export interface Employee {
  id: string;
  code?: string;
  name: string;
  roleTitle: string;
  department?: string;
  role: RoleId;
  permissions: RouteId[];
  phone: string;
  whatsapp?: string;
  email?: string;
  nationalId?: string;
  birthDate?: string;
  branchId?: string;
  hireDate?: string;
  salary: number;
  allowances?: number;
  deductions?: number;
  bankAccount?: string;
  workShift?: string;
  username?: string;
  password?: string;
  photoBase64?: string;
  attachmentBase64?: string;
  idAttachmentBase64?: string;
  status?: 'active' | 'on_leave' | 'terminated';
  notes?: string;
  lastPaidDate?: string;
}

export type ExpenseType = 'rent' | 'electricity' | 'salaries' | 'maintenance' | 'marketing' | 'other';
export type ExpenseStatus = 'draft' | 'approved' | 'paid';

export interface Expense {
  id: string;
  expenseNumber?: string;
  title: string;
  category: string;
  expenseType?: ExpenseType;
  beneficiary?: string;
  costCenter?: string;
  amount: number;
  currency?: CurrencyCode;
  exchangeRate?: number;
  baseAmount?: number;
  paymentMethod?: PaymentMethodType;
  paidFromBankId: string;
  status?: ExpenseStatus;
  date: string;
  branchId?: string;
  attachmentBase64?: string;
  notes?: string;
  isRecurringMonthly?: boolean;
  reminderDate?: string;
}

export interface BankAccount {
  id: string;
  accountType?: 'bank' | 'cash';
  bankName?: string;
  nameAr: string;
  nameEn: string;
  accountNumber: string;
  iban?: string;
  branchId?: string;
  currency?: CurrencyCode;
  openingBalance?: number;
  balance: number;
  custodianName?: string;
  status?: 'active' | 'closed';
  lastReconciledDate?: string;
}

export interface Branch {
  id: string;
  nameAr: string;
  nameEn: string;
  city: string;
  phone: string;
  managerName: string;
  isMain?: boolean;
  active: boolean;
}

export interface Warehouse {
  id: string;
  code?: string;
  nameAr: string;
  nameEn: string;
  branchId: string;
  city?: string;
  address?: string;
  location: string;
  managerName: string;
  warehouseType?: 'main' | 'sub';
  active: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  movementType: 'sale' | 'purchase' | 'return_in' | 'return_out' | 'transfer' | 'stocktake';
  qtyDelta: number;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  referenceId: string;
  reason?: string;
  notes: string;
  date: string;
}

export interface StocktakeRecord {
  id: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productName: string;
  systemQty: number;
  actualQty: number;
  varianceQty: number;
  varianceValue: number;
  countedBy?: string;
  reason?: string;
  notes: string;
  date: string;
}

export interface ChartAccount {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  category: AccountCategory;
  parentCode?: string;
  level?: number;
  normalBalance?: 'debit' | 'credit';
  openingBalance?: number;
  costCenter?: string;
  branchId?: string;
  allowPosting?: boolean;
  notes?: string;
  isSystem?: boolean;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  actorRole: RoleId;
  action: 'create' | 'update' | 'delete' | 'pay' | 'receive' | 'transfer' | 'reconcile' | 'stocktake' | 'fiscal_lock' | 'backup' | 'print';
  entity: string;
  entityId: string;
  summary: string;
  screenName?: string;
  oldValue?: string;
  newValue?: string;
  deviceInfo?: string;
  timestamp: string;
}

export interface CompanySettings {
  companyName: string;
  taxNumber: string;
  crNumber: string;
  phone: string;
  email: string;
  address: string;
  city?: string;
  currency: CurrencyCode;
  enabledCurrencies?: CurrencyCode[];
  exchangeRates?: Record<string, number>;
  lastRatesUpdate?: string;
  lastRatesSource?: 'live' | 'fallback';
  autoUpdateExchangeRates?: boolean;
  fxAutoIntervalHours?: number;
  displayCurrency?: CurrencyCode;
  currencyDisplayStyle?: 'symbol' | 'code' | 'both';
  currencyNumberLocale?: 'auto' | 'en-US' | 'ar-SA';
  currencyDecimalMode?: 'auto' | '0' | '2' | '3';
  isArabic: boolean;
  isDarkMode: boolean;
  monthlySalesGoal: number;
  defaultSalesTaxRate: number;
  defaultPurchaseTaxRate: number;
  autoBackupDaily: boolean;
  lastBackupDate?: string;
  autoCloudSync?: boolean;
  autoSyncIntervalMinutes?: number;
  logoBase64?: string;
  fiscalLockDate?: string;
  defaultBranchId?: string;
  defaultWarehouseId?: string;
  receiptFooter?: string;
  invoicePrefix?: string;
  invoiceNumberFormat?: string;
  invoiceTerms?: string;
  printPaperSize?: 'a4' | 'thermal_80' | 'thermal_58';
  showQrOnPrint?: boolean;
  showLogoOnPrint?: boolean;
  whatsappTemplate?: string;
  senderEmail?: string;
}

export interface SubscriptionMeta {
  planId: 'free' | 'basic' | 'pro' | 'enterprise';
  billingCycle: 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled';
  paymentMethod: string;
  autoRenew: boolean;
}

export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  screenshotBase64?: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
}

export interface SmartAlert {
  id: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  actionRoute: RouteId;
  severity: 'warning' | 'danger' | 'info';
}

export interface RecurringInvoice {
  id: string;
  templateName?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  description: string;
  items: LineItem[];
  subtotal: number;
  taxRate: number;
  currency: CurrencyCode;
  frequency: RecurringFrequency;
  startDate?: string;
  endDate?: string;
  maxOccurrences?: number;
  issueDay?: number;
  nextRunDate: string;
  lastGeneratedDate?: string;
  targetStatus: InvoiceStatus;
  autoGenerate: boolean;
  autoSendWhatsApp?: boolean;
  autoSendEmail?: boolean;
  notifyDaysBefore?: number;
  active: boolean;
  generatedCount: number;
  notes: string;
  date: string;
}

export interface ArchivedDocument {
  id: string;
  title: string;
  docType: ArchivedDocumentType;
  partyType?: 'customer' | 'supplier' | 'employee';
  partyName: string;
  referenceId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  fileDataBase64?: string;
  expiryDate?: string;
  notes: string;
  date: string;
}

export interface CloudBackupMeta {
  id: string;
  dateKey: string;
  createdAt: string;
  recordCount: number;
  sizeBytes: number;
}

export interface PosHeldCart {
  id: string;
  label: string;
  createdAt: string;
  customerId: string;
  branchId: string;
  warehouseId: string;
  paymentMethod: PaymentMethodType;
  discountPercent: number;
  items: {
    productId: string;
    name: string;
    price: number;
    qty: number;
    unit: UnitOfMeasure;
    costPrice?: number;
    barcode?: string;
    taxRate?: number;
  }[];
}

export interface PosShiftSession {
  id: string;
  isOpen: boolean;
  cashierName: string;
  branchId: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  actualClosingCash?: number;
  notes?: string;
}

export type BatchPrintItem =
  | { kind: 'invoice'; data: Invoice }
  | { kind: 'return'; data: ReturnRecord }
  | { kind: 'quotation'; data: Quotation }
  | { kind: 'voucher'; data: Voucher };

export interface PersistedState {
  onboardingSeen: boolean;
  isLoggedIn: boolean;
  currentRole: RoleId;
  activePlan: string;
  trialStartIso: string;
  subscriptionMeta?: SubscriptionMeta;
  settings: CompanySettings;
  permissionsMatrix: PermissionsMatrix;
  invoices: Invoice[];
  recurringInvoices: RecurringInvoice[];
  returns: ReturnRecord[];
  quotations: Quotation[];
  customers: Customer[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  vouchers: Voucher[];
  journals: JournalEntry[];
  documents: ArchivedDocument[];
  products: Product[];
  employees: Employee[];
  expenses: Expense[];
  banks: BankAccount[];
  branches: Branch[];
  warehouses: Warehouse[];
  chartOfAccounts: ChartAccount[];
  stockMovements: StockMovement[];
  stocktakes: StocktakeRecord[];
  auditLogs: AuditLogEntry[];
  supportTickets?: SupportTicket[];
}
