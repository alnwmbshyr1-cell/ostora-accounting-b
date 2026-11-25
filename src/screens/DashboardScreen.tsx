import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Compass,
  FileText,
  Package,
  Plus,
  Receipt,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { strings } from '../data/translations';
import { RouteId } from '../types/erp';
import { HealthScoreRing } from '../components/QrMatrix';
import { ScreenProps } from './types';

export const DashboardScreen: React.FC<ScreenProps> = ({ store, onNavigate }) => {
  const { state, metrics, actions, hasPermission } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];
  const [tourStep, setTourStep] = useState<number | null>(null);

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

    let monthRevenue = 0;
    let monthSalesGross = 0;
    let monthInvoicesCount = 0;
    let prevMonthRevenue = 0;

    for (const inv of state.invoices) {
      const key = toMonthKey(inv.date);
      const fx = inv.exchangeRate ?? 1;
      const revBase = inv.subtotal * fx;
      const grossBase = inv.baseTotal ?? inv.total * fx;
      if (key === curMonthKey) {
        monthRevenue += revBase;
        monthSalesGross += grossBase;
        monthInvoicesCount += 1;
      } else if (key === prevMonthKey) {
        prevMonthRevenue += revBase;
      }
    }

    const monthExpenses = state.expenses.reduce((sum, exp) => {
      return toMonthKey(exp.date) === curMonthKey ? sum + exp.amount : sum;
    }, 0);

    const monthNet = monthRevenue - monthExpenses;
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
  }, [state.invoices, state.expenses, state.settings.monthlySalesGoal, isAr]);

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
        ? 'نسخ احتياطي تلقائي كل 5 دقائق + تصدير Excel متعدد الصفحات + مركز مساعدة تفاعلي.'
        : 'Auto-save every 5 minutes, multi-sheet Excel export, and step-by-step Help guides.',
    },
  ];

  return (
    <div className="space-y-5 relative">
      <div
        className={`bg-[#0A3D2C] text-white rounded-[20px] p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5 transition-all ${
          tourStep === 0 ? 'ring-4 ring-[#C9A227]' : ''
        }`}
      >
        <HealthScoreRing score={metrics.healthScore} label={t.healthScore} />
        <div className="flex-1 text-center sm:text-start space-y-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white/90">{state.settings.companyName}</h2>
            <button
              onClick={() => setTourStep(0)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C9A227] text-slate-950 font-extrabold text-xs cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{t.tour}</span>
            </button>
          </div>
          <p className="text-2xl font-extrabold text-[#C9A227] tabular-nums">
            {t.netProfit}: {metrics.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur}
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

      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3.5 ${tourStep === 1 ? 'ring-2 ring-[#C9A227] rounded-[22px] p-1' : ''}`}>
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
              <p className="text-lg sm:text-xl font-extrabold tabular-nums">
                {k.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                <span className="text-xs font-semibold text-slate-500">{cur}</span>
              </p>
            </button>
          );
        })}
      </div>

      {/* Monthly Summary Widget */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-4">
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
              {monthlySummary.monthRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-100 dark:border-[#1F332B]">
            <span className="text-xs font-bold text-slate-500 block">{t.thisMonthExpenses}</span>
            <p className="mt-1 text-base sm:text-lg font-extrabold font-mono tabular-nums text-amber-700 dark:text-[#C9A227]">
              {monthlySummary.monthExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur}
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
              {monthlySummary.monthNet >= 0 ? '+' : ''}
              {monthlySummary.monthNet.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-300">{t.salesGoalProgress}</span>
            <span className="font-mono font-extrabold tabular-nums text-[#0A3D2C] dark:text-[#C9A227]">
              {monthlySummary.monthSalesGross.toLocaleString(undefined, { maximumFractionDigits: 0 })} /{' '}
              {monthlySummary.goal.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur} ({monthlySummary.goalPct}%)
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-3">
          <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            {isAr ? 'إجراءات سريعة' : 'Quick Actions'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {([
              { routeId: 'invoices' as RouteId, label: t.addInvoice, icon: FileText },
              { routeId: 'quotations' as RouteId, label: t.addQuotation, icon: Plus },
              { routeId: 'vouchers' as RouteId, label: t.addVoucher, icon: Receipt },
              { routeId: 'returns' as RouteId, label: t.addReturn, icon: RotateCcw },
              { routeId: 'expenses' as RouteId, label: t.addExpense, icon: ShoppingBag },
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

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex flex-col justify-between gap-2">
          <span className="text-xs font-extrabold text-slate-500">{t.banks}</span>
          <p className="text-xl font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-[#C9A227]">
            {metrics.totalCashAndBanks.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur}
          </p>
          <p className="text-[11px] text-slate-500 font-mono tabular-nums">
            {t.vat15}: {metrics.vatOutput.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur} · {t.expenses}: {metrics.totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
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

      {hasPermission('invoices') && (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold">{t.recentInvoices}</h3>
            <button
              onClick={() => onNavigate('invoices')}
              className="text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] hover:underline cursor-pointer"
            >
              {t.all}
            </button>
          </div>
          {state.invoices.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">{t.noData}</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#1F332B]">
              {state.invoices.slice(0, 5).map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => onNavigate('invoices')}
                  className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{inv.customerName}</p>
                    <p className="text-xs text-slate-500 font-mono">
                      {inv.id} · {t[inv.status]}
                    </p>
                  </div>
                  <span
                    className={`font-extrabold text-sm font-mono tabular-nums shrink-0 ${
                      inv.status === 'paid'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : inv.status === 'overdue'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {inv.total.toFixed(2)} {inv.currency ?? cur}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
