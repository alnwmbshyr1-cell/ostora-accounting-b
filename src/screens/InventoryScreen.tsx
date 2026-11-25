import React, { useRef, useState } from 'react';
import { Camera, Download, Edit2, ImagePlus, Plus, ScanBarcode, Search, Trash2, Upload, Wand2 } from 'lucide-react';
import { BarcodeSvg } from '../components/QrMatrix';
import { DEFAULT_PRODUCT_IMAGE } from '../constants/permissions';
import { strings } from '../data/translations';
import { generateEan13 } from '../utils/barcode';
import { parseProductsCsv } from '../utils/csvImport';
import { downloadTextFile } from '../utils/export';
import { compressImageToBase64 } from '../utils/image';
import { ScreenProps } from './types';

export const InventoryScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [invSearch, setInvSearch] = useState('');
  const [scanModal, setScanModal] = useState<'search' | 'product' | null>(null);
  const [scanCodeInput, setScanCodeInput] = useState('');
  const [prdModal, setPrdModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [prdForm, setPrdForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    imageBase64: '',
    qty: '15',
    cost: '100',
    price: '150',
  });
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const raw = await file.text();
      const { items } = parseProductsCsv(raw);
      if (items.length === 0) {
        actions.notify(
          isAr ? 'لم يتم العثور على أصناف صالحة في ملف CSV' : 'No valid product rows found in CSV',
        );
        return;
      }
      const added = actions.importProductsBulk(items);
      actions.notify(
        isAr ? `تم استيراد ${added} صنف إلى المخزون` : `Imported ${added} products to inventory`,
      );
    } catch {
      actions.notify(isAr ? 'تعذر قراءة ملف CSV' : 'Failed to parse CSV file');
    }
  };

  const q = invSearch.trim().toLowerCase();
  const visibleProducts = state.products.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={invSearch}
            onChange={(e) => setInvSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم، SKU، أو الباركود...' : 'Search name, SKU, or barcode...'}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <button
          onClick={() => {
            const csv = ['ID,Name,SKU,Barcode,Qty,Cost,Price']
              .concat(
                state.products.map(
                  (p) => `${p.id},"${p.name.replace(/"/g, '""')}",${p.sku},${p.barcode},${p.qty},${p.cost},${p.price}`,
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
          onClick={() => csvInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#0A3D2C] dark:border-[#C9A227] bg-white dark:bg-[#121E19] text-[#0A3D2C] dark:text-[#C9A227] font-bold text-xs cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>{t.importCsv}</span>
        </button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleCsvFile}
        />
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
          onClick={() => {
            setPrdForm({
              name: '',
              sku: '',
              barcode: generateEan13(),
              imageBase64: '',
              qty: '15',
              cost: '100',
              price: '150',
            });
            setPrdModal({ open: true });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addProduct}</span>
        </button>
      </div>

      {visibleProducts.length === 0 ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
          {t.noData}
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleProducts.map((p) => {
          const low = p.qty <= 10;
          return (
            <div
              key={p.id}
              className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] overflow-hidden flex flex-col justify-between"
            >
              <div className="aspect-[16/10] bg-slate-100 dark:bg-[#0A120F] overflow-hidden">
                <img
                  src={p.imageBase64 || DEFAULT_PRODUCT_IMAGE}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-slate-500">{p.sku}</span>
                    {low && <span className="text-red-600 font-bold">{t.lowStock}</span>}
                  </div>
                  <h4 className="font-extrabold text-base">{p.name}</h4>
                  <p className="font-mono text-[11px] text-slate-500 mt-1 tabular-nums">
                    EAN: {p.barcode}
                  </p>
                  <div className="mt-1.5">
                    <BarcodeSvg code={p.barcode} height={24} />
                  </div>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-sm font-bold tabular-nums">
                    {t.qty}: {p.qty}
                  </span>
                  <span className="font-mono font-extrabold text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
                    {p.price.toFixed(0)} {cur}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#1F332B]">
                  <button
                    onClick={() => actions.addTenStock(p.id)}
                    className="flex-1 py-1.5 rounded-lg border border-[#0A3D2C] text-[#0A3D2C] dark:border-[#C9A227] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
                  >
                    {t.add10}
                  </button>
                  <button
                    onClick={() => {
                      setPrdForm({
                        name: p.name,
                        sku: p.sku,
                        barcode: p.barcode,
                        imageBase64: p.imageBase64 ?? '',
                        qty: String(p.qty),
                        cost: String(p.cost),
                        price: String(p.price),
                      });
                      setPrdModal({ open: true, editId: p.id });
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </button>
                  <button onClick={() => actions.deleteProduct(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {prdModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-md w-full p-6 space-y-3 my-auto">
            <h3 className="text-lg font-extrabold">{t.addProduct}</h3>

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

            <input maxLength={160} value={prdForm.name} onChange={(e) => setPrdForm({ ...prdForm, name: e.target.value })} placeholder={t.fullName} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <input maxLength={64} value={prdForm.sku} onChange={(e) => setPrdForm({ ...prdForm, sku: e.target.value })} placeholder={t.sku} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />

            <div className="flex gap-2">
              <input
                maxLength={64}
                value={prdForm.barcode}
                onChange={(e) => setPrdForm({ ...prdForm, barcode: e.target.value })}
                placeholder={t.barcode}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono"
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

            <div className="grid grid-cols-3 gap-2">
              <input type="number" min={0} value={prdForm.qty} onChange={(e) => setPrdForm({ ...prdForm, qty: e.target.value })} placeholder={t.qty} className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums" />
              <input type="number" min={0} step="0.01" value={prdForm.cost} onChange={(e) => setPrdForm({ ...prdForm, cost: e.target.value })} placeholder={t.cost} className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums" />
              <input type="number" min={0} step="0.01" value={prdForm.price} onChange={(e) => setPrdForm({ ...prdForm, price: e.target.value })} placeholder={t.price} className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setPrdModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!prdForm.name.trim()) return;
                  actions.saveProduct(
                    {
                      name: prdForm.name.trim(),
                      sku: prdForm.sku.trim() || 'SKU-NEW',
                      barcode: prdForm.barcode.trim() || generateEan13(),
                      imageBase64: prdForm.imageBase64 || undefined,
                      qty: Math.max(0, parseInt(prdForm.qty, 10) || 0),
                      cost: Math.max(0, parseFloat(prdForm.cost) || 0),
                      price: Math.max(0, parseFloat(prdForm.price) || 0),
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
              <button onClick={() => setScanModal(null)} className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer">{t.cancel}</button>
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
    </div>
  );
};
