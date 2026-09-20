# تقرير البند 1 — إصلاح مخطط العملات واستعادة النسخ القديمة

## النتيجة

تم إصلاح علة `IndexedDB` الخاصة بجدول `currencies` على فرع العمل:

`codex/currency-schema-fix`

تم رفع `SCHEMA_VERSION` من 11 إلى 12، وأصبح جدول `currencies` يستخدم `code` كمفتاح، بينما بقيت بقية الجداول على `id`. نجحت التهيئة الجديدة، وترقية قاعدة v11، واستعادة نسخة قديمة لا تحتوي جدول العملات.

لم يتغير أي ملف منطق تسعير أو تقارير الحمولة المحمية في الطلب.

## تدقيق جميع الجداول قبل الإصلاح

تمت مطابقة `TABLES` مع إنشاء مخازن IndexedDB، وبذور البيانات، ومسارات `put()` و`importBackup()`.

| الجداول | المفتاح الفعلي المتوقع | الحكم |
|---|---:|---|
| `entities`, `categories`, `items`, `spec_templates`, `item_specs`, `item_prices`, `price_history`, `attachments`, `notes`, `tasks`, `backup_logs`, `pricing_runs` | `id` | سليم |
| `cargo_cost_runs`, `cargo_cost_items`, `cargo_cost_lines`, `cargo_cost_allocations` | `id` | سليم |
| `logistics_locations`, `logistics_rates`, `logistics_route_templates`, `price_lists`, `price_list_items` | `id` | سليم |
| `settings`, `meta`, `entity_contacts` | `id` | سليم |
| `currencies` | `code` | كان به خلل: الإنشاء العام كان يستخدم `id` |
| `units` | `id` | سليم؛ كل `DEFAULT_UNITS` تحتوي `id` |

الحكم الصريح على `units`: الصفر الذي ظهر في الفحص لم يكن عطلاً مستقلاً؛ توقف `init()` عند زرع العملات قبل الوصول إلى زرع الوحدات. بعد الإصلاح تم زرع 5 وحدات، واختبار التهيئة يثبت ذلك.

## دليل RED قبل الإصلاح

الإخفاق المركز قبل تعديل الإنتاج:

```text
FAIL src/lib/db/currencyInitialization.test.ts
DataError: Data provided to an operation does not meet requirements.
at indexedDbRepository.ts:87:7

FAIL src/lib/db/schemaIntegrity.test.ts
AssertionError: expected 'id' to be 'code'
Expected: "code"
Received: "id"
```

واختبار الحذف قبل الإصلاح أظهر نفس `DataError` ثم مهلة تنظيف 10 ثوانٍ بسبب اتصال التهيئة غير المغلق:

```text
DataError: Data provided to an operation does not meet requirements.
Error: Hook timed out in 10000ms.
```

## الإصلاح المنفذ

- إضافة خريطة واحدة لمسارات المفاتيح: `currencies -> code` وكل ما عداها `-> id`.
- ترقية المخطط إلى v12.
- عند ترقية قاعدة قديمة، إعادة إنشاء `currencies` فقط إذا كان مفتاحها خاطئاً، ثم إعادة زرع العملات.
- الإبقاء على بذور العملات بلا `id` صناعي.
- تحويل مسار الترحيل إلى `migrateToV12` مع الحفاظ على تحويل القيم العربية المعروفة وعدم تغيير القيم المجهولة.
- إغلاق اتصال IndexedDB المؤقت الذي تفتحه `init()`، لإزالة سبب مهلة تنظيف الاختبارات.

## دليل GREEN

الاختبارات المركزة بعد الإصلاح:

```text
Test Files  5 passed (5)
Tests       7 passed (7)
```

وتشمل:

- تدقيق مفتاح كل جدول.
- تهيئة قاعدة فارغة وزرع 8 عملات.
- ترقية قاعدة v11 مع حفظ سجل من جدول آخر.
- بقاء `units` بعدد 5.
- سلامة الحذف المتسلسل دون Timeout.
- بقاء اختبار ترحيل العملات المعروف أخضر.

## استعادة النسخة الاحتياطية القديمة

تم اختبار نسخة قديمة تحتوي جهة وصنفاً، ولا تحتوي `tables.currencies`، مع قيمة عملة مجهولة `دينار`.

المخرجات الفعلية:

```text
restore counts: entities: 1, items: 1, currencies: 0, units: 0
post-restore migration:
  unknownValues: [ 'دينار' ]
  seeded: { currencies: 8, units: 5 }
Test Files  1 passed (1)
Tests       1 passed (1)
```

الجهة والصنف استُعيدا، العملة المجهولة بقيت كما هي، وبذور العملات والوحدات أُعيدت تلقائياً.

## هل أُغلقت علة الاستعادة القديمة؟

نعم، أُغلقت علة الاستعادة القديمة إذا كان سببها هو رسالة:

```text
Failed to execute 'put' on 'IDBObjectStore': Evaluating the object store's key path did not yield a value
```

السبب مطابق لجذر `DataError` الذي أُعيد إنتاجه قبل الإصلاح: كائن `CurrencyRow` لا يحمل `id` بينما كان مخزن العملات يطلب `id`. الاختبار السابق للاستعادة يفشل لهذا السبب عند زرع العملات، وبعد جعل المفتاح `code` ينجح الاستيراد ويعيد البذور. لا يوجد في هذا البند دليل على علة أخرى منفصلة في تنسيق النسخة الاحتياطية.

## بوابة القبول

```text
pnpm check
> tsc --noEmit
EXIT_CODE=0
```

```text
pnpm test
Test Files  16 passed (16)
Tests       33 passed (33)
EXIT_CODE=0
```

```text
pnpm i18n-check
i18n-check FAILED (22)
EXIT_CODE=1
```

فشل `i18n-check` مستقل عن إصلاح العملات، ويشمل 22 نصاً حرفياً موجوداً قبل هذا البند، منها ستة في `lib/cargoDecisionReports.ts` المحمي من التعديل. لم أوسّع النطاق أو أعدّل ملفات التسعير/التقارير لإخفاء هذا الفشل.

```text
pnpm build
✓ 2352 modules transformed.
✓ built in 11.40s
EXIT_CODE=0
```

تحذير حجم الحزمة موجود كما كان، ولم يمنع نجاح البناء.

## الكوميتات

- `437da80` — مواصفة التصميم.
- `e50edef` — خطة التنفيذ.
- `9861a45` — اختبارات RED والتبعية.
- `ba65562` — إصلاح مخطط العملات وترقية v12.
- هذا الكوميت — التقرير المستقل واختبار النسخة القديمة.

توقفت هنا حسب البروتوكول. لم يبدأ البند 2.
