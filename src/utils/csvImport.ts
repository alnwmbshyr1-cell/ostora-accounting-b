import { Customer, Product } from '../types/erp';
import { generateEan13 } from './barcode';

export function parseCsvRows(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== '')) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function toNumber(val: string | undefined, fallback = 0): number {
  if (!val) return fallback;
  const cleaned = val.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

export function parseCustomersCsv(rawText: string): {
  items: Omit<Customer, 'id'>[];
  skipped: number;
} {
  const rows = parseCsvRows(rawText);
  if (rows.length === 0) return { items: [], skipped: 0 };

  const firstNormalized = rows[0].map(normalizeHeader);
  const hasHeader = firstNormalized.some((h) =>
    ['name', 'customer', 'customername', 'fullname', 'phone', 'email', 'debt', 'الاسم', 'العميل', 'الجوال', 'رقمالجوال', 'البريد', 'الرصيد'].includes(h),
  );

  const findCol = (aliases: string[]) =>
    firstNormalized.findIndex((h) => aliases.includes(h));

  const nameIdx = hasHeader ? findCol(['name', 'customer', 'customername', 'fullname', 'الاسم', 'العميل', 'اسمالعميل']) : -1;
  const phoneIdx = hasHeader ? findCol(['phone', 'mobile', 'tel', 'الجوال', 'رقمالجوال', 'الهاتف']) : -1;
  const emailIdx = hasHeader ? findCol(['email', 'mail', 'البريد', 'البريدالإلكتروني']) : -1;
  const debtIdx = hasHeader ? findCol(['debt', 'balance', 'balancedue', 'due', 'الرصيد', 'الرصيدالمستحق', 'المديونية']) : -1;
  const limitIdx = hasHeader ? findCol(['creditlimit', 'limit', 'maxdebt', 'الحدالائتماني', 'حدالائتمان']) : -1;

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const items: Omit<Customer, 'id'>[] = [];
  let skipped = 0;

  for (const r of dataRows) {
    let name = '';
    let phone = '';
    let email = '';
    let debt = 0;
    let rawLimit: string | undefined;

    if (hasHeader) {
      name = (nameIdx >= 0 ? r[nameIdx] : r[0]) ?? '';
      phone = (phoneIdx >= 0 ? r[phoneIdx] : r[1]) ?? '';
      email = (emailIdx >= 0 ? r[emailIdx] : r[2]) ?? '';
      debt = toNumber(debtIdx >= 0 ? r[debtIdx] : r[3], 0);
      rawLimit = limitIdx >= 0 ? r[limitIdx] : r[4];
    } else if (r.length >= 5 && /^C-\d+/i.test(r[0])) {
      // Matches exported format: ID,Name,Phone,Email,Debt[,CreditLimit]
      name = r[1] ?? '';
      phone = r[2] ?? '';
      email = r[3] ?? '';
      debt = toNumber(r[4], 0);
      rawLimit = r[5];
    } else {
      name = r[0] ?? '';
      phone = r[1] ?? '';
      email = r[2] ?? '';
      debt = toNumber(r[3], 0);
      rawLimit = r[4];
    }

    if (!name.trim()) {
      skipped++;
      continue;
    }

    const parsedLimit = rawLimit && rawLimit.trim() !== '' ? toNumber(rawLimit, -1) : -1;

    items.push({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      debt,
      ...(parsedLimit >= 0 ? { creditLimit: parsedLimit } : {}),
    });
  }

  return { items, skipped };
}

export function parseProductsCsv(rawText: string): {
  items: Omit<Product, 'id'>[];
  skipped: number;
} {
  const rows = parseCsvRows(rawText);
  if (rows.length === 0) return { items: [], skipped: 0 };

  const firstNormalized = rows[0].map(normalizeHeader);
  const hasHeader = firstNormalized.some((h) =>
    ['name', 'product', 'productname', 'sku', 'barcode', 'qty', 'quantity', 'cost', 'price', 'الاسم', 'الصنف', 'رمزالصف', 'الباركود', 'الكمية', 'التكلفة', 'السعر'].includes(h),
  );

  const findCol = (aliases: string[]) =>
    firstNormalized.findIndex((h) => aliases.includes(h));

  const nameIdx = hasHeader ? findCol(['name', 'product', 'productname', 'title', 'الاسم', 'الصنف', 'اسمالصنف']) : -1;
  const skuIdx = hasHeader ? findCol(['sku', 'code', 'رمزالصف', 'رمزالمنتج', 'الكود']) : -1;
  const barcodeIdx = hasHeader ? findCol(['barcode', 'ean', 'ean13', 'الباركود']) : -1;
  const qtyIdx = hasHeader ? findCol(['qty', 'quantity', 'stock', 'الكمية', 'المخزون']) : -1;
  const costIdx = hasHeader ? findCol(['cost', 'unitcost', 'التكلفة']) : -1;
  const priceIdx = hasHeader ? findCol(['price', 'sellprice', 'unitprice', 'السعر', 'سعرالبيع']) : -1;

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const items: Omit<Product, 'id'>[] = [];
  let skipped = 0;

  dataRows.forEach((r, idx) => {
    let name = '';
    let sku = '';
    let barcode = '';
    let qty = 0;
    let cost = 0;
    let price = 0;

    if (hasHeader) {
      name = (nameIdx >= 0 ? r[nameIdx] : r[0]) ?? '';
      sku = (skuIdx >= 0 ? r[skuIdx] : r[1]) ?? '';
      barcode = (barcodeIdx >= 0 ? r[barcodeIdx] : r[2]) ?? '';
      qty = Math.round(toNumber(qtyIdx >= 0 ? r[qtyIdx] : r[3], 0));
      cost = toNumber(costIdx >= 0 ? r[costIdx] : r[4], 0);
      price = toNumber(priceIdx >= 0 ? r[priceIdx] : r[5], 0);
    } else if (r.length >= 7 && /^P-\d+/i.test(r[0])) {
      // Matches exported format: ID,Name,SKU,Barcode,Qty,Cost,Price
      name = r[1] ?? '';
      sku = r[2] ?? '';
      barcode = r[3] ?? '';
      qty = Math.round(toNumber(r[4], 0));
      cost = toNumber(r[5], 0);
      price = toNumber(r[6], 0);
    } else {
      name = r[0] ?? '';
      sku = r[1] ?? '';
      barcode = r[2] ?? '';
      qty = Math.round(toNumber(r[3], 0));
      cost = toNumber(r[4], 0);
      price = toNumber(r[5], 0);
    }

    if (!name.trim()) {
      skipped++;
      return;
    }

    items.push({
      name: name.trim(),
      sku: sku.trim() || `SKU-${100 + idx + 1}`,
      barcode: barcode.trim() || generateEan13(),
      qty: Math.max(0, qty),
      cost: Math.max(0, cost),
      price: Math.max(0, price),
    });
  });

  return { items, skipped };
}
