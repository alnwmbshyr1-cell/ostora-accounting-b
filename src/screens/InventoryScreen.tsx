import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Download,
  Edit2,
  History,
  ImagePlus,
  Plus,
  ScanBarcode,
  Search,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { DataImportModal } from '../components/DataImportModal';
import { BarcodeSvg } from '../components/QrMatrix';
import { DEFAULT_PRODUCT_IMAGE } from '../constants/permissions';
import { strings } from '../data/translations';
import { computeProfitAnalytics } from '../domain/accounting';
import { toHalalas } from '../domain/halala';
import { Product, UnitOfMeasure } from '../types/erp';
import { generateEan13 } from '../utils/barcode';
import { downloadTextFile } from '../utils/export';
import { compressImageToBase64 } from '../utils/image';
import { ScreenProps } from './types';

export const InventoryScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];
  const canDelete = state.currentRole !== 'accountant';

  const [invSearch, setInvSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [whFilter, setWhFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'service'>('all');
  const [stockAlertFilter, setStockAlertFilter] = useState<'all' | 'low' | 'expiring'>('all');

  const [scanModal, setScanModal] = useState<'search' | 'product' | null>(null);
  const [scanCodeInput, setScanCodeInput] = useState('');
  const [ledgerProductId, setLedgerProductId] = useState<string | null>(null);
  const [prdModal, setPrdModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [formError, setFormError] = useState('');
  const [prdForm, setPrdForm] = useState({
    name: '',
    nameEn: '',
    description: '',
    brand: '',
    sku: '',
    barcode: '',
    imageBase64: '',
    openingQty: '0',
    qty: '15',
    cost: '100',
    price: '150',
    retailPrice: '',
    vipPrice: '',
    minPrice: '',
    category: '',
    unit: 'piece' as UnitOfMeasure,
    subUnit: '',
    subUnitFactor: '1',
    wholesalePrice: '',
    isTaxable: true,
    taxRate: String(state.settings.defaultSalesTaxRate ?? 15),
    minStock: '10',
    maxStock: '500',
    shelfLocation: '',
    expiryDate: '',
    batchNumber: '',
    serialNumber: '',
    status: 'active' as 'active' | 'paused' | 'service',
    supplierId: '',
    branchId: state.branches[0]?.id ?? '',
    warehouseId: state.warehouses[0]?.id ?? '',
  });
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);

  const profitByProduct = useMemo(() => {
    const map = new Map<string, { revenue: number; profit: number; marginPercent: number; count: number }>();
    for (const row of computeProfitAnalytics(state).byProduct) {
      map.set(row.key, row);
    }
    return map;
  }, [state]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of state.products) {
      if (p.category?.trim()) set.add(p.category.trim());
    }
    return Array.from(set);
  }, [state.products]);

  const nextSkuPreview = useMemo(() => {
    const nums = state.products
      .map((p) => {
        const m = p.sku.match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => Number.isFinite(n));
    return `SKU-${Math.max(100, ...nums) + 1}`;
  }, [state.products]);

  const unitLabel = (u?: UnitOfMeasure) => {
    if (u === 'carton') return t.unitCarton;
    if (u === 'kg') return t.unitKg;
    if (u === 'meter') return t.unitMeter;
    if (u === 'liter') return t.unitLiter;
    if (u === 'box') return t.unitBox;
    return t.unitPiece;
  };

  const todayMs = Date.now();
  const q = invSearch.trim().toLowerCase();
  const visibleProducts = state.products.filter((p) => {
    if (catFilter !== 'all' && (p.category?.trim() || '') !== catFilter) return false;
    if (whFilter !== 'all' && (p.warehouseId || state.warehouses[0]?.id) !== whFilter) return false;
    if (statusFilter !== 'all' && (p.status ?? 'active') !== statusFilter) return false;
    if (stockAlertFilter === 'low' && p.qty > (p.minStock ?? 10)) return false;
    if (stockAlertFilter === 'expiring') {
      if (!p.expiryDate) return false;
      const diff = Math.ceil((new Date(p.expiryDate).getTime() - todayMs) / 86400000);
      if (diff > 30) return false;
    }
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.nameEn ?? '').toLowerCase().includes(q) ||
      (p.brand ?? '').toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q)
    );
  });

  // Live profit margin % (Halala-accurate)
  const liveMarginPercent = useMemo(() => {
    const priceH = toHalalas(parseFloat(prdForm.price) || 0);
    const costH = toHalalas(parseFloat(prdForm.cost) || 0);
    if (priceH <= 0) return 0;
    return Math.round(((priceH - costH) / priceH) * 1000) / 10;
  }, [prdForm.price, prdForm.cost]);

  // Duplicate barcode warning
  const duplicateBarcodeProduct = useMemo(() => {
    const bc = prdForm.barcode.trim();
    if (!bc) return undefined;
    return state.products.find((p) => p.barcode.trim() === bc && p.id !== prdModal.editId);
  }, [prdForm.barcode, state.products, prdModal.editId]);

  const ledgerProduct = ledgerProductId ? state.products.find((p) => p.id === ledgerProductId) : undefined;
  const ledgerMovements = ledgerProduct
    ? state.stockMovements.filter((m) => m.productId === ledgerProduct.id)
    : [];
  const ledgerProfit = ledgerProduct
    ? profitByProduct.get(ledgerProduct.id) ?? profitByProduct.get(ledgerProduct.name)
    : undefined;

  const openNewProductModal = () => {
    setFormError('');
    setPrdForm({
      name: '',
      nameEn: '',
      description: '',
      brand: '',
      sku: nextSkuPreview,
      barcode: generateEan13(),
      imageBase64: '',
      openingQty: '0',
      qty: '15',
      cost: '100',
      price: '150',
      retailPrice: '',
      vipPrice: '',
      minPrice: '',
      category: '',
      unit: 'piece',
      subUnit: '',
      subUnitFactor: '1',
      wholesalePrice: '',
      isTaxable: true,
      taxRate: String(state.settings.defaultSalesTaxRate ?? 15),
      minStock: '10',
      maxStock: '500',
      shelfLocation: '',
      expiryDate: '',
      batchNumber: '',
      serialNumber: '',
      status: 'active',
      supplierId: state.suppliers[0]?.id ?? '',
      branchId: state.branches[0]?.id ?? '',
      warehouseId: state.warehouses[0]?.id ?? '',
    });
    setPrdModal({ open: true });
  };

  const openEditProductModal = (p: Product) => {
    setFormError('');
    setPrdForm({
      name: p.name,
      nameEn: p.nameEn ?? '',
      description: p.description ?? '',
      brand: p.brand ?? '',
      sku: p.sku,
      barcode: p.barcode,
      imageBase64: p.imageBase64 ?? '',
      openingQty: String(p.openingQty ?? p.qty),
      qty: String(p.qty),
      cost: String(p.cost),
      price: String(p.price),
      retailPrice: p.retailPrice !== undefined ? String(p.retailPrice) : '',
      vipPrice: p.vipPrice !== undefined ? String(p.vipPrice) : '',
      minPrice: p.minPrice !== undefined ? String(p.minPrice) : '',
      category: p.category ?? '',
      unit: p.unit ?? 'piece',
      subUnit: p.subUnit ?? '',
      subUnitFactor: String(p.subUnitFactor ?? 1),
      wholesalePrice: p.wholesalePrice !== undefined ? String(p.wholesalePrice) : '',
      isTaxable: p.isTaxable !== false,
      taxRate: String(p.taxRate ?? state.settings.defaultSalesTaxRate ?? 15),
      minStock: String(p.minStock ?? 10),
      maxStock: String(p.maxStock ?? 500),
      shelfLocation: p.shelfLocation ?? '',
      expiryDate: p.expiryDate ?? '',
      batchNumber: p.batchNumber ?? '',
      serialNumber: p.serialNumber ?? '',
      status: p.status ?? 'active',
      supplierId: p.supplierId ?? '',
      branchId: p.branchId ?? state.branches[0]?.id ?? '',
      warehouseId: p.warehouseId ?? state.warehouses[0]?.id ?? '',
    });
    setPrdModal({ open: true, editId: p.id });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={invSearch}
            onChange={(e) => setInvSearch(e.target.value)}
            placeholder={
              isAr ? 'بحث بالاسم، الماركة، SKU، الفئة، أو الباركود...' : 'Search name, brand, SKU, category, or barcode...'
            }
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <button
          onClick={() => {
            const csv = ['ID,Name,NameEn,Brand,SKU,Barcode,Category,Unit,Qty,Cost,Price,Wholesale,VIP,MinPrice,MinStock,Shelf,Expiry,Status']
              .concat(
                state.products.map(
                  (p) =>
                    `${p.id},"${p.name.replace(/"/g, '""')}","${(p.nameEn ?? '').replace(/"/g, '""')}","${(p.brand ?? '').replace(/"/g, '""')}",${p.sku},${p.barcode},"${(p.category ?? '').replace(/"/g, '""')}",${p.unit ?? 'piece'},${p.qty},${p.cost},${p.price},${p.wholesalePrice ?? p.price},${p.vipPrice ?? ''},${p.minPrice ?? ''},${p.minStock ?? 10},"${(p.shelfLocation ?? '').replace(/"/g, '""')}",${p.expiryDate ?? ''},${p.status ?? 'active'}`,
                ),
              )
              .join('\n');
            downloadTextFile('ostora_inventory.csv', csv);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{t.exportCsv}</span>
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#0A3D2C] dark:border-[#C9A227] bg-white dark:bg-[#121E19] text-[#0A3D2C] dark:text-[#C9A227] font-bold text-xs cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>{t.importDataBtn}</span>
        </button>
        <button
          onClick={() => {
            setScanCodeInput('');
            setScanModal('search');
          }}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#0A3D2C] dark:border-[#C9A227] text-[#0A3D2C] dark:text-[#C9A227] font-bold text-xs cursor-pointer"
        >
          <ScanBarcode className="w-4 h-4" />
          <span>{t.scanBarcode}</span>
        </button>
        <button
          onClick={openNewProductModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addProduct}</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-3 flex flex-wrap items-center gap-2.5">
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الفئات' : 'All Categories'}</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={whFilter}
          onChange={(e) => setWhFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل المستودعات' : 'All Warehouses'}</option>
          {state.warehouses.map((w) => (
            <option key={w.id} value={w.id}>{isAr ? w.nameAr : w.nameEn}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'paused' | 'service')}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الحالات' : 'All Statuses'}</option>
          <option value="active">{isAr ? 'نشط' : 'Active'}</option>
          <option value="paused">{isAr ? 'موقوف' : 'Paused'}</option>
          <option value="service">{isAr ? 'خدمة' : 'Service'}</option>
        </select>

        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          {([
            ['all', isAr ? 'الكل' : 'All'],
            ['low', isAr ? 'مخزون منخفض' : 'Low Stock'],
            ['expiring', isAr ? 'منتهي / قريب الانتهاء' : 'Expiring'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStockAlertFilter(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                stockAlertFilter === key
                  ? 'bg-[#0A3D2C] text-white'
                  : 'bg-slate-100 dark:bg-[#0A120F] text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visibleProducts.length === 0 ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
          {t.noData}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProducts.map((p) => {
            const minThreshold = p.minStock ?? 10;
            const low = p.qty <= minThreshold && p.status !== 'service';
            const expiryDiffDays = p.expiryDate
              ? Math.ceil((new Date(p.expiryDate).getTime() - todayMs) / 86400000)
              : null;
            const isExpired = expiryDiffDays !== null && expiryDiffDays <= 0;
            const isExpiringSoon = expiryDiffDays !== null && expiryDiffDays > 0 && expiryDiffDays <= 30;
            const whName = state.warehouses.find((w) => w.id === p.warehouseId)?.[isAr ? 'nameAr' : 'nameEn'];
            const itemProfit = profitByProduct.get(p.id) ?? profitByProduct.get(p.name);
            const prodStatus = p.status ?? 'active';

            return (
              <div
                key={p.id}
                className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] overflow-hidden flex flex-col justify-between"
              >
                <div className="aspect-[16/10] bg-slate-100 dark:bg-[#0A120F] overflow-hidden relative">
                  <img
                    src={p.imageBase64 || DEFAULT_PRODUCT_IMAGE}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2.5 start-2.5 flex flex-wrap gap-1">
                    {p.category && (
                      <span className="px-2 py-0.5 rounded-lg bg-black/65 text-white text-[10px] font-bold">
                        {p.category}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-lg bg-[#0A3D2C]/90 text-[#C9A227] text-[10px] font-bold">
                      {unitLabel(p.unit)}
                    </span>
                    {prodStatus !== 'active' && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                        {prodStatus === 'service' ? (isAr ? 'خدمة' : 'Service') : isAr ? 'موقوف' : 'Paused'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                      <span className="font-mono text-slate-500">
                        {p.sku}{p.brand ? ` · ${p.brand}` : ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {low && <span className="text-red-600 font-bold">{t.lowStock}</span>}
                        {isExpired && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded-md">
                            <AlertTriangle className="w-3 h-3" />
                            {isAr ? 'منتهي الصلاحية' : 'Expired'}
                          </span>
                        )}
                        {isExpiringSoon && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded-md">
                            <AlertTriangle className="w-3 h-3" />
                            {isAr ? `ينتهي خلال ${expiryDiffDays} يوم` : `Exp ${expiryDiffDays}d`}
                          </span>
                        )}
                      </div>
                    </div>
                    <h4 className="font-extrabold text-base">{p.name}</h4>
                    <p className="font-mono text-[11px] text-slate-500 mt-1 tabular-nums">
                      EAN: {p.barcode}
                      {whName ? ` · ${whName}` : ''}
                      {p.shelfLocation ? ` · ${p.shelfLocation}` : ''}
                    </p>
                    <div className="mt-1.5">
                      <BarcodeSvg code={p.barcode} height={24} />
                    </div>
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-bold tabular-nums">
                        {t.qty}: {p.qty} {unitLabel(p.unit)}
                      </span>
                      <span className="font-mono font-extrabold text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
                        {p.price.toFixed(0)} {cur}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                      <span>
                        {isAr ? 'جملة' : 'Wholesale'}: {(p.wholesalePrice ?? p.price).toFixed(0)} {cur}
                      </span>
                      {itemProfit && (
                        <span className={itemProfit.profit >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                          {isAr ? 'ربح:' : 'Profit:'} {itemProfit.profit.toFixed(0)} {cur}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-[#1F332B]">
                    <button
                      onClick={() => actions.addTenStock(p.id)}
                      className="flex-1 py-1.5 rounded-lg border border-[#0A3D2C] text-[#0A3D2C] dark:border-[#C9A227] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
                    >
                      {t.add10}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerProductId(p.id)}
                      title={isAr ? 'حركة الصنف والربح' : 'Movements & Profit'}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                    >
                      <History className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
                    </button>
                    <button
                      onClick={() => openEditProductModal(p)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => actions.deleteProduct(p.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {prdModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-2xl w-full p-6 space-y-3 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-extrabold">{prdModal.editId ? t.edit : t.addProduct}</h3>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold font-mono tabular-nums">
                  {isAr ? `هامش الربح: ${liveMarginPercent}%` : `Margin: ${liveMarginPercent}%`}
                </span>
                <button
                  type="button"
                  onClick={() => setPrdModal({ open: false })}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs font-bold text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <img
                src={prdForm.imageBase64 || DEFAULT_PRODUCT_IMAGE}
                alt="Preview"
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-[#1F332B] shrink-0"
              />
              <div className="flex-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
                  <span>{t.uploadImage}</span>
                </button>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
                  <span>{t.takePhoto}</span>
                </button>
                <input
                  ref={galleryRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const b64 = await compressImageToBase64(f);
                    setPrdForm({ ...prdForm, imageBase64: b64 });
                  }}
                />
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const b64 = await compressImageToBase64(f);
                    setPrdForm({ ...prdForm, imageBase64: b64 });
                  }}
                />
              </div>
            </div>

            {/* Basic Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'اسم الصنف (عربي) *' : 'Product Name *'}
                </label>
                <input
                  maxLength={160}
                  value={prdForm.name}
                  onChange={(e) => {
                    setFormError('');
                    setPrdForm({ ...prdForm, name: e.target.value });
                  }}
                  placeholder={t.fullName}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الاسم بالإنجليزية' : 'English Name'}
                </label>
                <input
                  maxLength={160}
                  value={prdForm.nameEn}
                  onChange={(e) => setPrdForm({ ...prdForm, nameEn: e.target.value })}
                  placeholder="English Name"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.sku}</label>
                <div className="flex gap-1">
                  <input
                    maxLength={64}
                    value={prdForm.sku}
                    onChange={(e) => setPrdForm({ ...prdForm, sku: e.target.value })}
                    placeholder={nextSkuPreview}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setPrdForm({ ...prdForm, sku: nextSkuPreview })}
                    title={isAr ? 'توليد SKU تلقائي' : 'Auto SKU'}
                    className="px-2.5 py-2 rounded-xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.category}</label>
                <input
                  maxLength={80}
                  value={prdForm.category}
                  onChange={(e) => setPrdForm({ ...prdForm, category: e.target.value })}
                  placeholder={t.category}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الماركة / العلامة' : 'Brand'}
                </label>
                <input
                  maxLength={80}
                  value={prdForm.brand}
                  onChange={(e) => setPrdForm({ ...prdForm, brand: e.target.value })}
                  placeholder={isAr ? 'الماركة' : 'Brand'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.barcode}</label>
              <div className="flex gap-2">
                <input
                  maxLength={64}
                  value={prdForm.barcode}
                  onChange={(e) => setPrdForm({ ...prdForm, barcode: e.target.value })}
                  placeholder={t.barcode}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setPrdForm({ ...prdForm, barcode: generateEan13() })}
                  title={t.generateBarcode}
                  className="px-3 py-2 rounded-xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
                >
                  <Wand2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScanCodeInput(prdForm.barcode);
                    setScanModal('product');
                  }}
                  title={t.scanBarcode}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                >
                  <ScanBarcode className="w-4 h-4" />
                </button>
              </div>
              {duplicateBarcodeProduct && (
                <p className="text-[11px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>
                    {isAr
                      ? `تنبيه: الباركود مسجل مسبقاً للصنف "${duplicateBarcodeProduct.name}"`
                      : `Warning: Barcode already used by "${duplicateBarcodeProduct.name}"`}
                  </span>
                </p>
              )}
            </div>

            <textarea
              rows={2}
              maxLength={300}
              value={prdForm.description}
              onChange={(e) => setPrdForm({ ...prdForm, description: e.target.value })}
              placeholder={isAr ? 'وصف الصنف والمواصفات...' : 'Item description & specs...'}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />

            {/* Units */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الوحدة الأساسية' : 'Primary Unit'}
                </label>
                <select
                  value={prdForm.unit}
                  onChange={(e) => setPrdForm({ ...prdForm, unit: e.target.value as UnitOfMeasure })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="piece">{t.unitPiece}</option>
                  <option value="carton">{t.unitCarton}</option>
                  <option value="kg">{t.unitKg}</option>
                  <option value="meter">{t.unitMeter}</option>
                  <option value="liter">{t.unitLiter}</option>
                  <option value="box">{t.unitBox}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الوحدة الفرعية' : 'Sub Unit'}
                </label>
                <input
                  maxLength={40}
                  value={prdForm.subUnit}
                  onChange={(e) => setPrdForm({ ...prdForm, subUnit: e.target.value })}
                  placeholder={isAr ? 'حبة / شدة' : 'Pack / Sub'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'معامل التحويل' : 'Conversion Factor'}
                </label>
                <input
                  type="number"
                  min={1}
                  value={prdForm.subUnitFactor}
                  onChange={(e) => setPrdForm({ ...prdForm, subUnitFactor: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
            </div>

            {/* Pricing Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.cost}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={prdForm.cost}
                  onChange={(e) => setPrdForm({ ...prdForm, cost: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.price} *</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={prdForm.price}
                  onChange={(e) => {
                    setFormError('');
                    setPrdForm({ ...prdForm, price: e.target.value });
                  }}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'سعر التجزئة' : 'Retail Price'}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={prdForm.retailPrice}
                  onChange={(e) => setPrdForm({ ...prdForm, retailPrice: e.target.value })}
                  placeholder={prdForm.price}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'سعر الجملة' : 'Wholesale'}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={prdForm.wholesalePrice}
                  onChange={(e) => setPrdForm({ ...prdForm, wholesalePrice: e.target.value })}
                  placeholder={prdForm.price}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'سعر VIP' : 'VIP Price'}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={prdForm.vipPrice}
                  onChange={(e) => setPrdForm({ ...prdForm, vipPrice: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الحد الأدنى للبيع' : 'Min Sell Price'}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={prdForm.minPrice}
                  onChange={(e) => setPrdForm({ ...prdForm, minPrice: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold w-full cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prdForm.isTaxable}
                    onChange={(e) =>
                      setPrdForm({
                        ...prdForm,
                        isTaxable: e.target.checked,
                        taxRate: e.target.checked
                          ? String(state.settings.defaultSalesTaxRate ?? 15)
                          : '0',
                      })
                    }
                    className="accent-[#0A3D2C]"
                  />
                  <span>{isAr ? 'خاضع للضريبة' : 'Taxable'}</span>
                </label>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'نسبة الضريبة %' : 'VAT %'}
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={!prdForm.isTaxable}
                  value={prdForm.taxRate}
                  onChange={(e) => setPrdForm({ ...prdForm, taxRate: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums disabled:opacity-50"
                />
              </div>
            </div>

            {/* Stock & Tracking */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'رصيد أول المدة' : 'Opening Qty'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={prdForm.openingQty}
                  onChange={(e) => setPrdForm({ ...prdForm, openingQty: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.qty}</label>
                <input
                  type="number"
                  min={0}
                  value={prdForm.qty}
                  onChange={(e) => setPrdForm({ ...prdForm, qty: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'حد أدنى' : 'Min'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={prdForm.minStock}
                  onChange={(e) => setPrdForm({ ...prdForm, minStock: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'حد أقصى' : 'Max'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={prdForm.maxStock}
                  onChange={(e) => setPrdForm({ ...prdForm, maxStock: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'موقع الرف' : 'Shelf Location'}
                </label>
                <input
                  maxLength={40}
                  value={prdForm.shelfLocation}
                  onChange={(e) => setPrdForm({ ...prdForm, shelfLocation: e.target.value })}
                  placeholder="A-01-R3"
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'تاريخ الانتهاء' : 'Expiry Date'}
                </label>
                <input
                  type="date"
                  value={prdForm.expiryDate}
                  onChange={(e) => setPrdForm({ ...prdForm, expiryDate: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'رقم التشغيلة' : 'Batch #'}
                </label>
                <input
                  maxLength={60}
                  value={prdForm.batchNumber}
                  onChange={(e) => setPrdForm({ ...prdForm, batchNumber: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الرقم التسلسلي' : 'Serial #'}
                </label>
                <input
                  maxLength={60}
                  value={prdForm.serialNumber}
                  onChange={(e) => setPrdForm({ ...prdForm, serialNumber: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            </div>

            {/* Assignments */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'المورد' : 'Supplier'}
                </label>
                <select
                  value={prdForm.supplierId}
                  onChange={(e) => setPrdForm({ ...prdForm, supplierId: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  <option value="">—</option>
                  {state.suppliers.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الفرع' : 'Branch'}
                </label>
                <select
                  value={prdForm.branchId}
                  onChange={(e) => setPrdForm({ ...prdForm, branchId: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  {state.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {isAr ? b.nameAr : b.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'المخزن' : 'Warehouse'}
                </label>
                <select
                  value={prdForm.warehouseId}
                  onChange={(e) => setPrdForm({ ...prdForm, warehouseId: e.target.value })}
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
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'حالة الصنف' : 'Item Status'}
                </label>
                <select
                  value={prdForm.status}
                  onChange={(e) => setPrdForm({ ...prdForm, status: e.target.value as 'active' | 'paused' | 'service' })}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                  <option value="paused">{isAr ? 'موقوف' : 'Paused'}</option>
                  <option value="service">{isAr ? 'خدمة (غير مخزني)' : 'Service'}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPrdModal({ open: false })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  if (!prdForm.name.trim()) {
                    setFormError(isAr ? 'اسم الصنف إلزامي *' : 'Product name is required *');
                    return;
                  }
                  const priceVal = Math.max(0, parseFloat(prdForm.price) || 0);
                  if (priceVal <= 0) {
                    setFormError(isAr ? 'سعر البيع يجب أن يكون أكبر من صفر *' : 'Selling price must be > 0 *');
                    return;
                  }
                  const wholesaleVal = prdForm.wholesalePrice.trim()
                    ? Math.max(0, parseFloat(prdForm.wholesalePrice) || 0)
                    : priceVal;
                  actions.saveProduct(
                    {
                      name: prdForm.name.trim(),
                      nameEn: prdForm.nameEn.trim() || undefined,
                      description: prdForm.description.trim() || undefined,
                      brand: prdForm.brand.trim() || undefined,
                      sku: prdForm.sku.trim() || nextSkuPreview,
                      barcode: prdForm.barcode.trim() || generateEan13(),
                      imageBase64: prdForm.imageBase64 || undefined,
                      openingQty: Math.max(0, parseInt(prdForm.openingQty, 10) || 0),
                      qty: Math.max(0, parseInt(prdForm.qty, 10) || 0),
                      cost: Math.max(0, parseFloat(prdForm.cost) || 0),
                      price: priceVal,
                      retailPrice: prdForm.retailPrice.trim() ? Math.max(0, parseFloat(prdForm.retailPrice) || 0) : undefined,
                      vipPrice: prdForm.vipPrice.trim() ? Math.max(0, parseFloat(prdForm.vipPrice) || 0) : undefined,
                      minPrice: prdForm.minPrice.trim() ? Math.max(0, parseFloat(prdForm.minPrice) || 0) : undefined,
                      category: prdForm.category.trim() || undefined,
                      unit: prdForm.unit,
                      subUnit: prdForm.subUnit.trim() || undefined,
                      subUnitFactor: Math.max(1, parseInt(prdForm.subUnitFactor, 10) || 1),
                      wholesalePrice: wholesaleVal,
                      isTaxable: prdForm.isTaxable,
                      taxRate: prdForm.isTaxable ? Math.max(0, Math.min(100, parseFloat(prdForm.taxRate) || 15)) : 0,
                      minStock: Math.max(0, parseInt(prdForm.minStock, 10) || 10),
                      maxStock: Math.max(0, parseInt(prdForm.maxStock, 10) || 500),
                      shelfLocation: prdForm.shelfLocation.trim() || undefined,
                      expiryDate: prdForm.expiryDate || undefined,
                      batchNumber: prdForm.batchNumber.trim() || undefined,
                      serialNumber: prdForm.serialNumber.trim() || undefined,
                      status: prdForm.status,
                      supplierId: prdForm.supplierId || undefined,
                      branchId: prdForm.branchId || undefined,
                      warehouseId: prdForm.warehouseId || undefined,
                    },
                    prdModal.editId,
                  );
                  setPrdModal({ open: false });
                  actions.notify(isAr ? 'تم حفظ الصنف بنجاح' : 'Product saved');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {ledgerProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold">{ledgerProduct.name}</h3>
                <p className="text-xs font-mono text-slate-500">
                  {ledgerProduct.sku} · EAN: {ledgerProduct.barcode}
                </p>
              </div>
              <button
                onClick={() => setLedgerProductId(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F]">
                <p className="text-slate-500 font-bold">{t.currentStock}</p>
                <p className="text-base font-extrabold font-mono tabular-nums mt-0.5">
                  {ledgerProduct.qty} {unitLabel(ledgerProduct.unit)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F]">
                <p className="text-slate-500 font-bold">{isAr ? 'إيرادات الصنف' : 'Item Revenue'}</p>
                <p className="text-base font-extrabold font-mono tabular-nums mt-0.5 text-[#0A3D2C] dark:text-[#C9A227]">
                  {(ledgerProfit?.revenue ?? 0).toFixed(2)} {cur}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F]">
                <p className="text-slate-500 font-bold">{isAr ? 'ربح الصنف' : 'Item Profit'}</p>
                <p className="text-base font-extrabold font-mono tabular-nums mt-0.5 text-emerald-600">
                  {(ledgerProfit?.profit ?? 0).toFixed(2)} {cur} ({ledgerProfit?.marginPercent ?? 0}%)
                </p>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-[#1F332B] border border-slate-200 dark:border-[#1F332B] rounded-xl">
              {ledgerMovements.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">{t.noData}</p>
              ) : (
                ledgerMovements.map((m) => (
                  <div key={m.id} className="p-3 flex items-center justify-between text-xs gap-2">
                    <div>
                      <span className="font-mono font-bold text-[#0A3D2C] dark:text-[#C9A227]">{m.movementType}</span>
                      <span className="ms-2 text-slate-500 font-mono">{m.referenceId}</span>
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5">{m.notes}</p>
                    </div>
                    <div className="text-end font-mono tabular-nums">
                      <span className={`font-extrabold ${m.qtyDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {m.qtyDelta >= 0 ? `+${m.qtyDelta}` : m.qtyDelta}
                      </span>
                      <p className="text-[10px] text-slate-400">{m.date.slice(0, 10)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {scanModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ScanBarcode className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
              <h3 className="text-base font-extrabold">{t.scanBarcode}</h3>
            </div>
            <div className="rounded-xl bg-[#0A3D2C] text-white p-4 text-center space-y-1">
              <Camera className="w-8 h-8 mx-auto text-[#C9A227]" />
              <p className="text-xs text-white/80">
                {isAr ? 'وجّه الكاميرا أو اكتب / امسح الباركود يدوياً' : 'Point camera or type/scan barcode below'}
              </p>
            </div>
            <input
              autoFocus
              value={scanCodeInput}
              onChange={(e) => setScanCodeInput(e.target.value)}
              placeholder="6281001009004"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono"
            />
            {scanModal === 'search' && (
              <div className="flex flex-wrap gap-1.5">
                {state.products.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setScanCodeInput(p.barcode)}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#0A120F] font-mono text-[10px] cursor-pointer"
                  >
                    {p.barcode}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setScanModal(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  if (scanModal === 'search') {
                    setInvSearch(scanCodeInput.trim());
                  } else {
                    setPrdForm({ ...prdForm, barcode: scanCodeInput.trim() || generateEan13() });
                  }
                  setScanModal(null);
                }}
                className="flex-1 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
              >
                {isAr ? 'تطبيق' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
      <DataImportModal
        open={importOpen}
        defaultEntity="products"
        allowEntitySwitch={false}
        store={store}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
};
