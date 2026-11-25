import { Customer, PersistedState, Product, Supplier } from '../types/erp';
import { generateEan13 } from './barcode';
import { parseCsvRows } from './csvImport';

export type ImportEntityType = 'customers' | 'suppliers' | 'products';

export type ImportRowStatus = 'valid' | 'warning' | 'error';

export type ValidatedImportPayload =
  | { entity: 'customers'; record: Omit<Customer, 'id'> }
  | { entity: 'suppliers'; record: Omit<Supplier, 'id'> }
  | { entity: 'products'; record: Omit<Product, 'id'> };

export interface ValidatedImportRow {
  rowNumber: number;
  status: ImportRowStatus;
  isDuplicate: boolean;
  messagesAr: string[];
  messagesEn: string[];
  summaryTitle: string;
  summaryMeta: string;
  payload?: ValidatedImportPayload;
}

export interface DataImportValidationResult {
  entity: ImportEntityType;
  format: 'json' | 'csv' | 'unknown';
  parseErrorAr?: string;
  parseErrorEn?: string;
  rows: ValidatedImportRow[];
  validCount: number;
  warningCount: number;
  errorCount: number;
  duplicateCount: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function parseFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function strVal(val: unknown): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function detectFormat(rawText: string, fileName?: string): 'json' | 'csv' | 'unknown' {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return 'unknown';
  if (fileName?.toLowerCase().endsWith('.json')) return 'json';
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json';
  return 'csv';
}

function extractJsonArray(rawText: string, entity: ImportEntityType): Record<string, unknown>[] {
  const parsed = JSON.parse(rawText.replace(/^\uFEFF/, '')) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object');
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const candidate = obj[entity] ?? obj.items ?? obj.data ?? obj.records;
    if (Array.isArray(candidate)) {
      return candidate.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object');
    }
  }
  throw new Error('INVALID_JSON_SHAPE');
}

