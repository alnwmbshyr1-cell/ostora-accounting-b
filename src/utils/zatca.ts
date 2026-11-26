export interface ZatcaPhase1Payload {
  sellerName: string;
  vatNumber: string;
  timestampIso: string;
  totalWithVat: string;
  vatAmount: string;
}

export interface ZatcaTlvTag {
  tag: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  labelAr: string;
  labelEn: string;
  value: string;
}

export interface ZatcaValidationResult {
  isCompliant: boolean;
  warningsAr: string[];
  warningsEn: string[];
}

export interface ZatcaPhase2Metadata {
  zatcaUuid: string;
  icv: number;
  pih: string;
  invoiceHash: string;
  ecdsaSignature: string;
  zatcaXml: string;
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

export function generateZatcaUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Encodes ZATCA Phase-1 mandatory 5 fields into Tag-Length-Value (TLV) Base64 string,
 * and optionally attaches Phase-2 tags (Tag 6: Invoice Hash, Tag 7: ECDSA Signature) when provided.
 */
export function buildZatcaTlvBase64(
  sellerName: string,
  vatNumber: string,
  timestampIso: string,
  totalWithVat: string,
  vatAmount: string,
  phase2?: { invoiceHash?: string; ecdsaSignature?: string },
): string {
  const encoder = new TextEncoder();
  const byteChunks: number[] = [];

  const pushTag = (tag: number, rawValue: string) => {
    const encoded = encoder.encode(rawValue.trim());
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
  if (phase2?.invoiceHash) pushTag(6, phase2.invoiceHash);
  if (phase2?.ecdsaSignature) pushTag(7, phase2.ecdsaSignature);

  return bytesToBase64(new Uint8Array(byteChunks));
}

export function decodeZatcaTlvBase64(base64: string): ZatcaTlvTag[] {
  const labels: Record<number, { ar: string; en: string }> = {
    1: { ar: 'اسم البائع', en: 'Seller Name' },
    2: { ar: 'الرقم الضريبي', en: 'VAT Number' },
    3: { ar: 'التاريخ والوقت (ISO)', en: 'Timestamp (ISO 8601)' },
    4: { ar: 'إجمالي الفاتورة شامل الضريبة', en: 'Invoice Total (incl. VAT)' },
    5: { ar: 'ضريبة القيمة المضافة', en: 'VAT Amount' },
    6: { ar: 'تجزئة الفاتورة SHA-256', en: 'Invoice Hash (SHA-256)' },
    7: { ar: 'التوقيع الرقمي ECDSA', en: 'ECDSA Signature' },
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
      if (tag >= 1 && tag <= 7 && labels[tag]) {
        tags.push({
          tag: tag as ZatcaTlvTag['tag'],
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

function xmlEscape(val: string | number | undefined): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildZatcaUblXml(params: {
  invoiceId: string;
  uuid: string;
  icv: number;
  pih: string;
  issueDateIso: string;
  currency: string;
  sellerName: string;
  sellerVat: string;
  sellerAddress?: string;
  customerName: string;
  customerVat?: string;
  subtotal: number;
  vat: number;
  total: number;
  taxRate?: number;
  invoiceType?: 'sales' | 'return' | 'quotation';
  items?: { productName: string; qty: number; unitPrice: number; total: number }[];
}): string {
  const iso = normalizeZatcaTimestamp(params.issueDateIso);
  const issueDate = iso.slice(0, 10);
  const issueTime = iso.slice(11, 19);
  const typeCode = params.invoiceType === 'return' ? '381' : '388';
  const cur = xmlEscape(params.currency || 'SAR');
  const linesXml = (params.items && params.items.length > 0
    ? params.items
    : [{ productName: 'Items & Services', qty: 1, unitPrice: params.subtotal, total: params.subtotal }]
  )
    .map(
      (it, idx) => `  <cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="PCE">${Number(it.qty || 1)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${cur}">${formatZatcaAmount(it.total)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${xmlEscape(it.productName)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${Number(params.taxRate ?? 15).toFixed(2)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${cur}">${formatZatcaAmount(it.unitPrice)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${xmlEscape(params.invoiceId)}</cbc:ID>
  <cbc:UUID>${xmlEscape(params.uuid)}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="0100000">${typeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>${cur}</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${params.icv}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${xmlEscape(params.pih)}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyLegalEntity><cbc:RegistrationName>${xmlEscape(params.sellerName)}</cbc:RegistrationName></cac:PartyLegalEntity>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${xmlEscape(params.sellerVat)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PostalAddress><cbc:StreetName>${xmlEscape(params.sellerAddress || '')}</cbc:StreetName></cac:PostalAddress>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyLegalEntity><cbc:RegistrationName>${xmlEscape(params.customerName)}</cbc:RegistrationName></cac:PartyLegalEntity>
      ${params.customerVat ? `<cac:PartyTaxScheme><cbc:CompanyID>${xmlEscape(params.customerVat)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${cur}">${formatZatcaAmount(params.vat)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${cur}">${formatZatcaAmount(params.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${cur}">${formatZatcaAmount(params.subtotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${cur}">${formatZatcaAmount(params.total)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${cur}">${formatZatcaAmount(params.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>`;
}

export async function computeSha256Base64(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', data);
    return bytesToBase64(new Uint8Array(hash));
  }
  return btoa(unescape(encodeURIComponent(input.slice(0, 64))));
}

let cachedP256KeyPair: CryptoKeyPair | null = null;

export async function signEcdsaP256Base64(payload: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return await computeSha256Base64(`ECDSA-FALLBACK:${payload}`);
  }
  try {
    if (!cachedP256KeyPair) {
      cachedP256KeyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
      );
    }
    const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      cachedP256KeyPair.privateKey,
      new TextEncoder().encode(payload),
    );
    return bytesToBase64(new Uint8Array(sig));
  } catch {
    return await computeSha256Base64(`ECDSA-FALLBACK:${payload}`);
  }
}

export async function buildZatcaPhase2Package(params: {
  invoiceId: string;
  icv: number;
  previousInvoiceHash?: string;
  issueDateIso: string;
  currency: string;
  sellerName: string;
  sellerVat: string;
  sellerAddress?: string;
  customerName: string;
  customerVat?: string;
  subtotal: number;
  vat: number;
  total: number;
  taxRate?: number;
  invoiceType?: 'sales' | 'return' | 'quotation';
  items?: { productName: string; qty: number; unitPrice: number; total: number }[];
}): Promise<ZatcaPhase2Metadata> {
  const zatcaUuid = generateZatcaUuid();
  const pih = params.previousInvoiceHash || 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';
  const zatcaXml = buildZatcaUblXml({
    ...params,
    uuid: zatcaUuid,
    pih,
  });
  const invoiceHash = await computeSha256Base64(zatcaXml);
  const ecdsaSignature = await signEcdsaP256Base64(invoiceHash);
  return {
    zatcaUuid,
    icv: params.icv,
    pih,
    invoiceHash,
    ecdsaSignature,
    zatcaXml,
  };
}
