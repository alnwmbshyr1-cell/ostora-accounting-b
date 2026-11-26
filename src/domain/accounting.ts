import {
  BankAccount,
  ChartAccount,
  Expense,
  FixedAsset,
  Invoice,
  JournalEntry,
  JournalLine,
  PersistedState,
} from '../types/erp';
import {
  calcRateHalalas,
  fromHalalas,
  mulFxHalalas,
  toHalalas,
} from './halala';

export function getExpenseBaseHalalas(exp: Expense): number {
  if (typeof exp.baseAmount === 'number' && Number.isFinite(exp.baseAmount)) {
    return toHalalas(exp.baseAmount);
  }
  const fx = typeof exp.exchangeRate === 'number' && Number.isFinite(exp.exchangeRate) && exp.exchangeRate > 0 ? exp.exchangeRate : 1;
  return mulFxHalalas(toHalalas(exp.amount), fx);
}

export function getExpenseBaseAmount(exp: Expense): number {
  return fromHalalas(getExpenseBaseHalalas(exp));
}

export const DEFAULT_CHART_OF_ACCOUNTS: ChartAccount[] = [
  // 1xxx Assets
  { id: 'COA-1000', code: '1000', nameAr: 'الأصول', nameEn: 'Assets', category: 'assets', isSystem: true },
  { id: 'COA-1010', code: '1010', nameAr: 'النقدية والبنوك', nameEn: 'Cash & Banks', category: 'assets', parentCode: '1000', isSystem: true },
  { id: 'COA-1020', code: '1020', nameAr: 'ذمم العملاء (المدينون)', nameEn: 'Accounts Receivable', category: 'assets', parentCode: '1000', isSystem: true },
  { id: 'COA-1030', code: '1030', nameAr: 'المخزون السلعي', nameEn: 'Merchandise Inventory', category: 'assets', parentCode: '1000', isSystem: true },
  { id: 'COA-1040', code: '1040', nameAr: 'ضريبة مدخلات المشتريات المستردة', nameEn: 'Input VAT Receivable', category: 'assets', parentCode: '1000', isSystem: true },
  { id: 'COA-1050', code: '1050', nameAr: 'الأصول الثابتة (بالتكلفة)', nameEn: 'Fixed Assets (Cost)', category: 'assets', parentCode: '1000', isSystem: true },
  { id: 'COA-1055', code: '1055', nameAr: 'مجمع إهلاك الأصول الثابتة', nameEn: 'Accumulated Depreciation', category: 'assets', parentCode: '1000', normalBalance: 'credit', isSystem: true },
  // 2xxx Liabilities
  { id: 'COA-2000', code: '2000', nameAr: 'الخصوم (الالتزامات)', nameEn: 'Liabilities', category: 'liabilities', isSystem: true },
  { id: 'COA-2010', code: '2010', nameAr: 'ذمم الموردين (الدائنون)', nameEn: 'Accounts Payable', category: 'liabilities', parentCode: '2000', isSystem: true },
  { id: 'COA-2020', code: '2020', nameAr: 'ضريبة القيمة المضافة المستحقة', nameEn: 'Output VAT Payable', category: 'liabilities', parentCode: '2000', isSystem: true },
  { id: 'COA-2030', code: '2030', nameAr: 'الرواتب والمستحقات', nameEn: 'Accrued Payroll', category: 'liabilities', parentCode: '2000', isSystem: true },
  { id: 'COA-2040', code: '2040', nameAr: 'القروض وأوراق الدفع المؤجلة', nameEn: 'Loans & Deferred Payables', category: 'liabilities', parentCode: '2000', isSystem: true },
  // 3xxx Equity
  { id: 'COA-3000', code: '3000', nameAr: 'حقوق الملكية', nameEn: 'Equity', category: 'equity', isSystem: true },
  { id: 'COA-3010', code: '3010', nameAr: 'رأس المال', nameEn: 'Owner Capital', category: 'equity', parentCode: '3000', isSystem: true },
  { id: 'COA-3020', code: '3020', nameAr: 'الأرباح المبقاة', nameEn: 'Retained Earnings', category: 'equity', parentCode: '3000', isSystem: true },
  // 4xxx Revenue
  { id: 'COA-4000', code: '4000', nameAr: 'الإيرادات', nameEn: 'Revenue', category: 'revenue', isSystem: true },
  { id: 'COA-4010', code: '4010', nameAr: 'إيرادات المبيعات', nameEn: 'Sales Revenue', category: 'revenue', parentCode: '4000', isSystem: true },
  { id: 'COA-4020', code: '4020', nameAr: 'مردودات ومسموحات المبيعات', nameEn: 'Sales Returns & Allowances', category: 'revenue', parentCode: '4000', isSystem: true },
  { id: 'COA-4030', code: '4030', nameAr: 'إيرادات شحن وخدمات إضافية', nameEn: 'Shipping & Extra Fees Revenue', category: 'revenue', parentCode: '4000', isSystem: true },
  { id: 'COA-4040', code: '4040', nameAr: 'إيرادات أخرى', nameEn: 'Other Income', category: 'revenue', parentCode: '4000', isSystem: true },
  // 5xxx Expenses
  { id: 'COA-5000', code: '5000', nameAr: 'المصروفات', nameEn: 'Expenses', category: 'expenses', isSystem: true },
  { id: 'COA-5010', code: '5010', nameAr: 'مصروفات تشغيلية وإدارية', nameEn: 'Operating & Admin Expenses', category: 'expenses', parentCode: '5000', isSystem: true },
  { id: 'COA-5020', code: '5020', nameAr: 'تكلفة المبيعات / المشتريات', nameEn: 'Cost of Goods Sold', category: 'expenses', parentCode: '5000', isSystem: true },
  { id: 'COA-5030', code: '5030', nameAr: 'الرواتب والأجور', nameEn: 'Salaries & Wages', category: 'expenses', parentCode: '5000', isSystem: true },
  { id: 'COA-5040', code: '5040', nameAr: 'فروقات جرد وتسوية نقدية', nameEn: 'Inventory & Cash Variance', category: 'expenses', parentCode: '5000', isSystem: true },
  { id: 'COA-5050', code: '5050', nameAr: 'مصروف الإهلاك', nameEn: 'Depreciation Expense', category: 'expenses', parentCode: '5000', isSystem: true },
  { id: 'COA-5060', code: '5060', nameAr: 'أرباح وخسائر فروق العملات', nameEn: 'Foreign Exchange Gain / Loss', category: 'expenses', parentCode: '5000', isSystem: true },
];

