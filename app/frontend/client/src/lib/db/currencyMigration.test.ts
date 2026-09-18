import { describe, expect, it } from "vitest";
import { mapCurrencyToISO } from "./schema";
import { currencyLabel } from "../currency";

describe("S5 currency migration map", () => {
  it("maps stored Arabic values to ISO codes", () => {
    expect(mapCurrencyToISO("دولار")).toBe("USD");
    expect(mapCurrencyToISO("ريال")).toBe("SAR");
    expect(mapCurrencyToISO("يورو")).toBe("EUR");
    expect(mapCurrencyToISO("يوان")).toBe("CNY");
    expect(mapCurrencyToISO("درهم")).toBe("AED");
    expect(mapCurrencyToISO("جنيه")).toBe("EGP");
    expect(mapCurrencyToISO("روبية")).toBe("INR");
  });

  it("keeps unknown values untouched (never loses data)", () => {
    expect(mapCurrencyToISO("دينار")).toBe("دينار");
    expect(mapCurrencyToISO("USD")).toBe("USD");
    expect(mapCurrencyToISO("  دولار  ")).toBe("USD");
    expect(mapCurrencyToISO("")).toBe("");
    expect(mapCurrencyToISO(null)).toBe("");
  });

  it("resolves display labels for ISO codes, raw fallback otherwise", () => {
    const t = (key: string) => `<${key}>`;
    expect(currencyLabel("USD", t)).toBe("<currency.usd>");
    expect(currencyLabel("SAR", t)).toBe("<currency.sar>");
    expect(currencyLabel("دينار", t)).toBe("دينار");
    expect(currencyLabel("", t)).toBe("");
  });
});
