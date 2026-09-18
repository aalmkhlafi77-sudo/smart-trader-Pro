/**
 * M2 — بوابة الترجمة:
 * 1) صفر نص عربي مباشر خارج client/src/lib/i18n/** (مع قائمة استثناءات
 *    محمية لبيانات المستخدم/بيانات العرض الثابتة مثل رموز العملات وأنواع النقل).
 * 2) تكافؤ مفاتيح قواميس ar/en/tr.
 * الاستخدام: pnpm exec tsx scripts/i18n-check.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { TRANSLATIONS } from "../client/src/lib/i18n";

const AR = /[\u0600-\u06FF]/;
const SRC = join(process.cwd(), "client", "src");
const I18N_DIR = join(SRC, "lib", "i18n").split(sep).join("/");

/** أسماء متغيرات/خصائص يُسمح بالعربية داخل نطاق تعريفها (بيانات محمية). */
const ALLOW_DEC: Record<string, string[]> = {
  // بذور وخريطة ترحيل S5 (بيانات مرجعية لا نصوص واجهة)
  "lib/db/schema.ts": ["AR_CURRENCY_TO_ISO", "DEFAULT_CURRENCIES", "DEFAULT_UNITS"],
  // قيمة الوحدة الافتراضية المخزَّنة (ليست عملة — خارج نطاق ترحيل ISO)
  "pages/Items.tsx": ["ITEM_DATA_DEFAULTS"],
  // أسماء بنود التكلفة وأوضاع النقل المخزَّنة (بيانات منطقية/تشغيلية لا عملات)
  "pages/cargo/shared.ts": [
    "COST_BLUEPRINTS",
    "emptyDraft",
    "CUSTOMS_LINE_NAME",
    "FREIGHT_LINE_NAME",
    "CIF_INCLUDED_LABEL",
    "CIF_INCLUDED_REASON",
  ],
  "pages/cargo/steps/RouteStep.tsx": ["TRANSPORT_MODES"],
  "pages/settings/logistics/TemplateSheet.tsx": ["TRANSPORT_MODES"],
  "pages/Pricing.tsx": ["COST_BLUEPRINTS"],
  "pages/Reports.tsx": ["lookupSpec"],
};

/** نصوص عربية حرفية يُسمح بها في ملف بعينه (قيم بيانات/عملات/أنواع نقل). */
const ALLOW_EXACT: Record<string, string[]> = {
  // مفاتيح منطقية داخلية في دوال التسعير والتقارير لا نصوص واجهة (ممنوع مساس المنطق)
  "lib/cargoPricing.ts": ["الجمارك"],
  "lib/cargoDecisionReports.ts": ["الجمارك"],
  // سلاسل أرقام شرقية/فارسية للتحويل للأرقام اللاتينية (أرقام لا نصوص واجهة)
  "components/EnglishDatePicker.tsx": ["٠١٢٣٤٥٦٧٨٩", "۰۱۲۳۴۵۶۷۸۹"],
  "pages/Pricing.tsx": ["بحري", "بري", "جوي", "دولار", "ريال", "وحدة"],
  "pages/Reports.tsx": ["دولار"],
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (p.split(sep).join("/") === I18N_DIR) continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(entry) && !entry.includes(".test.")) {
      out.push(p);
    }
  }
  return out;
}

type Range = [number, number];

function collectAllowedRanges(sf: ts.SourceFile, fileKey: string): Range[] {
  const names = ALLOW_DEC[fileKey];
  const ranges: Range[] = [];
  if (!names?.length) return ranges;
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      names.includes(node.name.text) &&
      node.initializer
    ) {
      ranges.push([node.initializer.getStart(sf), node.initializer.getEnd()]);
    }
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      names.includes(node.name.text)
    ) {
      ranges.push([node.getStart(sf), node.getEnd()]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return ranges;
}

const violations: string[] = [];

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).split(sep).join("/");
  const text = readFileSync(file, "utf8");
  if (!AR.test(text)) continue;
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const ranges = collectAllowedRanges(sf, rel);
  const exact = ALLOW_EXACT[rel] ?? [];
  const inAllowed = (pos: number) =>
    ranges.some(([s, e]) => pos >= s && pos <= e);
  const flag = (node: ts.Node, value: string) => {
    if (inAllowed(node.getStart(sf))) return;
    if (exact.includes(value)) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    violations.push(`${rel}:${line + 1}: ${JSON.stringify(value)}`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) && AR.test(node.text)) flag(node, node.text);
    else if (ts.isNoSubstitutionTemplateLiteral(node) && AR.test(node.text))
      flag(node, node.text);
    else if (ts.isJsxText(node) && AR.test(node.text))
      flag(node, node.text.trim());
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

// تكافؤ المفاتيح بين اللغات الثلاث
const keySets = (["ar", "en", "tr"] as const).map(
  l => new Set(Object.keys(TRANSLATIONS[l]))
);
for (const k of keySets[0])
  for (const l of [1, 2])
    if (!keySets[l].has(k))
      violations.push(`i18n-parity: missing ${k} in ${["ar", "en", "tr"][l]}`);
for (const l of [1, 2])
  for (const k of keySets[l])
    if (!keySets[0].has(k))
      violations.push(`i18n-parity: extra ${k} in ${["ar", "en", "tr"][l]}`);

if (violations.length) {
  console.error(`i18n-check FAILED (${violations.length}):`);
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log(
  `i18n-check OK — keys=${keySets[0].size} ×3 languages, no direct Arabic outside dictionaries.`
);
