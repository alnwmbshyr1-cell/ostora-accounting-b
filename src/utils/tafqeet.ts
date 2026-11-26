import { getCurrencyMinorFactor } from '../domain/halala';

interface CurrencyWordsNames {
  majorArSingle: string;
  majorArPlural: string;
  minorArSingle: string;
  minorArPlural: string;
  majorEnSingle: string;
  majorEnPlural: string;
  minorEnSingle: string;
  minorEnPlural: string;
}

const CURRENCY_WORDS: Record<string, CurrencyWordsNames> = {
  SAR: { majorArSingle: 'ريال سعودي', majorArPlural: 'ريالات سعودية', minorArSingle: 'هللة', minorArPlural: 'هللات', majorEnSingle: 'Saudi Riyal', majorEnPlural: 'Saudi Riyals', minorEnSingle: 'Halala', minorEnPlural: 'Halalas' },
  AED: { majorArSingle: 'درهم إماراتي', majorArPlural: 'دراهم إماراتية', minorArSingle: 'فلس', minorArPlural: 'فلوس', majorEnSingle: 'UAE Dirham', majorEnPlural: 'UAE Dirhams', minorEnSingle: 'Fils', minorEnPlural: 'Fils' },
  USD: { majorArSingle: 'دولار أمريكي', majorArPlural: 'دولارات أمريكية', minorArSingle: 'سنت', minorArPlural: 'سنتات', majorEnSingle: 'US Dollar', majorEnPlural: 'US Dollars', minorEnSingle: 'Cent', minorEnPlural: 'Cents' },
  EUR: { majorArSingle: 'يورو', majorArPlural: 'يورو', minorArSingle: 'سنت', minorArPlural: 'سنتات', majorEnSingle: 'Euro', majorEnPlural: 'Euros', minorEnSingle: 'Cent', minorEnPlural: 'Cents' },
  GBP: { majorArSingle: 'جنيه إسترليني', majorArPlural: 'جنيهات إسترلينية', minorArSingle: 'بنس', minorArPlural: 'بنسات', majorEnSingle: 'British Pound', majorEnPlural: 'British Pounds', minorEnSingle: 'Penny', minorEnPlural: 'Pence' },
  EGP: { majorArSingle: 'جنيه مصري', majorArPlural: 'جنيهات مصرية', minorArSingle: 'قرش', minorArPlural: 'قروش', majorEnSingle: 'Egyptian Pound', majorEnPlural: 'Egyptian Pounds', minorEnSingle: 'Piastre', minorEnPlural: 'Piastres' },
  YER: { majorArSingle: 'ريال يمني', majorArPlural: 'ريالات يمنية', minorArSingle: 'فلس', minorArPlural: 'فلوس', majorEnSingle: 'Yemeni Rial', majorEnPlural: 'Yemeni Rials', minorEnSingle: 'Fils', minorEnPlural: 'Fils' },
  KWD: { majorArSingle: 'دينار كويتي', majorArPlural: 'دنانير كويتية', minorArSingle: 'فلس', minorArPlural: 'فلوس', majorEnSingle: 'Kuwaiti Dinar', majorEnPlural: 'Kuwaiti Dinars', minorEnSingle: 'Fils', minorEnPlural: 'Fils' },
  QAR: { majorArSingle: 'ريال قطري', majorArPlural: 'ريالات قطرية', minorArSingle: 'درهم', minorArPlural: 'دراهم', majorEnSingle: 'Qatari Riyal', majorEnPlural: 'Qatari Riyals', minorEnSingle: 'Dirham', minorEnPlural: 'Dirhams' },
  BHD: { majorArSingle: 'دينار بحريني', majorArPlural: 'دنانير بحرينية', minorArSingle: 'فلس', minorArPlural: 'فلوس', majorEnSingle: 'Bahraini Dinar', majorEnPlural: 'Bahraini Dinars', minorEnSingle: 'Fils', minorEnPlural: 'Fils' },
  OMR: { majorArSingle: 'ريال عماني', majorArPlural: 'ريالات عمانية', minorArSingle: 'بيسة', minorArPlural: 'بيسات', majorEnSingle: 'Omani Rial', majorEnPlural: 'Omani Rials', minorEnSingle: 'Baisa', minorEnPlural: 'Baisas' },
  JOD: { majorArSingle: 'دينار أردني', majorArPlural: 'دنانير أردنية', minorArSingle: 'فلس', minorArPlural: 'فلوس', majorEnSingle: 'Jordanian Dinar', majorEnPlural: 'Jordanian Dinars', minorEnSingle: 'Fils', minorEnPlural: 'Fils' },
  IQD: { majorArSingle: 'دينار عراقي', majorArPlural: 'دنانير عراقية', minorArSingle: 'فلس', minorArPlural: 'فلوس', majorEnSingle: 'Iraqi Dinar', majorEnPlural: 'Iraqi Dinars', minorEnSingle: 'Fils', minorEnPlural: 'Fils' },
  TRY: { majorArSingle: 'ليرة تركية', majorArPlural: 'ليرات تركية', minorArSingle: 'قرش', minorArPlural: 'قروش', majorEnSingle: 'Turkish Lira', majorEnPlural: 'Turkish Liras', minorEnSingle: 'Kurus', minorEnPlural: 'Kurus' },
  JPY: { majorArSingle: 'ين ياباني', majorArPlural: 'ين ياباني', minorArSingle: 'سين', minorArPlural: 'سين', majorEnSingle: 'Japanese Yen', majorEnPlural: 'Japanese Yen', minorEnSingle: 'Sen', minorEnPlural: 'Sen' },
};

