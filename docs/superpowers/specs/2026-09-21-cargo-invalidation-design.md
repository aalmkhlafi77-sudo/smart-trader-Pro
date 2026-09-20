# طبقة إبطال بيانات الحمولات — مواصفة البند 2

## الهدف

إزالة البيانات القديمة من واجهات التطبيق فور نجاح حفظ أو تعديل أو حذف بيانات الحمولة، بحيث لا تبقى الحمولة المحذوفة ظاهرة في التقارير أو الصفحة الرئيسية أو البحث، دون تغيير صيغ التسعير أو منطق بناء صفوف التقارير.

## الفهم المعتمد

- حذف الحمولة وذرياتها في المستودع يعمل كما أثبته اختبار `deleteCascade.test.ts`.
- العلة في طبقة العرض: عدة واجهات تنفذ تحميلها داخل `useEffect(..., [])` مرة واحدة فقط.
- الواجهات المتأثرة فعلياً هي `Reports.tsx` و`components/CargoDecisionReports.tsx` و`Home.tsx` و`pages/home/GlobalSearch.tsx` و`pages/cargo/useCargoData.ts`، إضافة إلى صفحة `cargo/Runs.tsx` عند بقاءها مفتوحة أثناء تغيير البيانات من مكان آخر.
- `cargoPersistence.persistRun()` يحفظ السجل الرئيسي ثم يحذف ويعيد حفظ الذرّيات على عدة عمليات متتابعة؛ إطلاق إشعار بعد كل عملية منفردة قد يجعل التقارير تقرأ حالة جزئية.

## النطاق

يشمل هذا البند:

1. مخزناً صغيراً مستقلاً للأحداث/الإصدار في TypeScript بلا اعتماد على React.
2. Hook رفيع مبني على `useSyncExternalStore` لربط React بهذا المخزن.
3. إشعارات من مستودع IndexedDB بعد تغييرات بيانات الحمولات.
4. تجميع الإشعارات أثناء عملية الحفظ المركبة والاستيراد والحذف المتسلسل.
5. إعادة تحميل آمنة قابلة للإلغاء في الواجهات المتأثرة.

لا يشمل هذا البند:

- تغيير `lib/cargoPricing.ts` أو `lib/pricing.ts` أو `lib/cargoDecisionReports.ts`.
- إعادة تصميم المستودع أو تحويله إلى اتصال IndexedDB دائم؛ ذلك للبند 3.
- مزامنة بين علامات تبويب/نوافذ مختلفة.
- polling أو مؤقتات دورية أو شاشة جديدة.

## التصميم المختار

### 1. مخزن الإبطال غير المرتبط بـ React

إنشاء `app/frontend/client/src/lib/db/cargoDataEvents.ts` بواجهة محددة:

```ts
export type CargoDataListener = () => void;

export function getCargoDataRevision(): number;
export function subscribeCargoData(listener: CargoDataListener): () => void;
export function invalidateCargoData(): void;
export function withCargoDataBatch<T>(work: () => Promise<T>): Promise<T>;
```

السلوك:

- `getCargoDataRevision()` يعيد عداداً رقمياً يبدأ من صفر.
- `subscribeCargoData()` يضيف مستمعاً ويعيد دالة إزالة الاشتراك؛ الإزالة idempotent ولا تترك مستمعين بعد unmount.
- `invalidateCargoData()` يرفع العداد ويبلغ المستمعين فوراً إذا لم توجد batch مفتوحة.
- أثناء `withCargoDataBatch()` تُجمع كل الإبطالات في إشعار واحد عند خروج آخر batch، حتى عند وجود batches متداخلة.
- إذا فشلت العملية بعد حدوث كتابة، تُرسل الإشارة في `finally` حتى لا تبقى الواجهات على cache قديم أو جزئي.
- لا يحتوي الملف على React حتى يمكن اختباره وتشغيله من طبقة المستودع.

### 2. Hook React

إنشاء `app/frontend/client/src/lib/useCargoDataRevision.ts`:

```ts
export function useCargoDataRevision(): number;
```

يستخدم `useSyncExternalStore(subscribeCargoData, getCargoDataRevision, () => 0)`، ولا يحمل بيانات بنفسه. الواجهات تستخدم قيمة الإصدار كاعتمادية لإعادة تشغيل loader القائم.

### 3. إشعارات المستودع

يستدعي `indexedDbRepository` `invalidateCargoData()` بعد نجاح عمليات الحمولات التالية:

