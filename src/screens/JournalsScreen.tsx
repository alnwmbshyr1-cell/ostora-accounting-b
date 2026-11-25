import React, { useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { strings } from '../data/translations';
import { JournalLine } from '../types/erp';
import { ScreenProps } from './types';

export const JournalsScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [jrnModal, setJrnModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [jrnForm, setJrnForm] = useState({ description: '', reference: 'MANUAL' });
  const [jrnLines, setJrnLines] = useState<{ account: string; debit: string; credit: string }[]>([
    { account: '1010 - مصرف الراجحي', debit: '', credit: '0' },
    { account: '4010 - إيرادات المبيعات', debit: '0', credit: '' },
  ]);
  const [jrnError, setJrnError] = useState('');

  const sumDebit = jrnLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const sumCredit = jrnLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = sumDebit > 0 && Math.abs(sumDebit - sumCredit) < 0.01;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setJrnError('');
            setJrnForm({ description: '', reference: 'MANUAL' });
            setJrnLines([
              { account: '1010 - مصرف الراجحي', debit: '', credit: '0' },
              { account: '4010 - إيرادات المبيعات', debit: '0', credit: '' },
            ]);
            setJrnModal({ open: true });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addJournal}</span>
        </button>
      </div>

      <div className="space-y-3">
        {state.journals.length === 0 ? (
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
            {t.noData}
          </div>
        ) : (
          state.journals.map((j) => {
          const totalD = j.lines.reduce((s, l) => s + l.debit, 0);
          const totalC = j.lines.reduce((s, l) => s + l.credit, 0);
          return (
            <div key={j.id} className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-mono text-xs font-bold text-slate-500">{j.id} · {j.reference}</span>
                  <h4 className="font-extrabold text-base mt-0.5">{j.description}</h4>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setJrnError('');
                      setJrnForm({ description: j.description, reference: j.reference });
                      setJrnLines(
                        j.lines.map((l) => ({
                          account: l.account,
                          debit: l.debit ? String(l.debit) : '0',
                          credit: l.credit ? String(l.credit) : '0',
                        })),
                      );
                      setJrnModal({ open: true, editId: j.id });
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </button>
                  <button onClick={() => actions.deleteJournal(j.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-[#1F332B] text-xs">
                {j.lines.map((l, idx) => (
                  <div key={idx} className="py-2 grid grid-cols-12 gap-2">
                    <span className="col-span-6 font-medium">{l.account}</span>
                    <span className="col-span-3 text-end font-mono font-bold text-emerald-600 tabular-nums">{l.debit > 0 ? l.debit.toFixed(2) : '—'}</span>
                    <span className="col-span-3 text-end font-mono font-bold text-red-600 tabular-nums">{l.credit > 0 ? l.credit.toFixed(2) : '—'}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs font-mono font-bold text-slate-500 tabular-nums">
                {t.debit}: {totalD.toFixed(2)} {cur} · {t.credit}: {totalC.toFixed(2)} {cur}
              </div>
            </div>
          );
        })
        )}
      </div>

      {jrnModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-lg w-full p-6 space-y-3 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">{t.addJournal}</h3>
              <button
                type="button"
                onClick={() => setJrnLines([...jrnLines, { account: '', debit: '0', credit: '0' }])}
                className="px-2.5 py-1 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
              >
                + {t.addItem}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={jrnForm.description}
                maxLength={400}
                onChange={(e) => setJrnForm({ ...jrnForm, description: e.target.value })}
                placeholder={t.reason}
                className="col-span-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              />
              <input
                value={jrnForm.reference}
                maxLength={120}
                onChange={(e) => setJrnForm({ ...jrnForm, reference: e.target.value })}
                placeholder="REF"
                className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
              />
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {jrnLines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                  <input
                    value={line.account}
                    maxLength={160}
                    onChange={(e) => {
                      const next = [...jrnLines];
                      next[idx] = { ...next[idx], account: e.target.value };
                      setJrnLines(next);
                    }}
                    placeholder={t.account}
                    className="col-span-6 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.debit}
                    onChange={(e) => {
                      const next = [...jrnLines];
                      next[idx] = { ...next[idx], debit: e.target.value };
                      setJrnLines(next);
                    }}
                    placeholder={t.debit}
                    className="col-span-2 px-2 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.credit}
                    onChange={(e) => {
                      const next = [...jrnLines];
                      next[idx] = { ...next[idx], credit: e.target.value };
                      setJrnLines(next);
                    }}
                    placeholder={t.credit}
                    className="col-span-3 px-2 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                  />
                  <button
                    type="button"
                    disabled={jrnLines.length <= 2}
                    onClick={() => setJrnLines(jrnLines.filter((_, i) => i !== idx))}
                    className="col-span-1 p-1 text-red-500 disabled:opacity-30 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0A120F] flex items-center justify-between text-xs font-mono font-bold tabular-nums">
              <span>
                {t.debit}: {sumDebit.toFixed(2)} · {t.credit}: {sumCredit.toFixed(2)}
              </span>
              <span className={isBalanced ? 'text-emerald-600' : 'text-amber-600'}>
                {isBalanced ? (isAr ? 'متوازن ✓' : 'Balanced ✓') : isAr ? 'غير متوازن' : 'Unbalanced'}
              </span>
            </div>

            {jrnError && <p className="text-xs font-bold text-red-600">{jrnError}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setJrnModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  const parsed: JournalLine[] = jrnLines
                    .map((l) => ({
                      account: l.account.trim(),
                      debit: Math.max(0, parseFloat(l.debit) || 0),
                      credit: Math.max(0, parseFloat(l.credit) || 0),
                    }))
                    .filter((l) => l.account && (l.debit > 0 || l.credit > 0));
                  const d = parsed.reduce((s, l) => s + l.debit, 0);
                  const c = parsed.reduce((s, l) => s + l.credit, 0);
                  if (parsed.length < 2 || d <= 0 || Math.abs(d - c) > 0.01) {
                    setJrnError(t.unbalancedError);
                    return;
                  }
                  actions.saveJournal(
                    {
                      reference: jrnForm.reference.trim() || 'MANUAL',
                      description: jrnForm.description.trim() || 'Manual Entry',
                      date: new Date().toISOString(),
                      lines: parsed,
                    },
                    jrnModal.editId,
                  );
                  setJrnModal({ open: false });
                  actions.notify(isAr ? 'تم حفظ القيد المحاسبي' : 'Journal entry saved');
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
