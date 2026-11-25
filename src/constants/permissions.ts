import { RoleId, RouteId } from '../types/erp';

export const ALL_ROUTES: RouteId[] = [
  'dashboard',
  'pos',
  'invoices',
  'recurring_invoices',
  'returns',
  'quotations',
  'customers',
  'suppliers',
  'purchase_orders',
  'vouchers',
  'chart_of_accounts',
  'journals',
  'documents',
  'inventory',
  'warehouses',
  'employees',
  'expenses',
  'banks',
  'reports',
  'ai_analytics',
  'audit_log',
  'subscription',
  'settings',
  'help',
];

export const DEFAULT_PERMISSIONS_MATRIX: Record<RoleId, RouteId[]> = {
  owner: [...ALL_ROUTES],
  accountant: [
    'dashboard',
    'invoices',
    'recurring_invoices',
    'returns',
    'vouchers',
    'chart_of_accounts',
    'journals',
    'documents',
    'reports',
    'expenses',
    'banks',
    'audit_log',
    'help',
  ],
  cashier: [
    'pos',
    'invoices',
    'returns',
    'customers',
    'help',
  ],
  salesman: [
    'dashboard',
    'customers',
    'invoices',
    'recurring_invoices',
    'quotations',
    'returns',
    'documents',
    'inventory',
    'help',
  ],
  warehouse: [
    'dashboard',
    'inventory',
    'warehouses',
    'purchase_orders',
    'returns',
    'documents',
    'help',
  ],
};

export const ROLE_LABELS: Record<RoleId, { ar: string; en: string }> = {
  owner: { ar: 'المدير (Owner)', en: 'Owner' },
  accountant: { ar: 'محاسب (بدون حذف)', en: 'Accountant' },
  cashier: { ar: 'كاشير (مبيعات فقط)', en: 'Cashier' },
  salesman: { ar: 'مندوب مبيعات', en: 'Salesman' },
  warehouse: { ar: 'أمين مستودع', en: 'Warehouse' },
};

export const DEFAULT_PRODUCT_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" rx="16" fill="#0A3D2C"/><rect x="44" y="28" width="72" height="64" rx="10" fill="none" stroke="#C9A227" stroke-width="5"/><path d="M44 48 H116 M80 28 V92" stroke="#C9A227" stroke-width="4" opacity="0.8"/></svg>`,
  );
