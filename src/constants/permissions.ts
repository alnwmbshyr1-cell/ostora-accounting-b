import { RoleId, RouteId } from '../types/erp';

export const ALL_ROUTES: RouteId[] = [
  'dashboard',
  'invoices',
  'returns',
  'quotations',
  'customers',
  'suppliers',
  'purchase_orders',
  'vouchers',
  'journals',
  'inventory',
  'employees',
  'expenses',
  'banks',
  'reports',
  'ai_analytics',
  'subscription',
  'settings',
  'help',
];

export const DEFAULT_PERMISSIONS_MATRIX: Record<RoleId, RouteId[]> = {
  owner: [...ALL_ROUTES],
  accountant: ['dashboard', 'invoices', 'returns', 'vouchers', 'journals', 'reports', 'expenses', 'banks', 'help'],
  salesman: ['dashboard', 'customers', 'invoices', 'quotations', 'returns', 'inventory', 'help'],
  warehouse: ['dashboard', 'inventory', 'purchase_orders', 'returns', 'help'],
};

export const ROLE_LABELS: Record<RoleId, { ar: string; en: string }> = {
  owner: { ar: 'المالك', en: 'Owner' },
  accountant: { ar: 'محاسب', en: 'Accountant' },
  salesman: { ar: 'مبيعات', en: 'Salesman' },
  warehouse: { ar: 'مستودع', en: 'Warehouse' },
};

export const DEFAULT_PRODUCT_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" rx="16" fill="#0A3D2C"/><rect x="44" y="28" width="72" height="64" rx="10" fill="none" stroke="#C9A227" stroke-width="5"/><path d="M44 48 H116 M80 28 V92" stroke="#C9A227" stroke-width="4" opacity="0.8"/></svg>`,
  );
