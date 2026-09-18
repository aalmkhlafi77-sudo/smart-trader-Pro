/**
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
