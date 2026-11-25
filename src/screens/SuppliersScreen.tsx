import React, { useState } from 'react';
import { Edit2, FileText, Plus, Printer, Search, ShoppingBag, Trash2, Upload, X } from 'lucide-react';
import { DataImportModal } from '../components/DataImportModal';
import { strings } from '../data/translations';
import { PartyStatus, PaymentMethodType, Supplier, SupplierType } from '../types/erp';
import { ScreenProps } from './types';

export const SuppliersScreen: React.FC<ScreenProps> = ({ store, onNavigate }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];
  const canDelete = state.currentRole !== 'accountant';

  const [supSearch, setSupSearch] = useState('');
  const [supModal, setSupModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [stmtSupplier, setStmtSupplier] = useState<Supplier | null>(null);
  const [supForm, setSupForm] = useState({
    code: '',
    name: '',
    companyName: '',
    phone: '',
    whatsapp: '',
    email: '',
    category: '',
    address: '',
    city: '',
    country: '',
    supplierType: 'primary' as SupplierType,
    taxNumber: '',
    crNumber: '',
    bankAccount: '',
    bankName: '',
    payable: '0',
    creditLimit: '',
    paymentTermDays: '30',
    preferredPaymentMethod: 'transfer' as PaymentMethodType,
    status: 'active' as PartyStatus,
    notes: '',
    contractsNotes: '',
  });
  const [importOpen, setImportOpen] = useState(false);

  const q = supSearch.trim().toLowerCase();
  const visibleSuppliers = state.suppliers.filter(
    (s) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.code ?? '').toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={supSearch}
            onChange={(e) => setSupSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#0A3D2C] dark:border-[#C9A227] bg-white dark:bg-[#121E19] text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>{t.importDataBtn}</span>
        </button>
        <button
          onClick={() => {
            setSupForm({
              code: '',
              name: '',
              companyName: '',
              phone: '',
              whatsapp: '',
              email: '',
              category: '',
              address: '',
              city: '',
              country: '',
              supplierType: 'primary',
              taxNumber: '',
              crNumber: '',
              bankAccount: '',
              bankName: '',
              payable: '0',
              creditLimit: '',
              paymentTermDays: '30',
              preferredPaymentMethod: 'transfer',
              status: 'active',
              notes: '',
              contractsNotes: '',
            });
            setSupModal({ open: true });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addSupplier}</span>
        </button>
      </div>

      {visibleSuppliers.length === 0 ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
          {t.noData}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleSuppliers.map((s) => {
            const supPOs = state.purchaseOrders.filter((po) => po.supplierId === s.id || po.supplierName === s.name);
            return (
              <div key={s.id} className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-base">{s.name}</h4>
                      {s.supplierType && (
                        <span className="px-1.5 py-0.5 rounded bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227] text-[10px] font-bold uppercase">
                          {s.supplierType}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{s.code || s.id} · {s.category} · {s.phone}</p>
                    {s.bankName && <p className="text-[11px] font-mono text-slate-400">{s.bankName} · {s.bankAccount}</p>}
                  </div>
                  <span className="font-mono font-extrabold text-sm text-red-600 tabular-nums shrink-0">{s.payable.toLocaleString()} {cur}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#1F332B]">
                  <button
                    onClick={() => setStmtSupplier(s)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                    <span>{t.supplierStatement} ({supPOs.length})</span>
                  </button>
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
                        setSupForm({
                          code: s.code ?? s.id,
                          name: s.name,
                          companyName: s.companyName ?? '',
                          phone: s.phone,
                          whatsapp: s.whatsapp ?? '',
                          email: s.email ?? '',
                          category: s.category,
                          address: s.address ?? '',
                          city: s.city ?? '',
                          country: s.country ?? '',
                          supplierType: s.supplierType ?? 'primary',
                          taxNumber: s.taxNumber ?? '',
                          crNumber: s.crNumber ?? '',
                          bankAccount: s.bankAccount ?? '',
                          bankName: s.bankName ?? '',
                          payable: String(s.payable),
                          creditLimit: s.creditLimit !== undefined ? String(s.creditLimit) : '',
                          paymentTermDays: String(s.paymentTermDays ?? 30),
                          preferredPaymentMethod: s.preferredPaymentMethod ?? 'transfer',
                          status: s.status ?? 'active',
                          notes: s.notes ?? '',
                          contractsNotes: s.contractsNotes ?? '',
                        });
                        setSupModal({ open: true, editId: s.id });
                      }}
                      aria-label={t.edit}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => actions.deleteSupplier(s.id)}
                        aria-label={t.delete}
                        className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
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

      {supModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-2xl w-full p-6 space-y-3 my-auto max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-extrabold">{supModal.editId ? t.edit : t.addSupplier}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input value={supForm.code} onChange={(e) => setSupForm({ ...supForm, code: e.target.value })} placeholder={isAr ? 'كود المورد' : 'Supplier Code'} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              <input value={supForm.name} maxLength={160} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} placeholder={t.fullName} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold" />
              <input value={supForm.companyName} onChange={(e) => setSupForm({ ...supForm, companyName: e.target.value })} placeholder={t.companyName} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <input type="tel" value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} placeholder={t.phone} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <input type="email" value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} placeholder={t.email} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <input value={supForm.category} onChange={(e) => setSupForm({ ...supForm, category: e.target.value })} placeholder={t.category} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <input value={supForm.taxNumber} onChange={(e) => setSupForm({ ...supForm, taxNumber: e.target.value })} placeholder={t.taxNumber} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              <input value={supForm.crNumber} onChange={(e) => setSupForm({ ...supForm, crNumber: e.target.value })} placeholder={t.crNumber} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              <input value={supForm.bankName} onChange={(e) => setSupForm({ ...supForm, bankName: e.target.value })} placeholder={isAr ? 'اسم البنك' : 'Bank Name'} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <input value={supForm.bankAccount} onChange={(e) => setSupForm({ ...supForm, bankAccount: e.target.value })} placeholder={t.accountNumberLabel} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              <select value={supForm.supplierType} onChange={(e) => setSupForm({ ...supForm, supplierType: e.target.value as SupplierType })} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                <option value="primary">{isAr ? 'مورد رئيسي' : 'Primary'}</option>
                <option value="secondary">{isAr ? 'مورد فرعي' : 'Secondary'}</option>
                <option value="manufacturer">{isAr ? 'مصنع' : 'Manufacturer'}</option>
                <option value="importer">{isAr ? 'مستورد' : 'Importer'}</option>
              </select>
              <input type="number" min={0} step="0.01" value={supForm.payable} onChange={(e) => setSupForm({ ...supForm, payable: e.target.value })} placeholder={t.supplierDebt} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
            </div>
            <textarea rows={2} value={supForm.contractsNotes} onChange={(e) => setSupForm({ ...supForm, contractsNotes: e.target.value })} placeholder={isAr ? 'ملاحظات العقود وأسعار الشراء الخاصة' : 'Contracts & Special Pricing Notes'} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setSupModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!supForm.name.trim()) return;
                  actions.saveSupplier(
                    {
                      code: supForm.code.trim() || undefined,
                      name: supForm.name.trim(),
                      companyName: supForm.companyName.trim() || undefined,
                      phone: supForm.phone.trim(),
                      whatsapp: supForm.whatsapp.trim() || undefined,
                      email: supForm.email.trim() || undefined,
                      category: supForm.category.trim(),
                      address: supForm.address.trim() || undefined,
                      city: supForm.city.trim() || undefined,
                      country: supForm.country.trim() || undefined,
                      supplierType: supForm.supplierType,
                      taxNumber: supForm.taxNumber.trim() || undefined,
                      crNumber: supForm.crNumber.trim() || undefined,
                      bankAccount: supForm.bankAccount.trim() || undefined,
                      bankName: supForm.bankName.trim() || undefined,
                      payable: Math.max(0, parseFloat(supForm.payable) || 0),
                      status: supForm.status,
                      notes: supForm.notes.trim() || undefined,
                      contractsNotes: supForm.contractsNotes.trim() || undefined,
                    },
                    supModal.editId,
                  );
                  setSupModal({ open: false });
                  actions.notify(isAr ? 'تم حفظ بيانات المورد' : 'Supplier saved');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {stmtSupplier && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-[#1F332B]">
              <div>
                <h3 className="text-base font-extrabold">{t.supplierStatement}: {stmtSupplier.name}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {stmtSupplier.phone} · {t.supplierDebt}: {stmtSupplier.payable.toLocaleString()} {cur}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer">
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printPdf}</span>
                </button>
                <button onClick={() => setStmtSupplier(null)} className="p-1 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-[#0A120F]">
                  <tr>
                    <th className="p-2 text-start">{t.date}</th>
                    <th className="p-2 text-start">{t.product}</th>
                    <th className="p-2 text-end">{t.qty}</th>
                    <th className="p-2 text-end">{t.cost}</th>
                    <th className="p-2 text-end">{t.total}</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-[#1F332B]">
                  {state.purchaseOrders
                    .filter((p) => p.supplierId === stmtSupplier.id || p.supplierName === stmtSupplier.name)
                    .map((p) => (
                      <tr key={p.id}>
                        <td className="p-2 font-mono">{p.date.slice(0, 10)}</td>
                        <td className="p-2">{p.id} · {p.productName}</td>
                        <td className="p-2 text-end font-mono">{p.quantity}</td>
                        <td className="p-2 text-end font-mono">{p.unitCost.toFixed(2)}</td>
                        <td className="p-2 text-end font-mono font-bold">{p.total.toFixed(2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <DataImportModal
        open={importOpen}
        defaultEntity="suppliers"
        allowEntitySwitch={false}
        store={store}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
};
