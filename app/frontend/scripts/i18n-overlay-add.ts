/**
 * M2 — يدمج مفاتيح تراكب جديدة في scripts/i18n-overlay.json (سطر واحد لكل مفتاح).
 * الاستخدام: pnpm exec tsx scripts/i18n-overlay-add.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

type Entry = { key: string; en: string; tr: string };

const HERE = dirname(fileURLToPath(import.meta.url));
const OVERLAY = join(HERE, "i18n-overlay.json");

const additions: Record<string, Entry> = {
  "قيمة الفاتورة / المصنع": {
    key: "cargo.stageInvoiceFactory",
    en: "Invoice value / factory",
    tr: "Fatura değeri / fabrika",
  },
  "واصل الميناء": {
    key: "cargo.stageArrivedPort",
    en: "Arrived at port",
    tr: "Limana ulaştı",
  },
  "بعد الجمارك والتخليص": {
    key: "cargo.stageAfterCustoms",
    en: "After customs & clearance",
    tr: "Gümrük ve gümrüklemeden sonra",
  },
  "واصل المستودع": {
    key: "cargo.stageArrivedWarehouse",
    en: "Arrived at warehouse",
    tr: "Depoya ulaştı",
  },
  "الميناء والشحن": {
    key: "cargo.metaPortShipping",
    en: "Port & shipping",
    tr: "Liman ve nakliye",
  },
  "النقل والتسليم": {
    key: "cargo.metaDeliveryTransport",
    en: "Transport & delivery",
    tr: "Taşıma ve teslim",
  },
  مسودة: { key: "cargo.statusDraft", en: "Draft", tr: "Taslak" },
  "قيد المراجعة": {
    key: "cargo.statusReview",
    en: "Under review",
    tr: "İncelemede",
  },
  معتمد: { key: "cargo.statusApproved", en: "Approved", tr: "Onaylandı" },
  مؤرشف: { key: "cargo.statusArchived", en: "Archived", tr: "Arşivlendi" },
  مدخل: { key: "cargo.costStatusEntered", en: "Entered", tr: "Girildi" },
  "طرف ثالث": {
    key: "cargo.costStatusThirdParty",
    en: "Third party",
    tr: "Üçüncü taraf",
  },
  معطل: { key: "cargo.costStatusDisabled", en: "Disabled", tr: "Devre dışı" },
  "مقارنة-مسارات-التاجر-الذكي": {
    key: "cargo.routesComparisonFileName",
    en: "smart-trader-routes-comparison",
    tr: "akilli-tacar-guzergah-karsilastirma",
  },
  "ملف الحمولة": {
    key: "cargo.cargoLoadFileWord",
    en: "Cargo file",
    tr: "Yük dosyası",
  },
  المسار: { key: "cargo.routeWord", en: "Route", tr: "Güzergâh" },
  اللوجستيات: { key: "cargo.logisticsWord", en: "Logistics", tr: "Lojistik" },
  "نقص التسعير": {
    key: "cargo.pricingGap",
    en: "Pricing gap",
    tr: "Fiyatlama eksiği",
  },
  البند: { key: "cargo.lineItemWord", en: "Line", tr: "Kalem" },
  المرحلة: { key: "cargo.stageWord", en: "Stage", tr: "Aşama" },
  "المبلغ المحلي": {
    key: "cargo.localAmountWord",
    en: "Local amount",
    tr: "Yerel tutar",
  },
  "يعتمد التقرير على لقطة ملف التكلفة المحفوظة ولا يعيد احتساب أسعار القوالب الحالية.":
    {
      key: "cargo.breakdownFooterNote",
      en: "The report relies on the saved cost file snapshot and does not recalculate current template prices.",
      tr: "Rapor, kaydedilmiş maliyet dosyası anlık görüntüsüne dayanır ve güncel şablon fiyatlarını yeniden hesaplamaz.",
    },
  "تقرير قرار الشحن والتكلفة": {
    key: "cargo.decisionReportTitle",
    en: "Shipping & cost decision report",
    tr: "Nakliye ve maliyet karar raporu",
  },
  "مقارنة المسارات وتفكيك ملف تكلفة حمولة محفوظ": {
    key: "cargo.decisionReportSubtitle",
    en: "Routes comparison and breakdown of a saved cargo cost file",
    tr: "Kayıtlı bir yük maliyet dosyasının güzergâh karşılaştırması ve dökümü",
  },
  "1. مقارنة المسارات": {
    key: "cargo.sectionRoutesComparison",
    en: "1. Routes comparison",
    tr: "1. Güzergâh karşılaştırması",
  },
  "يرتب الجدول الملفات المحفوظة حسب إجمالي التكلفة. لا تعني المرتبة الأقل توصية مطلقة عند اختلاف محتوى الشحنة أو كمياتها.":
    {
      key: "cargo.sectionRoutesNote",
      en: "The table orders saved files by total cost. A lower rank is not an absolute recommendation when shipment content or quantities differ.",
      tr: "Tablo kayıtlı dosyaları toplam maliyete göre sıralar. Gönderi içeriği veya miktarları farklıysa daha düşük sıra mutlak bir tavsiye değildir.",
    },
  الفاتورة: { key: "cargo.invoiceShort", en: "Invoice", tr: "Fatura" },
  "2. توزيع مراحل التكلفة": {
    key: "cargo.sectionStageDistribution",
    en: "2. Cost stage distribution",
    tr: "2. Maliyet aşamalarının dağılımı",
  },
  "يظهر الرسم الدائري نسبة كل مرحلة من إجمالي التكلفة؛ لا تظهر البنود الصفرية أو المشمولة في الرسم.":
    {
      key: "cargo.sectionDonutNote",
      en: "The donut chart shows each stage's share of the total cost; zero or included lines are not shown.",
      tr: "Halka grafiği her aşamanın toplam maliyete oranını gösterir; sıfır veya dahil kalemler gösterilmez.",
    },
  "توزيع نسب تكلفة الشحنة": {
    key: "cargo.donutTitle",
    en: "Shipment cost share distribution",
    tr: "Gönderi maliyet oranları dağılımı",
  },
  النسبة: { key: "cargo.shareWord", en: "Share", tr: "Oran" },
  "3. مؤشرات ملف التكلفة المختار": {
    key: "cargo.sectionSelectedIndicators",
    en: "3. Selected cost file indicators",
    tr: "3. Seçilen maliyet dosyası göstergeleri",
  },
  المؤشر: { key: "cargo.indicatorWord", en: "Indicator", tr: "Gösterge" },
  "4. تفكيك بنود تكلفة الشحنة": {
    key: "cargo.sectionBreakdownLines",
    en: "4. Shipment cost lines breakdown",
    tr: "4. Gönderi maliyet kalemleri dökümü",
  },
  "المبالغ مبنية على لقطة الملف المحفوظة ولا يعاد احتسابها بأسعار القوالب الحالية.":
    {
      key: "cargo.breakdownLinesNote",
      en: "Amounts are based on the saved file snapshot and are not recalculated with current template prices.",
      tr: "Tutarlar kayıtlı dosya anlık görüntüsüne dayanır ve güncel şablon fiyatlarıyla yeniden hesaplanmaz.",
    },
  "يُعرض بند «يلزم تسعير» كبيان ناقص ولا يُعامل كقيمة صفرية. تبقى كل البيانات محلية على الجهاز.":
    {
      key: "cargo.comprehensiveFooterNote",
      en: "The «Needs pricing» line is shown as a missing statement and is never treated as zero. All data remains local on the device.",
      tr: "«Fiyatlama gerekli» satırı eksik bir ifade olarak gösterilir ve sıfır değeri olarak işleme alınmaz. Tüm veriler cihazda yerel kalır.",
    },
  "أقل تكلفة شحنة": {
    key: "cargo.kpiLowestShipment",
    en: "Lowest shipment cost",
    tr: "En düşük gönderi maliyeti",
  },
  "أقل تكلفة وحدة": {
    key: "cargo.kpiLowestUnit",
    en: "Lowest unit cost",
    tr: "En düşük birim maliyeti",
  },
  "ملفات قابلة للمقارنة": {
    key: "cargo.kpiComparableFiles",
    en: "Comparable files",
    tr: "Karşılaştırılabilir dosyalar",
  },
  "ملفات غير مؤرشفة": {
    key: "cargo.kpiNotArchived",
    en: "Non-archived files",
    tr: "Arşivlenmemiş dosyalar",
  },
  "بنود تحتاج تسعيراً": {
    key: "cargo.kpiNeedsPricing",
    en: "Lines needing pricing",
    tr: "Fiyatlama bekleyen kalemler",
  },
  "بند المصروف": {
    key: "cargo.expenseLineWord",
    en: "Expense line",
    tr: "Gider kalemi",
  },
  "احتساب التكلفة": {
    key: "items.calculateCost",
    en: "Calculate cost",
    tr: "Maliyeti hesapla",
  },
  "عرض البطاقة الكاملة": {
    key: "items.viewFullCard",
    en: "View full card",
    tr: "Tam kartı görüntüle",
  },
  "الصور والمرفقات": {
    key: "items.imagesAttachments",
    en: "Images & attachments",
    tr: "Görseller ve ekler",
  },
  "تكرار الصنف": {
    key: "items.duplicateItem",
    en: "Duplicate item",
    tr: "Ürünü çoğalt",
  },
  "تعديل الصنف": {
    key: "items.editItem",
    en: "Edit item",
    tr: "Ürünü düzenle",
  },
  "حذف الصنف": { key: "items.deleteItem", en: "Delete item", tr: "Ürünü sil" },
  "تعديل الأسعار": {
    key: "prices.editPrices",
    en: "Edit prices",
    tr: "Fiyatları düzenle",
  },
  "تعديل الجهة": {
    key: "entities.editPartner",
    en: "Edit partner",
    tr: "Tarafı düzenle",
  },
  "تقرير-التاجر-الذكي": {
    key: "reports.fileName",
    en: "smart-trader-report",
    tr: "akilli-tacar-raporu",
  },
  "كشف الأصناف والجهات والمواصفات والأسعار": {
    key: "reports.pdfSubtitle",
    en: "Items, partners, specifications and prices statement",
    tr: "Ürünler, taraflar, özellikler ve fiyatlar listesi",
  },
  "سعر المورد ظاهر بعملته الأصلية كما سُجّل للصنف، ولا تُحوّل هذه القيمة إلى العملة المحلية.":
    {
      key: "reports.supplierCurrencyNote",
      en: "Supplier price is shown in its original currency as recorded for the item; this value is not converted to the local currency.",
      tr: "Tedarikçi fiyatı, ürün için kaydedildiği orijinal para biriminde gösterilir ve yerel paraya dönüştürülmez.",
    },
  "حسب آخر حساب": {
    key: "reports.byLastCalc",
    en: "Per last calculation",
    tr: "Son hesaplamaya göre",
  },
  "آخر حساب محفوظ": {
    key: "reports.lastSavedCalc",
    en: "Last saved calculation",
    tr: "Kaydedilen son hesaplama",
  },
  الهامش: { key: "reports.marginShort", en: "Margin", tr: "Marj" },
  "سعر المورد الأصلي": {
    key: "reports.supplierOriginal",
    en: "Original supplier price",
    tr: "Orijinal tedarikçi fiyatı",
  },
  "عملة المورد": {
    key: "reports.supplierCurrencyWord",
    en: "Supplier currency",
    tr: "Tedarikçi para birimi",
  },
};

const current: Record<string, Entry> = JSON.parse(
  readFileSync(OVERLAY, "utf8")
);
const merged = { ...current, ...additions };
const lines = Object.entries(merged).map(
  ([text, v]) => `  ${JSON.stringify(text)}: ${JSON.stringify(v)}`
);
writeFileSync(OVERLAY, `{\n${lines.join(",\n")}\n}\n`);
console.log(
  `overlay total=${Object.keys(merged).length} added=${Object.keys(additions).length}`
);
