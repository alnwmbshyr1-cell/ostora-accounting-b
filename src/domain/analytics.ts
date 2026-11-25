import { PersistedState } from '../types/erp';
import { computeProfitAnalytics } from './accounting';
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
    if (inv.status === 'cancelled' || inv.invoiceType === 'quotation') continue;
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
    if (exp.date.slice(0, 10) === todayKey) {
      todayExpH += toHalalas(exp.amount);
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
    if (inv.status === 'cancelled' || inv.invoiceType === 'quotation') continue;
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
    if (e.date.slice(0, 7) === ym) {
      expH += toHalalas(e.amount);
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
    if (inv.status === 'cancelled' || inv.invoiceType === 'quotation') continue;
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
            (inv.dueDate && inv.dueDate < now.toISOString().slice(0, 10) && inv.status !== 'paid' && inv.status !== 'cancelled')),
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
    const bid = e.branchId || state.branches[0]?.id || 'BR-MAIN';
    branchExpMap.set(bid, (branchExpMap.get(bid) ?? 0) + toHalalas(e.amount));
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
