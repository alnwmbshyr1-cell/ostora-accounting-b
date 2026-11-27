import React, { Suspense } from 'react';
import { RouteId } from '../types/erp';
import { BanksScreen } from './BanksScreen';
import { CustomersScreen } from './CustomersScreen';
import { DashboardScreen } from './DashboardScreen';
import { DocumentRegisterScreen } from './DocumentRegisterScreen';
import { EmployeesScreen } from './EmployeesScreen';
import { ExpensesScreen } from './ExpensesScreen';
import { HelpScreen } from './HelpScreen';
import { InventoryScreen } from './InventoryScreen';
import { PurchaseOrdersScreen } from './PurchaseOrdersScreen';
import { QuotationsScreen } from './QuotationsScreen';
import { RecurringInvoicesScreen } from './RecurringInvoicesScreen';
import { ReturnsScreen } from './ReturnsScreen';
import { SubscriptionScreen } from './SubscriptionScreen';
import { SuppliersScreen } from './SuppliersScreen';
import { ScreenProps } from './types';
import { VouchersScreen } from './VouchersScreen';
import { WarehousesScreen } from './WarehousesScreen';

const PosScreen = React.lazy(() =>
  import('./PosScreen').then((m) => ({ default: m.PosScreen })),
);
const InvoicesScreen = React.lazy(() =>
  import('./InvoicesScreen').then((m) => ({ default: m.InvoicesScreen })),
);
const ChartOfAccountsScreen = React.lazy(() =>
  import('./ChartOfAccountsScreen').then((m) => ({ default: m.ChartOfAccountsScreen })),
);
const JournalsScreen = React.lazy(() =>
  import('./JournalsScreen').then((m) => ({ default: m.JournalsScreen })),
);
const ReportsScreen = React.lazy(() =>
  import('./ReportsScreen').then((m) => ({ default: m.ReportsScreen })),
);
const AiAnalyticsScreen = React.lazy(() =>
  import('./AiAnalyticsScreen').then((m) => ({ default: m.AiAnalyticsScreen })),
);
const AuditLogScreen = React.lazy(() =>
  import('./AuditLogScreen').then((m) => ({ default: m.AuditLogScreen })),
);
const SettingsScreen = React.lazy(() =>
  import('./SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);

const SCREEN_REGISTRY: Record<RouteId, React.ComponentType<ScreenProps>> = {
  dashboard: DashboardScreen,
  pos: PosScreen,
  invoices: InvoicesScreen,
  recurring_invoices: RecurringInvoicesScreen,
  returns: ReturnsScreen,
  quotations: QuotationsScreen,
  customers: CustomersScreen,
  suppliers: SuppliersScreen,
  purchase_orders: PurchaseOrdersScreen,
  vouchers: VouchersScreen,
  chart_of_accounts: ChartOfAccountsScreen,
  journals: JournalsScreen,
  documents: DocumentRegisterScreen,
  inventory: InventoryScreen,
  warehouses: WarehousesScreen,
  employees: EmployeesScreen,
  expenses: ExpensesScreen,
  banks: BanksScreen,
  reports: ReportsScreen,
  ai_analytics: AiAnalyticsScreen,
  audit_log: AuditLogScreen,
  settings: SettingsScreen,
  subscription: SubscriptionScreen,
  help: HelpScreen,
};

export const ErpScreenRouter: React.FC<{ route: RouteId } & ScreenProps> = ({ route, ...props }) => {
  const ActiveScreen = SCREEN_REGISTRY[route];
  if (!ActiveScreen) return null;
  return React.createElement(
    Suspense,
    {
      fallback: React.createElement('div', {
        className:
          'bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500',
        children: props.store.localeStrings.loading || 'Loading...',
      }),
    },
    React.createElement(ActiveScreen, props),
  );
};
