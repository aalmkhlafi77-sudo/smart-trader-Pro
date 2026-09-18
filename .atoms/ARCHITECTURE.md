# Architecture Design

## System Overview

إعادة بناء «التاجر الذكي» داخل `/workspace/app/frontend` (قاعدة الكود: smart-trader @ Smart-Merchant-Branch، commit `b033098`) + `/workspace/app/backend` (Atoms Cloud). العمود الفقري: **local-first** — IndexedDB عبر `lib/db/repository.ts` يبقى المخزن الأساسي؛ السحابة (Auth + Database + ObjectStorage) طبقة مزامنة **اختيارية** + نسخ تلقائي سحابي، خلف مفتاح إعداد مغلق افتراضيًا. الواجهة تُعاد فوق نظام تصميم `components/patterns/` بمعمارية معلومات من 5 مجموعات تنقل، والصفحات تُفكّك إلى ≤300 سطر + `pages/<page>/components/`.

## Tech Stack

| الفئة | الاختيار |
|---|---|
| واجهة | React 19 + TS 5.6 strict + Vite 7 (root=client) + Tailwind v4 + shadcn/Radix + wouter (patch) |
| نماذج/تحقق | react-hook-form + zod (مخططات في `lib/validation/` ورسائلها مفاتيح ترجمة) |
| تخزين محلي | IndexedDB (SCHEMA_VERSION 10→11) + قاعدة مستقلة للتفضيلات `smart-trader-ui-preferences` |
| ترجمة | قوام مقسّم `lib/i18n/{ar,en,tr}/*.ts` + سكربت `scripts/i18n-check.ts` |
| سحابة | Atoms Cloud عبر metagptx/web-sdk (مزامنة اختيارية، routers تحت `/api/v1/`) |
| جودة | Vitest (اختبارات المحركات مجمّدة) + Prettier + tsc --noEmit + CI لاحق |

## Module Design

| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| نظام التصميم | بدائيات موحّدة (PageShell, Field, DataTable, StepWizard...) | `client/src/components/patterns/*` |
| الرموز | tokens المسافات/الخطوط/الألوان الدلالية (--input-surface, --computed-surface, --warning, --danger) | `client/src/index.css` |
| التنقل | AppLayout: 5 مجموعات + breadcrumb + شريط سفلي 5 خانات + collapse محفوظ | `client/src/components/AppLayout.tsx` |
| القواميس | مفاتيح `domain.screen.element` ثلاث لغات + i18n-check | `client/src/lib/i18n/*` |
| محركات التكلفة | **مجمّدة**: حاوية مفردة/حمولة مختلطة/تقارير قرار/أحدث سعر | `client/src/lib/{pricing,cargoPricing,cargoDecisionReports,latestItemPrice}.ts` |
| طبقة البيانات | Repository مجرّد + IndexedDB + مهاجرة v11 + اختياري تشفير AES-GCM | `client/src/lib/db/*` |
| المزامنة | local-first: دفع/سحب لقطات + نسخ تلقائي سحابي (خيار) | `client/src/lib/sync/*` + `app/backend/routers/sync.py` |
| الشاشات | صفحة لكل مسار إعدادات + ملف تكلفة 5 خطوات + سجل `/cargo/runs` | `client/src/pages/*` |

## Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| المحرك اليتيم pricing_runs | تحويل القراءات إلى cargo_cost_runs (لا إعادة وصل computePricing) | حاسبة الحمولة هي الإدخال الفعلي الوحيد؛ أقل كسرًا للسلوك |
| المزامنة | اختيارية، خلف إعداد، مع بقاء كل شيء يعمل offline | موافقة صريحة على تجاوز الممنوعة 2 مع الحفاظ على فلسلة خصوصية المنتج |
| العملات ISO | توحيد مبكر (M3) + مهاجرة معروضة في M8 | إضافة معتمدة 7 |
| LegacyUiLocalizer | حذف نهائي (M2) واستخراج كل النصوص | ممنوع MutationObserver |
| بنية المستودع | نقل كما هو إلى app/frontend (جذر واحد client/server/shared) | aliases وpnpm overrides مرتبطة بالجذر؛ تفعيل المنصة تطلب هذا المسار |

## File Tree Plan

```
app/frontend/
├── client/src/
│   ├── components/patterns/        # M1: PageShell, SectionCard, FormSection, FormGrid,
│   │                               #     Field, NumberField, CurrencyField, RateField,
│   │                               #     DateField, EntityPicker, DataTable, StatusPill,
│   │                               #     EmptyState, StepWizard, SummaryRail,
│   │                               #     InheritedValue, ConfirmDialog
│   ├── lib/i18n/{ar,en,tr}/        # M2: common,nav,entities,items,prices,cargo,
│   │                               #     reports,settings,backup,validation
│   ├── lib/validation/             # مخططات zod
│   ├── lib/sync/                   # X1: مزامنة سحابية اختيارية
│   ├── pages/settings/{Business,Financial,Catalog,Logistics,Workspace,Security,Data}.tsx  # M4
│   └── pages/cargo/{index,runs}.tsx + components/   # M6
├── scripts/i18n-check.ts           # M2
└── .github/workflows/ci.yml        # X3
```

## Implementation Guide

بوابة كل مرحلة قبل التسليم: `pnpm run check && pnpm test` أخضران + لا ملف مكوّن >300 سطر. الترتيب: M1 (قشرة+patterns) → M2 (ترجمة جذرية) → M3 (مرجعيات+ISO) → M4 (إعدادات) → M5 (لوحة تحكم) → M6 (ملف التكلفة+قفل الاعتماد) → M7 (تقارير+ربحية/تغطية) → M8 (v11+اختبار استعادة v10) → M9 (صقل) → الإضافات X1/X2/X3. حالات الانحدار الرقمي الثلاث يجب أن تبقى مطابقة بعد كل مرحلة تلمس التكلفة.
