import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Landmark,
  Printer,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { strings } from '../data/translations';
import { downloadTextFile, exportMultiSheetExcel } from '../utils/export';
import { ScreenProps } from './types';

interface MonthlyChartPoint {
  monthKey: string;
  monthLabel: string;
  revenue: number;
  expenses: number;
  net: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: MonthlyChartPoint;
  }>;
  currency: string;
  isAr: boolean;
  revenueLabel: string;
  expensesLabel: string;
  netLabel: string;
}

const RevenueExpensesTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  currency,
  isAr,
  revenueLabel,
  expensesLabel,
  netLabel,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="rounded-2xl bg-white dark:bg-[#0D1613] border border-slate-200 dark:border-[#1F332B] shadow-xl p-3.5 text-xs space-y-2 min-w-[190px]"
    >
      <p className="font-extrabold text-slate-900 dark:text-white border-b border-slate-100 dark:border-[#1F332B] pb-1.5">
        {point.monthLabel}
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#0A3D2C] dark:bg-emerald-500 inline-block" />
            {revenueLabel}
          </span>
          <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {point.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#C9A227] inline-block" />
            {expensesLabel}
          </span>
          <span className="font-mono font-bold tabular-nums text-amber-700 dark:text-[#C9A227]">
            {point.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
          </span>
        </div>
        <div className="pt-1 mt-1 border-t border-slate-100 dark:border-[#1F332B] flex items-center justify-between gap-4">
          <span className="font-bold text-slate-700 dark:text-slate-200">{netLabel}</span>
          <span
            className={`font-mono font-extrabold tabular-nums ${
              point.net >= 0 ? 'text-[#0A3D2C] dark:text-emerald-400' : 'text-red-600'
            }`}
          >
            {point.net >= 0 ? '+' : ''}
            {point.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
          </span>
        </div>
      </div>
    </div>
  );
};

export const ReportsScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, metrics, actions } = store;
  const isAr = state.settings.isArabic;
  const isDark = state.settings.isDarkMode;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [reportTab, setReportTab] = useState<0 | 1 | 2>(0);
  const [monthRange, setMonthRange] = useState<6 | 12>(6);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const cash = metrics.totalCashAndBanks;
  const receivables = metrics.customerDebt;
  const currentStockTotal = metrics.stockValue;
  const totalAssets = cash + receivables + currentStockTotal;
  const payables = metrics.supplierDebt;
  const vat = metrics.vatOutput;
  const totalLiabilities = payables + vat;
  const revenue = metrics.revenueExVat;
  const expenses = metrics.totalExpenses;
  const netProfit = metrics.netProfit;
  const equity = totalAssets - totalLiabilities;
  const openingCapital = equity - netProfit;
  const profitMarginPct = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : '0.0';

  const monthlySeries = useMemo<MonthlyChartPoint[]>(() => {
    const now = new Date();
    const revenueByMonth = new Map<string, number>();
    const expensesByMonth = new Map<string, number>();

    const toMonthKey = (isoDate: string): string | null => {
      const parsed = new Date(isoDate);
      if (Number.isNaN(parsed.getTime())) return null;
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
    };

    for (const inv of state.invoices) {
      const key = toMonthKey(inv.date);
      if (!key) continue;
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + inv.subtotal);
    }

    for (const exp of state.expenses) {
      const key = toMonthKey(exp.date);
      if (!key) continue;
      expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + exp.amount);
    }

    const formatter = new Intl.DateTimeFormat(isAr ? 'ar-SA' : 'en-US', {
      month: 'short',
      year: '2-digit',
    });

    const buckets: MonthlyChartPoint[] = [];
    for (let offset = monthRange - 1; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const rev = Number((revenueByMonth.get(monthKey) ?? 0).toFixed(2));
      const exp = Number((expensesByMonth.get(monthKey) ?? 0).toFixed(2));
      buckets.push({
        monthKey,
        monthLabel: formatter.format(d),
        revenue: rev,
        expenses: exp,
        net: Number((rev - exp).toFixed(2)),
      });
    }
    return buckets;
  }, [state.invoices, state.expenses, monthRange, isAr]);

  const activePoint =
    monthlySeries.find((p) => p.monthKey === selectedMonthKey) ?? monthlySeries[monthlySeries.length - 1];

  const trialRows: string[][] = [
    [t.account, t.debit, t.credit],
    [isAr ? 'البنوك والصندوق' : 'Cash & Banks', cash.toFixed(2), '0.00'],
    [isAr ? 'ذمم العملاء' : 'Accounts Receivable', receivables.toFixed(2), '0.00'],
    [t.currentStock, currentStockTotal.toFixed(2), '0.00'],
    [isAr ? 'المصروفات' : 'Expenses', expenses.toFixed(2), '0.00'],
    [isAr ? 'ذمم الموردين' : 'Accounts Payable', '0.00', payables.toFixed(2)],
    [isAr ? 'ضريبة القيمة المضافة' : 'VAT Output', '0.00', vat.toFixed(2)],
    [isAr ? 'المبيعات' : 'Sales Revenue', '0.00', revenue.toFixed(2)],
    [
      isAr ? 'رأس المال والأرباح المبقاة' : 'Capital & Retained Equity',
      openingCapital < 0 ? Math.abs(openingCapital).toFixed(2) : '0.00',
      openingCapital >= 0 ? openingCapital.toFixed(2) : '0.00',
    ],
  ];
  const totalTrialDebit =
    cash + receivables + currentStockTotal + expenses + (openingCapital < 0 ? Math.abs(openingCapital) : 0);
  const totalTrialCredit = payables + vat + revenue + (openingCapital >= 0 ? openingCapital : 0);
  trialRows.push([
    isAr ? 'الإجمالي (متوازن ✓)' : 'Total (Balanced ✓)',
    totalTrialDebit.toFixed(2),
    totalTrialCredit.toFixed(2),
  ]);

  const incomeRows: string[][] = [
    [t.account, `${t.amount} (${cur})`],
    [isAr ? 'صافي المبيعات (بدون ضريبة)' : 'Net Sales Revenue (Excl. VAT)', revenue.toFixed(2)],
    [isAr ? 'المصروفات التشغيلية' : 'Operating Expenses', `-${expenses.toFixed(2)}`],
    [t.netProfit, netProfit.toFixed(2)],
    [isAr ? 'هامش صافي الربح' : 'Net Profit Margin', `${profitMarginPct}%`],
  ];

  const balanceRows: string[][] = [
    [t.account, `${t.amount} (${cur})`],
    [isAr ? 'النقد والبنوك (ملخص)' : 'Cash & Banks (Total)', cash.toFixed(2)],
    [isAr ? 'ذمم العملاء (ملخص)' : 'Accounts Receivable (Total)', receivables.toFixed(2)],
    [t.currentStock, currentStockTotal.toFixed(2)],
    [isAr ? 'إجمالي الأصول' : 'Total Assets', totalAssets.toFixed(2)],
    [isAr ? 'ذمم الموردين (ملخص)' : 'Accounts Payable (Total)', payables.toFixed(2)],
    [isAr ? 'الضريبة المستحقة' : 'VAT Liability', vat.toFixed(2)],
    [isAr ? 'إجمالي الالتزامات' : 'Total Liabilities', totalLiabilities.toFixed(2)],
    [isAr ? 'صافي حقوق الملكية' : 'Total Owner Equity', equity.toFixed(2)],
    [
      isAr ? 'إجمالي الالتزامات وحقوق الملكية (مطابق)' : 'Total Liabilities & Equity (Verified)',
      (totalLiabilities + equity).toFixed(2),
    ],
  ];

  const rows = reportTab === 0 ? trialRows : reportTab === 1 ? incomeRows : balanceRows;

  const revenueBarColor = isDark ? '#10B981' : '#0A3D2C';
  const expensesBarColor = '#C9A227';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const gridColor = isDark ? '#1F332B' : '#E2E8F0';

  return (
    <div className="space-y-5">
      {/* Visual Dashboard Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-500">{t.revenueLabel}</p>
            <p className="text-lg font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-emerald-400 mt-1">
              {revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#0A3D2C]/10 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-[#0A3D2C] dark:text-emerald-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-500">{t.expensesLabel}</p>
            <p className="text-lg font-extrabold font-mono tabular-nums text-amber-700 dark:text-[#C9A227] mt-1">
              {expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#C9A227]/15 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 text-[#C9A227]" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-500">
              {t.netProfit} ({profitMarginPct}%)
            </p>
            <p
              className={`text-lg font-extrabold font-mono tabular-nums mt-1 ${
                netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'
              }`}
            >
              {netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-500">{t.cashAndBanks}</p>
            <p className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              {cash.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1A2C24] flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
          </div>
        </div>
      </div>

      {/* Interactive Recharts Bar Chart: Monthly Revenue vs. Expenses */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0A3D2C] text-[#C9A227] flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold">{t.monthlyRevVsExp}</h2>
              {activePoint && (
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {activePoint.monthLabel}: {t.revenueLabel}{' '}
                  {activePoint.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} · {t.expensesLabel}{' '}
                  {activePoint.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} {cur}
                </p>
              )}
            </div>
          </div>

          <div className="no-print flex p-1 rounded-xl bg-slate-100 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B]">
            {[
              { value: 6 as const, label: t.last6Months },
              { value: 12 as const, label: t.last12Months },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMonthRange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  monthRange === opt.value
                    ? 'bg-[#0A3D2C] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[290px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlySeries}
              margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
              barGap={6}
              onClick={(chartState) => {
                const label = chartState?.activeLabel;
                if (typeof label === 'string') {
                  const matched = monthlySeries.find((m) => m.monthLabel === label);
                  if (matched) setSelectedMonthKey(matched.monthKey);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: axisColor, fontSize: 11, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                width={58}
                tickFormatter={(val: number) =>
                  val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : String(val)
                }
              />
              <Tooltip
                cursor={{ fill: isDark ? 'rgba(201, 162, 39, 0.08)' : 'rgba(10, 61, 44, 0.05)' }}
                content={
                  <RevenueExpensesTooltip
                    currency={cur}
                    isAr={isAr}
                    revenueLabel={t.revenueLabel}
                    expensesLabel={t.expensesLabel}
                    netLabel={t.netLabel}
                  />
                }
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', fontWeight: 700, paddingTop: '8px' }}
                iconType="circle"
              />
              <Bar
                dataKey="revenue"
                name={t.revenueLabel}
                fill={revenueBarColor}
                radius={[8, 8, 0, 0]}
                maxBarSize={38}
              />
              <Bar
                dataKey="expenses"
                name={t.expensesLabel}
                fill={expensesBarColor}
                radius={[8, 8, 0, 0]}
                maxBarSize={38}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Financial Statements Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex p-1 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl">
          {[t.trialBalance, t.incomeStatement, t.balanceSheet].map((label, idx) => (
            <button
              key={label}
              onClick={() => setReportTab(idx as 0 | 1 | 2)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                reportTab === idx ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t.printPdf}</span>
          </button>
          <button
            onClick={() => downloadTextFile(`ostora_report_${reportTab + 1}.csv`, rows.map((r) => r.join(',')).join('\n'))}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{t.exportCsv}</span>
          </button>
          <button
            onClick={() => {
              exportMultiSheetExcel('ostora_financial_statements.xls', [
                { name: 'Trial Balance', rows: trialRows },
                { name: 'Income Statement', rows: incomeRows },
                { name: 'Balance Sheet', rows: balanceRows },
              ]);
              actions.notify(isAr ? 'تم تصدير القوائم المالية الثلاث إلى Excel' : 'All 3 statements exported to Excel');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-600/30 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t.exportAllExcel}</span>
          </button>
        </div>
      </div>

      {/* Financial Statement Table */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] overflow-hidden">
        {rows.map((cols, idx) => {
          const isTotalRow = idx === rows.length - 1 || (reportTab === 2 && idx === 4);
          return (
            <div
              key={idx}
              className={`grid gap-2 px-5 py-3 text-xs sm:text-sm border-b border-slate-100 dark:border-[#1F332B] last:border-b-0 ${
                idx === 0
                  ? 'bg-[#0A3D2C]/5 dark:bg-[#C9A227]/10 font-extrabold'
                  : isTotalRow
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/20 font-extrabold text-[#0A3D2C] dark:text-[#C9A227]'
                  : ''
              }`}
              style={{ gridTemplateColumns: `2fr ${'1fr '.repeat(cols.length - 1)}` }}
            >
              {cols.map((c, ci) => (
                <span key={ci} className={ci === 0 ? 'text-start' : 'text-end font-mono tabular-nums font-bold'}>
                  {c}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
