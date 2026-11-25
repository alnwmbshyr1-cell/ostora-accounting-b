import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Cloud, Flashlight, Languages, ShieldCheck, Upload } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { strings } from '../data/translations';
import { RoleId } from '../types/erp';
import appIconImg from '../assets/images/ostora_app_icon_1794578215972.jpg';

interface AuthOnboardingFlowProps {
  isAr: boolean;
  onboardingSeen: boolean;
  currentRole: RoleId;
  onToggleLanguage: () => void;
  onFinishOnboarding: () => void;
  onSelectRole: (role: RoleId) => void;
  onLoginSuccess: () => void;
  onRestoreBackupJson: (raw: string) => void;
  onRestoreAutosave: () => boolean;
}

export const AuthOnboardingFlow: React.FC<AuthOnboardingFlowProps> = ({
  isAr,
  onboardingSeen,
  currentRole,
  onToggleLanguage,
  onFinishOnboarding,
  onSelectRole,
  onLoginSuccess,
  onRestoreBackupJson,
  onRestoreAutosave,
}) => {
  const t = strings[isAr ? 'ar' : 'en'];
  const { signInWithGoogle, signingIn, authError } = useFirebase();
  const [showSplash, setShowSplash] = useState(true);
  const [slide, setSlide] = useState(0);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restoreMsg, setRestoreMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 900);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <div className="min-h-dvh bg-[#0A3D2C] flex flex-col items-center justify-center p-6 text-white">
        <div className="w-28 h-28 rounded-[28px] border-2 border-[#C9A227] overflow-hidden shadow-2xl mb-6">
          <img
            src={appIconImg}
            alt="Ostora Shield"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{t.appName}</h1>
        <p className="text-sm text-[#C9A227] font-semibold mt-2">
          🛡️ Legend of Accounting · Ostora Systems
        </p>
      </div>
    );
  }

  if (!onboardingSeen) {
    const slides = [
      {
        title: isAr ? 'محاسبة ذكية بضغطة زر' : 'Smart Accounting in Your Pocket',
        desc: isAr
          ? 'فواتير ضريبية متوافقة مع الزكاة والدخل، مرتجعات، عروض أسعار، وقيود يومية بدون إنترنت.'
          : 'ZATCA-ready tax invoices, returns, quotations, and double-entry journals 100% offline.',
      },
      {
        title: isAr ? 'رقابة كاملة على المخزون والصلاحيات' : 'Inventory Barcodes & Team Roles',
        desc: isAr
          ? 'صور المنتجات والباركود، مصفوفة صلاحيات للموظفين، وأوامر شراء وتنبيهات تلقائية.'
          : 'Product photos & EAN-13 barcodes, role-based access control, and automated alerts.',
      },
      {
        title: isAr ? 'تحليلات وتنبؤات ونسخ احتياطي' : 'AI Analytics & Cloud Backup',
        desc: isAr
          ? 'مؤشر الصحة المالية، توقعات الإيرادات لـ 6 أشهر، ونسخ احتياطي يومي آمن.'
          : 'Financial Health Score, 6-month revenue forecast, and one-tap backup & restore.',
      },
    ];

    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-[#F6F7F5] dark:bg-[#0A120F]">
        <div className="max-w-md w-full bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-7 space-y-8">
          <div className="flex items-center justify-between">
            <button
              onClick={onToggleLanguage}
              className="flex items-center gap-1.5 text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer"
            >
              <Languages className="w-4 h-4" />
              <span>{isAr ? 'عربي | EN' : 'EN | عربي'}</span>
            </button>
            <button
              onClick={onFinishOnboarding}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
            >
              {t.skip}
            </button>
          </div>

          <div className="text-center space-y-4 py-6">
            <div className="w-20 h-20 rounded-3xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-10 h-10 text-[#0A3D2C] dark:text-[#C9A227]" />
            </div>
            <h2 className="text-2xl font-extrabold">{slides[slide].title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {slides[slide].desc}
            </p>
          </div>

          <div className="flex justify-center gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSlide(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  slide === idx ? 'w-7 bg-[#0A3D2C] dark:bg-[#C9A227]' : 'w-2 bg-slate-300 dark:bg-slate-700'
                }`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              if (slide < 2) setSlide(slide + 1);
              else onFinishOnboarding();
            }}
            className="w-full py-3.5 rounded-2xl bg-[#0A3D2C] text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer"
          >
            <span>{slide < 2 ? t.next : t.startNow}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const roles: { id: RoleId; label: string }[] = [
    { id: 'owner', label: t.roleOwner },
    { id: 'accountant', label: t.roleAccountant },
    { id: 'salesman', label: t.roleSalesman },
    { id: 'warehouse', label: t.roleWarehouse },
  ];

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-[#F6F7F5] dark:bg-[#0A120F]">
      <div className="max-w-md w-full bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-7 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">Ostora Systems</span>
          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer"
          >
            <Languages className="w-4 h-4" />
            <span>{isAr ? 'عربي | EN' : 'EN | عربي'}</span>
          </button>
        </div>

        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-[#0A3D2C] mx-auto flex items-center justify-center text-3xl">
            🛡️
          </div>
          <h1 className="text-2xl font-extrabold">{t.appName}</h1>
          <p className="text-xs text-slate-500">{isRegister ? t.register : t.login}</p>
        </div>

        {/* Login As Role Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500">{t.loginAs}</label>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectRole(r.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  currentRole === r.id
                    ? 'bg-[#0A3D2C] text-white border-[#0A3D2C]'
                    : 'bg-slate-50 dark:bg-[#0A120F] border-slate-200 dark:border-[#1F332B] text-slate-700 dark:text-slate-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email && password.length >= 4) onLoginSuccess();
          }}
          className="space-y-3"
        >
          {isRegister && (
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.fullName}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.email}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
          <input
            type="password"
            required
            minLength={4}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.password}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm hover:opacity-95 cursor-pointer"
          >
            {isRegister ? t.register : t.login}
          </button>
        </form>

        <button
          type="button"
          disabled={signingIn}
          onClick={async () => {
            const signedInUser = await signInWithGoogle();
            if (signedInUser) {
              onLoginSuccess();
            }
          }}
          className="w-full py-3 rounded-xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 border border-[#0A3D2C]/30 dark:border-[#C9A227]/40 text-[#0A3D2C] dark:text-[#C9A227] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#0A3D2C]/15 cursor-pointer disabled:opacity-60"
        >
          <Cloud className="w-4 h-4" />
          <span>{signingIn ? (isAr ? 'جاري الاتصال بـ Google...' : 'Signing in with Google...') : t.googleLogin}</span>
        </button>

        {authError && (
          <p className="text-xs text-red-600 text-center font-semibold">{authError}</p>
        )}

        <button
          onClick={onLoginSuccess}
          className="w-full py-3 rounded-xl border-2 border-[#C9A227] text-[#0A3D2C] dark:text-[#C9A227] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#C9A227]/10 cursor-pointer"
        >
          <Flashlight className="w-4 h-4" />
          <span>{t.demoLogin} ({roles.find((r) => r.id === currentRole)?.label})</span>
        </button>

        {/* Restore from Backup on New Device */}
        <div className="pt-1 border-t border-slate-100 dark:border-[#1F332B] space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-[#1A2C24] cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
              <span>{t.restoreFromBackup}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const ok = onRestoreAutosave();
                if (!ok) {
                  setRestoreMsg(isAr ? 'لا توجد نسخة تلقائية محفوظة' : 'No autosave snapshot found');
                }
              }}
              className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-[#0A120F] text-xs font-bold cursor-pointer"
            >
              Autosave
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              f.text().then((raw) => {
                onRestoreBackupJson(raw);
                onLoginSuccess();
              });
            }}
          />
          {restoreMsg && <p className="text-xs text-amber-600 text-center font-bold">{restoreMsg}</p>}
        </div>

        <button
          onClick={() => setIsRegister(!isRegister)}
          className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          {isRegister ? t.login : t.register}
        </button>
      </div>
    </div>
  );
};