function csvToRawObjects(
  rawText: string,
  entity: ImportEntityType,
): Record<string, string>[] {
  const rows = parseCsvRows(rawText);
  if (rows.length === 0) return [];

  const firstNormalized = rows[0].map(normalizeHeader);
  const headerTokensByEntity: Record<ImportEntityType, string[]> = {
    customers: ['name', 'customer', 'customername', 'fullname', 'phone', 'email', 'debt', 'creditlimit', 'الاسم', 'العميل', 'الجوال', 'البريد', 'الرصيد', 'الحدالائتماني'],
    suppliers: ['name', 'supplier', 'suppliername', 'phone', 'category', 'payable', 'الاسم', 'المورد', 'الجوال', 'التصنيف', 'المستحقات'],
    products: ['name', 'product', 'productname', 'sku', 'barcode', 'qty', 'quantity', 'cost', 'price', 'الاسم', 'الصنف', 'رمزالصف', 'الباركود', 'الكمية', 'التكلفة', 'السعر'],
  };

  const hasHeader = firstNormalized.some((h) => headerTokensByEntity[entity].includes(h));
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const findCol = (aliases: string[]) => firstNormalized.findIndex((h) => aliases.includes(h));

  if (entity === 'customers') {
    const nameIdx = hasHeader ? findCol(['name', 'customer', 'customername', 'fullname', 'الاسم', 'العميل', 'اسمالعميل']) : -1;
    const phoneIdx = hasHeader ? findCol(['phone', 'mobile', 'tel', 'الجوال', 'رقمالجوال', 'الهاتف']) : -1;
    const emailIdx = hasHeader ? findCol(['email', 'mail', 'البريد', 'البريدالإلكتروني']) : -1;
    const debtIdx = hasHeader ? findCol(['debt', 'balance', 'balancedue', 'due', 'الرصيد', 'الرصيدالمستحق', 'المديونية']) : -1;
    const limitIdx = hasHeader ? findCol(['creditlimit', 'limit', 'maxdebt', 'الحدالائتماني', 'حدالائتمان']) : -1;

    return dataRows.map((r) => {
      if (hasHeader) {
        return {
          name: (nameIdx >= 0 ? r[nameIdx] : r[0]) ?? '',
          phone: (phoneIdx >= 0 ? r[phoneIdx] : r[1]) ?? '',
          email: (emailIdx >= 0 ? r[emailIdx] : r[2]) ?? '',
          debt: (debtIdx >= 0 ? r[debtIdx] : r[3]) ?? '',
          creditLimit: (limitIdx >= 0 ? r[limitIdx] : r[4]) ?? '',
        };
      }
      if (r.length >= 5 && /^C-\d+/i.test(r[0])) {
        return { name: r[1] ?? '', phone: r[2] ?? '', email: r[3] ?? '', debt: r[4] ?? '', creditLimit: r[5] ?? '' };
      }
      return { name: r[0] ?? '', phone: r[1] ?? '', email: r[2] ?? '', debt: r[3] ?? '', creditLimit: r[4] ?? '' };
    });
  }

  if (entity === 'suppliers') {
    const nameIdx = hasHeader ? findCol(['name', 'supplier', 'suppliername', 'fullname', 'الاسم', 'المورد', 'اسمالشركة']) : -1;
    const phoneIdx = hasHeader ? findCol(['phone', 'mobile', 'tel', 'الجوال', 'رقمالجوال', 'الهاتف']) : -1;
    const catIdx = hasHeader ? findCol(['category', 'type', 'sector', 'التصنيف', 'النشاط', 'الفئة']) : -1;
    const payIdx = hasHeader ? findCol(['payable', 'balance', 'due', 'debt', 'المستحقات', 'الرصيد', 'المديونية']) : -1;

    return dataRows.map((r) => {
      if (hasHeader) {
        return {
          name: (nameIdx >= 0 ? r[nameIdx] : r[0]) ?? '',
          phone: (phoneIdx >= 0 ? r[phoneIdx] : r[1]) ?? '',
          category: (catIdx >= 0 ? r[catIdx] : r[2]) ?? '',
          payable: (payIdx >= 0 ? r[payIdx] : r[3]) ?? '',
        };
      }
      if (r.length >= 5 && /^S-\d+/i.test(r[0])) {
        return { name: r[1] ?? '', phone: r[2] ?? '', category: r[3] ?? '', payable: r[4] ?? '' };
      }
      return { name: r[0] ?? '', phone: r[1] ?? '', category: r[2] ?? '', payable: r[3] ?? '' };
    });
  }

  const nameIdx = hasHeader ? findCol(['name', 'product', 'productname', 'title', 'الاسم', 'الصنف', 'اسمالصنف']) : -1;
  const skuIdx = hasHeader ? findCol(['sku', 'code', 'رمزالصف', 'رمزالمنتج', 'الكود']) : -1;
  const barcodeIdx = hasHeader ? findCol(['barcode', 'ean', 'ean13', 'الباركود']) : -1;
  const qtyIdx = hasHeader ? findCol(['qty', 'quantity', 'stock', 'الكمية', 'المخزون']) : -1;
  const costIdx = hasHeader ? findCol(['cost', 'unitcost', 'التكلفة']) : -1;
  const priceIdx = hasHeader ? findCol(['price', 'sellprice', 'unitprice', 'السعر', 'سعرالبيع']) : -1;

  return dataRows.map((r) => {
    if (hasHeader) {
      return {
        name: (nameIdx >= 0 ? r[nameIdx] : r[0]) ?? '',
        sku: (skuIdx >= 0 ? r[skuIdx] : r[1]) ?? '',
        barcode: (barcodeIdx >= 0 ? r[barcodeIdx] : r[2]) ?? '',
        qty: (qtyIdx >= 0 ? r[qtyIdx] : r[3]) ?? '',
        cost: (costIdx >= 0 ? r[costIdx] : r[4]) ?? '',
        price: (priceIdx >= 0 ? r[priceIdx] : r[5]) ?? '',
      };
    }
    if (r.length >= 7 && /^P-\d+/i.test(r[0])) {
      return { name: r[1] ?? '', sku: r[2] ?? '', barcode: r[3] ?? '', qty: r[4] ?? '', cost: r[5] ?? '', price: r[6] ?? '' };
    }
    return { name: r[0] ?? '', sku: r[1] ?? '', barcode: r[2] ?? '', qty: r[3] ?? '', cost: r[4] ?? '', price: r[5] ?? '' };
  });
}

