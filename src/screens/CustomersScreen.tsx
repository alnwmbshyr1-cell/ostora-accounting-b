import React, { useMemo, useState } from 'react';
import { Bell, Download, Edit2, FileText, ImagePlus, MapPin, MessageCircle, Paperclip, Plus, Printer, Receipt, Search, Trash2, Upload, X } from 'lucide-react';
import { DataImportModal } from '../components/DataImportModal';
import { useFirebase } from '../contexts/FirebaseContext';
import { strings } from '../data/translations';
import { CurrencyCode, Customer, CustomerType, PartyStatus, PaymentMethodType } from '../types/erp';
import { downloadTextFile } from '../utils/export';
import { compressImageToBase64 } from '../utils/image';
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
  const [typeFilter, setTypeFilter] = useState<'all' | CustomerType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PartyStatus>('all');
  const [custModal, setCustModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [formSection, setFormSection] = useState<'basic' | 'contact' | 'financial' | 'crm'>('basic');
  const [formError, setFormError] = useState('');
  const [stmtCustomer, setStmtCustomer] = useState<Customer | null>(null);
  const [custForm, setCustForm] = useState({
    code: '',
    name: '',
    companyName: '',
    photoBase64: '',
    phone: '',
    whatsapp: '',
    landline: '',
    email: '',
    website: '',
    address: '',
    district: '',
    city: '',
    country: '',
    mapUrl: '',
    gpsCoords: '',
    customerType: 'company' as CustomerType,
    taxNumber: '',
    taxStatus: 'taxable' as 'taxable' | 'exempt',
    nationalId: '',
    crNumber: '',
    birthDate: '',
    openingBalanceDebit: '0',
    openingBalanceCredit: '0',
    debt: '0',
    creditLimit: '',
    creditTermDays: '30',
    preferredPaymentMethod: 'transfer' as PaymentMethodType,
    priceList: 'standard',
    specialDiscountPercent: '0',
    currency: state.settings.currency as CurrencyCode,
    iban: '',
    salesRep: state.currentRole as string,
    branchId: state.branches[0]?.id ?? '',
    leadSource: '',
    firstDealDate: new Date().toISOString().slice(0, 10),
    rating: 'A' as 'A' | 'B' | 'C',
    reminderDate: '',
    attachmentBase64: '',
    status: 'active' as PartyStatus,
    notes: '',
    callLogs: '',
  });
  const [importOpen, setImportOpen] = useState(false);

  const nextCodePreview = useMemo(() => {
    const nums = state.customers.map((c) => {
      const m = (c.code || c.id).match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 100;
    });
    return `CUST-${Math.max(100, ...nums) + 1}`;
  }, [state.customers]);

  const q = custSearch.trim().toLowerCase();
  const visibleCustomers = state.customers.filter((c) => {
    if (isSalesman && c.salesRep && c.salesRep !== 'salesman' && c.salesRep !== user?.email) {
      return false;
    }
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.code ?? '').toLowerCase().includes(q) ||
      (c.companyName ?? '').toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.city ?? '').toLowerCase().includes(q);
    const matchesType = typeFilter === 'all' || c.customerType === typeFilter;
    const matchesStatus = statusFilter === 'all' || (c.status ?? 'active') === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const openAddModal = () => {
    setFormError('');
    setFormSection('basic');
    setCustForm({
      code: nextCodePreview,
      name: '',
      companyName: '',
      photoBase64: '',
      phone: '',
      whatsapp: '',
      landline: '',
      email: '',
      website: '',
      address: '',
      district: '',
      city: '',
      country: isAr ? 'السعودية' : 'Saudi Arabia',
      mapUrl: '',
      gpsCoords: '',
      customerType: 'company',
      taxNumber: '',
      taxStatus: 'taxable',
      nationalId: '',
      crNumber: '',
      birthDate: '',
      openingBalanceDebit: '0',
      openingBalanceCredit: '0',
      debt: '0',
      creditLimit: '',
      creditTermDays: '30',
      preferredPaymentMethod: 'transfer',
      priceList: 'standard',
      specialDiscountPercent: '0',
      currency: state.settings.currency,
      iban: '',
      salesRep: state.currentRole,
      branchId: state.branches[0]?.id ?? '',
      leadSource: '',
      firstDealDate: new Date().toISOString().slice(0, 10),
      rating: 'A',
      reminderDate: '',
      attachmentBase64: '',
      status: 'active',
      notes: '',
      callLogs: '',
    });
    setCustModal({ open: true });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await compressImageToBase64(file);
    setCustForm((prev) => ({ ...prev, photoBase64: b64 }));
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const b64 = await compressImageToBase64(file);
      setCustForm((prev) => ({ ...prev, attachmentBase64: b64 }));
      return;
    }
    if (file.size > 180 * 1024) {
      actions.notify(isAr ? 'الحد الأقصى لحجم ملف PDF هو 180KB' : 'Max PDF attachment size is 180KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCustForm((prev) => ({ ...prev, attachmentBase64: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const enabledCurrencies = state.settings.enabledCurrencies ?? [state.settings.currency];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2.5">
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
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | CustomerType)}
          className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الأنواع' : 'All Types'}</option>
          <option value="individual">{isAr ? 'فرد' : 'Individual'}</option>
          <option value="company">{isAr ? 'شركة' : 'Company'}</option>
          <option value="VIP">VIP</option>
          <option value="wholesale">{isAr ? 'جملة' : 'Wholesale'}</option>
          <option value="retail">{isAr ? 'قطاعي' : 'Retail'}</option>
          <option value="distributor">{isAr ? 'موزع' : 'Distributor'}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | PartyStatus)}
          className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الحالات' : 'All Statuses'}</option>
          <option value="active">{isAr ? 'نشط' : 'Active'}</option>
          <option value="paused">{isAr ? 'متوقف' : 'Paused'}</option>
          <option value="blocked">{isAr ? 'محظور' : 'Blocked'}</option>
          <option value="potential">{isAr ? 'محتمل' : 'Potential'}</option>
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const csv = ['ID,Code,Name,Company,Phone,Email,City,TaxNumber,Debt,CreditLimit,Rating,Status']
                .concat(
                  state.customers.map(
                    (c) => `${c.id},"${c.code ?? ''}","${c.name}","${c.companyName ?? ''}",${c.phone},${c.email},"${c.city ?? ''}","${c.taxNumber ?? ''}",${c.debt},${c.creditLimit ?? ''},${c.rating ?? 'A'},${c.status ?? 'active'}`,
                  ),
                )
                .join('\n');
              downloadTextFile('ostora_customers.csv', csv);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{t.exportCsv}</span>
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#0A3D2C] dark:border-[#C9A227] bg-white dark:bg-[#121E19] text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{t.importDataBtn}</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addCustomer}</span>
          </button>
        </div>
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
                  {c.photoBase64 ? (
                    <img src={c.photoBase64} alt={c.name} className="w-11 h-11 rounded-full object-cover border shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#0A3D2C] text-white font-extrabold flex items-center justify-center shrink-0">
                      {c.name.slice(0, 1)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="font-extrabold text-sm truncate">{c.name}</h4>
                      {c.customerType && (
                        <span className="px-1.5 py-0.5 rounded bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227] text-[10px] font-bold uppercase">
                          {c.customerType}
                        </span>
                      )}
                      {c.rating && (
                        <span className="px-1.5 py-0.5 rounded bg-[#C9A227]/20 text-amber-800 dark:text-[#C9A227] text-[10px] font-extrabold">
                          {c.rating}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono truncate">
                      {c.code || c.id} · {c.phone} {c.city ? `· ${c.city}` : ''}
                    </p>
                    {c.reminderDate && (
                      <p className="text-[11px] text-amber-600 font-bold inline-flex items-center gap-1 mt-0.5">
                        <Bell className="w-3 h-3" />
                        <span>{isAr ? 'متابعة:' : 'Follow-up:'} {c.reminderDate}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-end">
                    <span className={`font-mono font-extrabold text-sm tabular-nums block ${c.debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {c.debt.toLocaleString()} {c.currency ?? cur}
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
                    <span className={`font-bold ${c.status === 'blocked' ? 'text-red-600' : c.status === 'paused' ? 'text-amber-600' : 'text-emerald-600'}`}>
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
                          partyType: 'customer',
                          bankId: defaultBankId,
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
                        setFormError('');
                        setFormSection('basic');
                        setCustForm({
                          code: c.code ?? c.id,
                          name: c.name,
                          companyName: c.companyName ?? '',
                          photoBase64: c.photoBase64 ?? '',
                          phone: c.phone,
                          whatsapp: c.whatsapp ?? '',
                          landline: c.landline ?? '',
                          email: c.email,
                          website: c.website ?? '',
                          address: c.address ?? '',
                          district: c.district ?? '',
                          city: c.city ?? '',
                          country: c.country ?? '',
                          mapUrl: c.mapUrl ?? '',
                          gpsCoords: c.gpsCoords ?? '',
                          customerType: c.customerType ?? 'company',
                          taxNumber: c.taxNumber ?? '',
                          taxStatus: c.taxStatus ?? 'taxable',
                          nationalId: c.nationalId ?? '',
                          crNumber: c.crNumber ?? '',
                          birthDate: c.birthDate ?? '',
                          openingBalanceDebit: String(c.openingBalanceDebit ?? 0),
                          openingBalanceCredit: String(c.openingBalanceCredit ?? 0),
                          debt: String(c.debt),
                          creditLimit: typeof c.creditLimit === 'number' ? String(c.creditLimit) : '',
                          creditTermDays: String(c.creditTermDays ?? 30),
                          preferredPaymentMethod: c.preferredPaymentMethod ?? 'transfer',
                          priceList: c.priceList ?? 'standard',
                          specialDiscountPercent: String(c.specialDiscountPercent ?? 0),
                          currency: c.currency ?? state.settings.currency,
                          iban: c.iban ?? '',
                          salesRep: c.salesRep ?? state.currentRole,
                          branchId: c.branchId ?? state.branches[0]?.id ?? '',
                          leadSource: c.leadSource ?? '',
                          firstDealDate: c.firstDealDate ?? '',
                          rating: c.rating ?? 'A',
                          reminderDate: c.reminderDate ?? '',
                          attachmentBase64: c.attachmentBase64 ?? '',
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
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-3xl w-full p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-extrabold">{custModal.editId ? t.edit : t.addCustomer}</h3>
              <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-[#0A120F] p-1 rounded-xl">
                {(
                  [
                    ['basic', isAr ? 'البيانات الأساسية' : 'Basic & Tax'],
                    ['contact', isAr ? 'العنوان والتواصل' : 'Contact & Map'],
                    ['financial', isAr ? 'الائتمان والبنك' : 'Credit & Bank'],
                    ['crm', isAr ? 'المتابعة والمرفقات' : 'CRM & Files'],
                  ] as const
                ).map(([sec, label]) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setFormSection(sec)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      formSection === sec ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {formSection === 'basic' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'كود العميل' : 'Customer Code'}</label>
                  <input value={custForm.code} onChange={(e) => setCustForm({ ...custForm, code: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.fullName} *</label>
                  <input maxLength={160} value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.companyName}</label>
                  <input value={custForm.companyName} onChange={(e) => setCustForm({ ...custForm, companyName: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.phone} *</label>
                  <input type="tel" value={custForm.phone} onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'تصنيف العميل' : 'Customer Type'}</label>
                  <select value={custForm.customerType} onChange={(e) => setCustForm({ ...custForm, customerType: e.target.value as CustomerType })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    <option value="individual">{isAr ? 'فرد' : 'Individual'}</option>
                    <option value="company">{isAr ? 'شركة' : 'Company'}</option>
                    <option value="VIP">VIP</option>
                    <option value="wholesale">{isAr ? 'جملة' : 'Wholesale'}</option>
                    <option value="retail">{isAr ? 'قطاعي' : 'Retail'}</option>
                    <option value="distributor">{isAr ? 'موزع' : 'Distributor'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.status}</label>
                  <select value={custForm.status} onChange={(e) => setCustForm({ ...custForm, status: e.target.value as PartyStatus })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                    <option value="paused">{isAr ? 'متوقف' : 'Paused'}</option>
                    <option value="blocked">{isAr ? 'محظور' : 'Blocked'}</option>
                    <option value="potential">{isAr ? 'محتمل' : 'Potential'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.taxNumber}</label>
                  <input value={custForm.taxNumber} onChange={(e) => setCustForm({ ...custForm, taxNumber: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.crNumber}</label>
                  <input value={custForm.crNumber} onChange={(e) => setCustForm({ ...custForm, crNumber: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'رقم الهوية / الإقامة' : 'National ID'}</label>
                  <input value={custForm.nationalId} onChange={(e) => setCustForm({ ...custForm, nationalId: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'الحالة الضريبية' : 'Tax Status'}</label>
                  <select value={custForm.taxStatus} onChange={(e) => setCustForm({ ...custForm, taxStatus: e.target.value as 'taxable' | 'exempt' })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    <option value="taxable">{isAr ? 'خاضع للضريبة' : 'Taxable'}</option>
                    <option value="exempt">{isAr ? 'معفى من الضريبة' : 'Tax Exempt'}</option>
                  </select>
                </div>
                <div className="sm:col-span-2 flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer">
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>{isAr ? 'صورة العميل / الشعار' : 'Customer Photo'}</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                  {custForm.photoBase64 && (
                    <div className="flex items-center gap-2">
                      <img src={custForm.photoBase64} alt="Customer" className="w-9 h-9 rounded-full object-cover border" />
                      <button type="button" onClick={() => setCustForm({ ...custForm, photoBase64: '' })} className="text-red-600 text-xs font-bold cursor-pointer">{t.delete}</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {formSection === 'contact' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input type="tel" value={custForm.whatsapp} onChange={(e) => setCustForm({ ...custForm, whatsapp: e.target.value })} placeholder={t.whatsapp} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                <input type="tel" value={custForm.landline} onChange={(e) => setCustForm({ ...custForm, landline: e.target.value })} placeholder={isAr ? 'الهاتف الثابت' : 'Landline'} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                <input type="email" value={custForm.email} onChange={(e) => setCustForm({ ...custForm, email: e.target.value })} placeholder={t.email} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                <input value={custForm.website} onChange={(e) => setCustForm({ ...custForm, website: e.target.value })} placeholder={isAr ? 'الموقع الإلكتروني' : 'Website'} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                <input value={custForm.country} onChange={(e) => setCustForm({ ...custForm, country: e.target.value })} placeholder={isAr ? 'الدولة' : 'Country'} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                <input value={custForm.city} onChange={(e) => setCustForm({ ...custForm, city: e.target.value })} placeholder={isAr ? 'المدينة' : 'City'} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                <input value={custForm.district} onChange={(e) => setCustForm({ ...custForm, district: e.target.value })} placeholder={isAr ? 'الحي' : 'District'} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                <input value={custForm.address} onChange={(e) => setCustForm({ ...custForm, address: e.target.value })} placeholder={t.address} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                <input value={custForm.mapUrl} onChange={(e) => setCustForm({ ...custForm, mapUrl: e.target.value })} placeholder={isAr ? 'رابط Google Maps' : 'Google Maps URL'} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                <input value={custForm.gpsCoords} onChange={(e) => setCustForm({ ...custForm, gpsCoords: e.target.value })} placeholder={isAr ? 'إحداثيات GPS (Lat, Lng)' : 'GPS Coords'} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
              </div>
            )}

            {formSection === 'financial' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{isAr ? 'رصيد افتتاحي مدين' : 'Opening Debit'} ({cur})</label>
                  <input type="number" min={0} step="0.01" value={custForm.openingBalanceDebit} onChange={(e) => setCustForm({ ...custForm, openingBalanceDebit: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{isAr ? 'رصيد افتتاحي دائن' : 'Opening Credit'} ({cur})</label>
                  <input type="number" min={0} step="0.01" value={custForm.openingBalanceCredit} onChange={(e) => setCustForm({ ...custForm, openingBalanceCredit: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.debt} ({cur})</label>
                  <input type="number" min={0} step="0.01" value={custForm.debt} onChange={(e) => setCustForm({ ...custForm, debt: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.creditLimit} ({cur})</label>
                  <input type="number" min={0} step="0.01" value={custForm.creditLimit} onChange={(e) => setCustForm({ ...custForm, creditLimit: e.target.value })} placeholder={t.unlimitedCredit} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{isAr ? 'مدة السداد (أيام)' : 'Payment Terms (Days)'}</label>
                  <select value={custForm.creditTermDays} onChange={(e) => setCustForm({ ...custForm, creditTermDays: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono">
                    {[0, 7, 15, 30, 60, 90].map((d) => (
                      <option key={d} value={String(d)}>{d === 0 ? (isAr ? 'فوري (0 يوم)' : 'Immediate (0)') : `${d} ${t.days}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.paymentMethodLabel}</label>
                  <select value={custForm.preferredPaymentMethod} onChange={(e) => setCustForm({ ...custForm, preferredPaymentMethod: e.target.value as PaymentMethodType })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    <option value="transfer">{t.payTransfer}</option>
                    <option value="cash">{t.payCash}</option>
                    <option value="pos_card">{t.payCard}</option>
                    <option value="apple_pay">{t.payApplePay}</option>
                    <option value="credit">{t.payCredit}</option>
                    <option value="cheque">{t.payCheque}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{isAr ? 'قائمة الأسعار' : 'Price List'}</label>
                  <select value={custForm.priceList} onChange={(e) => setCustForm({ ...custForm, priceList: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    <option value="standard">{isAr ? 'السعر الافتراضي (تجزئة)' : 'Standard Retail'}</option>
                    <option value="wholesale">{isAr ? 'أسعار الجملة' : 'Wholesale'}</option>
                    <option value="vip">{isAr ? 'أسعار كبار العملاء VIP' : 'VIP Pricing'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{isAr ? 'خصم خاص %' : 'Special Discount %'}</label>
                  <input type="number" min={0} max={100} value={custForm.specialDiscountPercent} onChange={(e) => setCustForm({ ...custForm, specialDiscountPercent: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">{t.currency}</label>
                  <select value={custForm.currency} onChange={(e) => setCustForm({ ...custForm, currency: e.target.value as CurrencyCode })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    {enabledCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">IBAN</label>
                  <input value={custForm.iban} onChange={(e) => setCustForm({ ...custForm, iban: e.target.value })} placeholder="SA..." className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
              </div>
            )}

            {formSection === 'crm' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">{isAr ? 'مندوب المبيعات المسؤول' : 'Sales Rep'}</label>
                    <input value={custForm.salesRep} onChange={(e) => setCustForm({ ...custForm, salesRep: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">{t.branch}</label>
                    <select value={custForm.branchId} onChange={(e) => setCustForm({ ...custForm, branchId: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                      {state.branches.map((b) => <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">{isAr ? 'مصدر العميل' : 'Lead Source'}</label>
                    <input value={custForm.leadSource} onChange={(e) => setCustForm({ ...custForm, leadSource: e.target.value })} placeholder={isAr ? 'مثال: إعلان / توصية / معرض' : 'e.g. Referral / Ad'} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">{isAr ? 'تقييم العميل' : 'Rating'}</label>
                    <select value={custForm.rating} onChange={(e) => setCustForm({ ...custForm, rating: e.target.value as 'A' | 'B' | 'C' })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold">
                      <option value="A">A - {isAr ? 'ممتاز' : 'Excellent'}</option>
                      <option value="B">B - {isAr ? 'جيد' : 'Good'}</option>
                      <option value="C">C - {isAr ? 'عادي / متابعة' : 'Standard'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">{isAr ? 'تاريخ أول تعامل' : 'First Deal Date'}</label>
                    <input type="date" value={custForm.firstDealDate} onChange={(e) => setCustForm({ ...custForm, firstDealDate: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">{isAr ? 'تاريخ تذكير المتابعة' : 'Reminder Date'}</label>
                    <input type="date" value={custForm.reminderDate} onChange={(e) => setCustForm({ ...custForm, reminderDate: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#121E19] border text-xs font-bold cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                    <span>{isAr ? 'إرفاق هوية / سجل (صورة أو PDF)' : 'Attach Document (Image/PDF)'}</span>
                    <input type="file" accept="image/*,application/pdf" onChange={handleAttachmentUpload} className="hidden" />
                  </label>
                  {custForm.attachmentBase64 && (
                    <span className="text-xs text-emerald-600 font-bold">✓ {isAr ? 'مرفق محفوظ' : 'Attached'}</span>
                  )}
                </div>
                <textarea rows={2} value={custForm.callLogs} onChange={(e) => setCustForm({ ...custForm, callLogs: e.target.value })} placeholder={isAr ? 'سجل المكالمات والمتابعة' : 'Call & Follow-up Logs'} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                <textarea rows={2} value={custForm.notes} onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })} placeholder={t.notes} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
              </div>
            )}

            {formError && <p className="text-xs font-bold text-red-600">{formError}</p>}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setCustModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!custForm.name.trim()) {
                    setFormSection('basic');
                    setFormError(isAr ? 'الاسم الكامل للعميل إلزامي *' : 'Customer full name is required *');
                    return;
                  }
                  if (!custForm.phone.trim()) {
                    setFormSection('basic');
                    setFormError(isAr ? 'رقم الجوال إلزامي *' : 'Mobile number is required *');
                    return;
                  }
                  const parsedLimit = custForm.creditLimit.trim() === '' ? undefined : Math.max(0, parseFloat(custForm.creditLimit) || 0);
                  actions.saveCustomer(
                    {
                      code: custForm.code.trim() || undefined,
                      name: custForm.name.trim(),
                      companyName: custForm.companyName.trim() || undefined,
                      photoBase64: custForm.photoBase64 || undefined,
                      phone: custForm.phone.trim(),
                      whatsapp: custForm.whatsapp.trim() || undefined,
                      landline: custForm.landline.trim() || undefined,
                      email: custForm.email.trim(),
                      website: custForm.website.trim() || undefined,
                      address: custForm.address.trim() || undefined,
                      district: custForm.district.trim() || undefined,
                      city: custForm.city.trim() || undefined,
                      country: custForm.country.trim() || undefined,
                      mapUrl: custForm.mapUrl.trim() || undefined,
                      gpsCoords: custForm.gpsCoords.trim() || undefined,
                      customerType: custForm.customerType,
                      taxNumber: custForm.taxNumber.trim() || undefined,
                      taxStatus: custForm.taxStatus,
                      nationalId: custForm.nationalId.trim() || undefined,
                      crNumber: custForm.crNumber.trim() || undefined,
                      birthDate: custForm.birthDate || undefined,
                      openingBalanceDebit: Math.max(0, parseFloat(custForm.openingBalanceDebit) || 0),
                      openingBalanceCredit: Math.max(0, parseFloat(custForm.openingBalanceCredit) || 0),
                      debt: Math.max(0, parseFloat(custForm.debt) || 0),
                      ...(parsedLimit !== undefined ? { creditLimit: parsedLimit } : {}),
                      creditTermDays: parseInt(custForm.creditTermDays, 10) || 30,
                      preferredPaymentMethod: custForm.preferredPaymentMethod,
                      priceList: custForm.priceList || undefined,
                      specialDiscountPercent: Math.max(0, Math.min(100, parseFloat(custForm.specialDiscountPercent) || 0)),
                      currency: custForm.currency,
                      iban: custForm.iban.trim() || undefined,
                      salesRep: custForm.salesRep,
                      branchId: custForm.branchId || undefined,
                      leadSource: custForm.leadSource.trim() || undefined,
                      firstDealDate: custForm.firstDealDate || undefined,
                      rating: custForm.rating,
                      reminderDate: custForm.reminderDate || undefined,
                      attachmentBase64: custForm.attachmentBase64 || undefined,
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
                  {stmtCustomer.code ?? stmtCustomer.id} · {stmtCustomer.phone} · {t.debt}: {stmtCustomer.debt.toLocaleString()} {cur}
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
