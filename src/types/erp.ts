export type InvoiceStatus = 'paid' | 'partial' | 'pending' | 'overdue' | 'cancelled';
export type InvoiceDocType = 'sales' | 'return' | 'quotation';
export type PaymentMethodType =
  | 'cash'
  | 'credit'
  | 'pos_card'
  | 'transfer'
  | 'cheque'
  | 'installment';
export type UnitOfMeasure = 'piece' | 'carton' | 'kg' | 'meter';
export type CustomerType = 'individual' | 'company' | 'VIP' | 'wholesale' | 'retail';
export type SupplierType = 'primary' | 'secondary' | 'manufacturer' | 'importer';
export type PartyStatus = 'active' | 'paused' | 'blocked';
export type AccountCategory = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
export type VoucherType = 'receipt' | 'payment';
export type PurchaseOrderStatus = 'ordered' | 'received';
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
export type ReturnReason = 'damaged' | 'wrong_item' | 'expired' | 'changed_mind' | 'other';
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type ArchivedDocumentType =
  | 'contract'
  | 'receipt'
  | 'tax_cert'
  | 'id_doc'
  | 'invoice_scan'
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
  dueDate?: string;
  branchId?: string;
  branchName?: string;
  warehouseId?: string;
  warehouseName?: string;
  salespersonName?: string;
  shiftName?: string;
  paymentMethod?: PaymentMethodType;
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
  address?: string;
  city?: string;
  country?: string;
  mapUrl?: string;
  customerType?: CustomerType;
  taxNumber?: string;
  nationalId?: string;
  birthDate?: string;
  creditTermDays?: number;
  preferredPaymentMethod?: PaymentMethodType;
  salesRep?: string;
  branchId?: string;
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
  photoBase64?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  supplierType?: SupplierType;
  taxNumber?: string;
  crNumber?: string;
  bankAccount?: string;
  bankName?: string;
  creditLimit?: number;
  paymentTermDays?: number;
  preferredPaymentMethod?: PaymentMethodType;
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
  subtotal?: number;
  taxRate?: number;
  vat?: number;
  total: number;
  status: PurchaseOrderStatus;
  date: string;
  branchId?: string;
  warehouseId?: string;
  paymentMethod?: PaymentMethodType;
  notes?: string;
  paidAmount?: number;
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
}

export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  reference: string;
  description: string;
  date: string;
  lines: JournalLine[];
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  imageBase64?: string;
  qty: number;
  cost: number;
  price: number;
  category?: string;
  unit?: UnitOfMeasure;
  wholesalePrice?: number;
  taxRate?: number;
  minStock?: number;
  maxStock?: number;
  expiryDate?: string;
  supplierId?: string;
  warehouseId?: string;
}

export interface Employee {
  id: string;
  name: string;
  roleTitle: string;
  role: RoleId;
  permissions: RouteId[];
  phone: string;
  salary: number;
  lastPaidDate?: string;
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  paidFromBankId: string;
  date: string;
  branchId?: string;
}

export interface BankAccount {
  id: string;
  nameAr: string;
  nameEn: string;
  accountNumber: string;
  balance: number;
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
  nameAr: string;
  nameEn: string;
  branchId: string;
  location: string;
  managerName: string;
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
  isSystem?: boolean;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  actorRole: RoleId;
  action: 'create' | 'update' | 'delete' | 'pay' | 'receive' | 'transfer' | 'reconcile' | 'stocktake' | 'fiscal_lock' | 'backup';
  entity: string;
  entityId: string;
  summary: string;
  timestamp: string;
}

export interface CompanySettings {
  companyName: string;
  taxNumber: string;
  crNumber: string;
  phone: string;
  email: string;
  address: string;
  currency: CurrencyCode;
  enabledCurrencies?: CurrencyCode[];
  exchangeRates?: Record<string, number>;
  lastRatesUpdate?: string;
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
  customerId: string;
  customerName: string;
  customerPhone: string;
  description: string;
  items: LineItem[];
  subtotal: number;
  taxRate: number;
  currency: CurrencyCode;
  frequency: RecurringFrequency;
  nextRunDate: string;
  lastGeneratedDate?: string;
  targetStatus: InvoiceStatus;
  autoGenerate: boolean;
  active: boolean;
  generatedCount: number;
  notes: string;
  date: string;
}

export interface ArchivedDocument {
  id: string;
  title: string;
  docType: ArchivedDocumentType;
  partyName: string;
  referenceId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  fileDataBase64?: string;
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
}
