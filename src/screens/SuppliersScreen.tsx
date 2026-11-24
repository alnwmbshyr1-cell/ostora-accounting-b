import React, { useState } from 'react';
import { Edit2, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { strings } from '../data/translations';
import { ScreenProps } from './types';

export const SuppliersScreen: React.FC<ScreenProps> = ({ store, onNavigate }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [supModal, setSupModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [supForm, setSupForm] = useState({ name: '', phone: '', category: '', payable: '0' });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setSupForm({ name: '', phone: '', category: '', payable: '0' });
            setSupModal({ open: true });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addSupplier}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.suppliers.map((s) => (
          <div key={s.id} className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-extrabold text-base">{s.name}</h4>
                <p className="text-xs text-slate-500">{s.category} · {s.phone}</p>
              </div>
              <span className="font-mono font-extrabold text-sm text-red-600 tabular-nums">{s.payable.toLocaleString()} {cur}</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#1F332B]">
              <button
                onClick={() => onNavigate('purchase_orders')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{t.createPo}</span>
              </button>
              <div className="ms-auto flex gap-1">
                <button
                  onClick={() => {
                    setSupForm({ name: s.name, phone: s.phone, category: s.category, payable: String(s.payable) });
                    setSupModal({ open: true, editId: s.id });
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-slate-500" />
                </button>
                <button onClick={() => actions.deleteSupplier(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {supModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-md w-full p-6 space-y-3">
            <h3 className="text-lg font-extrabold">{t.addSupplier}</h3>
            <input value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} placeholder={t.fullName} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <input value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} placeholder={t.phone} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <input value={supForm.category} onChange={(e) => setSupForm({ ...supForm, category: e.target.value })} placeholder={t.category} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <input type="number" value={supForm.payable} onChange={(e) => setSupForm({ ...supForm, payable: e.target.value })} placeholder={t.supplierDebt} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setSupModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!supForm.name.trim()) return;
                  actions.saveSupplier({ name: supForm.name.trim(), phone: supForm.phone.trim(), category: supForm.category.trim(), payable: parseFloat(supForm.payable) || 0 }, supModal.editId);
                  setSupModal({ open: false });
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
