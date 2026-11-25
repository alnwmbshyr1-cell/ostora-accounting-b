import React, { useMemo, useState } from 'react';
import { Lock, Search, ShieldCheck, Unlock } from 'lucide-react';
import { strings } from '../data/translations';
import { ScreenProps } from './types';

export const AuditLogScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];

  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [lockInput, setLockInput] = useState(state.settings.fiscalLockDate ?? '');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.auditLogs
      .filter((log) => actionFilter === 'all' || log.action === actionFilter)
      .filter(
        (log) =>
          !q ||
          log.summary.toLowerCase().includes(q) ||
          log.actor.toLowerCase().includes(q) ||
          log.entity.toLowerCase().includes(q) ||
          log.entityId.toLowerCase().includes(q),
      );
  }, [state.auditLogs, query, actionFilter]);

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

  return (
    <div className="space-y-4">
      {/* Fiscal Period Lock Card */}
      <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 flex flex-wrap items-center justify-between gap-4">
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

      {/* Immutable Audit Trail Banner & Filters */}
      <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
            <div>
              <h3 className="text-sm font-extrabold">{t.audit_log} ({filtered.length})</h3>
              <p className="text-[11px] text-slate-500">{t.auditLogReadOnlyHint}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-2.5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.search}
                className="ps-8 pe-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
            >
              <option value="all">{t.all}</option>
              <option value="create">create</option>
              <option value="update">update</option>
              <option value="delete">delete</option>
              <option value="pay">pay</option>
              <option value="receive">receive</option>
              <option value="transfer">transfer</option>
              <option value="reconcile">reconcile</option>
              <option value="stocktake">stocktake</option>
              <option value="fiscal_lock">fiscal_lock</option>
              <option value="backup">backup</option>
            </select>
          </div>
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
                  <th className="p-2.5 text-start">{isAr ? 'السجل' : 'Entity'}</th>
                  <th className="p-2.5 text-start">{isAr ? 'التفاصيل' : 'Summary'}</th>
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
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-[11px]">
                      {log.entity} #{log.entityId}
                    </td>
                    <td className="p-2.5">{log.summary}</td>
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
