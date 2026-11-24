import React, { useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { strings } from '../data/translations';
import { ScreenProps } from './types';

export const ExpensesScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [expModal, setExpModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [expForm, setExpForm] = useState({ title: '', category: '', amount: '' });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setExpForm({ title: '', category: isAr ? 'تشغيل' : 'Operations', amount: '' });
            setExpModal({ open: true });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addExpense}</span>
        </button>
      </div>

      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] divide-y divide-slate-100 dark:divide-[#1F332B]">
        {state.expenses.map((e) => (
          <div key={e.id} className="p-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-sm">{e.title}</h4>
              <p className="text-xs text-slate-500">
                {e.category} · {new Date(e.date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-sm text-red-600 tabular-nums">
                {e.amount.toFixed(0)} {cur}
              </span>
              <button
                onClick={() => {
                  setExpForm({ title: e.title, category: e.category, amount: String(e.amount) });
                  setExpModal({ open: true, editId: e.id });
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
              >
                <Edit2 className="w-4 h-4 text-slate-500" />
              </button>
              <button onClick={() => actions.deleteExpense(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer">
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {expModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-md w-full p-6 space-y-3">
            <h3 className="text-lg font-extrabold">{t.addExpense}</h3>
            <input value={expForm.title} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} placeholder={t.reason} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <input value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} placeholder={t.category} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <input type="number" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} placeholder={t.amount} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setExpModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  const amt = parseFloat(expForm.amount) || 0;
                  if (!expForm.title.trim() || amt <= 0) return;
                  actions.saveExpense(
                    { title: expForm.title.trim(), category: expForm.category.trim(), amount: amt, paidFromBankId: 'cash', date: new Date().toISOString() },
                    expModal.editId,
                  );
                  setExpModal({ open: false });
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
