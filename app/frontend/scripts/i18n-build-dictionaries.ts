/**
 * M2 — توليد القواميس النهائية المقسّمة domain-first تحت client/src/lib/i18n/.
 * يدمج: TRANSLATIONS القديمة + run1 + run2 + run3 + overlay + manual-keys.
 * الأولوية للأول تسجيلًا (لا يُستبدل مفتاح موجود).
 * الاستخدام: pnpm exec tsx scripts/i18n-build-dictionaries.ts
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TRANSLATIONS } from "../client/src/lib/i18n";

type Lang = "ar" | "en" | "tr";
type Dict = Record<string, string>;

const ROOT = process.cwd();
const OUT = join(ROOT, "client", "src", "lib", "i18n");

const final: Record<Lang, Dict> = {
  ar: { ...TRANSLATIONS.ar },
  en: { ...TRANSLATIONS.en },
  tr: { ...TRANSLATIONS.tr },
};

function mergeFromTextKey(file: string) {
  const j = JSON.parse(readFileSync(join(ROOT, file), "utf8")) as Record<
    string,
    { key: string; en: string; tr: string }
  >;
  for (const [arText, v] of Object.entries(j)) {
    if (!(v.key in final.ar)) final.ar[v.key] = arText;
    if (!(v.key in final.en)) final.en[v.key] = v.en;
    if (!(v.key in final.tr)) final.tr[v.key] = v.tr;
  }
}

function mergeFromKey(file: string) {
  const j = JSON.parse(readFileSync(join(ROOT, file), "utf8")) as Record<
    string,
    { ar: string; en: string; tr: string }
  >;
  for (const [key, v] of Object.entries(j)) {
    if (!(key in final.ar)) final.ar[key] = v.ar;
    if (!(key in final.en)) final.en[key] = v.en;
    if (!(key in final.tr)) final.tr[key] = v.tr;
  }
}

mergeFromTextKey("scripts/i18n-added-keys-run1.json");
mergeFromTextKey("scripts/i18n-added-keys-run2.json");
mergeFromTextKey("scripts/i18n-added-keys-run3.json");
mergeFromTextKey("scripts/i18n-overlay.json");
mergeFromKey("scripts/i18n-manual-keys.json");

// فحص التكافؤ: كل مفتاح في ar يجب أن يوجد في en و tr
const allKeys = Object.keys(final.ar).sort();
const problems: string[] = [];
for (const lang of ["en", "tr"] as Lang[]) {
  for (const k of allKeys)
    if (!(k in final[lang])) problems.push(`${lang} missing ${k}`);
  for (const k of Object.keys(final[lang]))
    if (!(k in final.ar)) problems.push(`ar missing ${k}`);
}
if (problems.length) {
  console.error("PARITY PROBLEMS:\n" + problems.join("\n"));
  process.exit(1);
}

// تجميع حسب البادئة (النطاق)
const KNOWN = new Set([
  "common",
  "nav",
  "home",
  "entities",
  "items",
  "prices",
  "cargo",
  "multiCalc",
  "reports",
  "followup",
  "export",
  "backup",
  "settings",
  "access",
]);
const domains = new Map<string, string[]>();
for (const k of allKeys) {
  const prefix = k.split(".")[0];
  const domain = KNOWN.has(prefix) ? prefix : "ui";
  if (!domains.has(domain)) domains.set(domain, []);
  domains.get(domain)!.push(k);
}

const MAX_LINES = 260; // حد أمان دون 300

function writeDomainFile(lang: Lang, name: string, keys: string[]): string {
  const lines: string[] = [
    "const dict: Record<string, string> = {",
    ...keys.map(
      k => `  ${JSON.stringify(k)}: ${JSON.stringify(final[lang][k])},`
    ),
    "};",
    "",
    "export default dict;",
    "",
  ];
  writeFileSync(join(OUT, lang, `${name}.ts`), lines.join("\n"));
  return name;
}

for (const lang of ["ar", "en", "tr"] as Lang[]) {
  rmSync(join(OUT, lang), { recursive: true, force: true });
  mkdirSync(join(OUT, lang), { recursive: true });
  const moduleNames: string[] = [];
  const varName = (m: string) => "dict_" + m.replace(/-/g, "_");
  for (const [domain, keys] of [...domains.entries()].sort()) {
    if (keys.length + 5 <= MAX_LINES) {
      moduleNames.push(writeDomainFile(lang, domain, keys));
    } else {
      const chunks: string[][] = [];
      for (let i = 0; i < keys.length; i += MAX_LINES - 5)
        chunks.push(keys.slice(i, i + MAX_LINES - 5));
      chunks.forEach((chunk, idx) => {
        moduleNames.push(writeDomainFile(lang, `${domain}-${idx + 1}`, chunk));
      });
    }
  }
  const idxLines = [
    ...moduleNames.map(m => `import ${varName(m)} from "./${m}";`),
    "",
    `const merged: Record<string, string> = {`,
    ...moduleNames.map(m => `  ...${varName(m)},`),
    "};",
    "",
    "export default merged;",
    "",
  ];
  writeFileSync(join(OUT, lang, "index.ts"), idxLines.join("\n"));
}

const rootIndex = `/**
 * قاموس الواجهة — بيانات المستخدم لا تمر عبر هذا القاموس وتبقى بلغتها الأصلية.
 * مُولّد من scripts/i18n-build-dictionaries.ts — لا تحرر ملفات النطاقات يدويًا.
 */
export type AppLanguage = "ar" | "en" | "tr";

export const LANGUAGE_OPTIONS: Array<{
  code: AppLanguage;
  label: string;
  native: string;
  dir: "rtl" | "ltr";
}> = [
  { code: "ar", label: "العربية", native: "العربية", dir: "rtl" },
  { code: "en", label: "English", native: "English", dir: "ltr" },
  { code: "tr", label: "Türkçe", native: "Türkçe", dir: "ltr" },
];

type Dictionary = Record<string, string>;

import ar from "./ar";
import en from "./en";
import tr from "./tr";

export const TRANSLATIONS: Record<AppLanguage, Dictionary> = { ar, en, tr };

export function translate(language: AppLanguage, key: string) {
  return TRANSLATIONS[language][key] ?? TRANSLATIONS.ar[key] ?? key;
}
`;
writeFileSync(join(OUT, "index.ts"), rootIndex);

console.log(
  `keys=${allKeys.length} domains=${domains.size} out=client/src/lib/i18n`
);
