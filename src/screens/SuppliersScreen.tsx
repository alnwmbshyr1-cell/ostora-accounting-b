import React, { useMemo, useState } from 'react';
import { Download, Edit2, FileText, MapPin, Paperclip, Plus, Printer, Search, ShoppingBag, Star, Trash2, Upload, X } from 'lucide-react';
import { DataImportModal } from '../components/DataImportModal';
import { strings } from '../data/translations';
import { CurrencyCode, PartyStatus, PaymentMethodType, Supplier, SupplierType } from '../types/erp';
import { formatCurrency } from '../utils/currencies';
import { downloadTextFile } from '../utils/export';
import { compressImageToBase64 } from '../utils/image';
import { ScreenProps } from './types';

export const SuppliersScreen: React.FC<ScreenProps> = ({ store, onNavigate }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];
  const canDelete = state.currentRole !== 'accountant';

  const [supSearch, setSupSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | SupplierType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PartyStatus>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [supModal, setSupModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [formSection, setFormSection] = useState<'basic' | 'bank' | 'supply'>('basic');
  const [formError, setFormError] = useState('');
  const [stmtSupplier, setStmtSupplier] = useState<Supplier | null>(null);
  const [supForm, setSupForm] = useState({
    code: '',
    name: '',
    companyName: '',
    contactPerson: '',
    phone: '',
    whatsapp: '',
    email: '',
    category: '',
    address: '',
    city: '',
    country: '',
    mapUrl: '',
    supplierType: 'local' as SupplierType,
    taxNumber: '',
    crNumber: '',
    bankAccount: '',
    bankName: '',
    iban: '',
    openingBalance: '0',
    payable: '0',
    creditLimit: '',
    paymentTermDays: '30',
    preferredPaymentMethod: 'transfer' as PaymentMethodType,
    currency: state.settings.currency as CurrencyCode,
    supplyTerms: '',
    supplierDiscountPercent: '0',
    leadTimeDays: '3',
    suppliedItems: '',
    lastPurchasePrice: '',
    qualityRating: 5,
    speedRating: 5,
    attachmentBase64: '',
    branchId: state.branches[0]?.id ?? '',
    repName: '',
    status: 'active' as PartyStatus,
    notes: '',
    contractsNotes: '',
  });
  const [importOpen, setImportOpen] = useState(false);

  const nextCodePreview = useMemo(() => {
    const nums = state.suppliers.map((s) => {
      const m = (s.code || s.id).match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 200;
    });
    return `SUP-${Math.max(200, ...nums) + 1}`;
  }, [state.suppliers]);

  const q = supSearch.trim().toLowerCase();
  const visibleSuppliers = state.suppliers.filter((s) => {
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.code ?? '').toLowerCase().includes(q) ||
      (s.companyName ?? '').toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q);
    const matchesType = typeFilter === 'all' || s.supplierType === typeFilter;
    const matchesStatus = statusFilter === 'all' || (s.status ?? 'active') === statusFilter;
    const matchesBranch = branchFilter === 'all' || !s.branchId || s.branchId === branchFilter;
    return matchesSearch && matchesType && matchesStatus && matchesBranch;
  });

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const b64 = await compressImageToBase64(file);
      setSupForm((prev) => ({ ...prev, attachmentBase64: b64 }));
      return;
    }
    if (file.size > 180 * 1024) {
      actions.notify(isAr ? 'الحد الأقصى لحجم ملف PDF هو 180KB' : 'Max PDF attachment size is 180KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSupForm((prev) => ({ ...prev, attachmentBase64: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const enabledCurrencies = state.settings.enabledCurrencies ?? [state.settings.currency];

  const supKpis = useMemo(() => {
    const totalPayable = visibleSuppliers.reduce((s, x) => s + (x.payable || 0), 0);
    const activeCount = visibleSuppliers.filter((x) => (x.status ?? 'active') === 'active').length;
    const rated = visibleSuppliers.filter((x) => typeof x.qualityRating === 'number');
    const avgRating = rated.length
      ? (rated.reduce((s, x) => s + (x.qualityRating ?? 5), 0) / rated.length).toFixed(1)
      : '5.0';
    return { count: visibleSuppliers.length, totalPayable, activeCount, avgRating };
  }, [visibleSuppliers]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <p className="text-[11px] font-bold text-slate-500">{isAr ? 'إجمالي الموردين' : 'Total Suppliers'}</p>
          <p className="text-lg font-extrabold font-mono tabular-nums mt-1">{supKpis.count}</p>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <p className="text-[11px] font-bold text-slate-500">{isAr ? 'مستحقات الموردين' : 'Accounts Payable'}</p>
          <p className="text-lg font-extrabold font-mono tabular-nums text-red-600 mt-1">
            {formatCurrency(supKpis.totalPayable, cur, { isAr })}
          </p>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <p className="text-[11px] font-bold text-slate-500">{isAr ? 'الموردون النشطون' : 'Active Suppliers'}</p>
          <p className="text-lg font-extrabold font-mono tabular-nums text-emerald-600 mt-1">{supKpis.activeCount}</p>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <p className="text-[11px] font-bold text-slate-500">{isAr ? 'متوسط تقييم الجودة' : 'Avg Quality Rating'}</p>
          <p className="text-lg font-extrabold font-mono tabular-nums text-[#C9A227] mt-1">{supKpis.avgRating} / 5</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
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
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | SupplierType)}
          className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الأنواع' : 'All Types'}</option>
          <option value="local">{isAr ? 'محلي' : 'Local'}</option>
          <option value="importer">{isAr ? 'مستورد' : 'Importer'}</option>
          <option value="manufacturer">{isAr ? 'مصنع' : 'Manufacturer'}</option>
          <option value="distributor">{isAr ? 'موزع' : 'Distributor'}</option>
          <option value="services">{isAr ? 'خدمات' : 'Services'}</option>
          <option value="primary">{isAr ? 'رئيسي' : 'Primary'}</option>
          <option value="secondary">{isAr ? 'فرعي' : 'Secondary'}</option>
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
        </select>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الفروع' : 'All Branches'}</option>
          {state.branches.map((b) => (
            <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            const csv = ['ID,Code,Name,Company,Phone,Email,Category,TaxNumber,IBAN,Payable,Rating,Status']
              .concat(
                visibleSuppliers.map(
                  (s) =>
                    `${s.id},"${s.code ?? ''}","${s.name}","${s.companyName ?? ''}",${s.phone},${s.email ?? ''},"${s.category}","${s.taxNumber ?? ''}","${s.iban ?? ''}",${s.payable},${s.qualityRating ?? 5},${s.status ?? 'active'}`,
                ),
              )
              .join('\n');
            downloadTextFile('ostora_suppliers.csv', csv);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{t.exportCsv}</span>
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#0A3D2C] dark:border-[#C9A227] bg-white dark:bg-[#121E19] text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>{t.importDataBtn}</span>
        </button>
        <button
          onClick={() => {
            setFormError('');
            setFormSection('basic');
            setSupForm({
              code: nextCodePreview,
              name: '',
              companyName: '',
              contactPerson: '',
              phone: '',
              whatsapp: '',
              email: '',
              category: '',
              address: '',
              city: '',
              country: isAr ? 'السعودية' : 'Saudi Arabia',
              mapUrl: '',
              supplierType: 'local',
              taxNumber: '',
              crNumber: '',
              bankAccount: '',
              bankName: '',
              iban: '',
              openingBalance: '0',
              payable: '0',
              creditLimit: '',
              paymentTermDays: '30',
              preferredPaymentMethod: 'transfer',
              currency: state.settings.currency,
              supplyTerms: '',
              supplierDiscountPercent: '0',
              leadTimeDays: '3',
              suppliedItems: '',
              lastPurchasePrice: '',
              qualityRating: 5,
              speedRating: 5,
              attachmentBase64: '',
              branchId: state.branches[0]?.id ?? '',
              repName: '',
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="font-extrabold text-base">{s.name}</h4>
                      {s.supplierType && (
                        <span className="px-1.5 py-0.5 rounded bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227] text-[10px] font-bold uppercase">
                          {s.supplierType}
                        </span>
                      )}
                      {s.qualityRating && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#C9A227]/15 text-amber-700 dark:text-[#C9A227] text-[10px] font-bold">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          <span>{s.qualityRating}/5</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {s.code || s.id} · {s.category} · {s.phone}
                      {s.leadTimeDays !== undefined ? ` · ${s.leadTimeDays}d` : ''}
                    </p>
                    {(s.bankName || s.iban) && (
                      <p className="text-[11px] font-mono text-slate-400">
                        {s.bankName} · {s.iban || s.bankAccount}
                      </p>
                    )}
                  </div>
                  <span className="font-mono font-extrabold text-sm text-red-600 tabular-nums shrink-0">
                    {formatCurrency(s.payable, s.currency ?? cur, { isAr })}
                  </span>
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
                  {s.mapUrl && (
                    <a href={s.mapUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-slate-100">
                      <MapPin className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
                    </a>
                  )}
                  <div className="ms-auto flex gap-1">
                    <button
                      onClick={() => {
                        setFormError('');
                        setFormSection('basic');
                        setSupForm({
                          code: s.code ?? s.id,
                          name: s.name,
                          companyName: s.companyName ?? '',
                          contactPerson: s.contactPerson ?? '',
                          phone: s.phone,
                          whatsapp: s.whatsapp ?? '',
                          email: s.email ?? '',
                          category: s.category,
                          address: s.address ?? '',
                          city: s.city ?? '',
                          country: s.country ?? '',
                          mapUrl: s.mapUrl ?? '',
                          supplierType: s.supplierType ?? 'local',
                          taxNumber: s.taxNumber ?? '',
                          crNumber: s.crNumber ?? '',
                          bankAccount: s.bankAccount ?? '',
                          bankName: s.bankName ?? '',
                          iban: s.iban ?? '',
                          openingBalance: String(s.openingBalance ?? 0),
                          payable: String(s.payable),
                          creditLimit: s.creditLimit !== undefined ? String(s.creditLimit) : '',
                          paymentTermDays: String(s.paymentTermDays ?? 30),
                          preferredPaymentMethod: s.preferredPaymentMethod ?? 'transfer',
                          currency: s.currency ?? state.settings.currency,
                          supplyTerms: s.supplyTerms ?? '',
                          supplierDiscountPercent: String(s.supplierDiscountPercent ?? 0),
                          leadTimeDays: String(s.leadTimeDays ?? 3),
                          suppliedItems: s.suppliedItems ?? '',
                          lastPurchasePrice: s.lastPurchasePrice !== undefined ? String(s.lastPurchasePrice) : '',
                          qualityRating: s.qualityRating ?? 5,
                          speedRating: s.speedRating ?? 5,
                          attachmentBase64: s.attachmentBase64 ?? '',
                          branchId: s.branchId ?? state.branches[0]?.id ?? '',
                          repName: s.repName ?? '',
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
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-3xl w-full p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-extrabold">{supModal.editId ? t.edit : t.addSupplier}</h3>
              <div className="flex gap-1 bg-slate-100 dark:bg-[#0A120F] p-1 rounded-xl">
                {(
                  [
                    ['basic', isAr ? 'البيانات والتواصل' : 'Basic & Contact'],
                    ['bank', isAr ? 'الضرائب والبنك' : 'Tax & Banking'],
                    ['supply', isAr ? 'التوريد والتقييم' : 'Supply & Rating'],
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
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'كود المورد' : 'Supplier Code'}</label>
                  <input value={supForm.code} onChange={(e) => setSupForm({ ...supForm, code: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.fullName} *</label>
                  <input value={supForm.name} maxLength={160} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-bold" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.companyName}</label>
                  <input value={supForm.companyName} onChange={(e) => setSupForm({ ...supForm, companyName: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'مسؤول التواصل' : 'Contact Person'}</label>
                  <input value={supForm.contactPerson} onChange={(e) => setSupForm({ ...supForm, contactPerson: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.phone} *</label>
                  <input type="tel" value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.whatsapp}</label>
                  <input type="tel" value={supForm.whatsapp} onChange={(e) => setSupForm({ ...supForm, whatsapp: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.email}</label>
                  <input type="email" value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.category}</label>
                  <input value={supForm.category} onChange={(e) => setSupForm({ ...supForm, category: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'تصنيف المورد' : 'Supplier Type'}</label>
                  <select value={supForm.supplierType} onChange={(e) => setSupForm({ ...supForm, supplierType: e.target.value as SupplierType })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    <option value="local">{isAr ? 'محلي' : 'Local'}</option>
                    <option value="importer">{isAr ? 'مستورد' : 'Importer'}</option>
                    <option value="manufacturer">{isAr ? 'مصنع' : 'Manufacturer'}</option>
                    <option value="distributor">{isAr ? 'موزع' : 'Distributor'}</option>
                    <option value="services">{isAr ? 'خدمات' : 'Services'}</option>
                    <option value="primary">{isAr ? 'مورد رئيسي' : 'Primary'}</option>
                    <option value="secondary">{isAr ? 'مورد فرعي' : 'Secondary'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.status}</label>
                  <select value={supForm.status} onChange={(e) => setSupForm({ ...supForm, status: e.target.value as PartyStatus })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                    <option value="paused">{isAr ? 'متوقف' : 'Paused'}</option>
                    <option value="blocked">{isAr ? 'محظور' : 'Blocked'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'المدينة' : 'City'}</label>
                  <input value={supForm.city} onChange={(e) => setSupForm({ ...supForm, city: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.address}</label>
                  <input value={supForm.address} onChange={(e) => setSupForm({ ...supForm, address: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'رابط الخريطة' : 'Google Maps URL'}</label>
                  <input value={supForm.mapUrl} onChange={(e) => setSupForm({ ...supForm, mapUrl: e.target.value })} placeholder="https://maps.google.com/..." className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
              </div>
            )}

            {formSection === 'bank' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.taxNumber}</label>
                  <input value={supForm.taxNumber} onChange={(e) => setSupForm({ ...supForm, taxNumber: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.crNumber}</label>
                  <input value={supForm.crNumber} onChange={(e) => setSupForm({ ...supForm, crNumber: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'اسم البنك' : 'Bank Name'}</label>
                  <input value={supForm.bankName} onChange={(e) => setSupForm({ ...supForm, bankName: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.accountNumberLabel}</label>
                  <input value={supForm.bankAccount} onChange={(e) => setSupForm({ ...supForm, bankAccount: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">IBAN</label>
                  <input value={supForm.iban} onChange={(e) => setSupForm({ ...supForm, iban: e.target.value })} placeholder="SA..." className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.currency}</label>
                  <select value={supForm.currency} onChange={(e) => setSupForm({ ...supForm, currency: e.target.value as CurrencyCode })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs">
                    {enabledCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'رصيد افتتاحي' : 'Opening Balance'}</label>
                  <input type="number" min={0} step="0.01" value={supForm.openingBalance} onChange={(e) => setSupForm({ ...supForm, openingBalance: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.supplierDebt}</label>
                  <input type="number" min={0} step="0.01" value={supForm.payable} onChange={(e) => setSupForm({ ...supForm, payable: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.creditLimit}</label>
                  <input type="number" min={0} step="0.01" value={supForm.creditLimit} onChange={(e) => setSupForm({ ...supForm, creditLimit: e.target.value })} placeholder={t.unlimitedCredit} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'مدة السداد (أيام)' : 'Payment Terms'}</label>
                  <select value={supForm.paymentTermDays} onChange={(e) => setSupForm({ ...supForm, paymentTermDays: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono">
                    {[0, 7, 15, 30, 60, 90].map((d) => <option key={d} value={String(d)}>{d} {t.days}</option>)}
                  </select>
                </div>
              </div>
            )}

            {formSection === 'supply' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">{isAr ? 'نسبة خصم المورد %' : 'Supplier Discount %'}</label>
                    <input type="number" min={0} max={100} value={supForm.supplierDiscountPercent} onChange={(e) => setSupForm({ ...supForm, supplierDiscountPercent: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">{isAr ? 'مدة التوريد (أيام)' : 'Lead Time (Days)'}</label>
                    <input type="number" min={0} value={supForm.leadTimeDays} onChange={(e) => setSupForm({ ...supForm, leadTimeDays: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">{isAr ? 'آخر سعر شراء' : 'Last Purchase Price'}</label>
                    <input type="number" min={0} step="0.01" value={supForm.lastPurchasePrice} onChange={(e) => setSupForm({ ...supForm, lastPurchasePrice: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs font-mono" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'الأصناف المورّدة' : 'Supplied Items'}</label>
                  <input value={supForm.suppliedItems} onChange={(e) => setSupForm({ ...supForm, suppliedItems: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'شروط التوريد والتسليم' : 'Supply & Delivery Terms'}</label>
                  <input value={supForm.supplyTerms} onChange={(e) => setSupForm({ ...supForm, supplyTerms: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">{isAr ? 'تقييم الجودة' : 'Quality Rating'}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSupForm({ ...supForm, qualityRating: n })}
                          className="cursor-pointer"
                        >
                          <Star className={`w-5 h-5 ${n <= supForm.qualityRating ? 'text-[#C9A227] fill-current' : 'text-slate-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">{isAr ? 'تقييم سرعة التوريد' : 'Delivery Speed Rating'}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSupForm({ ...supForm, speedRating: n })}
                          className="cursor-pointer"
                        >
                          <Star className={`w-5 h-5 ${n <= supForm.speedRating ? 'text-[#C9A227] fill-current' : 'text-slate-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#121E19] border text-xs font-bold cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                    <span>{isAr ? 'إرفاق عقد / سجل تجاري' : 'Attach Contract / CR'}</span>
                    <input type="file" accept="image/*,application/pdf" onChange={handleAttachmentUpload} className="hidden" />
                  </label>
                  {supForm.attachmentBase64 && (
                    <span className="text-xs text-emerald-600 font-bold">✓ {isAr ? 'مرفق محفوظ' : 'Attached'}</span>
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{isAr ? 'ملاحظات العقود وأسعار الشراء الخاصة' : 'Contracts & Special Pricing Notes'}</label>
                  <textarea rows={2} value={supForm.contractsNotes} onChange={(e) => setSupForm({ ...supForm, contractsNotes: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t.notes}</label>
                  <textarea rows={2} value={supForm.notes} onChange={(e) => setSupForm({ ...supForm, notes: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border text-xs" />
                </div>
              </div>
            )}

            {formError && <p className="text-xs font-bold text-red-600">{formError}</p>}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setSupModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!supForm.name.trim()) {
                    setFormSection('basic');
                    setFormError(isAr ? 'اسم المورد إلزامي *' : 'Supplier name is required *');
                    return;
                  }
                  if (!supForm.phone.trim()) {
                    setFormSection('basic');
                    setFormError(isAr ? 'رقم الجوال إلزامي *' : 'Mobile number is required *');
                    return;
                  }
                  const parsedLimit = supForm.creditLimit.trim() === '' ? undefined : Math.max(0, parseFloat(supForm.creditLimit) || 0);
                  const parsedLastPrice = supForm.lastPurchasePrice.trim() === '' ? undefined : Math.max(0, parseFloat(supForm.lastPurchasePrice) || 0);
                  actions.saveSupplier(
                    {
                      code: supForm.code.trim() || undefined,
                      name: supForm.name.trim(),
                      companyName: supForm.companyName.trim() || undefined,
                      contactPerson: supForm.contactPerson.trim() || undefined,
                      phone: supForm.phone.trim(),
                      whatsapp: supForm.whatsapp.trim() || undefined,
                      email: supForm.email.trim() || undefined,
                      category: supForm.category.trim(),
                      address: supForm.address.trim() || undefined,
                      city: supForm.city.trim() || undefined,
                      country: supForm.country.trim() || undefined,
                      mapUrl: supForm.mapUrl.trim() || undefined,
                      supplierType: supForm.supplierType,
                      taxNumber: supForm.taxNumber.trim() || undefined,
                      crNumber: supForm.crNumber.trim() || undefined,
                      bankAccount: supForm.bankAccount.trim() || undefined,
                      bankName: supForm.bankName.trim() || undefined,
                      iban: supForm.iban.trim() || undefined,
                      openingBalance: Math.max(0, parseFloat(supForm.openingBalance) || 0),
                      payable: Math.max(0, parseFloat(supForm.payable) || 0),
                      ...(parsedLimit !== undefined ? { creditLimit: parsedLimit } : {}),
                      paymentTermDays: parseInt(supForm.paymentTermDays, 10) || 30,
                      preferredPaymentMethod: supForm.preferredPaymentMethod,
                      currency: supForm.currency,
                      supplyTerms: supForm.supplyTerms.trim() || undefined,
                      supplierDiscountPercent: Math.max(0, Math.min(100, parseFloat(supForm.supplierDiscountPercent) || 0)),
                      leadTimeDays: Math.max(0, parseInt(supForm.leadTimeDays, 10) || 0),
                      suppliedItems: supForm.suppliedItems.trim() || undefined,
                      ...(parsedLastPrice !== undefined ? { lastPurchasePrice: parsedLastPrice } : {}),
                      qualityRating: supForm.qualityRating,
                      speedRating: supForm.speedRating,
                      attachmentBase64: supForm.attachmentBase64 || undefined,
                      branchId: supForm.branchId || undefined,
                      repName: supForm.repName.trim() || undefined,
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
                  {stmtSupplier.code ?? stmtSupplier.id} · {stmtSupplier.phone} · {t.supplierDebt}: {formatCurrency(stmtSupplier.payable, stmtSupplier.currency ?? cur, { isAr })}
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
                        <td className="p-2 text-end font-mono">{formatCurrency(p.unitCost, cur, { isAr })}</td>
                        <td className="p-2 text-end font-mono font-bold">{formatCurrency(p.total, cur, { isAr })}</td>
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