export function validateBulkImportData(
  rawText: string,
  entity: ImportEntityType,
  existingState: Pick<PersistedState, 'customers' | 'suppliers' | 'products'>,
  fileName?: string,
): DataImportValidationResult {
  const format = detectFormat(rawText, fileName);
  if (format === 'unknown') {
    return {
      entity,
      format,
      parseErrorAr: 'الملف أو النص فارغ.',
      parseErrorEn: 'The uploaded file or text is empty.',
      rows: [],
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
      duplicateCount: 0,
    };
  }

  let rawObjects: Record<string, unknown>[] = [];
  try {
    if (format === 'json') {
      rawObjects = extractJsonArray(rawText, entity);
    } else {
      rawObjects = csvToRawObjects(rawText, entity);
    }
  } catch {
    return {
      entity,
      format,
      parseErrorAr:
        format === 'json'
          ? 'صيغة JSON غير صالحة. تأكد من إدخال مصفوفة من السجلات [...]'
          : 'تعذر تحليل صفوف CSV.',
      parseErrorEn:
        format === 'json'
          ? 'Invalid JSON format. Provide an array of records [...] or an object containing items.'
          : 'Could not parse CSV rows.',
      rows: [],
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
      duplicateCount: 0,
    };
  }

  if (rawObjects.length === 0) {
    return {
      entity,
      format,
      parseErrorAr: 'لم يتم العثور على أي صفوف بيانات للاستيراد.',
      parseErrorEn: 'No data rows were found to import.',
      rows: [],
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
      duplicateCount: 0,
    };
  }

  const rows: ValidatedImportRow[] = [];
  const seenCustKeys = new Set(existingState.customers.map((c) => c.name.trim().toLowerCase()));
  const seenSupKeys = new Set(existingState.suppliers.map((s) => s.name.trim().toLowerCase()));
  const seenProdNames = new Set(existingState.products.map((p) => p.name.trim().toLowerCase()));
  const seenProdSkus = new Set(existingState.products.map((p) => p.sku.trim().toLowerCase()).filter(Boolean));

  rawObjects.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    const messagesAr: string[] = [];
    const messagesEn: string[] = [];
    let hasError = false;
    let isDuplicate = false;

    if (entity === 'customers') {
      const name = strVal(raw.name ?? raw.customerName ?? raw.fullName);
      const phone = strVal(raw.phone ?? raw.mobile);
      const email = strVal(raw.email ?? raw.mail);
      const rawDebt = raw.debt ?? raw.balance;
      const rawLimit = raw.creditLimit ?? raw.limit;

      if (!name) {
        hasError = true;
        messagesAr.push('اسم العميل مطلوب');
        messagesEn.push('Customer name is required');
      } else if (name.length > 160) {
        hasError = true;
        messagesAr.push('الاسم يتجاوز 160 حرفاً');
        messagesEn.push('Name exceeds 160 characters');
      }

      if (phone.length > 40) {
        hasError = true;
        messagesAr.push('رقم الجوال يتجاوز 40 حرفاً');
        messagesEn.push('Phone exceeds 40 characters');
      }

      if (email.length > 160) {
        hasError = true;
        messagesAr.push('البريد الإلكتروني يتجاوز 160 حرفاً');
        messagesEn.push('Email exceeds 160 characters');
      } else if (email && !EMAIL_RE.test(email)) {
        hasError = true;
        messagesAr.push('صيغة البريد الإلكتروني غير صحيحة');
        messagesEn.push('Invalid email format');
      }

      let debt = 0;
      if (strVal(rawDebt) !== '') {
        const parsedDebt = parseFiniteNumber(rawDebt);
        if (parsedDebt === null || parsedDebt < 0) {
          hasError = true;
          messagesAr.push('الرصيد المستحق يجب أن يكون رقماً موجباً أو صفراً');
          messagesEn.push('Debt must be a non-negative number');
        } else {
          debt = Number(parsedDebt.toFixed(2));
        }
      }

      let creditLimit: number | undefined;
      if (strVal(rawLimit) !== '') {
        const parsedLimit = parseFiniteNumber(rawLimit);
        if (parsedLimit === null || parsedLimit < 0) {
          hasError = true;
          messagesAr.push('الحد الائتماني يجب أن يكون رقماً موجباً أو صفراً');
          messagesEn.push('Credit limit must be a non-negative number');
        } else {
          creditLimit = Number(parsedLimit.toFixed(2));
        }
      }

      const normKey = name.toLowerCase();
      if (name && seenCustKeys.has(normKey)) {
        isDuplicate = true;
        messagesAr.push('اسم عميل مكرر (موجود مسبقاً أو مكرر بالملف)');
        messagesEn.push('Duplicate customer name (already exists or repeated in file)');
      } else if (name && !hasError) {
        seenCustKeys.add(normKey);
      }

      const status: ImportRowStatus = hasError
        ? 'error'
        : isDuplicate || messagesAr.length > 0
        ? 'warning'
        : 'valid';

      rows.push({
        rowNumber,
        status,
        isDuplicate,
        messagesAr,
        messagesEn,
        summaryTitle: name || (hasError ? `#${rowNumber}` : ''),
        summaryMeta: `${phone || '—'} · ${debt.toLocaleString()}${creditLimit !== undefined ? ` / Limit ${creditLimit.toLocaleString()}` : ''}`,
        payload: hasError
          ? undefined
          : {
              entity: 'customers',
              record: {
                name,
                phone,
                email,
                debt,
                ...(creditLimit !== undefined ? { creditLimit } : {}),
              },
            },
      });
      return;
    }

    if (entity === 'suppliers') {
      const name = strVal(raw.name ?? raw.supplierName);
      const phone = strVal(raw.phone ?? raw.mobile);
      const category = strVal(raw.category ?? raw.sector);
      const rawPayable = raw.payable ?? raw.balance ?? raw.debt;

      if (!name) {
        hasError = true;
        messagesAr.push('اسم المورد مطلوب');
        messagesEn.push('Supplier name is required');
      } else if (name.length > 160) {
        hasError = true;
        messagesAr.push('الاسم يتجاوز 160 حرفاً');
        messagesEn.push('Name exceeds 160 characters');
      }

      if (phone.length > 40) {
        hasError = true;
        messagesAr.push('رقم الجوال يتجاوز 40 حرفاً');
        messagesEn.push('Phone exceeds 40 characters');
      }

      if (category.length > 100) {
        hasError = true;
        messagesAr.push('التصنيف يتجاوز 100 حرف');
        messagesEn.push('Category exceeds 100 characters');
      }

      let payable = 0;
      if (strVal(rawPayable) !== '') {
        const parsedPayable = parseFiniteNumber(rawPayable);
        if (parsedPayable === null || parsedPayable < 0) {
          hasError = true;
          messagesAr.push('المستحقات يجب أن تكون رقماً موجباً أو صفراً');
          messagesEn.push('Payable amount must be non-negative');
        } else {
          payable = Number(parsedPayable.toFixed(2));
        }
      }

      const normKey = name.toLowerCase();
      if (name && seenSupKeys.has(normKey)) {
        isDuplicate = true;
        messagesAr.push('اسم مورد مكرر');
        messagesEn.push('Duplicate supplier name');
      } else if (name && !hasError) {
        seenSupKeys.add(normKey);
      }

      const status: ImportRowStatus = hasError
        ? 'error'
        : isDuplicate || messagesAr.length > 0
        ? 'warning'
        : 'valid';

      rows.push({
        rowNumber,
        status,
        isDuplicate,
        messagesAr,
        messagesEn,
        summaryTitle: name || `#${rowNumber}`,
        summaryMeta: `${category || '—'} · ${phone || '—'} · ${payable.toLocaleString()}`,
        payload: hasError
          ? undefined
          : {
              entity: 'suppliers',
              record: {
                name,
                phone,
                category,
                payable,
              },
            },
      });
      return;
    }

    // products
    const name = strVal(raw.name ?? raw.productName ?? raw.title);
    const rawSku = strVal(raw.sku ?? raw.code);
    const sku = rawSku || `SKU-${100 + rowNumber}`;
    const rawBarcode = strVal(raw.barcode ?? raw.ean);
    const barcode = rawBarcode || generateEan13();

    if (!name) {
      hasError = true;
      messagesAr.push('اسم الصنف مطلوب');
      messagesEn.push('Product name is required');
    } else if (name.length > 160) {
      hasError = true;
      messagesAr.push('الاسم يتجاوز 160 حرفاً');
      messagesEn.push('Name exceeds 160 characters');
    }

    if (sku.length > 64) {
      hasError = true;
      messagesAr.push('رمز الصنف SKU يتجاوز 64 حرفاً');
      messagesEn.push('SKU exceeds 64 characters');
    }

    if (barcode.length > 64) {
      hasError = true;
      messagesAr.push('الباركود يتجاوز 64 حرفاً');
      messagesEn.push('Barcode exceeds 64 characters');
    }

    let qty = 0;
    if (strVal(raw.qty ?? raw.quantity ?? raw.stock) !== '') {
      const parsedQty = parseFiniteNumber(raw.qty ?? raw.quantity ?? raw.stock);
      if (parsedQty === null || parsedQty < 0) {
        hasError = true;
        messagesAr.push('الكمية يجب أن تكون رقماً موجباً أو صفراً');
        messagesEn.push('Quantity must be a non-negative integer');
      } else {
        qty = Math.round(parsedQty);
      }
    }

    let cost = 0;
    if (strVal(raw.cost ?? raw.unitCost) !== '') {
      const parsedCost = parseFiniteNumber(raw.cost ?? raw.unitCost);
      if (parsedCost === null || parsedCost < 0) {
        hasError = true;
        messagesAr.push('التكلفة يجب أن تكون رقماً موجباً أو صفراً');
        messagesEn.push('Cost must be non-negative');
      } else {
        cost = Number(parsedCost.toFixed(2));
      }
    }

    let price = 0;
    if (strVal(raw.price ?? raw.sellPrice ?? raw.unitPrice) !== '') {
      const parsedPrice = parseFiniteNumber(raw.price ?? raw.sellPrice ?? raw.unitPrice);
      if (parsedPrice === null || parsedPrice < 0) {
        hasError = true;
        messagesAr.push('سعر البيع يجب أن يكون رقماً موجباً أو صفراً');
        messagesEn.push('Price must be non-negative');
      } else {
        price = Number(parsedPrice.toFixed(2));
      }
    }

    if (!hasError && price > 0 && cost > price) {
      messagesAr.push('تنبيه: سعر البيع أقل من التكلفة');
      messagesEn.push('Warning: sell price is lower than unit cost');
    }

    const normName = name.toLowerCase();
    const normSku = sku.toLowerCase();
    if ((name && seenProdNames.has(normName)) || (rawSku && seenProdSkus.has(normSku))) {
      isDuplicate = true;
      messagesAr.push('صنف أو SKU مكرر');
      messagesEn.push('Duplicate product name or SKU');
    } else if (name && !hasError) {
      seenProdNames.add(normName);
      if (rawSku) seenProdSkus.add(normSku);
    }

    const status: ImportRowStatus = hasError
      ? 'error'
      : isDuplicate || messagesAr.length > 0
      ? 'warning'
      : 'valid';

    rows.push({
      rowNumber,
      status,
      isDuplicate,
      messagesAr,
      messagesEn,
      summaryTitle: name || `#${rowNumber}`,
      summaryMeta: `${sku} · ${qty} pcs · ${price.toLocaleString()}`,
      payload: hasError
        ? undefined
        : {
            entity: 'products',
            record: {
              name,
              sku,
              barcode,
              qty,
              cost,
              price,
            },
          },
    });
  });

  return {
    entity,
    format,
    rows,
    validCount: rows.filter((r) => r.status === 'valid').length,
    warningCount: rows.filter((r) => r.status === 'warning').length,
    errorCount: rows.filter((r) => r.status === 'error').length,
    duplicateCount: rows.filter((r) => r.isDuplicate).length,
  };
}

