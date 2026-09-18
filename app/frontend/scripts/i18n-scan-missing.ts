/**
 * M2 — يمسح كل t("key") المستخدمة في client/src ويقارنها بالمفاتيح المعرفة
 * في lib/i18n.ts + ملفات المفاتيح المضافة (run1/run2/run3) + التراكب.
 * الاستخدام: pnpm exec tsx scripts/i18n-scan-missing.ts
 */
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join, relative, basename } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "client", "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry) && !entry.includes(".test.")) out.push(p);
  }
  return out;
}

const KEY_RE = /"([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)":/;

const used = new Map<string, Set<string>>();
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(
    /\bt\(\s*"([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)"/g
  )) {
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1])!.add(relative(ROOT, file));
  }
}

const defined = new Set<string>();
const i18nSrc = readFileSync(join(SRC, "lib", "i18n.ts"), "utf8");
for (const m of i18nSrc.matchAll(new RegExp(KEY_RE.source, "g")))
  defined.add(m[1]);

for (const f of [
  "scripts/i18n-added-keys-run1.json",
  "scripts/i18n-added-keys-run2.json",
  "scripts/i18n-added-keys-run3.json",
  "scripts/i18n-added-keys.json",
  "scripts/i18n-overlay.json",
]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  const j = JSON.parse(readFileSync(p, "utf8")) as Record<
    string,
    { key?: string }
  >;
  for (const v of Object.values(j)) if (v && v.key) defined.add(v.key);
}

const missing = [...used.keys()].filter(k => !defined.has(k)).sort();
const lines = missing.map(k => `${k}\t${[...used.get(k)!].join(", ")}`);
writeFileSync(
  join(ROOT, "scripts/i18n-missing-keys.txt"),
  lines.join("\n") + "\n"
);
console.log(
  `used=${used.size} defined=${defined.size} missing=${missing.length}`
);
console.log(`report=scripts/i18n-missing-keys.txt`);
void basename;
