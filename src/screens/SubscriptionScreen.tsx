import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  CreditCard,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { QrMatrix } from '../components/QrMatrix';
import { strings } from '../data/translations';
import { SubscriptionMeta } from '../types/erp';
import { formatCurrency } from '../utils/currencies';
import { buildZatcaTlvBase64 } from '../utils/zatca';
import { ScreenProps } from './types';

interface PlanSpec {
  id: SubscriptionMeta['planId'];
  nameAr: string;
  nameEn: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxUsers: number;
  maxBranches: number;
  maxInvoices: number;
  featuresAr: string[];
  featuresEn: string[];
}

const PLANS: PlanSpec[] = [
  {
    id: 'free',
    nameAr: 'الباقة المجانية',
    nameEn: 'Free Starter',
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxUsers: 2,
    maxBranches: 1,
    maxInvoices: 50,
    featuresAr: ['حتى 50 فاتورة', 'فرع واحد ومستودع واحد', 'التقارير الأساسية + رمز QR'],
    featuresEn: ['Up to 50 invoices', '1 Branch & 1 Warehouse', 'Core reports + ZATCA QR'],
  },
  {
    id: 'basic',
    nameAr: 'الباقة الأساسية (Basic)',
    nameEn: 'Basic Plan',
    monthlyPrice: 49,
    yearlyPrice: 470,
    maxUsers: 5,
    maxBranches: 2,
    maxInvoices: 500,
    featuresAr: ['حتى 500 فاتورة', 'فرعان و 5 مستخدمين', 'نقاط البيع POS + سندات القبض والصرف'],
    featuresEn: ['Up to 500 invoices', '2 Branches & 5 Users', 'POS + Receipt/Payment Vouchers'],
  },
  {
    id: 'pro',
    nameAr: 'الباقة الاحترافية (Pro)',
    nameEn: 'Pro Plan',
    monthlyPrice: 99,
    yearlyPrice: 950,
    maxUsers: 20,
    maxBranches: 10,
    maxInvoices: 5000,
    featuresAr: ['حتى 5,000 فاتورة', '10 فروع + 20 مستخدم', 'تحليلات AI + تعدد العملات + مزامنة Firebase'],
    featuresEn: ['Up to 5,000 invoices', '10 Branches & 20 Users', 'AI Analytics + Multi-Currency + Cloud Sync'],
  },
  {
    id: 'enterprise',
    nameAr: 'باقة المؤسسات (Enterprise)',
    nameEn: 'Enterprise Plan',
    monthlyPrice: 199,
    yearlyPrice: 1890,
    maxUsers: 999,
    maxBranches: 999,
    maxInvoices: 999999,
    featuresAr: ['فواتير وفروع ومستخدمون غير محدودين', 'صلاحيات مخصصة + سجل تدقيق متكامل', 'مدير حساب ودعم فوري على مدار الساعة'],
    featuresEn: ['Unlimited Invoices, Branches & Users', 'Granular RBAC + Full Audit Trail', 'Dedicated Account Manager & 24/7 Priority'],
  },
];

