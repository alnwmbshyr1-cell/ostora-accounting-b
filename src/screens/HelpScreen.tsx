import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  ImagePlus,
  MessageCircle,
  PlayCircle,
  Printer,
  Search,
  Send,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react';
import { strings } from '../data/translations';
import { RouteId, SupportTicket } from '../types/erp';
import { compressImageToBase64 } from '../utils/image';
import { buildWhatsAppLink } from '../utils/messaging';
import { ScreenProps } from './types';

interface VideoTutorial {
  id: string;
  duration: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  route: RouteId;
  chaptersAr: string[];
  chaptersEn: string[];
}

const VIDEO_TUTORIALS: VideoTutorial[] = [
  {
    id: 'vid_pos',
    duration: '03:45',
    titleAr: 'دورة الكاشير ونقاط البيع السريعة POS',
    titleEn: 'Fast POS & Shift Closing Walkthrough',
    descAr: 'فتح الدرج، مسح الباركود، تعليق الفواتير، والطباعة الحرارية 80mm.',
    descEn: 'Cash drawer opening, barcode scan, hold/resume cart, and 80mm thermal print.',
    route: 'pos',
    chaptersAr: [
      '00:00 — فتح وردية الكاشير وإدخال رصيد الافتتاح',
      '01:10 — البحث بالباركود وتطبيق خصم الكاشير',
      '02:25 — الدفع المختلط أو الآجل وإصدار فاتورة ZATCA',
      '03:10 — إغلاق الوردية ومطابقة النقد الفعلي',
    ],
    chaptersEn: [
      '00:00 — Open cashier shift & enter opening cash',
      '01:10 — Scan barcode & apply cashier discount',
      '02:25 — Checkout & thermal receipt printing',
      '03:10 — Close shift & cash variance reconciliation',
    ],
  },
  {
    id: 'vid_acc',
    duration: '04:20',
    titleAr: 'القيود المزدوجة التلقائية وتعدد العملات',
    titleEn: 'Automated Double-Entry & Multi-Currency FX',
    descAr: 'كيف يسجل النظام قيود المبيعات والمشتريات والمصروفات مع فروق العملة.',
    descEn: 'How the ERP posts balanced journals across sales, purchases, expenses & FX.',
    route: 'journals',
    chaptersAr: [
      '00:00 — استعراض شجرة الحسابات 5 مستويات',
      '01:15 — إعداد العملة الأساسية وأسعار الصرف التلقائية',
      '02:40 — توليد القيود التلقائية وميزان المراجعة',
      '03:45 — قفل الفترة المالية لمنع أي تعديل رجعي',
    ],
    chaptersEn: [
      '00:00 — Chart of Accounts hierarchy overview',
      '01:15 — Setting base currency & live FX updates',
      '02:40 — Automated journal posting & trial balance',
      '03:45 — Fiscal lock enforcement for closed periods',
    ],
  },
  {
    id: 'vid_inv',
    duration: '03:15',
    titleAr: 'إدارة المخزون، المستودعات، والجرد السنوي',
    titleEn: 'Inventory, Multi-Warehouse & Stocktake Guide',
    descAr: 'التحويل بين المستودعات، تنبيهات الصلاحية، واعتماد فائض/عجز الجرد.',
    descEn: 'Warehouse transfers, expiry alerts, and automatic variance journal entries.',
    route: 'warehouses',
    chaptersAr: [
      '00:00 — إنشاء المستودعات وربطها بالفروع',
      '01:05 — التحويل المخزني بين المستودعات',
      '02:10 — الجرد الفعلي وتسوية الفروقات تلقائياً',
    ],
    chaptersEn: [
      '00:00 — Creating warehouses & linking branches',
      '01:05 — Inter-warehouse stock transfers',
      '02:10 — Physical stocktake & auto variance posting',
    ],
  },
];

