import React, { useMemo, useState } from 'react';
import {
  Camera,
  CreditCard,
  Download,
  Edit2,
  FileText,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { ALL_ROUTES, DEFAULT_PERMISSIONS_MATRIX } from '../constants/permissions';
import { strings } from '../data/translations';
import { fromHalalas, toHalalas } from '../domain/halala';
import { Employee, RoleId, RouteId } from '../types/erp';
import { formatCurrency } from '../utils/currencies';
import { downloadTextFile } from '../utils/export';
import { compressImageToBase64 } from '../utils/image';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

export const EmployeesScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState<'all' | RoleId>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on_leave' | 'terminated'>('all');

  const [empModal, setEmpModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [empSection, setEmpSection] = useState<'all' | 'personal' | 'job' | 'salary' | 'access'>('all');
  const [formError, setFormError] = useState('');
  const [empForm, setEmpForm] = useState<{
    code: string;
    name: string;
    roleTitle: string;
    department: string;
    role: RoleId;
    permissions: RouteId[];
    phone: string;
    whatsapp: string;
    email: string;
    nationalId: string;
    birthDate: string;
    branchId: string;
    hireDate: string;
    salary: string;
    allowances: string;
    deductions: string;
    bankAccount: string;
    workShift: string;
    username: string;
    photoBase64: string;
    attachmentBase64: string;
    idAttachmentBase64: string;
    status: 'active' | 'on_leave' | 'terminated';
    notes: string;
  }>({
    code: '',
    name: '',
    roleTitle: '',
    department: '',
    role: 'salesman',
    permissions: [...DEFAULT_PERMISSIONS_MATRIX.salesman],
    phone: '',
    whatsapp: '',
    email: '',
    nationalId: '',
    birthDate: '',
    branchId: state.branches[0]?.id ?? '',
    hireDate: new Date().toISOString().slice(0, 10),
    salary: '',
    allowances: '0',
    deductions: '0',
    bankAccount: '',
    workShift: isAr ? 'صباحي 8 ص - 4 م' : 'Morning 8AM - 4PM',
    username: '',
    photoBase64: '',
    attachmentBase64: '',
    idAttachmentBase64: '',
    status: 'active',
    notes: '',
  });

  const canDelete = state.currentRole !== 'accountant';

  const roleLabels: Record<RoleId, string> = {
    owner: t.roleOwner,
    accountant: t.roleAccountant,
    cashier: t.roleCashier,
    salesman: t.roleSalesman,
    warehouse: t.roleWarehouse,
  };

  const statusLabel = (st?: 'active' | 'on_leave' | 'terminated') => {
    if (st === 'on_leave') return isAr ? 'إجازة' : 'On Leave';
    if (st === 'terminated') return isAr ? 'منتهي الخدمة' : 'Terminated';
    return isAr ? 'على رأس العمل' : 'Active';
  };

  const computeNetSalary = (salary: number, allowances = 0, deductions = 0) =>
    fromHalalas(Math.max(0, toHalalas(salary) + toHalalas(allowances) - toHalalas(deductions)));

  const nextEmpCodePreview = useMemo(() => {
    const nums = state.employees
      .map((e) => {
        const m = (e.code || e.id).match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => Number.isFinite(n));
    return `EMP-${Math.max(100, ...nums) + 1}`;
  }, [state.employees]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of state.employees) {
      if (e.department?.trim()) set.add(e.department.trim());
    }
    return Array.from(set);
  }, [state.employees]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.employees.filter((e) => {
      if (deptFilter !== 'all' && (e.department?.trim() || '') !== deptFilter) return false;
      if (roleFilter !== 'all' && e.role !== roleFilter) return false;
      if (statusFilter !== 'all' && (e.status ?? 'active') !== statusFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.code ?? '').toLowerCase().includes(q) ||
        e.roleTitle.toLowerCase().includes(q) ||
        (e.department ?? '').toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q) ||
        (e.whatsapp ?? '').toLowerCase().includes(q) ||
        (e.email ?? '').toLowerCase().includes(q) ||
        (e.nationalId ?? '').toLowerCase().includes(q) ||
        (e.username ?? '').toLowerCase().includes(q)
      );
    });
  }, [state.employees, search, deptFilter, roleFilter, statusFilter]);

  const totalNetPayroll = useMemo(
    () =>
      fromHalalas(
        filteredEmployees
          .filter((e) => (e.status ?? 'active') !== 'terminated')
          .reduce(
            (s, e) => s + Math.max(0, toHalalas(e.salary) + toHalalas(e.allowances ?? 0) - toHalalas(e.deductions ?? 0)),
            0,
          ),
      ),
    [filteredEmployees],
  );

  const empKpis = useMemo(() => {
    let activeCount = 0;
    let grossH = 0;
    let netH = 0;
    for (const e of state.employees) {
      const st = e.status ?? 'active';
      if (st === 'active') activeCount += 1;
      if (st !== 'terminated') {
        const sH = toHalalas(e.salary);
        const aH = toHalalas(e.allowances ?? 0);
        const dH = toHalalas(e.deductions ?? 0);
        grossH += sH + aH;
        netH += Math.max(0, sH + aH - dH);
      }
    }
    return {
      total: state.employees.length,
      active: activeCount,
      gross: fromHalalas(grossH),
      net: fromHalalas(netH),
    };
  }, [state.employees]);

  const openNewEmployeeModal = () => {
    setFormError('');
    setEmpSection('all');
    setEmpForm({
      code: nextEmpCodePreview,
      name: '',
      roleTitle: '',
      department: '',
      role: 'salesman',
      permissions: [...DEFAULT_PERMISSIONS_MATRIX.salesman],
      phone: '',
      whatsapp: '',
      email: '',
      nationalId: '',
      birthDate: '',
      branchId: state.branches[0]?.id ?? '',
      hireDate: new Date().toISOString().slice(0, 10),
      salary: '',
      allowances: '0',
      deductions: '0',
      bankAccount: '',
      workShift: isAr ? 'صباحي 8 ص - 4 م' : 'Morning 8AM - 4PM',
      username: '',
      photoBase64: '',
      attachmentBase64: '',
      idAttachmentBase64: '',
      status: 'active',
      notes: '',
    });
    setEmpModal({ open: true });
  };

  const openEditEmployeeModal = (e: Employee) => {
    setFormError('');
    setEmpSection('all');
    setEmpForm({
      code: e.code ?? e.id,
      name: e.name,
      roleTitle: e.roleTitle,
      department: e.department ?? '',
      role: e.role,
      permissions: [...e.permissions],
      phone: e.phone,
      whatsapp: e.whatsapp ?? '',
      email: e.email ?? '',
      nationalId: e.nationalId ?? '',
      birthDate: e.birthDate ?? '',
      branchId: e.branchId ?? state.branches[0]?.id ?? '',
      hireDate: e.hireDate ?? '',
      salary: String(e.salary),
      allowances: String(e.allowances ?? 0),
      deductions: String(e.deductions ?? 0),
      bankAccount: e.bankAccount ?? '',
      workShift: e.workShift ?? '',
      username: e.username ?? '',
      photoBase64: e.photoBase64 ?? '',
      attachmentBase64: e.attachmentBase64 ?? '',
      idAttachmentBase64: e.idAttachmentBase64 ?? '',
      status: e.status ?? 'active',
      notes: e.notes ?? '',
    });
    setEmpModal({ open: true, editId: e.id });
  };

  const handleUploadImage = async (
    file: File | undefined,
    field: 'photoBase64' | 'attachmentBase64' | 'idAttachmentBase64',
  ) => {
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      setEmpForm((prev) => ({ ...prev, [field]: compressed }));
    } catch {
      actions.notify(isAr ? 'تعذر قراءة الملف المختار' : 'Failed to process selected image');
    }
  };

  const modalNetSalary = computeNetSalary(
    parseFloat(empForm.salary) || 0,
    parseFloat(empForm.allowances) || 0,
    parseFloat(empForm.deductions) || 0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم، الكود، القسم، الجوال، أو اسم المستخدم...' : 'Search name, code, dept, phone, or username...'}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2">
          <span className="text-slate-500">{isAr ? 'صافي مسير الرواتب:' : 'Net Payroll:'}</span>
          <span className="font-mono font-extrabold text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
            {formatCurrency(totalNetPayroll, cur, { isAr })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            const csv = ['Code,Name,JobTitle,Department,Role,Phone,Email,NationalId,HireDate,Status,Salary,Allowances,Deductions,NetSalary,IBAN']
              .concat(
                filteredEmployees.map((e) => {
                  const net = computeNetSalary(e.salary, e.allowances ?? 0, e.deductions ?? 0);
                  return `${e.code ?? e.id},"${e.name.replace(/"/g, '""')}","${e.roleTitle.replace(/"/g, '""')}","${(e.department ?? '').replace(/"/g, '""')}",${e.role},${e.phone},${e.email ?? ''},${e.nationalId ?? ''},${e.hireDate ?? ''},${e.status ?? 'active'},${e.salary},${e.allowances ?? 0},${e.deductions ?? 0},${net},${e.bankAccount ?? ''}`;
                }),
              )
              .join('\n');
            downloadTextFile('ostora_employees.csv', csv);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] text-xs font-bold cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{t.exportCsv}</span>
        </button>
        <button
          onClick={openNewEmployeeModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#C9A227]" />
          <span>{t.addEmployee}</span>
        </button>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'إجمالي الموظفين' : 'Total Employees'}</span>
          <span className="text-lg font-extrabold font-mono tabular-nums mt-1 block">{empKpis.total}</span>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'على رأس العمل' : 'Active Staff'}</span>
          <span className="text-lg font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1 block">{empKpis.active}</span>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'إجمالي الأساسي والبدلات' : 'Gross Payroll'}</span>
          <span className="text-lg font-extrabold font-mono tabular-nums mt-1 block">{formatCurrency(empKpis.gross, cur, { isAr })}</span>
        </div>
        <div className="bg-white dark:bg-[#121E19] border border-[#C9A227]/35 rounded-[20px] p-4">
          <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'صافي مسير الرواتب الشهري' : 'Monthly Net Payroll'}</span>
          <span className="text-lg font-extrabold font-mono tabular-nums text-[#0A3D2C] dark:text-[#C9A227] mt-1 block">{formatCurrency(empKpis.net, cur, { isAr })}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-3 flex flex-wrap items-center gap-2.5">
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الأقسام' : 'All Departments'}</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | RoleId)}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الأدوار' : 'All Roles'}</option>
          <option value="owner">{t.roleOwner}</option>
          <option value="accountant">{t.roleAccountant}</option>
          <option value="cashier">{t.roleCashier}</option>
          <option value="salesman">{t.roleSalesman}</option>
          <option value="warehouse">{t.roleWarehouse}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'on_leave' | 'terminated')}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
        >
          <option value="all">{isAr ? 'كل الحالات' : 'All Statuses'}</option>
          <option value="active">{isAr ? 'على رأس العمل' : 'Active'}</option>
          <option value="on_leave">{isAr ? 'إجازة' : 'On Leave'}</option>
          <option value="terminated">{isAr ? 'منتهي الخدمة' : 'Terminated'}</option>
        </select>
      </div>

      {filteredEmployees.length === 0 ? (
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
          {t.noData}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEmployees.map((e) => {
            const brName = state.branches.find((b) => b.id === e.branchId)?.[isAr ? 'nameAr' : 'nameEn'];
            const st = e.status ?? 'active';
            const netSal = computeNetSalary(e.salary, e.allowances ?? 0, e.deductions ?? 0);
            return (
              <div key={e.id} className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {e.photoBase64 ? (
                      <img src={e.photoBase64} alt={e.name} className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-[#1F332B] shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 flex items-center justify-center font-extrabold text-[#0A3D2C] dark:text-[#C9A227] shrink-0">
                        {e.name.trim().slice(0, 1) || 'E'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-[10px] font-mono font-bold text-[#C9A227]">{e.code ?? e.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            st === 'active'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : st === 'on_leave'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                : 'bg-red-500/15 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {statusLabel(st)}
                        </span>
                        {e.workShift && (
                          <span className="text-[10px] text-slate-400">· {e.workShift}</span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-base truncate">{e.name}</h4>
                      <p className="text-xs text-slate-500">
                        {e.roleTitle}{e.department ? ` · ${e.department}` : ''} · {roleLabels[e.role]} · {e.phone}
                      </p>
                      {(brName || e.hireDate || e.nationalId) && (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {brName ? `${brName}` : ''}
                          {e.nationalId ? ` · ID: ${e.nationalId}` : ''}
                          {e.hireDate ? ` · ${isAr ? 'التعيين:' : 'Hire:'} ${e.hireDate}` : ''}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                        <span className="text-[#0A3D2C] dark:text-[#C9A227] font-semibold">
                          {e.permissions.length} {isAr ? 'صلاحيات' : 'perms'}
                        </span>
                        {e.username && (
                          <span className="text-slate-400 font-mono flex items-center gap-0.5">
                            <UserCheck className="w-3 h-3" /> {e.username}
                          </span>
                        )}
                        {(e.attachmentBase64 || e.idAttachmentBase64) && (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                            <FileText className="w-3 h-3" /> {isAr ? 'مرفقات موثقة' : 'Docs'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <span className="font-mono font-extrabold text-sm tabular-nums block text-[#0A3D2C] dark:text-[#C9A227]">
                      {formatCurrency(netSal, cur, { isAr })}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {isAr ? 'أساسي' : 'Base'}: {formatCurrency(e.salary, cur, { isAr })}
                      {e.allowances ? ` +${e.allowances}` : ''}
                      {e.deductions ? ` -${e.deductions}` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#1F332B]">
                  <button
                    onClick={() => {
                      actions.paySalary(e.id);
                      actions.notify(`${t.paySalary}: ${e.name} (${formatCurrency(netSal, cur, { isAr })})`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{t.paySalary}</span>
                  </button>
                  <a
                    href={buildWhatsAppLink(
                      e.whatsapp || e.phone,
                      isAr
                        ? `مرحباً ${e.name}، تم تحويل صافي راتبك الشهري ${formatCurrency(netSal, cur, { isAr })} من ${state.settings.companyName}.`
                        : `Hi ${e.name}, your net salary of ${formatCurrency(netSal, cur, { isAr })} has been transferred.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{t.whatsapp}</span>
                  </a>
                  <div className="ms-auto flex gap-1">
                    <button
                      onClick={() => openEditEmployeeModal(e)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </button>
                    {canDelete && (
                      <button onClick={() => actions.deleteEmployee(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer">
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

      {empModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-3xl w-full p-6 space-y-3 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">{empModal.editId ? t.edit : t.addEmployee}</h3>
              <button
                type="button"
                onClick={() => setEmpModal({ open: false })}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs font-bold text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            {/* Section Tabs + Live Net Salary Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0A120F]">
                {([
                  ['all', isAr ? 'الكل' : 'All'],
                  ['personal', isAr ? 'الهوية والتواصل' : 'Identity'],
                  ['job', isAr ? 'الوظيفة والفرع' : 'Job & Branch'],
                  ['salary', isAr ? 'الراتب والبنك' : 'Payroll & Bank'],
                  ['access', isAr ? 'الصلاحيات والمرفقات' : 'Access & Docs'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEmpSection(key)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                      empSection === key
                        ? 'bg-[#0A3D2C] text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-xs font-mono font-extrabold text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
                {isAr ? 'الصافي:' : 'Net:'} {formatCurrency(modalNetSalary, cur, { isAr })}
              </span>
            </div>

            {/* Photo & Core Identity */}
            {(empSection === 'all' || empSection === 'personal') && (
              <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
              <div className="flex items-center gap-2.5">
                {empForm.photoBase64 ? (
                  <img src={empForm.photoBase64} alt="avatar" className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-[#1F332B]" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#0A120F] flex items-center justify-center text-slate-400">
                    <Camera className="w-5 h-5" />
                  </div>
                )}
                <label className="flex-1 px-2.5 py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#1F332B] text-[11px] font-bold text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-[#0A120F]">
                  {isAr ? 'صورة الموظف' : 'Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void handleUploadImage(e.target.files?.[0], 'photoBase64')}
                  />
                </label>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'كود الموظف' : 'Employee Code'}
                </label>
                <input
                  maxLength={40}
                  value={empForm.code}
                  onChange={(e) => setEmpForm({ ...empForm, code: e.target.value })}
                  placeholder={nextEmpCodePreview}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {t.fullName} *
                </label>
                <input
                  maxLength={160}
                  value={empForm.name}
                  onChange={(e) => {
                    setFormError('');
                    setEmpForm({ ...empForm, name: e.target.value });
                  }}
                  placeholder={t.fullName}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
                />
              </div>
            </div>
              </>
            )}

            {(empSection === 'all' || empSection === 'job') && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'المسمى الوظيفي' : 'Job Title'}
                </label>
                <input
                  maxLength={100}
                  value={empForm.roleTitle}
                  onChange={(e) => setEmpForm({ ...empForm, roleTitle: e.target.value })}
                  placeholder={isAr ? 'محاسب / مدير مبيعات' : 'Job Title'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {t.department}
                </label>
                <input
                  maxLength={80}
                  value={empForm.department}
                  onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                  placeholder={isAr ? 'المالية / المبيعات / المستودعات' : 'Department'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الدوام / الوردية' : 'Work Shift'}
                </label>
                <input
                  maxLength={80}
                  value={empForm.workShift}
                  onChange={(e) => setEmpForm({ ...empForm, workShift: e.target.value })}
                  placeholder={isAr ? 'صباحي 8 - 4' : 'Shift'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الحالة الوظيفية' : 'Status'}
                </label>
                <select
                  value={empForm.status}
                  onChange={(e) => setEmpForm({ ...empForm, status: e.target.value as 'active' | 'on_leave' | 'terminated' })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  <option value="active">{isAr ? 'على رأس العمل' : 'Active'}</option>
                  <option value="on_leave">{isAr ? 'إجازة' : 'On Leave'}</option>
                  <option value="terminated">{isAr ? 'منتهي الخدمة' : 'Terminated'}</option>
                </select>
              </div>
            </div>
            )}

            {(empSection === 'all' || empSection === 'personal') && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {t.phone} *
                </label>
                <input
                  type="tel"
                  maxLength={40}
                  value={empForm.phone}
                  onChange={(e) => {
                    setFormError('');
                    setEmpForm({ ...empForm, phone: e.target.value });
                  }}
                  placeholder="05XXXXXXXX"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'واتساب' : 'WhatsApp'}
                </label>
                <input
                  type="tel"
                  maxLength={40}
                  value={empForm.whatsapp}
                  onChange={(e) => setEmpForm({ ...empForm, whatsapp: e.target.value })}
                  placeholder="9665XXXXXXXX"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <input
                  type="email"
                  maxLength={120}
                  value={empForm.email}
                  onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'رقم الهوية / الإقامة' : 'National ID / Iqama'}
                </label>
                <input
                  maxLength={40}
                  value={empForm.nationalId}
                  onChange={(e) => setEmpForm({ ...empForm, nationalId: e.target.value })}
                  placeholder="10XXXXXXXX"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            </div>
            )}

            {(empSection === 'all' || empSection === 'job') && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'تاريخ الميلاد' : 'Birth Date'}
                </label>
                <input
                  type="date"
                  value={empForm.birthDate}
                  onChange={(e) => setEmpForm({ ...empForm, birthDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'تاريخ التعيين' : 'Hire Date'}
                </label>
                <input
                  type="date"
                  value={empForm.hireDate}
                  onChange={(e) => setEmpForm({ ...empForm, hireDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الفرع' : 'Branch'}
                </label>
                <select
                  value={empForm.branchId}
                  onChange={(e) => setEmpForm({ ...empForm, branchId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
                >
                  {state.branches.map((b) => (
                    <option key={b.id} value={b.id}>{isAr ? b.nameAr : b.nameEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الحساب البنكي / IBAN' : 'Bank Account / IBAN'}
                </label>
                <input
                  maxLength={60}
                  value={empForm.bankAccount}
                  onChange={(e) => setEmpForm({ ...empForm, bankAccount: e.target.value })}
                  placeholder="SA00..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
            </div>
            )}

            {/* Salary, Allowances, Deductions & Auto Net Salary */}
            {(empSection === 'all' || empSection === 'salary') && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B]">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الراتب الأساسي' : 'Base Salary'} *
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={empForm.salary}
                  onChange={(e) => {
                    setFormError('');
                    setEmpForm({ ...empForm, salary: e.target.value });
                  }}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'البدلات' : 'Allowances'}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={empForm.allowances}
                  onChange={(e) => setEmpForm({ ...empForm, allowances: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الخصومات' : 'Deductions'}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={empForm.deductions}
                  onChange={(e) => setEmpForm({ ...empForm, deductions: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
                />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-500">{isAr ? 'صافي الراتب (تلقائي)' : 'Net Salary (Auto)'}</span>
                <span className="text-sm font-extrabold font-mono text-[#0A3D2C] dark:text-[#C9A227] tabular-nums">
                  {formatCurrency(modalNetSalary, cur, { isAr })}
                </span>
              </div>
            </div>
            )}

            {/* Username, Firebase Auth Invite & Attachments */}
            {(empSection === 'all' || empSection === 'access') && (
              <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'اسم المستخدم' : 'Username'}
                </label>
                <input
                  maxLength={64}
                  value={empForm.username}
                  onChange={(e) => setEmpForm({ ...empForm, username: e.target.value })}
                  placeholder="user.emp"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const cleanEmail = empForm.email.trim();
                  if (!cleanEmail || !cleanEmail.includes('@')) {
                    setFormError(isAr ? 'أدخل بريداً إلكترونياً صحيحاً للموظف لإرسال دعوة Firebase Auth' : 'Enter a valid email to invite via Firebase Auth');
                    return;
                  }
                  void actions.inviteWorkspaceMember(cleanEmail, empForm.role, empForm.permissions);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 border border-[#0A3D2C]/25 text-[#0A3D2C] dark:text-[#C9A227] text-xs font-bold cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{isAr ? 'دعوة دخول Firebase' : 'Send Auth Invite'}</span>
              </button>
              <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#1F332B] text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-[#0A120F]">
                <Upload className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                <span>{empForm.attachmentBase64 ? (isAr ? 'تم إرفاق العقد ✓' : 'Contract ✓') : (isAr ? 'مرفق العقد' : 'Contract File')}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleUploadImage(e.target.files?.[0], 'attachmentBase64')} />
              </label>
              <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#1F332B] text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-[#0A120F]">
                <Upload className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
                <span>{empForm.idAttachmentBase64 ? (isAr ? 'تم إرفاق الهوية ✓' : 'ID File ✓') : (isAr ? 'صورة الهوية' : 'ID Scan')}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleUploadImage(e.target.files?.[0], 'idAttachmentBase64')} />
              </label>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">{t.loginAs}</label>
              <select
                value={empForm.role}
                onChange={(e) => {
                  const nextRole = e.target.value as RoleId;
                  setEmpForm({
                    ...empForm,
                    role: nextRole,
                    permissions: [...(state.permissionsMatrix[nextRole] ?? DEFAULT_PERMISSIONS_MATRIX[nextRole])],
                  });
                }}
                className="mt-1 w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm font-bold"
              >
                <option value="owner">{t.roleOwner}</option>
                <option value="accountant">{t.roleAccountant}</option>
                <option value="cashier">{t.roleCashier}</option>
                <option value="salesman">{t.roleSalesman}</option>
                <option value="warehouse">{t.roleWarehouse}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">{t.permissionsMatrix}</label>
              <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B]">
                {ALL_ROUTES.map((rt) => {
                  const checked = empForm.permissions.includes(rt);
                  return (
                    <label key={rt} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setEmpForm({
                            ...empForm,
                            permissions: checked
                              ? empForm.permissions.filter((x) => x !== rt)
                              : [...empForm.permissions, rt],
                          })
                        }
                      />
                      <span className="truncate">{t[rt]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t.notes}</label>
              <textarea
                rows={2}
                maxLength={400}
                value={empForm.notes}
                onChange={(e) => setEmpForm({ ...empForm, notes: e.target.value })}
                placeholder={t.notes}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
            </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEmpModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!empForm.name.trim()) {
                    setFormError(isAr ? 'الاسم الكامل للموظف إلزامي *' : 'Employee full name is required *');
                    return;
                  }
                  if (!empForm.phone.trim()) {
                    setFormError(isAr ? 'رقم الجوال إلزامي *' : 'Phone number is required *');
                    return;
                  }
                  const sal = parseFloat(empForm.salary);
                  if (!Number.isFinite(sal) || sal <= 0) {
                    setFormError(isAr ? 'الراتب الأساسي إلزامي ويجب أن يكون أكبر من صفر *' : 'Salary must be > 0 *');
                    return;
                  }
                  const allow = Math.max(0, parseFloat(empForm.allowances) || 0);
                  const ded = Math.max(0, parseFloat(empForm.deductions) || 0);
                  actions.saveEmployee(
                    {
                      code: empForm.code.trim() || nextEmpCodePreview,
                      name: empForm.name.trim(),
                      roleTitle: empForm.roleTitle.trim() || roleLabels[empForm.role],
                      department: empForm.department.trim() || undefined,
                      role: empForm.role,
                      permissions: empForm.permissions,
                      phone: empForm.phone.trim(),
                      whatsapp: empForm.whatsapp.trim() || undefined,
                      email: empForm.email.trim() || undefined,
                      nationalId: empForm.nationalId.trim() || undefined,
                      birthDate: empForm.birthDate || undefined,
                      branchId: empForm.branchId || undefined,
                      hireDate: empForm.hireDate || undefined,
                      salary: sal,
                      allowances: allow || undefined,
                      deductions: ded || undefined,
                      bankAccount: empForm.bankAccount.trim() || undefined,
                      workShift: empForm.workShift.trim() || undefined,
                      username: empForm.username.trim() || undefined,
                      photoBase64: empForm.photoBase64 || undefined,
                      attachmentBase64: empForm.attachmentBase64 || undefined,
                      idAttachmentBase64: empForm.idAttachmentBase64 || undefined,
                      status: empForm.status,
                      notes: empForm.notes.trim() || undefined,
                    },
                    empModal.editId,
                  );
                  setEmpModal({ open: false });
                  actions.notify(isAr ? 'تم حفظ بيانات وصلاحيات الموظف' : 'Employee & permissions saved');
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
