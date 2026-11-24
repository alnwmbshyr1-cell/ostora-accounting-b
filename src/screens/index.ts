import React, { Suspense } from 'react';
import { RouteId } from '../types/erp';
import { AiAnalyticsScreen } from './AiAnalyticsScreen';
import { BanksScreen } from './BanksScreen';
import { CustomersScreen } from './CustomersScreen';
import { DashboardScreen } from './DashboardScreen';
import { EmployeesScreen } from './EmployeesScreen';
import { ExpensesScreen } from './ExpensesScreen';
import { HelpScreen } from './HelpScreen';
import { InventoryScreen } from './InventoryScreen';
import { InvoicesScreen } from './InvoicesScreen';
import { JournalsScreen } from './JournalsScreen';
import { PurchaseOrdersScreen } from './PurchaseOrdersScreen';
import { QuotationsScreen } from './QuotationsScreen';
import { ReturnsScreen } from './ReturnsScreen';
import { SettingsScreen } from './SettingsScreen';
import { SubscriptionScreen } from './SubscriptionScreen';
import { SuppliersScreen } from './SuppliersScreen';
import { ScreenProps } from './types';
import { VouchersScreen } from './VouchersScreen';

const ReportsScreen = React.lazy(() =>
  import('./ReportsScreen').then((m) => ({ default: m.ReportsScreen })),
);

const SCREEN_REGISTRY: Record<RouteId, React.ComponentType<ScreenProps>> = {
  dashboard: DashboardScreen,
  invoices: InvoicesScreen,
  returns: ReturnsScreen,
  quotations: QuotationsScreen,
  customers: CustomersScreen,
  suppliers: SuppliersScreen,
  purchase_orders: PurchaseOrdersScreen,
  vouchers: VouchersScreen,
  journals: JournalsScreen,
  inventory: InventoryScreen,
  employees: EmployeesScreen,
  expenses: ExpensesScreen,
  banks: BanksScreen,
  reports: ReportsScreen,
  ai_analytics: AiAnalyticsScreen,
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
        children: props.store.state.settings.isArabic ? 'جاري التحميل...' : 'Loading...',
      }),
    },
    React.createElement(ActiveScreen, props),
  );
};