const FAQS = [
  {
    id: 'faq1',
    qAr: 'هل يعمل التطبيق بالكامل بدون اتصال إنترنت؟',
    qEn: 'Does the application work 100% offline?',
    aAr: 'نعم، جميع البيانات والعمليات تُحفظ محلياً في IndexedDB وذاكرة المتصفح ومع تفعيل Firebase Offline Persistence تتم المزامنة تلقائياً دون تكرار فور عودة الإنترنت.',
    aEn: 'Yes. All records persist locally in IndexedDB and sync automatically without duplicates via Firebase Offline Persistence once online.',
  },
  {
    id: 'faq2',
    qAr: 'كيف يتجنب النظام أخطاء الفواصل العشرية (0.01)؟',
    qEn: 'How does the ERP prevent 0.01 floating-point rounding bugs?',
    aAr: 'جميع الحسابات المالية والضرائب وأسعار الصرف في طبقة Domain تُحسب بأعداد صحيحة بالهللة (Int Halalas) قبل العرض النهائي.',
    aEn: 'All financial calculations, VAT, and FX conversions run in exact integer Halalas inside the Domain layer.',
  },
  {
    id: 'faq3',
    qAr: 'كيف أفعل التحديث التلقائي لأسعار الصرف؟',
    qEn: 'How do I enable automatic exchange rate updates?',
    aAr: 'من شاشة الإعدادات > قسم تعدد العملات، فعّل خيار "تحديث أسعار الصرف تلقائياً" واختر العملات الثانوية، ليتم تحديث الأسعار تلقائياً في الفواتير والمصروفات.',
    aEn: 'Go to Settings > Multi-Currency, enable Auto-Update Exchange Rates, and pick secondary currencies.',
  },
  {
    id: 'faq4',
    qAr: 'ماذا يحدث عند تجاوز العميل للحد الائتماني؟',
    qEn: 'What happens when a customer exceeds their credit limit?',
    aAr: 'يمنع النظام حفظ الفاتورة الآجلة التي تتجاوز الحد الائتماني المسجل للعميل حفاظاً على السيولة، مع عرض المتاح من الحد.',
    aEn: 'The ERP blocks new credit invoices that exceed the configured customer credit limit and displays remaining headroom.',
  },
];

