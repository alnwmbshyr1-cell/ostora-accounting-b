import React, { useState } from 'react';
import { ArrowRight, ChevronDown, HelpCircle, Search, Sparkles } from 'lucide-react';
import { strings } from '../data/translations';
import { RouteId } from '../types/erp';
import { ScreenProps } from './types';

export const HelpScreen: React.FC<ScreenProps> = ({ store, onNavigate }) => {
  const isAr = store.state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];

  const [helpSearch, setHelpSearch] = useState('');
  const [openHelpId, setOpenHelpId] = useState<string>('h1');

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

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
        <input
          type="text"
          value={helpSearch}
          onChange={(e) => setHelpSearch(e.target.value)}
          placeholder={t.searchHelp}
          className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] text-sm outline-none focus:border-[#0A3D2C]"
        />
      </div>

      <div className="space-y-3">
        {visibleGuides.map((g) => {
          const expanded = openHelpId === g.id;
          const steps = isAr ? g.stepsAr : g.stepsEn;
          return (
            <div
              key={g.id}
              className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] overflow-hidden"
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
                  className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C9A227] text-slate-950 font-extrabold text-xs cursor-pointer"
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
    </div>
  );
};
