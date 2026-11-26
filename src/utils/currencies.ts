import { CurrencyCode } from '../types/erp';

export interface CurrencyMeta {
  code: CurrencyCode;
  nameAr: string;
  nameEn: string;
  symbol: string;
  /** Number of decimal places mandated/expected by this currency */
  minDecimals: number;
  maxDecimals: number;
  /** Regional number formatting locale (thousands/decimal separators) */
  locale: string;
  /** Symbol placement relative to the formatted number */
  symbolPlacement: 'before' | 'after';
  /** Approximate units of SAR per 1 unit of this currency (used only for offline fallback) */
  approxSarRate: number;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: 'ر.س', minDecimals: 2, maxDecimals: 2, locale: 'en-US', symbolPlacement: 'after', approxSarRate: 1 },
  { code: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', symbol: 'د.إ', minDecimals: 2, maxDecimals: 2, locale: 'en-US', symbolPlacement: 'after', approxSarRate: 1.0211 },
  { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$', minDecimals: 2, maxDecimals: 2, locale: 'en-US', symbolPlacement: 'before', approxSarRate: 3.75 },
  { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€', minDecimals: 2, maxDecimals: 2, locale: 'de-DE', symbolPlacement: 'after', approxSarRate: 3.96 },
  { code: 'GBP', nameAr: 'جنيه إسترليني', nameEn: 'British Pound', symbol: '£', minDecimals: 2, maxDecimals: 2, locale: 'en-GB', symbolPlacement: 'before', approxSarRate: 4.74 },
  { code: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbol: 'ج.م', minDecimals: 2, maxDecimals: 2, locale: 'en-US', symbolPlacement: 'after', approxSarRate: 0.076 },
  { code: 'YER', nameAr: 'ريال يمني', nameEn: 'Yemeni Rial', symbol: 'ر.ي', minDecimals: 0, maxDecimals: 2, locale: 'en-US', symbolPlacement: 'after', approxSarRate: 0.015 },
  { code: 'KWD', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar', symbol: 'د.ك', minDecimals: 3, maxDecimals: 3, locale: 'en-US', symbolPlacement: 'after', approxSarRate: 12.2 },
  { code: 'QAR', nameAr: 'ريال قطري', nameEn: 'Qatari Riyal', symbol: 'ر.ق', minDecimals: 2, maxDecimals: 2, locale: 'en-US', symbolPlacement: 'after', approxSarRate: 1.03 },
  { code: 'BHD', nameAr: 'دينار بحريني', nameEn: 'Bahraini Dinar', symbol: 'د.ب', minDecimals: 3, maxDecimals: 3, locale: 'en-US', symbolPlacement: 'after', approxSarRate: 9.95 },
  { code: 'OMR', nameAr: 'ريال عماني', nameEn: 'Omani Rial', symbol: 'ر.ع', minDecimals: 3, maxDecimals: 3, locale: 'en-US', symbolPlacement: 'after', approxSarRate: 9.74 },
  { code: 'JOD', nameAr: 'دينار أردني', nameEn: 'Jordanian Dinar', symbol: 'د.أ', minDecimals: 3, maxDecimals: 3, locale: 'en-US', symbolPlacement: 'after', approxSarRate: 5.29 },
  { code: 'TRY', nameAr: 'ليرة تركية', nameEn: 'Turkish Lira', symbol: '₺', minDecimals: 2, maxDecimals: 2, locale: 'tr-TR', symbolPlacement: 'after', approxSarRate: 0.109 },
];

export const ALL_CURRENCY_CODES: CurrencyCode[] = SUPPORTED_CURRENCIES.map((c) => c.code);

export const DEFAULT_ENABLED_CURRENCIES: CurrencyCode[] = ['SAR', 'AED', 'USD', 'EUR', 'EGP', 'YER'];

export function buildDefaultRatesForBase(base: CurrencyCode): Record<string, number> {
  const baseMeta = SUPPORTED_CURRENCIES.find((c) => c.code === base);
  const baseSar = baseMeta?.approxSarRate ?? 1;
  const out: Record<string, number> = {};
  for (const c of SUPPORTED_CURRENCIES) {
    out[c.code] = c.code === base ? 1 : Number((c.approxSarRate / baseSar).toFixed(4));
  }
  return out;
}

export function getCurrencyMeta(code: string | undefined): CurrencyMeta {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) ?? SUPPORTED_CURRENCIES[0];
}

export type CurrencyDisplayStyle = 'symbol' | 'code' | 'both';
export type CurrencyNumberLocale = 'auto' | 'en-US' | 'ar-SA';
export type CurrencyDecimalMode = 'auto' | '0' | '2' | '3';

export interface CurrencyDisplayPreferences {
  displayStyle: CurrencyDisplayStyle;
  numberLocale: CurrencyNumberLocale;
  decimalMode: CurrencyDecimalMode;
}

let activeDisplayPrefs: CurrencyDisplayPreferences = {
  displayStyle: 'symbol',
  numberLocale: 'auto',
  decimalMode: 'auto',
};

export function setCurrencyDisplayPreferences(prefs: Partial<CurrencyDisplayPreferences>): void {
  activeDisplayPrefs = {
    displayStyle: prefs.displayStyle ?? activeDisplayPrefs.displayStyle,
    numberLocale: prefs.numberLocale ?? activeDisplayPrefs.numberLocale,
    decimalMode: prefs.decimalMode ?? activeDisplayPrefs.decimalMode,
  };
}

export function getCurrencyDisplayPreferences(): CurrencyDisplayPreferences {
  return activeDisplayPrefs;
}

export interface FormatCurrencyOptions {
  /** Whether UI is Arabic (shows localized symbol by default; English uses symbol/code cleanly) */
  isAr?: boolean;
  /** Append ISO currency code alongside symbol when different (e.g. "$1,250.00 (USD)") */
  showCode?: boolean;
  /** Override max decimal places when compact display is desired */
  maxDecimals?: number;
  /** Override min decimal places */
  minDecimals?: number;
  /** Override formatting locale */
  locale?: string;
  /** Force ISO code instead of symbol */
  useCodeOnly?: boolean;
  /** Override display style */
  displayStyle?: CurrencyDisplayStyle;
}

/** Formats only the numeric portion using the target currency's locale & decimal rules (with optional global overrides). */
export function formatCurrencyNumber(
  amount: number,
  code?: string,
  options?: { maxDecimals?: number; minDecimals?: number; locale?: string },
): string {
  const meta = getCurrencyMeta(code);
  const safe = Number.isFinite(amount) ? amount : 0;

  let defaultMaxD = meta.maxDecimals;
  let defaultMinD = meta.minDecimals;
  if (activeDisplayPrefs.decimalMode !== 'auto') {
    const forced = parseInt(activeDisplayPrefs.decimalMode, 10);
    if (Number.isFinite(forced)) {
      defaultMaxD = forced;
      defaultMinD = forced;
    }
  }

  const maxD = options?.maxDecimals ?? defaultMaxD;
  const minD = Math.min(options?.minDecimals ?? defaultMinD, maxD);
  const resolvedLocale =
    options?.locale ??
    (activeDisplayPrefs.numberLocale !== 'auto' ? activeDisplayPrefs.numberLocale : meta.locale);

  try {
    return new Intl.NumberFormat(resolvedLocale, {
      minimumFractionDigits: minD,
      maximumFractionDigits: maxD,
    }).format(safe);
  } catch {
    return safe.toFixed(maxD);
  }
}

/** Formats an amount with the target currency's symbol/code and regional number format. */
export function formatCurrency(
  amount: number,
  code?: string,
  options?: FormatCurrencyOptions,
): string {
  const meta = getCurrencyMeta(code);
  const safe = Number.isFinite(amount) ? amount : 0;
  const isNegative = safe < 0;
  const absFormatted = formatCurrencyNumber(Math.abs(safe), meta.code, {
    maxDecimals: options?.maxDecimals,
    minDecimals: options?.minDecimals,
    locale: options?.locale,
  });
  const sign = isNegative ? '-' : '';

  const style: CurrencyDisplayStyle = options?.useCodeOnly
    ? 'code'
    : options?.showCode
    ? 'both'
    : options?.displayStyle ?? activeDisplayPrefs.displayStyle;

  if (style === 'code') {
    return `${sign}${absFormatted} ${meta.code}`;
  }

  const unit = options?.isAr === false && /[\u0600-\u06FF]/.test(meta.symbol)
    ? meta.code
    : meta.symbol;

  const core =
    meta.symbolPlacement === 'before' && unit === meta.symbol
      ? `${sign}${unit}${absFormatted}`
      : `${sign}${absFormatted} ${unit}`;

  if (style === 'both' && unit !== meta.code) {
    return `${core} (${meta.code})`;
  }
  return core;
}

/** Converts an amount stored in baseCurrency to targetCurrency using stored exchangeRates (1 target = R base). */
export function convertFromBaseCurrency(
  baseAmount: number,
  targetCurrency: string,
  baseCurrency: string,
  exchangeRates?: Record<string, number>,
): number {
  if (!Number.isFinite(baseAmount)) return 0;
  if (!targetCurrency || targetCurrency === baseCurrency) return baseAmount;
  const rate = exchangeRates?.[targetCurrency];
  if (rate && Number.isFinite(rate) && rate > 0) {
    return baseAmount / rate;
  }
  const targetMeta = getCurrencyMeta(targetCurrency);
  const baseMeta = getCurrencyMeta(baseCurrency);
  const fallbackRate = targetMeta.approxSarRate / (baseMeta.approxSarRate || 1);
  return fallbackRate > 0 ? baseAmount / fallbackRate : baseAmount;
}

/** Converts an amount between any two currencies via stored rates against baseCurrency (1 X = R base). */
export function convertCurrencyAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  baseCurrency: string,
  exchangeRates?: Record<string, number>,
): number {
  if (!Number.isFinite(amount)) return 0;
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return amount;
  const fromMeta = getCurrencyMeta(fromCurrency);
  const baseMeta = getCurrencyMeta(baseCurrency);
  const fromRate =
    fromCurrency === baseCurrency
      ? 1
      : exchangeRates?.[fromCurrency] && exchangeRates[fromCurrency] > 0
      ? exchangeRates[fromCurrency]
      : fromMeta.approxSarRate / (baseMeta.approxSarRate || 1);
  const baseAmount = amount * fromRate;
  return convertFromBaseCurrency(baseAmount, toCurrency, baseCurrency, exchangeRates);
}

export interface LiveRatesResponse {
  base: CurrencyCode;
  rates: Record<string, number>;
  updatedAt: string;
  source: 'live' | 'fallback';
}

export async function fetchLiveExchangeRates(base: CurrencyCode): Promise<LiveRatesResponse> {
  const res = await fetch(`/api/exchange-rates?base=${encodeURIComponent(base)}`);
  if (!res.ok) {
    return {
      base,
      rates: buildDefaultRatesForBase(base),
      updatedAt: new Date().toISOString(),
      source: 'fallback',
    };
  }
  return (await res.json()) as LiveRatesResponse;
}
