# أسطورة المحاسبة العالمية — Global Accounting Legend ERP

نظام محاسبة وإدارة موارد مؤسسات (ERP) ثنائي اللغة (العربية RTL / الإنجليزية LTR وغيرها) يعمل **بدون إنترنت أولاً (Offline-First PWA)** مع مزامنة سحابية آمنة عبر **Firebase Firestore & Auth** وتطبيق جوال مرافق مبني بـ **Flutter**.

A bilingual (Arabic RTL / English LTR) enterprise accounting & ERP platform engineered **Offline-First (PWA)** with real-time **Firebase Cloud Firestore & Authentication** sync and a **Flutter** mobile companion app.

---

## الميزات الرئيسية / Core Capabilities

- **الفواتير ونقاط البيع ZATCA Phase 1 & 2**: فواتير ضريبية ومبسطة، عروض أسعار، مرتجعات مبيعات/مشتريات، رموز QR مشفرة بتقنية TLV، توليد ملفات UBL 2.1 XML، وتوقيع/تجزئة SHA-256 & ECDSA.
- **محاسبة القيد المزدوج الدقيقة (Halala / Fils / Yen Integer Math)**: شجرة حسابات 5 مستويات، قيود يومية تلقائية ومزدوجة، إبطال وعكس القيود (Void & Reverse)، قفل الفترات المالية، وميزان المراجعة والقوائم المالية المبنية مباشرة من دفتر الأستاذ بدون أي حسابات موازنة وهمية.
- **تعدد العملات (15 عملة) وأسعار الصرف التلقائية**: دعم العملة الأساسية وعملة العرض مع دقة الكسور العشرية (0 للين JPY، 2 للريال/الدولار، 3 للدينار الكويتي/البحريني/العماني).
- **المخزون والمستودعات وأوامر الشراء**: تتبع الباركود EAN-13، تنبيهات الصلاحية والحد الأدنى، التحويلات المخزنية، الجرد الفعلي وتسوية الفروقات.
- **الموارد البشرية والمصروفات والبنوك والصناديق**: ملفات الموظفين وصرف الرواتب (بدون تخزين كلمات مرور محلية)، مراكز التكلفة، التسوية البنكية، وتفقيط السندات (Tafqeet).
- **الأمان وسجل التدقيق وسياسة الخصوصية**: مصادقة Firebase حقيقية مع تحقق البريد الإلكتروني، عزل مساحات العمل في `firestore.rules`، سجل تدقيق غير قابل للحذف، وسياسة خصوصية شاملة مدمجة.

---

## البنية التقنية / Tech Stack

- **Web App**: React 19, TypeScript, Vite, Tailwind CSS v4, Vite PWA (`IndexedDB` + Service Worker)
- **Backend / Sync**: Firebase Auth + Cloud Firestore + Express (`server.ts`)
- **Mobile Companion**: Flutter (`flutter_app/` — SQLite + Hive + Firebase Auth + PDF/ZATCA QR)
- **Testing & Quality**: Vitest (`src/domain/__tests__/accounting.test.ts`), TypeScript (`tsc --noEmit`), Firebase Security Rules ESLint (`@firebase/eslint-plugin-security-rules`)

---

## التشغيل والتطوير محلياً / Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (copy .env.example to .env)
cp .env.example .env

# 3. Start development server on port 3000
npm run dev

# 4. Run typecheck, unit tests, security rules lint, and production build
npm run lint
npm run test
npx eslint firestore.rules
npm run build
```

> **ملاحظة أمنية (Firebase Security Rules Reminder):**  
> تأكد من مراجعة قواعد `firestore.rules` واختبارها وفق سياسات مؤسستك ونشرها عبر Firebase CLI قبل الإطلاق الإنتاجي العام.

---

## GitHub Actions CI/CD

- **`.github/workflows/test.yml`**: فحص تلقائي عند كل Push أو Pull Request على `main` يشمل `tsc --noEmit`، اختبارات `vitest`، فحص `firestore.rules`، وبناء الإنتاج `vite build`.
- **`.github/workflows/deploy.yml`**: سير عمل لبناء الحزمة النهائية وتجهيز النشر على Firebase Hosting.
- **`.github/workflows/dart.yml`**: بناء وفحص تطبيق Flutter (Android APK/AAB & iOS).
