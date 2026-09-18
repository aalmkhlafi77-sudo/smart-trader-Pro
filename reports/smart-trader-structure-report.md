# تقرير فحص البنية — smart-trader @ Smart-Merchant-Branch (TASK_ID 3)

- المستودع: https://github.com/aalmkhlafi77-sudo/smart-trader
- الفرع: Smart-Merchant-Branch
- آخر commit: `b033098` بتاريخ 2026-08-23 — «chore: initial secure Smart Trader source»
- مسار الفحص: `/tmp/smart-trader-analysis` (استنساخ خفيف `--depth 1 --single-branch` خارج مساحة العمل، دون أي تعديل)
- حجم المشروع: 155 ملفًا، ~17,500 سطر TS/TSX

---

## 1) نظرة عامة موجزة على طبيعة المشروع

«التاجر الذكي / Smart Trader» تطبيق ويب تقدمي (PWA) **محلي بالكامل** لإدارة الأعمال التجارية (موردون/عملاء/مصانع): تسجيل الجهات، الأصناف ومواصفاتها الفنية، الأسعار اليدوية المؤرخة (4 مستويات لكل صنف)، حساب تكلفة الحمولة/الحاوية والتسعير، تقارير مقارنة المسارات وتفكيك التكلفة، التصدير إلى Excel وPDF، إدارة المهام والمرفقات، ونسخ احتياطية JSON قابلة للاستبدال أو الدمج.

خصائص جوهرية:
- **لا خادم بيانات، لا حسابات مستخدمين، لا API خارجي، لا تحليلات**: كل التخزين في **IndexedDB** داخل متصفح المستخدم.
- حماية الدخول رمز PIN محلي من 6 أرقام (PBKDF2 عبر WebCrypto) لا يغادر الجهاز ولا يدخل في النسخة الاحتياطية.
- متعدد اللغات (ar/en/tr) مع دعم RTL، والخطوط والأصول موطّنة بالكامل (لا Google Fonts ولا موارد خارجية وقت التشغيل).
- البنية مصمّمة بواجهة مستودع مجرّدة («اتجاه دفتر الميناء») لتسهيل التحويل المستقبلي إلى SQLite دون تعديل الواجهة.
- النسخة الحالية مُنظّفة أمنيًا من منصة سابقة (إزالة Manus/analytics/وكيل التخزين) مع تقرير تدقيق يوثّق 0 ثغرات.

---

## 2) شجرة المجلدات المختصرة (بعمق 3–4 مستويات، باستثناء node_modules/.git/dist/build/__pycache__/.venv)

