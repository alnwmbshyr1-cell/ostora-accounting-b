import React, { useState } from 'react';
import { CreditCard, Edit2, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { ALL_ROUTES, DEFAULT_PERMISSIONS_MATRIX } from '../constants/permissions';
import { strings } from '../data/translations';
import { RoleId, RouteId } from '../types/erp';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

export const EmployeesScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const [empModal, setEmpModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [empForm, setEmpForm] = useState<{
    name: string;
    roleTitle: string;
    role: RoleId;
    permissions: RouteId[];
    phone: string;
    salary: string;
  }>({
    name: '',
    roleTitle: '',
    role: 'salesman',
    permissions: [...DEFAULT_PERMISSIONS_MATRIX.salesman],
    phone: '',
    salary: '',
  });

  const roleLabels: Record<RoleId, string> = {
    owner: t.roleOwner,
    accountant: t.roleAccountant,
    salesman: t.roleSalesman,
    warehouse: t.roleWarehouse,
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEmpForm({
              name: '',
              roleTitle: '',
              role: 'salesman',
              permissions: [...DEFAULT_PERMISSIONS_MATRIX.salesman],
              phone: '',
              salary: '',
            });
            setEmpModal({ open: true });
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addEmployee}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.employees.map((e) => (
          <div key={e.id} className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-extrabold text-base">{e.name}</h4>
                <p className="text-xs text-slate-500">
                  {e.roleTitle} · {roleLabels[e.role]} · {e.phone}
                </p>
                <p className="text-[11px] text-[#0A3D2C] dark:text-[#C9A227] mt-1 font-semibold">
                  {e.permissions.length} {isAr ? 'صلاحيات مفعّلة' : 'permissions enabled'}
                </p>
              </div>
              <span className="font-mono font-extrabold text-sm tabular-nums">{e.salary.toLocaleString()} {cur}</span>
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
                  onClick={() => {
                    setEmpForm({
                      name: e.name,
                      roleTitle: e.roleTitle,
                      role: e.role,
                      permissions: [...e.permissions],
                      phone: e.phone,
                      salary: String(e.salary),
                    });
                    setEmpModal({ open: true, editId: e.id });
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2C24] cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-slate-500" />
                </button>
                <button onClick={() => actions.deleteEmployee(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {empModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121E19] rounded-[20px] max-w-md w-full p-6 space-y-3 my-auto">
            <h3 className="text-lg font-extrabold">{t.addEmployee}</h3>
            <input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} placeholder={t.fullName} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <input value={empForm.roleTitle} onChange={(e) => setEmpForm({ ...empForm, roleTitle: e.target.value })} placeholder={t.role} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} placeholder={t.phone} className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
              <input type="number" value={empForm.salary} onChange={(e) => setEmpForm({ ...empForm, salary: e.target.value })} placeholder={t.salary} className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm" />
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
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm"
              >
                <option value="owner">{t.roleOwner}</option>
                <option value="accountant">{t.roleAccountant}</option>
                <option value="salesman">{t.roleSalesman}</option>
                <option value="warehouse">{t.roleWarehouse}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">{t.permissionsMatrix}</label>
              <div className="mt-1 grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2.5 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B]">
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

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEmpModal({ open: false })} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-sm font-bold cursor-pointer">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!empForm.name.trim()) return;
                  actions.saveEmployee(
                    {
                      name: empForm.name.trim(),
                      roleTitle: empForm.roleTitle.trim() || roleLabels[empForm.role],
                      role: empForm.role,
                      permissions: empForm.permissions,
                      phone: empForm.phone.trim(),
                      salary: parseFloat(empForm.salary) || 0,
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
