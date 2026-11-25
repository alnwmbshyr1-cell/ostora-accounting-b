import React, { useState } from 'react';
import { Download, Edit2, FileText, MapPin, MessageCircle, Plus, Printer, Receipt, Search, Trash2, Upload, X } from 'lucide-react';
import { DataImportModal } from '../components/DataImportModal';
import { useFirebase } from '../contexts/FirebaseContext';
import { strings } from '../data/translations';
import { Customer, CustomerType, PartyStatus, PaymentMethodType } from '../types/erp';
import { downloadTextFile } from '../utils/export';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

export const CustomersScreen: React.FC<ScreenProps> = ({ store, onNavigate }) => {
  const { user } = useFirebase();
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];
  const canDelete = state.currentRole !== 'accountant';
  const isSalesman = state.currentRole === 'salesman';

  const [custSearch, setCustSearch] = useState('');
  const [custModal, setCustModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [stmtCustomer, setStmtCustomer] = useState<Customer | null>(null);
  const [custForm, setCustForm] = useState({
    code: '',
    name: '',
    companyName: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: '',
    country: '',
    mapUrl: '',
    customerType: 'company' as CustomerType,
    taxNumber: '',
    nationalId: '',
    birthDate: '',
    debt: '0',
    creditLimit: '',
    creditTermDays: '30',
    preferredPaymentMethod: 'transfer' as PaymentMethodType,
    salesRep: state.currentRole as string,
    branchId: state.branches[0]?.id ?? '',
    status: 'active' as PartyStatus,
    notes: '',
    callLogs: '',
  });
  const [importOpen, setImportOpen] = useState(false);

  const q = custSearch.trim().toLowerCase();
  const visibleCustomers = state.customers.filter((c) => {
    if (isSalesman && c.salesRep && c.salesRep !== 'salesman' && c.salesRep !== user?.email) {
      return false;
    }
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.code ?? '').toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  const openAddModal = () => {
    setCustForm({
      code: '',
      name: '',
      companyName: '',
      phone: '',
      whatsapp: '',
      email: '',
      address: '',
      city: '',
      country: isAr ? 'السعودية' : 'Saudi Arabia',
      mapUrl: '',
      customerType: 'company',
      taxNumber: '',
      nationalId: '',
      birthDate: '',
      debt: '0',
      creditLimit: '',
      creditTermDays: '30',
      preferredPaymentMethod: 'transfer',
      salesRep: state.currentRole,
      branchId: state.branches[0]?.id ?? '',
      status: 'active',
      notes: '',
      callLogs: '',
    });
    setCustModal({ open: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={custSearch}
            onChange={(e) => setCustSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const csv = ['ID,Code,Name,Phone,Email,City,TaxNumber,Debt,CreditLimit,Status']
                .concat(
                  state.customers.map(
                    (c) => `${c.id},"${c.code ?? ''}","${c.name}",${c.phone},${c.email},"${c.city ?? ''}","${c.taxNumber ?? ''}",${c.debt},${c.creditLimit ?? ''},${c.status ?? 'active'}`,
                  ),
                )
                .join('\n');
              downloadTextFile('ostora_customers.csv', csv);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{t.exportCsv}</span>
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#0A3D2C] dark:border-[#C9A227] bg-white dark:bg-[#121E19] text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{t.importDataBtn}</span>
          </button>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addCustomer}</span>
        </button>
      </div>

      {visibleCustomers.length === 0 ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
          {t.noData}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleCustomers.map((c) => {
            const hasLimit = typeof c.creditLimit === 'number' && Number.isFinite(c.creditLimit);
            const limitVal = hasLimit ? (c.creditLimit as number) : 0;
            const avail = hasLimit ? Math.max(0, limitVal - c.debt) : null;
            const pct = hasLimit
              ? limitVal > 0
                ? Math.min(100, Math.round((c.debt / limitVal) * 100))
                : c.debt > 0
                ? 100
                : 0
              : 0;
            const isOverOrAtLimit = hasLimit && c.debt >= limitVal && (c.debt > limitVal || limitVal === 0);
            const custInvoices = state.invoices.filter((inv) => inv.customerId === c.id || inv.customerName === c.name);
            const totalPurchases = custInvoices.reduce((s, inv) => s + inv.total, 0);

            return (
              <div key={c.id} className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#0A3D2C] text-white font-extrabold flex items-center justify-center shrink-0">
                    {c.name.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm truncate">{c.name}</h4>
                      {c.customerType && (
                        <span className="px-1.5 py-0.5 rounded bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227] text-[10px] font-bold uppercase">
                          {c.customerType}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono truncate">
                      {c.code || c.id} · {c.phone} {c.city ? `· ${c.city}` : ''}
                    </p>
                  </div>
                  <div className="text-end">
                    <span className={`font-mono font-extrabold text-sm tabular-nums block ${c.debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {c.debt.toLocaleString()} {cur}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {t.creditLimit}: {hasLimit ? `${limitVal.toLocaleString()} ${cur}` : t.unlimitedCredit}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] bg-slate-50 dark:bg-[#0A120F] p-2.5 rounded-xl">
                  <div>
                    <span className="text-slate-400 block">{isAr ? 'عدد الفواتير' : 'Invoices'}</span>
                    <span className="font-mono font-bold">{custInvoices.length}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{isAr ? 'إجمالي المشتريات' : 'Total Sales'}</span>
                    <span className="font-mono font-bold">{totalPurchases.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t.status}</span>
                    <span className={`font-bold ${c.status === 'blocked' ? 'text-red-600' : 'text-emerald-600'}`}>
                      {c.status ?? 'active'}
                    </span>
                  </div>
                </div>

                {hasLimit && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className={isOverOrAtLimit ? 'text-red-600 font-bold' : 'text-slate-500'}>
                        {t.availableCredit}: {(avail ?? 0).toLocaleString()} {cur}
                      </span>
                      <span className={pct >= 90 ? 'text-red-600 font-bold' : 'text-slate-500'}>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#0A120F] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 95 ? 'bg-red-600' : pct >= 75 ? 'bg-amber-500' : 'bg-[#0A3D2C] dark:bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#1F332B]">
                  <button
                    onClick={() => setStmtCustomer(c)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                    <span>{t.customerStatement}</span>
                  </button>
                  <a
                    href={buildWhatsAppLink(
                      c.whatsapp || c.phone,
                      isAr
                        ? `السلام عليكم ${c.name}، تذكير بالرصيد المستحق ${c.debt.toFixed(2)} ${cur} لدى ${state.settings.companyName}.`
                        : `Dear ${c.name}, reminder of balance ${c.debt.toFixed(2)} ${cur} with ${state.settings.companyName}.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{t.whatsappReminder}</span>
                  </a>
                  <button
                    onClick={() => {
                      if (c.debt > 0) {
                        const defaultBankId =
                          state.banks.find((b) => b.id === 'alrajhi')?.id ??
                          state.banks[0]?.id ??
                          'cash';
                        actions.saveVoucher({
                          type: 'receipt',
                          partyName: c.name,
                          partyPhone: c.phone,
                          amount: c.debt,
                          reason: isAr ? 'سداد رصيد عميل' : 'Customer debt settlement',
                          paymentMethod: defaultBankId,
                          date: new Date().toISOString(),
                        });
                      }
                      onNavigate('vouchers');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>{t.createReceipt}</span>
                  </button>
                  {c.mapUrl && (
                    <a href={c.mapUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-slate-100">
                      <MapPin className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
                    </a>
                  )}
                  <div className="ms-auto flex gap-1">
                    <button
                      onClick={() => {
                        setCustForm({
                          code: c.code ?? c.id,
                          name: c.name,
                          companyName: c.companyName ?? '',
                          phone: c.phone,
                          whatsapp: c.whatsapp ?? '',
                          email: c.email,
                          address: c.address ?? '',
                          city: c.city ?? '',
                          country: c.country ?? '',
                          mapUrl: c.mapUrl ?? '',
                          customerType: c.customerType ?? 'company',
                          taxNumber: c.taxNumber ?? '',
                          nationalId: c.nationalId ?? '',
                          birthDate: c.birthDate ?? '',
                          debt: String(c.debt),
                          creditLimit: typeof c.creditLimit === 'number' ? String(c.creditLimit) : '',
                          creditTermDays: String(c.creditTermDays ?? 30),
                          preferredPaymentMethod: c.preferredPaymentMethod ?? 'transfer',
                          salesRep: c.salesRep ?? state.currentRole,
                          branchId: c.branchId ?? state.branches[0]?.id ?? '',
                          status: c.status ?? 'active',
                          notes: c.notes ?? '',
                          callLogs: c.callLogs ?? '',
                        });
                        setCustModal({ open: true, editId: c.id });
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </button>
                    {canDelete && (
                      <button onClick={() => actions.deleteCustomer(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer">
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

      {custModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-2xl w-full p-6 space-y-3 my-auto max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-extrabold">{custModal.editId ? t.edit : t.addCustomer}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input value={custForm.code} onChange={(e) => setCustForm({ ...custForm, code: e.target.value })} placeholder={isAr ? 'كود العميل' : 'Customer Code'} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              <input maxLength={160} value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} placeholder={t.fullName} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold" />
              <input value={custForm.companyName} onChange={(e) => setCustForm({ ...custForm, companyName: e.target.value })} placeholder={t.companyName} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <input type="tel" value={custForm.phone} onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })} placeholder={t.phone} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <input type="tel" value={custForm.whatsapp} onChange={(e) => setCustForm({ ...custForm, whatsapp: e.target.value })} placeholder={t.whatsapp} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <input type="email" value={custForm.email} onChange={(e) => setCustForm({ ...custForm, email: e.target.value })} placeholder={t.email} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <input value={custForm.city} onChange={(e) => setCustForm({ ...custForm, city: e.target.value })} placeholder={isAr ? 'المدينة' : 'City'} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <input value={custForm.address} onChange={(e) => setCustForm({ ...custForm, address: e.target.value })} placeholder={t.address} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              <input value={custForm.taxNumber} onChange={(e) => setCustForm({ ...custForm, taxNumber: e.target.value })} placeholder={t.taxNumber} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              <input value={custForm.nationalId} onChange={(e) => setCustForm({ ...custForm, nationalId: e.target.value })} placeholder={isAr ? 'رقم الهوية / الإقامة' : 'National ID'} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              <select value={custForm.customerType} onChange={(e) => setCustForm({ ...custForm, customerType: e.target.value as CustomerType })} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                <option value="individual">{isAr ? 'فرد' : 'Individual'}</option>
                <option value="company">{isAr ? 'شركة' : 'Company'}</option>
                <option value="VIP">VIP</option>
                <option value="wholesale">{isAr ? 'جملة' : 'Wholesale'}</option>
                <option value="retail">{isAr ? 'قطاعي' : 'Retail'}</option>
              </select>
              <select value={custForm.status} onChange={(e) => setCustForm({ ...custForm, status: e.target.value as PartyStatus })} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                <option value="paused">{isAr ? 'متوقف' : 'Paused'}</option>
                <option value="blocked">{isAr ? 'محظور' : 'Blocked'}</option>
              </select>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.debt} ({cur})</label>
                <input type="number" min={0} value={custForm.debt} onChange={(e) => setCustForm({ ...custForm, debt: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.creditLimit} ({cur})</label>
                <input type="number" min={0} value={custForm.creditLimit} onChange={(e) => setCustForm({ ...custForm, creditLimit: e.target.value })} placeholder={t.unlimitedCredit} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
            </div>
            <input value={custForm.mapUrl} onChange={(e) => setCustForm({ ...custForm, mapUrl: e.target.value })} placeholder={isAr ? 'رابط الخريطة Google Maps' : 'Map URL'} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
            <textarea rows={2} value={custForm.callLogs} onChange={(e) => setCustForm({ ...custForm, callLogs: e.target.value })} placeholder={isAr ? 'سجل المكالمات والمتابعة' : 'Call & Follow-up Logs'} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
            <textarea rows={2} value={custForm.notes} onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })} placeholder={t.notes} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />

            <div className="flex gap-2 pt-2">
              <button onClick={() => setCustModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!custForm.name.trim()) return;
                  const parsedLimit = custForm.creditLimit.trim() === '' ? undefined : Math.max(0, parseFloat(custForm.creditLimit) || 0);
                  actions.saveCustomer(
                    {
                      code: custForm.code.trim() || undefined,
                      name: custForm.name.trim(),
                      companyName: custForm.companyName.trim() || undefined,
                      phone: custForm.phone.trim(),
                      whatsapp: custForm.whatsapp.trim() || undefined,
                      email: custForm.email.trim(),
                      address: custForm.address.trim() || undefined,
                      city: custForm.city.trim() || undefined,
                      country: custForm.country.trim() || undefined,
                      mapUrl: custForm.mapUrl.trim() || undefined,
                      customerType: custForm.customerType,
                      taxNumber: custForm.taxNumber.trim() || undefined,
                      nationalId: custForm.nationalId.trim() || undefined,
                      birthDate: custForm.birthDate || undefined,
                      debt: Math.max(0, parseFloat(custForm.debt) || 0),
                      ...(parsedLimit !== undefined ? { creditLimit: parsedLimit } : {}),
                      creditTermDays: parseInt(custForm.creditTermDays, 10) || 30,
                      preferredPaymentMethod: custForm.preferredPaymentMethod,
                      salesRep: custForm.salesRep,
                      branchId: custForm.branchId || undefined,
                      status: custForm.status,
                      notes: custForm.notes.trim() || undefined,
                      callLogs: custForm.callLogs.trim() || undefined,
                    },
                    custModal.editId,
                  );
                  setCustModal({ open: false });
                  actions.notify(isAr ? 'تم حفظ بيانات العميل' : 'Customer saved');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-sm font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Statement of Account Modal */}
      {stmtCustomer && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-2xl w-full p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b pb-3 dark:border-[#1F332B]">
              <div>
                <h3 className="text-base font-extrabold">{t.customerStatement}: {stmtCustomer.name}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {stmtCustomer.phone} · {t.debt}: {stmtCustomer.debt.toLocaleString()} {cur}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer">
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printPdf}</span>
                </button>
                <button onClick={() => setStmtCustomer(null)} className="p-1 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-[#0A120F]">
                  <tr>
                    <th className="p-2 text-start">{t.date}</th>
                    <th className="p-2 text-start">{t.reason}</th>
                    <th className="p-2 text-end">{t.debit}</th>
                    <th className="p-2 text-end">{t.credit}</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-[#1F332B]">
                  {state.invoices
                    .filter((i) => i.customerId === stmtCustomer.id || i.customerName === stmtCustomer.name)
                    .map((i) => (
                      <tr key={i.id}>
                        <td className="p-2 font-mono">{i.date.slice(0, 10)}</td>
                        <td className="p-2">{i.id} · {i.description || t.invoices}</td>
                        <td className="p-2 text-end font-mono font-bold">{i.total.toFixed(2)}</td>
                        <td className="p-2 text-end font-mono text-emerald-600">{(i.paidAmount ?? 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  {state.vouchers
                    .filter((v) => v.type === 'receipt' && v.partyName === stmtCustomer.name)
                    .map((v) => (
                      <tr key={v.id}>
                        <td className="p-2 font-mono">{v.date.slice(0, 10)}</td>
                        <td className="p-2">{v.id} · {v.reason}</td>
                        <td className="p-2 text-end font-mono">0.00</td>
                        <td className="p-2 text-end font-mono font-bold text-emerald-600">{v.amount.toFixed(2)}</td>
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
        defaultEntity="customers"
        allowEntitySwitch={false}
        store={store}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
};
