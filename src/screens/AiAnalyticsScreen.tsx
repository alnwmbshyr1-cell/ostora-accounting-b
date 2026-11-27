import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Brain,
  Building2,
  Lightbulb,
  Loader2,
  Package,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { HealthScoreRing } from '../components/QrMatrix';
import { strings } from '../data/translations';
import { computeAdvancedInsights, computeDetailedAiInsights } from '../domain/analytics';
import { formatCurrency, formatCurrencyNumber } from '../utils/currencies';
import { ScreenProps } from './types';

interface GeminiAnalyticsPayload {
  enabled: boolean;
  message?: string;
  summaryAr?: string;
  summaryEn?: string;
  forecast6m?: Array<{ month: string; expectedSales: number }>;
  actionItems?: string[];
}

export const AiAnalyticsScreen: React.FC<ScreenProps> = ({ store, onNavigate }) => {
  const { state, metrics, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<GeminiAnalyticsPayload | null>(null);
  const [aiError, setAiError] = useState('');

  const adv = useMemo(() => computeAdvancedInsights(state), [state]);
  const detailed = useMemo(() => computeDetailedAiInsights(state), [state]);

  const now = new Date();
  const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthSales = state.invoices.reduce((sum, inv) => {
    if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') return sum;
    const d = new Date(inv.date);
    if (Number.isNaN(d.getTime())) return sum;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const sign = inv.invoiceType === 'return' ? -1 : 1;
    return key === curMonthKey ? sum + (inv.baseTotal ?? inv.total * (inv.exchangeRate ?? 1)) * sign : sum;
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
  const forecastBase = adv.nextMonthForecast > 0 ? adv.nextMonthForecast : baseSales > 0 ? baseSales : 10000;
  const historicalGrowthRate = useMemo(() => {
    const revSeries = adv.last3MonthsRevenue.map((m) => m.total).filter((v) => v > 0);
    if (revSeries.length >= 2) {
      const first = revSeries[0];
      const last = revSeries[revSeries.length - 1];
      const rawRate = (last - first) / Math.max(1, first) / Math.max(1, revSeries.length - 1);
      return Math.max(-0.12, Math.min(0.18, rawRate));
    }
    return 0.02;
  }, [adv.last3MonthsRevenue]);

  const points =
    aiResult?.enabled && aiResult.forecast6m && aiResult.forecast6m.length > 0
      ? aiResult.forecast6m.slice(0, 6).map((f, idx) => ({
          label: f.month || `M${idx + 1}`,
          value: Math.max(0, Math.round(Number(f.expectedSales) || 0)),
        }))
      : Array.from({ length: 6 }, (_, i) => ({
          label: `M${i + 1}`,
          value: Math.max(0, Math.round(forecastBase * Math.pow(1 + historicalGrowthRate, i))),
        }));
  const maxVal = Math.max(...points.map((p) => p.value), 1);

  const curMoProfit = detailed.monthComparison.currentRev - detailed.monthComparison.currentExp;
  const prevMoProfit = detailed.monthComparison.prevRev - detailed.monthComparison.prevExp;

  const runGeminiAnalytics = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const resp = await fetch('/api/ai/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: cur,
          isArabic: isAr,
          last3MonthsRevenue: adv.last3MonthsRevenue,
          monthlyRevenue: detailed.monthComparison.currentRev,
          monthlyExpenses: detailed.monthComparison.currentExp,
          netProfit: curMoProfit,
          overdueCustomersCount: adv.overdueRiskCustomers.length,
          lowStockCount: adv.stockAndExpiryAlerts.length,
        }),
      });
      const json = (await resp.json()) as GeminiAnalyticsPayload;
      if (!resp.ok) {
        setAiError(json.message || (isAr ? 'تعذر الاتصال بخدمة التحليل الذكي' : 'AI analytics request failed'));
      } else {
        setAiResult(json);
      }
    } catch {
      setAiError(isAr ? 'تعذر الوصول إلى خادم التحليل الذكي' : 'Failed to reach AI server endpoint');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Executive Health Score + Monthly Goal */}
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
            {formatCurrencyNumber(thisMonthSales, cur)} / {formatCurrency(goal, cur, { isAr })}
          </p>
        </div>
      </div>

      {/* Real Server Gemini AI Analytics Panel */}
      <div className="bg-white dark:bg-[#121E19] border border-[#C9A227]/40 rounded-[20px] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0A3D2C] text-[#C9A227] flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold">
                {isAr ? 'تحليل AI حقيقي بالبيانات المالية (Gemini)' : 'Live AI Financial Analysis (Gemini)'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isAr
                  ? 'يقرأ اتجاه المبيعات الفعلي لآخر 3 أشهر والمخزون والذمم عبر الخادم الآمن'
                  : 'Analyzes real 3-month revenue, expenses, stock alerts & receivables via server'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={aiLoading}
            onClick={() => void runGeminiAnalytics()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A3D2C] hover:bg-[#0d4d37] text-white text-xs font-extrabold cursor-pointer disabled:opacity-60"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-[#C9A227]" />}
            <span>{isAr ? 'تحليل AI حقيقي' : 'Run Real AI Analysis'}</span>
          </button>
        </div>

        {aiError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300">
            {aiError}
          </div>
        )}

        {aiResult && !aiResult.enabled && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs font-bold text-amber-800 dark:text-amber-300">
            {aiResult.message || (isAr ? 'AI غير مفعل حالياً على الخادم (GEMINI_API_KEY غير مضبوط).' : 'AI is currently not enabled on the server.')}
          </div>
        )}

        {aiResult?.enabled && (
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-2.5 text-xs">
            <p className="font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
              {isAr ? aiResult.summaryAr : aiResult.summaryEn}
            </p>
            {aiResult.actionItems && aiResult.actionItems.length > 0 && (
              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                {aiResult.actionItems.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Month-over-Month Performance Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {isAr ? 'مقارنة المبيعات (هذا الشهر / السابق)' : 'Revenue MoM Comparison'}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-extrabold ${
                detailed.monthComparison.revChangePct >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {detailed.monthComparison.revChangePct >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {detailed.monthComparison.revChangePct >= 0 ? '+' : ''}
              {detailed.monthComparison.revChangePct}%
            </span>
          </div>
          <p className="text-xl font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-emerald-400">
            {formatCurrency(detailed.monthComparison.currentRev, cur, { isAr })}
          </p>
          <p className="text-[11px] text-slate-500 font-mono">
            {isAr ? 'الشهر السابق:' : 'Prev:'} {formatCurrency(detailed.monthComparison.prevRev, cur, { isAr })}
          </p>
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {isAr ? 'مقارنة المصروفات (هذا الشهر / السابق)' : 'Expenses MoM Comparison'}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-extrabold ${
                detailed.monthComparison.expChangePct <= 0 ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {detailed.monthComparison.expChangePct >= 0 ? '+' : ''}
              {detailed.monthComparison.expChangePct}%
            </span>
          </div>
          <p className="text-xl font-extrabold font-mono tabular-nums text-amber-700 dark:text-[#C9A227]">
            {formatCurrency(detailed.monthComparison.currentExp, cur, { isAr })}
          </p>
          <p className="text-[11px] text-slate-500 font-mono">
            {isAr ? 'الشهر السابق:' : 'Prev:'} {formatCurrency(detailed.monthComparison.prevExp, cur, { isAr })}
          </p>
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-1.5">
          <span className="text-xs font-bold text-slate-500 block">
            {isAr ? 'صافي التدفق الشهري (هذا الشهر / السابق)' : 'Net Monthly Flow (Current vs Prev)'}
          </span>
          <p
            className={`text-xl font-extrabold font-mono tabular-nums ${
              curMoProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'
            }`}
          >
            {formatCurrency(curMoProfit, cur, { isAr })}
          </p>
          <p className="text-[11px] text-slate-500 font-mono">
            {isAr ? 'الشهر السابق:' : 'Prev:'} {formatCurrency(prevMoProfit, cur, { isAr })}
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
            {formatCurrency(adv.nextMonthForecast, cur, { isAr, maxDecimals: 0 })}
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

      {/* Best Customers, Best Products (with Profit Margin), Slow-Moving Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-[#0A3D2C] dark:text-[#C9A227]">
              <Award className="w-4 h-4" />
              <span>{isAr ? 'أفضل العملاء إنفاقاً' : 'Top Customers'}</span>
            </h3>
            <button onClick={() => onNavigate('customers')} className="text-[11px] font-bold text-slate-500 cursor-pointer">
              {t.customers}
            </button>
          </div>
          {detailed.bestCustomers.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">{t.noData}</p>
          ) : (
            <div className="space-y-2">
              {detailed.bestCustomers.map((c, idx) => (
                <div key={c.customerId} className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold truncate">
                      {idx + 1}. {c.customerName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {c.invoiceCount} {isAr ? 'فاتورة' : 'invoices'}
                    </p>
                  </div>
                  <span className="font-mono font-extrabold text-[#0A3D2C] dark:text-emerald-400 shrink-0">
                    {formatCurrency(c.totalSpent, cur, { isAr })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span>{isAr ? 'الأصناف الأعلى مبيعاً وربحية' : 'Best Products & Margin'}</span>
            </h3>
            <button onClick={() => onNavigate('inventory')} className="text-[11px] font-bold text-slate-500 cursor-pointer">
              {t.inventory}
            </button>
          </div>
          {detailed.bestProducts.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">{t.noData}</p>
          ) : (
            <div className="space-y-2">
              {detailed.bestProducts.map((p) => (
                <div key={p.productId} className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {isAr ? `مباع: ${p.qtySold}` : `Sold: ${p.qtySold}`} ·{' '}
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                        {isAr ? `هامش ${p.marginPct}%` : `${p.marginPct}% margin`}
                      </span>
                    </p>
                  </div>
                  <span className="font-mono font-extrabold text-[#0A3D2C] dark:text-[#C9A227] shrink-0">
                    {formatCurrency(p.revenue, cur, { isAr })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <TrendingDown className="w-4 h-4" />
              <span>{isAr ? 'أصناف بطيئة الحركة / راكدة' : 'Slow-Moving Stock'}</span>
            </h3>
            <button onClick={() => onNavigate('inventory')} className="text-[11px] font-bold text-slate-500 cursor-pointer">
              {t.inventory}
            </button>
          </div>
          {detailed.slowMovingProducts.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">{t.noData}</p>
          ) : (
            <div className="space-y-2">
              {detailed.slowMovingProducts.map((p) => (
                <div key={p.productId} className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {isAr ? `رصيد راكد: ${p.currentStock}` : `On hand: ${p.currentStock}`} · {isAr ? `هامش ${p.marginPct}%` : `${p.marginPct}% margin`}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-amber-700 dark:text-[#C9A227] shrink-0">
                    {isAr ? `${p.qtySold} مبيعة` : `${p.qtySold} sold`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stockout Predictions + Actionable Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-3">
          <h3 className="text-sm font-extrabold flex items-center gap-2 text-[#0A3D2C] dark:text-[#C9A227]">
            <Timer className="w-4 h-4" />
            <span>{isAr ? 'توقع نفاد المخزون (أيام التغطية)' : 'Stockout Days Prediction'}</span>
          </h3>
          {detailed.stockoutPredictions.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              {isAr ? 'لا توجد أصناف مهددة بالنفاد خلال 45 يوماً' : 'No stockouts predicted within 45 days'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500 border-b border-slate-100 dark:border-[#1F332B]">
                  <tr>
                    <th className="py-2 text-start">{isAr ? 'الصنف' : 'Product'}</th>
                    <th className="py-2 text-end">{isAr ? 'الرصيد' : 'Stock'}</th>
                    <th className="py-2 text-end">{isAr ? 'المعدل/يوم' : 'Vel./day'}</th>
                    <th className="py-2 text-end">{isAr ? 'النفاد خلال' : 'Stockout In'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
                  {detailed.stockoutPredictions.map((p) => (
                    <tr key={p.productId}>
                      <td className="py-2 font-bold">{p.name}</td>
                      <td className="py-2 text-end font-mono">{p.currentStock}</td>
                      <td className="py-2 text-end font-mono">{p.dailyVelocity}</td>
                      <td className="py-2 text-end">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono font-bold ${
                            (p.daysUntilStockout ?? 99) <= 7
                              ? 'bg-rose-500/15 text-rose-600'
                              : 'bg-amber-500/15 text-amber-700 dark:text-[#C9A227]'
                          }`}
                        >
                          {p.daysUntilStockout} {isAr ? 'يوم' : 'd'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 space-y-3">
          <h3 className="text-sm font-extrabold flex items-center gap-2 text-[#0A3D2C] dark:text-[#C9A227]">
            <Lightbulb className="w-4 h-4 text-[#C9A227]" />
            <span>{isAr ? 'توصيات ذكية قابلة للتنفيذ' : 'Actionable AI Recommendations'}</span>
          </h3>
          {detailed.recommendations.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              {isAr ? 'الأداء التشغيلي متوازن حالياً ✓' : 'Operations look well-balanced ✓'}
            </p>
          ) : (
            <div className="space-y-2.5">
              {detailed.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold">{isAr ? rec.titleAr : rec.titleEn}</p>
                    <p className="text-[11px] text-slate-500">{isAr ? rec.detailAr : rec.detailEn}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate(rec.actionRoute)}
                    className="px-3 py-1.5 rounded-lg bg-[#C9A227] text-slate-950 text-xs font-extrabold shrink-0 cursor-pointer"
                  >
                    {t.takeAction}
                  </button>
                </div>
              ))}
            </div>
          )}
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
                    {formatCurrency(c.debt, cur, { isAr })}
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
                      {t.revenueLabel}: {formatCurrencyNumber(b.revenue, cur)} · {t.expensesLabel}: {formatCurrencyNumber(b.expenses, cur)}
                    </p>
                  </div>
                  <span className="font-mono font-extrabold text-rose-600 shrink-0">
                    {formatCurrency(b.netResult, cur, { isAr })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6-Month Projection Chart */}
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

      {/* Smart Alerts */}
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
