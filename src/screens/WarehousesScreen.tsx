import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  ClipboardCheck,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { strings } from '../data/translations';
import { computeAdvancedInsights } from '../domain/analytics';
import { ScreenProps } from './types';

export const WarehousesScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];
  const cur = state.settings.currency;
  const canDelete = state.currentRole !== 'accountant';

  const insights = useMemo(() => computeAdvancedInsights(state), [state]);

  const [whModal, setWhModal] = useState(false);
  const [trModal, setTrModal] = useState(false);
  const [stModal, setStModal] = useState(false);

  // Add warehouse form
  const [whNameAr, setWhNameAr] = useState('');
  const [whNameEn, setWhNameEn] = useState('');
  const [whLocation, setWhLocation] = useState('');
  const [whManager, setWhManager] = useState('');
  const [whBranchId, setWhBranchId] = useState(state.branches[0]?.id ?? 'BR-MAIN');

  // Transfer form
  const [trProdId, setTrProdId] = useState(state.products[0]?.id ?? '');
  const [trFrom, setTrFrom] = useState(state.warehouses[0]?.id ?? '');
  const [trTo, setTrTo] = useState(state.warehouses[1]?.id ?? state.warehouses[0]?.id ?? '');
  const [trQty, setTrQty] = useState(1);
  const [trNotes, setTrNotes] = useState('');

  // Stocktake form
  const [stWhId, setStWhId] = useState(state.warehouses[0]?.id ?? '');
  const [stProdId, setStProdId] = useState(state.products[0]?.id ?? '');
  const [stActualQty, setStActualQty] = useState(state.products[0]?.qty ?? 0);
  const [stNotes, setStNotes] = useState('');

  const selectedStProd = state.products.find((p) => p.id === stProdId);
  const stVariance = selectedStProd ? stActualQty - selectedStProd.qty : 0;

  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whNameAr.trim() && !whNameEn.trim()) return;
    actions.saveWarehouse({
      nameAr: whNameAr.trim() || whNameEn.trim(),
      nameEn: whNameEn.trim() || whNameAr.trim(),
      branchId: whBranchId,
      location: whLocation.trim(),
      managerName: whManager.trim(),
      active: true,
    });
    setWhNameAr('');
    setWhNameEn('');
    setWhLocation('');
    setWhManager('');
    setWhModal(false);
    actions.notify(isAr ? 'تمت إضافة المخزن بنجاح' : 'Warehouse created');
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = actions.transferStockBetweenWarehouses(trProdId, trFrom, trTo, Number(trQty), trNotes);
    if (ok) {
      setTrModal(false);
      actions.notify(isAr ? 'تم تحويل المخزون وتسجيل الحركة' : 'Stock transferred cleanly');
    } else {
      actions.notify(isAr ? 'تحقق من المخزنين والكمية' : 'Check source, destination warehouse and qty');
    }
  };

  const handleStocktake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stProdId) return;
    const ok = actions.recordStocktake(stWhId, stProdId, Number(stActualQty), stNotes);
    if (ok) {
      setStModal(false);
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
              setStModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C9A227] text-slate-950 text-xs font-extrabold cursor-pointer"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>{t.physicalStocktake}</span>
          </button>
          <button
            type="button"
            onClick={() => setTrModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-[#C9A227]" />
            <span>{t.transferStock}</span>
          </button>
          <button
            type="button"
            onClick={() => setWhModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addWarehouse}</span>
          </button>
        </div>
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
        {state.warehouses.map((wh) => {
          const itemCount = state.products.filter((p) => (p.warehouseId || state.warehouses[0]?.id) === wh.id).length;
          return (
            <div
              key={wh.id}
              className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono text-[#C9A227] font-bold">{wh.id}</span>
                  <h3 className="text-sm font-extrabold">{isAr ? wh.nameAr : wh.nameEn}</h3>
                  <p className="text-xs text-slate-500">{wh.location || '—'}</p>
                </div>
                {canDelete && state.warehouses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => actions.deleteWarehouse(wh.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
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
          {state.stocktakes.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">{t.noData}</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {state.stocktakes.map((st) => (
                <div
                  key={st.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold">{st.productName} · <span className="text-slate-500">{st.warehouseName}</span></p>
                    <p className="text-[11px] text-slate-500">
                      {st.date.slice(0, 10)} · {isAr ? `النظام ${st.systemQty} ← الفعلي ${st.actualQty}` : `Sys ${st.systemQty} -> Act ${st.actualQty}`}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-extrabold tabular-nums ${
                      st.varianceQty === 0 ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {st.varianceQty > 0 ? `+${st.varianceQty}` : st.varianceQty} ({st.varianceValue.toLocaleString()} {cur})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 space-y-3">
          <h3 className="text-xs font-extrabold">{isAr ? 'سجل حركات الأصناف' : 'Stock Movement History'}</h3>
          {state.stockMovements.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">{t.noData}</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {state.stockMovements.slice(0, 30).map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold">{m.productName}</p>
                    <p className="text-[11px] text-slate-500">
                      {m.movementType} · {m.referenceId} · {m.date.slice(0, 10)}
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

      {/* Add Warehouse Modal */}
      {whModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[22px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">{t.addWarehouse}</h3>
              <button onClick={() => setWhModal(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveWarehouse} className="space-y-3">
              <input
                required
                placeholder={isAr ? 'اسم المخزن بالعربي' : 'Warehouse Name (AR)'}
                value={whNameAr}
                onChange={(e) => setWhNameAr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
              <input
                placeholder="Warehouse Name (EN)"
                value={whNameEn}
                onChange={(e) => setWhNameEn(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
              <select
                value={whBranchId}
                onChange={(e) => setWhBranchId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              >
                {state.branches.map((b) => (
                  <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
                ))}
              </select>
              <input
                placeholder={isAr ? 'الموقع / المدينة' : 'Location'}
                value={whLocation}
                onChange={(e) => setWhLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
              <input
                placeholder={isAr ? 'أمين المخزن' : 'Warehouse Manager'}
                value={whManager}
                onChange={(e) => setWhManager(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setWhModal(false)} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer">{t.cancel}</button>
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
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.product}</label>
                <select value={trProdId} onChange={(e) => setTrProdId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                  {state.products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.qty})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'من مخزن' : 'From'}</label>
                  <select value={trFrom} onChange={(e) => setTrFrom(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    {state.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{isAr ? w.nameAr : w.nameEn}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'إلى مخزن' : 'To'}</label>
                  <select value={trTo} onChange={(e) => setTrTo(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    {state.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{isAr ? w.nameAr : w.nameEn}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.qty}</label>
                <input type="number" min={1} value={trQty} onChange={(e) => setTrQty(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
              <input placeholder={t.notes} value={trNotes} onChange={(e) => setTrNotes(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[22px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">{t.physicalStocktake}</h3>
              <button onClick={() => setStModal(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleStocktake} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? 'المخزن' : 'Warehouse'}</label>
                <select value={stWhId} onChange={(e) => setStWhId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                  {state.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{isAr ? w.nameAr : w.nameEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{t.product}</label>
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
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">{isAr ? 'الجرد الفعلي' : 'Actual Count'}</label>
                  <input
                    type="number"
                    min={0}
                    value={stActualQty}
                    onChange={(e) => setStActualQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono font-bold"
                  />
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-xs font-bold flex justify-between">
                <span>{isAr ? 'فرق التسوية' : 'Variance'}:</span>
                <span className="font-mono">{stVariance > 0 ? `+${stVariance}` : stVariance}</span>
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
    </div>
  );
};
