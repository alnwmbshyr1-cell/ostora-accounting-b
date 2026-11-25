export interface ZatcaPhase1Payload {
  sellerName: string;
  vatNumber: string;
  timestampIso: string;
  totalWithVat: string;
  vatAmount: string;
}

export interface ZatcaTlvTag {
  tag: 1 | 2 | 3 | 4 | 5;
  labelAr: string;
  labelEn: string;
  value: string;
}

export interface ZatcaValidationResult {
  isCompliant: boolean;
  warningsAr: string[];
  warningsEn: string[];
}

export function normalizeZatcaTimestamp(rawDate: string): string {
  const parsed = rawDate ? new Date(rawDate) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  return parsed.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function formatZatcaAmount(value: number | string): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return (Number.isFinite(num) ? Math.max(0, num) : 0).toFixed(2);
}

/**
 * Encodes ZATCA Phase-1 mandatory 5 fields into Tag-Length-Value (TLV) Base64 string:
 * Tag 1: Seller Name
 * Tag 2: Seller VAT Registration Number
 * Tag 3: Invoice Timestamp (ISO 8601)
 * Tag 4: Invoice Total (with VAT)
 * Tag 5: VAT Total
 */
export function buildZatcaTlvBase64(
  sellerName: string,
  vatNumber: string,
  timestampIso: string,
  totalWithVat: string,
  vatAmount: string,
): string {
  const encoder = new TextEncoder();
  const byteChunks: number[] = [];

  const pushTag = (tag: number, rawValue: string) => {
    const encoded = encoder.encode(rawValue.trim());
    // ZATCA Phase-1 uses 1-byte unsigned length (0..255 bytes)
    const bounded = encoded.length > 255 ? encoded.slice(0, 255) : encoded;
    byteChunks.push(tag, bounded.length);
    for (let i = 0; i < bounded.length; i++) {
      byteChunks.push(bounded[i]);
    }
  };

  pushTag(1, sellerName || 'Unknown Seller');
  pushTag(2, vatNumber || '');
  pushTag(3, normalizeZatcaTimestamp(timestampIso));
  pushTag(4, formatZatcaAmount(totalWithVat));
  pushTag(5, formatZatcaAmount(vatAmount));

  let binary = '';
  for (let i = 0; i < byteChunks.length; i++) {
    binary += String.fromCharCode(byteChunks[i]);
  }
  return btoa(binary);
}

export function decodeZatcaTlvBase64(base64: string): ZatcaTlvTag[] {
  const labels: Record<number, { ar: string; en: string }> = {
    1: { ar: 'اسم البائع', en: 'Seller Name' },
    2: { ar: 'الرقم الضريبي', en: 'VAT Number' },
    3: { ar: 'التاريخ والوقت (ISO)', en: 'Timestamp (ISO 8601)' },
    4: { ar: 'إجمالي الفاتورة شامل الضريبة', en: 'Invoice Total (incl. VAT)' },
    5: { ar: 'ضريبة القيمة المضافة', en: 'VAT Amount' },
  };

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const decoder = new TextDecoder();
    const tags: ZatcaTlvTag[] = [];
    let offset = 0;

    while (offset + 2 <= bytes.length) {
      const tag = bytes[offset];
      const len = bytes[offset + 1];
      offset += 2;
      if (offset + len > bytes.length) break;
      const valBytes = bytes.slice(offset, offset + len);
      offset += len;
      if (tag >= 1 && tag <= 5) {
        tags.push({
          tag: tag as 1 | 2 | 3 | 4 | 5,
          labelAr: labels[tag].ar,
          labelEn: labels[tag].en,
          value: decoder.decode(valBytes),
        });
      }
    }
    return tags;
  } catch {
    return [];
  }
}

export function validateZatcaPhase1(
  sellerName: string,
  vatNumber: string,
): ZatcaValidationResult {
  const warningsAr: string[] = [];
  const warningsEn: string[] = [];

  if (!sellerName.trim()) {
    warningsAr.push('اسم المنشأة مطلوب في الإعدادات');
    warningsEn.push('Company / seller name is required in Settings');
  }

  const cleanVat = vatNumber.replace(/\s+/g, '');
  if (!cleanVat) {
    warningsAr.push('الرقم الضريبي غير مسجل');
    warningsEn.push('VAT registration number is missing');
  } else if (!/^\d{15}$/.test(cleanVat)) {
    warningsAr.push('الرقم الضريبي السعودي يتكون من 15 رقماً');
    warningsEn.push('ZATCA VAT numbers are typically 15 digits');
  }

  return {
    isCompliant: warningsAr.length === 0,
    warningsAr,
    warningsEn,
  };
}
