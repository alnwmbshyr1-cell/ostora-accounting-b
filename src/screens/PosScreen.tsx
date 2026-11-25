import React, { useMemo, useRef, useState } from 'react';
import {
  Barcode,
  CheckCircle2,
  CreditCard,
  Minus,
  Package,
  Plus,
  Printer,
  ShoppingCart,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { strings } from '../data/translations';
import { computeInvoiceTotalsHalala } from '../domain/accounting';
import { fromHalalas, toHalalas } from '../domain/halala';
import { LineItem, PaymentMethodType } from '../types/erp';
import { ScreenProps } from './types';

export const PosScreen: React.FC<ScreenProps> = ({ store, onPrintInvoice }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];
  const cur = state.settings.currency;

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(state.customers[0]?.id ?? '');
  const [walkInName, setWalkInName] = useState(isAr ? 'عميل نقدي سريع' : 'Walk-in Customer');
  const [productQuery, setProductQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<LineItem[]>([]);
  const [discountTotal, setDiscountTotal] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash');
  const [branchId, setBranchId] = useState<string>(state.settings.defaultBranchId ?? state.branches[0]?.id ?? '');
  const [warehouseId, setWarehouseId] = useState<string>(state.settings.defaultWarehouseId ?? state.warehouses[0]?.id ?? '');
  const [shiftName, setShiftName] = useState<string>(isAr ? 'الوردية الصباحية' : 'Morning Shift');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [creditError, setCreditError] = useState<string>('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  const selectedCustomer = useMemo(
    () => state.customers.find((c) => c.id === selectedCustomerId) ?? null,
    [state.customers, selectedCustomerId],
  );

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return state.products.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q),
    );
  }, [state.products, productQuery]);

  const addProductToCart = (productId: string) => {
    const prod = state.products.find((p) => p.id === productId);
    if (!prod) return;
    setCart((prev) => {
      const existing = prev.find((it) => it.productId === prod.id);
      if (existing) {
        return prev.map((it) => {
          if (it.productId !== prod.id) return it;
          const nextQty = it.qty + 1;
          return {
            ...it,
            qty: nextQty,
            total: fromHalalas(Math.round(toHalalas(it.unitPrice) * nextQty)),
          };
        });
      }
      return [
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
          costPrice: prod.cost,
          wholesalePrice: prod.wholesalePrice,
          taxRate: prod.taxRate ?? state.settings.defaultSalesTaxRate,
          expiryDate: prod.expiryDate,
        },
      ];
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

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => {
          if (it.productId !== productId) return it;
          const nextQty = Math.max(0, it.qty + delta);
          if (nextQty === 0) return null;
          return {
            ...it,
            qty: nextQty,
            total: fromHalalas(Math.round(toHalalas(it.unitPrice) * nextQty)),
          };
        })
        .filter((x): x is LineItem => x !== null),
    );
  };

  const subtotalH = cart.reduce((s, it) => s + toHalalas(it.total), 0);
  const subtotal = fromHalalas(subtotalH);
  const taxRate = state.settings.defaultSalesTaxRate ?? 15;
  const invStatus =
    paymentMethod === 'credit'
      ? 'pending'
      : paymentMethod === 'installment'
      ? 'partial'
      : 'paid';
  const totals = computeInvoiceTotalsHalala({
    subtotal,
    discountTotal,
    taxRate,
    fxRate: 1,
    paidAmount:
      invStatus === 'paid'
        ? undefined
        : Number(paidAmountInput || 0),
    status: invStatus,
  });

  const handleCheckout = (andPrint = false) => {
    setCreditError('');
    if (cart.length === 0) {
      actions.notify(isAr ? 'أضف صنفاً واحداً على الأقل' : 'Add at least one item');
      return;
    }
    const cName = selectedCustomer?.name ?? (walkInName.trim() || (isAr ? 'عميل نقدي' : 'Walk-in'));
    const cPhone = selectedCustomer?.phone ?? '';
    const branchObj = state.branches.find((b) => b.id === branchId);
    const whObj = state.warehouses.find((w) => w.id === warehouseId);

    const res = actions.saveInvoice({
      customerId: selectedCustomer?.id ?? '',
      customerName: cName,
      customerPhone: cPhone,
      description: `POS · ${cart.map((c) => `${c.productName} ×${c.qty}`).join('، ')}`,
      items: cart,
      subtotal,
      discountTotal,
      taxRate,
      currency: cur,
      exchangeRate: 1,
      status: invStatus,
      date: new Date().toISOString(),
      invoiceType: 'sales',
      branchId: branchObj?.id,
      branchName: branchObj ? (isAr ? branchObj.nameAr : branchObj.nameEn) : undefined,
      warehouseId: whObj?.id,
      warehouseName: whObj ? (isAr ? whObj.nameAr : whObj.nameEn) : undefined,
      salespersonName: state.currentRole,
      shiftName,
      paymentMethod,
      paidAmount: totals.paidAmount,
    });

    if (!res.ok) {
      if ('fiscalLocked' in res && res.fiscalLocked) {
        setCreditError(t.fiscalLockBlocked);
      } else if ('creditLimit' in res) {
        setCreditError(
          `${t.creditLimitExceeded} (${t.creditLimit}: ${res.creditLimit?.toLocaleString()} ${cur} · ${t.exceededBy}: ${res.exceededBy?.toLocaleString()} ${cur})`,
        );
      }
      return;
    }

    const latestInv = state.invoices[0];
    setCart([]);
    setDiscountTotal(0);
    setPaidAmountInput('');
    actions.notify(
      isAr ? `تم إتمام عملية البيع بنجاح (${totals.total.toLocaleString()} ${cur})` : `POS Sale completed (${totals.total.toLocaleString()} ${cur})`,
    );

    if (andPrint && onPrintInvoice) {
      // Synthesize immediate preview invoice using the newly calculated values if state update is async
      onPrintInvoice({
        id: latestInv ? `INV-${Number(latestInv.id.replace(/\D/g, '') || 1000) + 1}` : 'INV-POS',
        customerId: selectedCustomer?.id ?? '',
        customerName: cName,
        customerPhone: cPhone,
        description: `POS · ${cart.map((c) => `${c.productName} ×${c.qty}`).join('، ')}`,
        items: cart,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxRate,
        vat: totals.vat,
        total: totals.total,
        paidAmount: totals.paidAmount,
        remainingAmount: totals.remainingAmount,
        currency: cur,
        status: invStatus,
        date: new Date().toISOString(),
        invoiceType: 'sales',
        branchName: branchObj ? (isAr ? branchObj.nameAr : branchObj.nameEn) : undefined,
        warehouseName: whObj ? (isAr ? whObj.nameAr : whObj.nameEn) : undefined,
        shiftName,
        paymentMethod,
      });
    }
  };

  const paymentButtons: { id: PaymentMethodType; label: string }[] = [
    { id: 'cash', label: t.payCash },
    { id: 'pos_card', label: t.payCard },
    { id: 'transfer', label: t.payTransfer },
    { id: 'credit', label: t.payCredit },
    { id: 'installment', label: t.payInstallment },
  ];

  return (
    <div className="space-y-4">
      {/* Step 1: Customer, Shift & Barcode Header */}
      <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-4">
          <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
            <span>1. {t.client}</span>
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
          >
            <option value="">{isAr ? 'عميل نقدي سريع' : 'Walk-in Cash Customer'}</option>
            {state.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.debt > 0 ? `(${c.debt.toLocaleString()} ${cur})` : ''}
              </option>
            ))}
          </select>
        </div>

        {!selectedCustomerId && (
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

        <div className={selectedCustomerId ? 'md:col-span-4' : 'md:col-span-3'}>
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

        <div className={selectedCustomerId ? 'md:col-span-4' : 'md:col-span-3'}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {isAr ? 'الفرع' : 'Branch'}
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              >
                {state.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isAr ? b.nameAr : b.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {isAr ? 'الوردية' : 'Shift'}
              </label>
              <input
                type="text"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step 2 & Step 3 Split: Product Tap Grid + Cart & Checkout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Product Grid */}
        <div className="lg:col-span-7 rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold flex items-center gap-2">
              <Package className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
              <span>2. {isAr ? 'اختر الأصناف بضغطة واحدة' : 'Tap Products to Add'}</span>
            </h2>
            <input
              type="text"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder={t.search}
              className="w-full sm:w-56 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[540px] overflow-y-auto pe-1">
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
                      {p.price.toLocaleString()} {cur}
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

        {/* Cart & 3rd Click Payment Panel */}
        <div className="lg:col-span-5 rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 flex flex-col justify-between gap-4">
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
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-[#1F332B] rounded-2xl">
                {isAr ? 'اضغط على أي صنف أو امسح الباركود للإضافة' : 'Tap any product or scan barcode to start'}
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pe-1">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{item.productName}</p>
                      <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {item.unitPrice.toLocaleString()} × {item.qty} = {item.total.toLocaleString()} {cur}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.productId, -1)}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center text-xs font-mono font-bold tabular-nums">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.productId, 1)}
                        className="w-7 h-7 rounded-lg bg-[#0A3D2C] text-white flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.productId, -item.qty)}
                        className="p-1 text-red-500 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Payment & Totals */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-[#1F332B]">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {isAr ? 'المخزن' : 'Warehouse'}
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  {state.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isAr ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {isAr ? 'خصم إجمالي' : 'Discount'} ({cur})
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountTotal || ''}
                  onChange={(e) => setDiscountTotal(Math.max(0, Number(e.target.value || 0)))}
                  placeholder="0"
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>3. {t.paymentMethodLabel}</span>
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {paymentButtons.map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
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

            {invStatus === 'partial' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {isAr ? 'الدفعة المقدمة المدفوعة الآن' : 'Upfront Paid Amount'}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={paidAmountInput}
                  onChange={(e) => setPaidAmountInput(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            )}

            <div className="rounded-2xl bg-[#0A3D2C]/5 dark:bg-[#0A120F] border border-[#0A3D2C]/20 dark:border-[#1F332B] p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{t.subtotal}</span>
                <span className="font-mono font-bold tabular-nums">{totals.subtotal.toLocaleString()} {cur}</span>
              </div>
              {totals.discountTotal > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>{isAr ? 'الخصم' : 'Discount'}</span>
                  <span className="font-mono font-bold tabular-nums">-{totals.discountTotal.toLocaleString()} {cur}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">{t.vat} ({taxRate}%)</span>
                <span className="font-mono font-bold tabular-nums">{totals.vat.toLocaleString()} {cur}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold pt-1 border-t border-slate-200 dark:border-[#1F332B] text-[#0A3D2C] dark:text-[#C9A227]">
                <span>{t.total}</span>
                <span className="font-mono tabular-nums">{totals.total.toLocaleString()} {cur}</span>
              </div>
            </div>

            {creditError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-bold">
                {creditError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCheckout(false)}
                className="py-3.5 px-4 rounded-xl bg-[#0A3D2C] hover:bg-[#0D4F39] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <CheckCircle2 className="w-4 h-4 text-[#C9A227]" />
                <span>{isAr ? 'إتمام البيع والقيد' : 'Complete Sale'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleCheckout(true)}
                className="py-3.5 px-4 rounded-xl bg-[#C9A227] hover:bg-[#b5911f] text-slate-950 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>{isAr ? 'حفظ وطباعة ZATCA' : 'Pay & Print QR'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
