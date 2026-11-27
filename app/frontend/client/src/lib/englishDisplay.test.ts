import {describe,it,expect} from "vitest";
import {ENGLISH_GREGORIAN_LOCALE, toEnglishDigits, normalizeEnglishNumberInput, parseEnglishCalendarDate, formatEnglishCalendarDate} from "./englishDisplay";
describe("English numeral and Gregorian date display",()=>{
 it("preserves leading zeroes while normalizing both Arabic digit forms",()=>{
  expect(toEnglishDigits("٠٠١-۰۰۲")).toBe("001-002");
  expect(normalizeEnglishNumberInput("١٬٢٣٤٫٥٠")).toBe("1234.50");
 });
 it("retains a valid date without timezone shifting, rejects impossible dates and empty fields",()=>{
  expect(parseEnglishCalendarDate("")).toBeUndefined();
  expect(parseEnglishCalendarDate("2026-02-30")).toBeUndefined();
  expect(parseEnglishCalendarDate("2026-13-01")).toBeUndefined();
  expect(formatEnglishCalendarDate(parseEnglishCalendarDate("٢٠٢٤-٠٢-٢٩")!)).toBe("2024-02-29");
  expect(formatEnglishCalendarDate(parseEnglishCalendarDate("2026-11-27")!)).toBe("2026-11-27");
 });
 it("requests Latin digits and Gregorian calendar explicitly",()=>{
  const f=new Intl.DateTimeFormat(ENGLISH_GREGORIAN_LOCALE,{year:"numeric",month:"long",day:"numeric"});
  expect(f.resolvedOptions().calendar).toBe("gregory");
  expect(f.resolvedOptions().numberingSystem).toBe("latn");
  expect(f.format(new Date(2026,10,27))).toContain("November");
 });
});
