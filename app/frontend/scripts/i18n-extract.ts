/**
 * M2 codemod — استخراج النصوص العربية من الواجهات إلى مفاتيح t().
 * - يطابق الحرف مع مفتاح قائم (قاموس ar) → يستبدله بـ t(key).
 * - يطابقه مع قاموس الجسر القديم → مفتاح جديد common.<slug> بترجمات en/tr الجاهزة.
 * - يطابقه مع التراكب scripts/i18n-overlay.json → مفتاح جديد بترجمات مكتوبة.
 * - غير المطابق يُبلَّغ + يُضاف إلى مسودة التراكب.
 * الاستخدام: pnpm exec tsx scripts/i18n-extract.ts [--write]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ts from "typescript";
import { TRANSLATIONS } from "../client/src/lib/i18n";

const HERE = dirname(fileURLToPath(import.meta.url));
const LEGACY_UI_TEXT: Record<string, { en?: string; tr?: string }> = JSON.parse(
  readFileSync(join(HERE, "i18n-legacy-bridge.json"), "utf8")
);
const EXTRA_LEGACY_UI_TEXT: Record<string, { en?: string; tr?: string }> = {};
const SRC = join(HERE, "../client/src");
const WRITE = process.argv.includes("--write");

const FILES = [
  "pages/Settings.tsx",
  "pages/Items.tsx",
  "pages/Pricing.tsx",
  "pages/Reports.tsx",
  "pages/Backup.tsx",
  "pages/Entities.tsx",
  "pages/ExportLists.tsx",
  "pages/Prices.tsx",
  "pages/FollowUp.tsx",
  "pages/Home.tsx",
  "components/CargoDecisionReports.tsx",
  "components/LogisticsTemplatesSettingsCard.tsx",
  "components/AttachmentsPanel.tsx",
  "components/SectionCard.tsx",
  "components/EmptyHint.tsx",
  "components/RecordControls.tsx",
  "components/SettingsFold.tsx",
  "components/TaskCalendarCard.tsx",
  "components/AccessGate.tsx",
  "components/AccessSettingsCard.tsx",
  "components/ActivityKpiCards.tsx",
  "components/LanguageSwitcher.tsx",
  "components/LoginBackgroundSettingsCard.tsx",
  "components/MultiScreenCalculator.tsx",
  "components/FloatingCalculator.tsx",
  "components/FloatingCalculatorSettingsCard.tsx",
  "components/WorkspaceCustomizationCard.tsx",
  "components/AppLayout.tsx",
];

const DOMAIN_BY_FILE: Record<string, string> = {
  "pages/Settings.tsx": "settings",
  "pages/Items.tsx": "items",
  "pages/Pricing.tsx": "cargo",
  "pages/Reports.tsx": "reports",
  "pages/Backup.tsx": "backup",
  "pages/Entities.tsx": "entities",
  "pages/ExportLists.tsx": "export",
  "pages/Prices.tsx": "prices",
  "pages/FollowUp.tsx": "followup",
  "pages/Home.tsx": "home",
  "components/CargoDecisionReports.tsx": "cargo",
  "components/LogisticsTemplatesSettingsCard.tsx": "settings",
  "components/AttachmentsPanel.tsx": "common",
  "components/SectionCard.tsx": "common",
  "components/EmptyHint.tsx": "common",
  "components/RecordControls.tsx": "common",
  "components/SettingsFold.tsx": "settings",
  "components/TaskCalendarCard.tsx": "home",
  "components/AccessGate.tsx": "access",
  "components/AccessSettingsCard.tsx": "access",
  "components/ActivityKpiCards.tsx": "home",
  "components/LanguageSwitcher.tsx": "common",
  "components/LoginBackgroundSettingsCard.tsx": "settings",
  "components/MultiScreenCalculator.tsx": "multiCalc",
  "components/FloatingCalculator.tsx": "multiCalc",
  "components/FloatingCalculatorSettingsCard.tsx": "multiCalc",
  "components/WorkspaceCustomizationCard.tsx": "home",
  "components/AppLayout.tsx": "common",
  "lib/uiPreferencesStore.ts": "home",
};

const AR = /[\u0600-\u06FF]/;

const arToKey = new Map<string, string>();
for (const [key, value] of Object.entries(TRANSLATIONS.ar)) {
  if (!arToKey.has(value)) arToKey.set(value, key);
}
const legacy: Record<string, { en?: string; tr?: string }> = {
  ...LEGACY_UI_TEXT,
  ...EXTRA_LEGACY_UI_TEXT,
} as Record<string, { en?: string; tr?: string }>;

function norm(value: string) {
  return value
    .replace(/[\u200c\u200d\u0640]/g, "")
    .replace(/[؟?.,:;!"'“”‘’…]+$/g, "")
    .replace(/^[·\-–—\s]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
const arToKeyNorm = new Map<string, string>();
for (const [key, value] of Object.entries(TRANSLATIONS.ar)) {
  const n = norm(value);
  if (!arToKeyNorm.has(n)) arToKeyNorm.set(n, key);
}
const legacyNorm = new Map<string, { en?: string; tr?: string }>();
for (const [text, pair] of Object.entries(legacy)) {
  const n = norm(text);
  if (!legacyNorm.has(n)) legacyNorm.set(n, pair);
}

type OverlayEntry = { key: string; en: string; tr: string };
const overlayPath = join(HERE, "i18n-overlay.json");
const overlay: Record<string, OverlayEntry> = existsSync(overlayPath)
  ? JSON.parse(readFileSync(overlayPath, "utf8"))
  : {};

const usedKeys = new Set<string>(Object.keys(TRANSLATIONS.ar));
const addedKeys = new Map<string, { key: string; en: string; tr: string }>();
const unresolved = new Map<string, { file: string; line: number }>();

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "text"
  );
}

function assignKey(text: string, file: string): string | null {
  const existing = arToKey.get(text) ?? arToKeyNorm.get(norm(text));
  if (existing) return existing;
  if (addedKeys.has(text)) return addedKeys.get(text)!.key;
  const leg = legacy[text] ?? legacyNorm.get(norm(text));
  if (leg?.en && leg?.tr) {
    let key = `common.${slugify(leg.en)}`;
    let n = 2;
    while (usedKeys.has(key)) key = `common.${slugify(leg.en)}${n++}`;
    usedKeys.add(key);
    addedKeys.set(text, { key, en: leg.en, tr: leg.tr });
    return key;
  }
  const ov = overlay[text];
  if (ov?.key && ov.en && ov.tr) {
    usedKeys.add(ov.key);
    addedKeys.set(text, { key: ov.key, en: ov.en, tr: ov.tr });
    return ov.key;
  }
  if (!unresolved.has(text)) {
    const line = text.slice(0, 0);
    void line;
    unresolved.set(text, { file, line: 0 });
  }
  return null;
}

type Edit = { start: number; end: number; replacement: string };

function coreRange(value: string): [number, number] | null {
  let first = -1;
  let last = -1;
  for (let i = 0; i < value.length; i += 1) {
    if (AR.test(value[i])) {
      if (first === -1) first = i;
      last = i;
    }
  }
  return first === -1 ? null : [first, last + 1];
}

const report: string[] = [];

for (const rel of FILES) {
  const filePath = join(SRC, rel);
  const text = readFileSync(filePath, "utf8");
  const sf = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX
  );
  const edits: Edit[] = [];
  const domain = DOMAIN_BY_FILE[rel] ?? "common";
  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i += 1)
    if (text[i] === "\n") lineStarts.push(i + 1);
  function lineHasMarker(pos: number) {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    const next = lineStarts[lo + 1] ?? text.length;
    return text.slice(lineStarts[lo], next).includes("i18n-deep");
  }

  function keyFor(value: string) {
    return assignKey(value, rel);
  }

  function literalEdit(
    node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral
  ) {
    const value = node.getText(sf).slice(1, -1);
    if (!AR.test(value)) return;
    const parent = node.parent;
    let deep = false;
    if (ts.isJsxAttribute(parent)) {
      const attr = parent.name.getText(sf);
      if (
        ![
          "placeholder",
          "title",
          "aria-label",
          "alt",
          "hint",
          "stamp",
          "text",
          "subtitle",
          "description",
        ].includes(attr)
      )
        return;
    } else if (ts.isPropertyAssignment(parent)) {
      if (parent.name === node) return; // مفتاح كائن عربي — يُعالج يدويًا
      if (!lineHasMarker(node.getStart(sf))) return;
      deep = true;
    } else if (ts.isArrayLiteralExpression(parent)) {
      if (!lineHasMarker(node.getStart(sf))) return;
      deep = true;
    } else if (
      ts.isBinaryExpression(parent) ||
      (ts.isVariableDeclaration(parent) &&
        /^[A-Z_]+$/.test(parent.name.getText(sf)))
    ) {
      return; // قيم بيانات مخزّنة/مقارنات/قاموس مفردات — تُعالج يدويًا أو بـ i18n-allow
    }
    void deep;
    const key = keyFor(value);
    if (!key) return;
    if (ts.isJsxAttribute(parent)) {
      edits.push({
        start: node.getStart(sf),
        end: node.getEnd(),
        replacement: `{t("${key}")}`,
      });
    } else {
      edits.push({
        start: node.getStart(sf),
        end: node.getEnd(),
        replacement: `t("${key}")`,
      });
    }
  }

  function jsxTextEdit(node: ts.JsxText) {
    const start = node.pos;
    const end = node.end;
    const slice = text.slice(start, end);
    const core = coreRange(slice);
    if (!core) return;
    const value = slice.slice(core[0], core[1]).replace(/\s+/g, " ").trim();
    const key = keyFor(value);
    if (!key) return;
    edits.push({
      start: start + core[0],
      end: start + core[1],
      replacement: `{t("${key}")}`,
    });
  }

  function templatePartEdit(start: number, end: number) {
    const slice = text.slice(start, end);
    let cursor = 0;
    while (cursor < slice.length) {
      const core = coreRange(slice.slice(cursor));
      if (!core) break;
      const abs = cursor + core[0];
      const value = slice
        .slice(cursor + core[0], cursor + core[1])
        .replace(/\s+/g, " ")
        .trim();
      const key = keyFor(value);
      if (!key) break;
      edits.push({
        start: start + abs,
        end: start + cursor + core[1],
        replacement: `\${t("${key}")}`,
      });
      cursor += core[1];
    }
  }

  function visit(node: ts.Node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (
        ts.isImportDeclaration(node.parent) ||
        ts.isExportDeclaration(node.parent)
      )
        return;
      literalEdit(node);
      return;
    }
    if (ts.isJsxText(node)) {
      jsxTextEdit(node);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      const headStart = node.head.getStart(sf) + 1;
      templatePartEdit(headStart, node.head.end - 2);
      for (const span of node.templateSpans) {
        const midStart = span.literal.getStart(sf) + 1;
        const isTail = !ts.isTemplateMiddle(span.literal);
        templatePartEdit(midStart, span.literal.getEnd() - (isTail ? 1 : 2));
        visit(span.expression);
      }
      return;
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sf, visit);

  if (!edits.length) continue;

  const unique = new Map<string, Edit>();
  for (const e of edits) unique.set(`${e.start}:${e.end}`, e);
  const sorted = [...unique.values()].sort((a, b) => b.start - a.start);
  let output = text;
  for (const e of sorted) {
    output = output.slice(0, e.start) + e.replacement + output.slice(e.end);
  }

  // حالة الخطاف t
  const hasT =
    /const\s*{\s*t\s*}\s*=\s*useLanguage\(\)/.test(output) ||
    /const\s*{[^}]*\bt\b[^}]*}\s*=\s*useLanguage\(\)/.test(output);
  const hasHook = /useLanguage\(\)/.test(output);
  report.push(
    `${rel}: edits=${sorted.length} hasT=${hasT} hasHook=${hasHook} needsImport=${!hasHook}`
  );

  if (WRITE) writeFileSync(filePath, output);
}

writeFileSync(
  join(HERE, "i18n-added-keys.json"),
  JSON.stringify(Object.fromEntries(addedKeys), null, 2)
);

let draft = "";
for (const value of unresolved.keys()) draft += `${value}\n`;
writeFileSync(join(HERE, "i18n-unresolved.txt"), draft);

console.log(report.join("\n"));
console.log(
  `added=${addedKeys.size} unresolved=${unresolved.size} write=${WRITE}`
);