const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const AR_TEENS = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TENS = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function groupToArabicWords(n: number): string {
  const num = Math.floor(n);
  if (num === 0) return '';
  const parts: string[] = [];
  const h = Math.floor(num / 100);
  const rem = num % 100;
  if (h > 0) parts.push(AR_HUNDREDS[h]);
  if (rem > 0) {
    if (rem < 10) parts.push(AR_ONES[rem]);
    else if (rem < 20) parts.push(AR_TEENS[rem - 10]);
    else {
      const u = rem % 10;
      const t = Math.floor(rem / 10);
      if (u > 0) parts.push(`${AR_ONES[u]} و${AR_TENS[t]}`);
      else parts.push(AR_TENS[t]);
    }
  }
  return parts.join(' و');
}

function intToArabicWords(n: number): string {
  if (n === 0) return 'صفر';
  const scales: { value: number; single: string; dual: string; plural: string }[] = [
    { value: 1_000_000_000, single: 'مليار', dual: 'ملياران', plural: 'مليارات' },
    { value: 1_000_000, single: 'مليون', dual: 'مليونان', plural: 'ملايين' },
    { value: 1_000, single: 'ألف', dual: 'ألفان', plural: 'آلاف' },
  ];
  let rem = Math.floor(n);
  const parts: string[] = [];
  for (const s of scales) {
    if (rem >= s.value) {
      const q = Math.floor(rem / s.value);
      rem %= s.value;
      if (q === 1) parts.push(s.single);
      else if (q === 2) parts.push(s.dual);
      else if (q >= 3 && q <= 10) parts.push(`${groupToArabicWords(q)} ${s.plural}`);
      else parts.push(`${groupToArabicWords(q)} ${s.single}`);
    }
  }
  if (rem > 0) parts.push(groupToArabicWords(rem));
  return parts.join(' و');
}

const EN_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const EN_TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Thirteen', 'Eighteen', 'Nineteen'];
const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function groupToEnglishWords(n: number): string {
  const num = Math.floor(n);
  if (num === 0) return '';
  const parts: string[] = [];
  const h = Math.floor(num / 100);
  const rem = num % 100;
  if (h > 0) parts.push(`${EN_ONES[h]} Hundred`);
  if (rem > 0) {
    if (rem < 10) parts.push(EN_ONES[rem]);
    else if (rem < 20) parts.push(EN_TEENS[rem - 10] === 'Thirteen' && rem === 17 ? 'Seventeen' : EN_TEENS[rem - 10]);
    else {
      const u = rem % 10;
      const t = Math.floor(rem / 10);
      parts.push(u > 0 ? `${EN_TENS[t]}-${EN_ONES[u]}` : EN_TENS[t]);
    }
  }
  return parts.join(' ');
}

function intToEnglishWords(n: number): string {
  if (n === 0) return 'Zero';
  const scales = [
    { value: 1_000_000_000, label: 'Billion' },
    { value: 1_000_000, label: 'Million' },
    { value: 1_000, label: 'Thousand' },
  ];
  let rem = Math.floor(n);
  const parts: string[] = [];
  for (const s of scales) {
    if (rem >= s.value) {
      const q = Math.floor(rem / s.value);
      rem %= s.value;
      parts.push(`${groupToEnglishWords(q)} ${s.label}`);
    }
  }
  if (rem > 0) parts.push(groupToEnglishWords(rem));
  return parts.join(' ');
}

export function numberToWordsTafqeet(
  amount: number,
  currencyCode = 'SAR',
  lang: 'ar' | 'en' = 'ar',
): string {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const code = currencyCode.toUpperCase();
  const names = CURRENCY_WORDS[code] ?? CURRENCY_WORDS.SAR;
  const factor = getCurrencyMinorFactor(code);
  const totalMinor = Math.round(safe * factor);
  const major = Math.floor(totalMinor / factor);
  const minor = factor === 1 ? 0 : totalMinor % factor;
  const prefix = amount < 0 ? (lang === 'ar' ? 'سالب ' : 'Minus ') : '';

  if (lang === 'ar') {
    const majorUnit = major >= 3 && major <= 10 ? names.majorArPlural : names.majorArSingle;
    const majorTxt = `${intToArabicWords(major)} ${majorUnit}`;
    if (minor <= 0) {
      return `${prefix}فقط ${majorTxt} لا غير`;
    }
    const minorUnit = minor >= 3 && minor <= 10 ? names.minorArPlural : names.minorArSingle;
    return `${prefix}فقط ${majorTxt} و${intToArabicWords(minor)} ${minorUnit} لا غير`;
  }

  const majorUnit = major === 1 ? names.majorEnSingle : names.majorEnPlural;
  const majorTxt = `${intToEnglishWords(major)} ${majorUnit}`;
  if (minor <= 0) {
    return `${prefix}${majorTxt} Only`;
  }
  const minorUnit = minor === 1 ? names.minorEnSingle : names.minorEnPlural;
  return `${prefix}${majorTxt} and ${intToEnglishWords(minor)} ${minorUnit} Only`;
}
