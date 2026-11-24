import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_PERMISSIONS_MATRIX } from '../constants/permissions';
import {
  DailyBackupMeta,
  DailyBackupRecord,
  getDailySnapshot,
  getLatestDailySnapshot,
  getLocalDateKey,
  listDailySnapshotMeta,
  saveDailySnapshot,
} from '../utils/backupDb';
import { generateEan13 } from '../utils/barcode';
import {
  BankAccount,
  CompanySettings,
  Customer,
  Employee,
  Expense,
  Invoice,
  JournalEntry,
  PermissionsMatrix,
  Product,
  PurchaseOrder,
  Quotation,
  ReturnRecord,
  RoleId,
  RouteId,
  SmartAlert,
  Supplier,
  Voucher,
} from '../types/erp';

const STORAGE_KEY = 'ostora_accounting_erp_state_v1';
export const AUTOSAVE_KEY = 'ostora_autosave';

export interface PersistedState {
  onboardingSeen: boolean;
  isLoggedIn: boolean;
  currentRole: RoleId;
  activePlan: string;
  trialStartIso: string;
  settings: CompanySettings;
  permissionsMatrix: PermissionsMatrix;
  invoices: Invoice[];
  returns: ReturnRecord[];
  quotations: Quotation[];
  customers: Customer[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  vouchers: Voucher[];
  journals: JournalEntry[];
  products: Product[];
  employees: Employee[];
  expenses: Expense[];
  banks: BankAccount[];
}

function createDemoState(prevSettings?: CompanySettings): PersistedState {
  const now = Date.now();
  const isoDaysAgo = (d: number) => new Date(now - d * 86400000).toISOString();
  const isoDaysAhead = (d: number) => new Date(now + d * 86400000).toISOString().slice(0, 10);

  return {
    onboardingSeen: true,
    isLoggedIn: true,
    currentRole: 'owner',
    activePlan: 'trial',
    trialStartIso: new Date().toISOString(),
    permissionsMatrix: structuredClone(DEFAULT_PERMISSIONS_MATRIX),
    settings: prevSettings ?? {
      companyName: 'مؤسسة الأسطورة للتجارة والمقاولات',
      taxNumber: '310482910400003',
      crNumber: '1010592831',
      phone: '0501234567',
      email: 'finance@ostora.systems',
      address: 'الرياض، حي العليا، المملكة العربية السعودية',
      currency: 'SAR',
      isArabic: true,
      isDarkMode: false,
      monthlySalesGoal: 120000,
      defaultSalesTaxRate: 15,
      defaultPurchaseTaxRate: 15,
      autoBackupDaily: true,
      lastBackupDate: undefined,
    },
    customers: [
      { id: 'C-101', name: 'شركة النخبة التجارية', phone: '0504412398', email: 'accounts@nokhba.sa', debt: 18400 },
      { id: 'C-102', name: 'مؤسسة الفجر للمقاولات', phone: '0558231904', email: 'finance@fajr.sa', debt: 9200 },
      { id: 'C-103', name: 'متاجر الريادة الحديثة', phone: '0531187420', email: 'pay@riyadah.sa', debt: 0 },
    ],
    suppliers: [
      { id: 'S-201', name: 'مصنع الخليج للتجهيزات', phone: '0549012234', category: 'مواد خام', payable: 14500 },
      { id: 'S-202', name: 'شركة التقنية السحابية', phone: '0567721109', category: 'أجهزة ومعدات', payable: 4800 },
    ],
    products: [
      { id: 'P-01', name: 'أجهزة نقاط بيع ذكية POS', sku: 'POS-900', barcode: '6281001009004', qty: 24, cost: 850, price: 1450 },
      { id: 'P-02', name: 'طابعة فواتير حرارية 80mm', sku: 'PRT-80', barcode: '6281001000803', qty: 7, cost: 220, price: 390 },
      { id: 'P-03', name: 'ماسح باركود لاسلكي 2D', sku: 'SCN-2D', barcode: '6281001000209', qty: 18, cost: 160, price: 310 },
      { id: 'P-04', name: 'درج نقدية فولاذي 5 خانات', sku: 'DRW-05', barcode: '6281001000056', qty: 5, cost: 140, price: 260 },
    ],
    invoices: [
      {
        id: 'INV-1001',
        customerId: 'C-101',
        customerName: 'شركة النخبة التجارية',
        customerPhone: '0504412398',
        description: 'توريد 10 أجهزة نقاط بيع ذكية',
        items: [
          { productId: 'P-01', productName: 'أجهزة نقاط بيع ذكية POS', qty: 10, unitPrice: 1450, total: 14500 },
          { productId: 'P-02', productName: 'طابعة فواتير حرارية 80mm', qty: 4, unitPrice: 375, total: 1500 },
        ],
        subtotal: 16000,
        vat: 2400,
        total: 18400,
        status: 'pending',
        date: isoDaysAgo(2),
      },
      {
        id: 'INV-1002',
        customerId: 'C-103',
        customerName: 'متاجر الريادة الحديثة',
        customerPhone: '0531187420',
        description: 'نظام كاشير متكامل مع طابعات',
        items: [
          { productId: 'P-01', productName: 'أجهزة نقاط بيع ذكية POS', qty: 15, unitPrice: 1450, total: 21750 },
          { productId: 'P-03', productName: 'ماسح باركود لاسلكي 2D', qty: 9, unitPrice: 305.56, total: 2750 },
        ],
        subtotal: 24500,
        vat: 3675,
        total: 28175,
        status: 'paid',
        date: isoDaysAgo(5),
      },
      {
        id: 'INV-1003',
        customerId: 'C-102',
        customerName: 'مؤسسة الفجر للمقاولات',
        customerPhone: '0558231904',
        description: 'عقد صيانة وتجهيز فروع',
        items: [
          { productId: 'P-04', productName: 'درج نقدية فولاذي 5 خانات', qty: 10, unitPrice: 260, total: 2600 },
          { productId: 'P-03', productName: 'ماسح باركود لاسلكي 2D', qty: 18, unitPrice: 300, total: 5400 },
        ],
        subtotal: 8000,
        vat: 1200,
        total: 9200,
        status: 'overdue',
        date: isoDaysAgo(19),
      },
    ],
    returns: [
      {
        id: 'RET-401',
        type: 'sales',
        originalDocId: 'INV-1001',
        partyName: 'شركة النخبة التجارية',
        partyPhone: '0504412398',
        productId: 'P-02',
        productName: 'طابعة فواتير حرارية 80mm',
        qty: 1,
        unitPrice: 375,
        amount: 431.25,
        reason: 'damaged',
        notes: 'تلف أثناء الشحن - تم استبدالها وإصدار إشعار دائن',
        date: isoDaysAgo(1),
      },
    ],
    quotations: [
      {
        id: 'QT-201',
        customerId: 'C-101',
        customerName: 'شركة النخبة التجارية',
        customerPhone: '0504412398',
        customerEmail: 'accounts@nokhba.sa',
        items: [
          { productId: 'P-01', productName: 'أجهزة نقاط بيع ذكية POS', qty: 5, unitPrice: 1450, total: 7250 },
          { productId: 'P-03', productName: 'ماسح باركود لاسلكي 2D', qty: 5, unitPrice: 310, total: 1550 },
        ],
        discountPercent: 5,
        subtotal: 8800,
        discountAmount: 440,
        vat: 1254,
        total: 9614,
        validUntil: isoDaysAhead(14),
        status: 'sent',
        notes: 'يشمل التركيب والتدريب لمدة 3 أشهر',
        date: isoDaysAgo(1),
      },
    ],
    purchaseOrders: [
      {
        id: 'PO-301',
        supplierId: 'S-201',
        supplierName: 'مصنع الخليج للتجهيزات',
        supplierPhone: '0549012234',
        productId: 'P-02',
        productName: 'طابعة فواتير حرارية 80mm',
        quantity: 15,
        unitCost: 215,
        total: 3225,
        status: 'ordered',
        date: isoDaysAgo(1),
      },
    ],
    vouchers: [
      {
        id: 'VCH-501',
        type: 'receipt',
        partyName: 'متاجر الريادة الحديثة',
        partyPhone: '0531187420',
        amount: 28175,
        reason: 'سداد الفاتورة INV-1002',
        paymentMethod: 'AlRajhi Bank',
        date: isoDaysAgo(4),
      },
      {
        id: 'VCH-502',
        type: 'payment',
        partyName: 'شركة التقنية السحابية',
        partyPhone: '0567721109',
        amount: 4200,
        reason: 'دفعة من مستحقات التوريد',
        paymentMethod: 'AlAhli Bank',
        date: isoDaysAgo(3),
      },
    ],
    journals: [
      {
        id: 'JRN-701',
        reference: 'INV-1002',
        description: 'إثبات مبيعات نقدية متاجر الريادة',
        date: isoDaysAgo(5),
        lines: [
          { account: '1010 - مصرف الراجحي', debit: 28175, credit: 0 },
          { account: '4010 - إيرادات المبيعات', debit: 0, credit: 24500 },
          { account: '2020 - ضريبة القيمة المضافة', debit: 0, credit: 3675 },
        ],
      },
    ],
    employees: [
      {
        id: 'E-01',
        name: 'خالد العتيبي',
        roleTitle: 'محاسب مالي',
        role: 'accountant',
        permissions: [...DEFAULT_PERMISSIONS_MATRIX.accountant],
        phone: '0509981234',
        salary: 8500,
      },
      {
        id: 'E-02',
        name: 'سارة القحطاني',
        roleTitle: 'مديرة مبيعات',
        role: 'salesman',
        permissions: [...DEFAULT_PERMISSIONS_MATRIX.salesman],
        phone: '0552218743',
        salary: 9200,
      },
    ],
    expenses: [
      { id: 'EXP-901', title: 'إيجار المكتب الرئيسي', category: 'إيجارات', amount: 12000, paidFromBankId: 'alrajhi', date: isoDaysAgo(10) },
      { id: 'EXP-902', title: 'فواتير الكهرباء والإنترنت', category: 'مرافق', amount: 1450, paidFromBankId: 'cash', date: isoDaysAgo(6) },
    ],
    banks: [
      { id: 'alrajhi', nameAr: 'مصرف الراجحي', nameEn: 'AlRajhi Bank', accountNumber: 'SA44 8000 0219 6080 1044', balance: 142500 },
      { id: 'alahli', nameAr: 'البنك الأهلي السعودي', nameEn: 'AlAhli (SNB)', accountNumber: 'SA19 1000 0011 8920 3310', balance: 68900 },
      { id: 'cash', nameAr: 'الصندوق النقدي', nameEn: 'Main Cash Box', accountNumber: 'CASH-01', balance: 19450 },
    ],
  };
}

function hydrateState(rawObj: Partial<PersistedState>): PersistedState {
  const demo = createDemoState();
  const mergedQuotations = (rawObj.quotations ?? demo.quotations).map((q) => {
    if (q.status === 'sent' && q.validUntil && new Date(q.validUntil) < new Date(new Date().toDateString())) {
      return { ...q, status: 'expired' as const };
    }
    return q;
  });
  return {
    ...demo,
    ...rawObj,
    currentRole: rawObj.currentRole ?? 'owner',
    permissionsMatrix: rawObj.permissionsMatrix ?? demo.permissionsMatrix,
    returns: rawObj.returns ?? demo.returns,
    quotations: mergedQuotations,
    products: (rawObj.products ?? demo.products).map((p) => ({
      ...p,
      barcode: p.barcode || generateEan13(),
    })),
    employees: (rawObj.employees ?? demo.employees).map((e) => ({
      ...e,
      roleTitle: e.roleTitle ?? (e as unknown as { role?: string }).role ?? 'Staff',
      role: (['owner', 'accountant', 'salesman', 'warehouse'].includes(e.role) ? e.role : 'accountant') as RoleId,
      permissions: e.permissions ?? DEFAULT_PERMISSIONS_MATRIX.accountant,
    })),
    settings: {
      ...demo.settings,
      ...(rawObj.settings ?? {}),
      defaultSalesTaxRate: Number.isFinite(rawObj.settings?.defaultSalesTaxRate)
        ? Number(rawObj.settings!.defaultSalesTaxRate)
        : 15,
      defaultPurchaseTaxRate: Number.isFinite(rawObj.settings?.defaultPurchaseTaxRate)
        ? Number(rawObj.settings!.defaultPurchaseTaxRate)
        : 15,
    },
  };
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return hydrateState(JSON.parse(raw) as Partial<PersistedState>);
    }
  } catch {
    // Fallback to demo state
  }
  return createDemoState();
}