```
smart-trader/
├── client/
│   ├── index.html                      # RTL، lang=ar، ربط manifest وأيقونة WebP
│   ├── public/
│   │   ├── assets/                     # 3 صور WebP موطّنة (شعار/خلفية دخول/لوحة عمل)
│   │   ├── fonts/                      # Cairo (400/600/800) + IBM Plex Sans Arabic (400/500/600) TTF
│   │   ├── manifest.webmanifest        # PWA: ar/rtl/standalone، لونان #12324A/#F7F4EC
│   │   └── service-worker.js           # كاش network-first مع fallback، استبعاد أصول التطوير
│   └── src/
│       ├── main.tsx                    # تركيب React + تسجيل عامل الخدمة (إنتاج فقط)
│       ├── App.tsx                     # Providers + AccessGate + راوتر wouter (11 مسارًا)
│       ├── index.css                   # Tailwind 4 + متغيرات هوية "دفتر الميناء"
│       ├── pages/                      # 11 صفحة (~4,802 سطر)
│       │   ├── Home.tsx (40)           # لوحة العمل وKPIs وتقويم المهام
│       │   ├── Entities.tsx (474)      # الجهات
│       │   ├── Items.tsx (955)         # الأصناف (الأكبر)
│       │   ├── Prices.tsx (629)        # الأسعار المؤرخة
│       │   ├── Pricing.tsx (465)       # حاسبة الحاوية
│       │   ├── Reports.tsx (434)       # التقارير الذكية
│       │   ├── FollowUp.tsx (159)      # المتابعة (مهام/ملاحظات)
│       │   ├── ExportLists.tsx (453)   # قوائم التصدير
│       │   ├── Backup.tsx (329)        # النسخ الاحتياطي/الاستعادة
│       │   ├── Settings.tsx (815)      # الإعدادات والقوالب
│       │   └── NotFound.tsx (49)
│       ├── components/                 # 21 مكوّنًا مخصصًا (~2,372 سطر)
│       │   ├── AccessGate.tsx (184)    # قفل PIN
│       │   ├── AppLayout.tsx (211)     # هيكل التطبيق
│       │   ├── MultiScreenCalculator.tsx (359) # حاسبة الحمولة المختلطة
│       │   ├── FloatingCalculator.tsx (245)
│       │   ├── CargoDecisionReports.tsx (227)
│       │   ├── AttachmentsPanel.tsx / TaskCalendarCard.tsx /
│       │   ├── LogisticsTemplatesSettingsCard.tsx / LegacyUiLocalizer.tsx /
│       │   ├── ErrorBoundary.tsx / LanguageSwitcher.tsx / ... (آخرون)
│       │   └── ui/                     # ~50 مكوّن shadcn/Radix
│       ├── contexts/                   # 6: Access, Language, Theme, ActivityTheme,
│       │                               #    LoginBackground, WorkspacePreferences
│       ├── hooks/                      # 4: useComposition, useMobile, usePersistFn, useSessionDraft
│       └── lib/
│           ├── db/
│           │   ├── index.ts (13)       # نقطة التبديل الوحيدة: db = indexedDbRepository
│           │   ├── repository.ts (157) # واجهة Repository المجردة + BackupPayload
│           │   ├── indexedDbRepository.ts (632) # التنفيذ الفعلي
│           │   └── schema.ts (568)     # 23 جدولًا + SCHEMA_VERSION=10
│           ├── pricing.ts (101)        # محرك حاوية مفردة
│           ├── cargoPricing.ts (122)   # محرك حمولة مختلطة + توزيع مصاريف
│           ├── cargoDecisionReports.ts (110) # مقارنة مسارات/تفكيك مراحل
│           ├── exporters.ts (189)      # Excel (SheetJS) + PDF
│           ├── latestItemPrice.ts (28) / id.ts (19) / utils.ts (6)
│           ├── i18n.ts (1,627)         # قاموس ar/en/tr
│           └── *.test.ts               # 4 ملفات اختبارات
├── server/
│   └── index.ts (33)                   # Express ثابت: تقديم dist/public + fallback
├── shared/
│   └── const.ts                        # ثابتان موروثان (COOKIE_NAME, ONE_YEAR_MS)
├── patches/
│   └── wouter@3.7.1.patch              # رقعة مخصصة لحزمة wouter
├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├── vite.config.ts / tsconfig.json / tsconfig.node.json / components.json
├── .prettierrc / .prettierignore / .gitignore / .gitkeep
├── README.md / ARCHITECTURE.md / SECURITY_AUDIT_REPORT.md / guide_evidence.md
├── todo.md (~23KB) / ideas.md / user_journey.mmd / user_journey.png
├── audit-before.json (533KB) / audit-full-after.json / audit-prod-after.json
└── مستندات تخطيط عربية:
    ├── خريطة_تقارير_قرار_الشحن_والتكلفة.md (16KB)
    ├── خطة_قوالب_الشحن_والتخليص.md (21KB)
    ├── قرارات_تنفيذ_حاسبة_الحمولة_المعتمدة.md (2.8KB)
    └── مراجعة_مخطط_إعادة_هيكلة_الحاسبة.md (12KB)
```

---

## 3) جدول: المكوّن / المسار / المسؤولية

