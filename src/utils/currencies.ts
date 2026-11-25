import { CurrencyCode } from '../types/erp';

export interface CurrencyMeta {
  code: CurrencyCode;
  nameAr: string;
  nameEn: string;
  symbol: string;
  /** Approximate units of SAR per 1 unit of this currency (used only for offline fallback) */
  approxSarRate: number;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: 'ر.س', approxSarRate: 1 },
  { code: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', symbol: 'د.إ', approxSarRate: 1.0211 },
  { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$', approxSarRate: 3.75 },
  { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€', approxSarRate: 3.96 },
  { code: 'GBP', nameAr: 'جنيه إسترليني', nameEn: 'British Pound', symbol: '£', approxSarRate: 4.74 },
  { code: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbol: 'ج.م', approxSarRate: 0.076 },
  { code: 'YER', nameAr: 'ريال يمني', nameEn: 'Yemeni Rial', symbol: 'ر.ي', approxSarRate: 0.015 },
  { code: 'KWD', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar', symbol: 'د.ك', approxSarRate: 12.2 },
  { code: 'QAR', nameAr: 'ريال قطري', nameEn: 'Qatari Riyal', symbol: 'ر.ق', approxSarRate: 1.03 },
  { code: 'BHD', nameAr: 'دينار بحريني', nameEn: 'Bahraini Dinar', symbol: 'د.ب', approxSarRate: 9.95 },
  { code: 'OMR', nameAr: 'ريال عماني', nameEn: 'Omani Rial', symbol: 'ر.ع', approxSarRate: 9.74 },
  { code: 'JOD', nameAr: 'دينار أردني', nameEn: 'Jordanian Dinar', symbol: 'د.أ', approxSarRate: 5.29 },
  { code: 'TRY', nameAr: 'ليرة تركية', nameEn: 'Turkish Lira', symbol: '₺', approxSarRate: 0.109 },
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
