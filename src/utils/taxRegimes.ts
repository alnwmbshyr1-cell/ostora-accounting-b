import { CountryCode, CurrencyCode, TaxTreatment } from '../types/erp';

export interface CountryTaxRegime {
  countryCode: CountryCode;
  nameAr: string;
  nameEn: string;
  defaultCurrency: CurrencyCode;
  standardVatRate: number;
  purchaseVatRate: number;
  taxAuthorityAr: string;
  taxAuthorityEn: string;
  supportsZatca: boolean;
}

export const COUNTRY_TAX_REGIMES: CountryTaxRegime[] = [
  { countryCode: 'SA', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', defaultCurrency: 'SAR', standardVatRate: 15, purchaseVatRate: 15, taxAuthorityAr: 'هيئة الزكاة والضريبة والجمارك (ZATCA)', taxAuthorityEn: 'ZATCA', supportsZatca: true },
  { countryCode: 'AE', nameAr: 'الإمارات العربية المتحدة', nameEn: 'United Arab Emirates', defaultCurrency: 'AED', standardVatRate: 5, purchaseVatRate: 5, taxAuthorityAr: 'الهيئة الاتحادية للضرائب (FTA)', taxAuthorityEn: 'UAE FTA', supportsZatca: false },
  { countryCode: 'QA', nameAr: 'دولة قطر', nameEn: 'Qatar', defaultCurrency: 'QAR', standardVatRate: 0, purchaseVatRate: 0, taxAuthorityAr: 'الهيئة العامة للضرائب', taxAuthorityEn: 'General Tax Authority', supportsZatca: false },
  { countryCode: 'KW', nameAr: 'دولة الكويت', nameEn: 'Kuwait', defaultCurrency: 'KWD', standardVatRate: 0, purchaseVatRate: 0, taxAuthorityAr: 'الإدارة الضريبية الكويتية', taxAuthorityEn: 'Kuwait Tax Dept', supportsZatca: false },
  { countryCode: 'BH', nameAr: 'مملكة البحرين', nameEn: 'Bahrain', defaultCurrency: 'BHD', standardVatRate: 10, purchaseVatRate: 10, taxAuthorityAr: 'الجهاز الوطني للإيرادات (NBR)', taxAuthorityEn: 'Bahrain NBR', supportsZatca: false },
  { countryCode: 'OM', nameAr: 'سلطنة عمان', nameEn: 'Oman', defaultCurrency: 'OMR', standardVatRate: 5, purchaseVatRate: 5, taxAuthorityAr: 'جهاز الضرائب العماني', taxAuthorityEn: 'Oman Tax Authority', supportsZatca: false },
  { countryCode: 'EG', nameAr: 'جمهورية مصر العربية', nameEn: 'Egypt', defaultCurrency: 'EGP', standardVatRate: 14, purchaseVatRate: 14, taxAuthorityAr: 'مصلحة الضرائب المصرية (ETA)', taxAuthorityEn: 'Egyptian Tax Authority', supportsZatca: false },
  { countryCode: 'JO', nameAr: 'المملكة الأردنية الهاشمية', nameEn: 'Jordan', defaultCurrency: 'JOD', standardVatRate: 16, purchaseVatRate: 16, taxAuthorityAr: 'دائرة ضريبة الدخل والمبيعات (ISTD)', taxAuthorityEn: 'Jordan ISTD', supportsZatca: false },
  { countryCode: 'US', nameAr: 'الولايات المتحدة الأمريكية', nameEn: 'United States', defaultCurrency: 'USD', standardVatRate: 0, purchaseVatRate: 0, taxAuthorityAr: 'IRS / State Sales Tax', taxAuthorityEn: 'IRS / State Sales Tax', supportsZatca: false },
  { countryCode: 'GB', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom', defaultCurrency: 'GBP', standardVatRate: 20, purchaseVatRate: 20, taxAuthorityAr: 'HMRC VAT', taxAuthorityEn: 'HMRC VAT', supportsZatca: false },
  { countryCode: 'EU', nameAr: 'الاتحاد الأوروبي', nameEn: 'European Union', defaultCurrency: 'EUR', standardVatRate: 19, purchaseVatRate: 19, taxAuthorityAr: 'EU VAT Directive', taxAuthorityEn: 'EU VAT Directive', supportsZatca: false },
];

export function getCountryTaxRegime(code?: CountryCode): CountryTaxRegime {
  return COUNTRY_TAX_REGIMES.find((r) => r.countryCode === code) ?? COUNTRY_TAX_REGIMES[0];
}

export function resolveEffectiveTaxRate(
  baseRate: number,
  treatment?: TaxTreatment,
): number {
  if (treatment === 'zero' || treatment === 'exempt') return 0;
  return Number.isFinite(baseRate) ? Math.max(0, Math.min(100, baseRate)) : 0;
}