| المكوّن | المسار | المسؤولية |
|---|---|---|
| نقطة الدخول | `client/src/main.tsx` → `App.tsx` | تركيب React + Providers (ErrorBoundary/Theme/Language/Access/…) + قفل PIN + راوتر wouter لـ11 واجهة |
| لوحة العمل | `client/src/pages/Home.tsx` | مداخل العمل، مؤشرات KPI، آخر الحسابات، تقويم المهام |
| إدارة الجهات | `client/src/pages/Entities.tsx` | موردون/عملاء/مصانع + عملة وسعر صرف مرجعي يُورَّثان للأصناف |
| إدارة الأصناف | `client/src/pages/Items.tsx` | أكبر صفحة (955 سطرًا): تعريف الصنف، تصنيف، مواصفات من قوالب، توريث الصرف والجمارك |
| الأسعار | `client/src/pages/Prices.tsx` | 4 أسعار يدوية بتواريخ اعتماد مستقلة + سجل تاريخ الأسعار (price_history) |
| الحاسبة (حاوية مفردة) | `client/src/pages/Pricing.tsx` + `lib/pricing.ts` | المعادلة المعتمدة: قيمة البضاعة (سعر×كمية×صرف) + شحن + جمارك + تخليص + نقل + أخرى → تكلفة الوحدة → سعر البيع بالهامش |
| حاسبة الحمولة المختلطة | `components/MultiScreenCalculator.tsx` + `lib/cargoPricing.ts` | توزيع الجمارك والمصاريف المشتركة بحصة القيمة، و«لكل وحدة» على الأصناف المستهدفة متوافقة الوحدة |
| تقارير القرار | `pages/Reports.tsx` + `lib/cargoDecisionReports.ts` | مقارنة مسارات وتفكيك التكلفة على مراحل (factory/port/customs/warehouse/other) من لقطات محفوظة |
| المتابعة | `pages/FollowUp.tsx` | مهام وملاحظات مرتبطة بالجهات/الأصناف |
| التصدير | `pages/ExportLists.tsx` + `lib/exporters.ts` | Excel (SheetJS) وPDF بأرقام/تواريخ إنجليزية وواجهة RTL؛ قاعدة: لا تخرج التكاليف/الهوامش لملفات العملاء |
| النسخ الاحتياطي | `pages/Backup.tsx` | تصدير JSON كامل (23 جدولًا) واستيراد بمعاينة ثم استبدال أو دمج آمن؛ PIN مستثنى عمدًا |
| الإعدادات | `pages/Settings.tsx` | التصنيفات، قوالب المواصفات، قوالب المسارات وأسعار الخدمات، العملة، المظهر |
| الدخول المحلي | `components/AccessGate.tsx` + `contexts/AccessContext.tsx` | PIN من 6 أرقام، PBKDF2 عبر WebCrypto، مخزّن في localStorage المحلي |
| الترجمة والاتجاه | `lib/i18n.ts` + `contexts/LanguageContext.tsx` | قوام ar/en/tr مع تبديل RTL/LTR |
| المرفقات | `components/AttachmentsPanel.tsx` + جدول attachments | تخزين المرفقات كمرجع منفصل عن السجل (لا Blob داخل السجلات) |
| طبقة البيانات | `client/src/lib/db/` | واجهة Repository مجرّدة + تنفيذ IndexedDB؛ `db/index.ts` نقطة تبديل المحرك الوحيدة (SQLite لاحقًا) |
| خادم الإنتاج | `server/index.ts` | Express ثابت: تقديم `dist/public` + إرسال index.html لكل المسارات، `PORT||3000`؛ **لا API ولا منطق أعمال** |
| الثوابت المشتركة | `shared/const.ts` | متبقيات موروثتان غير مستدعاة فعليًا |

---

## 4) التقنيات والإصدارات (من package.json وملفات الإعداد)

