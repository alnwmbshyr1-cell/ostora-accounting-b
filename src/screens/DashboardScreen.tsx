import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Landmark,
  Package,
  Plus,
  Receipt,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { strings } from '../data/translations';
import {
  computeDashboardExecutiveStats,
  computeDashboardTodayKpis,
  computeMonthlySummaryRich,
} from '../domain/analytics';
import { computeUnifiedNetProfit, getExpenseBaseHalalas } from '../domain/accounting';
import { fromHalalas, mulFxHalalas, toHalalas } from '../domain/halala';
import { CurrencyCode, RouteId } from '../types/erp';
import { DashboardQuickActionsFab } from '../components/DashboardQuickActionsFab';
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal';
import { HealthScoreRing } from '../components/QrMatrix';
import {
  convertFromBaseCurrency,
  DEFAULT_ENABLED_CURRENCIES,
  formatCurrency,
} from '../utils/currencies';
import { ScreenProps } from './types';

export const DashboardScreen: React.FC<ScreenProps> = ({ store, onNavigate, onPrintInvoice }) => {
  const { state, metrics, actions, hasPermission } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const dispCur = state.settings.displayCurrency ?? cur;
  const t = strings[isAr ? 'ar' : 'en'];
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const enabledCurrencies = useMemo(
    () =>
      Array.from(
        new Set<CurrencyCode>([cur, ...(state.settings.enabledCurrencies ?? DEFAULT_ENABLED_CURRENCIES)]),
      ),
    [cur, state.settings.enabledCurrencies],
  );
  const toDispVal = (baseVal: number) =>
    convertFromBaseCurrency(baseVal, dispCur, cur, state.settings.exchangeRates);
  const fmtDisp = (baseVal: number) => formatCurrency(toDispVal(baseVal), dispCur, { isAr });
  useEffect(() => {
    if (state.settings.displayCurrency && !enabledCurrencies.includes(state.settings.displayCurrency)) {
      actions.updateSettings({ displayCurrency: cur });
    }
  }, [state.settings.displayCurrency, enabledCurrencies, cur, actions]);

  const todayKpis = useMemo(() => computeDashboardTodayKpis(state), [state]);
  const richMonth = useMemo(() => computeMonthlySummaryRich(state), [state]);
  const execStats = useMemo(() => computeDashboardExecutiveStats(state), [state]);

  const allKpis = [
    { label: t.totalSales, value: metrics.totalSales, icon: TrendingUp, target: 'invoices' as RouteId },
    { label: t.customerDebt, value: metrics.customerDebt, icon: Users, target: 'customers' as RouteId },
    { label: t.supplierDebt, value: metrics.supplierDebt, icon: Truck, target: 'suppliers' as RouteId },
    { label: t.stockValue, value: metrics.stockValue, icon: Package, target: 'inventory' as RouteId },
  ].filter((k) => hasPermission(k.target));

  const monthlySummary = useMemo(() => {
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const toMonthKey = (isoDate: string): string | null => {
      const d = new Date(isoDate);
      if (Number.isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    let monthRevenueH = 0;
    let monthSalesGrossH = 0;
    let monthInvoicesCount = 0;
    let prevMonthRevenueH = 0;

    for (const inv of state.invoices) {
      if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
      const key = toMonthKey(inv.date);
      const fx = inv.exchangeRate ?? 1;
      const sign = inv.invoiceType === 'return' ? -1 : 1;
      const revBaseH = mulFxHalalas(toHalalas(inv.subtotal), fx) * sign;
      const grossBaseH = mulFxHalalas(toHalalas(inv.total), fx) * sign;
      if (key === curMonthKey) {
        monthRevenueH += revBaseH;
        monthSalesGrossH += grossBaseH;
        monthInvoicesCount += 1;
      } else if (key === prevMonthKey) {
        prevMonthRevenueH += revBaseH;
      }
    }

    let monthExpensesH = 0;
    for (const exp of state.expenses) {
      if (exp.status === 'draft' || exp.status === 'cancelled') continue;
      if (toMonthKey(exp.date) === curMonthKey) {
        monthExpensesH += getExpenseBaseHalalas(exp);
      }
    }

    const unifiedMo = computeUnifiedNetProfit(state, curMonthKey);
    const monthRevenue = fromHalalas(monthRevenueH);
    const monthSalesGross = fromHalalas(monthSalesGrossH);
    const monthExpenses = fromHalalas(monthExpensesH);
    const monthNet = unifiedMo.netProfit;
    const prevMonthRevenue = fromHalalas(prevMonthRevenueH);
    const goal = Math.max(1, state.settings.monthlySalesGoal || 120000);
    const goalPct = Math.min(100, Math.round((monthSalesGross / goal) * 100));
    const momDeltaPct =
      prevMonthRevenue > 0 ? Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : null;

    const monthLabel = new Intl.DateTimeFormat(isAr ? 'ar-SA' : 'en-US', {
      month: 'long',
      year: 'numeric',
    }).format(now);

    return {
      monthLabel,
      monthRevenue,
      monthSalesGross,
      monthExpenses,
      monthNet,
      monthInvoicesCount,
      goal,
      goalPct,
      momDeltaPct,
    };
  }, [state, isAr]);

  const unifiedProfitAll = useMemo(() => computeUnifiedNetProfit(state), [state]);
  const grossProfitAll = fromHalalas(toHalalas(unifiedProfitAll.revenueExVat) - toHalalas(unifiedProfitAll.cogs));

  // Last 6 Months Sales vs Expenses Chart Data (Halala precision)
  const chart6Months = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; salesH: number; expH: number }[] = [];
    const fmt = new Intl.DateTimeFormat(isAr ? 'ar-SA' : 'en-US', { month: 'short' });
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: fmt.format(d), salesH: 0, expH: 0 });
    }
    const map = new Map(months.map((m) => [m.key, m]));
    for (const inv of state.invoices) {
      if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
      const bucket = map.get(inv.date.slice(0, 7));
      if (!bucket) continue;
      const sign = inv.invoiceType === 'return' ? -1 : 1;
      bucket.salesH += mulFxHalalas(toHalalas(inv.total), inv.exchangeRate ?? 1) * sign;
    }
    for (const exp of state.expenses) {
      if (exp.status === 'draft' || exp.status === 'cancelled') continue;
      const bucket = map.get(exp.date.slice(0, 7));
      if (!bucket) continue;
      bucket.expH += getExpenseBaseHalalas(exp);
    }
    const rows = months.map((m) => ({
      key: m.key,
      label: m.label,
      sales: Math.max(0, fromHalalas(m.salesH)),
      expenses: Math.max(0, fromHalalas(m.expH)),
    }));
    const maxVal = Math.max(1, ...rows.map((r) => Math.max(r.sales, r.expenses)));
    return { rows, maxVal };
  }, [state.invoices, state.expenses, isAr]);

  const performanceInsights = useMemo(() => {
    const rev = metrics.revenueExVat;
    const netMarginPct = rev > 0 ? Math.round((metrics.netProfit / rev) * 100) : 0;
    const collectionRatePct =
      metrics.totalSales > 0
        ? Math.max(0, Math.min(100, Math.round(((metrics.totalSales - metrics.customerDebt) / metrics.totalSales) * 100)))
        : 100;
    const expenseRatioPct = rev > 0 ? Math.round((metrics.totalExpenses / rev) * 100) : 0;

    const salesByCustomer = new Map<string, number>();
    const qtyByProduct = new Map<string, number>();
    for (const inv of state.invoices) {
      if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
      const baseAmt = inv.baseTotal ?? inv.total * (inv.exchangeRate ?? 1);
      salesByCustomer.set(inv.customerName, (salesByCustomer.get(inv.customerName) ?? 0) + baseAmt);
      for (const it of inv.items ?? []) {
        qtyByProduct.set(it.productName, (qtyByProduct.get(it.productName) ?? 0) + it.qty);
      }
    }

    let topCustomerName = '—';
    let topCustomerTotal = 0;
    salesByCustomer.forEach((total, name) => {
      if (total > topCustomerTotal) {
        topCustomerTotal = total;
        topCustomerName = name;
      }
    });

    let topProductName = '—';
    let topProductQty = 0;
    qtyByProduct.forEach((qty, name) => {
      if (qty > topProductQty) {
        topProductQty = qty;
        topProductName = name;
      }
    });

    const lowStockCount = execStats.lowStockProducts.length;

    return {
      netMarginPct,
      collectionRatePct,
      expenseRatioPct,
      topCustomerName,
      topCustomerTotal,
      topProductName,
      topProductQty,
      lowStockCount,
    };
  }, [
    metrics.revenueExVat,
    metrics.netProfit,
    metrics.totalSales,
    metrics.customerDebt,
    metrics.totalExpenses,
    state.invoices,
    execStats.lowStockProducts.length,
  ]);

  const tourSteps = [
    {
      title: isAr ? '1/5 مؤشر الصحة المالية' : '1/5 Financial Health Score',
      desc: isAr
        ? 'يراقب سيولتك النقدية وصافي الأرباح والديون المتأخرة لحظياً من 0 إلى 100.'
        : 'Monitors cashflow, net profit, and overdue receivables in real time (0–100).',
    },
    {
      title: isAr ? '2/5 الفواتير والضريبة ZATCA' : '2/5 ZATCA Invoices & QR',
      desc: isAr
        ? 'أنشئ فواتير بضريبة 15% تلقائياً مع رمز QR وطباعة PDF ومشاركة واتساب فورية.'
        : 'Create 15% VAT invoices with TLV QR codes, PDF printing, and WhatsApp sharing.',
    },
    {
      title: isAr ? '3/5 المرتجعات وعروض الأسعار' : '3/5 Returns & Quotations',
      desc: isAr
        ? 'أصدر عروض أسعار وحوّلها لفواتير بضغطة زر ذهبي، أو سجّل مرتجعات تحدث المخزون تلقائياً.'
        : 'Send quotations, convert to invoices in one click, and record stock-adjusting returns.',
    },
    {
      title: isAr ? '4/5 المخزون والباركود والصلاحيات' : '4/5 Barcodes & Role Permissions',
      desc: isAr
        ? 'ارفع صور الأصناف وولّد باركود EAN-13، وتحكم بصلاحيات المحاسب والمندوب والمستودع.'
        : 'Upload product photos, generate EAN-13 barcodes, and control team permissions.',
    },
    {
      title: isAr ? '5/5 النسخ الاحتياطي والمساعدة' : '5/5 Backup & Guided Help',
      desc: isAr
        ? 'نسخ احتياطي تلقائي يومياً + تصدير Excel متعدد الصفحات + مزامنة Firebase.'
        : 'Daily automatic backups, multi-sheet Excel export, and Firebase sync.',
    },
  ];

  return (
    <div className="space-y-5 relative">
      {/* Executive Hero Banner */}
      <div
        className={`bg-[#0A3D2C] text-white rounded-[20px] p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5 transition-all ${
          tourStep === 0 ? 'ring-4 ring-[#C9A227]' : ''
        }`}
      >
        <HealthScoreRing score={metrics.healthScore} label={t.healthScore} />
        <div className="flex-1 text-center sm:text-start space-y-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white/90">{state.settings.companyName}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={dispCur}
                onChange={(e) => actions.updateSettings({ displayCurrency: e.target.value as CurrencyCode })}
                aria-label={isAr ? 'عملة العرض' : 'Display Currency'}
                className="px-2.5 py-1.5 rounded-xl bg-white/15 border border-white/25 text-white text-xs font-bold cursor-pointer"
              >
                {enabledCurrencies.map((c) => (
                  <option key={c} value={c} className="text-slate-900">
                    {isAr ? `عرض: ${c}` : `View: ${c}`}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setTourStep(0)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C9A227] text-slate-950 font-extrabold text-xs cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{t.tour}</span>
              </button>
            </div>
          </div>
          <p className="text-2xl font-extrabold text-[#C9A227] tabular-nums">
            {t.netProfit}: {fmtDisp(metrics.netProfit)}
          </p>
          <p className="text-xs text-white/80 font-mono tabular-nums">
            {isAr ? 'مجمل الربح' : 'Gross Profit'}: {fmtDisp(grossProfitAll)} ·{' '}
            {isAr ? 'تكلفة البضاعة (COGS)' : 'COGS'}: {fmtDisp(unifiedProfitAll.cogs)}
          </p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
            {hasPermission('ai_analytics') && (
              <button
                onClick={() => onNavigate('ai_analytics')}
                className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/20 text-xs font-semibold cursor-pointer"
              >
                {t.ai_analytics}
              </button>
            )}
            {hasPermission('subscription') && (
              <button
                onClick={() => onNavigate('subscription')}
                className="px-3.5 py-1.5 rounded-xl bg-[#C9A227]/25 hover:bg-[#C9A227]/35 text-[#F4D573] text-xs font-semibold cursor-pointer"
              >
                {metrics.trialDaysRemaining} {t.days} · {t.subscription}
              </button>
            )}
          </div>
        </div>
      </div>

      {tourStep !== null && (
        <div className="bg-amber-50 dark:bg-[#192822] border-2 border-[#C9A227] rounded-[20px] p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-sm text-[#0A3D2C] dark:text-[#C9A227]">
              {tourSteps[tourStep].title}
            </span>
            <button onClick={() => setTourStep(null)} className="p-1 rounded-lg hover:bg-black/5 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200">{tourSteps[tourStep].desc}</p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-mono text-slate-500">
              {tourStep + 1} / {tourSteps.length}
            </span>
            <div className="flex gap-2">
              {tourStep > 0 && (
                <button
                  onClick={() => setTourStep(tourStep - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                >
                  {isAr ? 'السابق' : 'Back'}
                </button>
              )}
              <button
                onClick={() => {
                  if (tourStep < tourSteps.length - 1) setTourStep(tourStep + 1);
                  else {
                    setTourStep(null);
                    actions.notify(isAr ? 'اكتملت الجولة التعريفية!' : 'Guided tour completed!');
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
              >
                {tourStep < tourSteps.length - 1 ? t.next : t.startNow}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Period Strip: Today / Week / Month / Year + Today Profit + Total Purchases */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-[#121E19] border border-[#C9A227]/35 rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{t.todaySales}</span>
          <p className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-[#C9A227] mt-1">
            {fmtDisp(execStats.todaySales)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'مبيعات الأسبوع' : 'Week Sales'}</span>
          <p className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {fmtDisp(execStats.weekSales)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'مبيعات الشهر' : 'Month Sales'}</span>
          <p className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {fmtDisp(execStats.monthSales)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'مبيعات السنة' : 'Year Sales'}</span>
          <p className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {fmtDisp(execStats.yearSales)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{t.todayProfit}</span>
          <p className={`text-base sm:text-lg font-extrabold font-mono tabular-nums mt-1 ${todayKpis.todayProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
            {fmtDisp(todayKpis.todayProfit)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => hasPermission('purchase_orders') && onNavigate('purchase_orders')}
          className="text-start bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] hover:border-[#0A3D2C] dark:hover:border-[#C9A227] rounded-[20px] p-4 cursor-pointer transition-colors"
        >
          <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'إجمالي المشتريات' : 'Total Purchases'}</span>
          <p className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-amber-700 dark:text-[#C9A227] mt-1">
            {fmtDisp(execStats.totalPurchases)}
          </p>
        </button>
      </div>

      {/* Core Accounting Balances + Cash Box + Banks + Overdue */}
      <div className={`grid grid-cols-2 lg:grid-cols-6 gap-3.5 ${tourStep === 1 ? 'ring-2 ring-[#C9A227] rounded-[22px] p-1' : ''}`}>
        {allKpis.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.label}
              onClick={() => onNavigate(k.target)}
              className="text-start bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 hover:border-[#0A3D2C] dark:hover:border-[#C9A227] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
                <span className="truncate">{k.label}</span>
                <Icon className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227] shrink-0" />
              </div>
              <p className="text-base sm:text-lg font-extrabold tabular-nums font-mono">
                {fmtDisp(k.value)}
              </p>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => hasPermission('banks') && onNavigate('banks')}
          className="text-start bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 hover:border-[#0A3D2C] dark:hover:border-[#C9A227] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span className="truncate">{t.cashAndBanks}</span>
            <Landmark className="w-4 h-4 text-[#C9A227] shrink-0" />
          </div>
          <p className="text-base sm:text-lg font-extrabold tabular-nums font-mono text-[#0A3D2C] dark:text-[#C9A227]">
            {fmtDisp(metrics.totalCashAndBanks)}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">
            {t.cashBoxBalance}: {fmtDisp(todayKpis.cashBoxBalance)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => hasPermission('invoices') && onNavigate('invoices')}
          className="text-start bg-white dark:bg-[#121E19] border border-rose-200 dark:border-rose-900/40 rounded-[20px] p-4 hover:border-rose-500 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs mb-2">
            <span className="truncate font-bold">{t.overdueInvoices}</span>
            <Clock className="w-4 h-4 shrink-0" />
          </div>
          <p className="text-base sm:text-lg font-extrabold tabular-nums font-mono text-rose-600 dark:text-rose-400">
            {execStats.overdueInvoicesCount}{' '}
            <span className="text-xs font-semibold">({fmtDisp(execStats.overdueInvoicesTotal)})</span>
          </p>
        </button>
      </div>

      {/* Quick Actions + Stock & Expiry Alerts Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-3">
          <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            {t.quickActions}
          </h3>
          <div className="flex flex-wrap gap-2">
            {([
              { routeId: 'invoices' as RouteId, label: isAr ? 'فاتورة جديدة' : 'New Invoice', icon: FileText },
              { routeId: 'customers' as RouteId, label: isAr ? 'عميل جديد' : 'New Customer', icon: UserPlus },
              { routeId: 'vouchers' as RouteId, label: t.createReceipt, icon: Receipt },
              { routeId: 'expenses' as RouteId, label: isAr ? 'مصروف جديد' : 'New Expense', icon: Wallet },
              { routeId: 'purchase_orders' as RouteId, label: isAr ? 'أمر شراء' : 'Purchase Order', icon: Truck },
              { routeId: 'banks' as RouteId, label: t.banks, icon: Landmark },
              { routeId: 'reports' as RouteId, label: t.reports, icon: BarChart2 },
              { routeId: 'pos' as RouteId, label: t.pos, icon: ShoppingBag },
              { routeId: 'quotations' as RouteId, label: t.addQuotation, icon: Plus },
              { routeId: 'returns' as RouteId, label: t.addReturn, icon: RotateCcw },
            ])
              .filter((qa) => hasPermission(qa.routeId))
              .map((qa) => {
                const QIcon = qa.icon;
                return (
                  <button
                    key={qa.routeId}
                    onClick={() => onNavigate(qa.routeId)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] hover:border-[#0A3D2C] dark:hover:border-[#C9A227] text-xs font-bold cursor-pointer transition-colors"
                  >
                    <QIcon className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                    <span>{qa.label}</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Low Stock & Expiry Alerts Card */}
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500">{isAr ? 'تنبيهات المخزون والصلاحية' : 'Inventory & Expiry'}</span>
            {hasPermission('inventory') && (
              <button onClick={() => onNavigate('inventory')} className="text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer">
                {t.inventory}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/40">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">{t.lowStock}</span>
              <span className="text-lg font-extrabold font-mono tabular-nums text-amber-700 dark:text-[#C9A227]">
                {execStats.lowStockProducts.length}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-900/40">
              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 block">{t.expiryAlerts}</span>
              <span className="text-lg font-extrabold font-mono tabular-nums text-rose-700 dark:text-rose-400">
                {execStats.expiringProducts.length}
              </span>
            </div>
          </div>
          {execStats.expiringProducts[0] ? (
            <p className="text-[11px] text-rose-600 truncate">
              {execStats.expiringProducts[0].name} ({execStats.expiringProducts[0].expiryDate})
            </p>
          ) : execStats.lowStockProducts[0] ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 truncate">
              {execStats.lowStockProducts[0].name} ({execStats.lowStockProducts[0].qty}/{execStats.lowStockProducts[0].minStock})
            </p>
          ) : (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{t.insightHealthy}</p>
          )}
        </div>
      </div>

      {/* Monthly Summary & Sales vs Expenses 6M Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold">{t.monthlySummaryTitle}</h3>
                <p className="text-xs text-slate-500">
                  {monthlySummary.monthLabel} · {monthlySummary.monthInvoicesCount} {t.thisMonthInvoices}
                </p>
              </div>
            </div>
            {hasPermission('reports') && (
              <button
                onClick={() => onNavigate('reports')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F332B] hover:border-[#0A3D2C] dark:hover:border-[#C9A227] text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer transition-colors"
              >
                {t.viewFullReports}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">{t.thisMonthRevenue}</span>
                {monthlySummary.momDeltaPct !== null && (
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      monthlySummary.momDeltaPct >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {monthlySummary.momDeltaPct >= 0 ? '+' : ''}
                    {monthlySummary.momDeltaPct}% {t.vsLastMonth}
                  </span>
                )}
              </div>
              <p className="mt-1 text-base sm:text-lg font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-emerald-400">
                {fmtDisp(monthlySummary.monthRevenue)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B]">
              <span className="text-xs font-bold text-slate-500 block">{t.thisMonthExpenses}</span>
              <p className="mt-1 text-base sm:text-lg font-extrabold font-mono tabular-nums text-amber-700 dark:text-[#C9A227]">
                {fmtDisp(monthlySummary.monthExpenses)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B]">
              <span className="text-xs font-bold text-slate-500 block">{t.thisMonthNet}</span>
              <p
                className={`mt-1 text-base sm:text-lg font-extrabold font-mono tabular-nums ${
                  monthlySummary.monthNet >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {monthlySummary.monthNet > 0 ? '+' : ''}
                {fmtDisp(monthlySummary.monthNet)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B] flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500">{isAr ? 'أفضل عميل هذا الشهر' : 'Best Customer This Month'}</span>
              <span className="font-extrabold text-[#0A3D2C] dark:text-[#C9A227]">
                {richMonth.bestCustomer ? `${richMonth.bestCustomer.name} (${fmtDisp(richMonth.bestCustomer.revenue)})` : '—'}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B] flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500">{isAr ? 'أكثر منتج طلباً هذا الشهر' : 'Top Product This Month'}</span>
              <span className="font-extrabold text-[#0A3D2C] dark:text-[#C9A227]">
                {richMonth.topProduct ? `${richMonth.topProduct.name} (${richMonth.topProduct.qty})` : '—'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300">{t.salesGoalProgress}</span>
              <span className="font-mono font-extrabold tabular-nums text-[#0A3D2C] dark:text-[#C9A227]">
                {fmtDisp(monthlySummary.monthSalesGross)} /{' '}
                {fmtDisp(monthlySummary.goal)} ({monthlySummary.goalPct}%)
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-[#0A120F] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0A3D2C] to-[#C9A227] transition-all duration-300"
                style={{ width: `${monthlySummary.goalPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* 6-Month Sales vs Expenses Chart */}
        <div className="lg:col-span-5 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold">{t.monthlyRevVsExp}</h3>
              <p className="text-xs text-slate-500">{t.last6Months}</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#0A3D2C] dark:bg-emerald-500 inline-block" />
                {t.revenueLabel}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#C9A227] inline-block" />
                {t.expensesLabel}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-2 items-end h-44 pt-4">
            {chart6Months.rows.map((m) => {
              const salesH = Math.max(4, Math.round((m.sales / chart6Months.maxVal) * 100));
              const expH = Math.max(4, Math.round((m.expenses / chart6Months.maxVal) * 100));
              return (
                <div key={m.key} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    <div
                      title={`${t.revenueLabel}: ${fmtDisp(m.sales)}`}
                      className="w-3 sm:w-4 rounded-t-md bg-[#0A3D2C] dark:bg-emerald-500 transition-all"
                      style={{ height: `${salesH}%` }}
                    />
                    <div
                      title={`${t.expensesLabel}: ${fmtDisp(m.expenses)}`}
                      className="w-3 sm:w-4 rounded-t-md bg-[#C9A227] transition-all"
                      style={{ height: `${expH}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 truncate max-w-full">{m.label}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-[#1F332B] font-mono tabular-nums">
            <span className="text-slate-500">{t.vat15}: {fmtDisp(metrics.vatOutput)}</span>
            <span className="text-[#0A3D2C] dark:text-[#C9A227] font-bold">{t.expenses}: {fmtDisp(metrics.totalExpenses)}</span>
          </div>
        </div>
      </div>

      {/* Performance Insights (رؤى الأداء) */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 flex items-center justify-center shrink-0">
              <BarChart2 className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold">{t.performanceInsights}</h3>
              <p className="text-xs text-slate-500">
                {performanceInsights.lowStockCount > 0
                  ? `${performanceInsights.lowStockCount} ${t.lowStockRiskLabel}`
                  : t.insightHealthy}
              </p>
            </div>
          </div>
          {hasPermission('ai_analytics') && (
            <button
              onClick={() => onNavigate('ai_analytics')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F332B] hover:border-[#0A3D2C] dark:hover:border-[#C9A227] text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer transition-colors"
            >
              {t.ai_analytics}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B] space-y-1">
            <span className="text-xs font-bold text-slate-500 block">{t.grossMarginLabel}</span>
            <p className={`text-lg font-extrabold font-mono tabular-nums ${performanceInsights.netMarginPct >= 15 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-[#C9A227]'}`}>
              {performanceInsights.netMarginPct}%
            </p>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              {performanceInsights.netMarginPct >= 15 ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertTriangle className="w-3 h-3 text-amber-600" />}
              <span>{performanceInsights.netMarginPct >= 15 ? t.insightHealthy : t.insightAttention}</span>
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B] space-y-1">
            <span className="text-xs font-bold text-slate-500 block">{t.collectionRateLabel}</span>
            <p className={`text-lg font-extrabold font-mono tabular-nums ${performanceInsights.collectionRatePct >= 70 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {performanceInsights.collectionRatePct}%
            </p>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              {performanceInsights.collectionRatePct >= 70 ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertTriangle className="w-3 h-3 text-red-600" />}
              <span>{performanceInsights.collectionRatePct >= 70 ? t.insightHealthy : t.insightAttention}</span>
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B] space-y-1">
            <span className="text-xs font-bold text-slate-500 block">{t.expenseRatioLabel}</span>
            <p className={`text-lg font-extrabold font-mono tabular-nums ${performanceInsights.expenseRatioPct <= 60 ? 'text-[#0A3D2C] dark:text-[#C9A227]' : 'text-red-600 dark:text-red-400'}`}>
              {performanceInsights.expenseRatioPct}%
            </p>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              {performanceInsights.expenseRatioPct <= 60 ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertTriangle className="w-3 h-3 text-red-600" />}
              <span>{performanceInsights.expenseRatioPct <= 60 ? t.insightHealthy : t.insightAttention}</span>
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B] space-y-1">
            <span className="text-xs font-bold text-slate-500 block">{t.topCustomerLabel}</span>
            <p className="text-sm font-extrabold truncate">{performanceInsights.topCustomerName}</p>
            <span className="text-[11px] font-mono tabular-nums text-[#0A3D2C] dark:text-[#C9A227] block">
              {performanceInsights.topCustomerTotal > 0 ? fmtDisp(performanceInsights.topCustomerTotal) : '—'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B] space-y-1">
            <span className="text-xs font-bold text-slate-500 block">{t.topProductLabel}</span>
            <p className="text-sm font-extrabold truncate">{performanceInsights.topProductName}</p>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 block">
              {performanceInsights.topProductQty > 0 ? `${performanceInsights.topProductQty} ${t.qty}` : `${performanceInsights.lowStockCount} ${t.lowStock}`}
            </span>
          </div>
        </div>
      </div>

      {metrics.smartAlerts.length > 0 && (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#C9A227]" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{t.smartAlerts}</h3>
            </div>
            {hasPermission('ai_analytics') && (
              <button onClick={() => onNavigate('ai_analytics')} className="text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer">
                {t.ai_analytics}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {metrics.smartAlerts.slice(0, 3).map((al) => (
              <div
                key={al.id}
                className="p-3 rounded-xl border border-slate-100 dark:border-[#1F332B] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{isAr ? al.titleAr : al.titleEn}</p>
                  <p className="text-[11px] text-slate-500 truncate">{isAr ? al.subtitleAr : al.subtitleEn}</p>
                </div>
                {hasPermission(al.actionRoute) && (
                  <button
                    onClick={() => onNavigate(al.actionRoute)}
                    className="px-2.5 py-1 rounded-lg bg-[#0A3D2C] text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    {t.takeAction}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 5 Customers & Top 5 Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {execStats.top5Customers.length > 0 && (
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">{t.top5Customers}</h3>
              {hasPermission('customers') && (
                <button
                  onClick={() => onNavigate('customers')}
                  className="text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] hover:underline cursor-pointer"
                >
                  {t.customers}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {execStats.top5Customers.map((tc, idx) => (
                <div
                  key={tc.customerId}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-[#0A3D2C] text-[#C9A227] font-mono text-xs font-extrabold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold truncate">{tc.customerName}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {tc.invoiceCount} {t.invoices}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-[#0A3D2C] dark:text-[#C9A227] tabular-nums shrink-0">
                    {fmtDisp(tc.totalSpent)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {todayKpis.top5Products.length > 0 && (
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">{t.top5Products}</h3>
              {hasPermission('inventory') && (
                <button
                  onClick={() => onNavigate('inventory')}
                  className="text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] hover:underline cursor-pointer"
                >
                  {t.inventory}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {todayKpis.top5Products.map((tp, idx) => (
                <div
                  key={tp.productId}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-[#C9A227]/20 text-[#0A3D2C] dark:text-[#C9A227] font-mono text-xs font-extrabold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold truncate">{tp.productName}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {tp.qtySold} {t.qty}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-[#0A3D2C] dark:text-emerald-400 tabular-nums shrink-0">
                    {fmtDisp(tp.revenue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {hasPermission('invoices') && (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold">{t.latest10Invoices}</h3>
            <button
              onClick={() => onNavigate('invoices')}
              className="text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] hover:underline cursor-pointer"
            >
              {t.all}
            </button>
          </div>
          {todayKpis.latest10Invoices.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">{t.noData}</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#1F332B]">
              {todayKpis.latest10Invoices.map((inv) => {
                const invCur = inv.currency ?? cur;
                const invBaseTotal = inv.baseTotal ?? inv.total * (inv.exchangeRate ?? 1);
                return (
                  <div
                    key={inv.id}
                    onClick={() => onNavigate('invoices')}
                    className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{inv.customerName}</p>
                      <p className="text-xs text-slate-500 font-mono">
                        {inv.id} · {t[inv.status]} · {inv.date.slice(0, 10)}
                      </p>
                    </div>
                    <div className="text-end shrink-0">
                      <span
                        className={`font-extrabold text-sm font-mono tabular-nums block ${
                          inv.status === 'paid'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : inv.status === 'overdue'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {formatCurrency(inv.total, invCur, { isAr })}
                      </span>
                      {invCur !== dispCur && (
                        <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                          ≈ {fmtDisp(invBaseTotal)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Executive Compliance & Privacy Footer */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <ShieldCheck className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227] shrink-0" />
          <span className="font-bold">
            {isAr
              ? 'حماية مالية متكاملة · حسابات بالهللة الصحيحة · متوافق مع ZATCA'
              : 'Integer Halala Precision · Encrypted Cloud Sync · ZATCA Compliant'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F332B] hover:border-[#0A3D2C] dark:hover:border-[#C9A227] font-bold text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer"
          >
            {isAr ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy Policy'}
          </button>
          {hasPermission('help') && (
            <button
              type="button"
              onClick={() => onNavigate('help')}
              className="px-3 py-1.5 rounded-xl bg-[#0A3D2C] text-white font-bold cursor-pointer"
            >
              {isAr ? 'مركز المساعدة والدليل' : 'Help & User Manual'}
            </button>
          )}
        </div>
      </div>

      <PrivacyPolicyModal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        isAr={isAr}
        companyName={state.settings.companyName}
      />

      <DashboardQuickActionsFab store={store} onPrintInvoice={onPrintInvoice} />
    </div>
  );
};
