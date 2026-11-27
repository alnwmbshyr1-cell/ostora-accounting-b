import { describe, expect, it } from 'vitest';
import {
  buildVoidReversalJournal,
  computeStatementsFromJournals,
  computeTrialBalanceFromJournals,
  computeUnifiedNetProfit,
  DEFAULT_CHART_OF_ACCOUNTS,
} from '../accounting';
import {
  calcLineNetHalalas,
  fromHalalas,
  getCurrencyMinorFactor,
  isBalancedJournalHalalas,
  mulFxHalalas,
  toHalalas,
} from '../halala';
import { DEFAULT_PERMISSIONS_MATRIX } from '../../constants/permissions';
import { PersistedState } from '../../types/erp';
import { numberToWordsTafqeet } from '../../utils/tafqeet';
import {
  buildZatcaTlvBase64,
  buildZatcaUblXml,
  decodeZatcaTlvBase64,
  validateZatcaPhase1,
} from '../../utils/zatca';

function makeTestState(): PersistedState {
  return {
    onboardingSeen: true,
    isLoggedIn: true,
    currentRole: 'owner',
    activePlan: 'enterprise',
    trialStartIso: '2026-01-01T00:00:00Z',
    settings: {
      companyName: 'Ostora Systems',
      taxNumber: '310482910400003',
      crNumber: '1010592831',
      phone: '0501234567',
      email: 'finance@ostora.systems',
      address: 'Riyadh',
      currency: 'SAR',
      displayCurrency: 'SAR',
      isArabic: true,
      isDarkMode: false,
      monthlySalesGoal: 120000,
      defaultSalesTaxRate: 15,
      defaultPurchaseTaxRate: 15,
      autoBackupDaily: true,
    },
    permissionsMatrix: DEFAULT_PERMISSIONS_MATRIX,
    invoices: [],
    recurringInvoices: [],
    returns: [],
    quotations: [],
    customers: [],
    suppliers: [],
    purchaseOrders: [],
    vouchers: [],
    journals: [],
    documents: [],
    products: [],
    employees: [],
    expenses: [],
    banks: [],
    branches: [],
    warehouses: [],
    chartOfAccounts: DEFAULT_CHART_OF_ACCOUNTS,
    stockMovements: [],
    stocktakes: [],
    auditLogs: [],
  };
}

describe('Currency-Aware Halala Integer Arithmetic', () => {
  it('detects 0, 2, and 3 decimal minor unit factors accurately', () => {
    expect(getCurrencyMinorFactor('SAR')).toBe(100);
    expect(getCurrencyMinorFactor('USD')).toBe(100);
    expect(getCurrencyMinorFactor('KWD')).toBe(1000);
    expect(getCurrencyMinorFactor('BHD')).toBe(1000);
    expect(getCurrencyMinorFactor('OMR')).toBe(1000);
    expect(getCurrencyMinorFactor('JPY')).toBe(1);
  });

  it('eliminates 0.1 + 0.2 floating-point drift in minor units', () => {
    const a = toHalalas(0.1, 'SAR');
    const b = toHalalas(0.2, 'SAR');
    expect(a + b).toBe(30);
    expect(fromHalalas(a + b, 'SAR')).toBe(0.3);

    const kwdMinor = toHalalas(12.345, 'KWD');
    expect(kwdMinor).toBe(12345);
    expect(fromHalalas(kwdMinor, 'KWD')).toBe(12.345);

    const jpyMinor = toHalalas(1500, 'JPY');
    expect(jpyMinor).toBe(1500);
    expect(fromHalalas(jpyMinor, 'JPY')).toBe(1500);
  });

  it('converts across currencies with different decimal places cleanly', () => {
    const sarHalalas = mulFxHalalas(toHalalas(10, 'KWD'), 12.22, 'KWD', 'SAR');
    expect(fromHalalas(sarHalalas, 'SAR')).toBe(122.2);

    const jpyToSarH = mulFxHalalas(toHalalas(1000, 'JPY'), 0.025, 'JPY', 'SAR');
    expect(fromHalalas(jpyToSarH, 'SAR')).toBe(25);
  });

  it('computes line net, discount, and 15% VAT in integer Halalas', () => {
    const res = calcLineNetHalalas(2, 100, 10, 15, 'SAR');
    expect(res.grossH).toBe(20000);
    expect(res.discountH).toBe(2000);
    expect(res.netH).toBe(18000);
    expect(res.taxH).toBe(2700);
    expect(res.totalH).toBe(20700);
  });
});