| الفئة | التقنية | الإصدار |
|---|---|---|
| واجهة | React / React DOM | ^19.2.1 |
| لغة | TypeScript (strict, noEmit) | 5.6.3 |
| بناء الواجهة | Vite (@vitejs/plugin-react) | ^7.3.6 / ^5.2.0 |
| تنسيق | Tailwind CSS (@tailwindcss/vite) | ^4.3.3 + tailwindcss-animate + tw-animate-css |
| مكتبة UI | shadcn/ui (style: new-york، cssVariables، baseColor: neutral) + Radix UI (كامل المجموعة) | — |
| توجيه | wouter (مع patch خاص عبر pnpm) | ^3.3.5 (الرقعة على 3.7.1) |
| نماذج/تحقق | react-hook-form + @hookform/resolvers + zod | ^7.64.0 / ^5.2.2 / ^4.1.12 |
| رسوم متحركة | framer-motion | ^12.23.22 |
| تنبيهات | sonner + next-themes + vaul + cmdk | ^2.0.7 / ^0.4.6 / — |
| جداول/تصدير | xlsx من CDN الرسمي لـSheetJS | 0.20.3 (tarball رسمي — استبدال أمني موثّق) |
| خادم ثابت | Express | ^4.22.2 (تجاوز path-to-regexp على 0.1.13) |
| بناء الخادم | esbuild (حزم dist/index.js) | ^0.25.0 |
| اختبارات | Vitest | ^3.2.7 |
| تنسيق كود | Prettier | ^3.6.2 |
| إدارة الحزم | pnpm (packageManager مقفل) | 10.4.1 |
| تجاوزات أمنية (pnpm-workspace overrides) | path-to-regexp 0.1.13، tailwindcss>nanoid 3.3.7، tar 7.5.22، rollup 4.62.5، postcss 8.5.26، nanoid 3.3.18، picomatch 4.0.5، @babel/core 7.29.6 | — |
| تخزين | IndexedDB (متصفح) | DB_NAME=smart_trader_db، SCHEMA_VERSION=10 |
| PWA | manifest + service worker | standalone، RTL، offline |
| خطوط/أصول | Cairo + IBM Plex Sans Arabic موطّنة + صور WebP | — |
| إعدادات TypeScript | strict، moduleResolution bundler، aliases: `@/`→client/src، `@shared/`→shared | — |
| Vite | root=client، outDir=dist/public، منفذ تطوير 3000، fs.deny=**/.* | — |

ملاحظة: لا توجد ملفات requirements.txt / go.mod / pom.xml / composer.json / Dockerfile — المشروع Node/pnpm فقط.

---

## 5) نقاط الدخول وطريقة التشغيل المتوقعة (وصف فقط — لم يُشغَّل أي أمر تشغيل)

- **المتطلبات**: Node.js حديث + pnpm 10.4.1 (مقفل في حقل packageManager). لا `.env` ولا مفاتيح API ولا قاعدة بيانات خارجية للتشغيل المحلي.
- **تثبيت الاعتمادات**: `pnpm install --frozen-lockfile`
- **تطوير**: `pnpm dev` → Vite على منفذ 3000 مع `--host`؛ عامل الخدمة يُلغى تسجيله تلقائيًا في التطوير (تنظيف caches) لتجنّب تقديم ملفات قديمة.
- **اختبار الوحدات**: `pnpm test` (Vitest run)
- **فحص الأنواع**: `pnpm run check` (tsc --noEmit)
- **بناء الإنتاج**: `pnpm run build` → بناء الواجهة إلى `dist/public` ثم حزم `server/index.ts` عبر esbuild إلى `dist/index.js` (منصة node، حزم خارجية).
- **تشغيل الإنتاج**: `pnpm start` → `NODE_ENV=production node dist/index.js` يقدّم `dist/public` على `http://localhost:3000` (قابل للتغيير: `PORT=3010 pnpm start`).
- **معاينة**: `pnpm preview` (vite preview --host)
- **تدقيق التبعيات**: `pnpm audit` / `pnpm audit --prod`
- **مسار استخدام المستخدم**: إنشاء PIN محلي عند أول تشغيل ← إدارة الجهات/الأصناف/الأسعار ← حساب تكلفة الحمولة والتقارير ← تصدير Excel/PDF ← نسخ احتياطي JSON دوري.

