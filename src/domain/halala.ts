/**
 * Currency-Aware Integer Minor-Unit Arithmetic
 * Standard currencies (SAR, USD, EUR, AED, EGP, etc.) = 100 minor units (Halalas / Cents)
 * 3-decimal dinar/rial currencies (KWD, BHD, OMR, JOD, IQD) = 1000 minor units (Fils / Baisa)
 * 0-decimal currencies (JPY) = 1 minor unit
 */

export function getCurrencyMinorFactor(currency?: string): number {
  const code = (currency || 'SAR').toUpperCase();
  if (code === 'KWD' || code === 'BHD' || code === 'OMR' || code === 'JOD' || code === 'IQD') {
    return 1000;
  }
  if (code === 'JPY') {
    return 1;
  }
  return 100;
}

export function toHalalas(amount: number, currency?: string): number {
  if (!Number.isFinite(amount)) return 0;
  const factor = getCurrencyMinorFactor(currency);
  return Math.round(amount * factor);
}

export function fromHalalas(minorUnits: number, currency?: string): number {
  if (!Number.isFinite(minorUnits)) return 0;
  const factor = getCurrencyMinorFactor(currency);
  return Math.trunc(minorUnits) / factor;
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

export function sumAmountsInHalalas(amounts: number[], currency?: string): number {
  let totalH = 0;
  for (const amt of amounts) {
    totalH += toHalalas(amt, currency);
  }
  return fromHalalas(totalH, currency);
}

export function calcRateHalalas(baseMinorUnits: number, ratePercent: number): number {
  if (!Number.isFinite(baseMinorUnits) || !Number.isFinite(ratePercent)) return 0;
  return Math.round((Math.trunc(baseMinorUnits) * ratePercent) / 100);
}

export function calcLineNetHalalas(
  qty: number,
  unitPrice: number,
  discountPercent = 0,
  taxRate = 0,
  currency?: string,
): {
  grossH: number;
  discountH: number;
  netH: number;
  taxH: number;
  totalH: number;
} {
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 0;
  const unitPriceH = toHalalas(unitPrice, currency);
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

export function mulFxHalalas(
  sourceMinorUnits: number,
  fxRate: number,
  fromCurrency?: string,
  toCurrency?: string,
): number {
  if (!Number.isFinite(sourceMinorUnits) || !Number.isFinite(fxRate) || fxRate <= 0) {
    return Math.trunc(sourceMinorUnits);
  }
  const fromFactor = getCurrencyMinorFactor(fromCurrency);
  const toFactor = getCurrencyMinorFactor(toCurrency);
  if (fromFactor === toFactor) {
    return Math.round(Math.trunc(sourceMinorUnits) * fxRate);
  }
  return Math.round((Math.trunc(sourceMinorUnits) * fxRate * toFactor) / fromFactor);
}

export function isBalancedJournalHalalas(
  lines: { debit: number; credit: number }[],
  currency?: string,
): {
  balanced: boolean;
  totalDebitH: number;
  totalCreditH: number;
} {
  let totalDebitH = 0;
  let totalCreditH = 0;
  for (const line of lines) {
    totalDebitH += toHalalas(line.debit, currency);
    totalCreditH += toHalalas(line.credit, currency);
  }
  return {
    balanced: totalDebitH === totalCreditH && totalDebitH > 0,
    totalDebitH,
    totalCreditH,
  };
}
