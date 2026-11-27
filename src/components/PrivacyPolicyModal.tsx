import React from 'react';
import { Lock, ShieldCheck, X } from 'lucide-react';

interface PrivacyPolicyContentProps {
  isAr: boolean;
  companyName?: string;
}

export const PrivacyPolicyContent: React.FC<PrivacyPolicyContentProps> = ({ isAr, companyName }) => {
  const sections = isAr
    ? [
        {
          title: '1. البيانات التي يعالجها النظام والغرض منها',
          body: 'يعالج نظام أسطورة المحاسبة العالمية بيانات المنشأة (اسم المنشأة، الرقم الضريبي، السجل التجاري، العنوان)، والفواتير وسندات القبض والصرف، وبيانات العملاء والموردين والموظفين (باستثناء كلمات المرور)، وأرصدة البنوك والمخزون حصراً لإدارة العمليات المحاسبية وإصدار التقارير المالية والفواتير المتوافقة مع هيئة الزكاة والضريبة والجمارك (ZATCA).',
        },
        {
          title: '2. التخزين المحلي والمزامنة السحابية الآمنة',
          body: 'يعمل التطبيق بنظام Offline-First عبر تخزين البيانات محلياً في IndexedDB وذاكرة المتصفح/الجهاز لضمان الاستمرارية دون إنترنت، وتُزامن البيانات المشفرة عبر بروتوكول HTTPS مع Firebase Cloud Firestore وفق قواعد أمان صارمة (firestore.rules) تعزل كل مساحة عمل ولا تسمح بالوصول إلا للمستخدمين المصرح لهم.',
        },
        {
          title: '3. المصادقة وصلاحيات الموظفين (عدم تخزين كلمات المرور)',
          body: 'تتم المصادقة عبر Firebase Authentication مع التحقق من البريد الإلكتروني. لا يقوم النظام مطلقاً بتخزين كلمات مرور الموظفين أو عرضها داخل قاعدة البيانات أو التخزين المحلي؛ بل يستخدم كل عضو حسابه الموثق وصلاحياته المعتمدة من الخادم.',
        },
        {
          title: '4. سجل التدقيق والاحتفاظ بالسجلات الضريبية',
          body: 'يحتفظ النظام بسجل تدقيق غير قابل للتعديل أو الحذف لتوثيق الحركات المالية، بالإضافة إلى بيانات الفوترة الإلكترونية (UUID وICV وPIH وتوقيع Hash/ECDSA) للامتثال لمتطلبات المرحلة الأولى والثانية من الفوترة الإلكترونية.',
        },
        {
          title: '5. حقوق المستخدم والتحكم بالبيانات والتواصل',
          body: `يحق لمالك الحساب تصدير كافة بياناته بصيغ JSON أو Excel أو PDF في أي وقت، أو طلب حذف بيانات مساحة العمل من شاشة الإعدادات. للاستفسارات المتعلقة بالخصوصية أو الأمان${companyName ? ` (${companyName})` : ''}، يرجى التواصل عبر البريد: alnwmbshyr1@gmail.com.`,
        },
      ]
    : [
        {
          title: '1. Data Processed & Accounting Purpose',
          body: 'Global Accounting Legend processes company profile details (company name, VAT/Tax ID, CR number, address), tax invoices, vouchers, customer/supplier ledgers, employee payroll records (excluding passwords), inventory, and bank/cash balances strictly for ERP accounting, financial reporting, and ZATCA e-invoicing compliance.',
        },
        {
          title: '2. Offline-First Local Storage & Cloud Security',
          body: 'The platform persists operational data locally in IndexedDB/SQLite for uninterrupted offline operation and syncs over TLS/HTTPS to Firebase Cloud Firestore protected by strict workspace-scoped security rules (firestore.rules) ensuring tenant isolation.',
        },
        {
          title: '3. Authentication & Zero Plaintext Employee Passwords',
          body: 'User authentication is handled securely via Firebase Authentication with email verification. The application never stores, logs, or transmits employee passwords inside Firestore or local storage; team members sign in with their own verified accounts and server-enforced roles.',
        },
        {
          title: '4. Audit Trail & E-Invoicing Retention',
          body: 'All financial actions are recorded in an immutable audit log alongside ZATCA Phase 1 & 2 metadata (UUID, ICV, PIH, SHA-256 Hash, ECDSA signature) to preserve tax audit integrity.',
        },
        {
          title: '5. User Rights, Data Portability & Contact',
          body: `Account owners may export all workspace records (JSON, Excel, PDF) or clear local/cloud workspace data at any time via Settings. For privacy or security inquiries${companyName ? ` (${companyName})` : ''}, contact: alnwmbshyr1@gmail.com.`,
        },
      ];

  return (
    <div className="space-y-3 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      {sections.map((sec) => (
        <div
          key={sec.title}
          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] space-y-1"
        >
          <h4 className="font-extrabold text-[#0A3D2C] dark:text-[#C9A227]">{sec.title}</h4>
          <p>{sec.body}</p>
        </div>
      ))}
    </div>
  );
};

interface PrivacyPolicyModalProps {
  open: boolean;
  onClose: () => void;
  isAr: boolean;
  companyName?: string;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  open,
  onClose,
  isAr,
  companyName,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-100 dark:border-[#1F332B] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0A3D2C]/10 dark:bg-[#C9A227]/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">
                {isAr ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy Policy & Data Protection'}
              </h3>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>
                  {isAr ? 'أسطورة المحاسبة العالمية · Ostora Systems' : 'Global Accounting Legend · Ostora Systems'}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1F332B] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <PrivacyPolicyContent isAr={isAr} companyName={companyName} />
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-[#1F332B] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-extrabold cursor-pointer hover:opacity-95"
          >
            {isAr ? 'فهمت · إغلاق' : 'Understood · Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
