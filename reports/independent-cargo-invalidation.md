# تقرير مستقل — إصلاح إبطال بيانات الحمولة

التاريخ: 2026-09-21
الفرع: `codex/cargo-invalidation`
النطاق: البند 2 فقط، على أساس البند 1 (`7a30b0e`)

## الحكم

تم تنفيذ إصلاح إبطال بيانات الحمولة والتحقق منه. عند تعديل أو حذف بيانات الحمولة، تُنشر إشارة revision مركزية، وتعيد الشاشات التي تقرأ بيانات الحمولة تحميلها دون polling أو تغيير في مخطط IndexedDB.

لم يبدأ البند 3: إعادة تصميم دورة حياة اتصال IndexedDB ما زالت خارج هذا الكوميت والنطاق.

## التشخيص الأصلي

كانت عمليات الحذف والكتابة في المستودع تعمل، لكن عدة مستهلكين كانوا يحمّلون البيانات داخل `useEffect(..., [])` مرة واحدة فقط. لذلك كانت الصفحة المركبة قد تحتفظ بسجل حمولة محذوف في الذاكرة حتى إعادة تركيبها أو التنقل بعيداً عنها.

المستهلكون الذين تم ربطهم بالإبطال:

- `useCargoData`
- `Reports`
- `CargoDecisionReports`
- `Home`
- `GlobalSearch` عند فتحه فقط
- `Runs`

## العقد المنفذ

أُضيفت وحدة مستقلة عن React في:

`app/frontend/client/src/lib/db/cargoDataEvents.ts`

وتوفر:

- `getCargoDataRevision()` لقراءة رقم revision الحالي.
- `subscribeCargoData(listener)` مع إلغاء اشتراك idempotent.
- `invalidateCargoData()` لإبطال قراءة واحدة.
- `withCargoDataBatch(work)` لتجميع إشعارات العمليات المركبة في إشعار واحد.

تستخدم React محولاً صغيراً في `useCargoDataRevision.ts` عبر `useSyncExternalStore`. الإبطال لا يمسح الفلاتر أو نص البحث أو المسودة النشطة. و`GlobalSearch` لا يعيد ضبط نص البحث عند وصول revision جديد؛ إعادة الضبط بقيت مرتبطة بفتح النافذة فقط.

## نقاط النشر

- الحفظ المباشر لـ run/item/line/allocation ينشر بعد نجاح `put` فقط.
- حذف run يغلف حذف الأبناء داخل دفعة واحدة، وينشر بعد اكتمال الحذف المتسلسل.
- حذف مجموعات الأبناء له دفعات مستقلة ولا ينشر عند عدم وجود صفوف مطابقة.
- `persistRun` يغلف حفظ run وحذف الأبناء وكتابة items/lines/allocations في دفعة واحدة.
- `importBackup` و`clearAll` أصبحا ضمن دفعات invalidation.
- لم تُضف إشعارات لقراءات البيانات أو كتابات الأسعار/الإعدادات غير المرتبطة بالحمولة.

## دليل RED ثم GREEN

قبل التنفيذ، فشلت الاختبارات المركزة بهذه الأدلة:

```text
cargoDataEvents.test.ts
Error: Cannot find module './cargoDataEvents'

cargoInvalidationRepository.test.ts / deleteCascade.test.ts / cargoPersistence.test.ts
4 notification assertions failed; existing data behavior tests remained green.
```

بعد التنفيذ:

```text
Test Files  4 passed (4)
Tests       16 passed (16)
```

اختبار دورة حياة React:

```text
✓ useCargoDataRevision.test.tsx (1 test)
```

اختبار المستهلكين المتأثرين:

```text
Test Files  4 passed (4)
Tests       14 passed (14)
```

اختبار mounted حقيقي باستخدام `fake-indexeddb` والمستودع الفعلي:

```text
✓ cargoInvalidation.integration.test.tsx (1 test)
  deleted run absent, survivor present
```

## بوابة القبول الكاملة

### فحص الأنواع

```text
> smart-trader@1.0.0 check
> tsc --noEmit

exit code: 0
```

### الاختبارات الكاملة

```text
Test Files  20 passed (20)
Tests       42 passed (42)
exit code: 0
```

### فحص i18n

ظل الفحص عند خط الأساس الموثق للبند 1: 22 مخالفة نصية موجودة مسبقاً. لم تُعدّل الملفات المخالفة لإخفاء النتيجة.

```text
i18n-check FAILED (22)
exit code: 1
```

المواضع التي أبلغ عنها الفحص:

```text
lib/cargoDecisionReports.ts:90,97,100,101,104,105
lib/db/indexedDbRepository.ts:227,230,241,242,243,244,255,258,269,271,272,283,286,965
lib/uiPreferencesStore.ts:32,81
```

### البناء

```text
✓ 2354 modules transformed.
✓ built in 17.44s
dist\index.js  788b
exit code: 0
```

ظهر تحذير حجم chunk أكبر من 500 kB، وهو تحذير بناء قائم وليس فشلاً.

## فحص النطاق

```text
git diff 7a30b0e --name-only
```

أكدت المراجعة أن الملفات التطبيقية الجديدة أو المعدلة محصورة في:

- وحدة event store واختبارها.
- ربط مستودع IndexedDB واختبارات الإبطال والحذف.
- `cargoPersistence` واختبار الحفظ المركب.
- محول React واختباره.
- المستهلكين الستة المحددين.
- اختبار mounted النهائي.
- مواصفة وخطة البند 2.
- هذا التقرير.

لم يحدث أي تعديل في:

- `schema.ts` أو migration جديدة.
- `cargoPricing.ts` أو `pricing.ts`.
- `cargoDecisionReports.ts` أو نموذج التقرير.
- دورة حياة اتصال IndexedDB، وهي البند 3.

## الكوميتات

- `f448583` — مواصفة تصميم إبطال بيانات الحمولة.
- `7dc7641` — خطة تنفيذ البند 2.
- `7a57af7` — إضافة event store.
- `852135f` — نشر إشعارات المستودع وتجميع الكتابات المركبة.
- `cceaa89` — ربط React والمستهلكين بالإبطال.
- `a7f6f79` — توافق event store مع هدف TypeScript الحالي.
- كوميت التقرير الحالي — تقرير التحقق المستقل.

## قرار التوقف

البند 2 مكتمل ومثبت بالاختبارات والبوابة الكاملة. أتوقف هنا بانتظار تأكيد صريح قبل بدء البند 3.