export const SubscriptionScreen: React.FC<ScreenProps> = ({ store }) => {
  const { state, metrics, actions } = store;
  const isAr = state.settings.isArabic;
  const cur = state.settings.currency;
  const t = strings[isAr ? 'ar' : 'en'];

  const meta: SubscriptionMeta = state.subscriptionMeta ?? {
    planId:
      state.activePlan === 'free'
        ? 'free'
        : state.activePlan.includes('basic')
        ? 'basic'
        : state.activePlan.includes('business') || state.activePlan.includes('enterprise')
        ? 'enterprise'
        : 'pro',
    billingCycle: 'yearly',
    startDate: (state.trialStartIso || new Date().toISOString()).slice(0, 10),
    endDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    status: 'active',
    paymentMethod: 'مدى / البطاقة الائتمانية',
    autoRenew: true,
  };

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(meta.billingCycle);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const activeSpec = PLANS.find((p) => p.id === meta.planId) ?? PLANS[2];
  const currentPrice = billingCycle === 'yearly' ? activeSpec.yearlyPrice : activeSpec.monthlyPrice;

  const usageStats = useMemo(
    () => [
      {
        label: isAr ? 'المستخدمون / الموظفون' : 'Users / Employees',
        used: state.employees.length,
        limit: activeSpec.maxUsers,
      },
      {
        label: isAr ? 'الفروع' : 'Branches',
        used: state.branches.length,
        limit: activeSpec.maxBranches,
      },
      {
        label: isAr ? 'الفواتير' : 'Invoices',
        used: state.invoices.length,
        limit: activeSpec.maxInvoices,
      },
    ],
    [state.employees.length, state.branches.length, state.invoices.length, activeSpec, isAr],
  );

  const activatePlanLocally = (plan: PlanSpec) => {
    const days = billingCycle === 'yearly' ? 365 : 30;
    const today = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    actions.setActivePlan(plan.id);
    actions.updateSubscriptionMeta({
      planId: plan.id,
      billingCycle,
      startDate: today,
      endDate,
      status: 'active',
    });
  };

  const selectPlan = async (plan: PlanSpec) => {
    if (plan.id === 'free') {
      activatePlanLocally(plan);
      actions.notify(isAr ? `تم تفعيل ${plan.nameAr}` : `Activated ${plan.nameEn}`);
      return;
    }
    setCheckoutBusy(true);
    try {
      const resp = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          billingCycle,
          customerEmail: state.settings.email,
        }),
      });
      const json = (await resp.json()) as {
        configured?: boolean;
        checkoutUrl?: string;
        messageAr?: string;
        messageEn?: string;
        error?: string;
      };
      if (json.configured && json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      activatePlanLocally(plan);
      actions.notify(
        (isAr ? json.messageAr : json.messageEn) ||
          (isAr
            ? `تم تفعيل ${plan.nameAr} محلياً (بوابة Stripe غير مهيأة على الخادم)`
            : `Activated ${plan.nameEn} locally (Stripe not configured on server)`),
      );
    } catch {
      activatePlanLocally(plan);
      actions.notify(isAr ? `تم تفعيل ${plan.nameAr} (${billingCycle === 'yearly' ? 'سنوي' : 'شهري'})` : `Activated ${plan.nameEn}`);
    } finally {
      setCheckoutBusy(false);
    }
  };

  const handleRenew = async () => {
    const spec = PLANS.find((p) => p.id === meta.planId) ?? PLANS[2];
    if (spec.id !== 'free') {
      setCheckoutBusy(true);
      try {
        const resp = await fetch('/api/subscriptions/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: spec.id,
            billingCycle,
            customerEmail: state.settings.email,
          }),
        });
        const json = (await resp.json()) as {
          configured?: boolean;
          checkoutUrl?: string;
          messageAr?: string;
          messageEn?: string;
        };
        if (json.configured && json.checkoutUrl) {
          window.location.href = json.checkoutUrl;
          return;
        }
      } catch {
        // Fallback to extending period locally when Stripe is unconfigured
      } finally {
        setCheckoutBusy(false);
      }
    }
    const baseMs = Math.max(Date.now(), new Date(meta.endDate || Date.now()).getTime());
    const days = billingCycle === 'yearly' ? 365 : 30;
    const nextEnd = new Date(baseMs + days * 86400000).toISOString().slice(0, 10);
    actions.updateSubscriptionMeta({
      billingCycle,
      endDate: nextEnd,
      status: 'active',
    });
    actions.notify(isAr ? `تم تجديد الاشتراك حتى ${nextEnd}` : `Subscription renewed through ${nextEnd}`);
  };

  const subVat = Number((currentPrice * 0.15).toFixed(2));
  const subTotalWithVat = Number((currentPrice + subVat).toFixed(2));
  const subQrPayload = buildZatcaTlvBase64(
    state.settings.companyName || 'أسطورة المحاسبة ERP',
    state.settings.taxNumber || '310000000000003',
    new Date().toISOString(),
    subTotalWithVat.toFixed(2),
    subVat.toFixed(2),
  );

  const statusBadgeClass =
    meta.status === 'active'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
      : meta.status === 'expired'
      ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
      : 'bg-rose-500/20 text-rose-300 border-rose-400/30';

  const statusLabel =
    meta.status === 'active'
      ? isAr ? 'نشط' : 'Active'
      : meta.status === 'expired'
      ? isAr ? 'منتهي' : 'Expired'
      : isAr ? 'ملغى' : 'Cancelled';

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Active Plan & Trial Summary Banner */}
      <div className="bg-[#0A3D2C] text-white rounded-[20px] p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-start">
          <div className="inline-flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-[#C9A227]" />
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadgeClass}`}>
              {statusLabel}
            </span>
          </div>
          <h2 className="text-xl font-extrabold">{isAr ? activeSpec.nameAr : activeSpec.nameEn}</h2>
          <p className="text-xs text-white/80 font-mono">
            {t.activePlan}: <span className="font-bold text-[#C9A227]">{state.activePlan}</span> ·{' '}
            {isAr ? 'البداية' : 'Start'}: {meta.startDate} · {isAr ? 'الانتهاء' : 'End'}: {meta.endDate}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="px-5 py-3 rounded-2xl bg-white/10 border border-white/15 text-center">
            <p className="text-[11px] text-white/75">{t.trialRemaining}</p>
            <p className="text-2xl font-extrabold text-[#C9A227] font-mono tabular-nums">
              {metrics.trialDaysRemaining} {t.days}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={checkoutBusy}
              onClick={() => void handleRenew()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#C9A227] text-slate-950 text-xs font-extrabold cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${checkoutBusy ? 'animate-spin' : ''}`} />
              <span>{isAr ? 'تجديد الاشتراك' : 'Renew Now'}</span>
            </button>
            <button
              type="button"
              onClick={() => setInvoiceModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isAr ? 'فاتورة الاشتراك الضريبية' : 'Tax Invoice'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Usage vs Plan Limits + Payment Preferences */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3.5">
          <h3 className="text-sm font-extrabold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C9A227]" />
            <span>{isAr ? 'الاستهلاك الفعلي مقارنة بحدود الباقة' : 'Live Usage vs Plan Limits'}</span>
          </h3>
          <div className="space-y-3">
            {usageStats.map((u) => {
              const unlimited = u.limit >= 999;
              const pct = unlimited ? Math.min(100, u.used > 0 ? 18 : 5) : Math.min(100, Math.round((u.used / Math.max(1, u.limit)) * 100));
              const warn = !unlimited && pct >= 85;
              return (
                <div key={u.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{u.label}</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {u.used} / {unlimited ? (isAr ? 'غير محدود' : 'Unlimited') : u.limit}
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-[#0A120F] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${warn ? 'bg-rose-500' : 'bg-[#0A3D2C] dark:bg-[#C9A227]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
          <h3 className="text-sm font-extrabold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
            <span>{isAr ? 'تفاصيل الفوترة والدفع' : 'Billing & Payment'}</span>
          </h3>
          <div>
            <label className="text-[11px] font-bold text-slate-500 block">{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
            <select
              value={meta.paymentMethod}
              onChange={(e) => actions.updateSubscriptionMeta({ paymentMethod: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
            >
              <option value="مدى / البطاقة الائتمانية">{isAr ? 'مدى / البطاقة الائتمانية' : 'Mada / Credit Card'}</option>
              <option value="تحويل بنكي">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
              <option value="Apple Pay">Apple Pay</option>
              <option value="STC Pay">STC Pay</option>
            </select>
          </div>
          <label className="flex items-center justify-between gap-2 pt-1 cursor-pointer text-xs font-bold">
            <span>{isAr ? 'تجديد تلقائي عند الانتهاء' : 'Auto-Renew Subscription'}</span>
            <input
              type="checkbox"
              checked={meta.autoRenew}
              onChange={(e) => {
                actions.updateSubscriptionMeta({ autoRenew: e.target.checked });
                actions.notify(isAr ? 'تم تحديث إعداد التجديد التلقائي' : 'Auto-renew preference updated');
              }}
              className="w-4 h-4 accent-[#0A3D2C] cursor-pointer"
            />
          </label>
          <div className="pt-2 border-t border-slate-100 dark:border-[#1F332B] flex gap-2">
            {meta.status === 'active' ? (
              <button
                type="button"
                onClick={() => {
                  actions.updateSubscriptionMeta({ status: 'cancelled', autoRenew: false });
                  actions.notify(isAr ? 'تم إلغاء التجديد التلقائي للاشتراك' : 'Subscription cancelled');
                }}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border border-rose-500/30 text-rose-600 text-xs font-bold cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{isAr ? 'إلغاء الاشتراك' : 'Cancel Plan'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRenew}
                className="flex-1 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إعادة التفعيل' : 'Reactivate'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-extrabold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#0A3D2C] dark:text-[#C9A227]" />
          <span>{isAr ? 'اختر الباقة المناسبة لمنشأتك' : 'Choose Your Plan'}</span>
        </h3>
        <div className="inline-flex p-1 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B]">
          <button
            type="button"
            onClick={() => {
              setBillingCycle('monthly');
              actions.updateSubscriptionMeta({ billingCycle: 'monthly' });
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              billingCycle === 'monthly' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {isAr ? 'شهري' : 'Monthly'}
          </button>
          <button
            type="button"
            onClick={() => {
              setBillingCycle('yearly');
              actions.updateSubscriptionMeta({ billingCycle: 'yearly' });
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 ${
              billingCycle === 'yearly' ? 'bg-[#0A3D2C] text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <span>{isAr ? 'سنوي' : 'Yearly'}</span>
            <span className="px-1.5 py-0.5 rounded bg-[#C9A227] text-slate-950 text-[10px] font-extrabold">
              -20%
            </span>
          </button>
        </div>
      </div>

      {/* 4 Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((p) => {
          const active = meta.planId === p.id && meta.status === 'active';
          const price = billingCycle === 'yearly' ? p.yearlyPrice : p.monthlyPrice;
          const features = isAr ? p.featuresAr : p.featuresEn;
          return (
            <div
              key={p.id}
              className={`bg-white dark:bg-[#121E19] rounded-[20px] p-5 flex flex-col justify-between gap-4 border-2 transition-all ${
                active
                  ? 'border-[#C9A227] shadow-lg'
                  : 'border-slate-200 dark:border-[#1F332B]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-extrabold text-sm">{isAr ? p.nameAr : p.nameEn}</h4>
                  {p.id === 'pro' && (
                    <span className="px-2 py-0.5 rounded-md bg-[#C9A227]/20 text-[#0A3D2C] dark:text-[#C9A227] text-[10px] font-extrabold">
                      {isAr ? 'الأكثر طلباً' : 'Popular'}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-extrabold text-[#0A3D2C] dark:text-[#C9A227] font-mono tabular-nums">
                  {price === 0 ? (isAr ? 'مجاني' : 'Free') : `${price} SAR`}
                  {price > 0 && (
                    <span className="text-xs font-normal text-slate-500">
                      {' '}
                      / {billingCycle === 'yearly' ? (isAr ? 'سنة' : 'yr') : isAr ? 'شهر' : 'mo'}
                    </span>
                  )}
                </p>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                disabled={checkoutBusy}
                onClick={() => void selectPlan(p)}
                className={`w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer disabled:opacity-60 ${
                  active ? 'bg-[#C9A227] text-slate-950' : 'bg-[#0A3D2C] text-white'
                }`}
              >
                {active ? t.activePlan : t.subscribe}
              </button>
            </div>
          );
        })}
      </div>

      {/* Printable Subscription Tax Invoice Modal */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-lg w-full p-6 space-y-4">
            <div className="no-print flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                {isAr ? 'فاتورة اشتراك ضريبية (ZATCA)' : 'Subscription Tax Invoice'}
              </h3>
              <button type="button" onClick={() => setInvoiceModalOpen(false)} className="p-1.5 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1F332B] space-y-3 text-xs bg-slate-50/60 dark:bg-[#0A120F]">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-[#1F332B] pb-3">
                <div>
                  <p className="text-sm font-extrabold text-[#0A3D2C] dark:text-[#C9A227]">
                    {isAr ? 'منصة أسطورة المحاسبة ERP' : 'Ostora Accounting ERP'}
                  </p>
                  <p className="text-slate-500">{isAr ? 'العميل:' : 'Subscriber:'} {state.settings.companyName}</p>
                  <p className="text-slate-500 font-mono">VAT: {state.settings.taxNumber || '310000000000003'}</p>
                </div>
                <QrMatrix data={subQrPayload} size={76} />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">{isAr ? 'الباقة:' : 'Plan:'}</span>
                  <span className="font-bold">{isAr ? activeSpec.nameAr : activeSpec.nameEn} ({meta.billingCycle})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{isAr ? 'فترة الاشتراك:' : 'Period:'}</span>
                  <span className="font-mono">{meta.startDate} → {meta.endDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{isAr ? 'طريقة الدفع:' : 'Payment:'}</span>
                  <span className="font-bold">{meta.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.subtotal}:</span>
                  <span className="font-mono">{formatCurrency(currentPrice, cur, { isAr })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.vat15}:</span>
                  <span className="font-mono">{formatCurrency(subVat, cur, { isAr })}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-[#1F332B] text-sm font-extrabold text-[#0A3D2C] dark:text-[#C9A227]">
                  <span>{t.total}:</span>
                  <span className="font-mono">{formatCurrency(subTotalWithVat, cur, { isAr })}</span>
                </div>
              </div>
            </div>

            <div className="no-print flex gap-2">
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
              <button
                type="button"
                onClick={() => {
                  actions.logAuditEvent('print', 'Subscription', meta.planId, 'طباعة فاتورة اشتراك ضريبية', {
                    screenName: 'الاشتراك',
                  });
                  window.print();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{t.printPdf}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
