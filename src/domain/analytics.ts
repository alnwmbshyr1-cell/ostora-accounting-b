import { PersistedState } from '../types/erp';
import { computeProfitAnalytics, getExpenseBaseHalalas } from './accounting';
import { fromHalalas, mulFxHalalas, toHalalas } from './halala';

export interface TopProductStat {
  productId: string;
  productName: string;
  qtySold: number;
  revenue: number;
}

export interface DashboardTodayKpis {
  todaySales: number;
  todayProfit: number;
  cashBoxBalance: number;
  top5Products: TopProductStat[];
  latest10Invoices: PersistedState['invoices'];
}

export function computeDashboardTodayKpis(state: PersistedState): DashboardTodayKpis {
  const todayKey = new Date().toISOString().slice(0, 10);
  const costMap = new Map<string, number>();
  for (const p of state.products) {
    costMap.set(p.id, toHalalas(p.cost));
    costMap.set(p.name.trim(), toHalalas(p.cost));
  }

  let todaySalesH = 0;
  let todayRevExVatH = 0;
  let todayCogsH = 0;
  const prodTotals = new Map<string, { name: string; qty: number; revH: number }>();

  for (const inv of state.invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
    const fx = inv.exchangeRate ?? 1;
    const baseTotalH = mulFxHalalas(toHalalas(inv.total), fx);
    const baseSubH = mulFxHalalas(toHalalas(inv.subtotal), fx);
    const sign = inv.invoiceType === 'return' ? -1 : 1;

    if (inv.date.slice(0, 10) === todayKey) {
      todaySalesH += baseTotalH * sign;
      todayRevExVatH += baseSubH * sign;
      if (inv.items) {
        for (const it of inv.items) {
          const cH = it.costPrice !== undefined
            ? toHalalas(it.costPrice)
            : (costMap.get(it.productId) ?? costMap.get(it.productName.trim()) ?? 0);
          todayCogsH += Math.round(cH * it.qty) * sign;
        }
      }
    }

    if (inv.items && inv.invoiceType !== 'return') {
      for (const it of inv.items) {
        const key = it.productId || it.productName;
        const cur = prodTotals.get(key) ?? { name: it.productName, qty: 0, revH: 0 };
        cur.qty += it.qty;
        cur.revH += mulFxHalalas(toHalalas(it.total), fx);
        prodTotals.set(key, cur);
      }
    }
  }

  let todayExpH = 0;
  for (const exp of state.expenses) {
    if (exp.status === 'draft') continue;
    if (exp.date.slice(0, 10) === todayKey) {
      todayExpH += getExpenseBaseHalalas(exp);
    }
  }

  const cashAcc = state.banks.find(
    (b) => b.id === 'cash' || b.accountNumber.toUpperCase().includes('CASH'),
  );
  const cashBoxBalance = cashAcc ? cashAcc.balance : 0;

  const top5Products: TopProductStat[] = Array.from(prodTotals.entries())
    .map(([productId, v]) => ({
      productId,
      productName: v.name,
      qtySold: v.qty,
      revenue: fromHalalas(v.revH),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const latest10Invoices = [...state.invoices]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return {
    todaySales: fromHalalas(todaySalesH),
    todayProfit: fromHalalas(todayRevExVatH - todayCogsH - todayExpH),
    cashBoxBalance,
    top5Products,
    latest10Invoices,
  };
}

export interface MonthlySummaryRich {
  revenue: number;
  expenses: number;
  profit: number;
  invoiceCount: number;
  bestCustomer: { name: string; revenue: number } | null;
  topProduct: { name: string; qty: number; revenue: number } | null;
}

export function computeMonthlySummaryRich(state: PersistedState): MonthlySummaryRich {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let revH = 0;
  let expH = 0;
  let invoiceCount = 0;
  const custRev = new Map<string, number>();
  const prodStats = new Map<string, { qty: number; revH: number }>();

  for (const inv of state.invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
    if (inv.date.slice(0, 7) !== ym) continue;
    invoiceCount += 1;
    const fx = inv.exchangeRate ?? 1;
    const invBaseH = mulFxHalalas(toHalalas(inv.total), fx);
    revH += invBaseH;
    custRev.set(inv.customerName, (custRev.get(inv.customerName) ?? 0) + invBaseH);
    if (inv.items) {
      for (const it of inv.items) {
        const cur = prodStats.get(it.productName) ?? { qty: 0, revH: 0 };
        cur.qty += it.qty;
        cur.revH += mulFxHalalas(toHalalas(it.total), fx);
        prodStats.set(it.productName, cur);
      }
    }
  }

  for (const e of state.expenses) {
    if (e.status === 'draft') continue;
    if (e.date.slice(0, 7) === ym) {
      expH += getExpenseBaseHalalas(e);
    }
  }

  let bestCustomer: { name: string; revenue: number } | null = null;
  for (const [name, h] of custRev.entries()) {
    if (!bestCustomer || fromHalalas(h) > bestCustomer.revenue) {
      bestCustomer = { name, revenue: fromHalalas(h) };
    }
  }

  let topProduct: { name: string; qty: number; revenue: number } | null = null;
  for (const [name, s] of prodStats.entries()) {
    if (!topProduct || s.qty > topProduct.qty) {
      topProduct = { name, qty: s.qty, revenue: fromHalalas(s.revH) };
    }
  }

  return {
    revenue: fromHalalas(revH),
    expenses: fromHalalas(expH),
    profit: fromHalalas(revH - expH),
    invoiceCount,
    bestCustomer,
    topProduct,
  };
}

export interface AnalyticsInsightsBundle {
  nextMonthForecast: number;
  last3MonthsRevenue: { monthKey: string; total: number }[];
  overdueRiskCustomers: {
    customerId: string;
    name: string;
    debt: number;
    creditLimit?: number;
    overdueInvoicesCount: number;
    utilizationPct: number;
  }[];
  stockAndExpiryAlerts: {
    productId: string;
    name: string;
    qty: number;
    minStock: number;
    expiryDate?: string;
    reason: 'low_stock' | 'expired' | 'expiring_soon';
  }[];
  lossMakingBranches: {
    branchId: string;
    name: string;
    revenue: number;
    expenses: number;
    netResult: number;
  }[];
}

export function computeAdvancedInsights(state: PersistedState): AnalyticsInsightsBundle {
  const now = new Date();
  const last3Keys: string[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last3Keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const monthRevMap = new Map<string, number>();
  for (const k of last3Keys) monthRevMap.set(k, 0);

  for (const inv of state.invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
    const mk = inv.date.slice(0, 7);
    if (monthRevMap.has(mk)) {
      const fx = inv.exchangeRate ?? 1;
      monthRevMap.set(mk, (monthRevMap.get(mk) ?? 0) + mulFxHalalas(toHalalas(inv.total), fx));
    }
  }

  const last3MonthsRevenue = last3Keys.map((monthKey) => ({
    monthKey,
    total: fromHalalas(monthRevMap.get(monthKey) ?? 0),
  }));

  // Weighted 3-month forecast (0.2 * M-2 + 0.3 * M-1 + 0.5 * M) * 1.06 growth
  const [m2, m1, m0] = last3MonthsRevenue.map((m) => m.total);
  const nonZero = last3MonthsRevenue.filter((m) => m.total > 0);
  const avgFallback = nonZero.length > 0 ? nonZero.reduce((s, x) => s + x.total, 0) / nonZero.length : 0;
  const weighted = m0 > 0 || m1 > 0 || m2 > 0
    ? m2 * 0.2 + m1 * 0.3 + m0 * 0.5
    : avgFallback;
  const nextMonthForecast = fromHalalas(toHalalas(Math.max(weighted, m0) * 1.06));

  const overdueRiskCustomers = state.customers
    .map((c) => {
      const overdueCount = state.invoices.filter(
        (inv) =>
          (inv.customerId === c.id || inv.customerName === c.name) &&
          (inv.status === 'overdue' ||
            (inv.dueDate && inv.dueDate < now.toISOString().slice(0, 10) && inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft')),
      ).length;
      const limit = c.creditLimit ?? 0;
      const utilizationPct = limit > 0 ? Math.round((c.debt / limit) * 100) : 0;
      return {
        customerId: c.id,
        name: c.name,
        debt: c.debt,
        creditLimit: c.creditLimit,
        overdueInvoicesCount: overdueCount,
        utilizationPct,
      };
    })
    .filter((c) => c.overdueInvoicesCount > 0 || c.utilizationPct >= 80 || c.debt >= 15000);

  const todayIso = now.toISOString().slice(0, 10);
  const soonIso = new Date(now.getTime() + 45 * 86400000).toISOString().slice(0, 10);
  const stockAndExpiryAlerts: AnalyticsInsightsBundle['stockAndExpiryAlerts'] = [];

  for (const p of state.products) {
    const minStock = p.minStock ?? 10;
    if (p.expiryDate && p.expiryDate < todayIso) {
      stockAndExpiryAlerts.push({
        productId: p.id,
        name: p.name,
        qty: p.qty,
        minStock,
        expiryDate: p.expiryDate,
        reason: 'expired',
      });
    } else if (p.expiryDate && p.expiryDate <= soonIso) {
      stockAndExpiryAlerts.push({
        productId: p.id,
        name: p.name,
        qty: p.qty,
        minStock,
        expiryDate: p.expiryDate,
        reason: 'expiring_soon',
      });
    } else if (p.qty <= minStock) {
      stockAndExpiryAlerts.push({
        productId: p.id,
        name: p.name,
        qty: p.qty,
        minStock,
        expiryDate: p.expiryDate,
        reason: 'low_stock',
      });
    }
  }

  const profitByBranch = computeProfitAnalytics(state).byBranch;
  const branchExpMap = new Map<string, number>();
  for (const e of state.expenses) {
    if (e.status === 'draft') continue;
    const bid = e.branchId || state.branches[0]?.id || 'BR-MAIN';
    branchExpMap.set(bid, (branchExpMap.get(bid) ?? 0) + getExpenseBaseHalalas(e));
  }

  const lossMakingBranches: AnalyticsInsightsBundle['lossMakingBranches'] = [];
  for (const br of state.branches) {
    const row = profitByBranch.find((r) => r.key === br.id);
    const rev = row?.revenue ?? 0;
    const cogs = row?.estimatedCost ?? 0;
    const exp = fromHalalas(branchExpMap.get(br.id) ?? 0);
    const netResult = fromHalalas(toHalalas(rev) - toHalalas(cogs) - toHalalas(exp));
    if (netResult < 0 || (rev === 0 && exp > 0)) {
      lossMakingBranches.push({
        branchId: br.id,
        name: state.settings.isArabic ? br.nameAr : br.nameEn,
        revenue: rev,
        expenses: fromHalalas(toHalalas(cogs) + toHalalas(exp)),
        netResult,
      });
    }
  }

  return {
    nextMonthForecast,
    last3MonthsRevenue,
    overdueRiskCustomers,
    stockAndExpiryAlerts,
    lossMakingBranches,
  };
}

export interface TopCustomerStat {
  customerId: string;
  customerName: string;
  invoiceCount: number;
  totalSpent: number;
}

export interface DashboardExecutiveStats {
  todaySales: number;
  weekSales: number;
  monthSales: number;
  yearSales: number;
  totalPurchases: number;
  overdueInvoicesCount: number;
  overdueInvoicesTotal: number;
  top5Customers: TopCustomerStat[];
  lowStockProducts: { id: string; name: string; qty: number; minStock: number }[];
  expiringProducts: { id: string; name: string; expiryDate: string; expired: boolean }[];
}

export function computeDashboardExecutiveStats(state: PersistedState): DashboardExecutiveStats {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const weekCutoff = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const monthKey = todayKey.slice(0, 7);
  const yearKey = todayKey.slice(0, 4);
  const soonIso = new Date(now.getTime() + 45 * 86400000).toISOString().slice(0, 10);

  let todaySalesH = 0;
  let weekSalesH = 0;
  let monthSalesH = 0;
  let yearSalesH = 0;
  let overdueCount = 0;
  let overdueTotalH = 0;

  const custMap = new Map<string, { name: string; count: number; totalH: number }>();

  for (const inv of state.invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
    const fx = inv.exchangeRate ?? 1;
    const sign = inv.invoiceType === 'return' ? -1 : 1;
    const baseTotalH = mulFxHalalas(toHalalas(inv.total), fx) * sign;
    const dKey = inv.date.slice(0, 10);

    if (dKey === todayKey) todaySalesH += baseTotalH;
    if (dKey >= weekCutoff) weekSalesH += baseTotalH;
    if (dKey.slice(0, 7) === monthKey) monthSalesH += baseTotalH;
    if (dKey.slice(0, 4) === yearKey) yearSalesH += baseTotalH;

    if (
      inv.invoiceType !== 'return' &&
      (inv.status === 'overdue' ||
        (inv.dueDate && inv.dueDate < todayKey && inv.status !== 'paid'))
    ) {
      overdueCount += 1;
      overdueTotalH += toHalalas(inv.remainingAmount ?? inv.baseTotal ?? inv.total);
    }

    if (inv.invoiceType !== 'return') {
      const ck = inv.customerId || inv.customerName;
      const cur = custMap.get(ck) ?? { name: inv.customerName, count: 0, totalH: 0 };
      cur.count += 1;
      cur.totalH += mulFxHalalas(toHalalas(inv.total), fx);
      custMap.set(ck, cur);
    }
  }

  let purchasesH = 0;
  for (const po of state.purchaseOrders) {
    if (po.status === 'cancelled' || po.status === 'draft') continue;
    purchasesH += toHalalas(po.total);
  }

  const top5Customers: TopCustomerStat[] = Array.from(custMap.entries())
    .map(([customerId, v]) => ({
      customerId,
      customerName: v.name,
      invoiceCount: v.count,
      totalSpent: fromHalalas(v.totalH),
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  const lowStockProducts = state.products
    .filter((p) => p.status !== 'service' && p.qty <= (p.minStock ?? 10))
    .map((p) => ({ id: p.id, name: p.name, qty: p.qty, minStock: p.minStock ?? 10 }));

  const expiringProducts = state.products
    .filter((p) => Boolean(p.expiryDate) && p.expiryDate! <= soonIso)
    .map((p) => ({
      id: p.id,
      name: p.name,
      expiryDate: p.expiryDate!,
      expired: p.expiryDate! < todayKey,
    }));

  return {
    todaySales: fromHalalas(todaySalesH),
    weekSales: fromHalalas(weekSalesH),
    monthSales: fromHalalas(monthSalesH),
    yearSales: fromHalalas(yearSalesH),
    totalPurchases: fromHalalas(purchasesH),
    overdueInvoicesCount: overdueCount,
    overdueInvoicesTotal: fromHalalas(overdueTotalH),
    top5Customers,
    lowStockProducts,
    expiringProducts,
  };
}

export interface ProductPerformanceInsight {
  productId: string;
  name: string;
  qtySold: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  currentStock: number;
  dailyVelocity: number;
  daysUntilStockout: number | null;
}

export interface SmartRecommendation {
  id: string;
  type: 'discount_stagnant' | 'reorder_fast' | 'collect_credit' | 'expiry_clearance';
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  actionRoute: 'inventory' | 'purchase_orders' | 'customers' | 'invoices';
}

export interface DetailedAiInsights {
  bestCustomers: TopCustomerStat[];
  bestProducts: ProductPerformanceInsight[];
  slowMovingProducts: ProductPerformanceInsight[];
  stockoutPredictions: ProductPerformanceInsight[];
  monthComparison: {
    currentMonthKey: string;
    prevMonthKey: string;
    currentRev: number;
    prevRev: number;
    revChangePct: number;
    currentExp: number;
    prevExp: number;
    expChangePct: number;
  };
  recommendations: SmartRecommendation[];
}

export function computeDetailedAiInsights(state: PersistedState): DetailedAiInsights {
  const now = new Date();
  const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  let curRevH = 0;
  let prevRevH = 0;
  let curExpH = 0;
  let prevExpH = 0;

  const custMap = new Map<string, { name: string; count: number; totalH: number }>();
  const prodSalesMap = new Map<string, { qty: number; revH: number; costH: number }>();

  for (const inv of state.invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
    const fx = inv.exchangeRate ?? 1;
    const sign = inv.invoiceType === 'return' ? -1 : 1;
    const baseTotalH = mulFxHalalas(toHalalas(inv.total), fx) * sign;
    const mk = inv.date.slice(0, 7);
    if (mk === curMonthKey) curRevH += baseTotalH;
    if (mk === prevMonthKey) prevRevH += baseTotalH;

    if (inv.invoiceType !== 'return') {
      const ck = inv.customerId || inv.customerName;
      const cPrev = custMap.get(ck) ?? { name: inv.customerName, count: 0, totalH: 0 };
      cPrev.count += 1;
      cPrev.totalH += mulFxHalalas(toHalalas(inv.total), fx);
      custMap.set(ck, cPrev);

      if (inv.items) {
        for (const it of inv.items) {
          const pk = it.productId || it.productName;
          const pPrev = prodSalesMap.get(pk) ?? { qty: 0, revH: 0, costH: 0 };
          pPrev.qty += it.qty;
          pPrev.revH += mulFxHalalas(toHalalas(it.total), fx);
          const unitCostH = it.costPrice !== undefined ? toHalalas(it.costPrice) : 0;
          pPrev.costH += Math.round(unitCostH * it.qty);
          prodSalesMap.set(pk, pPrev);
        }
      }
    }
  }

  for (const exp of state.expenses) {
    if (exp.status === 'draft') continue;
    const mk = exp.date.slice(0, 7);
    const expBaseH = getExpenseBaseHalalas(exp);
    if (mk === curMonthKey) curExpH += expBaseH;
    if (mk === prevMonthKey) prevExpH += expBaseH;
  }

  const curRev = fromHalalas(curRevH);
  const prevRev = fromHalalas(prevRevH);
  const curExp = fromHalalas(curExpH);
  const prevExp = fromHalalas(prevExpH);
  const revChangePct = prevRev > 0 ? Number((((curRev - prevRev) / prevRev) * 100).toFixed(1)) : curRev > 0 ? 100 : 0;
  const expChangePct = prevExp > 0 ? Number((((curExp - prevExp) / prevExp) * 100).toFixed(1)) : curExp > 0 ? 100 : 0;

  const bestCustomers: TopCustomerStat[] = Array.from(custMap.entries())
    .map(([customerId, v]) => ({
      customerId,
      customerName: v.name,
      invoiceCount: v.count,
      totalSpent: fromHalalas(v.totalH),
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  const productInsights: ProductPerformanceInsight[] = state.products
    .filter((p) => p.status !== 'service')
    .map((p) => {
      const stats = prodSalesMap.get(p.id) ?? prodSalesMap.get(p.name) ?? { qty: 0, revH: 0, costH: 0 };
      const rev = fromHalalas(stats.revH);
      const estCostH = stats.costH > 0 ? stats.costH : Math.round(toHalalas(p.cost) * stats.qty);
      const cost = fromHalalas(estCostH);
      const profit = fromHalalas(stats.revH - estCostH);
      const marginPct = rev > 0
        ? Number(((profit / rev) * 100).toFixed(1))
        : p.price > 0
          ? Number((((p.price - p.cost) / p.price) * 100).toFixed(1))
          : 0;
      const dailyVelocity = Number((stats.qty / 30).toFixed(2));
      const daysUntilStockout = dailyVelocity > 0 ? Math.max(0, Math.round(p.qty / dailyVelocity)) : null;
      return {
        productId: p.id,
        name: p.name,
        qtySold: stats.qty,
        revenue: rev,
        cost,
        profit,
        marginPct,
        currentStock: p.qty,
        dailyVelocity,
        daysUntilStockout,
      };
    });

  const bestProducts = [...productInsights].sort((a, b) => b.revenue - a.revenue || b.qtySold - a.qtySold).slice(0, 5);
  const slowMovingProducts = [...productInsights]
    .filter((p) => p.currentStock > 0)
    .sort((a, b) => a.qtySold - b.qtySold || b.currentStock - a.currentStock)
    .slice(0, 5);

  const stockoutPredictions = [...productInsights]
    .filter((p) => p.daysUntilStockout !== null && p.daysUntilStockout <= 45)
    .sort((a, b) => (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999))
    .slice(0, 6);

  const recommendations: SmartRecommendation[] = [];

  const stagnantTop = slowMovingProducts.find((p) => p.qtySold <= 1 && p.currentStock >= 5);
  if (stagnantTop) {
    recommendations.push({
      id: `rec_disc_${stagnantTop.productId}`,
      type: 'discount_stagnant',
      titleAr: `تصفية الصنف الراكد: ${stagnantTop.name}`,
      titleEn: `Discount slow-moving item: ${stagnantTop.name}`,
      detailAr: `لديك ${stagnantTop.currentStock} وحدة بمبيعات منخفضة. نقترح عرض خصم 15% لتنشيط دورة السيولة.`,
      detailEn: `${stagnantTop.currentStock} units with slow velocity. Suggest a 15% promo discount to free working capital.`,
      actionRoute: 'inventory',
    });
  }

  const urgentStockout = stockoutPredictions[0];
  if (urgentStockout) {
    recommendations.push({
      id: `rec_reord_${urgentStockout.productId}`,
      type: 'reorder_fast',
      titleAr: `إعادة طلب سريعة: ${urgentStockout.name}`,
      titleEn: `Urgent reorder: ${urgentStockout.name}`,
      detailAr: `بمعدل البيع الحالي (${urgentStockout.dailyVelocity}/يوم) سينفد المخزون خلال ${urgentStockout.daysUntilStockout} يوم.`,
      detailEn: `At ${urgentStockout.dailyVelocity}/day velocity, stock will run out in ${urgentStockout.daysUntilStockout} days.`,
      actionRoute: 'purchase_orders',
    });
  }

  const creditExceededCust = state.customers.find(
    (c) => typeof c.creditLimit === 'number' && c.creditLimit > 0 && c.debt >= c.creditLimit * 0.85,
  );
  if (creditExceededCust) {
    recommendations.push({
      id: `rec_cust_${creditExceededCust.id}`,
      type: 'collect_credit',
      titleAr: `متابعة تحصيل عميل: ${creditExceededCust.name}`,
      titleEn: `Credit collection alert: ${creditExceededCust.name}`,
      detailAr: `اقترب أو تجاوز الحد الائتماني (${creditExceededCust.debt.toLocaleString()} من ${creditExceededCust.creditLimit?.toLocaleString()}).`,
      detailEn: `Near/above credit limit (${creditExceededCust.debt.toLocaleString()} of ${creditExceededCust.creditLimit?.toLocaleString()}).`,
      actionRoute: 'customers',
    });
  }

  const todayIso = now.toISOString().slice(0, 10);
  const soonIso = new Date(now.getTime() + 45 * 86400000).toISOString().slice(0, 10);
  const expiringSoon = state.products.find((p) => p.expiryDate && p.expiryDate <= soonIso && p.qty > 0);
  if (expiringSoon) {
    const expired = expiringSoon.expiryDate! < todayIso;
    recommendations.push({
      id: `rec_exp_${expiringSoon.id}`,
      type: 'expiry_clearance',
      titleAr: expired ? `إتلاف/عزل منتهي الصلاحية: ${expiringSoon.name}` : `عرض تصفية قبل الانتهاء: ${expiringSoon.name}`,
      titleEn: expired ? `Quarantine expired item: ${expiringSoon.name}` : `Clearance before expiry: ${expiringSoon.name}`,
      detailAr: `تاريخ الانتهاء ${expiringSoon.expiryDate} — الكمية المتبقية ${expiringSoon.qty}.`,
      detailEn: `Expiry date ${expiringSoon.expiryDate} — ${expiringSoon.qty} units remaining.`,
      actionRoute: 'inventory',
    });
  }

  return {
    bestCustomers,
    bestProducts,
    slowMovingProducts,
    stockoutPredictions,
    monthComparison: {
      currentMonthKey: curMonthKey,
      prevMonthKey,
      currentRev: curRev,
      prevRev,
      revChangePct,
      currentExp: curExp,
      prevExp,
      expChangePct,
    },
    recommendations,
  };
}