export function getSampleCsvTemplate(entity: ImportEntityType): string {
  if (entity === 'customers') {
    return [
      'Name,Phone,Email,Debt,CreditLimit',
      '"شركة الأفق التجارية",0501122334,info@ofoq.sa,0,50000',
      '"Al-Noor Retail",0559988776,accounts@alnoor.sa,1200,25000',
    ].join('\n');
  }
  if (entity === 'suppliers') {
    return [
      'Name,Phone,Category,Payable',
      '"مصنع الرواد للتغليف",0543219876,"مواد تعبئة",0',
      '"Gulf Hardware Co.",0564433221,"IT Equipment",3500',
    ].join('\n');
  }
  return [
    'Name,SKU,Barcode,Qty,Cost,Price',
    '"قارئ باركود بلوتوث",SCN-BT1,6281001001118,20,180,320',
    '"Thermal Paper Roll 80mm",TPR-80,6281001002221,150,4,9.5',
  ].join('\n');
}

export function getSampleJsonTemplate(entity: ImportEntityType): string {
  if (entity === 'customers') {
    return JSON.stringify(
      [
        { name: 'شركة الأفق التجارية', phone: '0501122334', email: 'info@ofoq.sa', debt: 0, creditLimit: 50000 },
        { name: 'Al-Noor Retail', phone: '0559988776', email: 'accounts@alnoor.sa', debt: 1200, creditLimit: 25000 },
      ],
      null,
      2,
    );
  }
  if (entity === 'suppliers') {
    return JSON.stringify(
      [
        { name: 'مصنع الرواد للتغليف', phone: '0543219876', category: 'مواد تعبئة', payable: 0 },
        { name: 'Gulf Hardware Co.', phone: '0564433221', category: 'IT Equipment', payable: 3500 },
      ],
      null,
      2,
    );
  }
  return JSON.stringify(
    [
      { name: 'قارئ باركود بلوتوث', sku: 'SCN-BT1', barcode: '6281001001118', qty: 20, cost: 180, price: 320 },
      { name: 'Thermal Paper Roll 80mm', sku: 'TPR-80', barcode: '6281001002221', qty: 150, cost: 4, price: 9.5 },
    ],
    null,
    2,
  );
}