---

## 6) مخطط البيانات والتخزين (IndexedDB / stores / migrations)

**لا توجد migrations تقليدية ولا ORM**؛ الإصدار عبر ثابت `SCHEMA_VERSION = 10` في `client/src/lib/db/schema.ts`، والترقية تُدار داخل حدث `onupgradeneeded` في `indexedDbRepository.ts`، مع جدول `meta` يحفظ إصدار المخطط لبيانات النسخ الاحتياطي. قاعدة تصميم إلزامية موثقة في ARCHITECTURE.md: كل سجل مسطّح بحقول صريحة، مفاتيح نصية، تواريخ ISO، قيم مالية أرقام، `createdAt/updatedAt` لكل جدول، العلاقات بمفاتيح خارجية صريحة (entityId/itemId/runId)، والصور بمرجع منفصل لا Blob داخل السجل — كل ذلك لضمان نقل مباشر إلى SQLite مستقبلًا عبر تنفيذ جديد لواجهة `Repository` دون تعديل الواجهة.

**23 store/table** (مطابقة لمفاتيح BackupPayload):

| المجموعة | الجداول |
|---|---|
| المرجعيات | `entities` (جهات + defaultCurrency/defaultExchangeRate), `categories` (تصنيفات رئيسية), `spec_templates` (قوالب مواصفات بوحدات وخيارات ظهور) |
| الأصناف والأسعار | `items` (مع customsRate واختيار الصرف الموروث), `item_specs` (مواصفات مرنة، isKey للمميزة), `item_prices` (4 مستويات price1..4 بتاريخ اعتماد لكل مستوى), `price_history` (لقطة مؤرخة قبل كل تعديل) |
| التكلفة والتسعير | `pricing_runs` (حاوية مفردة), `cargo_cost_runs` / `cargo_cost_items` / `cargo_cost_lines` / `cargo_cost_allocations` (حمولة مختلطة + سجل توزيع قابل للتدقيق) |
| اللوجستيات | `logistics_locations`, `logistics_rates` (أسعار خدمات مؤرخة), `logistics_route_templates` (قوالب مسارات مركّبة) |
| التصدير | `price_lists`, `price_list_items` |
| ملحقات العمل | `attachments`, `notes`, `tasks`, `backup_logs` |
| النظام | `settings` (عملة/إعدادات محلية), `meta` (إصدار المخطط) |

**واجهة الوصول**: `client/src/lib/db/repository.ts` تعرّف واجهة `Repository` (init + CRUD لكل جدول + exportBackup/importBackup(replace|merge) + clearAll)، و`db/index.ts` هو **نقطة التبديل الوحيدة**: `export const db: Repository = indexedDbRepository` — لتحويل التطبيق إلى SQLite يكفي تغيير هذا السطر.

**النسخ الاحتياطي**: كائن `BackupPayload` بصيغة `smart-trader-backup` مع schemaVersion وexportedAt و23 جدولًا؛ PIN مستثنى عمدًا من الملف.

---

## 7) ملاحظات ومخاطر

### الاختبارات
- 4 ملفات اختبار وحدة بـVitest: `cargoPricing.test.ts`, `cargoDecisionReports.test.ts`, `exporters.test.ts`, `latestItemPrice.test.ts` — وتقرير التدقيق يوثّق 7 اختبارات ناجحة.
- **لا اختبارات E2E/تكامل**، ولا تغطية للصفحات الكبرى (Items 955 سطرًا، Settings 815، Prices 629 بلا اختبارات)، ولا إعداد تغطية (coverage) في السكربتات.

### CI/CD
- **غائب تمامًا**: لا `.github/workflows`، لا Dockerfile، لا سكربت نشر/مراقبة. التحقق (check/test/build/audit) يدوي بالكامل كما هو موثق في README وتقرير التدقيق.