export function useErpStore() {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [idbSnapshots, setIdbSnapshots] = useState<DailyBackupMeta[]>([]);
  const latestStateRef = useRef<PersistedState>(state);
  latestStateRef.current = state;

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? '' : prev)), 3000);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  // Auto-save snapshot on start & every 5 minutes to ostora_autosave
  useEffect(() => {
    const saveSnapshot = () => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), state }));
      } catch {
        // Ignore quota errors
      }
    };
    saveSnapshot();
    const interval = setInterval(saveSnapshot, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state]);

  const saveDailySnapshotToIndexedDb = useCallback(
    async (force = false): Promise<DailyBackupRecord | null> => {
      const dateKey = getLocalDateKey();
      if (!force) {
        const existing = await getDailySnapshot(dateKey);
        if (existing) {
          const metaList = await listDailySnapshotMeta();
          setIdbSnapshots(metaList);
          return existing;
        }
      }

      const nowIso = new Date().toISOString();
      const snapshotPayload: PersistedState = {
        ...latestStateRef.current,
        settings: {
          ...latestStateRef.current.settings,
          lastBackupDate: nowIso,
        },
      };
      const json = JSON.stringify(snapshotPayload, null, 2);
      const record: DailyBackupRecord = {
        id: dateKey,
        dateKey,
        createdAt: nowIso,
        sizeBytes: new Blob([json]).size,
        json,
      };

      const saved = await saveDailySnapshot(record);
      if (!saved) return null;

      const metaList = await listDailySnapshotMeta();
      setIdbSnapshots(metaList);
      setState((p) => ({
        ...p,
        settings: {
          ...p.settings,
          lastBackupDate: nowIso,
        },
      }));
      return record;
    },
    [],
  );

  // Load IndexedDB daily snapshot metadata on mount
  useEffect(() => {
    let active = true;
    listDailySnapshotMeta().then((list) => {
      if (active) setIdbSnapshots(list);
    });
    return () => {
      active = false;
    };
  }, []);

  // Automated daily backup scheduler to browser IndexedDB
  useEffect(() => {
    if (!state.settings.autoBackupDaily) return;

    const runCheck = () => {
      void saveDailySnapshotToIndexedDb(false);
    };

    runCheck();
    const hourlyTimer = setInterval(runCheck, 60 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runCheck();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(hourlyTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [state.settings.autoBackupDaily, saveDailySnapshotToIndexedDb]);

  useEffect(() => {
    document.documentElement.dir = state.settings.isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = state.settings.isArabic ? 'ar' : 'en';
    if (state.settings.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.settings.isArabic, state.settings.isDarkMode]);

  const allowedRoutes = useMemo(() => {
    return state.permissionsMatrix[state.currentRole] ?? DEFAULT_PERMISSIONS_MATRIX.owner;
  }, [state.permissionsMatrix, state.currentRole]);

  const hasPermission = (route: RouteId): boolean => allowedRoutes.includes(route);

  const metrics = useMemo(() => {
    const totalSales = state.invoices.reduce((s, i) => s + i.total, 0);
    const revenueExVat = state.invoices.reduce((s, i) => s + i.subtotal, 0);
    const vatOutput = state.invoices.reduce((s, i) => s + i.vat, 0);
    const customerDebt = state.customers.reduce((s, c) => s + c.debt, 0);
    const supplierDebt = state.suppliers.reduce((s, sp) => s + sp.payable, 0);
    const stockValue = state.products.reduce((s, p) => s + p.qty * p.cost, 0);
    const totalExpenses = state.expenses.reduce((s, e) => s + e.amount, 0);
    const totalCashAndBanks = state.banks.reduce((s, b) => s + b.balance, 0);
    const netProfit = revenueExVat - totalExpenses;

    let score = 62;
    if (netProfit > 0) score += 18;
    if (totalCashAndBanks > supplierDebt) score += 12;
    score -= state.invoices.filter((i) => i.status === 'overdue').length * 5;
    score -= state.products.filter((p) => p.qty <= 10).length * 3;
    const healthScore = Math.max(15, Math.min(98, Math.round(score)));

    const elapsedDays = Math.floor((Date.now() - new Date(state.trialStartIso).getTime()) / 86400000);
    const trialDaysRemaining = Math.max(0, Math.min(30, 30 - elapsedDays));

    const alerts: SmartAlert[] = [];
    const lowStock = state.products.filter((p) => p.qty <= 10);
    if (lowStock.length > 0) {
      alerts.push({
        id: 'alert_low_stock',
        titleAr: `${lowStock.length} أصناف وصلت للحد الأدنى للمخزون`,
        titleEn: `${lowStock.length} products reached low stock threshold`,
        subtitleAr: `أبرزها: ${lowStock[0].name} (${lowStock[0].qty} وحدة)`,
        subtitleEn: `Top item: ${lowStock[0].name} (${lowStock[0].qty} units)`,
        actionRoute: 'inventory',
        severity: 'warning',
      });
    }
    const overdue = state.invoices.filter((i) => i.status === 'overdue');
    if (overdue.length > 0) {
      alerts.push({
        id: 'alert_overdue',
        titleAr: `${overdue.length} فواتير متأخرة السداد تحتاج متابعة`,
        titleEn: `${overdue.length} overdue invoices require collection`,
        subtitleAr: `إجمالي المتأخرات ${overdue.reduce((s, i) => s + i.total, 0).toFixed(0)} ${state.settings.currency}`,
        subtitleEn: `Overdue total ${overdue.reduce((s, i) => s + i.total, 0).toFixed(0)} ${state.settings.currency}`,
        actionRoute: 'invoices',
        severity: 'danger',
      });
    }
    if (customerDebt > 15000) {
      alerts.push({
        id: 'alert_debt',
        titleAr: 'ارتفاع ذمم العملاء المدينة',
        titleEn: 'Elevated customer receivables balance',
        subtitleAr: 'أرسل تذكيرات واتساب لتحصيل السيولة',
        subtitleEn: 'Send WhatsApp payment reminders to boost cashflow',
        actionRoute: 'customers',
        severity: 'info',
      });
    }

    const dataSizeKb = Number((new Blob([JSON.stringify(state)]).size / 1024).toFixed(1));

    return {
      totalSales,
      revenueExVat,
      vatOutput,
      customerDebt,
      supplierDebt,
      stockValue,
      totalExpenses,
      totalCashAndBanks,
      netProfit,
      healthScore,
      trialDaysRemaining,
      dataSizeKb,
      smartAlerts: alerts.filter((a) => !dismissedAlerts.includes(a.id)),
    };
  }, [state, dismissedAlerts]);

  const actions = {
    notify,
    toggleLanguage: () =>
      setState((p) => ({ ...p, settings: { ...p.settings, isArabic: !p.settings.isArabic } })),
    toggleDarkMode: () =>
      setState((p) => ({ ...p, settings: { ...p.settings, isDarkMode: !p.settings.isDarkMode } })),
    updateSettings: (patch: Partial<CompanySettings>) =>
      setState((p) => ({ ...p, settings: { ...p.settings, ...patch } })),
    setLoggedIn: (v: boolean) => setState((p) => ({ ...p, isLoggedIn: v })),
    setCurrentRole: (role: RoleId) => setState((p) => ({ ...p, currentRole: role })),
    // Fix Data Loss: Logout preserves all persisted business data!
    logoutPreserveData: () => setState((p) => ({ ...p, isLoggedIn: false })),
    setOnboardingSeen: (v: boolean) => setState((p) => ({ ...p, onboardingSeen: v })),
    setActivePlan: (plan: string) => setState((p) => ({ ...p, activePlan: plan })),
    dismissAlert: (id: string) => setDismissedAlerts((prev) => [...prev, id]),

    toggleRolePermission: (role: RoleId, route: RouteId) =>
      setState((p) => {
        const current = p.permissionsMatrix[role] ?? [];
        const exists = current.includes(route);
        const updated = exists ? current.filter((r) => r !== route) : [...current, route];
        return {
          ...p,
          permissionsMatrix: {
            ...p.permissionsMatrix,
            [role]: updated,
          },
        };
      }),

    saveInvoice: (inv: Omit<Invoice, 'id' | 'vat' | 'total'>, editId?: string) =>
      setState((p) => {
        const rate = Math.max(0, Math.min(100, inv.taxRate ?? p.settings.defaultSalesTaxRate ?? 15));
        const vat = Number(((inv.subtotal * rate) / 100).toFixed(2));
        const total = Number((inv.subtotal + vat).toFixed(2));
        if (editId) {
          return {
            ...p,
            invoices: p.invoices.map((x) =>
              x.id === editId ? { ...inv, id: editId, taxRate: rate, vat, total } : x,
            ),
          };
        }
        const newInv: Invoice = {
          ...inv,
          id: `INV-${1000 + p.invoices.length + 1}`,
          taxRate: rate,
          vat,
          total,
        };
        const updatedCustomers =
          inv.status !== 'paid'
            ? p.customers.map((c) =>
                c.name === inv.customerName ? { ...c, debt: Number((c.debt + total).toFixed(2)) } : c,
              )
            : p.customers;
        const updatedProducts = inv.items?.length
          ? p.products.map((pr) => {
              const sold = inv.items?.find((it) => it.productId === pr.id || it.productName === pr.name);
              return sold ? { ...pr, qty: Math.max(0, pr.qty - sold.qty) } : pr;
            })
          : p.products;
        return { ...p, invoices: [newInv, ...p.invoices], customers: updatedCustomers, products: updatedProducts };
      }),
    deleteInvoice: (id: string) =>
      setState((p) => ({ ...p, invoices: p.invoices.filter((i) => i.id !== id) })),
    deleteAllInvoices: () => setState((p) => ({ ...p, invoices: [] })),
    markInvoicePaid: (id: string) =>
      setState((p) => {
        const target = p.invoices.find((i) => i.id === id);
        if (!target || target.status === 'paid') return p;
        const nowIso = new Date().toISOString();
        const voucherId = `VCH-${500 + p.vouchers.length + 1}`;
        const journalId = `JRN-${700 + p.journals.length + 1}`;
        const newVoucher: Voucher = {
          id: voucherId,
          type: 'receipt',
          partyName: target.customerName,
          partyPhone: target.customerPhone,
          amount: target.total,
          reason: p.settings.isArabic ? `تحصيل الفاتورة ${target.id}` : `Settlement for ${target.id}`,
          paymentMethod: 'AlRajhi Bank',
          date: nowIso,
        };
        const newJournal: JournalEntry = {
          id: journalId,
          reference: target.id,
          description: p.settings.isArabic
            ? `سداد الفاتورة ${target.id} - ${target.customerName}`
            : `Invoice ${target.id} payment - ${target.customerName}`,
          date: nowIso,
          lines: [
            { account: '1010 - مصرف الراجحي', debit: target.total, credit: 0 },
            { account: `1020 - ذمم العملاء (${target.customerName})`, debit: 0, credit: target.total },
          ],
        };
        return {
          ...p,
          invoices: p.invoices.map((i) => (i.id === id ? { ...i, status: 'paid' as const } : i)),
          customers: p.customers.map((c) =>
            c.name === target.customerName
              ? { ...c, debt: Math.max(0, Number((c.debt - target.total).toFixed(2))) }
              : c,
          ),
          banks: p.banks.map((b) =>
            b.id === 'alrajhi' ? { ...b, balance: Number((b.balance + target.total).toFixed(2)) } : b,
          ),
          vouchers: [newVoucher, ...p.vouchers],
          journals: [newJournal, ...p.journals],
        };
      }),

    // 1. RETURNS CRUD (Stock +/- , Debt - , Auto Journal Entry)
    saveReturn: (ret: Omit<ReturnRecord, 'id'>, editId?: string) =>
      setState((p) => {
        if (editId) {
          return {
            ...p,
            returns: p.returns.map((r) => (r.id === editId ? { ...ret, id: editId } : r)),
          };
        }
        const newId = `RET-${400 + p.returns.length + 1}`;
        const newRet: ReturnRecord = { ...ret, id: newId };

        const updatedProducts = p.products.map((pr) => {
          if (pr.id === ret.productId || pr.name === ret.productName) {
            const delta = ret.type === 'sales' ? ret.qty : -ret.qty;
            return { ...pr, qty: Math.max(0, pr.qty + delta) };
          }
          return pr;
        });

        const updatedCustomers =
          ret.type === 'sales'
            ? p.customers.map((c) =>
                c.name === ret.partyName ? { ...c, debt: Math.max(0, Number((c.debt - ret.amount).toFixed(2))) } : c,
              )
            : p.customers;

        const updatedSuppliers =
          ret.type === 'purchase'
            ? p.suppliers.map((s) =>
                s.name === ret.partyName ? { ...s, payable: Math.max(0, Number((s.payable - ret.amount).toFixed(2))) } : s,
              )
            : p.suppliers;

        const autoJournal: JournalEntry = {
          id: `JRN-${700 + p.journals.length + 1}`,
          reference: newId,
          description:
            ret.type === 'sales'
              ? `مرتجع مبيعات - ${ret.partyName} (${ret.productName})`
              : `مرتجع مشتريات - ${ret.partyName} (${ret.productName})`,
          date: ret.date,
          lines:
            ret.type === 'sales'
              ? [
                  { account: '4020 - مردودات ومسموحات المبيعات', debit: ret.amount, credit: 0 },
                  { account: `1020 - ذمم العملاء (${ret.partyName})`, debit: 0, credit: ret.amount },
                ]
              : [
                  { account: `2010 - ذمم الموردين (${ret.partyName})`, debit: ret.amount, credit: 0 },
                  { account: '5020 - مردودات المشتريات', debit: 0, credit: ret.amount },
                ],
        };

        return {
          ...p,
          returns: [newRet, ...p.returns],
          products: updatedProducts,
          customers: updatedCustomers,
          suppliers: updatedSuppliers,
          journals: [autoJournal, ...p.journals],
        };
      }),
    deleteReturn: (id: string) =>
      setState((p) => ({ ...p, returns: p.returns.filter((r) => r.id !== id) })),
    deleteAllReturns: () => setState((p) => ({ ...p, returns: [] })),

    // 2. QUOTATIONS CRUD + CONVERT TO INVOICE
    saveQuotation: (qt: Omit<Quotation, 'id'>, editId?: string) =>
      setState((p) => ({
        ...p,
        quotations: editId
          ? p.quotations.map((x) => (x.id === editId ? { ...qt, id: editId } : x))
          : [{ ...qt, id: `QT-${200 + p.quotations.length + 1}` }, ...p.quotations],
      })),
    deleteQuotation: (id: string) =>
      setState((p) => ({ ...p, quotations: p.quotations.filter((q) => q.id !== id) })),
    deleteAllQuotations: () => setState((p) => ({ ...p, quotations: [] })),
    convertQuotationToInvoice: (qtId: string) =>
      setState((p) => {
        const qt = p.quotations.find((q) => q.id === qtId);
        if (!qt) return p;
        const netSubtotal = Number((qt.subtotal - qt.discountAmount).toFixed(2));
        const rate = Math.max(0, Math.min(100, p.settings.defaultSalesTaxRate ?? 15));
        const vat = Number(((netSubtotal * rate) / 100).toFixed(2));
        const total = Number((netSubtotal + vat).toFixed(2));
        const newInvId = `INV-${1000 + p.invoices.length + 1}`;
        const newInv: Invoice = {
          id: newInvId,
          customerId: qt.customerId,
          customerName: qt.customerName,
          customerPhone: qt.customerPhone,
          description: `${qt.id} · ${qt.items.map((i) => `${i.productName} ×${i.qty}`).join(', ')}`,
          items: qt.items,
          subtotal: netSubtotal,
          taxRate: rate,
          vat,
          total,
          status: 'pending',
          date: new Date().toISOString(),
        };
        const updatedProducts = p.products.map((pr) => {
          const item = qt.items.find((i) => i.productId === pr.id || i.productName === pr.name);
          return item ? { ...pr, qty: Math.max(0, pr.qty - item.qty) } : pr;
        });
        const updatedCustomers = p.customers.map((c) =>
          c.name === qt.customerName ? { ...c, debt: Number((c.debt + total).toFixed(2)) } : c,
        );
        const autoJournal: JournalEntry = {
          id: `JRN-${700 + p.journals.length + 1}`,
          reference: newInvId,
          description: `تحويل عرض السعر ${qt.id} إلى فاتورة ${newInvId}`,
          date: new Date().toISOString(),
          lines: [
            { account: `1020 - ذمم العملاء (${qt.customerName})`, debit: total, credit: 0 },
            { account: '4010 - إيرادات المبيعات', debit: 0, credit: netSubtotal },
            { account: '2020 - ضريبة القيمة المضافة', debit: 0, credit: vat },
          ],
        };
        return {
          ...p,
          quotations: p.quotations.map((q) => (q.id === qtId ? { ...q, status: 'accepted' } : q)),
          invoices: [newInv, ...p.invoices],
          products: updatedProducts,
          customers: updatedCustomers,
          journals: [autoJournal, ...p.journals],
        };
      }),

    saveCustomer: (c: Omit<Customer, 'id'>, editId?: string) =>
      setState((p) => ({
        ...p,
        customers: editId
          ? p.customers.map((x) => (x.id === editId ? { ...c, id: editId } : x))
          : [{ ...c, id: `C-${100 + p.customers.length + 1}` }, ...p.customers],
      })),
    importCustomersBulk: (items: Omit<Customer, 'id'>[]) => {
      if (items.length === 0) return 0;
      setState((p) => {
        const base = 100 + p.customers.length;
        const created: Customer[] = items.map((c, idx) => ({
          ...c,
          id: `C-${base + idx + 1}`,
        }));
        return { ...p, customers: [...created, ...p.customers] };
      });
      return items.length;
    },
    deleteCustomer: (id: string) =>
      setState((p) => ({ ...p, customers: p.customers.filter((c) => c.id !== id) })),

    saveSupplier: (s: Omit<Supplier, 'id'>, editId?: string) =>
      setState((p) => ({
        ...p,
        suppliers: editId
          ? p.suppliers.map((x) => (x.id === editId ? { ...s, id: editId } : x))
          : [{ ...s, id: `S-${200 + p.suppliers.length + 1}` }, ...p.suppliers],
      })),
    deleteSupplier: (id: string) =>
      setState((p) => ({ ...p, suppliers: p.suppliers.filter((s) => s.id !== id) })),

    addPurchaseOrder: (
      po: Omit<PurchaseOrder, 'id' | 'subtotal' | 'vat' | 'total' | 'status' | 'date'>,
    ) =>
      setState((p) => {
        const rate = Math.max(0, Math.min(100, po.taxRate ?? p.settings.defaultPurchaseTaxRate ?? 15));
        const subtotal = Number((po.quantity * po.unitCost).toFixed(2));
        const vat = Number(((subtotal * rate) / 100).toFixed(2));
        const total = Number((subtotal + vat).toFixed(2));
        return {
          ...p,
          purchaseOrders: [
            {
              ...po,
              id: `PO-${300 + p.purchaseOrders.length + 1}`,
              subtotal,
              taxRate: rate,
              vat,
              total,
              status: 'ordered',
              date: new Date().toISOString(),
            },
            ...p.purchaseOrders,
          ],
        };
      }),
    receivePurchaseOrder: (poId: string) =>
      setState((p) => {
        const target = p.purchaseOrders.find((x) => x.id === poId);
        if (!target || target.status === 'received') return p;
        const matched = p.products.some(
          (pr) => pr.id === target.productId || pr.name === target.productName,
        );
        const updatedProducts = matched
          ? p.products.map((pr) =>
              pr.id === target.productId || pr.name === target.productName
                ? { ...pr, qty: pr.qty + target.quantity, cost: target.unitCost }
                : pr,
            )
          : [
              {
                id: `P-${p.products.length + 11}`,
                name: target.productName,
                sku: `SKU-${target.quantity}`,
                barcode: generateEan13(),
                qty: target.quantity,
                cost: target.unitCost,
                price: Number((target.unitCost * 1.25).toFixed(2)),
              },
              ...p.products,
            ];
        return {
          ...p,
          purchaseOrders: p.purchaseOrders.map((x) =>
            x.id === poId ? { ...x, status: 'received' } : x,
          ),
          products: updatedProducts,
        };
      }),
    deletePurchaseOrder: (poId: string) =>
      setState((p) => ({
        ...p,
        purchaseOrders: p.purchaseOrders.filter((po) => po.id !== poId),
      })),

    saveVoucher: (v: Omit<Voucher, 'id'>, editId?: string) =>
      setState((p) => {
        if (editId) {
          return {
            ...p,
            vouchers: p.vouchers.map((x) => (x.id === editId ? { ...v, id: editId } : x)),
          };
        }
        const newV: Voucher = { ...v, id: `VCH-${500 + p.vouchers.length + 1}` };
        const updatedCustomers =
          v.type === 'receipt'
            ? p.customers.map((c) =>
                c.name === v.partyName
                  ? { ...c, debt: Math.max(0, Number((c.debt - v.amount).toFixed(2))) }
                  : c,
              )
            : p.customers;
        return { ...p, vouchers: [newV, ...p.vouchers], customers: updatedCustomers };
      }),
    deleteVoucher: (id: string) =>
      setState((p) => ({ ...p, vouchers: p.vouchers.filter((v) => v.id !== id) })),

    saveJournal: (j: Omit<JournalEntry, 'id'>, editId?: string) =>
      setState((p) => ({
        ...p,
        journals: editId
          ? p.journals.map((x) => (x.id === editId ? { ...j, id: editId } : x))
          : [{ ...j, id: `JRN-${700 + p.journals.length + 1}` }, ...p.journals],
      })),
    deleteJournal: (id: string) =>
      setState((p) => ({ ...p, journals: p.journals.filter((j) => j.id !== id) })),

    saveProduct: (pr: Omit<Product, 'id'>, editId?: string) =>
      setState((p) => ({
        ...p,
        products: editId
          ? p.products.map((x) => (x.id === editId ? { ...pr, id: editId } : x))
          : [{ ...pr, id: `P-${10 + p.products.length + 1}` }, ...p.products],
      })),
    importProductsBulk: (items: Omit<Product, 'id'>[]) => {
      if (items.length === 0) return 0;
      setState((p) => {
        const base = 10 + p.products.length;
        const created: Product[] = items.map((pr, idx) => ({
          ...pr,
          id: `P-${base + idx + 1}`,
        }));
        return { ...p, products: [...created, ...p.products] };
      });
      return items.length;
    },
    addTenStock: (id: string) =>
      setState((p) => ({
        ...p,
        products: p.products.map((pr) => (pr.id === id ? { ...pr, qty: pr.qty + 10 } : pr)),
      })),
    deleteProduct: (id: string) =>
      setState((p) => ({ ...p, products: p.products.filter((pr) => pr.id !== id) })),

    saveEmployee: (emp: Omit<Employee, 'id'>, editId?: string) =>
      setState((p) => ({
        ...p,
        employees: editId
          ? p.employees.map((x) => (x.id === editId ? { ...emp, id: editId } : x))
          : [{ ...emp, id: `E-${10 + p.employees.length + 1}` }, ...p.employees],
      })),
    paySalary: (id: string) =>
      setState((p) => {
        const emp = p.employees.find((e) => e.id === id);
        if (!emp) return p;
        const newExp: Expense = {
          id: `EXP-${900 + p.expenses.length + 1}`,
          title: p.settings.isArabic ? `راتب ${emp.name}` : `Salary - ${emp.name}`,
          category: p.settings.isArabic ? 'الرواتب والأجور' : 'Payroll',
          amount: emp.salary,
          paidFromBankId: 'alrajhi',
          date: new Date().toISOString(),
        };
        return {
          ...p,
          employees: p.employees.map((e) =>
            e.id === id ? { ...e, lastPaidDate: new Date().toISOString() } : e,
          ),
          expenses: [newExp, ...p.expenses],
        };
      }),
    deleteEmployee: (id: string) =>
      setState((p) => ({ ...p, employees: p.employees.filter((e) => e.id !== id) })),

    saveExpense: (exp: Omit<Expense, 'id'>, editId?: string) =>
      setState((p) => ({
        ...p,
        expenses: editId
          ? p.expenses.map((x) => (x.id === editId ? { ...exp, id: editId } : x))
          : [{ ...exp, id: `EXP-${900 + p.expenses.length + 1}` }, ...p.expenses],
      })),
    deleteExpense: (id: string) =>
      setState((p) => ({ ...p, expenses: p.expenses.filter((e) => e.id !== id) })),

    updateBankBalance: (id: string, balance: number) =>
      setState((p) => ({
        ...p,
        banks: p.banks.map((b) => (b.id === id ? { ...b, balance } : b)),
      })),

    exportBackupJson: () => {
      const nowIso = new Date().toISOString();
      const snapshotPayload: PersistedState = {
        ...state,
        settings: { ...state.settings, lastBackupDate: nowIso },
      };
      const json = JSON.stringify(snapshotPayload, null, 2);
      const dateKey = getLocalDateKey();
      void saveDailySnapshot({
        id: dateKey,
        dateKey,
        createdAt: nowIso,
        sizeBytes: new Blob([json]).size,
        json,
      }).then(() => listDailySnapshotMeta().then(setIdbSnapshots));
      setState((p) => ({ ...p, settings: { ...p.settings, lastBackupDate: nowIso } }));
      return json;
    },
    saveDailySnapshotToIndexedDb: () => saveDailySnapshotToIndexedDb(true),
    getLatestIndexedDbBackup: async (): Promise<DailyBackupRecord | null> => {
      const latest = await getLatestDailySnapshot();
      if (latest) return latest;
      return saveDailySnapshotToIndexedDb(true);
    },
    importBackupJson: (raw: string) => {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const inner = (parsed as { state?: Partial<PersistedState> }).state ?? parsed;
      setState(hydrateState(inner));
    },
    restoreFromAutosave: () => {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { state?: Partial<PersistedState> };
      if (!parsed.state) return false;
      setState({ ...hydrateState(parsed.state), isLoggedIn: true, onboardingSeen: true });
      return true;
    },
    deleteAllData: () =>
      setState((p) => ({
        ...p,
        invoices: [],
        returns: [],
        quotations: [],
        customers: [],
        suppliers: [],
        purchaseOrders: [],
        vouchers: [],
        journals: [],
        products: [],
        employees: [],
        expenses: [],
      })),
    restoreDemoData: () => setState((p) => createDemoState(p.settings)),
  };

  return { state, metrics, actions, allowedRoutes, hasPermission, toastMsg, idbSnapshots };
}
