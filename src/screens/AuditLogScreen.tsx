import React, { useMemo, useState } from 'react';
import { Download, Lock, Printer, Search, ShieldCheck, Unlock } from 'lucide-react';
import { strings } from '../data/translations';
import { downloadTextFile } from '../utils/export';
import { ScreenProps } from './types';

export const AuditLogScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];

  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [lockInput, setLockInput] = useState(state.settings.fiscalLockDate ?? '');

  const uniqueEntities = useMemo(() => {
    const set = new Set<string>();
    state.auditLogs.forEach((l) => {
      if (l.entity) set.add(l.entity);
    });
    return Array.from(set).sort();
  }, [state.auditLogs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.auditLogs
      .filter((log) => actionFilter === 'all' || log.action === actionFilter)
      .filter((log) => roleFilter === 'all' || log.actorRole === roleFilter)
      .filter((log) => entityFilter === 'all' || log.entity === entityFilter)
      .filter((log) => {
        const d = log.timestamp.slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      })
      .filter(
        (log) =>
          !q ||
          log.summary.toLowerCase().includes(q) ||
          log.actor.toLowerCase().includes(q) ||
          log.entity.toLowerCase().includes(q) ||
          log.entityId.toLowerCase().includes(q) ||
          (log.screenName ?? '').toLowerCase().includes(q) ||
          (log.oldValue ?? '').toLowerCase().includes(q) ||
          (log.newValue ?? '').toLowerCase().includes(q),
      );
  }, [state.auditLogs, query, actionFilter, roleFilter, entityFilter, dateFrom, dateTo]);

  const handleApplyLock = () => {
    actions.setFiscalLockDate(lockInput);
    actions.notify(
      lockInput
        ? isAr
          ? `تم قفل الفترة المالية حتى ${lockInput}`
          : `Fiscal period locked through ${lockInput}`
        : isAr
        ? 'تم فتح الفترة المالية'
        : 'Fiscal period unlocked',
    );
  };

  const handleExportCsv = () => {
    const headers = [
      'Timestamp',
      'Actor',
      'Role',
      'Action',
      'Screen',
      'Entity',
      'EntityId',
      'OldValue',
      'NewValue',
      'Device',
      'Summary',
    ];
    const lines = [
      headers.join(','),
      ...filtered.map((l) =>
        [
          l.timestamp,
          l.actor,
          l.actorRole,
          l.action,
          l.screenName ?? '',
          l.entity,
          l.entityId,
          l.oldValue ?? '',
          l.newValue ?? '',
          l.deviceInfo ?? '',
          l.summary,
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ];
    downloadTextFile(`ostora_audit_log_${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'));
  };

  return (
    <div className="space-y-4">
      {/* Fiscal Period Lock Card */}
      <div className="no-print rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0A3D2C] text-[#C9A227] flex items-center justify-center shrink-0">
            {state.settings.fiscalLockDate ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-sm font-extrabold">{t.fiscalLockTitle}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t.fiscalLockHint}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={lockInput}
            onChange={(e) => setLockInput(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-mono"
          />
          <button
            type="button"
            onClick={handleApplyLock}
            className="px-4 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
          >
            {isAr ? 'تطبيق القفل' : 'Apply Lock'}
          </button>
          {state.settings.fiscalLockDate && (
            <button
              type="button"
              onClick={() => {
                setLockInput('');
                actions.setFiscalLockDate('');
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
            >
              {isAr ? 'فتح الفترة' : 'Unlock'}
            </button>
          )}
        </div>
      </div>

      {/* Immutable Audit Trail Banner, Filters & Read-only Table */}
      <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
            <div>
              <h3 className="text-sm font-extrabold">
                {t.audit_log} ({filtered.length})
              </h3>
              <p className="text-[11px] text-slate-500">{t.auditLogReadOnlyHint}</p>
            </div>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isAr ? 'تصدير PDF / طباعة' : 'Export PDF / Print'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.exportCsv}</span>
            </button>
          </div>
        </div>

        {/* Multi-Dimensional Search & Filters */}
        <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <div className="relative lg:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? 'بحث بالمستخدم أو الشاشة أو القيمة...' : 'Search user, screen, old/new value...'}
              className="w-full ps-8 pe-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
          >
            <option value="all">{isAr ? 'كل العمليات' : 'All Actions'}</option>
            <option value="create">create</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
            <option value="print">print</option>
            <option value="pay">pay</option>
            <option value="receive">receive</option>
            <option value="transfer">transfer</option>
            <option value="reconcile">reconcile</option>
            <option value="stocktake">stocktake</option>
            <option value="fiscal_lock">fiscal_lock</option>
            <option value="backup">backup</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
          >
            <option value="all">{isAr ? 'كل الصلاحيات' : 'All Roles'}</option>
            <option value="owner">{t.roleOwner}</option>
            <option value="accountant">{t.roleAccountant}</option>
            <option value="cashier">{t.roleCashier}</option>
            <option value="salesman">{t.roleSalesman}</option>
            <option value="warehouse">{t.roleWarehouse}</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
          >
            <option value="all">{isAr ? 'كل الشاشات / السجلات' : 'All Entities'}</option>
            {uniqueEntities.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>

          <div className="flex gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title={isAr ? 'من تاريخ' : 'From Date'}
              className="w-1/2 px-2 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-[11px] font-mono"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title={isAr ? 'إلى تاريخ' : 'To Date'}
              className="w-1/2 px-2 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-[11px] font-mono"
            />
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block border-b-2 border-[#0A3D2C] pb-2 mb-2">
          <h1 className="text-lg font-extrabold text-[#0A3D2C]">
            {state.settings.companyName} — {t.audit_log}
          </h1>
          <p className="text-xs text-slate-500 font-mono">
            {new Date().toISOString().slice(0, 16).replace('T', ' ')} · {filtered.length} {isAr ? 'سجل' : 'entries'}
          </p>
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">{t.noData}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-[#0A120F] text-slate-500 border-b border-slate-200 dark:border-[#1F332B]">
                <tr>
                  <th className="p-2.5 text-start">{isAr ? 'الوقت والتاريخ' : 'Timestamp'}</th>
                  <th className="p-2.5 text-start">{isAr ? 'المستخدم / الدور' : 'Actor / Role'}</th>
                  <th className="p-2.5 text-start">{isAr ? 'الإجراء' : 'Action'}</th>
                  <th className="p-2.5 text-start">{isAr ? 'الشاشة / السجل' : 'Screen / Entity'}</th>
                  <th className="p-2.5 text-start">{isAr ? 'التفاصيل والقيم' : 'Summary & Diff'}</th>
                  <th className="p-2.5 text-start">{isAr ? 'الجهاز' : 'Device'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1F332B]">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-[#1A2C24]/40">
                    <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">
                      {log.timestamp.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="p-2.5">
                      <span className="font-bold">{log.actor}</span>{' '}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227] font-mono">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          log.action === 'delete' || log.action === 'fiscal_lock'
                            ? 'bg-rose-500/10 text-rose-600'
                            : log.action === 'print'
                            ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-[11px]">
                      {log.screenName && <span className="block font-sans font-bold text-[#0A3D2C] dark:text-[#C9A227]">{log.screenName}</span>}
                      <span>
                        {log.entity} #{log.entityId}
                      </span>
                    </td>
                    <td className="p-2.5 max-w-sm">
                      <p className="font-medium">{log.summary}</p>
                      {(log.oldValue || log.newValue) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-mono">
                          {log.oldValue && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 line-through">
                              {log.oldValue}
                            </span>
                          )}
                          {log.oldValue && log.newValue && <span className="text-slate-400">→</span>}
                          {log.newValue && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                              {log.newValue}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-[10px] font-mono text-slate-400 max-w-[140px] truncate" title={log.deviceInfo}>
                      {log.deviceInfo || 'Web ERP'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