- `saveCargoCostRun`, `saveCargoCostItem`, `saveCargoCostLine`, `saveCargoCostAllocation`.
- `deleteCargoCostRun`, `deleteCargoCostItems`, `deleteCargoCostLines`, `deleteCargoCostAllocations`.
- `importBackup` و`clearAll` بعد تغييراتها.

العمليات المركبة تستخدم `withCargoDataBatch()` بحيث لا يرى المستمعون مرحلة وسيطة:

- `deleteCargoCostRun` يجمع حذف السجل والأبناء.
- `cargoPersistence.persistRun()` يجمع حفظ السجل وحذف الذرّيات وإعادة حفظها.
- `importBackup()` يجمع المسح والكتابة والترحيل.

الفشل قبل أي كتابة لا يرسل إشعاراً. الفشل بعد كتابة يرسل إشعاراً واحداً عند نهاية batch، حتى تعيد الواجهات القراءة من IndexedDB بدلاً من الاحتفاظ ببيانات قديمة.

### 4. ربط الواجهات

- `useCargoData.ts`: إعادة تشغيل `load` عند تغير revision، مع حماية الإلغاء الموجودة لمنع نتيجة طلب قديم من الكتابة بعد unmount.
- `Reports.tsx`: إضافة revision إلى اعتماد loader الحالي؛ لا تغيير في `buildReportRows` أو الفلاتر أو الحسابات.
- `components/CargoDecisionReports.tsx`: إعادة تحميل التفاصيل والمواقع عند revision؛ إبقاء `cargoDecisionReports.ts` للقراءة فقط.
- `Home.tsx`: إعادة تحميل العدادات والمحتوى الأخير عند revision.
- `pages/home/GlobalSearch.tsx`: إذا كان الحوار مفتوحاً أثناء التغيير، يعاد بناء الفهرس؛ إذا كان مغلقاً فلا تحميل غير ضروري.
- `cargo/Runs.tsx`: إعادة تحميل القائمة عند revision، مع إبقاء reload المحلي بعد الحذف لتحسين الاستجابة وعدم الاعتماد على ترتيب إشعار React.

كل loader يحتفظ بعلامة `cancelled` أو ما يعادلها، ولا يكتب إلى state بعد إلغاء الاشتراك أو بدء تحميل أحدث.

## تدفق البيانات

```text
write/delete/import
        │
        ▼
indexedDbRepository ── invalidateCargoData()
        │                         │
        └─ withCargoDataBatch() ──┘
                                  ▼
                         revision + subscribers
                                  ▼
                    useCargoDataRevision / React effects
                                  ▼
                              fresh reload
```

## الاختبارات ومعايير القبول

1. اختبار وحدة للمخزن يثبت: إشعار الإبطال، إزالة الاشتراك، تجميع nested batches، وإشعار الفشل بعد كتابة.
2. اختبار تكاملي للمستودع يثبت أن حفظ/تعديل/حذف حمولة يرسل إشعاراً، وأن حذف الحمولة يرسل إشعاراً واحداً لا إشعاراً لكل ذرية.
3. اختبار `persistRun` يثبت أن الكتابة المركبة لا تطلق إعادة تحميل جزئية، وأن المراقب يرى إشعاراً واحداً بعد اكتمالها.
4. اختبار Hook يثبت أن المستمع يُزال عند unmount وأن revision يعيد التصيير عند الإبطال.
5. الاختبارات الحالية الخاصة بـ`deleteCascade` و`cargoPersistence` تبقى ناجحة.
6. اختبار واجهة/دخان يثبت أن تشغيل تحديث ثم حذف السجل يزيله من قائمة التشغيل والتقرير والبحث عند بقائها مركبة، دون إعادة تحميل الصفحة.
7. بوابة القبول: `pnpm check`, `pnpm test`, `pnpm build`. يسجل `pnpm i18n-check` كما هو، ولا يُوسّع هذا البند لمعالجة مخالفاته القديمة.

## السلامة والتراجع

التغيير محصور في إشعار الذاكرة وإعادة التحميل؛ لا يحذف بيانات إضافية ولا يغير صيغة أو قيمة أي سجل. يمكن تعطيل الربط في الواجهات وإبقاء المستودع دون تغيير، لكن الاختبارات تمنع عودة التحميل أحادي المرة. لا توجد تغييرات على مخطط قاعدة البيانات.
