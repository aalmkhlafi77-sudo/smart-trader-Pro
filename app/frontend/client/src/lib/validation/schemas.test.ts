import { describe, expect, it } from "vitest";
import {
  entitySchema,
  financialDefaultsSchema,
  pinSchema,
  priceLevelSchema,
} from "./schemas";

const t = (key: string) => key;

describe("S6 validation schemas", () => {
  it("rejects an entity without a name or with a bad rate", () => {
    const base = {
      name: "x",
      kind: "supplier",
      country: "",
      city: "",
      phone: "",
      email: "",
      contactPerson: "",
      notes: "",
      defaultCurrency: "USD",
      defaultExchangeRate: "3.75",
    };
    expect(entitySchema(t).safeParse(base).success).toBe(true);
    expect(entitySchema(t).safeParse({ ...base, name: "  " }).success).toBe(
      false
    );
    expect(
      entitySchema(t).safeParse({ ...base, defaultExchangeRate: "0" }).success
    ).toBe(false);
    expect(
      entitySchema(t).safeParse({ ...base, email: "not-an-email" }).success
    ).toBe(false);
  });

  it("validates price level dates and amounts", () => {
    expect(
      priceLevelSchema(t).safeParse({ price: "12.5", date: "2026-09-18", source: "" })
        .success
    ).toBe(true);
    expect(
      priceLevelSchema(t).safeParse({ price: "-3", date: "2026-09-18", source: "" })
        .success
    ).toBe(false);
    expect(
      priceLevelSchema(t).safeParse({ price: "", date: "18-09-2026", source: "" })
        .success
    ).toBe(false);
  });

  it("requires matching six-digit pins", () => {
    const good = { currentPin: "123456", nextPin: "654321", confirmation: "654321" };
    expect(pinSchema(t).safeParse(good).success).toBe(true);
    expect(
      pinSchema(t).safeParse({ ...good, confirmation: "000000" }).success
    ).toBe(false);
    expect(
      pinSchema(t).safeParse({ ...good, nextPin: "123" }).success
    ).toBe(false);
  });

  it("requires a positive exchange rate for financial defaults", () => {
    expect(
      financialDefaultsSchema(t).safeParse({ rate: "3.75", customs: "12", margin: "20" })
        .success
    ).toBe(true);
    expect(
      financialDefaultsSchema(t).safeParse({ rate: "0", customs: "", margin: "" })
        .success
    ).toBe(false);
  });
});
