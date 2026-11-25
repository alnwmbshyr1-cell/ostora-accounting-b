import React, { useState } from 'react';
import { Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { strings } from '../data/translations';
import { ScreenProps } from './types';

export const ExpensesScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [expSearch, setExpSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [expModal, setExpModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [expForm, setExpForm] = useState({
    title: '',
    category: '',
    amount: '',
    paidFromBankId: state.banks[0]?.id ?? 'cash',
  });

  const categories = Array.from(new Set(state.expenses.map((e) => e.category).filter(Boolean)));
  const q = expSearch.trim().toLowerCase();
  const visibleExpenses = state.expenses.filter((e) => {
    const okCat = catFilter === 'all' || e.category === catFilter;
    const okQ =
      !q ||
      e.title.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q);
    return okCat && okQ;
  });

  const totalShown = visibleExpenses.reduce((sum, e) => sum + e.amount, 0);

  const bankLabel = (bankId: string) => {
    const found = state.banks.find((b) => b.id === bankId);
    if (!found) return bankId;
    return isAr ? found.nameAr : found.nameEn;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={expSearch}
            onChange={(e) => setExpSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2">
          <span className="text-slate-500">{t.totalExpensesLabel}:</span>
          <span className="font-mono text-red-600 font-extrabold tabular-nums">
            {totalShown.toLocaleString()} {cur}
          </span>
        </div>
        <button
          onClick={() => {
            setExpForm({
              title: '',
              category: isAr ? 'تشغيل' : 'Operations',
              amount: '',
              paidFromBankId: state.banks[0]?.id ?? 'cash',
            });
            setExpModal({ open: true });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addExpense}</span>
        </button>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl w-fit">
          <button
            onClick={() => setCatFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              catFilter === 'all' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.all}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                catFilter === cat ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] divide-y divide-slate-100 dark:divide-[#1F332B]">
        {visibleExpenses.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">{t.noData}</p>
        ) : (
          visibleExpenses.map((e) => (
            <div key={e.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="font-bold text-sm truncate">{e.title}</h4>
                <p className="text-xs text-slate-500">
                  {e.category} · {bankLabel(e.paidFromBankId)} · {new Date(e.date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-extrabold text-sm text-red-600 tabular-nums">
                  {e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {cur}
                </span>
                <button
                  onClick={() => {
                    setExpForm({
                      title: e.title,
                      category: e.category,
                      amount: String(e.amount),
                      paidFromBankId: e.paidFromBankId || state.banks[0]?.id || 'cash',
                    });
                    setExpModal({ open: true, editId: e.id });
                  }}
                  aria-label={t.edit}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-slate-500" />
                </button>
                <button
                  onClick={() => actions.deleteExpense(e.id)}
                  aria-label={t.delete}
                  className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {expModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-md w-full p-6 space-y-3">
            <h3 className="text-lg font-extrabold">{expModal.editId ? t.edit : t.addExpense}</h3>
            <input
              value={expForm.title}
              maxLength={160}
              onChange={(e) => setExpForm({ ...expForm, title: e.target.value })}
              placeholder={t.reason}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />
            <input
              value={expForm.category}
              maxLength={80}
              onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
              placeholder={t.category}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{t.paidFromAccount}</label>
              <select
                value={expForm.paidFromBankId}
                onChange={(e) => setExpForm({ ...expForm, paidFromBankId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              >
                {state.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isAr ? b.nameAr : b.nameEn} ({b.balance.toLocaleString()} {cur})
                  </option>
                ))}
              </select>
            </div>
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={expForm.amount}
              onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
              placeholder={t.amount}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setExpModal({ open: false })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  const amt = parseFloat(expForm.amount) || 0;
                  if (!expForm.title.trim() || amt <= 0) return;
                  actions.saveExpense(
                    {
                      title: expForm.title.trim(),
                      category: expForm.category.trim() || (isAr ? 'تشغيل' : 'Operations'),
                      amount: amt,
                      paidFromBankId: expForm.paidFromBankId || 'cash',
                      date: new Date().toISOString(),
                    },
                    expModal.editId,
                  );
                  setExpModal({ open: false });
                  actions.notify(isAr ? 'تم حفظ المصروف وتحديث الرصيد' : 'Expense saved & account updated');
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
