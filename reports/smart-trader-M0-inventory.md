# تقرير M0 — جرد الشاشات والحقول ومفاتيح الترجمة (إعادة بناء «التاجر الذكي»)

- قاعدة الكود: `/workspace/app/frontend` (استنساخ smart-trader @ Smart-Merchant-Branch، commit `b033098`) + تفعيل Atoms Cloud.
- خط الأساس قبل أي تعديل: `pnpm run check` = 0 أخطاء، `pnpm test` = 7/7 خضراء (cargoPricing, cargoDecisionReports, latestItemPrice, exporters).

## 1) المسارات الحالية ← الجديدة

| المسار الحالي | الصفحة (سطور) | العربية في JSX | t() | المسار الجديد (القسم 4 من البرومبت) |
|---|---|---|---|---|
| `/` | Home.tsx (40) | 1 | 5 | `/` لوحة تحكم مُعاد بناؤها (بحث عام + صحة بيانات) |
| `/entities` | Entities.tsx (474) | 55 | 14 | `/entities` (ترتيب حقول القسم 6) |
| `/items` | Items.tsx (955) | 84 | 14 | `/items` |
| `/prices` | Prices.tsx (629) | 46 | 27 | `/prices` |
| `/pricing` | Pricing.tsx (465) | 74 | 1 | `/cargo` + إعادة توجيه `/pricing→/cargo` |
| — | — | — | — | `/cargo/runs` سجل الحمولات (جديد) |
| `/reports` | Reports.tsx (434) + CargoDecisionReports.tsx (227) | 61+72 | 1+0 | `/reports` |
| `/follow-up` | FollowUp.tsx (159) | 28 | 8 | `/follow-up` |
| `/export` | ExportLists.tsx (453) | 47 | 15 | `/export` |
| `/backup` | Backup.tsx (329) | 61 | 10 | `/backup` |
| `/settings` | Settings.tsx (815) + LogisticsTemplatesSettingsCard (165) | 130+40 | 19+0 | `/settings/{business,financial,catalog,logistics,workspace,security,data}` |

مجموع العربية في TSX خارج القواميس: **761 سطرًا** (35 ملفًا) مقابل **231 استدعاء t()** — يؤكد أن الإن/تر ناقصان فعليًا.

## 2) جرد الحقول الحالية مقابل معيار القسم 6

**الجهة (Entities):** الاسم* → النوع* → الدولة → المدينة → المسؤول → الهاتف → البريد → ملاحظات → **العملة* وسعر الصرف في آخر النموذج** ⚠ (المعيار: يُرفعان للموضع 3 لأنهما يُورَّثان للأصناف).

**الصنف (Items):** اسم الصنف* → الكود → **التصنيف قبل الجهة** ⚠ → **الوحدة بعد الجهة** ⚠ → عملة السعر → الصرف المرجعي → نسبة الجمارك → المواصفات → ملاحظات/مرفقات. المعيار: اسم* → **الجهة** → التصنيف* → الوحدة* → عملة/صرف/جمارك (مع InheritedValue) → المواصفات → طي.

**الأسعار (Prices):** رأس (تصنيف/جهة/صنف) ثم المستويات الأربعة؛ سجل التاريخ بجانب النموذج ⚠ (المعيار: أسفله)؛ بلا وسم «آخر سعر مؤرخ» ⚠.

## 3) خريطة التكرار والفوضى في الإعدادات

- كل قسم مُغلَّف بـ `SettingsFold` ثم `SectionCard` بنفس العنوان (ازدواج رؤوس موثّق في 8 أقسام على الأقل).
- طبقات طي ثلاثية (general→section→detail) في Settings.tsx.
- `LegacyUiLocalizer.tsx` (74 سطرًا) + `LEGACY_UI_TEXT` (سطر 1120 من i18n.ts) + `EXTRA_LEGACY_UI_TEXT` (سطر 1500) — تُحذف نهائيًا في M2.
- العملة مخزّنة نصوصًا عربية (`"دولار"`, `"ريال"`) في: entities.defaultCurrency، items.currency، item_prices.currency، cargo_cost_*، price_lists، settings — تتحول ISO في M3/M8 مع مهاجرة v11.
- التنقل: NAV مسطّح 10 عناصر، والموبايل `NAV.slice(0,4)` + شبكة «المزيد» — يُستبدل بخمس مجموعات + شريط سفلي 5 خانات.

## 4) القاموس الحالي وخريطة المفاتيح المطلوبة

- `lib/i18n.ts`: 1,627 سطرًا، **363 مفتاحًا** × 3 لغات (ar/en/tr) في ملف واحد.
- التقسيم المستهدف (M2): `i18n/{ar,en,tr}/{common,nav,entities,items,prices,cargo,reports,settings,backup,validation}.ts` + فهرس يوحّدها، واصطلاح `domain.screen.element`.
- عائلات مفاتيح جديدة مطلوبة: `nav.group.*` (5 مجموعات)، `dashboard.*` (بحث/صحة بيانات/مؤشرات)، `cargo.wizard.*` + `cargo.runs.*`، `settings.route.*` (8 مسارات)، `validation.*` (رسائل zod)، `status.*` (مسودة/مراجعة/معتمد/مؤرشف، مُدخل/مشمول/ناقص/طرف ثالث)، `units.*`، `currencies.*`.

## 5) فجوات المخطط v10 ← v11 (M8)

جداول جديدة: `currencies(code,symbol,decimals,active)`، `units(id,name,kind,factorToBase,baseUnit)`، `entity_contacts`. حقول settings جديدة: `numberFormat, dateFormat, logoDataUrl, reportHeader, reportFooter`. تحويل نصوص العملات إلى ISO. **إلزامي:** اختبار استعادة نسخة v10 بلا فقد سجل واحد.

## 6) بنود الإحكام الوظيفي (الإضافات المعتمدة)

1. المحرك اليتيم: `pricing.ts/pricing_runs` (savePricingRun بلا مستدعٍ) بينما Home/Reports/ExportLists تقرأه → **تحويل القراءات إلى cargo_cost_runs** (قرار مسجّل أدناه).
2. `savePriceList` غير مستدعى → تفعيل حفظ قوائم الأسعار كسجلات.
3. ربحية الصنف وصحة التغطية (todo.md:176) → تقرير جديد في `/reports`.
4. قفل التعديل بعد الاعتماد + نسخة معدّلة عبر parentRunId.
5. CI (GitHub Actions: check/test/build/i18n-check) + E2E.
6. تشفير IndexedDB اختياري (AES-GCM، افتراضيًا مغلق).
7. توحيد ISO مبكر في M3.
8. مزامنة Atoms Cloud اختيارية مع بقاء local-first.
