import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Printer,
  RotateCcw,
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
import {
  computeAccountLedger,
  computeProfitAnalytics,
  computeStatementsFromJournals,
  getExpenseBaseHalalas,
} from '../domain/accounting';
import { fromHalalas, mulFxHalalas, toHalalas } from '../domain/halala';
import { CurrencyCode } from '../types/erp';
import {
  DEFAULT_ENABLED_CURRENCIES,
  convertFromBaseCurrency,
  formatCurrency,
  getCurrencyMeta,
} from '../utils/currencies';
import { downloadTextFile, exportMultiSheetExcel, exportTableReportToPdf } from '../utils/export';
import { ScreenProps } from './types';

type ReportTabId =
  | 'trial_balance'
  | 'income_statement'
  | 'balance_sheet'
  | 'general_ledger'
  | 'party_statement'
  | 'sales_report'
  | 'purchases_report'
  | 'inventory_report'
  | 'pnl_report'
  | 'vat_report'
  | 'expenses_report'
  | 'overdue_aging'
  | 'payroll_report';

type SalesGroupBy = 'customer' | 'product' | 'salesperson' | 'branch' | 'period';

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
            {formatCurrency(point.revenue, currency, { isAr })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#C9A227] inline-block" />
            {expensesLabel}
          </span>
          <span className="font-mono font-bold tabular-nums text-amber-700 dark:text-[#C9A227]">
            {formatCurrency(point.expenses, currency, { isAr })}
          </span>
        </div>
        <div className="pt-1 mt-1 border-t border-slate-100 dark:border-[#1F332B] flex items-center justify-between gap-4">
          <span className="font-bold text-slate-700 dark:text-slate-200">{netLabel}</span>
          <span
            className={`font-mono font-extrabold tabular-nums ${
              point.net >= 0 ? 'text-[#0A3D2C] dark:text-emerald-400' : 'text-red-600'
            }`}
          >
            {point.net > 0 ? '+' : ''}
            {formatCurrency(point.net, currency, { isAr })}
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

  const defaultDisplayCur = state.settings.displayCurrency ?? cur;
  const [reportTab, setReportTab] = useState<ReportTabId>('trial_balance');
  const [reportCurrency, setReportCurrency] = useState<CurrencyCode>(defaultDisplayCur);
  const [monthRange, setMonthRange] = useState<6 | 12>(6);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [printAllMode, setPrintAllMode] = useState(false);

  const enabledCurrencies = Array.from(
    new Set<CurrencyCode>([cur, ...(state.settings.enabledCurrencies ?? DEFAULT_ENABLED_CURRENCIES)]),
  );

  useEffect(() => {
    setReportCurrency(state.settings.displayCurrency ?? cur);
  }, [cur, state.settings.displayCurrency]);

  const toRptVal = (baseVal: number) =>
    convertFromBaseCurrency(baseVal, reportCurrency, cur, state.settings.exchangeRates);
  const fmtRpt = (baseVal: number, maxDecimals?: number) =>
    formatCurrency(toRptVal(baseVal), reportCurrency, { isAr, maxDecimals });

  // Global cross-report filters
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');

  // Sub-tab controls
  const [profitDimension, setProfitDimension] = useState<'invoice' | 'product' | 'customer' | 'branch'>('invoice');
  const [salesGroupBy, setSalesGroupBy] = useState<SalesGroupBy>('customer');
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>('1010');
  const [partyMode, setPartyMode] = useState<'customer' | 'supplier'>('customer');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(state.customers[0]?.id ?? '');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(state.suppliers[0]?.id ?? '');

  useEffect(() => {
    const onAfterPrint = () => setPrintAllMode(false);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  const inDateRange = (iso?: string): boolean => {
    const d = (iso ?? '').slice(0, 10);
    if (!d) return !dateFrom && !dateTo;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const hasFilters = Boolean(dateFrom || dateTo || branchFilter !== 'all' || customerFilter !== 'all');

  const branchNameById = (bid?: string) => {
    if (!bid) return isAr ? 'الفرع الرئيسي' : 'Main Branch';
    const b = state.branches.find((x) => x.id === bid);
    return b ? (isAr ? b.nameAr : b.nameEn) : bid;
  };

  // Filtered datasets
  const filteredInvoices = useMemo(() => {
    return state.invoices.filter((inv) => {
      if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') return false;
      if (!inDateRange(inv.date)) return false;
      if (branchFilter !== 'all' && (inv.branchId || state.branches[0]?.id) !== branchFilter) return false;
      if (customerFilter !== 'all' && inv.customerId !== customerFilter) return false;
      return true;
    });
  }, [state.invoices, state.branches, dateFrom, dateTo, branchFilter, customerFilter]);

  const filteredPurchases = useMemo(() => {
    return state.purchaseOrders.filter((po) => {
      if (po.status === 'cancelled' || po.status === 'draft') return false;
      if (!inDateRange(po.date)) return false;
      if (branchFilter !== 'all' && (po.branchId || state.branches[0]?.id) !== branchFilter) return false;
      return true;
    });
  }, [state.purchaseOrders, state.branches, dateFrom, dateTo, branchFilter]);

  const filteredExpenses = useMemo(() => {
    return state.expenses.filter((exp) => {
      if (exp.status === 'draft' || exp.status === 'cancelled') return false;
      if (!inDateRange(exp.date)) return false;
      if (branchFilter !== 'all' && (exp.branchId || state.branches[0]?.id) !== branchFilter) return false;
      return true;
    });
  }, [state.expenses, state.branches, dateFrom, dateTo, branchFilter]);

  const filteredVouchers = useMemo(() => {
    return state.vouchers.filter((v) => {
      if (v.status === 'cancelled' || v.status === 'draft') return false;
      if (!inDateRange(v.date)) return false;
      if (branchFilter !== 'all' && (v.branchId || state.branches[0]?.id) !== branchFilter) return false;
      return true;
    });
  }, [state.vouchers, state.branches, dateFrom, dateTo, branchFilter]);

  const jrnStatements = useMemo(() => computeStatementsFromJournals(state), [state]);

  // Core KPI metrics (using filtered scope when filters active, or full store metrics when unfiltered)
  const cash = metrics.totalCashAndBanks;
  const receivables = metrics.customerDebt;
  const currentStockTotal = metrics.stockValue;
  const totalAssets = cash + receivables + currentStockTotal;
  const payables = metrics.supplierDebt;

  const { scopedRevenue, scopedVat, scopedExpenses, scopedNetProfit } = useMemo(() => {
    if (!hasFilters) {
      return {
        scopedRevenue: metrics.revenueExVat,
        scopedVat: metrics.vatOutput,
        scopedExpenses: metrics.totalExpenses,
        scopedNetProfit: metrics.netProfit,
      };
    }
    let revH = 0;
    let vatH = 0;
    let salesCostH = 0;
    for (const inv of filteredInvoices) {
      const fx = inv.exchangeRate ?? 1;
      const sign = inv.invoiceType === 'return' ? -1 : 1;
      revH += mulFxHalalas(toHalalas(inv.subtotal), fx) * sign;
      vatH += mulFxHalalas(toHalalas(inv.vat), fx) * sign;
      const lineCostH = (inv.items ?? []).reduce((s, it) => {
        const unitCost = it.costPrice ?? state.products.find((p) => p.id === it.productId)?.cost ?? 0;
        return s + Math.round(toHalalas(unitCost) * it.qty);
      }, 0);
      salesCostH += lineCostH * sign;
    }
    let expH = 0;
    for (const exp of filteredExpenses) {
      const vatInH = exp.vatInput && exp.vatInput > 0 ? mulFxHalalas(toHalalas(exp.vatInput), exp.exchangeRate ?? 1) : 0;
      expH += Math.max(0, getExpenseBaseHalalas(exp) - vatInH);
    }
    return {
      scopedRevenue: fromHalalas(revH),
      scopedVat: fromHalalas(vatH),
      scopedExpenses: fromHalalas(expH),
      scopedNetProfit: fromHalalas(revH - salesCostH - expH),
    };
  }, [hasFilters, metrics, filteredInvoices, filteredExpenses, state.products]);

  const revenue = scopedRevenue;
  const vat = scopedVat;
  const expenses = scopedExpenses;
  const netProfit = scopedNetProfit;
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

    for (const inv of filteredInvoices) {
      const key = toMonthKey(inv.date);
      if (!key) continue;
      const sign = inv.invoiceType === 'return' ? -1 : 1;
      const val = fromHalalas(mulFxHalalas(toHalalas(inv.subtotal), inv.exchangeRate ?? 1) * sign);
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + val);
    }

    for (const exp of filteredExpenses) {
      const key = toMonthKey(exp.date);
      if (!key) continue;
      expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + fromHalalas(getExpenseBaseHalalas(exp)));
    }

    const formatter = new Intl.DateTimeFormat(isAr ? 'ar-SA' : 'en-US', {
      month: 'short',
      year: '2-digit',
    });

    const buckets: MonthlyChartPoint[] = [];
    for (let offset = monthRange - 1; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const rev = Number(toRptVal(revenueByMonth.get(monthKey) ?? 0).toFixed(getCurrencyMeta(reportCurrency).maxDecimals));
      const exp = Number(toRptVal(expensesByMonth.get(monthKey) ?? 0).toFixed(getCurrencyMeta(reportCurrency).maxDecimals));
      buckets.push({
        monthKey,
        monthLabel: formatter.format(d),
        revenue: rev,
        expenses: exp,
        net: Number((rev - exp).toFixed(getCurrencyMeta(reportCurrency).maxDecimals)),
      });
    }
    return buckets;
  }, [filteredInvoices, filteredExpenses, monthRange, isAr, reportCurrency, cur, state.settings.exchangeRates]);

  const activePoint =
    monthlySeries.find((p) => p.monthKey === selectedMonthKey) ?? monthlySeries[monthlySeries.length - 1];

  // 1. Trial Balance (100% derived from actual posted ledger entries — zero synthetic capital)
  const trialRows: string[][] = useMemo(() => {
    const zeroStr = fmtRpt(0);
    const ledgerLines = jrnStatements.trialBalance.lines.map((line) => [
      line.account,
      line.debit > 0 ? fmtRpt(line.debit) : zeroStr,
      line.credit > 0 ? fmtRpt(line.credit) : zeroStr,
    ]);
    const balancedLabel = jrnStatements.trialBalance.isBalanced
      ? isAr
        ? 'الإجمالي (متوازن ✓)'
        : 'Total (Balanced ✓)'
      : isAr
      ? 'الإجمالي (غير متوازن ⚠)'
      : 'Total (Unbalanced ⚠)';
    return [
      [t.account, `${t.debit} (${reportCurrency})`, `${t.credit} (${reportCurrency})`],
      ...(ledgerLines.length > 0
        ? ledgerLines
        : [[isAr ? 'لا توجد قيود مرحلة بعد' : 'No posted journal entries yet', zeroStr, zeroStr]]),
      [
        balancedLabel,
        fmtRpt(jrnStatements.trialBalance.totalDebit),
        fmtRpt(jrnStatements.trialBalance.totalCredit),
      ],
    ];
  }, [jrnStatements.trialBalance, reportCurrency, cur, state.settings.exchangeRates, isAr, t]);

  // 2. Income Statement (aligned with computeUnifiedNetProfit: Sales Excl. VAT - COGS - Operating Expenses)
  const incomeRows: string[][] = useMemo(() => {
    const salesCostH = filteredInvoices.reduce((sum, inv) => {
      const sign = inv.invoiceType === 'return' ? -1 : 1;
      const lineCostH = (inv.items ?? []).reduce((s, it) => {
        const unitCost = it.costPrice ?? state.products.find((p) => p.id === it.productId)?.cost ?? 0;
        return s + Math.round(toHalalas(unitCost) * it.qty);
      }, 0);
      return sum + lineCostH * sign;
    }, 0);
    const cogs = fromHalalas(salesCostH);
    const grossProfit = fromHalalas(toHalalas(revenue) - salesCostH);
    const operatingNet = fromHalalas(toHalalas(grossProfit) - toHalalas(expenses));
    return [
      [t.account, `${t.amount} (${reportCurrency})`],
      [isAr ? 'صافي المبيعات (بدون ضريبة)' : 'Net Sales Revenue (Excl. VAT)', fmtRpt(revenue)],
      [isAr ? 'تكلفة البضاعة المباعة (COGS)' : 'Cost of Goods Sold (COGS)', fmtRpt(-cogs)],
      [isAr ? 'مجمل الربح' : 'Gross Profit', fmtRpt(grossProfit)],
      [isAr ? 'المصروفات التشغيلية' : 'Operating Expenses', fmtRpt(-expenses)],
      [t.netProfit, fmtRpt(operatingNet)],
      [isAr ? 'هامش صافي الربح' : 'Net Profit Margin', `${revenue > 0 ? ((operatingNet / revenue) * 100).toFixed(1) : '0.0'}%`],
    ];
  }, [filteredInvoices, state.products, revenue, expenses, reportCurrency, cur, state.settings.exchangeRates, isAr, t]);

  // 3. Balance Sheet (100% derived from genuine Asset / Liability / Equity ledger accounts + Period Net Income)
  const balanceRows: string[][] = useMemo(() => {
    const classifyRow = (accLabel: string): 'assets' | 'liabilities' | 'equity' | 'other' => {
      const clean = accLabel.trim();
      const codeMatch = clean.match(/^(\d{4})/);
      const code = codeMatch?.[1];
      if (code) {
        const coa = state.chartOfAccounts.find((c) => c.code === code);
        if (coa) {
          return coa.category === 'assets' || coa.category === 'liabilities' || coa.category === 'equity'
            ? coa.category
            : 'other';
        }
        if (code.startsWith('1')) return 'assets';
        if (code.startsWith('2')) return 'liabilities';
        if (code.startsWith('3')) return 'equity';
        return 'other';
      }
      const low = clean.toLowerCase();
      if (low.includes('ذمم الموردين') || low.includes('ضريبة') || low.includes('payable') || low.includes('قروض')) {
        return 'liabilities';
      }
      if (low.includes('رأس المال') || low.includes('أرباح مبقاة') || low.includes('capital') || low.includes('equity')) {
        return 'equity';
      }
      if (low.includes('مبيعات') || low.includes('إيراد') || low.includes('مصروف') || low.includes('تكلفة') || low.includes('revenue') || low.includes('expense')) {
        return 'other';
      }
      return 'assets';
    };

    const assetLines: [string, string][] = [];
    const liabilityLines: [string, string][] = [];
    const equityLines: [string, string][] = [];

    for (const line of jrnStatements.trialBalance.lines) {
      const cat = classifyRow(line.account);
      if (cat === 'assets') {
        assetLines.push([line.account, fmtRpt(line.netBalance)]);
      } else if (cat === 'liabilities') {
        liabilityLines.push([line.account, fmtRpt(-line.netBalance)]);
      } else if (cat === 'equity') {
        equityLines.push([line.account, fmtRpt(-line.netBalance)]);
      }
    }

    const totalLiabAndEq = fromHalalas(
      toHalalas(jrnStatements.liabilitiesTotal) + toHalalas(jrnStatements.equityTotal) + toHalalas(jrnStatements.netIncome),
    );
    const verifiedSuffix = jrnStatements.balanceSheetBalanced
      ? isAr
        ? '(متوازن ✓)'
        : '(Balanced ✓)'
      : isAr
      ? '(فرق قيد المراجعة ⚠)'
      : '(Variance ⚠)';

    return [
      [t.account, `${t.amount} (${reportCurrency})`],
      ...(assetLines.length > 0 ? assetLines : [[isAr ? 'لا توجد حسابات أصول مرحلة' : 'No posted asset accounts', fmtRpt(0)]]),
      [isAr ? 'إجمالي الأصول' : 'Total Assets', fmtRpt(jrnStatements.assetsTotal)],
      ...(liabilityLines.length > 0 ? liabilityLines : [[isAr ? 'الالتزامات المسجلة' : 'Recorded Liabilities', fmtRpt(0)]]),
      [isAr ? 'إجمالي الالتزامات' : 'Total Liabilities', fmtRpt(jrnStatements.liabilitiesTotal)],
      ...equityLines,
      [isAr ? 'صافي دخل الفترة المرحلة' : 'Current Period Net Income', fmtRpt(jrnStatements.netIncome)],
      [isAr ? 'إجمالي حقوق الملكية والدخل' : 'Total Equity & Current Income', fmtRpt(jrnStatements.equityTotal + jrnStatements.netIncome)],
      [`${isAr ? 'إجمالي الالتزامات وحقوق الملكية' : 'Total Liabilities & Equity'} ${verifiedSuffix}`, fmtRpt(totalLiabAndEq)],
    ];
  }, [jrnStatements, state.chartOfAccounts, reportCurrency, cur, state.settings.exchangeRates, isAr, t]);

  // 4. General Ledger (respects date/branch filters)
  const scopedJournals = useMemo(() => {
    return state.journals.filter((j) => {
      if (!inDateRange(j.date)) return false;
      if (branchFilter !== 'all' && j.branchId && j.branchId !== branchFilter) return false;
      return true;
    });
  }, [state.journals, dateFrom, dateTo, branchFilter]);

  const glData = useMemo(() => computeAccountLedger(selectedAccountCode, scopedJournals), [selectedAccountCode, scopedJournals]);
  const ledgerRows: string[][] = useMemo(
    () => [
      [t.date, isAr ? 'المرجع' : 'Ref', t.reason, `${t.debit} (${reportCurrency})`, `${t.credit} (${reportCurrency})`, `${isAr ? 'الرصيد' : 'Balance'} (${reportCurrency})`],
      ...glData.rows.map((r) => [
        r.date.slice(0, 10),
        r.journalId,
        r.description,
        fmtRpt(r.debit),
        fmtRpt(r.credit),
        fmtRpt(r.runningBalance),
      ]),
    ],
    [glData.rows, reportCurrency, cur, state.settings.exchangeRates, isAr, t],
  );

  // 5. Customer / Supplier Statement
  const customerStmtRows: string[][] = useMemo(() => {
    const cust = state.customers.find((c) => c.id === selectedCustomerId) ?? state.customers[0];
    if (!cust) return [[t.date, t.reason, t.debit, t.credit]];
    const invs = filteredInvoices
      .filter((i) => i.customerId === cust.id || i.customerName === cust.name)
      .map((i) => {
        const baseTot = i.baseTotal ?? i.total * (i.exchangeRate ?? 1);
        const basePaid = (i.paidAmount ?? 0) * (i.exchangeRate ?? 1);
        const origBadge = i.currency && i.currency !== reportCurrency ? ` (${formatCurrency(i.total, i.currency, { isAr })})` : '';
        return [
          i.date.slice(0, 10),
          `${i.id} · ${i.description || t.invoices}${origBadge}`,
          fmtRpt(baseTot),
          fmtRpt(basePaid),
        ];
      });
    const vchs = filteredVouchers
      .filter((v) => v.type === 'receipt' && v.partyName === cust.name)
      .map((v) => [v.date.slice(0, 10), `${v.id} · ${v.reason}`, fmtRpt(0), fmtRpt(v.amount)]);
    return [
      [t.date, t.reason, `${isAr ? 'مدين (فاتورة)' : 'Debit'} (${reportCurrency})`, `${isAr ? 'دائن (تحصيل)' : 'Credit'} (${reportCurrency})`],
      ...invs,
      ...vchs,
      [isAr ? 'الرصيد الحالي المستحق' : 'Current Balance Due', cust.name, fmtRpt(cust.debt), '—'],
    ];
  }, [state.customers, filteredInvoices, filteredVouchers, selectedCustomerId, reportCurrency, cur, state.settings.exchangeRates, isAr, t]);

  const supplierStmtRows: string[][] = useMemo(() => {
    const sup = state.suppliers.find((s) => s.id === selectedSupplierId) ?? state.suppliers[0];
    if (!sup) return [[t.date, t.reason, t.credit, t.debit]];
    const pos = filteredPurchases
      .filter((p) => p.supplierId === sup.id || p.supplierName === sup.name)
      .map((p) => [p.date.slice(0, 10), `${p.id} · ${p.productName} ×${p.quantity}`, fmtRpt(p.total), fmtRpt(p.paidAmount ?? 0)]);
    const vchs = filteredVouchers
      .filter((v) => v.type === 'payment' && v.partyName === sup.name)
      .map((v) => [v.date.slice(0, 10), `${v.id} · ${v.reason}`, fmtRpt(0), fmtRpt(v.amount)]);
    return [
      [t.date, t.reason, `${isAr ? 'لهم (توريد)' : 'Credit'} (${reportCurrency})`, `${isAr ? 'مدفوع (صرف)' : 'Debit'} (${reportCurrency})`],
      ...pos,
      ...vchs,
      [isAr ? 'الرصيد المستحق للمورد' : 'Supplier Payable Due', sup.name, fmtRpt(sup.payable), '—'],
    ];
  }, [state.suppliers, filteredPurchases, filteredVouchers, selectedSupplierId, reportCurrency, cur, state.settings.exchangeRates, isAr, t]);

  // 6. Sales Report (by customer, product, salesperson, branch, period)
  const salesRows: string[][] = useMemo(() => {
    const map = new Map<string, { label: string; count: number; subH: number; vatH: number; totalH: number }>();
    for (const inv of filteredInvoices) {
      const fx = inv.exchangeRate ?? 1;
      const sign = inv.invoiceType === 'return' ? -1 : 1;

      if (salesGroupBy === 'product') {
        for (const it of inv.items ?? []) {
          const k = it.productId || it.productName;
          const prev = map.get(k) ?? { label: it.productName, count: 0, subH: 0, vatH: 0, totalH: 0 };
          const lineSubH = mulFxHalalas(toHalalas(it.total), fx) * sign;
          const lineVatH = mulFxHalalas(toHalalas(it.taxAmount ?? 0), fx) * sign;
          prev.count += it.qty * sign;
          prev.subH += lineSubH;
          prev.vatH += lineVatH;
          prev.totalH += lineSubH + lineVatH;
          map.set(k, prev);
        }
        continue;
      }

      const key =
        salesGroupBy === 'customer'
          ? inv.customerId || inv.customerName
          : salesGroupBy === 'salesperson'
          ? inv.salespersonName || (isAr ? 'مبيعات مباشرة' : 'Direct Sales')
          : salesGroupBy === 'branch'
          ? inv.branchId || state.branches[0]?.id || 'BR-MAIN'
          : inv.date.slice(0, 7);

      const label =
        salesGroupBy === 'customer'
          ? inv.customerName
          : salesGroupBy === 'salesperson'
          ? inv.salespersonName || (isAr ? 'مبيعات مباشرة' : 'Direct Sales')
          : salesGroupBy === 'branch'
          ? inv.branchName || branchNameById(inv.branchId)
          : inv.date.slice(0, 7);

      const prev = map.get(key) ?? { label, count: 0, subH: 0, vatH: 0, totalH: 0 };
      prev.count += 1;
      prev.subH += mulFxHalalas(toHalalas(inv.subtotal), fx) * sign;
      prev.vatH += mulFxHalalas(toHalalas(inv.vat), fx) * sign;
      prev.totalH += mulFxHalalas(toHalalas(inv.total), fx) * sign;
      map.set(key, prev);
    }

    const entries = Array.from(map.values()).sort((a, b) => b.totalH - a.totalH);
    const sumCount = entries.reduce((s, r) => s + r.count, 0);
    const sumSub = entries.reduce((s, r) => s + r.subH, 0);
    const sumVat = entries.reduce((s, r) => s + r.vatH, 0);
    const sumTot = entries.reduce((s, r) => s + r.totalH, 0);

    return [
      [
        salesGroupBy === 'customer'
          ? t.client
          : salesGroupBy === 'product'
          ? (isAr ? 'الصنف' : 'Product')
          : salesGroupBy === 'salesperson'
          ? (isAr ? 'المندوب' : 'Salesperson')
          : salesGroupBy === 'branch'
          ? (isAr ? 'الفرع' : 'Branch')
          : (isAr ? 'الفترة' : 'Period'),
        salesGroupBy === 'product' ? (isAr ? 'الكمية' : 'Qty') : (isAr ? 'عدد الفواتير' : 'Invoices'),
        `${t.subtotal} (${reportCurrency})`,
        `${t.vat15} (${reportCurrency})`,
        `${t.total} (${reportCurrency})`,
      ],
      ...entries.map((r) => [
        r.label,
        String(r.count),
        fmtRpt(fromHalalas(r.subH)),
        fmtRpt(fromHalalas(r.vatH)),
        fmtRpt(fromHalalas(r.totalH)),
      ]),
      [
        isAr ? 'الإجمالي' : 'Total',
        String(sumCount),
        fmtRpt(fromHalalas(sumSub)),
        fmtRpt(fromHalalas(sumVat)),
        fmtRpt(fromHalalas(sumTot)),
      ],
    ];
  }, [filteredInvoices, salesGroupBy, state.branches, reportCurrency, cur, state.settings.exchangeRates, isAr, t]);

  // 7. Purchases Report
  const purchasesRows: string[][] = useMemo(() => {
    let sumSubH = 0;
    let sumVatH = 0;
    let sumTotH = 0;
    let sumPaidH = 0;
    const body = filteredPurchases.map((po) => {
      const totH = toHalalas(po.total);
      const vatH = toHalalas(po.vat ?? 0);
      const subH = po.subtotal !== undefined ? toHalalas(po.subtotal) : Math.max(0, totH - vatH);
      const paidH = toHalalas(po.paidAmount ?? 0);
      sumSubH += subH;
      sumVatH += vatH;
      sumTotH += totH;
      sumPaidH += paidH;
      return [
        `${po.id} · ${po.date.slice(0, 10)}`,
        po.supplierName,
        `${po.productName} ×${po.quantity}`,
        fmtRpt(fromHalalas(vatH)),
        fmtRpt(fromHalalas(totH)),
        fmtRpt(fromHalalas(paidH)),
      ];
    });
    return [
      [
        isAr ? 'أمر الشراء / التاريخ' : 'PO / Date',
        isAr ? 'المورد' : 'Supplier',
        isAr ? 'الأصناف' : 'Items',
        `${t.vat15} (${reportCurrency})`,
        `${t.total} (${reportCurrency})`,
        `${isAr ? 'المدفوع' : 'Paid'} (${reportCurrency})`,
      ],
      ...body,
      [
        isAr ? 'إجمالي المشتريات' : 'Total Purchases',
        `${filteredPurchases.length} ${isAr ? 'طلب' : 'orders'}`,
        `${isAr ? 'قبل الضريبة' : 'Excl. VAT'}: ${fmtRpt(fromHalalas(sumSubH))}`,
        fmtRpt(fromHalalas(sumVatH)),
        fmtRpt(fromHalalas(sumTotH)),
        fmtRpt(fromHalalas(sumPaidH)),
      ],
    ];
  }, [filteredPurchases, reportCurrency, cur, state.settings.exchangeRates, isAr, t]);

  // 8. Inventory Report
  const inventoryRows: string[][] = useMemo(() => {
    const items = state.products.filter(
      (p) => branchFilter === 'all' || !p.branchId || p.branchId === branchFilter,
    );
    let totalQty = 0;
    let totalCostH = 0;
    let totalSaleH = 0;
    const body = items.map((p) => {
      const cH = Math.round(toHalalas(p.cost) * p.qty);
      const sH = Math.round(toHalalas(p.price) * p.qty);
      totalQty += p.qty;
      totalCostH += cH;
      totalSaleH += sH;
      const low = p.status !== 'service' && p.qty <= (p.minStock ?? 10);
      return [
        `${p.name} (${p.sku})`,
        p.category || '—',
        `${p.qty}${low ? ' ⚠' : ''}`,
        fmtRpt(p.cost),
        fmtRpt(p.price),
        fmtRpt(fromHalalas(cH)),
      ];
    });
    return [
      [
        isAr ? 'الصنف (SKU)' : 'Product (SKU)',
        isAr ? 'التصنيف' : 'Category',
        isAr ? 'الرصيد' : 'Stock Qty',
        `${isAr ? 'التكلفة' : 'Unit Cost'} (${reportCurrency})`,
        `${isAr ? 'سعر البيع' : 'Sale Price'} (${reportCurrency})`,
        `${isAr ? 'قيمة المخزون' : 'Stock Value'} (${reportCurrency})`,
      ],
      ...body,
      [
        isAr ? 'إجمالي المخزون' : 'Total Inventory',
        `${items.length} ${isAr ? 'صنف' : 'items'}`,
        String(totalQty),
        '—',
        `${isAr ? 'قيمة بيعية' : 'Retail'}: ${fmtRpt(fromHalalas(totalSaleH), 0)}`,
        fmtRpt(fromHalalas(totalCostH)),
      ],
    ];
  }, [state.products, branchFilter, reportCurrency, cur, state.settings.exchangeRates, isAr]);

  // 9. P&L Profitability Breakdown
  const profitAnalytics = useMemo(
    () =>
      computeProfitAnalytics({
        ...state,
        invoices: hasFilters ? filteredInvoices : state.invoices,
      }),
    [state, filteredInvoices, hasFilters],
  );

  const profitRows: string[][] = useMemo(() => {
    const src =
      profitDimension === 'invoice'
        ? profitAnalytics.byInvoice
        : profitDimension === 'product'
        ? profitAnalytics.byProduct
        : profitDimension === 'customer'
        ? profitAnalytics.byCustomer
        : profitAnalytics.byBranch;
    const header = [
      isAr ? 'البند' : 'Item',
      `${t.revenueLabel} (${reportCurrency})`,
      `${isAr ? 'التكلفة التقديرية' : 'Est. Cost'} (${reportCurrency})`,
      `${t.netProfit} (${reportCurrency})`,
      t.profitMargin,
    ];
    const sumRevH = src.reduce((s, r) => s + toHalalas(r.revenue), 0);
    const sumCostH = src.reduce((s, r) => s + toHalalas(r.estimatedCost), 0);
    const sumProfH = src.reduce((s, r) => s + toHalalas(r.profit), 0);
    const avgMargin = sumRevH > 0 ? Number(((sumProfH / sumRevH) * 100).toFixed(1)) : 0;
    return [
      header,
      ...src.map((r) => [
        r.label,
        fmtRpt(r.revenue),
        fmtRpt(r.estimatedCost),
        fmtRpt(r.profit),
        `${r.marginPercent}%`,
      ]),
      [
        isAr ? 'إجمالي هامش الأرباح (قبل المصروفات العمومية)' : 'Total Gross Profitability',
        fmtRpt(fromHalalas(sumRevH)),
        fmtRpt(fromHalalas(sumCostH)),
        fmtRpt(fromHalalas(sumProfH)),
        `${avgMargin}%`,
      ],
    ];
  }, [profitAnalytics, profitDimension, reportCurrency, cur, state.settings.exchangeRates, isAr, t]);

  // 10. VAT Report (includes Purchases Input VAT + Expenses Input VAT)
  const { inputVatPurchases, inputVatExpenses, inputVatTotal } = useMemo(() => {
    let poH = 0;
    for (const po of filteredPurchases) {
      poH += toHalalas(po.vat ?? 0);
    }
    let expVatH = 0;
    for (const exp of filteredExpenses) {
      if (exp.vatInput && exp.vatInput > 0) {
        expVatH += mulFxHalalas(toHalalas(exp.vatInput), exp.exchangeRate ?? 1);
      }
    }
    return {
      inputVatPurchases: fromHalalas(poH),
      inputVatExpenses: fromHalalas(expVatH),
      inputVatTotal: fromHalalas(poH + expVatH),
    };
  }, [filteredPurchases, filteredExpenses]);
  const netVatPayable = fromHalalas(toHalalas(vat) - toHalalas(inputVatTotal));

  const vatRows: string[][] = useMemo(
    () => [
      [t.account, `${t.amount} (${reportCurrency})`],
      [isAr ? 'إجمالي المبيعات الخاضعة للضريبة' : 'Taxable Sales Base (Excl. VAT)', fmtRpt(revenue)],
      [isAr ? 'ضريبة المخرجات (المبيعات)' : 'Output VAT (Sales)', fmtRpt(vat)],
      [isAr ? 'ضريبة المدخلات (المشتريات)' : 'Input VAT (Purchases)', fmtRpt(inputVatPurchases)],
      [isAr ? 'ضريبة المدخلات (المصروفات)' : 'Input VAT (Expenses)', fmtRpt(inputVatExpenses)],
      [isAr ? 'إجمالي ضريبة المدخلات القابلة للخصم' : 'Total Deductible Input VAT', fmtRpt(inputVatTotal)],
      [
        netVatPayable < 0
          ? (isAr ? 'رصيد ضريبي قابل للاسترداد' : 'Refundable VAT Credit')
          : (isAr ? 'صافي الضريبة المستحقة للدفع' : 'Net VAT Payable'),
        fmtRpt(Math.abs(netVatPayable)),
      ],
    ],
    [reportCurrency, cur, state.settings.exchangeRates, revenue, vat, inputVatPurchases, inputVatExpenses, inputVatTotal, netVatPayable, isAr, t],
  );

  // 11. Expenses Report
  const expensesRows: string[][] = useMemo(() => {
    let totalH = 0;
    const body = filteredExpenses.map((e) => {
      const baseH = getExpenseBaseHalalas(e);
      totalH += baseH;
      const expCur = e.currency ?? cur;
      const origNote = expCur !== reportCurrency ? ` (${formatCurrency(e.amount, expCur, { isAr })})` : '';
      return [
        `${e.expenseNumber || e.id} · ${e.date.slice(0, 10)}`,
        `${e.title}${origNote}`,
        e.category,
        e.beneficiary || '—',
        e.status || 'paid',
        fmtRpt(fromHalalas(baseH)),
      ];
    });
    return [
      [
        isAr ? 'المرجع / التاريخ' : 'Ref / Date',
        isAr ? 'البيان' : 'Title',
        isAr ? 'التصنيف' : 'Category',
        isAr ? 'المستفيد' : 'Beneficiary',
        isAr ? 'الحالة' : 'Status',
        `${t.amount} (${reportCurrency})`,
      ],
      ...body,
      [
        isAr ? 'إجمالي المصروفات' : 'Total Expenses',
        `${filteredExpenses.length} ${isAr ? 'سجل' : 'items'}`,
        '—',
        '—',
        '—',
        fmtRpt(fromHalalas(totalH)),
      ],
    ];
  }, [filteredExpenses, reportCurrency, cur, state.settings.exchangeRates, isAr, t]);

  // 12. Overdue Receivables Aging Report
  const overdueRows: string[][] = useMemo(() => {
    const todayMs = new Date(new Date().toISOString().slice(0, 10)).getTime();
    let totalDueH = 0;
    let b0_30 = 0;
    let b31_60 = 0;
    let b60Plus = 0;

    const overdueInvoices = filteredInvoices.filter((inv) => {
      if (inv.invoiceType === 'return' || inv.status === 'paid') return false;
      const rem = inv.remainingAmount ?? Math.max(0, (inv.baseTotal ?? inv.total) - (inv.paidAmount ?? 0));
      if (rem <= 0) return false;
      const refDate = (inv.dueDate || inv.date).slice(0, 10);
      return inv.status === 'overdue' || refDate < new Date().toISOString().slice(0, 10);
    });

    const body = overdueInvoices.map((inv) => {
      const refDate = (inv.dueDate || inv.date).slice(0, 10);
      const refMs = new Date(refDate).getTime();
      const daysLate = Math.max(1, Math.round((todayMs - refMs) / 86400000));
      const remH = toHalalas(inv.remainingAmount ?? Math.max(0, (inv.baseTotal ?? inv.total) - (inv.paidAmount ?? 0)));
      totalDueH += remH;
      if (daysLate <= 30) b0_30 += remH;
      else if (daysLate <= 60) b31_60 += remH;
      else b60Plus += remH;

      const bucket = daysLate <= 30 ? '0-30d' : daysLate <= 60 ? '31-60d' : '60+d';
      return [
        inv.id,
        inv.customerName,
        refDate,
        `${daysLate} ${isAr ? 'يوم' : 'days'}`,
        bucket,
        fmtRpt(fromHalalas(remH)),
      ];
    });

    return [
      [
        isAr ? 'الفاتورة' : 'Invoice',
        t.client,
        isAr ? 'الاستحقاق' : 'Due Date',
        isAr ? 'أيام التأخير' : 'Days Late',
        isAr ? 'الشريحة' : 'Aging Bucket',
        `${isAr ? 'المتبقي' : 'Balance Due'} (${reportCurrency})`,
      ],
      ...body,
      [
        isAr ? 'ملخص أعمار الديون' : 'Aging Summary',
        `0-30d: ${fmtRpt(fromHalalas(b0_30), 0)}`,
        `31-60d: ${fmtRpt(fromHalalas(b31_60), 0)}`,
        `60+d: ${fmtRpt(fromHalalas(b60Plus), 0)}`,
        `${overdueInvoices.length} ${isAr ? 'فواتير' : 'inv'}`,
        fmtRpt(fromHalalas(totalDueH)),
      ],
    ];
  }, [filteredInvoices, reportCurrency, cur, state.settings.exchangeRates, isAr, t]);

  // 13. Payroll Report
  const payrollRows: string[][] = useMemo(() => {
    const emps = state.employees.filter(
      (e) => branchFilter === 'all' || !e.branchId || e.branchId === branchFilter,
    );
    let sumBaseH = 0;
    let sumAllowH = 0;
    let sumDedH = 0;
    let sumNetH = 0;
    const body = emps.map((e) => {
      const baseH = toHalalas(e.salary);
      const allowH = toHalalas(e.allowances ?? 0);
      const dedH = toHalalas(e.deductions ?? 0);
      const netH = Math.max(0, baseH + allowH - dedH);
      sumBaseH += baseH;
      sumAllowH += allowH;
      sumDedH += dedH;
      sumNetH += netH;
      return [
        `${e.name} (${e.roleTitle})`,
        branchNameById(e.branchId),
        fmtRpt(fromHalalas(baseH)),
        fmtRpt(fromHalalas(allowH)),
        fmtRpt(fromHalalas(dedH)),
        fmtRpt(fromHalalas(netH)),
      ];
    });
    return [
      [
        isAr ? 'الموظف / المسمى' : 'Employee / Role',
        isAr ? 'الفرع' : 'Branch',
        `${isAr ? 'الأساسي' : 'Basic'} (${reportCurrency})`,
        `${isAr ? 'البدلات' : 'Allowances'} (${reportCurrency})`,
        `${isAr ? 'الخصومات' : 'Deductions'} (${reportCurrency})`,
        `${isAr ? 'صافي الراتب' : 'Net Salary'} (${reportCurrency})`,
      ],
      ...body,
      [
        isAr ? 'إجمالي مسير الرواتب' : 'Total Payroll',
        `${emps.length} ${isAr ? 'موظف' : 'staff'}`,
        fmtRpt(fromHalalas(sumBaseH)),
        fmtRpt(fromHalalas(sumAllowH)),
        fmtRpt(fromHalalas(sumDedH)),
        fmtRpt(fromHalalas(sumNetH)),
      ],
    ];
  }, [state.employees, branchFilter, reportCurrency, cur, state.settings.exchangeRates, isAr]);

  const tabMeta: { id: ReportTabId; label: string }[] = [
    { id: 'trial_balance', label: t.trialBalance },
    { id: 'income_statement', label: t.incomeStatement },
    { id: 'balance_sheet', label: t.balanceSheet },
    { id: 'general_ledger', label: t.generalLedger },
    {
      id: 'party_statement',
      label: isAr ? 'كشف حساب عميل / مورد' : 'Customer / Supplier Statement',
    },
    { id: 'sales_report', label: isAr ? 'تقرير المبيعات' : 'Sales Report' },
    { id: 'purchases_report', label: isAr ? 'تقرير المشتريات' : 'Purchases Report' },
    { id: 'inventory_report', label: isAr ? 'تقرير المخزون' : 'Inventory Report' },
    { id: 'pnl_report', label: isAr ? 'تقرير الأرباح والخسائر' : 'Profit & Loss' },
    { id: 'vat_report', label: t.vatPayableReport },
    { id: 'expenses_report', label: isAr ? 'تقرير المصروفات' : 'Expenses Report' },
    { id: 'overdue_aging', label: isAr ? 'تقرير الذمم المتأخرة' : 'Overdue Aging' },
    { id: 'payroll_report', label: isAr ? 'تقرير الرواتب' : 'Payroll Report' },
  ];

  const rowsByTab: Record<ReportTabId, string[][]> = {
    trial_balance: trialRows,
    income_statement: incomeRows,
    balance_sheet: balanceRows,
    general_ledger: ledgerRows,
    party_statement: partyMode === 'customer' ? customerStmtRows : supplierStmtRows,
    sales_report: salesRows,
    purchases_report: purchasesRows,
    inventory_report: inventoryRows,
    pnl_report: profitRows,
    vat_report: vatRows,
    expenses_report: expensesRows,
    overdue_aging: overdueRows,
    payroll_report: payrollRows,
  };

  const rows = rowsByTab[reportTab];
  const activeTabLabel = tabMeta.find((x) => x.id === reportTab)?.label ?? '';

  const revenueBarColor = isDark ? '#10B981' : '#0A3D2C';
  const expensesBarColor = '#C9A227';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const gridColor = isDark ? '#1F332B' : '#E2E8F0';

  return (
    <div className="space-y-5">
      <div className={`space-y-5 ${printAllMode ? 'no-print' : ''}`}>
        {jrnStatements.unbalancedJournals.length > 0 && (
          <div className="p-4 rounded-[20px] bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500 text-rose-800 dark:text-rose-200 space-y-1.5">
            <div className="flex items-center gap-2 font-extrabold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>
                {isAr
                  ? `تنبيه تدقيق محاسبي: يوجد ${jrnStatements.unbalancedJournals.length} قيد محاسبي غير متوازن!`
                  : `Accounting Audit Alert: ${jrnStatements.unbalancedJournals.length} unbalanced journal(s) detected!`}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              {jrnStatements.unbalancedJournals.map((u) => (
                <span key={u.journalId} className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 font-bold">
                  {isAr ? `قيد غير متوازن رقم ${u.journalId}` : `Unbalanced #${u.journalId}`} (Δ {fmtRpt(u.diff)})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Visual Dashboard Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-500">{t.revenueLabel}</p>
              <p className="text-lg font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-emerald-400 mt-1">
                {fmtRpt(revenue)}
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
                {fmtRpt(expenses)}
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
                {fmtRpt(netProfit)}
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
                {fmtRpt(cash)}
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
                    {formatCurrency(activePoint.revenue, reportCurrency, { isAr })} · {t.expensesLabel}{' '}
                    {formatCurrency(activePoint.expenses, reportCurrency, { isAr })}
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
                      currency={reportCurrency}
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

        {/* Universal Report Filter Bar: Date From/To, Branch, Customer */}
        <div className="no-print bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0A3D2C] dark:text-[#C9A227] pb-2">
            <Filter className="w-4 h-4" />
            <span>{isAr ? 'فلترة التقارير:' : 'Report Filters:'}</span>
          </div>
          <div className="flex-1 min-w-[135px]">
            <label className="text-[11px] font-bold text-slate-500 block">{isAr ? 'من تاريخ' : 'From Date'}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
            />
          </div>
          <div className="flex-1 min-w-[135px]">
            <label className="text-[11px] font-bold text-slate-500 block">{isAr ? 'إلى تاريخ' : 'To Date'}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="text-[11px] font-bold text-slate-500 block">{isAr ? 'الفرع' : 'Branch'}</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="mt-1 w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
            >
              <option value="all">{t.all}</option>
              {state.branches.map((br) => (
                <option key={br.id} value={br.id}>
                  {isAr ? br.nameAr : br.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] font-bold text-slate-500 block">{t.client}</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="mt-1 w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
            >
              <option value="all">{t.all}</option>
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[11px] font-bold text-slate-500 block">{isAr ? 'عملة العرض' : 'Display Currency'}</label>
            <select
              value={reportCurrency}
              onChange={(e) => setReportCurrency(e.target.value as CurrencyCode)}
              className="mt-1 w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
            >
              {enabledCurrencies.map((code) => {
                const meta = getCurrencyMeta(code);
                return (
                  <option key={code} value={code}>
                    {code} ({meta.symbol})
                  </option>
                );
              })}
            </select>
          </div>
          {(hasFilters || reportCurrency !== cur) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setBranchFilter('all');
                setCustomerFilter('all');
                setReportCurrency(cur);
              }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isAr ? 'إعادة ضبط' : 'Reset'}</span>
            </button>
          )}
        </div>

        {/* All 13 Financial Reports Tabs */}
        <div className="space-y-3">
          <div className="no-print flex flex-wrap gap-1.5 p-1.5 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl">
            {tabMeta.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setReportTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  reportTab === tab.id
                    ? 'bg-[#0A3D2C] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2C24]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sub-filters per report tab */}
          {reportTab === 'general_ledger' && (
            <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl p-3">
              <span className="text-xs font-bold text-slate-500">{t.account}:</span>
              <select
                value={selectedAccountCode}
                onChange={(e) => setSelectedAccountCode(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
              >
                <option value="">{t.all}</option>
                {state.chartOfAccounts.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} - {isAr ? a.nameAr : a.nameEn}
                  </option>
                ))}
              </select>
              <span className="text-xs font-mono text-[#0A3D2C] dark:text-[#C9A227] ms-auto">
                {t.debit}: {fmtRpt(glData.totalDebit)} · {t.credit}: {fmtRpt(glData.totalCredit)}
              </span>
            </div>
          )}

          {reportTab === 'sales_report' && (
            <div className="flex flex-wrap gap-2 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl p-2.5">
              {(
                [
                  { id: 'customer', label: isAr ? 'حسب العميل' : 'By Customer' },
                  { id: 'product', label: isAr ? 'حسب الصنف' : 'By Product' },
                  { id: 'salesperson', label: isAr ? 'حسب المندوب' : 'By Salesperson' },
                  { id: 'branch', label: isAr ? 'حسب الفرع' : 'By Branch' },
                  { id: 'period', label: isAr ? 'حسب الفترة (الشهر)' : 'By Period (Month)' },
                ] as const
              ).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSalesGroupBy(g.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    salesGroupBy === g.id ? 'bg-[#C9A227] text-slate-950' : 'bg-slate-100 dark:bg-[#0A120F]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          {reportTab === 'pnl_report' && (
            <div className="flex flex-wrap gap-2 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl p-2.5">
              {(
                [
                  { id: 'invoice', label: t.profitByInvoice },
                  { id: 'product', label: t.profitByProduct },
                  { id: 'customer', label: t.profitByCustomer },
                  { id: 'branch', label: t.profitByBranch },
                ] as const
              ).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setProfitDimension(d.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    profitDimension === d.id ? 'bg-[#C9A227] text-slate-950' : 'bg-slate-100 dark:bg-[#0A120F]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {reportTab === 'party_statement' && (
            <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl p-3">
              <div className="flex p-1 rounded-lg bg-slate-100 dark:bg-[#0A120F]">
                <button
                  type="button"
                  onClick={() => setPartyMode('customer')}
                  className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                    partyMode === 'customer' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.customerStatement}
                </button>
                <button
                  type="button"
                  onClick={() => setPartyMode('supplier')}
                  className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                    partyMode === 'supplier' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.supplierStatement}
                </button>
              </div>
              {partyMode === 'customer' ? (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  {state.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({fmtRpt(c.debt)})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  {state.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({fmtRpt(s.payable)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Action Toolbar: Print PDF, Print All, Export CSV, Export Excel, WhatsApp */}
          <div className="no-print flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setPrintAllMode(false);
                actions.logAuditEvent('print', 'Report', reportTab, `طباعة/تصدير PDF: ${activeTabLabel}`, {
                  screenName: 'التقارير المالية',
                });
                setTimeout(() => window.print(), 40);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t.printPdf}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPrintAllMode(true);
                actions.logAuditEvent('print', 'Report', 'ALL', 'طباعة كافة القوائم المالية مع الشعار', {
                  screenName: 'التقارير المالية',
                });
                setTimeout(() => window.print(), 80);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C9A227] text-slate-950 text-xs font-extrabold cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t.printAllWithLogo}</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await exportTableReportToPdf({
                    filename: `ostora_${reportTab}_${new Date().toISOString().slice(0, 10)}.pdf`,
                    title: `${state.settings.companyName} — ${activeTabLabel}`,
                    subtitle: `${isAr ? 'العملة' : 'Currency'}: ${reportCurrency} · ${new Date().toISOString().slice(0, 10)}`,
                    isRtl: isAr,
                    headers: rows[0] ?? [],
                    rows: rows.slice(1),
                  });
                  actions.notify(isAr ? 'تم تصدير التقرير بصيغة PDF بنجاح' : 'Report exported to PDF');
                } catch {
                  actions.notify(isAr ? 'تعذر إنشاء ملف PDF' : 'Failed to export PDF');
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-600/30 text-rose-700 dark:text-rose-400 bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>{isAr ? 'تصدير PDF' : 'Export PDF'}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  `ostora_${reportTab}.csv`,
                  rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n'),
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{t.exportCsv}</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await exportMultiSheetExcel(`ostora_financial_reports_${new Date().toISOString().slice(0, 10)}.xlsx`, [
                    { name: 'Trial Balance', rows: trialRows },
                    { name: 'Income Statement', rows: incomeRows },
                    { name: 'Balance Sheet', rows: balanceRows },
                    { name: 'General Ledger', rows: ledgerRows },
                    { name: 'Sales Report', rows: salesRows },
                    { name: 'Purchases Report', rows: purchasesRows },
                    { name: 'Inventory Report', rows: inventoryRows },
                    { name: 'Profit Analysis', rows: profitRows },
                    { name: 'VAT Report', rows: vatRows },
                    { name: 'Expenses Report', rows: expensesRows },
                    { name: 'Overdue Aging', rows: overdueRows },
                    { name: 'Payroll Report', rows: payrollRows },
                  ]);
                  actions.notify(isAr ? 'تم تصدير جميع التقارير الـ 13 إلى Excel' : 'All financial reports exported to Excel');
                } catch {
                  actions.notify(isAr ? 'تعذر تصدير ملف Excel' : 'Failed to export Excel');
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-600/30 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{t.exportAllExcel}</span>
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `${state.settings.companyName}\n${activeTabLabel} (${reportCurrency})\n${t.revenueLabel}: ${fmtRpt(revenue)}\n${t.expensesLabel}: ${fmtRpt(expenses)}\n${t.netProfit}: ${fmtRpt(netProfit)}\n${t.vatPayableReport}: ${fmtRpt(netVatPayable)}`,
              )}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
            >
              <span>{t.whatsapp}</span>
            </a>
          </div>
        </div>

        {/* Print Header for single report */}
        <div className="hidden print:block border-b-2 border-[#0A3D2C] pb-3 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-extrabold text-[#0A3D2C]">{state.settings.companyName}</h1>
              <p className="text-sm font-bold text-slate-700">{activeTabLabel}</p>
            </div>
            <p className="text-xs font-mono text-slate-600">{new Date().toISOString().slice(0, 10)}</p>
          </div>
        </div>

        {/* Financial Statement Table */}
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] overflow-x-auto">
          <div className="min-w-[540px]">
            {rows.map((cols, idx) => {
              const firstCell = cols[0] ?? '';
              const isTotalRow =
                idx === rows.length - 1 ||
                (reportTab === 'balance_sheet' && (firstCell.startsWith('إجمالي') || firstCell.startsWith('Total')));
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
      </div>

      {/* Consolidated Print-Only Document for "Print All Reports" */}
      {printAllMode && (
        <div className="hidden print:block space-y-6 text-slate-900 bg-white">
          <div className="border-b-2 border-[#0A3D2C] pb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {state.settings.logoBase64 && (
                <img
                  src={state.settings.logoBase64}
                  alt="Company Logo"
                  className="w-14 h-14 rounded-xl object-cover border border-[#C9A227]"
                />
              )}
              <div className="space-y-1">
                <h1 className="text-xl font-extrabold text-[#0A3D2C]">{state.settings.companyName}</h1>
                <p className="text-sm font-bold text-slate-700">{t.allFinancialStatements}</p>
                <p className="text-xs text-slate-500">
                  {state.settings.address} · {state.settings.phone}
                </p>
              </div>
            </div>
            <div className="text-end text-xs font-mono space-y-0.5 text-slate-600">
              <p>
                {t.taxNumber}: {state.settings.taxNumber || '—'}
              </p>
              <p>
                {t.crNumber}: {state.settings.crNumber || '—'}
              </p>
              <p>
                {t.currency}: {reportCurrency}
              </p>
              <p>
                {t.date}: {new Date().toISOString().slice(0, 10)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 print-avoid-break">
            <div className="p-3 rounded-xl border border-slate-300">
              <p className="text-[11px] font-bold text-slate-500">{t.revenueLabel}</p>
              <p className="text-sm font-extrabold font-mono mt-0.5">
                {fmtRpt(revenue)}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-slate-300">
              <p className="text-[11px] font-bold text-slate-500">{t.expensesLabel}</p>
              <p className="text-sm font-extrabold font-mono mt-0.5">
                {fmtRpt(expenses)}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-slate-300">
              <p className="text-[11px] font-bold text-slate-500">
                {t.netProfit} ({profitMarginPct}%)
              </p>
              <p className="text-sm font-extrabold font-mono mt-0.5">
                {fmtRpt(netProfit)}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-slate-300">
              <p className="text-[11px] font-bold text-slate-500">{t.cashAndBanks}</p>
              <p className="text-sm font-extrabold font-mono mt-0.5">
                {fmtRpt(cash)}
              </p>
            </div>
          </div>

          {[
            { title: `1. ${t.trialBalance}`, data: trialRows, tabId: 'trial_balance' as const },
            { title: `2. ${t.incomeStatement}`, data: incomeRows, tabId: 'income_statement' as const },
            { title: `3. ${t.balanceSheet}`, data: balanceRows, tabId: 'balance_sheet' as const },
            { title: `4. ${t.vatPayableReport}`, data: vatRows, tabId: 'vat_report' as const },
            { title: `5. ${isAr ? 'تقرير المبيعات' : 'Sales Report'}`, data: salesRows, tabId: 'sales_report' as const },
            { title: `6. ${isAr ? 'تقرير المصروفات' : 'Expenses Report'}`, data: expensesRows, tabId: 'expenses_report' as const },
            { title: `7. ${isAr ? 'تقرير الذمم المتأخرة' : 'Overdue Aging'}`, data: overdueRows, tabId: 'overdue_aging' as const },
            { title: `8. ${isAr ? 'تقرير الرواتب' : 'Payroll Report'}`, data: payrollRows, tabId: 'payroll_report' as const },
          ].map((section) => (
            <div key={section.title} className="space-y-2 print-avoid-break">
              <h2 className="text-sm font-extrabold text-[#0A3D2C] border-b border-slate-300 pb-1">
                {section.title}
              </h2>
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                {section.data.map((cols, idx) => {
                  const firstCell = cols[0] ?? '';
                  const isTotalRow =
                    idx === section.data.length - 1 ||
                    (section.tabId === 'balance_sheet' && (firstCell.startsWith('إجمالي') || firstCell.startsWith('Total')));
                  return (
                    <div
                      key={idx}
                      className={`grid gap-2 px-4 py-2 text-xs border-b border-slate-200 last:border-b-0 ${
                        idx === 0
                          ? 'bg-slate-100 font-extrabold'
                          : isTotalRow
                          ? 'bg-slate-50 font-extrabold text-[#0A3D2C]'
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
          ))}

          <div className="pt-6 grid grid-cols-3 gap-6 text-center text-xs text-slate-600 print-avoid-break">
            <div className="border-t border-slate-300 pt-2 font-bold">
              {isAr ? 'المحاسب المالي' : 'Financial Accountant'}
            </div>
            <div className="border-t border-slate-300 pt-2 font-bold">
              {isAr ? 'المدير المالي' : 'Financial Manager'}
            </div>
            <div className="border-t border-slate-300 pt-2 font-bold">
              {isAr ? 'الختم الرسمي' : 'Official Stamp'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