### README والتوثيق
- README تشغيلي جيد بالعربية (أوامر، منفذ، نسخ احتياطي، خصوصية). ARCHITECTURE.md يشرح الطبقات وقواعد توافق SQLite ومسار التحويل. SECURITY_AUDIT_REPORT.md يسجّل التنظيف (إزالة Manus/analytics/وكيل التخزين/Google Fonts) ونتيجة `pnpm audit` = 0 ثغرات بكل الدرجات.
- **نقطة ضعف**: `guide_evidence.md` يحيل إلى لقطات بمسارات محلية خارج المستودع (`/home/ubuntu/screenshots/...`) — أدلة غير قابلة للتحقق من الحزمة نفسها.
- `todo.md` (~23KB) سجل مهام منجزة مفيد للسياق لكنه ليس توثيق صيانة.

### إعدادات البيئة
- **لا شيء مطلوب**: لا `.env` ولا أسرار ولا مفاتيح API — ميزة خصوصية وتبسيط تشغيل، لكن يعني أيضًا غياب أي إعداد جاهز للنشر/المراقبة/التشخيص، وأن كل البيانات حبيسة جهاز واحد.
- `shared/const.ts` يحوي ثابتين موروثين (COOKIE_NAME/ONE_YEAR_MS) غير مستدعيين — بقايا منصة سابقة يُنصح بحذفها.

### المخاطر المعمارية الجوهرية
1. **مخاطر فقدان البيانات**: IndexedDB على جهاز واحد — لا مزامنة متعددة الأجهزة، والنسخ الاحتياطيات يدوية؛ مسح بيانات المتصفح = فقدان كامل إن لم تُصدَّر نسخة.
2. **PIN ≠ تشفير**: قفل 6 أرقام بـPBKDF2 يحمي الواجهة فقط؛ محتوى IndexedDB وlocalStorage قابل للقراءة عبر DevTools — لا يحمي تكاليف/هوامش حساسة على جهاز مشترك.
3. **تركّز ملفات حرجة**: `indexedDbRepository.ts` (632 سطرًا) و`schema.ts` (568) و`i18n.ts` (1,627) ملفات ضخمة أحادية؛ الترقية عبر `onupgradeneeded` بدل migrations معلنة/مُختبَرة = خطر انزلاق مخطط عند كل نسخة (المخطط وصل أصلًا v10).
4. **سلسلة الإمداد**: `xlsx` محمّل من tarball على CDN رسمي (ارتباط خارجي غير مضمون التوفر طويلًا)، ورقعة patch مخصصة لـwouter، و8 overrides للتبعيات المتداخلة — كلها تستحق قفلًا ومراقبة دورية رغم نظافة التدقيق الحالي.
5. **خادم تجميلي**: Express تقديم ملفات ثابتة فقط؛ أي توسّع (مزامنة سحابية، تعدد مستخدمين، نسخ احتياطي تلقائي) يتطلب backend كاملًا — واجهة Repository تخفّض الكلفة النظرية لكن لا تنفيذ SQLite/سحابي موجود فعليًا.
6. **نضج تاريخ التطوير**: الفرع يحوي commit أوحدًا «initial secure source»؛ تاريخ التطوير الكامل بقي خارج المستودع (todo.md وسجلات المنصة السابقة) — يصعّب المراجعة التدريجية.
7. **حجم المستودع**: `audit-before.json` (533KB) و`user_journey.png` (151KB) مودعة في Git — يُفضَّل نقلها إلى Releases أو حذفها.
8. **قواعد عمل مضمّنة في الكود**: معادلات التكلفة وتوزيع المصاريف «معتمدة» نصيًا في مستندات عربية وفي `lib/*.ts` معًا؛ أي تغيير مستقبلي في السياسة يتطلب مزامنة المستند والكود والاختبارات يدويًا.

---

*إعداد: Alex (Engineer) — TASK_ID 3. فحص للقراءة فقط: لا تطوير، لا بناء، لا تشغيل، لا نشر، ولا نسخ أي ملف إلى /workspace، ولا تعديل نسخة الاستنساخ في /tmp/smart-trader-analysis.*
