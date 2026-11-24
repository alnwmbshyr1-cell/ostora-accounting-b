import React from 'react';
import { strings } from '../data/translations';
import { ScreenProps } from './types';

export const SubscriptionScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, metrics, actions } = store;
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];

  const plans = [
    {
      id: 'basic_monthly',
      name: isAr ? 'الباقة الأساسية (Basic)' : 'Basic Plan',
      price: '49 SAR / mo',
      desc: isAr ? 'فواتير غير محدودة + جهاز واحد' : 'Unlimited invoices + 1 device',
    },
    {
      id: 'pro_monthly',
      name: isAr ? 'الباقة الاحترافية (Pro)' : 'Pro Plan',
      price: '99 SAR / mo',
      desc: isAr ? 'كل المميزات + تحليلات AI + Google Drive' : 'Full ERP + AI Analytics + Drive Backup',
    },
    {
      id: 'business_monthly',
      name: isAr ? 'باقة الأعمال (Business)' : 'Business Plan',
      price: '199 SAR / mo',
      desc: isAr ? 'فروع متعددة + صلاحيات + دعم فوري' : 'Multi-branch + RBAC + Priority support',
    },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-[#0A3D2C] text-white rounded-[20px] p-6 text-center space-y-2">
        <div className="text-3xl">🛡️</div>
        <p className="text-xs text-white/75">{t.trialRemaining}</p>
        <p className="text-3xl font-extrabold text-[#C9A227] font-mono tabular-nums">
          {metrics.trialDaysRemaining} {t.days}
        </p>
        <p className="text-xs text-white/80">
          {t.activePlan}: <span className="font-mono font-bold">{state.activePlan}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const active = state.activePlan === p.id;
          return (
            <div
              key={p.id}
              className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <h4 className="font-extrabold text-base">{p.name}</h4>
                <p className="text-lg font-extrabold text-[#0A3D2C] dark:text-[#C9A227] font-mono mt-1">{p.price}</p>
                <p className="text-xs text-slate-500 mt-2">{p.desc}</p>
              </div>
              <button
                onClick={() => {
                  actions.setActivePlan(p.id);
                  actions.notify(`${t.activePlan}: ${p.name}`);
                }}
                className={`w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer ${
                  active ? 'bg-[#C9A227] text-slate-950' : 'bg-[#0A3D2C] text-white'
                }`}
              >
                {active ? t.activePlan : t.subscribe}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