export function isDateFiscalLocked(dateIso: string | undefined, fiscalLockDate: string | undefined): boolean {
  if (!fiscalLockDate || !/^\d{4}-\d{2}-\d{2}$/.test(fiscalLockDate)) return false;
  const candidate = (dateIso || new Date().toISOString()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return false;
  return candidate <= fiscalLockDate;
}

export function computeInvoiceTotalsHalala(params: {
  subtotal: number;
  discountTotal?: number;
  shippingFee?: number;
  extraFee?: number;
  taxRate: number;
  fxRate: number;
  paidAmount?: number;
  status: Invoice['status'];
}) {
  const subtotalH = Math.max(0, toHalalas(params.subtotal));
  const discountH = Math.max(0, Math.min(subtotalH, toHalalas(params.discountTotal ?? 0)));
  const netBeforeExtrasH = subtotalH - discountH;
  const shippingH = Math.max(0, toHalalas(params.shippingFee ?? 0));
  const extraH = Math.max(0, toHalalas(params.extraFee ?? 0));
  const taxableBaseH = netBeforeExtrasH + shippingH + extraH;
  const vatH = calcRateHalalas(taxableBaseH, Math.max(0, Math.min(100, params.taxRate)));
  const totalH = taxableBaseH + vatH;
  const baseTotalH = mulFxHalalas(totalH, params.fxRate);

  let paidBaseH = 0;
  if (params.status === 'paid') {
    paidBaseH = baseTotalH;
  } else if (params.status === 'cancelled' || params.status === 'draft') {
    paidBaseH = 0;
  } else {
    const rawPaidH = Math.max(0, mulFxHalalas(toHalalas(params.paidAmount ?? 0), params.fxRate));
    paidBaseH = Math.min(baseTotalH, rawPaidH);
  }
  const remainingBaseH =
    params.status === 'cancelled' || params.status === 'draft'
      ? 0
      : Math.max(0, baseTotalH - paidBaseH);

  return {
    subtotal: fromHalalas(subtotalH),
    discountTotal: fromHalalas(discountH),
    shippingFee: fromHalalas(shippingH),
    extraFee: fromHalalas(extraH),
    vat: fromHalalas(vatH),
    total: fromHalalas(totalH),
    baseTotal: fromHalalas(baseTotalH),
    paidAmount: fromHalalas(paidBaseH),
    remainingAmount: fromHalalas(remainingBaseH),
    baseSubtotal: fromHalalas(mulFxHalalas(netBeforeExtrasH + shippingH + extraH, params.fxRate)),
    baseVat: fromHalalas(Math.max(0, baseTotalH - mulFxHalalas(netBeforeExtrasH + shippingH + extraH, params.fxRate))),
  };
}

export function buildDoubleEntryForInvoice(params: {
  customerName: string;
  bankLabel: string;
  baseTotal: number;
  baseSubtotal: number;
  baseVat: number;
  paidAmountBase: number;
  remainingAmountBase: number;
  status: Invoice['status'];
}): JournalLine[] {
  if (params.status === 'cancelled' || params.status === 'draft') return [];
  const totalH = toHalalas(params.baseTotal);
  const subH = toHalalas(params.baseSubtotal);
  const vatH = Math.max(0, totalH - subH);
  const paidH = Math.min(totalH, Math.max(0, toHalalas(params.paidAmountBase)));
  const remH = Math.max(0, totalH - paidH);

  const lines: JournalLine[] = [];
  if (paidH > 0) {
    lines.push({
      account: `1010 - ${params.bankLabel}`,
      debit: fromHalalas(paidH),
      credit: 0,
    });
  }
  if (remH > 0) {
    lines.push({
      account: `1020 - ذمم العملاء (${params.customerName})`,
      debit: fromHalalas(remH),
      credit: 0,
    });
  }
  if (subH > 0) {
    lines.push({
      account: '4010 - إيرادات المبيعات',
      debit: 0,
      credit: fromHalalas(subH),
    });
  }
  if (vatH > 0) {
    lines.push({
      account: '2020 - ضريبة القيمة المضافة',
      debit: 0,
      credit: fromHalalas(vatH),
    });
  }
  return lines;
}

export interface LedgerMovementRow {
  journalId: string;
  reference: string;
  date: string;
  description: string;
  account: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export function computeAccountLedger(
  accountCodeOrName: string,
  journals: JournalEntry[],
): {
  rows: LedgerMovementRow[];
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
} {
  const q = accountCodeOrName.trim().toLowerCase();
  const sorted = [...journals].sort((a, b) => a.date.localeCompare(b.date));
  let runningH = 0;
  let debitSumH = 0;
  let creditSumH = 0;
  const rows: LedgerMovementRow[] = [];

  for (const j of sorted) {
    for (const line of j.lines) {
      const accLower = line.account.toLowerCase();
      if (!q || accLower.includes(q)) {
        const dH = toHalalas(line.debit);
        const cH = toHalalas(line.credit);
        debitSumH += dH;
        creditSumH += cH;
        runningH += dH - cH;
        rows.push({
          journalId: j.id,
          reference: j.reference,
          date: j.date,
          description: j.description,
          account: line.account,
          debit: fromHalalas(dH),
          credit: fromHalalas(cH),
          runningBalance: fromHalalas(runningH),
        });
      }
    }
  }

  return {
    rows: rows.reverse(),
    totalDebit: fromHalalas(debitSumH),
    totalCredit: fromHalalas(creditSumH),
    netBalance: fromHalalas(runningH),
  };
}

export interface TrialBalanceLine {
  account: string;
  debit: number;
  credit: number;
  netBalance: number;
}

export function computeTrialBalanceFromJournals(journals: JournalEntry[]): {
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
} {
  const map = new Map<string, { debitH: number; creditH: number }>();
  for (const j of journals) {
    if (j.status === 'draft') continue;
    for (const l of j.lines) {
      const key = l.account.trim();
      const prev = map.get(key) ?? { debitH: 0, creditH: 0 };
      prev.debitH += toHalalas(l.debit);
      prev.creditH += toHalalas(l.credit);
      map.set(key, prev);
    }
  }

  let totalDebitH = 0;
  let totalCreditH = 0;
  const lines: TrialBalanceLine[] = [];

  for (const [account, v] of Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    totalDebitH += v.debitH;
    totalCreditH += v.creditH;
    lines.push({
      account,
      debit: fromHalalas(v.debitH),
      credit: fromHalalas(v.creditH),
      netBalance: fromHalalas(v.debitH - v.creditH),
    });
  }

  return {
    lines,
    totalDebit: fromHalalas(totalDebitH),
    totalCredit: fromHalalas(totalCreditH),
    isBalanced: totalDebitH === totalCreditH,
  };
}

export interface ProfitBreakdownRow {
  key: string;
  label: string;
  sublabel?: string;
  revenue: number;
  estimatedCost: number;
  profit: number;
  marginPercent: number;
  count: number;
}

export function computeProfitAnalytics(state: PersistedState): {
  byInvoice: ProfitBreakdownRow[];
  byProduct: ProfitBreakdownRow[];
  byCustomer: ProfitBreakdownRow[];
  byBranch: ProfitBreakdownRow[];
} {
  const productCostMap = new Map<string, number>();
  const productNameCostMap = new Map<string, number>();
  for (const p of state.products) {
    productCostMap.set(p.id, toHalalas(p.cost));
    productNameCostMap.set(p.name.trim(), toHalalas(p.cost));
  }

  const prodStats = new Map<string, { label: string; revH: number; costH: number; count: number }>();
  const custStats = new Map<string, { label: string; revH: number; costH: number; count: number }>();
  const branchStats = new Map<string, { label: string; revH: number; costH: number; count: number }>();
  const byInvoice: ProfitBreakdownRow[] = [];

  for (const inv of state.invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
    const fx = inv.exchangeRate ?? 1;
    const revH = mulFxHalalas(toHalalas(inv.subtotal), fx);
    let invCostH = 0;

    if (inv.items && inv.items.length > 0) {
      for (const it of inv.items) {
        const unitCostH =
          it.costPrice !== undefined
            ? toHalalas(it.costPrice)
            : (productCostMap.get(it.productId) ?? productNameCostMap.get(it.productName.trim()) ?? 0);
        const itemCostH = Math.round(unitCostH * it.qty);
        const itemRevH = mulFxHalalas(toHalalas(it.total), fx);
        invCostH += itemCostH;

        const pk = it.productId || it.productName;
        const pCur = prodStats.get(pk) ?? { label: it.productName, revH: 0, costH: 0, count: 0 };
        pCur.revH += itemRevH;
        pCur.costH += itemCostH;
        pCur.count += it.qty;
        prodStats.set(pk, pCur);
      }
    }

    const sign = inv.invoiceType === 'return' ? -1 : 1;
    const adjRevH = revH * sign;
    const adjCostH = invCostH * sign;
    const profitH = adjRevH - adjCostH;

    byInvoice.push({
      key: inv.id,
      label: `${inv.id} · ${inv.customerName}`,
      sublabel: inv.date.slice(0, 10),
      revenue: fromHalalas(adjRevH),
      estimatedCost: fromHalalas(adjCostH),
      profit: fromHalalas(profitH),
      marginPercent: adjRevH > 0 ? Number(((profitH / adjRevH) * 100).toFixed(1)) : 0,
      count: 1,
    });

    const ck = inv.customerId || inv.customerName;
    const cCur = custStats.get(ck) ?? { label: inv.customerName, revH: 0, costH: 0, count: 0 };
    cCur.revH += adjRevH;
    cCur.costH += adjCostH;
    cCur.count += 1;
    custStats.set(ck, cCur);

    const bk = inv.branchId || state.branches[0]?.id || 'BR-MAIN';
    const bName =
      inv.branchName ||
      state.branches.find((b) => b.id === bk)?.[state.settings.isArabic ? 'nameAr' : 'nameEn'] ||
      (state.settings.isArabic ? 'الفرع الرئيسي' : 'Main Branch');
    const bCur = branchStats.get(bk) ?? { label: bName, revH: 0, costH: 0, count: 0 };
    bCur.revH += adjRevH;
    bCur.costH += adjCostH;
    bCur.count += 1;
    branchStats.set(bk, bCur);
  }

  const mapToRows = (m: Map<string, { label: string; revH: number; costH: number; count: number }>): ProfitBreakdownRow[] =>
    Array.from(m.entries())
      .map(([key, v]) => {
        const profitH = v.revH - v.costH;
        return {
          key,
          label: v.label,
          revenue: fromHalalas(v.revH),
          estimatedCost: fromHalalas(v.costH),
          profit: fromHalalas(profitH),
          marginPercent: v.revH > 0 ? Number(((profitH / v.revH) * 100).toFixed(1)) : 0,
          count: v.count,
        };
      })
      .sort((a, b) => b.profit - a.profit);

  return {
    byInvoice,
    byProduct: mapToRows(prodStats),
    byCustomer: mapToRows(custStats),
    byBranch: mapToRows(branchStats),
  };
}

export function computeBankReconciliationDiff(
  bank: BankAccount,
  statementBalance: number,
): {
  systemBalance: number;
  statementBalance: number;
  variance: number;
  isMatched: boolean;
} {
  const sysH = toHalalas(bank.balance);
  const stmtH = toHalalas(statementBalance);
  const diffH = stmtH - sysH;
  return {
    systemBalance: fromHalalas(sysH),
    statementBalance: fromHalalas(stmtH),
    variance: fromHalalas(diffH),
    isMatched: diffH === 0,
  };
}

export interface UnifiedProfitSummary {
  revenueExVat: number;
  cogs: number;
  operatingExpenses: number;
  netProfit: number;
}

/**
 * Single authoritative net profit formula used across Store, Dashboard, Analytics, and Reports:
 * Net Profit = Revenue (Excl. VAT) - COGS - Operating Expenses
 */
export function computeUnifiedNetProfit(
  state: Pick<PersistedState, 'invoices' | 'products' | 'expenses'>,
  monthPrefix?: string,
): UnifiedProfitSummary {
  const costMap = new Map<string, number>();
  for (const p of state.products) {
    costMap.set(p.id, toHalalas(p.cost));
    costMap.set(p.name.trim(), toHalalas(p.cost));
  }

  let revExVatH = 0;
  let cogsH = 0;
  for (const inv of state.invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
    if (monthPrefix && inv.date.slice(0, monthPrefix.length) !== monthPrefix) continue;
    const fx = inv.exchangeRate ?? 1;
    const sign = inv.invoiceType === 'return' ? -1 : 1;
    revExVatH += mulFxHalalas(toHalalas(inv.subtotal), fx) * sign;

    if (inv.items && inv.items.length > 0) {
      for (const it of inv.items) {
        const unitCostH =
          it.costPrice !== undefined
            ? toHalalas(it.costPrice)
            : (costMap.get(it.productId) ?? costMap.get(it.productName.trim()) ?? 0);
        cogsH += Math.round(unitCostH * it.qty) * sign;
      }
    }
  }

  let expH = 0;
  for (const exp of state.expenses) {
    if (exp.status === 'draft' || exp.status === 'cancelled') continue;
    if (monthPrefix && exp.date.slice(0, monthPrefix.length) !== monthPrefix) continue;
    // Operating expense excludes Input VAT when vatInput is tracked separately
    const vatInH = exp.vatInput && exp.vatInput > 0 ? mulFxHalalas(toHalalas(exp.vatInput), exp.exchangeRate ?? 1) : 0;
    expH += Math.max(0, getExpenseBaseHalalas(exp) - vatInH);
  }

  return {
    revenueExVat: fromHalalas(revExVatH),
    cogs: fromHalalas(cogsH),
    operatingExpenses: fromHalalas(expH),
    netProfit: fromHalalas(revExVatH - cogsH - expH),
  };
}

export interface UnbalancedJournalIssue {
  journalId: string;
  reference: string;
  date: string;
  totalDebit: number;
  totalCredit: number;
  diff: number;
}

export interface JournalFinancialStatements {
  unbalancedJournals: UnbalancedJournalIssue[];
  trialBalance: {
    lines: TrialBalanceLine[];
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
  };
  assetsTotal: number;
  liabilitiesTotal: number;
  equityTotal: number;
  revenueTotal: number;
  cogsTotal: number;
  expensesTotal: number;
  netIncome: number;
  balanceSheetBalanced: boolean;
  vatReconciliation: {
    vatOutput: number;
    vatInputPurchases: number;
    vatInputExpenses: number;
    vatInputTotal: number;
    netVatPayable: number;
    isRefundableCredit: boolean;
  };
}

function classifyAccountCategory(accountLabel: string, chart: ChartAccount[]): ChartAccount['category'] {
  const clean = accountLabel.trim();
  const codeMatch = clean.match(/^(\d{4})/);
  const code = codeMatch?.[1];
  if (code) {
    const matched = chart.find((c) => c.code === code);
    if (matched) return matched.category;
    if (code.startsWith('1')) return 'assets';
    if (code.startsWith('2')) return 'liabilities';
    if (code.startsWith('3')) return 'equity';
    if (code.startsWith('4')) return 'revenue';
    if (code.startsWith('5')) return 'expenses';
  }
  const lower = clean.toLowerCase();
  if (lower.includes('مبيعات') || lower.includes('إيراد') || lower.includes('revenue') || lower.includes('income')) return 'revenue';
  if (lower.includes('ذمم الموردين') || lower.includes('ضريبة القيمة المضافة المستحقة') || lower.includes('قروض') || lower.includes('payable') || lower.includes('2020') || lower.includes('2010')) return 'liabilities';
  if (lower.includes('رأس المال') || lower.includes('أرباح مبقاة') || lower.includes('capital') || lower.includes('equity')) return 'equity';
  if (lower.includes('مصروف') || lower.includes('تكلفة') || lower.includes('رواتب') || lower.includes('إهلاك') || lower.includes('expense') || lower.includes('cogs')) return 'expenses';
  return 'assets';
}

export function computeStatementsFromJournals(state: PersistedState): JournalFinancialStatements {
  const unbalancedJournals: UnbalancedJournalIssue[] = [];
  for (const j of state.journals) {
    if (j.status === 'draft') continue;
    let dH = 0;
    let cH = 0;
    for (const l of j.lines) {
      dH += toHalalas(l.debit);
      cH += toHalalas(l.credit);
    }
    if (dH !== cH) {
      unbalancedJournals.push({
        journalId: j.id,
        reference: j.reference,
        date: j.date,
        totalDebit: fromHalalas(dH),
        totalCredit: fromHalalas(cH),
        diff: fromHalalas(dH - cH),
      });
    }
  }

  const trialBalance = computeTrialBalanceFromJournals(state.journals);
  let assetsH = 0;
  let liabilitiesH = 0;
  let equityH = 0;
  let revenueH = 0;
  let cogsH = 0;
  let expensesH = 0;

  for (const row of trialBalance.lines) {
    const cat = classifyAccountCategory(row.account, state.chartOfAccounts);
    const netH = toHalalas(row.netBalance); // debit - credit
    if (cat === 'assets') {
      assetsH += netH;
    } else if (cat === 'liabilities') {
      liabilitiesH += -netH;
    } else if (cat === 'equity') {
      equityH += -netH;
    } else if (cat === 'revenue') {
      revenueH += -netH;
    } else {
      const isCogs = row.account.startsWith('5020') || row.account.toLowerCase().includes('cost of goods') || row.account.includes('تكلفة');
      if (isCogs) cogsH += netH;
      else expensesH += netH;
    }
  }

  const netIncomeH = revenueH - cogsH - expensesH;
  const totalLiabAndEquityH = liabilitiesH + equityH + netIncomeH;

  // VAT Output vs Input reconciliation across Invoices, PurchaseOrders & Expenses
  let vatOutputH = 0;
  for (const inv of state.invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
    const fx = inv.exchangeRate ?? 1;
    const sign = inv.invoiceType === 'return' ? -1 : 1;
    vatOutputH += mulFxHalalas(toHalalas(inv.vat), fx) * sign;
  }

  let vatInputPurchasesH = 0;
  for (const po of state.purchaseOrders) {
    if (po.status === 'cancelled' || po.status === 'draft') continue;
    vatInputPurchasesH += toHalalas(po.vat ?? 0);
  }

  let vatInputExpensesH = 0;
  for (const exp of state.expenses) {
    if (exp.status === 'draft' || exp.status === 'cancelled') continue;
    if (exp.vatInput && exp.vatInput > 0) {
      vatInputExpensesH += mulFxHalalas(toHalalas(exp.vatInput), exp.exchangeRate ?? 1);
    }
  }

  const vatInputTotalH = vatInputPurchasesH + vatInputExpensesH;
  const netVatPayableH = vatOutputH - vatInputTotalH;

  return {
    unbalancedJournals,
    trialBalance,
    assetsTotal: fromHalalas(assetsH),
    liabilitiesTotal: fromHalalas(liabilitiesH),
    equityTotal: fromHalalas(equityH),
    revenueTotal: fromHalalas(revenueH),
    cogsTotal: fromHalalas(cogsH),
    expensesTotal: fromHalalas(expensesH),
    netIncome: fromHalalas(netIncomeH),
    balanceSheetBalanced: Math.abs(assetsH - totalLiabAndEquityH) <= 1,
    vatReconciliation: {
      vatOutput: fromHalalas(vatOutputH),
      vatInputPurchases: fromHalalas(vatInputPurchasesH),
      vatInputExpenses: fromHalalas(vatInputExpensesH),
      vatInputTotal: fromHalalas(vatInputTotalH),
      netVatPayable: fromHalalas(netVatPayableH),
      isRefundableCredit: netVatPayableH < 0,
    },
  };
}

/**
 * Generates an exact reversing journal entry for any posted journal (used for Void & Reverse).
 */
export function buildVoidReversalJournal(params: {
  reversalId: string;
  reference: string;
  description: string;
  date: string;
  originalLines: JournalLine[];
  branchId?: string;
  costCenter?: string;
}): JournalEntry {
  return {
    id: params.reversalId,
    reference: `REV-${params.reference}`,
    description: params.description,
    date: params.date,
    entryType: 'auto',
    status: 'approved',
    branchId: params.branchId,
    costCenter: params.costCenter,
    lines: params.originalLines.map((l) => ({
      account: l.account,
      debit: l.credit,
      credit: l.debit,
      description: l.description ? `عكس: ${l.description}` : 'قيد عكسي للإبطال',
    })),
  };
}

export function buildDepreciationJournal(params: {
  journalId: string;
  asset: FixedAsset;
  depreciationAmount: number;
  date: string;
}): JournalEntry {
  return {
    id: params.journalId,
    reference: params.asset.id,
    description: `قيد إهلاك شهري - ${params.asset.name} (${params.asset.id})`,
    date: params.date,
    entryType: 'auto',
    status: 'approved',
    branchId: params.asset.branchId,
    costCenter: params.asset.costCenter,
    lines: [
      { account: '5050 - مصروف الإهلاك', debit: params.depreciationAmount, credit: 0 },
      { account: `1055 - مجمع إهلاك الأصول الثابتة (${params.asset.name})`, debit: 0, credit: params.depreciationAmount },
    ],
  };
}

