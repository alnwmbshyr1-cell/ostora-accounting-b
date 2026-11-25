import React, { useMemo, useState } from 'react';
import { CreditCard, Edit2, MessageCircle, Plus, Search, Trash2, X } from 'lucide-react';
import { ALL_ROUTES, DEFAULT_PERMISSIONS_MATRIX } from '../constants/permissions';
import { strings } from '../data/translations';
import { Employee, RoleId, RouteId } from '../types/erp';
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
  const [formError, setFormError] = useState('');
  const [empForm, setEmpForm] = useState<{
    code: string;
    name: string;
    roleTitle: string;
    department: string;
    role: RoleId;
    permissions: RouteId[];
    phone: string;
    email: string;
    nationalId: string;
    branchId: string;
    hireDate: string;
    salary: string;
    bankAccount: string;
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
    email: '',
    nationalId: '',
    branchId: state.branches[0]?.id ?? '',
    hireDate: new Date().toISOString().slice(0, 10),
    salary: '',
    bankAccount: '',
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
        (e.email ?? '').toLowerCase().includes(q) ||
        (e.nationalId ?? '').toLowerCase().includes(q)
      );
    });
  }, [state.employees, search, deptFilter, roleFilter, statusFilter]);

  const openNewEmployeeModal = () => {
    setFormError('');
    setEmpForm({
      code: nextEmpCodePreview,
      name: '',
      roleTitle: '',
      department: '',
      role: 'salesman',
      permissions: [...DEFAULT_PERMISSIONS_MATRIX.salesman],
      phone: '',
      email: '',
      nationalId: '',
      branchId: state.branches[0]?.id ?? '',
      hireDate: new Date().toISOString().slice(0, 10),
      salary: '',
      bankAccount: '',
      status: 'active',
      notes: '',
    });
    setEmpModal({ open: true });
  };

  const openEditEmployeeModal = (e: Employee) => {
    setFormError('');
    setEmpForm({
      code: e.code ?? e.id,
      name: e.name,
      roleTitle: e.roleTitle,
      department: e.department ?? '',
      role: e.role,
      permissions: [...e.permissions],
      phone: e.phone,
      email: e.email ?? '',
      nationalId: e.nationalId ?? '',
      branchId: e.branchId ?? state.branches[0]?.id ?? '',
      hireDate: e.hireDate ?? '',
      salary: String(e.salary),
      bankAccount: e.bankAccount ?? '',
      status: e.status ?? 'active',
      notes: e.notes ?? '',
    });
    setEmpModal({ open: true, editId: e.id });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم، الكود، القسم، الجوال، أو الهوية...' : 'Search name, code, department, phone, or ID...'}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <button
          onClick={openNewEmployeeModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addEmployee}</span>
        </button>
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
            return (
              <div key={e.id} className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
                <div className="flex justify-between items-start gap-2">
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
                    <p className="text-[11px] text-[#0A3D2C] dark:text-[#C9A227] mt-1 font-semibold">
                      {e.permissions.length} {isAr ? 'صلاحيات مفعّلة' : 'permissions enabled'}
                    </p>
                  </div>
                  <span className="font-mono font-extrabold text-sm tabular-nums shrink-0">{e.salary.toLocaleString()} {cur}</span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#1F332B]">
                  <button
                    onClick={() => {
                      actions.paySalary(e.id);
                      actions.notify(`${t.paySalary}: ${e.name}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{t.paySalary}</span>
                  </button>
                  <a
                    href={buildWhatsAppLink(
                      e.phone,
                      isAr
                        ? `مرحباً ${e.name}، تم تحويل راتبك الشهري ${e.salary.toFixed(2)} ${cur} من ${state.settings.companyName}.`
                        : `Hi ${e.name}, your salary of ${e.salary.toFixed(2)} ${cur} has been transferred.`,
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
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-2xl w-full p-6 space-y-3 my-auto max-h-[92vh] overflow-y-auto">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                  placeholder={t.phone}
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

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {t.salary} *
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
                  placeholder={t.salary}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono tabular-nums"
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

            <textarea
              rows={2}
              maxLength={400}
              value={empForm.notes}
              onChange={(e) => setEmpForm({ ...empForm, notes: e.target.value })}
              placeholder={t.notes}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />

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
                    setFormError(isAr ? 'الراتب الشهري إلزامي ويجب أن يكون أكبر من صفر *' : 'Salary must be > 0 *');
                    return;
                  }
                  actions.saveEmployee(
                    {
                      code: empForm.code.trim() || nextEmpCodePreview,
                      name: empForm.name.trim(),
                      roleTitle: empForm.roleTitle.trim() || roleLabels[empForm.role],
                      department: empForm.department.trim() || undefined,
                      role: empForm.role,
                      permissions: empForm.permissions,
                      phone: empForm.phone.trim(),
                      email: empForm.email.trim() || undefined,
                      nationalId: empForm.nationalId.trim() || undefined,
                      branchId: empForm.branchId || undefined,
                      hireDate: empForm.hireDate || undefined,
                      salary: sal,
                      bankAccount: empForm.bankAccount.trim() || undefined,
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
