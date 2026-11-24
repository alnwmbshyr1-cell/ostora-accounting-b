import React, { useState } from 'react';
import { Edit2, Landmark } from 'lucide-react';
import { strings } from '../data/translations';
import { ScreenProps } from './types';

export const BanksScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [bankEdit, setBankEdit] = useState<{ id: string; val: string } | null>(null);
  const [connectBankModal, setConnectBankModal] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setConnectBankModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Landmark className="w-4 h-4 text-[#C9A227]" />
          <span>{t.connectBank}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {state.banks.map((b) => {
          const isCash = b.id === 'cash';
          return (
            <div
              key={b.id}
              className={`rounded-[20px] p-6 space-y-4 border ${
                isCash
                  ? 'bg-[#C9A227]/15 border-[#C9A227] text-slate-900 dark:text-white'
                  : 'bg-[#0A3D2C] border-[#0A3D2C] text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold">{isAr ? b.nameAr : b.nameEn}</h3>
                <button
                  onClick={() => setBankEdit({ id: b.id, val: String(b.balance) })}
                  className="p-1.5 rounded-lg hover:bg-black/10 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-[#C9A227]" />
                </button>
              </div>
              <p className="font-mono text-xs opacity-75">{b.accountNumber}</p>
              <p
                className={`text-2xl font-extrabold font-mono tabular-nums ${
                  isCash ? 'text-[#0A3D2C] dark:text-[#C9A227]' : 'text-[#C9A227]'
                }`}
              >
                {b.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} {cur}
              </p>
            </div>
          );
        })}
      </div>

      {connectBankModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-extrabold">{t.connectBank}</h3>
            <p className="text-xs font-bold text-amber-600">{t.comingSoonManual}</p>
            <div className="space-y-2">
              {['AlRajhi Bank (مصرف الراجحي)', 'AlAhli SNB (البنك الأهلي)', 'STC Pay'].map((provider) => (
                <button
                  key={provider}
                  onClick={() => {
                    setConnectBankModal(false);
                    actions.notify(`${provider}: ${t.comingSoonManual}`);
                  }}
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-[#1F332B] flex items-center justify-between text-sm font-bold hover:border-[#0A3D2C] cursor-pointer"
                >
                  <span>{provider}</span>
                  <span className="text-xs text-slate-500">{t.comingSoonManual}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setConnectBankModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {bankEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold">{t.amount}</h3>
            <input
              type="number"
              value={bankEdit.val}
              onChange={(e) => setBankEdit({ ...bankEdit, val: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setBankEdit(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  actions.updateBankBalance(bankEdit.id, parseFloat(bankEdit.val) || 0);
                  setBankEdit(null);
                  actions.notify(isAr ? 'تم تحديث الرصيد البنكي' : 'Bank balance updated');
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
