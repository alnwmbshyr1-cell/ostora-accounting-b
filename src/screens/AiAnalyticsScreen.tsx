import React, { useMemo } from 'react';
import { AlertTriangle, Building2, Package, TrendingUp, Users } from 'lucide-react';
import { HealthScoreRing } from '../components/QrMatrix';
import { strings } from '../data/translations';
import { computeAdvancedInsights } from '../domain/analytics';
import { ScreenProps } from './types';

export const AiAnalyticsScreen: React.FC<ScreenProps> = ({ store, onNavigate }) => {
  const { state, metrics, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const adv = useMemo(() => computeAdvancedInsights(state), [state]);

  const now = new Date();
  const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthSales = state.invoices.reduce((sum, inv) => {
    const d = new Date(inv.date);
    if (Number.isNaN(d.getTime())) return sum;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return key === curMonthKey ? sum + (inv.baseTotal ?? inv.total * (inv.exchangeRate ?? 1)) : sum;
  }, 0);

  const baseSales = thisMonthSales > 0 ? thisMonthSales : metrics.totalSales;
  const goal = state.settings.monthlySalesGoal || 120000;
  const progress = Math.min(100, Math.round((thisMonthSales / Math.max(1, goal)) * 100));
  const cashRunwayMonths =
    metrics.totalExpenses > 0 ? (metrics.totalCashAndBanks / metrics.totalExpenses).toFixed(1) : '—';
  const collectionRatio =
    metrics.totalSales > 0
      ? Math.max(0, Math.round(((metrics.totalSales - metrics.customerDebt) / metrics.totalSales) * 100))
      : 100;
  const forecastBase = adv.nextMonthForecast > 0 ? adv.nextMonthForecast : (baseSales > 0 ? baseSales : 10000);
  const points = Array.from({ length: 6 }, (_, i) => ({
    label: `M${i + 1}`,
    value: Math.round(forecastBase * (1 + i * 0.065)),
  }));
  const maxVal = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className="space-y-5">
      <div className="bg-[#0A3D2C] text-white rounded-[20px] p-6 flex flex-col sm:flex-row items-center gap-6">
        <HealthScoreRing score={metrics.healthScore} label={t.healthScore} />
        <div className="flex-1 w-full space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
            <span>{t.salesGoal}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={100}
                step={5000}
                value={goal}
                onChange={(e) => {
                  const nextGoal = parseFloat(e.target.value);
                  if (Number.isFinite(nextGoal) && nextGoal >= 100) {
                    actions.updateSettings({ monthlySalesGoal: nextGoal });
                  }
                }}
                aria-label={t.salesGoal}
                className="w-28 px-2.5 py-1 rounded-lg bg-white/15 border border-white/20 text-white font-mono text-xs tabular-nums"
              />
              <span className="text-[#C9A227] font-mono tabular-nums">{progress}%</span>
            </div>
          </div>
          <div className="w-full h-3 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full bg-[#C9A227] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-white/80 font-mono tabular-nums">
            {thisMonthSales.toLocaleString()} / {goal.toLocaleString()} {cur}
          </p>
        </div>
      </div>

      {/* Next Month Forecast from Last 3 Months + Coverage + Collection */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#121E19] border border-[#C9A227]/40 rounded-[20px] p-4 space-y-1">
          <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>{isAr ? 'توقع مبيعات الشهر القادم (من آخر 3 أشهر)' : 'Next Month Forecast (3-Mo Weighted)'}</span>
          </p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-[#C9A227]">
            {adv.nextMonthForecast.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur}
          </p>
          <p className="text-[11px] font-mono text-slate-400">
            {adv.last3MonthsRevenue.map((m) => `${m.monthKey.slice(5)}: ${(m.total / 1000).toFixed(1)}k`).join(' · ')}
          </p>
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-1">
          <p className="text-xs font-bold text-slate-500">
            {isAr ? 'معدل كفاية السيولة للمصروفات' : 'Cash Expense Coverage'}
          </p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-[#C9A227]">
            {cashRunwayMonths} {isAr ? 'شهر' : 'mo'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-1">
          <p className="text-xs font-bold text-slate-500">
            {isAr ? 'نسبة التحصيل من المبيعات' : 'Sales Collection Ratio'}
          </p>
          <p className="text-2xl font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-[#C9A227]">
            {collectionRatio}%
          </p>
        </div>
      </div>

      {/* Predictive Risk Radar: Overdue Customers, Expiring Stock, Loss Branches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <Users className="w-4 h-4" />
              <span>{isAr ? 'تنبيه عملاء متوقع تأخرهم' : 'Overdue-Risk Customers'}</span>
            </h3>
            <button onClick={() => onNavigate('customers')} className="text-[11px] font-bold text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer">
              {t.customers}
            </button>
          </div>
          {adv.overdueRiskCustomers.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">{isAr ? 'لا توجد مخاطر تأخير عملاء حالياً' : 'No customer delay risks detected'}</p>
          ) : (
            <div className="space-y-2">
              {adv.overdueRiskCustomers.map((c) => (
                <div key={c.customerId} className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{c.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {isAr ? `فواتير متأخرة: ${c.overdueInvoicesCount}` : `Overdue: ${c.overdueInvoicesCount}`}
                      {c.creditLimit ? ` · ${c.utilizationPct}% ${t.creditLimit}` : ''}
                    </p>
                  </div>
                  <span className="font-mono font-extrabold text-rose-600 shrink-0">
                    {c.debt.toLocaleString()} {cur}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Package className="w-4 h-4" />
              <span>{isAr ? 'أصناف ستنتهي أو قريبة الانتهاء' : 'Low-Stock & Expiring Items'}</span>
            </h3>
            <button onClick={() => onNavigate('inventory')} className="text-[11px] font-bold text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer">
              {t.inventory}
            </button>
          </div>
          {adv.stockAndExpiryAlerts.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">{isAr ? 'المخزون والصلاحيات مستقرة' : 'Stock and expiry healthy'}</p>
          ) : (
            <div className="space-y-2">
              {adv.stockAndExpiryAlerts.slice(0, 4).map((p) => (
                <div key={p.productId} className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {p.reason === 'expired'
                        ? isAr ? `منتهي (${p.expiryDate})` : `Expired (${p.expiryDate})`
                        : p.reason === 'expiring_soon'
                        ? isAr ? `ينتهي قريباً (${p.expiryDate})` : `Expiring (${p.expiryDate})`
                        : isAr ? `رصيد منخفض (${p.qty})` : `Low qty (${p.qty})`}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-amber-700 dark:text-[#C9A227] shrink-0">{p.qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-[#0A3D2C] dark:text-[#C9A227]">
              <Building2 className="w-4 h-4" />
              <span>{isAr ? 'مراقبة ربحية الفروع (فروع خاسرة)' : 'Loss-Making Branches Alert'}</span>
            </h3>
            <button onClick={() => onNavigate('reports')} className="text-[11px] font-bold text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer">
              {t.reports}
            </button>
          </div>
          {adv.lossMakingBranches.length === 0 ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 py-3 font-bold">
              {isAr ? 'جميع الفروع تحقق أرباحاً أو متوازنة ✓' : 'All active branches are profitable ✓'}
            </p>
          ) : (
            <div className="space-y-2">
              {adv.lossMakingBranches.map((b) => (
                <div key={b.branchId} className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{b.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {t.revenueLabel}: {b.revenue.toLocaleString()} · {t.expensesLabel}: {b.expenses.toLocaleString()}
                    </p>
                  </div>
                  <span className="font-mono font-extrabold text-rose-600 shrink-0">
                    {b.netResult.toLocaleString()} {cur}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-4">
        <h3 className="text-base font-extrabold">{t.forecast6m}</h3>
        <div className="grid grid-cols-6 gap-3 items-end h-44 pt-4">
          {points.map((pt) => {
            const hPct = Math.max(18, Math.round((pt.value / maxVal) * 100));
            return (
              <div key={pt.label} className="flex flex-col items-center justify-end h-full gap-1.5">
                <span className="text-[10px] font-mono font-bold text-slate-500 tabular-nums">
                  {(pt.value / 1000).toFixed(1)}k
                </span>
                <div
                  className="w-full max-w-[44px] rounded-t-xl bg-[#0A3D2C] dark:bg-[#C9A227] transition-all"
                  style={{ height: `${hPct}%` }}
                />
                <span className="text-xs font-mono font-bold">{pt.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-extrabold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#C9A227]" />
          <span>{t.smartAlerts}</span>
        </h3>
        {metrics.smartAlerts.length === 0 ? (
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-6 text-center text-sm text-slate-500">
            {t.noData}
          </div>
        ) : (
          metrics.smartAlerts.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <h4 className="font-extrabold text-sm">{isAr ? a.titleAr : a.titleEn}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{isAr ? a.subtitleAr : a.subtitleEn}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => actions.dismissAlert(a.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                >
                  {t.dismiss}
                </button>
                <button
                  onClick={() => onNavigate(a.actionRoute)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
                >
                  {t.takeAction}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
