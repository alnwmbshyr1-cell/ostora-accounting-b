import React, { useState } from 'react';
import { ArrowLeftRight, Edit2, Landmark, Plus, Trash2 } from 'lucide-react';
import { strings } from '../data/translations';
import { ScreenProps } from './types';

const BANK_PRESETS = [
  { nameAr: 'مصرف الراجحي', nameEn: 'AlRajhi Bank', prefix: 'SA03-8000-' },
  { nameAr: 'البنك الأهلي السعودي (SNB)', nameEn: 'Saudi National Bank (SNB)', prefix: 'SA15-1000-' },
  { nameAr: 'بنك الرياض', nameEn: 'Riyad Bank', prefix: 'SA42-2000-' },
  { nameAr: 'STC Pay / محفظة رقمية', nameEn: 'STC Pay Wallet', prefix: 'STC-PAY-' },
];

export const BanksScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [accountModal, setAccountModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [accountForm, setAccountForm] = useState({
    nameAr: '',
    nameEn: '',
    accountNumber: '',
    balance: '0',
  });

  const [transferModal, setTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromId: state.banks[0]?.id ?? 'cash',
    toId: state.banks[1]?.id ?? state.banks[0]?.id ?? 'alrajhi',
    amount: '',
    notes: '',
  });

  const totalTreasury = state.banks.reduce((sum, b) => sum + b.balance, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl px-4 py-2.5 flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500">{t.cashAndBanks}</span>
          <span className="font-mono font-extrabold text-base text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
            {totalTreasury.toLocaleString(undefined, { minimumFractionDigits: 2 })} {cur}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {state.banks.length >= 2 && (
            <button
              onClick={() => {
                setTransferForm({
                  fromId: state.banks[0]?.id ?? '',
                  toId: state.banks[1]?.id ?? '',
                  amount: '',
                  notes: '',
                });
                setTransferModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#0A3D2C] dark:border-[#C9A227] bg-white dark:bg-[#121E19] text-[#0A3D2C] dark:text-[#C9A227] font-bold text-sm cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>{t.transferFunds}</span>
            </button>
          )}
          <button
            onClick={() => {
              setAccountForm({ nameAr: '', nameEn: '', accountNumber: '', balance: '0' });
              setAccountModal({ open: true });
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#C9A227]" />
            <span>{t.addBankAccount}</span>
          </button>
        </div>
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
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold truncate">{isAr ? b.nameAr : b.nameEn}</h3>
                  <p className="text-[11px] opacity-75 truncate">{isAr ? b.nameEn : b.nameAr}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setAccountForm({
                        nameAr: b.nameAr,
                        nameEn: b.nameEn,
                        accountNumber: b.accountNumber,
                        balance: String(b.balance),
                      });
                      setAccountModal({ open: true, editId: b.id });
                    }}
                    aria-label={t.edit}
                    className="p-1.5 rounded-lg hover:bg-black/10 cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-[#C9A227]" />
                  </button>
                  {!isCash && (
                    <button
                      onClick={() => {
                        actions.deleteBankAccount(b.id);
                        actions.notify(isAr ? 'تم حذف الحساب البنكي' : 'Bank account deleted');
                      }}
                      aria-label={t.delete}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-red-300" />
                    </button>
                  )}
                </div>
              </div>
              <p className="font-mono text-xs opacity-75">{b.accountNumber || '—'}</p>
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

      {accountModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-md w-full p-6 space-y-3 my-auto">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
              <h3 className="text-lg font-extrabold">
                {accountModal.editId ? t.editBankAccount : t.addBankAccount}
              </h3>
            </div>

            {!accountModal.editId && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-500">{t.bankPresets}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {BANK_PRESETS.map((preset) => (
                    <button
                      key={preset.nameEn}
                      type="button"
                      onClick={() =>
                        setAccountForm({
                          ...accountForm,
                          nameAr: preset.nameAr,
                          nameEn: preset.nameEn,
                          accountNumber: `${preset.prefix}${Math.floor(1000 + Math.random() * 8999)}`,
                        })
                      }
                      className="p-2 rounded-xl border border-slate-200 dark:border-[#1F332B] hover:border-[#0A3D2C] text-start text-xs font-bold cursor-pointer truncate"
                    >
                      {isAr ? preset.nameAr : preset.nameEn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{t.accountNameAr}</label>
              <input
                value={accountForm.nameAr}
                maxLength={120}
                onChange={(e) => setAccountForm({ ...accountForm, nameAr: e.target.value })}
                placeholder="مصرف الراجحي - جاري"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{t.accountNameEn}</label>
              <input
                value={accountForm.nameEn}
                maxLength={120}
                onChange={(e) => setAccountForm({ ...accountForm, nameEn: e.target.value })}
                placeholder="AlRajhi Current Account"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{t.accountNumberLabel}</label>
                <input
                  value={accountForm.accountNumber}
                  maxLength={64}
                  onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                  placeholder="SA03-8000-..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{t.initialBalance} ({cur})</label>
                <input
                  type="number"
                  step="0.01"
                  value={accountForm.balance}
                  onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setAccountModal({ open: false })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  const nameAr = accountForm.nameAr.trim() || accountForm.nameEn.trim();
                  const nameEn = accountForm.nameEn.trim() || accountForm.nameAr.trim();
                  if (!nameAr || !nameEn) return;
                  const parsedBal = parseFloat(accountForm.balance);
                  actions.saveBankAccount(
                    {
                      nameAr,
                      nameEn,
                      accountNumber: accountForm.accountNumber.trim(),
                      balance: Number.isFinite(parsedBal) ? Number(parsedBal.toFixed(2)) : 0,
                    },
                    accountModal.editId,
                  );
                  setAccountModal({ open: false });
                  actions.notify(
                    accountModal.editId
                      ? isAr
                        ? 'تم تحديث بيانات الحساب'
                        : 'Account updated'
                      : isAr
                      ? 'تمت إضافة الحساب البنكي بنجاح'
                      : 'Bank account added',
                  );
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {transferModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-md w-full p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
              <h3 className="text-lg font-extrabold">{t.transferFunds}</h3>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{t.fromAccount}</label>
              <select
                value={transferForm.fromId}
                onChange={(e) => setTransferForm({ ...transferForm, fromId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              >
                {state.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isAr ? b.nameAr : b.nameEn} ({b.balance.toLocaleString()} {cur})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{t.toAccount}</label>
              <select
                value={transferForm.toId}
                onChange={(e) => setTransferForm({ ...transferForm, toId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              >
                {state.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isAr ? b.nameAr : b.nameEn} ({b.balance.toLocaleString()} {cur})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{t.amount} ({cur})</label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">{t.notes}</label>
              <input
                value={transferForm.notes}
                maxLength={250}
                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                placeholder={isAr ? 'إيداع مبيعات / تغذية صندوق...' : 'Cash deposit / treasury funding...'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setTransferModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                disabled={!transferForm.fromId || !transferForm.toId || transferForm.fromId === transferForm.toId}
                onClick={() => {
                  const amt = parseFloat(transferForm.amount) || 0;
                  if (amt <= 0 || transferForm.fromId === transferForm.toId) return;
                  const ok = actions.transferBetweenBanks(
                    transferForm.fromId,
                    transferForm.toId,
                    amt,
                    transferForm.notes,
                  );
                  if (ok) {
                    setTransferModal(false);
                    actions.notify(
                      isAr
                        ? 'تم تنفيذ التحويل وإنشاء قيد محاسبي مزدوج'
                        : 'Transfer completed with automatic journal entry',
                    );
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer disabled:opacity-50"
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
