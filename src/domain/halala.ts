/**
 * Integer Halala Arithmetic (1 SAR = 100 Halalas)
 * Prevents binary floating-point rounding errors (e.g. 0.01 SAR drift) across all accounting calculations.
 */

export function toHalalas(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function fromHalalas(halalas: number): number {
  if (!Number.isFinite(halalas)) return 0;
  return Math.trunc(halalas) / 100;
}

export function addHalalas(...values: number[]): number {
  let sum = 0;
  for (const v of values) {
    sum += Math.trunc(v);
  }
  return sum;
}

export function subHalalas(a: number, b: number): number {
  return Math.trunc(a) - Math.trunc(b);
}

export function sumAmountsInHalalas(amounts: number[]): number {
  let totalH = 0;
  for (const amt of amounts) {
    totalH += toHalalas(amt);
  }
  return fromHalalas(totalH);
}

export function calcRateHalalas(baseHalalas: number, ratePercent: number): number {
  if (!Number.isFinite(baseHalalas) || !Number.isFinite(ratePercent)) return 0;
  return Math.round((Math.trunc(baseHalalas) * ratePercent) / 100);
}

export function calcLineNetHalalas(
  qty: number,
  unitPrice: number,
  discountPercent = 0,
  taxRate = 0,
): {
  grossH: number;
  discountH: number;
  netH: number;
  taxH: number;
  totalH: number;
} {
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 0;
  const unitPriceH = toHalalas(unitPrice);
  const grossH = Math.round(safeQty * unitPriceH);
  const safeDisc = Math.max(0, Math.min(100, Number.isFinite(discountPercent) ? discountPercent : 0));
  const discountH = calcRateHalalas(grossH, safeDisc);
  const netH = Math.max(0, grossH - discountH);
  const safeTax = Math.max(0, Math.min(100, Number.isFinite(taxRate) ? taxRate : 0));
  const taxH = calcRateHalalas(netH, safeTax);
  return {
    grossH,
    discountH,
    netH,
    taxH,
    totalH: netH + taxH,
  };
}

export function mulFxHalalas(baseHalalas: number, fxRate: number): number {
  if (!Number.isFinite(baseHalalas) || !Number.isFinite(fxRate) || fxRate <= 0) return baseHalalas;
  return Math.round(Math.trunc(baseHalalas) * fxRate);
}

export function isBalancedJournalHalalas(lines: { debit: number; credit: number }[]): {
  balanced: boolean;
  totalDebitH: number;
  totalCreditH: number;
} {
  let totalDebitH = 0;
  let totalCreditH = 0;
  for (const line of lines) {
    totalDebitH += toHalalas(line.debit);
    totalCreditH += toHalalas(line.credit);
  }
  return {
    balanced: totalDebitH === totalCreditH && totalDebitH > 0,
    totalDebitH,
    totalCreditH,
  };
}