describe('Unified Net Profit & Double-Entry Statements', () => {
  it('computes net profit consistently as Revenue (Excl. VAT) - COGS - Operating Expenses', () => {
    const state = makeTestState();
    state.products = [
      { id: 'P1', name: 'POS Terminal', sku: 'POS-1', barcode: '6281001000001', qty: 10, cost: 400, price: 1000 },
    ];
    state.invoices = [
      {
        id: 'INV-1',
        customerId: 'C1',
        customerName: 'Alpha Co',
        customerPhone: '0500000001',
        description: 'Sale',
        items: [{ productId: 'P1', productName: 'POS Terminal', qty: 2, unitPrice: 1000, total: 2000, costPrice: 400 }],
        subtotal: 2000,
        vat: 300,
        total: 2300,
        status: 'paid',
        date: '2026-05-01',
        invoiceType: 'sales',
      },
      {
        id: 'INV-DRAFT',
        customerId: 'C1',
        customerName: 'Draft Co',
        customerPhone: '0500000001',
        description: 'Ignored draft',
        subtotal: 5000,
        vat: 750,
        total: 5750,
        status: 'draft',
        date: '2026-05-02',
        invoiceType: 'sales',
      },
    ];
    state.expenses = [
      {
        id: 'EXP-1',
        title: 'Rent',
        category: 'Rent',
        amount: 575,
        vatInput: 75,
        paidFromBankId: 'cash',
        status: 'paid',
        date: '2026-05-03',
      },
    ];

    const summary = computeUnifiedNetProfit(state);
    expect(summary.revenueExVat).toBe(2000);
    expect(summary.cogs).toBe(800);
    expect(summary.operatingExpenses).toBe(500);
    expect(summary.netProfit).toBe(700);
  });

  it('builds balanced Trial Balance, Financial Statements, and detects unbalanced journals', () => {
    const state = makeTestState();
    state.journals = [
      {
        id: 'J-1',
        reference: 'OPEN',
        description: 'Owner capital injection',
        date: '2026-01-01',
        entryType: 'manual',
        status: 'approved',
        lines: [
          { account: '1010 - Cash & Banks', debit: 50000, credit: 0 },
          { account: '3010 - Owner Capital', debit: 0, credit: 50000 },
        ],
      },
      {
        id: 'J-2',
        reference: 'SALE-1',
        description: 'Cash sale',
        date: '2026-01-05',
        entryType: 'auto',
        status: 'approved',
        lines: [
          { account: '1010 - Cash & Banks', debit: 1150, credit: 0 },
          { account: '4010 - Sales Revenue', debit: 0, credit: 1000 },
          { account: '2020 - Output VAT Payable', debit: 0, credit: 150 },
        ],
      },
    ];

    const tb = computeTrialBalanceFromJournals(state.journals);
    expect(tb.isBalanced).toBe(true);
    expect(tb.totalDebit).toBe(51150);
    expect(tb.totalCredit).toBe(51150);

    const statements = computeStatementsFromJournals(state);
    expect(statements.unbalancedJournals).toHaveLength(0);
    expect(statements.assetsTotal).toBe(51150);
    expect(statements.liabilitiesTotal).toBe(150);
    expect(statements.equityTotal).toBe(50000);
    expect(statements.netIncome).toBe(1000);
    expect(statements.balanceSheetBalanced).toBe(true);
  });

  it('generates an exact balanced Void & Reversal journal', () => {
    const rev = buildVoidReversalJournal({
      reversalId: 'JRN-REV-1',
      reference: 'INV-100',
      description: 'Void INV-100',
      date: '2026-05-10',
      originalLines: [
        { account: '1010 - Cash & Banks', debit: 1150, credit: 0 },
        { account: '4010 - Sales Revenue', debit: 0, credit: 1000 },
        { account: '2020 - Output VAT Payable', debit: 0, credit: 150 },
      ],
    });
    expect(rev.reference).toBe('REV-INV-100');
    const bal = isBalancedJournalHalalas(rev.lines);
    expect(bal.balanced).toBe(true);
    expect(bal.totalDebitH).toBe(115000);
    expect(rev.lines[0].credit).toBe(1150);
    expect(rev.lines[1].debit).toBe(1000);
  });
});

describe('ZATCA Phase 1 & 2 Compliance and Tafqeet', () => {
  it('validates 15-digit Saudi VAT number and round-trips TLV QR tags', () => {
    expect(validateZatcaPhase1('Ostora Co', '310482910400003').isCompliant).toBe(true);
    expect(validateZatcaPhase1('Ostora Co', '12345').isCompliant).toBe(false);

    const tlv = buildZatcaTlvBase64(
      'Ostora Trading',
      '310482910400003',
      '2026-05-10T10:30:00Z',
      '1150.00',
      '150.00',
    );
    const decoded = decodeZatcaTlvBase64(tlv);
    expect(decoded).toHaveLength(5);
    expect(decoded.find((d) => d.tag === 1)?.value).toBe('Ostora Trading');
    expect(decoded.find((d) => d.tag === 2)?.value).toBe('310482910400003');
    expect(decoded.find((d) => d.tag === 4)?.value).toBe('1150.00');
    expect(decoded.find((d) => d.tag === 5)?.value).toBe('150.00');
  });

  it('builds valid ZATCA UBL 2.1 XML invoice payload', () => {
    const xml = buildZatcaUblXml({
      invoiceId: 'INV-900',
      uuid: '11111111-2222-4333-8444-555555555555',
      icv: 9,
      pih: 'BASE64PIH==',
      issueDateIso: '2026-05-10T12:00:00Z',
      currency: 'SAR',
      sellerName: 'Ostora & Sons',
      sellerVat: '310482910400003',
      customerName: 'Alpha Client',
      subtotal: 1000,
      vat: 150,
      total: 1150,
    });
    expect(xml).toContain('<cbc:ID>INV-900</cbc:ID>');
    expect(xml).toContain('Ostora &amp; Sons');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="SAR">1150.00</cbc:TaxInclusiveAmount>');
  });

  it('converts amounts to Arabic and English Tafqeet words across decimal precisions', () => {
    const arText = numberToWordsTafqeet(1250.5, 'SAR', 'ar');
    expect(arText).toContain('ريال سعودي');
    expect(arText).toContain('هللة');

    const enKwd = numberToWordsTafqeet(10.25, 'KWD', 'en');
    expect(enKwd).toContain('Kuwaiti Dinars');
    expect(enKwd).toContain('Two Hundred Fifty Fils');

    const enJpy = numberToWordsTafqeet(1500, 'JPY', 'en');
    expect(enJpy).toContain('Japanese Yen Only');
  });
});
