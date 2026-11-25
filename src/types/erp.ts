export type InvoiceStatus = 'paid' | 'pending' | 'overdue';
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
export type RoleId = 'owner' | 'accountant' | 'salesman' | 'warehouse';
export type ReturnType = 'sales' | 'purchase';
export type ReturnReason = 'damaged' | 'wrong_item' | 'expired' | 'changed_mind' | 'other';
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export type RouteId =
  | 'dashboard'
  | 'invoices'
  | 'returns'
  | 'quotations'
  | 'customers'
  | 'suppliers'
  | 'purchase_orders'
  | 'vouchers'
  | 'journals'
  | 'inventory'
  | 'employees'
  | 'expenses'
  | 'banks'
  | 'reports'
  | 'ai_analytics'
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
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  category: string;
  payable: number;
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
}

export interface BankAccount {
  id: string;
  nameAr: string;
  nameEn: string;
  accountNumber: string;
  balance: number;
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

export interface PersistedState {
  onboardingSeen: boolean;
  isLoggedIn: boolean;
  currentRole: RoleId;
  activePlan: string;
  trialStartIso: string;
  settings: CompanySettings;
  permissionsMatrix: PermissionsMatrix;
  invoices: Invoice[];
  returns: ReturnRecord[];
  quotations: Quotation[];
  customers: Customer[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  vouchers: Voucher[];
  journals: JournalEntry[];
  products: Product[];
  employees: Employee[];
  expenses: Expense[];
  banks: BankAccount[];
}

