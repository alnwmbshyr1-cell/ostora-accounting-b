import React, { useMemo, useRef, useState } from 'react';
import {
  Barcode,
  Bookmark,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Delete,
  DoorOpen,
  Lock,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Printer,
  RotateCcw,
  ShoppingCart,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { QrMatrix } from '../components/QrMatrix';
import { strings } from '../data/translations';
import { computeInvoiceTotalsHalala } from '../domain/accounting';
import { fromHalalas, toHalalas } from '../domain/halala';
import { Invoice, LineItem, PaymentMethodType, UnitOfMeasure } from '../types/erp';
import { formatCurrency, formatCurrencyNumber } from '../utils/currencies';
import { buildWhatsAppLink } from '../utils/messaging';
import { buildZatcaTlvBase64 } from '../utils/zatca';
import { ScreenProps } from './types';

export const PosScreen: React.FC<ScreenProps> = ({ store, onPrintInvoice }) => {
  const { state, actions, posHeldCarts, posShift } = store;
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];
  const cur = state.settings.currency;

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('CASH');
  const [walkInName, setWalkInName] = useState(isAr ? 'عميل نقدي سريع' : 'Walk-in Customer');
  const [cashierName, setCashierName] = useState<string>(
    posShift?.cashierName ??
      state.employees.find((e) => e.role === 'cashier')?.name ??
      state.currentRole,
  );
  const [productQuery, setProductQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<LineItem[]>([]);
  const [selectedLineIdx, setSelectedLineIdx] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash');
  const [branchId, setBranchId] = useState<string>(
    posShift?.branchId ?? state.settings.defaultBranchId ?? state.branches[0]?.id ?? '',
  );
  const [warehouseId, setWarehouseId] = useState<string>(
    state.settings.defaultWarehouseId ?? state.warehouses[0]?.id ?? '',
  );
  const [shiftName, setShiftName] = useState<string>(isAr ? 'الوردية الصباحية' : 'Morning Shift');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [numpadTarget, setNumpadTarget] = useState<'paid' | 'qty'>('paid');
  const [creditError, setCreditError] = useState<string>('');

  // Modals: Held Carts, Drawer/Shift, Quick Return, Thermal 58/80mm Receipt
  const [heldModalOpen, setHeldModalOpen] = useState(false);
  const [drawerModalOpen, setDrawerModalOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('500');
  const [closingCashInput, setClosingCashInput] = useState('');
  const [drawerNotes, setDrawerNotes] = useState('');
  const [quickReturnOpen, setQuickReturnOpen] = useState(false);
  const [returnInvId, setReturnInvId] = useState(state.invoices[0]?.id ?? '');
  const [returnProdId, setReturnProdId] = useState(state.products[0]?.id ?? '');
  const [returnQty, setReturnQty] = useState('1');
  const [thermalInv, setThermalInv] = useState<Invoice | null>(null);
  const [thermalWidth, setThermalWidth] = useState<'58mm' | '80mm'>('80mm');

  const barcodeRef = useRef<HTMLInputElement>(null);

  const selectedCustomer = useMemo(
    () =>
      selectedCustomerId && selectedCustomerId !== 'CASH'
        ? state.customers.find((c) => c.id === selectedCustomerId) ?? null
        : null,
    [state.customers, selectedCustomerId],
  );

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return state.products.filter(
      (p) =>
        p.status !== 'paused' &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          (p.nameEn ?? '').toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q)),
    );
  }, [state.products, productQuery]);

  const recalcItem = (it: LineItem, nextQty: number, nextPrice?: number, nextUnit?: UnitOfMeasure): LineItem => {
    const qty = Math.max(1, nextQty);
    const unitPrice = nextPrice ?? it.unitPrice;
    const grossH = Math.round(toHalalas(unitPrice) * qty);
    const discPct = it.discountPercent ?? 0;
    const discH = Math.round((grossH * discPct) / 100);
    return {
      ...it,
      qty,
      unitPrice,
      unit: nextUnit ?? it.unit ?? 'piece',
      discountAmount: fromHalalas(discH),
      total: fromHalalas(Math.max(0, grossH - discH)),
    };
  };

  const addProductToCart = (productId: string) => {
    const prod = state.products.find((p) => p.id === productId);
    if (!prod) return;
    setCart((prev) => {
      const existingIdx = prev.findIndex((it) => it.productId === prod.id);
      if (existingIdx >= 0) {
        setSelectedLineIdx(existingIdx);
        return prev.map((it, idx) => (idx === existingIdx ? recalcItem(it, it.qty + 1) : it));
      }
      const next: LineItem[] = [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          qty: 1,
          unitPrice: prod.price,
          total: prod.price,
          barcode: prod.barcode,
          imageBase64: prod.imageBase64,
          category: prod.category,
          unit: prod.unit ?? 'piece',
          availableStock: prod.qty,
          costPrice: prod.cost,
          wholesalePrice: prod.wholesalePrice,
          taxRate: prod.isTaxable === false ? 0 : prod.taxRate ?? state.settings.defaultSalesTaxRate ?? 15,
          expiryDate: prod.expiryDate,
        },
      ];
      setSelectedLineIdx(next.length - 1);
      return next;
    });
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim().toLowerCase();
    if (!code) return;
    const match = state.products.find(
      (p) => p.barcode.toLowerCase() === code || p.sku.toLowerCase() === code || p.id.toLowerCase() === code,
    );
    if (match) {
      addProductToCart(match.id);
      setBarcodeInput('');
      barcodeRef.current?.focus();
    } else {
      actions.notify(isAr ? `لم يتم العثور على باركود: ${barcodeInput}` : `Barcode not found: ${barcodeInput}`);
    }
  };

  const updateCartItem = (idx: number, patch: { qty?: number; unitPrice?: number; unit?: UnitOfMeasure }) => {
    setCart((prev) =>
      prev
        .map((it, i) => {
          if (i !== idx) return it;
          if (patch.qty !== undefined && patch.qty <= 0) return null;
          return recalcItem(
            it,
            patch.qty ?? it.qty,
            patch.unitPrice ?? it.unitPrice,
            patch.unit ?? it.unit,
          );
        })
        .filter((x): x is LineItem => x !== null),
    );
  };

  const subtotalH = cart.reduce((s, it) => s + toHalalas(it.total), 0);
  const subtotal = fromHalalas(subtotalH);
  const discPctNum = Math.max(0, Math.min(100, parseFloat(discountPercent) || 0));
  const discountTotal = fromHalalas(Math.round((subtotalH * discPctNum) / 100));
  const taxRate = state.settings.defaultSalesTaxRate ?? 15;
  const invStatus =
    paymentMethod === 'credit'
      ? 'pending'
      : paymentMethod === 'installment'
      ? 'partial'
      : 'paid';

  const parsedPaidInput = parseFloat(paidAmountInput);
  const totals = computeInvoiceTotalsHalala({
    subtotal,
    discountTotal,
    taxRate,
    fxRate: 1,
    paidAmount:
      invStatus === 'paid'
        ? Number.isFinite(parsedPaidInput)
          ? parsedPaidInput
          : undefined
        : Number(paidAmountInput || 0),
    status: invStatus,
  });

  const paidNum =
    invStatus === 'paid' && !Number.isFinite(parsedPaidInput)
      ? totals.total
      : Math.max(0, parsedPaidInput || 0);
  const changeDue = Math.max(0, fromHalalas(toHalalas(paidNum) - toHalalas(totals.total)));

  // Shift report stats
  const shiftStats = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const sinceIso = posShift?.openedAt?.slice(0, 10) ?? todayKey;
    const posInvoices = state.invoices.filter(
      (inv) =>
        inv.status !== 'cancelled' &&
        inv.status !== 'draft' &&
        inv.date.slice(0, 10) >= sinceIso &&
        inv.description.startsWith('POS'),
    );
    const cashH = posInvoices
      .filter((i) => i.paymentMethod === 'cash')
      .reduce((s, i) => s + toHalalas(i.paidAmount ?? i.total), 0);
    const cardH = posInvoices
      .filter((i) => i.paymentMethod !== 'cash' && i.paymentMethod !== 'credit')
      .reduce((s, i) => s + toHalalas(i.paidAmount ?? i.total), 0);
    const creditH = posInvoices
      .filter((i) => i.paymentMethod === 'credit')
      .reduce((s, i) => s + toHalalas(i.remainingAmount ?? i.total), 0);
    const openingH = toHalalas(posShift?.openingCash ?? 0);
    return {
      count: posInvoices.length,
      cashSales: fromHalalas(cashH),
      cardSales: fromHalalas(cardH),
      creditSales: fromHalalas(creditH),
      expectedCash: fromHalalas(openingH + cashH),
    };
  }, [state.invoices, posShift]);

  const handleNumpadPress = (key: string) => {
    if (numpadTarget === 'qty') {
      const target = cart[selectedLineIdx];
      if (!target) return;
      if (key === 'C') {
        updateCartItem(selectedLineIdx, { qty: 1 });
        return;
      }
      if (key === '⌫') {
        const s = String(target.qty);
        const next = s.length > 1 ? Number(s.slice(0, -1)) : 1;
        updateCartItem(selectedLineIdx, { qty: Math.max(1, next) });
        return;
      }
      if (key === '.') return;
      const next = Number(`${target.qty === 1 ? '' : target.qty}${key}`);
      if (Number.isFinite(next) && next > 0) {
        updateCartItem(selectedLineIdx, { qty: Math.min(9999, next) });
      }
      return;
    }

    if (key === 'C') {
      setPaidAmountInput('');
      return;
    }
    if (key === '⌫') {
      setPaidAmountInput((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '.' && paidAmountInput.includes('.')) return;
    setPaidAmountInput((prev) => `${prev}${key}`);
  };

  const handleCheckout = (mode: 'none' | 'thermal' | 'a4') => {
    setCreditError('');
    if (cart.length === 0) {
      actions.notify(isAr ? 'أضف صنفاً واحداً على الأقل' : 'Add at least one item');
      return;
    }
    if (paymentMethod === 'credit' && selectedCustomerId === 'CASH') {
      setCreditError(
        isAr ? 'اختر عميلاً مسجلاً للبيع الآجل (لا يمكن البيع آجل لعميل نقدي)' : 'Select a registered customer for credit sale',
      );
      return;
    }

    const cName = selectedCustomer?.name ?? (walkInName.trim() || (isAr ? 'عميل نقدي سريع' : 'Walk-in Cash'));
    const cPhone = selectedCustomer?.phone ?? '';
    const branchObj = state.branches.find((b) => b.id === branchId);
    const whObj = state.warehouses.find((w) => w.id === warehouseId);
    const desc = `POS · ${cart.map((c) => `${c.productName} ×${c.qty}`).join('، ')}`;
    const itemsCopy = [...cart];

    const res = actions.saveInvoice({
      customerId: selectedCustomer?.id ?? 'CASH',
      customerName: cName,
      customerPhone: cPhone,
      description: desc,
      items: itemsCopy,
      subtotal,
      invoiceDiscountPercent: discPctNum,
      discountTotal,
      taxRate,
      currency: cur,
      exchangeRate: 1,
      status: invStatus,
      date: new Date().toISOString(),
      invoiceType: 'sales',
      invoiceDocKind: selectedCustomer ? 'tax' : 'simplified',
      branchId: branchObj?.id,
      branchName: branchObj ? (isAr ? branchObj.nameAr : branchObj.nameEn) : undefined,
      warehouseId: whObj?.id,
      warehouseName: whObj ? (isAr ? whObj.nameAr : whObj.nameEn) : undefined,
      salespersonName: cashierName,
      shiftName,
      paymentMethod,
      paidAmount: Math.min(totals.total, paidNum),
    });

    if (!res.ok) {
      if ('fiscalLocked' in res && res.fiscalLocked) {
        setCreditError(t.fiscalLockBlocked);
      } else if ('creditLimit' in res) {
        setCreditError(
          `${t.creditLimitExceeded} (${t.creditLimit}: ${formatCurrency(res.creditLimit ?? 0, cur, { isAr })} · ${t.exceededBy}: ${formatCurrency(res.exceededBy ?? 0, cur, { isAr })})`,
        );
      }
      return;
    }

    const receiptInvoice: Invoice = {
      id: res.invoiceId,
      customerId: selectedCustomer?.id ?? 'CASH',
      customerName: cName,
      customerPhone: cPhone,
      description: desc,
      items: itemsCopy,
      subtotal: totals.subtotal,
      invoiceDiscountPercent: discPctNum,
      discountTotal: totals.discountTotal,
      taxRate,
      vat: totals.vat,
      total: totals.total,
      paidAmount: paidNum,
      remainingAmount: totals.remainingAmount,
      currency: cur,
      status: invStatus,
      date: new Date().toISOString(),
      invoiceType: 'sales',
      invoiceDocKind: selectedCustomer ? 'tax' : 'simplified',
      branchName: branchObj ? (isAr ? branchObj.nameAr : branchObj.nameEn) : undefined,
      warehouseName: whObj ? (isAr ? whObj.nameAr : whObj.nameEn) : undefined,
      salespersonName: cashierName,
      shiftName,
      paymentMethod,
    };

    setCart([]);
    setDiscountPercent('0');
    setPaidAmountInput('');

    if (res.lowStockItems && res.lowStockItems.length > 0) {
      actions.notify(
        isAr
          ? `تم البيع (${formatCurrency(totals.total, cur, { isAr })}) · تنبيه مخزون منخفض: ${res.lowStockItems.join('، ')}`
          : `POS Sale done · Low stock alert: ${res.lowStockItems.join(', ')}`,
        4500,
      );
    } else {
      actions.notify(
        isAr
          ? `تم إتمام البيع بنجاح (${formatCurrency(totals.total, cur, { isAr })})`
          : `POS Sale completed (${formatCurrency(totals.total, cur, { isAr })})`,
      );
    }

    if (mode === 'thermal') {
      setThermalInv(receiptInvoice);
    } else if (mode === 'a4' && onPrintInvoice) {
      onPrintInvoice(receiptInvoice);
    }
  };

  const paymentButtons: { id: PaymentMethodType; label: string }[] = [
    { id: 'cash', label: t.payCash },
    { id: 'pos_card', label: t.payCard },
    { id: 'transfer', label: t.payTransfer },
    { id: 'apple_pay', label: t.payApplePay },
    { id: 'credit', label: t.payCredit },
    { id: 'installment', label: t.payInstallment },
  ];

  const handleHoldCart = () => {
    if (cart.length === 0) {
      actions.notify(isAr ? 'السلة فارغة' : 'Cart is empty');
      return;
    }
    const label = selectedCustomer?.name ?? (walkInName.trim() || (isAr ? 'عميل نقدي' : 'Walk-in'));
    actions.holdPosCart({
      label,
      customerId: selectedCustomerId,
      branchId,
      warehouseId,
      paymentMethod,
      discountPercent: discPctNum,
      items: cart.map((c) => ({
        productId: c.productId,
        name: c.productName,
        price: c.unitPrice,
        qty: c.qty,
        unit: c.unit ?? 'piece',
        costPrice: c.costPrice,
        barcode: c.barcode,
        taxRate: c.taxRate,
      })),
    });
    setCart([]);
    setDiscountPercent('0');
    setPaidAmountInput('');
    actions.notify(isAr ? 'تم تعليق الفاتورة في الذاكرة' : 'Cart placed on hold');
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar: Shift Drawer, Held Carts, Quick Return */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] px-4 py-3">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`px-2.5 py-1 rounded-lg font-extrabold ${
              posShift?.isOpen
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-500/15 text-amber-700 dark:text-[#C9A227]'
            }`}
          >
            {posShift?.isOpen
              ? isAr
                ? `الدرج مفتوح · ${posShift.cashierName}`
                : `Drawer Open · ${posShift.cashierName}`
              : isAr
              ? 'الدرج مغلق'
              : 'Drawer Closed'}
          </span>
          <span className="text-slate-500 font-mono hidden sm:inline">
            {isAr ? 'الافتتاحي:' : 'Opening:'} {formatCurrency(posShift?.openingCash ?? 0, cur, { isAr })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleHoldCart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F332B] hover:border-[#C9A227] text-xs font-bold cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>{t.holdCart}</span>
          </button>
          <button
            type="button"
            onClick={() => setHeldModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-800 dark:text-[#C9A227] text-xs font-extrabold cursor-pointer"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>{t.recallCart} ({posHeldCarts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setQuickReturnOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-bold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.returnInPos}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setClosingCashInput(String(shiftStats.expectedCash));
              setDrawerModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
          >
            {posShift?.isOpen ? <Lock className="w-3.5 h-3.5 text-[#C9A227]" /> : <DoorOpen className="w-3.5 h-3.5 text-[#C9A227]" />}
            <span>{posShift?.isOpen ? `${t.closeDrawer} / ${t.shiftReport}` : t.openDrawer}</span>
          </button>
        </div>
      </div>

      {/* Step 1: Customer, Cashier, Branch, Warehouse & Barcode */}
      <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-3">
          <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
            <span>{t.client} *</span>
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
          >
            <option value="CASH">{isAr ? 'عميل نقدي سريع' : 'Walk-in Cash Customer'}</option>
            {state.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.debt > 0 ? `(${formatCurrency(c.debt, cur, { isAr })})` : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedCustomerId === 'CASH' && (
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              {isAr ? 'اسم العميل النقدي' : 'Walk-in Name'}
            </label>
            <input
              type="text"
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />
          </div>
        )}

        <div className={selectedCustomerId === 'CASH' ? 'md:col-span-3' : 'md:col-span-4'}>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            {isAr ? 'مسح / إدخال الباركود السريع' : 'Quick Barcode Scan'}
          </label>
          <form onSubmit={handleBarcodeSubmit} className="flex gap-1.5">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="628100000123..."
                className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
            >
              +
            </button>
          </form>
        </div>

        <div className={selectedCustomerId === 'CASH' ? 'md:col-span-4' : 'md:col-span-5'}>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.branch}</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-2 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              >
                {state.branches.map((b) => (
                  <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.warehouse}</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-2 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              >
                {state.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{isAr ? w.nameAr : w.nameEn}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'الكاشير' : 'Cashier'}</label>
              <input
                type="text"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                className="w-full px-2 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Touch Products + Cart + Numpad & Payment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Product Grid */}
        <div className="lg:col-span-6 rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold flex items-center gap-2">
              <Package className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
              <span>{isAr ? 'اختر الأصناف باللمس' : 'Tap Products to Add'}</span>
            </h2>
            <input
              type="text"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder={t.search}
              className="w-full sm:w-56 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[580px] overflow-y-auto pe-1">
            {filteredProducts.map((p) => {
              const outOfStock = p.qty <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProductToCart(p.id)}
                  className="text-start p-3 rounded-2xl border border-slate-200 dark:border-[#1F332B] bg-slate-50/70 dark:bg-[#0A120F] hover:border-[#C9A227] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-extrabold leading-snug line-clamp-2">{p.name}</span>
                    {p.imageBase64 && (
                      <img
                        src={p.imageBase64}
                        alt={p.name}
                        className="w-9 h-9 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-[#1F332B]"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/70 dark:border-[#1F332B]">
                    <span className="font-mono text-xs font-extrabold text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
                      {formatCurrency(p.price, cur, { isAr })}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${
                        outOfStock
                          ? 'bg-red-500/10 text-red-600'
                          : p.qty <= (p.minStock ?? 10)
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {p.qty}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cart + Numpad + Checkout */}
        <div className="lg:col-span-6 rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
                <span>{isAr ? 'سلة نقطة البيع' : 'POS Cart'}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227]">
                  {cart.reduce((s, c) => s + c.qty, 0)}
                </span>
              </h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.clearSelection}</span>
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-[#1F332B] rounded-2xl">
                {isAr ? 'اضغط على أي صنف أو امسح الباركود للإضافة' : 'Tap any product or scan barcode to start'}
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
                {cart.map((item, idx) => (
                  <div
                    key={`${item.productId}-${idx}`}
                    onClick={() => setSelectedLineIdx(idx)}
                    className={`p-2.5 rounded-xl border transition-colors cursor-pointer space-y-1.5 ${
                      selectedLineIdx === idx
                        ? 'bg-emerald-50/70 dark:bg-[#192822] border-[#0A3D2C] dark:border-[#C9A227]'
                        : 'bg-slate-50 dark:bg-[#0A120F] border-slate-200 dark:border-[#1F332B]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold truncate flex-1">{item.productName}</span>
                      <span className="font-mono text-xs font-extrabold tabular-nums text-[#0A3D2C] dark:text-[#C9A227]">
                        {formatCurrency(item.total, cur, { isAr })}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateCartItem(idx, { qty: 0 });
                        }}
                        className="p-1 text-red-500 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <select
                        value={item.unit ?? 'piece'}
                        onChange={(e) => updateCartItem(idx, { unit: e.target.value as UnitOfMeasure })}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-[11px]"
                      >
                        <option value="piece">{t.unitPiece}</option>
                        <option value="carton">{t.unitCarton}</option>
                        <option value="kg">{t.unitKg}</option>
                        <option value="meter">{t.unitMeter}</option>
                        <option value="liter">{t.unitLiter}</option>
                        <option value="box">{t.unitBox}</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateCartItem(idx, { unitPrice: Math.max(0, Number(e.target.value || 0)) })}
                        aria-label={t.price}
                        className="w-20 px-2 py-1 rounded-lg bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] font-mono text-[11px]"
                      />
                      <div className="ms-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateCartItem(idx, { qty: item.qty - 1 });
                          }}
                          className="w-6 h-6 rounded-lg bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-mono font-bold tabular-nums">{item.qty}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateCartItem(idx, { qty: item.qty + 1 });
                          }}
                          className="w-6 h-6 rounded-lg bg-[#0A3D2C] text-white flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discount, Paid, Change Due, Numpad & Payment Buttons */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-[#1F332B]">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
              {/* Inputs & Payment Methods */}
              <div className="sm:col-span-7 space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">{t.cashierDiscount}</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">{isAr ? 'المدفوع' : 'Paid'} ({cur})</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={paidAmountInput}
                      onFocus={() => setNumpadTarget('paid')}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                      placeholder={totals.total.toFixed(2)}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">{isAr ? 'الوردية' : 'Shift'}</label>
                    <input
                      type="text"
                      value={shiftName}
                      onChange={(e) => setShiftName(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-[#C9A227]" />
                    <span>{t.paymentMethodLabel}</span>
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {paymentButtons.map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                          paymentMethod === pm.id
                            ? 'bg-[#0A3D2C] text-white border-[#C9A227]'
                            : 'bg-slate-50 dark:bg-[#0A120F] border-slate-200 dark:border-[#1F332B] text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#0A3D2C]/5 dark:bg-[#0A120F] border border-[#0A3D2C]/20 dark:border-[#1F332B] p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t.subtotal}</span>
                    <span className="font-mono font-bold tabular-nums">{formatCurrency(totals.subtotal, cur, { isAr })}</span>
                  </div>
                  {totals.discountTotal > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>{isAr ? `الخصم (${discPctNum}%)` : `Discount (${discPctNum}%)`}</span>
                      <span className="font-mono font-bold tabular-nums">-{formatCurrency(totals.discountTotal, cur, { isAr })}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t.vat} ({taxRate}%)</span>
                    <span className="font-mono font-bold tabular-nums">{formatCurrency(totals.vat, cur, { isAr })}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold pt-1 border-t border-slate-200 dark:border-[#1F332B] text-[#0A3D2C] dark:text-[#C9A227]">
                    <span>{t.total}</span>
                    <span className="font-mono tabular-nums">{formatCurrency(totals.total, cur, { isAr })}</span>
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                      <span>{isAr ? 'الباقي للعميل' : 'Change Due'}</span>
                      <span className="font-mono tabular-nums">{formatCurrency(changeDue, cur, { isAr })}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Touch Numeric Keypad */}
              <div className="sm:col-span-5 bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] rounded-2xl p-2.5 space-y-2">
                <div className="flex gap-1 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setNumpadTarget('paid')}
                    className={`flex-1 py-1 rounded-lg cursor-pointer ${numpadTarget === 'paid' ? 'bg-[#0A3D2C] text-white' : 'bg-white dark:bg-[#121E19] text-slate-500'}`}
                  >
                    {isAr ? 'المدفوع' : 'Paid'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNumpadTarget('qty')}
                    className={`flex-1 py-1 rounded-lg cursor-pointer ${numpadTarget === 'qty' ? 'bg-[#0A3D2C] text-white' : 'bg-white dark:bg-[#121E19] text-slate-500'}`}
                  >
                    {t.qty}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleNumpadPress(k)}
                      className="py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] font-mono text-sm font-extrabold hover:border-[#C9A227] flex items-center justify-center cursor-pointer"
                    >
                      {k === '⌫' ? <Delete className="w-4 h-4" /> : k}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleNumpadPress('C')}
                    className="col-span-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 text-xs font-extrabold cursor-pointer"
                  >
                    C · {isAr ? 'مسح' : 'Clear'}
                  </button>
                </div>
              </div>
            </div>

            {creditError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-bold">
                {creditError}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleCheckout('none')}
                className="py-3 px-3 rounded-xl bg-[#0A3D2C] hover:bg-[#0D4F39] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <CheckCircle2 className="w-4 h-4 text-[#C9A227]" />
                <span>{isAr ? 'إتمام البيع' : 'Complete Sale'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleCheckout('thermal')}
                className="py-3 px-3 rounded-xl bg-[#C9A227] hover:bg-[#b5911f] text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>{isAr ? 'حراري 58/80mm' : 'Thermal Print'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleCheckout('a4')}
                className="py-3 px-3 rounded-xl border border-[#0A3D2C] text-[#0A3D2C] dark:text-[#C9A227] dark:border-[#C9A227] text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>A4 QR</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Held Carts Modal */}
      {heldModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-md w-full p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">{t.recallCart}</h3>
              <button onClick={() => setHeldModalOpen(false)} className="p-1 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {posHeldCarts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">{t.noData}</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {posHeldCarts.map((hc) => (
                  <div key={hc.id} className="p-3 rounded-xl border border-slate-200 dark:border-[#1F332B] flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold truncate">{hc.label}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {hc.items.length} {t.product} · {new Date(hc.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const recalled = actions.recallPosCart(hc.id);
                          if (recalled) {
                            setSelectedCustomerId(recalled.customerId || 'CASH');
                            setBranchId(recalled.branchId || branchId);
                            setWarehouseId(recalled.warehouseId || warehouseId);
                            setPaymentMethod(recalled.paymentMethod);
                            setDiscountPercent(String(recalled.discountPercent));
                            setCart(
                              recalled.items.map((it) => ({
                                productId: it.productId,
                                productName: it.name,
                                qty: it.qty,
                                unitPrice: it.price,
                                unit: it.unit,
                                costPrice: it.costPrice,
                                barcode: it.barcode,
                                taxRate: it.taxRate,
                                total: fromHalalas(Math.round(toHalalas(it.price) * it.qty)),
                              })),
                            );
                            setHeldModalOpen(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
                      >
                        {isAr ? 'استدعاء' : 'Recall'}
                      </button>
                      <button
                        type="button"
                        onClick={() => actions.deleteHeldPosCart(hc.id)}
                        className="p-1.5 rounded-lg text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drawer Open/Close & Shift Report Modal */}
      {drawerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">{t.shiftReport}</h3>
              <button onClick={() => setDrawerModalOpen(false)} className="p-1 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] p-3.5 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between"><span>{isAr ? 'عدد فواتير POS:' : 'POS Invoices:'}</span><span className="font-bold">{shiftStats.count}</span></div>
              <div className="flex justify-between"><span>{t.payCash}:</span><span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(shiftStats.cashSales, cur, { isAr })}</span></div>
              <div className="flex justify-between"><span>{isAr ? 'الشبكة والتحويل:' : 'Card & Transfer:'}</span><span className="font-bold">{formatCurrency(shiftStats.cardSales, cur, { isAr })}</span></div>
              <div className="flex justify-between"><span>{t.payCredit}:</span><span className="font-bold text-amber-600">{formatCurrency(shiftStats.creditSales, cur, { isAr })}</span></div>
              <div className="flex justify-between border-t border-slate-200 dark:border-[#1F332B] pt-1.5 text-sm font-extrabold">
                <span>{isAr ? 'النقد المتوقع بالدرج:' : 'Expected Drawer Cash:'}</span>
                <span className="text-[#0A3D2C] dark:text-[#C9A227]">{formatCurrency(shiftStats.expectedCash, cur, { isAr })}</span>
              </div>
            </div>
            {!posShift?.isOpen ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1">{isAr ? 'الرصيد الافتتاحي بالدرج' : 'Opening Drawer Cash'}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    actions.openPosShift(cashierName, branchId, parseFloat(openingCashInput) || 0);
                    setDrawerModalOpen(false);
                    actions.notify(isAr ? 'تم فتح الدرج وبداية الوردية' : 'Cash drawer opened');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
                >
                  {t.openDrawer}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1">{isAr ? 'الجرد الفعلي للنقد بالدرج' : 'Actual Closing Cash'}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={closingCashInput}
                    onChange={(e) => setClosingCashInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono"
                  />
                </div>
                <input
                  type="text"
                  value={drawerNotes}
                  onChange={(e) => setDrawerNotes(e.target.value)}
                  placeholder={t.notes}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                  >
                    {t.printPdf}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      actions.closePosShift(parseFloat(closingCashInput) || 0, drawerNotes);
                      setDrawerModalOpen(false);
                      actions.notify(isAr ? 'تم إغلاق الوردية والدرج بنجاح' : 'POS shift closed');
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                  >
                    {t.closeDrawer}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Return Modal in POS */}
      {quickReturnOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-md w-full p-6 space-y-3">
            <h3 className="text-base font-extrabold">{t.returnInPos}</h3>
            <select
              value={returnInvId}
              onChange={(e) => setReturnInvId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            >
              {state.invoices.slice(0, 20).map((inv) => (
                <option key={inv.id} value={inv.id}>{inv.id} · {inv.customerName}</option>
              ))}
            </select>
            <select
              value={returnProdId}
              onChange={(e) => setReturnProdId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            >
              {state.products.map((pr) => (
                <option key={pr.id} value={pr.id}>{pr.name} ({formatCurrency(pr.price, cur, { isAr })})</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={returnQty}
              onChange={(e) => setReturnQty(e.target.value)}
              placeholder={t.qty}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
            />
            <div className="flex gap-2 pt-1">
              <button onClick={() => setQuickReturnOpen(false)} className="flex-1 py-2.5 rounded-xl border text-xs font-bold cursor-pointer">{t.cancel}</button>
              <button
                type="button"
                onClick={() => {
                  const inv = state.invoices.find((x) => x.id === returnInvId);
                  const prod = state.products.find((p) => p.id === returnProdId);
                  const qty = Math.max(1, parseInt(returnQty, 10) || 1);
                  if (!prod) return;
                  const amt = fromHalalas(Math.round(toHalalas(prod.price) * qty * (1 + taxRate / 100)));
                  actions.saveReturn({
                    type: 'sales',
                    originalDocId: inv?.id ?? 'POS',
                    partyName: inv?.customerName ?? walkInName,
                    partyPhone: inv?.customerPhone ?? '',
                    productId: prod.id,
                    productName: prod.name,
                    qty,
                    unitPrice: prod.price,
                    amount: amt,
                    reason: 'changed_mind',
                    itemCondition: 'good_restock',
                    compensationMethod: 'cash_refund',
                    approved: true,
                    warehouseId,
                    branchId,
                    notes: 'POS Instant Return',
                    date: new Date().toISOString(),
                  });
                  setQuickReturnOpen(false);
                  actions.notify(isAr ? 'تم تسجيل المرتجع واسترداد النقدية' : 'POS return & cash refund recorded');
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt 58mm / 80mm Print Modal */}
      {thermalInv && (() => {
        const tlv = buildZatcaTlvBase64(
          state.settings.companyName,
          state.settings.taxNumber,
          thermalInv.date,
          thermalInv.total.toFixed(2),
          thermalInv.vat.toFixed(2),
        );
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-4 space-y-3 my-auto" style={{ width: thermalWidth === '58mm' ? '260px' : '340px' }}>
              <div className="no-print flex items-center justify-between gap-2 pb-2 border-b">
                <div className="flex gap-1">
                  {(['58mm', '80mm'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setThermalWidth(w)}
                      className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${thermalWidth === w ? 'bg-[#0A3D2C] text-white' : 'bg-slate-100'}`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setThermalInv(null)} className="p-1 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center space-y-1 text-xs">
                <p className="font-extrabold text-sm">{state.settings.companyName}</p>
                <p className="font-mono text-[10px]">VAT: {state.settings.taxNumber}</p>
                <p className="font-mono text-[10px]">{thermalInv.id} · {new Date(thermalInv.date).toLocaleString()}</p>
                <p className="font-bold">{thermalInv.customerName}</p>
              </div>

              <div className="border-y border-dashed border-slate-400 py-2 space-y-1 text-[11px]">
                {(thermalInv.items ?? []).map((it, idx) => (
                  <div key={idx} className="flex justify-between gap-2 font-mono">
                    <span className="truncate">{it.productName} ×{it.qty}</span>
                    <span>{formatCurrencyNumber(it.total, thermalInv.currency ?? cur)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between"><span>{t.subtotal}</span><span>{formatCurrencyNumber(thermalInv.subtotal, thermalInv.currency ?? cur)}</span></div>
                {(thermalInv.discountTotal ?? 0) > 0 && (
                  <div className="flex justify-between"><span>{isAr ? 'الخصم' : 'Disc'}</span><span>-{formatCurrencyNumber(thermalInv.discountTotal ?? 0, thermalInv.currency ?? cur)}</span></div>
                )}
                <div className="flex justify-between"><span>{t.vat15}</span><span>{formatCurrencyNumber(thermalInv.vat, thermalInv.currency ?? cur)}</span></div>
                <div className="flex justify-between font-extrabold text-sm border-t border-dashed border-slate-400 pt-1">
                  <span>{t.total}</span>
                  <span>{formatCurrency(thermalInv.total, thermalInv.currency ?? cur, { isAr })}</span>
                </div>
              </div>

              <div className="flex flex-col items-center pt-1">
                <QrMatrix data={tlv} size={110} />
                <span className="text-[10px] text-slate-500 mt-1">ZATCA Simplified Tax Invoice</span>
              </div>

              <div className="no-print flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printPdf}</span>
                </button>
                <a
                  href={buildWhatsAppLink(
                    thermalInv.customerPhone,
                    `${state.settings.companyName}\n${thermalInv.id}\n${t.total}: ${formatCurrency(thermalInv.total, thermalInv.currency ?? cur, { isAr })}`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{t.whatsapp}</span>
                </a>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
