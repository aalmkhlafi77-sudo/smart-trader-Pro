---
last_updated: 2026-09-17T17:15:01Z
---

# Requirements & Progress

## Requirements Overview

طلب المستخدم التحقق من إمكانية الربط بمستودع GitHub خارجي ثم فحص بنية مشروعه وإعداد تقرير بنية فقط (بدون تطوير/بناء/نشر):
- المهمة 1: تحقق HTTP-only من وصول المستودع والفرع.
- المهمة 2: استنساخ خفيف في /tmp وفحص البنية والتقنيات والوحدات ومخطط البيانات، مع تعبئة ملفات السياق المشتركة.

## User Stories

- كمستخدم، أريد التأكد أن المستودع والفرع متاحان للعربيات قبل أي قرار تقني.
- كمستخدم، أريد تقريرًا منظّمًا بالعربية يشرح بنية المشروع ومكوّناته ومخاطره دون المساس بمساحة العمل.

## Task Breakdown
| ID | Task | Assignee | Status | Deps |
|----|------|----------|--------|------|
| 1 | تحقق وصول HTTP للمستودع والفرع Smart-Merchant-Branch | David | Done | - |
| 2 | فحص بنية المشروع (استنساخ /tmp) + تقرير عربي + تعبئة ملفات السياق | Alex | Done | 1 |
| 5.0 | خطوة صفر: استيراد المستودع إلى app/frontend + تفعيل Atoms Cloud | Alex | Done | 3 |
| 5.M0 | جرد الشاشات/الحقول/مفاتيح الترجمة (تقرير M0) | Alex | Done | 5.0 |
| 5.M1 | Tokens + patterns/ + AppLayout الجديد + التنقل المجمّع + Prettier | Alex | Done | 5.M0 |
| 5.M2 | حذف LegacyUiLocalizer + تقسيم القاموس + سكربت i18n-check | Alex | In Progress | 5.M1 |
| 5.M3 | إعادة بناء Entities/Items/Prices + ISO مبكر للعملات | Alex | Pending | 5.M2 |
| 5.M4 | تفكيك /settings إلى 8 مسارات + لوحة أثر الإعدادات | Alex | Pending | 5.M2 |
| 5.M5 | لوحة التحكم: بحث عام + صحة بيانات + مؤشرات قابلة للنقر | Alex | Pending | 5.M3 |
| 5.M6 | ملف التكلفة: StepWizard + SummaryRail + /cargo/runs + قفل الاعتماد | Alex | Pending | 5.M3 |
| 5.M7 | توحيد التقارير/التصدير + ربحية الصنف وصحة التغطية | Alex | Pending | 5.M6 |
| 5.M8 | مخطط v11 + تحويل العملات + اختبار استعادة v10 | Alex | Pending | 5.M3 |
| 5.M9 | صقل: وصول/أداء/حالات فارغة/توثيق | Alex | Pending | 5.M4-5.M8 |
| 5.X1 | مزامنة Atoms Cloud اختيارية (local-first) + نسخ تلقائي سحابي | Alex | Pending | 5.M8 |
| 5.X2 | تشفير IndexedDB AES-GCM اختياري (افتراضيًا مغلق) | Alex | Pending | 5.M8 |
| 5.X3 | CI GitHub Actions (check/test/build/i18n-check) + E2E | Alex | Pending | 5.M2 |

## Progress Log
- 2026-09-17: المهمة 1 مكتملة — المستودع والفرع متاحان (HTTP 200 للجميع)، لا حاجة لتوكن، عام.
- 2026-09-17: المهمة 2 مكتملة — استنساخ فحص في /tmp/smart-trader-analysis (commit b033098)، تحليل 155 ملفًا / ~17.5 ألف سطر TS/TSX، التقرير سُلّم نصيًا، ومُلئت ATOMS.md وPROGRESS.md وARCHITECTURE.md.
- 2026-09-17: TASK_ID 5 خطوة صفر مكتملة — استنساخ الفرع إلى /workspace/app/frontend (b033098) + template_config.json + تفعيل Atoms Cloud (app/backend) + خط أساس أخضر (check=0، vitest=7/7، pnpm install سليم).
- 2026-09-17: M0 مكتمل — تقرير الجرد في /workspace/reports/smart-trader-M0-inventory.md: 761 سطرًا عربيًا في TSX خارج القواميس مقابل 231 t()، 363 مفتاحًا ×3، خريطة المسارات/الحقول/التكرار وفجوات v10→v11.
- 2026-09-17: M1 مكتمل (commit 4951ea2) — رموز دلالية في index.css، مكتبة components/patterns (7 ملفات + index)، AppLayout مفكك ≤300 سطر (SidebarNav/HeaderBar/MobileTabBar/navGroups)، 5 مجموعات تنقل + breadcrumb + طي محفوظ، مسار /cargo مع إعادة توجيه /pricing، polyfill crypto.hash في vite.config.ts (Node 20.11). البوابة: check=0، test=7/7، build ناجح.

