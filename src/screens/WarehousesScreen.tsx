import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  ClipboardCheck,
  Edit2,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { strings } from '../data/translations';
import { computeAdvancedInsights } from '../domain/analytics';
import { fromHalalas, toHalalas } from '../domain/halala';
import { StocktakeRecord, Warehouse } from '../types/erp';
import { ScreenProps } from './types';

export const WarehousesScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];
  const cur = state.settings.currency;
  const canDelete = state.currentRole !== 'accountant';

  const insights = useMemo(() => computeAdvancedInsights(state), [state]);

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [whModal, setWhModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [trModal, setTrModal] = useState(false);
  const [stModal, setStModal] = useState(false);
  const [printStocktake, setPrintStocktake] = useState<StocktakeRecord | null>(null);
  const [whError, setWhError] = useState('');

  // Add/Edit warehouse form
  const [whCode, setWhCode] = useState('');
  const [whNameAr, setWhNameAr] = useState('');
  const [whNameEn, setWhNameEn] = useState('');
  const [whCity, setWhCity] = useState('');
  const [whAddress, setWhAddress] = useState('');
  const [whLocation, setWhLocation] = useState('');
  const [whManager, setWhManager] = useState('');
  const [whBranchId, setWhBranchId] = useState(state.branches[0]?.id ?? 'BR-MAIN');
  const [whType, setWhType] = useState<'main' | 'sub'>('main');
  const [whActive, setWhActive] = useState(true);

  // Transfer form
  const [trProdId, setTrProdId] = useState(state.products[0]?.id ?? '');
  const [trFrom, setTrFrom] = useState(state.warehouses[0]?.id ?? '');
  const [trTo, setTrTo] = useState(state.warehouses[1]?.id ?? state.warehouses[0]?.id ?? '');
  const [trQty, setTrQty] = useState(1);
  const [trDate, setTrDate] = useState(new Date().toISOString().slice(0, 10));
  const [trNotes, setTrNotes] = useState('');

  // Stocktake form
  const [stWhId, setStWhId] = useState(state.warehouses[0]?.id ?? '');
  const [stProdId, setStProdId] = useState(state.products[0]?.id ?? '');
  const [stActualQty, setStActualQty] = useState(state.products[0]?.qty ?? 0);
  const [stCountedBy, setStCountedBy] = useState('');
  const [stReason, setStReason] = useState('annual');
  const [stNotes, setStNotes] = useState('');

  const nextWhCodePreview = useMemo(() => {
    const nums = state.warehouses
      .map((w) => {
        const m = (w.code || w.id).match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => Number.isFinite(n));
    return `WH-${Math.max(100, ...nums) + 1}`;
  }, [state.warehouses]);

  const nextStkPreview = useMemo(() => {
    const nums = state.stocktakes
      .map((s) => {
        const m = s.id.match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => Number.isFinite(n));
    return `STK-${Math.max(100, ...nums) + 1}`;
  }, [state.stocktakes]);

  const selectedStProd = state.products.find((p) => p.id === stProdId);
  const stVariance = selectedStProd ? stActualQty - selectedStProd.qty : 0;
  const stVarianceValue = selectedStProd
    ? fromHalalas(Math.round(toHalalas(selectedStProd.cost) * stVariance))
    : 0;

  const filteredWarehouses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.warehouses.filter((wh) => {
      if (branchFilter !== 'all' && wh.branchId !== branchFilter) return false;
      if (statusFilter === 'active' && !wh.active) return false;
      if (statusFilter === 'inactive' && wh.active) return false;
      if (!q) return true;
      return (
        wh.id.toLowerCase().includes(q) ||
        (wh.code ?? '').toLowerCase().includes(q) ||
        wh.nameAr.toLowerCase().includes(q) ||
        wh.nameEn.toLowerCase().includes(q) ||
        wh.location.toLowerCase().includes(q) ||
        wh.managerName.toLowerCase().includes(q)
      );
    });
  }, [state.warehouses, search, branchFilter, statusFilter]);

  const filteredStocktakes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.stocktakes.filter((st) => {
      if (!q) return true;
      return (
        st.id.toLowerCase().includes(q) ||
        st.productName.toLowerCase().includes(q) ||
        st.warehouseName.toLowerCase().includes(q) ||
        (st.countedBy ?? '').toLowerCase().includes(q)
      );
    });
  }, [state.stocktakes, search]);

  const filteredMovements = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.stockMovements.filter((m) => {
      if (!q) return true;
      return (
        m.productName.toLowerCase().includes(q) ||
        m.referenceId.toLowerCase().includes(q) ||
        m.movementType.toLowerCase().includes(q) ||
        m.notes.toLowerCase().includes(q)
      );
    });
  }, [state.stockMovements, search]);

  const openNewWarehouseModal = () => {
    setWhError('');
    setWhCode(nextWhCodePreview);
    setWhNameAr('');
    setWhNameEn('');
    setWhCity('');
    setWhAddress('');
    setWhLocation('');
    setWhManager('');
    setWhBranchId(state.branches[0]?.id ?? 'BR-MAIN');
    setWhType('main');
    setWhActive(true);
    setWhModal({ open: true });
  };

  const openEditWarehouseModal = (wh: Warehouse) => {
    setWhError('');
    setWhCode(wh.code ?? wh.id);
    setWhNameAr(wh.nameAr);
    setWhNameEn(wh.nameEn);
    setWhCity(wh.city ?? '');
    setWhAddress(wh.address ?? '');
    setWhLocation(wh.location);
    setWhManager(wh.managerName);
    setWhBranchId(wh.branchId);
    setWhType(wh.warehouseType ?? 'main');
    setWhActive(wh.active);
    setWhModal({ open: true, editId: wh.id });
  };

  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whNameAr.trim() && !whNameEn.trim()) {
      setWhError(isAr ? 'اسم المستودع إلزامي *' : 'Warehouse name is required *');
      return;
    }
    actions.saveWarehouse(
      {
        code: whCode.trim() || nextWhCodePreview,
        nameAr: whNameAr.trim() || whNameEn.trim(),
        nameEn: whNameEn.trim() || whNameAr.trim(),
        branchId: whBranchId,
        city: whCity.trim() || undefined,
        address: whAddress.trim() || undefined,
        location: whLocation.trim() || [whCity.trim(), whAddress.trim()].filter(Boolean).join(' - '),
        managerName: whManager.trim(),
        warehouseType: whType,
        active: whActive,
      },
      whModal.editId,
    );
    setWhModal({ open: false });
    actions.notify(isAr ? 'تم حفظ بيانات المخزن بنجاح' : 'Warehouse saved');
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = actions.transferStockBetweenWarehouses(
      trProdId,
      trFrom,
      trTo,
      Number(trQty),
      trNotes,
      trDate ? `${trDate}T12:00:00.000Z` : undefined,
    );
    if (ok) {
      setTrModal(false);
      setTrNotes('');
      actions.notify(isAr ? 'تم تحويل المخزون وتسجيل الحركة' : 'Stock transferred cleanly');
    } else {
      actions.notify(isAr ? 'تحقق من المخزنين المختلفين والكمية' : 'Check distinct warehouses and qty');
    }
  };

  const handleStocktake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stProdId) return;
    const ok = actions.recordStocktake(
      stWhId,
      stProdId,
      Number(stActualQty),
      stNotes,
      stCountedBy.trim() || undefined,
      stReason,
    );
    if (ok) {
      setStModal(false);
      setStNotes('');
      actions.notify(isAr ? 'تم اعتماد الجرد الفعلي وترحيل قيد التسوية' : 'Stocktake saved with variance journal');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#0A3D2C] text-[#C9A227] flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold">{t.warehouses}</h2>
            <p className="text-[11px] text-slate-500">
              {isAr
                ? `${state.warehouses.length} مخازن · ${state.stockMovements.length} حركة مخزنية`
                : `${state.warehouses.length} warehouses · ${state.stockMovements.length} movements`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setStProdId(state.products[0]?.id ?? '');
              setStActualQty(state.products[0]?.qty ?? 0);
              setStCountedBy('');
              setStReason('annual');
              setStNotes('');
              setStModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C9A227] text-slate-950 text-xs font-extrabold cursor-pointer"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>{t.physicalStocktake}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTrDate(new Date().toISOString().slice(0, 10));
              setTrNotes('');
              setTrModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-[#C9A227]" />
            <span>{t.transferStock}</span>
          </button>
          <button
            type="button"
            onClick={openNewWarehouseModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addWarehouse}</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث في المخازن، الجرد، أو الحركات...' : 'Search warehouses, stocktakes, or movements...'}
            className="w-full ps-10 pe-4 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الفروع' : 'All Branches'}</option>
          {state.branches.map((b) => (
            <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الحالات' : 'All Statuses'}</option>
          <option value="active">{isAr ? 'نشط' : 'Active'}</option>
          <option value="inactive">{isAr ? 'معطّل' : 'Inactive'}</option>
        </select>
      </div>

      {/* Low Stock & Expiry Alerts */}
      {insights.stockAndExpiryAlerts.length > 0 && (
        <div className="rounded-[20px] bg-amber-500/10 border border-amber-500/30 p-4 space-y-2">
          <h3 className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>{isAr ? 'تنبيهات النواقص وانتهاء الصلاحية' : 'Low Stock & Expiry Alerts'}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {insights.stockAndExpiryAlerts.map((al) => (
              <div
                key={al.productId}
                className="p-2.5 rounded-xl bg-white/80 dark:bg-[#121E19] border border-amber-500/20 flex items-center justify-between text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold truncate">{al.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {al.reason === 'expired'
                      ? isAr
                        ? `منتهي الصلاحية (${al.expiryDate})`
                        : `Expired (${al.expiryDate})`
                      : al.reason === 'expiring_soon'
                      ? isAr
                        ? `قريب الانتهاء (${al.expiryDate})`
                        : `Expiring soon (${al.expiryDate})`
                      : isAr
                      ? `المتوفر ${al.qty} (الحد الأدنى ${al.minStock})`
                      : `Qty ${al.qty} (Min ${al.minStock})`}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 font-bold text-[10px] shrink-0">
                  {al.qty}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredWarehouses.map((wh) => {
          const itemCount = state.products.filter((p) => (p.warehouseId || state.warehouses[0]?.id) === wh.id).length;
          const brName = state.branches.find((b) => b.id === wh.branchId)?.[isAr ? 'nameAr' : 'nameEn'];
          return (
            <div
              key={wh.id}
              className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono text-[#C9A227] font-bold">{wh.code ?? wh.id}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[10px] font-bold text-[#0A3D2C] dark:text-[#C9A227]">
                      {wh.warehouseType === 'sub' ? (isAr ? 'فرعي' : 'Sub') : isAr ? 'رئيسي' : 'Main'}
                    </span>
                    {!wh.active && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600">
                        {isAr ? 'معطل' : 'Inactive'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-extrabold mt-0.5 truncate">{isAr ? wh.nameAr : wh.nameEn}</h3>
                  <p className="text-xs text-slate-500 truncate">
                    {brName ? `${brName} · ` : ''}
                    {wh.city || wh.location || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditWarehouseModal(wh)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                    aria-label={t.edit}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {canDelete && state.warehouses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => actions.deleteWarehouse(wh.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer"
                      aria-label={t.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-[#1F332B]">
                <span className="text-slate-500">{isAr ? 'الأمين:' : 'Manager:'} {wh.managerName || '—'}</span>
                <span className="font-mono font-bold text-[#0A3D2C] dark:text-[#C9A227]">
                  {itemCount} {isAr ? 'صنف' : 'items'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Stocktakes & Stock Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 space-y-3">
          <h3 className="text-xs font-extrabold">{isAr ? 'سجل الجرد الفعلي والفروقات' : 'Physical Stocktake Log'}</h3>
          {filteredStocktakes.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">{t.noData}</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredStocktakes.map((st) => (
                <div
                  key={st.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] flex items-center justify-between text-xs gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold truncate">
                      <span className="font-mono text-[#0A3D2C] dark:text-[#C9A227] me-1.5">{st.id}</span>
                      {st.productName} · <span className="text-slate-500">{st.warehouseName}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {st.date.slice(0, 10)} · {isAr ? `النظام ${st.systemQty} ← الفعلي ${st.actualQty}` : `Sys ${st.systemQty} -> Act ${st.actualQty}`}
                      {st.countedBy ? ` · ${st.countedBy}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-mono font-extrabold tabular-nums ${
                        st.varianceQty === 0 ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {st.varianceQty > 0 ? `+${st.varianceQty}` : st.varianceQty} ({st.varianceValue.toLocaleString()} {cur})
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrintStocktake(st)}
                      title={isAr ? 'طباعة محضر الجرد' : 'Print Stocktake Minutes'}
                      className="p-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 space-y-3">
          <h3 className="text-xs font-extrabold">{isAr ? 'سجل حركات الأصناف' : 'Stock Movement History'}</h3>
          {filteredMovements.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">{t.noData}</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredMovements.slice(0, 30).map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold truncate">{m.productName}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {m.movementType} · {m.referenceId} · {m.date.slice(0, 10)}
                      {m.notes ? ` · ${m.notes}` : ''}
                    </p>
                  </div>
                  <span className={`font-mono font-extrabold tabular-nums ${m.qtyDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {m.qtyDelta >= 0 ? `+${m.qtyDelta}` : m.qtyDelta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Warehouse Modal */}
      {whModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-[22px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-5 space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold">{whModal.editId ? t.edit : t.addWarehouse}</h3>
                <p className="text-[11px] font-mono text-[#0A3D2C] dark:text-[#C9A227] font-bold">
                  {whModal.editId ?? nextWhCodePreview}
                </p>
              </div>
              <button onClick={() => setWhModal({ open: false })} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            {whError && (
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 text-xs font-bold text-red-700">
                {whError}
              </div>
            )}
            <form onSubmit={handleSaveWarehouse} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {isAr ? 'كود المستودع' : 'Warehouse Code'}
                  </label>
                  <input
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value)}
                    placeholder={nextWhCodePreview}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {isAr ? 'نوع المستودع' : 'Type'}
                  </label>
                  <select
                    value={whType}
                    onChange={(e) => setWhType(e.target.value as 'main' | 'sub')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                  >
                    <option value="main">{isAr ? 'رئيسي' : 'Main'}</option>
                    <option value="sub">{isAr ? 'فرعي' : 'Sub'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {isAr ? 'الفرع' : 'Branch'}
                  </label>
                  <select
                    value={whBranchId}
                    onChange={(e) => setWhBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                  >
                    {state.branches.map((b) => (
                      <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {isAr ? 'اسم المخزن بالعربي *' : 'Warehouse Name (AR) *'}
                  </label>
                  <input
                    placeholder={isAr ? 'المستودع الرئيسي' : 'Warehouse Name (AR)'}
                    value={whNameAr}
                    onChange={(e) => {
                      setWhError('');
                      setWhNameAr(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {isAr ? 'اسم المخزن بالإنجليزية' : 'Warehouse Name (EN)'}
                  </label>
                  <input
                    placeholder="Warehouse Name (EN)"
                    value={whNameEn}
                    onChange={(e) => setWhNameEn(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {isAr ? 'المدينة' : 'City'}
                  </label>
                  <input
                    placeholder={isAr ? 'الرياض / جدة' : 'City'}
                    value={whCity}
                    onChange={(e) => setWhCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {isAr ? 'العنوان التفصيلي' : 'Address'}
                  </label>
                  <input
                    placeholder={isAr ? 'الحي / المنطقة الصناعية' : 'Street / District'}
                    value={whAddress}
                    onChange={(e) => setWhAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {isAr ? 'أمين المخزن' : 'Warehouse Manager'}
                  </label>
                  <input
                    placeholder={isAr ? 'أمين المخزن' : 'Warehouse Manager'}
                    value={whManager}
                    onChange={(e) => setWhManager(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold w-full cursor-pointer">
                    <input
                      type="checkbox"
                      checked={whActive}
                      onChange={(e) => setWhActive(e.target.checked)}
                      className="accent-[#0A3D2C]"
                    />
                    <span>{isAr ? 'المستودع نشط' : 'Warehouse Active'}</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setWhModal({ open: false })} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer">{t.cancel}</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer">{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Transfer Modal */}
      {trModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[22px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">{t.transferStock}</h3>
              <button onClick={() => setTrModal(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleTransfer} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.date} *</label>
                <input
                  type="date"
                  required
                  value={trDate}
                  onChange={(e) => setTrDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.product} *</label>
                <select value={trProdId} onChange={(e) => setTrProdId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                  {state.products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.qty})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'من مخزن *' : 'From *'}</label>
                  <select value={trFrom} onChange={(e) => setTrFrom(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    {state.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{isAr ? w.nameAr : w.nameEn}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'إلى مخزن *' : 'To *'}</label>
                  <select value={trTo} onChange={(e) => setTrTo(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    {state.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{isAr ? w.nameAr : w.nameEn}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.qty} *</label>
                <input type="number" min={1} required value={trQty} onChange={(e) => setTrQty(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
              <input placeholder={isAr ? 'سبب التحويل والملاحظات' : 'Transfer reason & notes'} value={trNotes} onChange={(e) => setTrNotes(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setTrModal(false)} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer">{t.cancel}</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer">{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Physical Stocktake Modal */}
      {stModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-[22px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-5 space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold">{t.physicalStocktake}</h3>
                <p className="text-[11px] font-mono text-[#0A3D2C] dark:text-[#C9A227] font-bold">
                  {nextStkPreview} · {new Date().toISOString().slice(0, 10)}
                </p>
              </div>
              <button onClick={() => setStModal(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleStocktake} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'المخزن *' : 'Warehouse *'}</label>
                <select value={stWhId} onChange={(e) => setStWhId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                  {state.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{isAr ? w.nameAr : w.nameEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.product} *</label>
                <select
                  value={stProdId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setStProdId(pid);
                    const p = state.products.find((x) => x.id === pid);
                    if (p) setStActualQty(p.qty);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
                >
                  {state.products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({isAr ? 'النظام' : 'Sys'}: {p.qty})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                  <span className="text-slate-500 block text-[10px]">{isAr ? 'الكمية بالنظام' : 'System Qty'}</span>
                  <span className="font-mono font-extrabold text-sm">{selectedStProd?.qty ?? 0}</span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">{isAr ? 'الجرد الفعلي *' : 'Actual Count *'}</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={stActualQty}
                    onChange={(e) => setStActualQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">{isAr ? 'القائم بالجرد' : 'Auditor Name'}</label>
                  <input
                    value={stCountedBy}
                    onChange={(e) => setStCountedBy(e.target.value)}
                    placeholder={isAr ? 'اسم الجارد / المراقب' : 'Auditor'}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">{isAr ? 'سبب الجرد' : 'Reason'}</label>
                  <select
                    value={stReason}
                    onChange={(e) => setStReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold"
                  >
                    <option value="annual">{isAr ? 'جرد سنوي' : 'Annual Count'}</option>
                    <option value="monthly">{isAr ? 'جرد شهري' : 'Monthly Count'}</option>
                    <option value="damaged">{isAr ? 'تالف / مفقود' : 'Damaged / Shrinkage'}</option>
                    <option value="audit">{isAr ? 'مراجعة تدقيق' : 'Audit Review'}</option>
                    <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
                  </select>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-xs font-bold flex justify-between">
                <span>{isAr ? 'فرق التسوية (الكمية / القيمة)' : 'Variance (Qty / Value)'}:</span>
                <span className="font-mono tabular-nums">
                  {stVariance > 0 ? `+${stVariance}` : stVariance} · {stVarianceValue.toFixed(2)} {cur}
                </span>
              </div>
              <input placeholder={t.notes} value={stNotes} onChange={(e) => setStNotes(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setStModal(false)} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer">{t.cancel}</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer">{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Stocktake Minutes Modal */}
      {printStocktake && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-[20px] max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <h3 className="font-extrabold text-sm">{isAr ? 'محضر الجرد الفعلي والتسوية' : 'Stocktake Minutes'}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printPdf}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintStocktake(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="text-center border-b pb-3">
                <p className="font-extrabold text-base text-[#0A3D2C]">{state.settings.companyName}</p>
                <p className="font-bold text-slate-700 mt-0.5">
                  {isAr ? 'محضر جرد مخزني وتسوية فروقات' : 'Physical Stocktake & Adjustment Minutes'}
                </p>
                <p className="font-mono text-slate-500 mt-0.5">{printStocktake.id} · {printStocktake.date.slice(0, 10)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
                <div><span className="text-slate-500">{isAr ? 'المخزن:' : 'Warehouse:'}</span> <strong>{printStocktake.warehouseName}</strong></div>
                <div><span className="text-slate-500">{isAr ? 'الصنف:' : 'Product:'}</span> <strong>{printStocktake.productName}</strong></div>
                <div><span className="text-slate-500">{isAr ? 'القائم بالجرد:' : 'Auditor:'}</span> <strong>{printStocktake.countedBy || '—'}</strong></div>
                <div><span className="text-slate-500">{isAr ? 'السبب:' : 'Reason:'}</span> <strong>{printStocktake.reason || '—'}</strong></div>
              </div>

              <table className="w-full border border-slate-200 rounded-xl overflow-hidden text-xs">
                <thead className="bg-[#0A3D2C] text-white">
                  <tr>
                    <th className="p-2 text-start">{isAr ? 'الكمية بالنظام' : 'System Qty'}</th>
                    <th className="p-2 text-start">{isAr ? 'الجرد الفعلي' : 'Actual Qty'}</th>
                    <th className="p-2 text-start">{isAr ? 'فرق الكمية' : 'Variance Qty'}</th>
                    <th className="p-2 text-end">{isAr ? 'قيمة التسوية' : 'Variance Value'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-mono font-bold">
                    <td className="p-2.5">{printStocktake.systemQty}</td>
                    <td className="p-2.5">{printStocktake.actualQty}</td>
                    <td className="p-2.5">{printStocktake.varianceQty > 0 ? `+${printStocktake.varianceQty}` : printStocktake.varianceQty}</td>
                    <td className="p-2.5 text-end">{printStocktake.varianceValue.toFixed(2)} {cur}</td>
                  </tr>
                </tbody>
              </table>

              {printStocktake.notes && (
                <p className="text-slate-600"><strong>{t.notes}:</strong> {printStocktake.notes}</p>
              )}

              <div className="grid grid-cols-2 gap-6 pt-6 text-center text-[11px] text-slate-500">
                <div className="border-t pt-2">{isAr ? 'توقيع أمين المخزن' : 'Warehouse Manager Signature'}</div>
                <div className="border-t pt-2">{isAr ? 'اعتماد المدير المالي' : 'Finance Manager Approval'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
