import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_PERMISSIONS_MATRIX } from '../constants/permissions';
import { db } from '../firebase';
import {
  ALL_CURRENCY_CODES,
  buildDefaultRatesForBase,
  DEFAULT_ENABLED_CURRENCIES,
} from '../utils/currencies';
import {
  BankAccount,
  CurrencyCode,
  Customer,
  Employee,
  Expense,
  Invoice,
  JournalEntry,
  PermissionsMatrix,
  PersistedState,
  Product,
  PurchaseOrder,
  Quotation,
  ReturnRecord,
  RoleId,
  RouteId,
  Supplier,
  Voucher,
} from '../types/erp';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';

const SUBCOLLECTIONS = [
  'invoices',
  'returns',
  'quotations',
  'customers',
  'suppliers',
  'purchaseOrders',
  'vouchers',
  'journals',
  'products',
  'employees',
  'expenses',
  'banks',
] as const;

type SubcollectionName = (typeof SUBCOLLECTIONS)[number];

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function sanitizeId(raw: string | undefined, fallbackPrefix: string): string {
  const cleaned = (raw ?? '').trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
  if (cleaned.length >= 1 && cleaned.length <= 128 && ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}-${Date.now().toString(36)}`;
}

function clampString(raw: unknown, maxLen: number, fallback = ''): string {
  const s = typeof raw === 'string' ? raw : fallback;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function clampNonEmpty(raw: unknown, maxLen: number, fallback: string): string {
  const trimmed = clampString(raw, maxLen, fallback).trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLen) : fallback.slice(0, maxLen);
}

function clampNum(raw: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function sanitizePermissionsMatrix(matrix: PermissionsMatrix | undefined): PermissionsMatrix {
  const roles: RoleId[] = ['owner', 'accountant', 'salesman', 'warehouse'];
  const out = {} as PermissionsMatrix;
  for (const r of roles) {
    const src = matrix?.[r] ?? DEFAULT_PERMISSIONS_MATRIX[r] ?? [];
    out[r] = src
      .filter((x): x is RouteId => typeof x === 'string' && x.length > 0 && x.length <= 40)
      .slice(0, 25);
  }
  return out;
}

function sanitizeCurrencyCode(raw: unknown, fallback: CurrencyCode = 'SAR'): CurrencyCode {
  return ALL_CURRENCY_CODES.includes(raw as CurrencyCode) ? (raw as CurrencyCode) : fallback;
}

function sanitizeExchangeRates(
  raw: Record<string, number> | undefined,
  base: CurrencyCode,
): Record<string, number> {
  const defaults = buildDefaultRatesForBase(base);
  const out: Record<string, number> = {};
  for (const code of ALL_CURRENCY_CODES) {
    const val = raw?.[code];
    out[code] = code === base ? 1 : typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : defaults[code];
  }
  return out;
}

function sanitizeWorkspaceFields(uid: string, state: PersistedState) {
  const baseCurrency = sanitizeCurrencyCode(state.settings.currency, 'SAR');
  const rawEnabled = state.settings.enabledCurrencies ?? DEFAULT_ENABLED_CURRENCIES;
  const enabledCurrencies = Array.from(
    new Set<CurrencyCode>([
      baseCurrency,
      ...rawEnabled.filter((c): c is CurrencyCode => ALL_CURRENCY_CODES.includes(c)),
    ]),
  ).slice(0, 15);

  const payload: Record<string, unknown> = {
    ownerId: uid,
    companyName: clampNonEmpty(state.settings.companyName, 160, 'Ostora Accounting'),
    taxNumber: clampString(state.settings.taxNumber, 64),
    crNumber: clampString(state.settings.crNumber, 64),
    phone: clampString(state.settings.phone, 40),
    email: clampString(state.settings.email, 160),
    address: clampString(state.settings.address, 300),
    currency: baseCurrency,
    enabledCurrencies,
    exchangeRates: sanitizeExchangeRates(state.settings.exchangeRates, baseCurrency),
    isArabic: Boolean(state.settings.isArabic),
    isDarkMode: Boolean(state.settings.isDarkMode),
    monthlySalesGoal: clampNum(state.settings.monthlySalesGoal, 0),
    defaultSalesTaxRate: clampNum(state.settings.defaultSalesTaxRate, 0, 100),
    defaultPurchaseTaxRate: clampNum(state.settings.defaultPurchaseTaxRate, 0, 100),
    autoBackupDaily: Boolean(state.settings.autoBackupDaily),
    autoCloudSync: state.settings.autoCloudSync ?? true,
    autoSyncIntervalMinutes: clampNum(state.settings.autoSyncIntervalMinutes ?? 0, 0, 1440),
    activePlan: clampNonEmpty(state.activePlan, 40, 'trial'),
    trialStartIso: clampNonEmpty(state.trialStartIso, 64, new Date().toISOString()),
    currentRole: ['owner', 'accountant', 'salesman', 'warehouse'].includes(state.currentRole)
      ? state.currentRole
      : 'owner',
    permissionsMatrix: sanitizePermissionsMatrix(state.permissionsMatrix),
  };

  if (state.settings.lastBackupDate) {
    payload.lastBackupDate = clampString(state.settings.lastBackupDate, 64);
  }
  if (state.settings.lastRatesUpdate) {
    payload.lastRatesUpdate = clampString(state.settings.lastRatesUpdate, 64);
  }

  return payload;
}

function sanitizeEntityForWrite(
  sub: SubcollectionName,
  uid: string,
  item: unknown,
  defaultTaxRate: number,
  defaultPurchaseTaxRate: number,
  baseCurrency: CurrencyCode,
): Record<string, unknown> {
  switch (sub) {
    case 'invoices': {
      const inv = item as Invoice;
      const items = (inv.items ?? []).slice(0, 50).map((it) => ({
        productId: clampString(it.productId, 128),
        productName: clampNonEmpty(it.productName, 160, 'Item'),
        qty: clampNum(it.qty, 0),
        unitPrice: clampNum(it.unitPrice, 0),
        total: clampNum(it.total, 0),
      }));
      const invCurrency = sanitizeCurrencyCode(inv.currency, baseCurrency);
      const exchangeRate =
        invCurrency === baseCurrency
          ? 1
          : clampNum(inv.exchangeRate ?? 1, 0.0001, 1000000);
      const total = clampNum(inv.total, 0);
      const baseTotal = clampNum(inv.baseTotal ?? Number((total * exchangeRate).toFixed(2)), 0);
      return {
        id: sanitizeId(inv.id, 'INV'),
        ownerId: uid,
        customerId: clampString(inv.customerId, 128),
        customerName: clampNonEmpty(inv.customerName, 160, 'Customer'),
        customerPhone: clampString(inv.customerPhone, 40),
        description: clampString(inv.description, 500),
        items,
        subtotal: clampNum(inv.subtotal, 0),
        taxRate: clampNum(inv.taxRate ?? defaultTaxRate, 0, 100),
        vat: clampNum(inv.vat, 0),
        total,
        currency: invCurrency,
        exchangeRate,
        baseTotal,
        status: ['paid', 'pending', 'overdue'].includes(inv.status) ? inv.status : 'pending',
        date: clampNonEmpty(inv.date, 64, new Date().toISOString()),
      };
    }
    case 'returns': {
      const ret = item as ReturnRecord;
      return {
        id: sanitizeId(ret.id, 'RET'),
        ownerId: uid,
        type: ret.type === 'purchase' ? 'purchase' : 'sales',
        originalDocId: clampString(ret.originalDocId, 128),
        partyName: clampNonEmpty(ret.partyName, 160, 'Party'),
        partyPhone: clampString(ret.partyPhone, 40),
        productId: clampString(ret.productId, 128),
        productName: clampNonEmpty(ret.productName, 160, 'Product'),
        qty: clampNum(ret.qty, 0),
        unitPrice: clampNum(ret.unitPrice, 0),
        amount: clampNum(ret.amount, 0),
        reason: ['damaged', 'wrong_item', 'expired', 'changed_mind', 'other'].includes(ret.reason)
          ? ret.reason
          : 'other',
        notes: clampString(ret.notes, 500),
        date: clampNonEmpty(ret.date, 64, new Date().toISOString()),
      };
    }
    case 'quotations': {
      const qt = item as Quotation;
      const items = (qt.items ?? []).slice(0, 50).map((it) => ({
        productId: clampString(it.productId, 128),
        productName: clampNonEmpty(it.productName, 160, 'Item'),
        qty: clampNum(it.qty, 0),
        unitPrice: clampNum(it.unitPrice, 0),
        total: clampNum(it.total, 0),
      }));
      if (items.length === 0) {
        items.push({ productId: '', productName: 'Item', qty: 1, unitPrice: 0, total: 0 });
      }
      return {
        id: sanitizeId(qt.id, 'QT'),
        ownerId: uid,
        customerId: clampString(qt.customerId, 128),
        customerName: clampNonEmpty(qt.customerName, 160, 'Customer'),
        customerPhone: clampString(qt.customerPhone, 40),
        customerEmail: clampString(qt.customerEmail, 160),
        items,
        discountPercent: clampNum(qt.discountPercent, 0, 100),
        subtotal: clampNum(qt.subtotal, 0),
        discountAmount: clampNum(qt.discountAmount, 0),
        vat: clampNum(qt.vat, 0),
        total: clampNum(qt.total, 0),
        validUntil: clampString(qt.validUntil, 64),
        status: ['draft', 'sent', 'accepted', 'rejected', 'expired'].includes(qt.status)
          ? qt.status
          : 'draft',
        notes: clampString(qt.notes, 500),
        date: clampNonEmpty(qt.date, 64, new Date().toISOString()),
      };
    }
    case 'customers': {
      const c = item as Customer;
      const out: Record<string, unknown> = {
        id: sanitizeId(c.id, 'C'),
        ownerId: uid,
        name: clampNonEmpty(c.name, 160, 'Customer'),
        phone: clampString(c.phone, 40),
        email: clampString(c.email, 160),
        debt: clampNum(c.debt, 0),
      };
      if (typeof c.creditLimit === 'number' && Number.isFinite(c.creditLimit) && c.creditLimit >= 0) {
        out.creditLimit = clampNum(c.creditLimit, 0);
      }
      return out;
    }
    case 'suppliers': {
      const s = item as Supplier;
      return {
        id: sanitizeId(s.id, 'S'),
        ownerId: uid,
        name: clampNonEmpty(s.name, 160, 'Supplier'),
        phone: clampString(s.phone, 40),
        category: clampString(s.category, 100),
        payable: clampNum(s.payable, 0),
      };
    }
    case 'purchaseOrders': {
      const po = item as PurchaseOrder;
      const subtotal = clampNum(po.subtotal ?? po.quantity * po.unitCost, 0);
      const taxRate = clampNum(po.taxRate ?? defaultPurchaseTaxRate, 0, 100);
      const vat = clampNum(po.vat ?? Number(((subtotal * taxRate) / 100).toFixed(2)), 0);
      return {
        id: sanitizeId(po.id, 'PO'),
        ownerId: uid,
        supplierId: clampString(po.supplierId, 128),
        supplierName: clampNonEmpty(po.supplierName, 160, 'Supplier'),
        supplierPhone: clampString(po.supplierPhone, 40),
        productId: clampString(po.productId, 128),
        productName: clampNonEmpty(po.productName, 160, 'Product'),
        quantity: clampNum(po.quantity, 0),
        unitCost: clampNum(po.unitCost, 0),
        subtotal,
        taxRate,
        vat,
        total: clampNum(po.total, 0),
        status: po.status === 'received' ? 'received' : 'ordered',
        date: clampNonEmpty(po.date, 64, new Date().toISOString()),
      };
    }
    case 'vouchers': {
      const v = item as Voucher;
      return {
        id: sanitizeId(v.id, 'VCH'),
        ownerId: uid,
        type: v.type === 'payment' ? 'payment' : 'receipt',
        partyName: clampNonEmpty(v.partyName, 160, 'Party'),
        partyPhone: clampString(v.partyPhone, 40),
        amount: clampNum(v.amount, 0),
        reason: clampString(v.reason, 400),
        paymentMethod: clampString(v.paymentMethod, 80),
        date: clampNonEmpty(v.date, 64, new Date().toISOString()),
      };
    }
    case 'journals': {
      const j = item as JournalEntry;
      const lines = (j.lines ?? []).slice(0, 50).map((l) => ({
        account: clampNonEmpty(l.account, 160, 'Account'),
        debit: clampNum(l.debit, 0),
        credit: clampNum(l.credit, 0),
      }));
      if (lines.length === 0) {
        lines.push({ account: 'General', debit: 0, credit: 0 });
      }
      return {
        id: sanitizeId(j.id, 'JRN'),
        ownerId: uid,
        reference: clampString(j.reference, 120),
        description: clampNonEmpty(j.description, 400, 'Journal Entry'),
        date: clampNonEmpty(j.date, 64, new Date().toISOString()),
        lines,
      };
    }
    case 'products': {
      const p = item as Product;
      const out: Record<string, unknown> = {
        id: sanitizeId(p.id, 'P'),
        ownerId: uid,
        name: clampNonEmpty(p.name, 160, 'Product'),
        sku: clampString(p.sku, 64),
        barcode: clampString(p.barcode, 64),
        qty: clampNum(p.qty, 0),
        cost: clampNum(p.cost, 0),
        price: clampNum(p.price, 0),
      };
      if (p.imageBase64 && p.imageBase64.length <= 250000) {
        out.imageBase64 = p.imageBase64;
      }
      return out;
    }
    case 'employees': {
      const e = item as Employee;
      const out: Record<string, unknown> = {
        id: sanitizeId(e.id, 'E'),
        ownerId: uid,
        name: clampNonEmpty(e.name, 160, 'Employee'),
        roleTitle: clampString(e.roleTitle, 100),
        role: ['owner', 'accountant', 'salesman', 'warehouse'].includes(e.role) ? e.role : 'accountant',
        permissions: (e.permissions ?? [])
          .filter((x): x is RouteId => typeof x === 'string' && x.length > 0 && x.length <= 40)
          .slice(0, 25),
        phone: clampString(e.phone, 40),
        salary: clampNum(e.salary, 0),
      };
      if (e.lastPaidDate) {
        out.lastPaidDate = clampString(e.lastPaidDate, 64);
      }
      return out;
    }
    case 'expenses': {
      const ex = item as Expense;
      return {
        id: sanitizeId(ex.id, 'EXP'),
        ownerId: uid,
        title: clampNonEmpty(ex.title, 160, 'Expense'),
        category: clampString(ex.category, 80),
        amount: clampNum(ex.amount, 0),
        paidFromBankId: clampString(ex.paidFromBankId, 128),
        date: clampNonEmpty(ex.date, 64, new Date().toISOString()),
      };
    }
    case 'banks': {
      const b = item as BankAccount;
      return {
        id: sanitizeId(b.id, 'BNK'),
        ownerId: uid,
        nameAr: clampNonEmpty(b.nameAr, 120, 'حساب بنكي'),
        nameEn: clampNonEmpty(b.nameEn, 120, 'Bank Account'),
        accountNumber: clampString(b.accountNumber, 64),
        balance: typeof b.balance === 'number' && Number.isFinite(b.balance) ? b.balance : 0,
      };
    }
  }
}

export async function upsertUserProfile(user: User): Promise<void> {
  if (!user.emailVerified) return;
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    const displayName = clampNonEmpty(user.displayName || user.email?.split('@')[0], 120, 'User');
    const email = clampNonEmpty(user.email, 256, 'user@example.com');
    const photoUrl = user.photoURL ? clampString(user.photoURL, 512) : undefined;

    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid: user.uid,
        email,
        displayName,
        role: 'user',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (photoUrl) payload.photoUrl = photoUrl;
      await setDoc(userRef, payload);
    } else {
      const patch: Record<string, unknown> = {
        displayName,
        email,
        updatedAt: serverTimestamp(),
      };
      if (photoUrl) patch.photoUrl = photoUrl;
      await updateDoc(userRef, patch);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function loadOrSeedWorkspace(
  uid: string,
  localState: PersistedState,
): Promise<Partial<PersistedState>> {
  const wsPath = `workspaces/${uid}`;
  const wsRef = doc(db, 'workspaces', uid);

  let wsSnap;
  try {
    wsSnap = await getDoc(wsRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, wsPath);
  }

  if (!wsSnap.exists()) {
    try {
      await setDoc(wsRef, {
        ...sanitizeWorkspaceFields(uid, localState),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, wsPath);
    }

    await seedAllSubcollections(uid, localState);
    return localState;
  }

  const wsData = wsSnap.data();
  const loaded: Partial<PersistedState> = {
    onboardingSeen: true,
    isLoggedIn: true,
    currentRole: (wsData.currentRole as RoleId) ?? localState.currentRole,
    activePlan: (wsData.activePlan as string) ?? localState.activePlan,
    trialStartIso: (wsData.trialStartIso as string) ?? localState.trialStartIso,
    permissionsMatrix: (wsData.permissionsMatrix as PermissionsMatrix) ?? localState.permissionsMatrix,
    settings: {
      ...localState.settings,
      companyName: (wsData.companyName as string) ?? localState.settings.companyName,
      taxNumber: (wsData.taxNumber as string) ?? localState.settings.taxNumber,
      crNumber: (wsData.crNumber as string) ?? localState.settings.crNumber,
      phone: (wsData.phone as string) ?? localState.settings.phone,
      email: (wsData.email as string) ?? localState.settings.email,
      address: (wsData.address as string) ?? localState.settings.address,
      currency: (wsData.currency as PersistedState['settings']['currency']) ?? localState.settings.currency,
      enabledCurrencies:
        (wsData.enabledCurrencies as CurrencyCode[] | undefined) ?? localState.settings.enabledCurrencies,
      exchangeRates:
        (wsData.exchangeRates as Record<string, number> | undefined) ?? localState.settings.exchangeRates,
      lastRatesUpdate:
        (wsData.lastRatesUpdate as string | undefined) ?? localState.settings.lastRatesUpdate,
      isArabic: typeof wsData.isArabic === 'boolean' ? wsData.isArabic : localState.settings.isArabic,
      isDarkMode: typeof wsData.isDarkMode === 'boolean' ? wsData.isDarkMode : localState.settings.isDarkMode,
      monthlySalesGoal: Number(wsData.monthlySalesGoal ?? localState.settings.monthlySalesGoal),
      defaultSalesTaxRate: Number(wsData.defaultSalesTaxRate ?? localState.settings.defaultSalesTaxRate),
      defaultPurchaseTaxRate: Number(wsData.defaultPurchaseTaxRate ?? localState.settings.defaultPurchaseTaxRate),
      autoBackupDaily:
        typeof wsData.autoBackupDaily === 'boolean'
          ? wsData.autoBackupDaily
          : localState.settings.autoBackupDaily,
      lastBackupDate: (wsData.lastBackupDate as string | undefined) ?? localState.settings.lastBackupDate,
      autoCloudSync:
        typeof wsData.autoCloudSync === 'boolean'
          ? wsData.autoCloudSync
          : (localState.settings.autoCloudSync ?? true),
      autoSyncIntervalMinutes: Number(
        wsData.autoSyncIntervalMinutes ?? localState.settings.autoSyncIntervalMinutes ?? 0,
      ),
    },
  };

  for (const sub of SUBCOLLECTIONS) {
    const subPath = `workspaces/${uid}/${sub}`;
    try {
      const q = query(collection(db, 'workspaces', uid, sub), where('ownerId', '==', uid));
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => stripFirestoreMeta(d.data()));
      (loaded as Record<string, unknown>)[sub] = docs;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, subPath);
    }
  }

  return loaded;
}

async function seedAllSubcollections(uid: string, state: PersistedState): Promise<void> {
  const ops: { path: string; sub: SubcollectionName; id: string; payload: Record<string, unknown> }[] = [];

  for (const sub of SUBCOLLECTIONS) {
    const items = state[sub] as unknown[];
    for (const item of items) {
      const sanitized = sanitizeEntityForWrite(
        sub,
        uid,
        item,
        state.settings.defaultSalesTaxRate,
        state.settings.defaultPurchaseTaxRate,
        state.settings.currency,
      );
      const id = String(sanitized.id);
      ops.push({
        path: `workspaces/${uid}/${sub}/${id}`,
        sub,
        id,
        payload: {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }
  }

  for (let i = 0; i < ops.length; i += 400) {
    const chunk = ops.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const op of chunk) {
      batch.set(doc(db, 'workspaces', uid, op.sub, op.id), op.payload);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `workspaces/${uid}/seedBatch`);
    }
  }
}

function stripFirestoreMeta<T extends Record<string, unknown>>(docData: T): T {
  const copy = { ...docData };
  delete copy.ownerId;
  delete copy.createdAt;
  delete copy.updatedAt;
  return copy;
}

export function subscribeWorkspace(
  uid: string,
  onPatch: (patch: Partial<PersistedState>) => void,
  onSyncError: (err: Error) => void,
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  const wsPath = `workspaces/${uid}`;
  unsubs.push(
    onSnapshot(
      doc(db, 'workspaces', uid),
      (snap) => {
        if (!snap.exists() || snap.metadata.hasPendingWrites) return;
        const wsData = snap.data();
        onPatch({
          currentRole: wsData.currentRole as RoleId,
          activePlan: wsData.activePlan as string,
          trialStartIso: wsData.trialStartIso as string,
          permissionsMatrix: wsData.permissionsMatrix as PermissionsMatrix,
          settings: {
            companyName: wsData.companyName as string,
            taxNumber: wsData.taxNumber as string,
            crNumber: wsData.crNumber as string,
            phone: wsData.phone as string,
            email: wsData.email as string,
            address: wsData.address as string,
            currency: wsData.currency as PersistedState['settings']['currency'],
            enabledCurrencies: wsData.enabledCurrencies as CurrencyCode[] | undefined,
            exchangeRates: wsData.exchangeRates as Record<string, number> | undefined,
            lastRatesUpdate: wsData.lastRatesUpdate as string | undefined,
            isArabic: Boolean(wsData.isArabic),
            isDarkMode: Boolean(wsData.isDarkMode),
            monthlySalesGoal: Number(wsData.monthlySalesGoal ?? 120000),
            defaultSalesTaxRate: Number(wsData.defaultSalesTaxRate ?? 15),
            defaultPurchaseTaxRate: Number(wsData.defaultPurchaseTaxRate ?? 15),
            autoBackupDaily: Boolean(wsData.autoBackupDaily),
            lastBackupDate: wsData.lastBackupDate as string | undefined,
            autoCloudSync:
              typeof wsData.autoCloudSync === 'boolean' ? wsData.autoCloudSync : true,
            autoSyncIntervalMinutes: Number(wsData.autoSyncIntervalMinutes ?? 0),
          },
        });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, wsPath);
        } catch (wrapped) {
          onSyncError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      },
    ),
  );

  for (const sub of SUBCOLLECTIONS) {
    const subPath = `workspaces/${uid}/${sub}`;
    const q = query(collection(db, 'workspaces', uid, sub), where('ownerId', '==', uid));
    unsubs.push(
      onSnapshot(
        q,
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const items = snap.docs.map((d) => stripFirestoreMeta(d.data()));
          onPatch({ [sub]: items } as Partial<PersistedState>);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, subPath);
          } catch (wrapped) {
            onSyncError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
          }
        },
      ),
    );
  }

  return () => {
    for (const u of unsubs) u();
  };
}

function stableEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isTerminalStateLocked(sub: SubcollectionName, prevItem: Record<string, unknown>, isUserAdmin: boolean): boolean {
  if (isUserAdmin) return false;
  if (sub === 'invoices' && prevItem.status === 'paid') return true;
  if (sub === 'purchaseOrders' && prevItem.status === 'received') return true;
  if (sub === 'quotations' && (prevItem.status === 'accepted' || prevItem.status === 'rejected')) return true;
  return false;
}

export async function syncStateDiffToFirestore(
  uid: string,
  userEmail: string | null | undefined,
  prev: PersistedState,
  next: PersistedState,
): Promise<void> {
  const isUserAdmin = userEmail === 'alnwmbshyr1@gmail.com';
  const prevWs = sanitizeWorkspaceFields(uid, prev);
  const nextWs = sanitizeWorkspaceFields(uid, next);

  if (!stableEqual(prevWs, nextWs)) {
    const wsPath = `workspaces/${uid}`;
    try {
      await updateDoc(doc(db, 'workspaces', uid), {
        ...nextWs,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, wsPath);
    }
  }

  for (const sub of SUBCOLLECTIONS) {
    const prevList = (prev[sub] as { id: string }[]) ?? [];
    const nextList = (next[sub] as { id: string }[]) ?? [];
    const prevMap = new Map(prevList.map((item) => [sanitizeId(item.id, sub), item]));
    const nextMap = new Map(nextList.map((item) => [sanitizeId(item.id, sub), item]));

    for (const [id, nextRaw] of nextMap.entries()) {
      const nextSanitized = sanitizeEntityForWrite(
        sub,
        uid,
        nextRaw,
        next.settings.defaultSalesTaxRate,
        next.settings.defaultPurchaseTaxRate,
        next.settings.currency,
      );
      const prevRaw = prevMap.get(id);
      const docPath = `workspaces/${uid}/${sub}/${id}`;

      if (!prevRaw) {
        try {
          await setDoc(doc(db, 'workspaces', uid, sub, id), {
            ...nextSanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, docPath);
        }
      } else {
        const prevSanitized = sanitizeEntityForWrite(
          sub,
          uid,
          prevRaw,
          prev.settings.defaultSalesTaxRate,
          prev.settings.defaultPurchaseTaxRate,
          prev.settings.currency,
        );
        if (!stableEqual(prevSanitized, nextSanitized)) {
          if (isTerminalStateLocked(sub, prevSanitized, isUserAdmin)) {
            continue;
          }
          const patch: Record<string, unknown> = { ...nextSanitized };
          delete patch.id;
          delete patch.ownerId;
          if (
            sub === 'customers' &&
            prevSanitized.creditLimit !== undefined &&
            nextSanitized.creditLimit === undefined
          ) {
            patch.creditLimit = deleteField();
          }
          try {
            await updateDoc(doc(db, 'workspaces', uid, sub, id), {
              ...patch,
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, docPath);
          }
        }
      }
    }

    for (const id of prevMap.keys()) {
      if (!nextMap.has(id)) {
        const docPath = `workspaces/${uid}/${sub}/${id}`;
        try {
          await deleteDoc(doc(db, 'workspaces', uid, sub, id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, docPath);
        }
      }
    }
  }
}

export async function pushFullStateToCloud(uid: string, state: PersistedState): Promise<void> {
  const wsPath = `workspaces/${uid}`;
  const wsRef = doc(db, 'workspaces', uid);
  try {
    const snap = await getDoc(wsRef);
    if (!snap.exists()) {
      await setDoc(wsRef, {
        ...sanitizeWorkspaceFields(uid, state),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(wsRef, {
        ...sanitizeWorkspaceFields(uid, state),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, wsPath);
  }

  await seedAllSubcollections(uid, state);
}