export const HelpScreen: React.FC<ScreenProps> = ({ store, onNavigate }) => {
  const { state, actions } = store;
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];

  const [helpSearch, setHelpSearch] = useState('');
  const [openHelpId, setOpenHelpId] = useState<string>('h1');
  const [openFaqId, setOpenFaqId] = useState<string>('faq1');
  const [activeVideo, setActiveVideo] = useState<VideoTutorial | null>(null);

  // Support ticket state
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketShot, setTicketShot] = useState<string | undefined>(undefined);
  const [ticketError, setTicketError] = useState('');
  const shotInputRef = useRef<HTMLInputElement>(null);

  const guides: {
    id: string;
    titleAr: string;
    titleEn: string;
    route: RouteId;
    stepsAr: string[];
    stepsEn: string[];
  }[] = [
    {
      id: 'h1',
      titleAr: 'كيفية إنشاء فاتورة ضريبية جديدة',
      titleEn: 'How to Create a Tax Invoice',
      route: 'invoices',
      stepsAr: [
        '1. افتح شاشة الفواتير من القائمة الجانبية أو السفلية.',
        '2. اضغط على زر "إضافة فاتورة" واختر العميل والأصناف.',
        '3. يتم احتساب ضريبة القيمة المضافة 15% والإجمالي تلقائياً.',
        '4. اختر الحالة (مدفوعة / معلقة) واضغط حفظ، ثم اطبع PDF مع رمز QR.',
      ],
      stepsEn: [
        '1. Open Invoices from the sidebar or bottom tab bar.',
        '2. Tap "Add Invoice" and choose the client and product lines.',
        '3. 15% VAT and final Total are calculated automatically.',
        '4. Select status (Paid/Pending), Save, and print the ZATCA QR PDF.',
      ],
    },
    {
      id: 'h2',
      titleAr: 'كيفية إضافة عميل ومتابعة ديونه',
      titleEn: 'How to Add a Customer & Track Debt',
      route: 'customers',
      stepsAr: [
        '1. انتقل إلى شاشة العملاء واضغط "إضافة عميل".',
        '2. أدخل الاسم ورقم الجوال (يتم تنسيق 966 تلقائياً للواتساب).',
        '3. استخدم زر "تذكير واتساب" أو أنشئ "سند قبض" بضغطة واحدة.',
      ],
      stepsEn: [
        '1. Navigate to Customers and tap "Add Customer".',
        '2. Enter name, phone (966 normalized automatically for WhatsApp), and balance.',
        '3. Send a WhatsApp Reminder or create a Receipt Voucher in one click.',
      ],
    },
    {
      id: 'h3',
      titleAr: 'كيفية تسجيل سند قبض أو صرف',
      titleEn: 'How to Record a Payment or Receipt Voucher',
      route: 'vouchers',
      stepsAr: [
        '1. افتح شاشة السندات واختر تبويب "سند قبض" أو "سند صرف".',
        '2. اضغط "إضافة سند" واكتب اسم الطرف والمبلغ والبيان.',
        '3. عند الحفظ يتم خصم المبلغ تلقائياً من مديونية العميل.',
      ],
      stepsEn: [
        '1. Open Vouchers and select Receipt or Payment.',
        '2. Tap "Add Voucher" and enter party name, amount, and reason.',
        '3. Saving a receipt automatically reduces the customer debt.',
      ],
    },
    {
      id: 'h4',
      titleAr: 'كيفية طباعة فاتورة ZATCA برمز QR',
      titleEn: 'How to Print a ZATCA QR Invoice',
      route: 'invoices',
      stepsAr: [
        '1. تأكد من إدخال اسم المنشأة والرقم الضريبي في الإعدادات.',
        '2. في بطاقة الفاتورة اضغط زر "طباعة PDF".',
        '3. ستظهر معاينة A4 تشمل رمز QR المشفر TLV والضريبة والتوقيعات.',
      ],
      stepsEn: [
        '1. Ensure Company Name & Tax Number are filled in Settings.',
        '2. Tap "Print PDF" on any invoice card.',
        '3. Use the A4 preview with ZATCA TLV QR code to print or save PDF.',
      ],
    },
    {
      id: 'h5',
      titleAr: 'كيفية إرسال تذكير واتساب للعميل',
      titleEn: 'How to Send a WhatsApp Reminder',
      route: 'customers',
      stepsAr: [
        '1. من شاشة العملاء اضغط زر "تذكير واتساب" أسفل بطاقة العميل.',
        '2. يفتح التطبيق رسالة عربية/إنجليزية جاهزة برقم العميل والمبلغ المستحق.',
      ],
      stepsEn: [
        '1. On Customers screen, tap "WhatsApp Reminder" under any customer.',
        '2. Opens wa.me/966... with a ready bilingual balance reminder message.',
      ],
    },
    {
      id: 'h6',
      titleAr: 'كيفية إضافة مرتجع مبيعات أو مشتريات',
      titleEn: 'How to Add a Sales or Purchase Return',
      route: 'returns',
      stepsAr: [
        '1. افتح شاشة المرتجعات واختر مبيعات أو مشتريات.',
        '2. حدد الفاتورة الأصلية والصنف والكمية (بحد أقصى الكمية الأصلية).',
        '3. يتم تحديث المخزون والذمم وإنشاء قيد محاسبي وإشعار دائن PDF تلقائياً.',
      ],
      stepsEn: [
        '1. Open Returns and switch between Sales Returns and Purchase Returns.',
        '2. Pick original invoice/PO, product, quantity, and reason.',
        '3. Stock, party debt, Journal Entry, and Credit Note PDF update automatically.',
      ],
    },
    {
      id: 'h7',
      titleAr: 'كيفية إنشاء عرض سعر وتحويله لفاتورة',
      titleEn: 'How to Create a Quotation & Convert to Invoice',
      route: 'quotations',
      stepsAr: [
        '1. افتح عروض الأسعار وأضف العميل والأصناف والخصم وتاريخ الصلاحية.',
        '2. أرسل عرض السعر بالواتساب أو اطبعه PDF.',
        '3. عند موافقة العميل اضغط الزر الذهبي "تحويل إلى فاتورة".',
      ],
      stepsEn: [
        '1. Open Quotations, add customer, items, discount %, and Valid Until date.',
        '2. Print PDF or share via WhatsApp/Email.',
        '3. Click the gold "Convert to Invoice" button to generate a live Invoice.',
      ],
    },
    {
      id: 'h8',
      titleAr: 'كيفية النسخ الاحتياطي واستعادة البيانات',
      titleEn: 'How to Backup & Restore All Data',
      route: 'settings',
      stepsAr: [
        '1. افتح الإعدادات ثم قسم "النسخ الاحتياطي والمزامنة".',
        '2. اضغط "نسخ احتياطي الآن" لتنزيل ملف JSON أو "تصدير Excel".',
        '3. على أي جهاز جديد يمكنك الاستعادة من شاشة تسجيل الدخول أو الإعدادات.',
      ],
      stepsEn: [
        '1. Open Settings and scroll to Cloud Backup & Sync.',
        '2. Tap "Backup Now" for JSON or "Export to Excel (All Sheets)".',
        '3. Restore anytime from Settings or directly on the Login screen.',
      ],
    },
  ];

  const q = helpSearch.toLowerCase();
  const visibleGuides = guides.filter(
    (g) =>
      !q ||
      g.titleAr.toLowerCase().includes(q) ||
      g.titleEn.toLowerCase().includes(q) ||
      g.stepsAr.join(' ').toLowerCase().includes(q) ||
      g.stepsEn.join(' ').toLowerCase().includes(q),
  );

  const visibleFaqs = FAQS.filter(
    (f) =>
      !q ||
      f.qAr.toLowerCase().includes(q) ||
      f.qEn.toLowerCase().includes(q) ||
      f.aAr.toLowerCase().includes(q) ||
      f.aEn.toLowerCase().includes(q),
  );

  const tickets = state.supportTickets ?? [];

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim() || !ticketDesc.trim()) {
      setTicketError(isAr ? 'يرجى تعبئة عنوان التذكرة والوصف *' : 'Title and description are required *');
      return;
    }
    setTicketError('');
    actions.saveSupportTicket({
      title: ticketTitle.trim(),
      description: ticketDesc.trim(),
      screenshotBase64: ticketShot,
    });
    setTicketTitle('');
    setTicketDesc('');
    setTicketShot(undefined);
    actions.notify(isAr ? 'تم إرسال تذكرة الدعم الفني بنجاح' : 'Support ticket submitted');
  };

  const statusBadge = (status: SupportTicket['status']) => {
    if (status === 'resolved') {
      return isAr ? 'تم الحل ✓' : 'Resolved ✓';
    }
    if (status === 'in_progress') {
      return isAr ? 'قيد المعالجة' : 'In Progress';
    }
    return isAr ? 'مفتوحة' : 'Open';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Search & Action Bar */}
      <div className="no-print flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={helpSearch}
            onChange={(e) => setHelpSearch(e.target.value)}
            placeholder={t.searchHelp}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
          />
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
        >
          <Printer className="w-4 h-4 text-[#C9A227]" />
          <span>{isAr ? 'دليل المستخدم PDF' : 'User Manual PDF'}</span>
        </button>
        <a
          href={buildWhatsAppLink(
            state.settings.phone || '966500000000',
            isAr
              ? `مرحباً فريق الدعم الفني لمنصة أسطورة المحاسبة — المنشأة: ${state.settings.companyName}`
              : `Hello Ostora ERP Support — Company: ${state.settings.companyName}`,
          )}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
        >
          <MessageCircle className="w-4 h-4" />
          <span>{isAr ? 'دعم واتساب المباشر' : 'WhatsApp Support'}</span>
        </a>
      </div>

      {/* Print Header for User Manual PDF */}
      <div className="hidden print:block border-b-2 border-[#0A3D2C] pb-3 mb-3">
        <h1 className="text-xl font-extrabold text-[#0A3D2C]">
          {isAr ? 'دليل المستخدم الشامل — أسطورة المحاسبة ERP' : 'User Manual — Ostora Accounting ERP'}
        </h1>
        <p className="text-xs text-slate-500">{state.settings.companyName}</p>
      </div>

      {/* Video Tutorials Gallery */}
      <div className="no-print space-y-3">
        <h2 className="text-base font-extrabold flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-[#C9A227]" />
          <span>{isAr ? 'شروحات الفيديو التفاعلية' : 'Interactive Video Tutorials'}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {VIDEO_TUTORIALS.map((v) => (
            <div
              key={v.id}
              className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-[#0A3D2C]/10 text-[#0A3D2C] dark:text-[#C9A227] font-mono text-[11px] font-bold">
                    {v.duration}
                  </span>
                  <PlayCircle className="w-5 h-5 text-[#C9A227]" />
                </div>
                <h3 className="text-sm font-extrabold">{isAr ? v.titleAr : v.titleEn}</h3>
                <p className="text-xs text-slate-500">{isAr ? v.descAr : v.descEn}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideo(v)}
                className="w-full py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
              >
                {isAr ? 'مشاهدة الشرح' : 'Watch Tutorial'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Step-by-Step User Guides */}
      <div className="space-y-3">
        <h2 className="text-base font-extrabold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227]" />
          <span>{isAr ? 'الأدلة الإرشادية (خطوة بخطوة)' : 'Step-by-Step User Guides'}</span>
        </h2>
        {visibleGuides.map((g) => {
          const expanded = openHelpId === g.id;
          const steps = isAr ? g.stepsAr : g.stepsEn;
          return (
            <div
              key={g.id}
              className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] overflow-hidden print-avoid-break"
            >
              <button
                onClick={() => setOpenHelpId(expanded ? '' : g.id)}
                className="w-full p-4 flex items-center justify-between gap-3 text-start cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-5 h-5 text-[#0A3D2C] dark:text-[#C9A227] shrink-0" />
                  <span className="font-extrabold text-sm">{isAr ? g.titleAr : g.titleEn}</span>
                </div>
                <ChevronDown
                  className={`no-print w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </button>
              {expanded && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-[#1F332B] space-y-3">
                  <div className="space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {steps.map((s, idx) => (
                      <p key={idx}>{s}</p>
                    ))}
                  </div>
                  <button
                    onClick={() => onNavigate(g.route)}
                    className="no-print inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C9A227] text-slate-950 font-extrabold text-xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t.tryNow}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQs Section */}
      <div className="space-y-3">
        <h2 className="text-base font-extrabold">{isAr ? 'الأسئلة الشائعة (FAQ)' : 'Frequently Asked Questions'}</h2>
        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] divide-y divide-slate-100 dark:divide-[#1F332B]">
          {visibleFaqs.map((faq) => {
            const open = openFaqId === faq.id;
            return (
              <div key={faq.id} className="p-4">
                <button
                  type="button"
                  onClick={() => setOpenFaqId(open ? '' : faq.id)}
                  className="w-full flex items-center justify-between gap-2 text-start font-extrabold text-xs sm:text-sm cursor-pointer"
                >
                  <span>{isAr ? faq.qAr : faq.qEn}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {isAr ? faq.aAr : faq.aEn}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Support Tickets Form & History */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form
          onSubmit={handleSubmitTicket}
          className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3"
        >
          <h3 className="text-sm font-extrabold flex items-center gap-2">
            <Ticket className="w-4 h-4 text-[#C9A227]" />
            <span>{isAr ? 'فتح تذكرة دعم فني' : 'Submit Support Ticket'}</span>
          </h3>

          <div>
            <label className="text-xs font-bold text-slate-500">
              {isAr ? 'عنوان المشكلة / الطلب *' : 'Ticket Subject *'}
            </label>
            <input
              type="text"
              maxLength={140}
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              placeholder={isAr ? 'مثال: استفسار عن ربط ضريبة القيمة المضافة' : 'e.g. VAT setup inquiry'}
              className="mt-1 w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500">
              {isAr ? 'الوصف التفصيلي *' : 'Detailed Description *'}
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={ticketDesc}
              onChange={(e) => setTicketDesc(e.target.value)}
              placeholder={isAr ? 'اشرح الحالة أو الخطوات المطلوبة...' : 'Describe your question or issue...'}
              className="mt-1 w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shotInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5 text-[#0A3D2C] dark:text-[#C9A227]" />
              <span>{ticketShot ? (isAr ? 'تم إرفاق لقطة شاشة ✓' : 'Screenshot Attached ✓') : isAr ? 'إرفاق لقطة شاشة' : 'Attach Screenshot'}</span>
            </button>
            <input
              ref={shotInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const b64 = await compressImageToBase64(file);
                setTicketShot(b64);
                e.target.value = '';
              }}
            />

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isAr ? 'إرسال التذكرة' : 'Submit Ticket'}</span>
            </button>
          </div>
          {ticketError && <p className="text-xs font-bold text-rose-600">{ticketError}</p>}
        </form>

        <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-5 space-y-3">
          <h3 className="text-sm font-extrabold">
            {isAr ? `سجل تذاكر الدعم (${tickets.length})` : `Ticket History (${tickets.length})`}
          </h3>
          {tickets.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              {isAr ? 'لا توجد تذاكر دعم مسجلة حتى الآن' : 'No support tickets submitted yet'}
            </p>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {tickets.map((tk) => (
                <div
                  key={tk.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs truncate">
                      #{tk.id} · {tk.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextStatus: SupportTicket['status'] =
                          tk.status === 'open'
                            ? 'in_progress'
                            : tk.status === 'in_progress'
                            ? 'resolved'
                            : 'open';
                        actions.updateSupportTicketStatus(tk.id, nextStatus);
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                        tk.status === 'resolved'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : tk.status === 'in_progress'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-[#C9A227]'
                          : 'bg-sky-500/15 text-sky-600'
                      }`}
                    >
                      {statusBadge(tk.status)}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{tk.description}</p>
                  <p className="text-[10px] font-mono text-slate-400">{tk.createdAt.slice(0, 10)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Video Tutorial Walkthrough Modal */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">{isAr ? activeVideo.titleAr : activeVideo.titleEn}</h3>
              <button type="button" onClick={() => setActiveVideo(null)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl bg-[#0A3D2C] text-white p-6 text-center space-y-2">
              <PlayCircle className="w-12 h-12 text-[#C9A227] mx-auto" />
              <p className="text-xs text-white/80 font-mono">{activeVideo.duration}</p>
              <p className="text-xs text-white/90">{isAr ? activeVideo.descAr : activeVideo.descEn}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-extrabold text-slate-500">
                {isAr ? 'محتويات الشرح:' : 'Tutorial Chapters:'}
              </p>
              {(isAr ? activeVideo.chaptersAr : activeVideo.chaptersEn).map((ch) => (
                <div key={ch} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{ch}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = activeVideo.route;
                  setActiveVideo(null);
                  onNavigate(target);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#C9A227] text-slate-950 text-xs font-extrabold cursor-pointer"
              >
                {t.tryNow}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
