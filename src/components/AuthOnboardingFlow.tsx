import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  KeyRound,
  Languages,
  LogOut,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { getLocaleStrings } from '../data/translations';
import { LanguageCode } from '../types/erp';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';
import appIconImg from '../assets/images/ostora_app_icon_1794578215972.jpg';

interface AuthOnboardingFlowProps {
  isAr: boolean;
  language?: LanguageCode;
  onboardingSeen: boolean;
  onToggleLanguage: () => void;
  onSelectLanguage?: (lang: LanguageCode) => void;
  onFinishOnboarding: () => void;
  onLoginSuccess: () => void;
  onRestoreBackupJson: (raw: string) => void;
  onRestoreAutosave: () => boolean;
}

export const AuthOnboardingFlow: React.FC<AuthOnboardingFlowProps> = ({
  isAr,
  language,
  onboardingSeen,
  onToggleLanguage,
  onSelectLanguage,
  onFinishOnboarding,
  onLoginSuccess,
  onRestoreBackupJson,
  onRestoreAutosave,
}) => {
  const t = getLocaleStrings(language ?? (isAr ? 'ar' : 'en'));
  const {
    user,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    resendVerificationEmail,
    reloadAuthUser,
    signOutFirebase,
    signingIn,
    authError,
    setAuthError,
  } = useFirebase();
  const [showSplash, setShowSplash] = useState(true);
  const [slide, setSlide] = useState(0);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [restoreMsg, setRestoreMsg] = useState('');
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 750);
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
        title: isAr ? 'محاسبة ذكية بدقة دولية' : 'Global Precision Accounting',
        desc: isAr
          ? 'فواتير ضريبية متوافقة مع الزكاة والدخل ZATCA المرحلة الثانية، تعدد عملات تلقائي، وقيود يومية مزدوجة بدون إنترنت.'
          : 'ZATCA Phase 2 UBL XML invoices, live multi-currency FX, and double-entry journals 100% offline.',
      },
      {
        title: isAr ? 'رقابة كاملة على المخزون والصلاحيات' : 'Inventory Barcodes & Team Roles',
        desc: isAr
          ? 'صور المنتجات والباركود، مصفوفة صلاحيات حقيقية بدعوات الفريق، وأوامر شراء وتنبيهات تلقائية.'
          : 'Product photos & EAN-13 barcodes, verified team invite RBAC, and automated alerts.',
      },
      {
        title: isAr ? 'تحليلات AI ونسخ احتياطي سحابي' : 'AI Analytics & Cloud Backup',
        desc: isAr
          ? 'مؤشر الصحة المالية، توقعات Gemini الذكية، ونسخ احتياطي يومي مشفر على السحابة.'
          : 'Financial Health Score, Gemini AI analytics, and encrypted cloud backup & restore.',
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

  // Email verification barrier when signed in with unverified email/password
  if (user && !user.emailVerified) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-[#F6F7F5] dark:bg-[#0A120F]">
        <div className="max-w-md w-full bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-7 space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 mx-auto flex items-center justify-center text-amber-700 dark:text-amber-300">
            <MailCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold">
            {isAr ? 'تأكيد البريد الإلكتروني مطلوب' : 'Email Verification Required'}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {isAr
              ? `أرسلنا رابط تفعيل إلى (${user.email}). يرجى فتح بريدك والضغط على الرابط، ثم تحديث الحالة للدخول الآمن والمزامنة مع السحابة.`
              : `We sent a verification link to (${user.email}). Please verify your email address, then refresh your status to unlock cloud sync.`}
          </p>

          {infoMsg && (
            <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{infoMsg}</span>
            </div>
          )}
          {authError && <p className="text-xs text-red-600 font-semibold">{authError}</p>}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={async () => {
                setAuthError(null);
                setInfoMsg('');
                const refreshed = await reloadAuthUser();
                if (refreshed?.emailVerified) {
                  onLoginSuccess();
                } else {
                  setInfoMsg(
                    isAr
                      ? 'لم يتم التحقق بعد — تأكد من الضغط على الرابط في بريدك الإلكتروني.'
                      : 'Not verified yet — please click the link in your inbox.',
                  );
                }
              }}
              className="w-full py-3 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{isAr ? 'تم التحقق - تحديث الحالة' : 'Verified — Refresh Status'}</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                setAuthError(null);
                const ok = await resendVerificationEmail();
                if (ok) {
                  setInfoMsg(isAr ? 'تمت إعادة إرسال رابط التحقق إلى بريدك' : 'Verification link resent to your email');
                }
              }}
              className="w-full py-2.5 rounded-xl border border-[#0A3D2C]/30 text-[#0A3D2C] dark:text-[#C9A227] font-bold text-xs cursor-pointer"
            >
              {isAr ? 'إعادة إرسال رابط التحقق' : 'Resend Verification Email'}
            </button>

            <button
              type="button"
              onClick={async () => {
                setInfoMsg('');
                setAuthError(null);
                await signOutFirebase();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-[#0A120F] text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isAr ? 'تسجيل الخروج واستخدام حساب آخر' : 'Sign Out & Switch Account'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-[#F6F7F5] dark:bg-[#0A120F]">
      <div className="max-w-md w-full bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-7 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-500">Ostora Systems</span>
          {onSelectLanguage ? (
            <select
              value={language ?? (isAr ? 'ar' : 'en')}
              onChange={(e) => onSelectLanguage(e.target.value as LanguageCode)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#0A120F] text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] outline-none cursor-pointer"
              aria-label="Language"
            >
              <option value="ar">العربية (RTL)</option>
              <option value="en">English (LTR)</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="tr">Türkçe</option>
              <option value="ur">اردو (RTL)</option>
            </select>
          ) : (
            <button
              onClick={onToggleLanguage}
              className="flex items-center gap-1.5 text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] cursor-pointer"
            >
              <Languages className="w-4 h-4" />
              <span>{isAr ? 'عربي | EN' : 'EN | عربي'}</span>
            </button>
          )}
        </div>

        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-[#0A3D2C] mx-auto flex items-center justify-center text-3xl">
            🛡️
          </div>
          <h1 className="text-2xl font-extrabold">{t.appName}</h1>
          <p className="text-xs text-slate-500">
            {isRegister
              ? isAr
                ? 'إنشاء حساب موثق عبر Firebase Auth'
                : 'Create Verified Firebase Account'
              : isAr
              ? 'تسجيل الدخول الآمن بالبريد وكلمة المرور أو Google'
              : 'Secure Sign In with Email or Google'}
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setInfoMsg('');
            setAuthError(null);
            if (isRegister) {
              const createdUser = await registerWithEmail(name, email, password);
              if (createdUser) {
                if (createdUser.emailVerified) {
                  onLoginSuccess();
                } else {
                  setInfoMsg(
                    isAr
                      ? 'تم إنشاء الحساب وإرسال رابط التفعيل لبريدك الإلكتروني'
                      : 'Account created! Verification email sent.',
                  );
                }
              }
            } else {
              const signedUser = await signInWithEmail(email, password);
              if (signedUser && signedUser.emailVerified) {
                onLoginSuccess();
              }
            }
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.password}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />

          {!isRegister && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={signingIn}
                onClick={async () => {
                  setInfoMsg('');
                  const sent = await sendPasswordReset(email);
                  if (sent) {
                    setInfoMsg(
                      isAr
                        ? 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.'
                        : 'Password reset link sent to your email.',
                    );
                  }
                }}
                className="text-xs font-bold text-[#0A3D2C] dark:text-[#C9A227] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</span>
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={signingIn}
            className="w-full py-3.5 rounded-xl bg-[#0A3D2C] text-white font-bold text-sm hover:opacity-95 cursor-pointer disabled:opacity-60"
          >
            {signingIn
              ? isAr
                ? 'جاري التحقق من الحساب...'
                : 'Authenticating...'
              : isRegister
              ? t.register
              : t.login}
          </button>
        </form>

        <button
          type="button"
          disabled={signingIn}
          onClick={async () => {
            setInfoMsg('');
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

        {infoMsg && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300 text-center font-bold">{infoMsg}</p>
        )}
        {authError && (
          <p className="text-xs text-red-600 text-center font-semibold">{authError}</p>
        )}

        {/* Restore from Backup on New Device */}
        <div className="pt-2 border-t border-slate-100 dark:border-[#1F332B] space-y-2">
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
          onClick={() => {
            setAuthError(null);
            setInfoMsg('');
            setIsRegister(!isRegister);
          }}
          className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          {isRegister
            ? isAr
              ? 'لديك حساب بالفعل؟ تسجيل الدخول'
              : 'Already have an account? Sign In'
            : isAr
            ? 'ليس لديك حساب؟ إنشاء حساب جديد'
            : 'New user? Create an account'}
        </button>

        <div className="pt-2 border-t border-slate-100 dark:border-[#1F332B] flex items-center justify-center">
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0A3D2C] dark:text-[#C9A227] hover:underline cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isAr ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy Policy & Data Protection'}</span>
          </button>
        </div>
      </div>

      <PrivacyPolicyModal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        isAr={isAr}
      />
    </div>
  );
};
