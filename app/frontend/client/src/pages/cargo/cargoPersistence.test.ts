/**
 * اختبار انحدار لمسار حفظ أسعار البيع — أخطر مسار في التطبيق
 * (سبّب فقد أسعار مورد حقيقية مرتين قبل تثبيت السلوك الحالي).
 * القواعد المحمية هنا:
 * 1) الافتراضي دائماً أول مستوى فارغ — لا يمس مستوى مأهولاً إلا باختيار صريح.
 * 2) القيمة المحفوظة بعملة الصنف (تحويل صريح مقرب)، لا SAR داخل صف أجنبي.
 * 3) الأجنبي بلا صرف صالح يُتخطَّى دون أي كتابة.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSavePrice, mockSavePriceHistory } = vi.hoisted(() => ({
  mockSavePrice: vi.fn(),
  mockSavePriceHistory: vi.fn(),
}));

vi.mock("@/lib/db", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    db: {
      ...actual.db,
      savePrice: mockSavePrice,
      savePriceHistory: mockSavePriceHistory,
    },
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

import { firstEmptyLevel, convertToItemCurrency } from "./shared";
import { persistSalePrices } from "./cargoPersistence";
import type { CargoCostItemRow, ItemPriceRow } from "@/lib/db";

const t = (key: string) => key;

const priceRow = (patch: Partial<ItemPriceRow> = {}): ItemPriceRow => ({
  id: "prc-1",
  itemId: "item-1",
  price1: 5.0,
  price1Date: "2026-01-01",
  price2: null,
  price2Date: "",
  price3: null,
  price3Date: "",
  price4: null,
  price4Date: "",
  currency: "USD",
  notes: "",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  ...patch,
});

const cargoItem = (patch: Partial<CargoCostItemRow> = {}): CargoCostItemRow => ({
  id: "ci-1",
  runId: "run-1",
  itemId: "item-1",
  itemName: "بينجو فينيل",
  priceLevel: 1,
  priceSource: "latest-dated",
  priceEffectiveDate: "2026-01-01",
  unitPrice: 5.0,
  currency: "USD",
  exchangeRate: 3.7585,
  quantity: 500,
  unit: "unit",
  customsCategory: "",
  customsRate: 0.12,
  goodsValue: 0,
  allocatedCost: 0,
  finalUnitCost: 0,
  suggestedPrice: 0,
  createdAt: "",
  updatedAt: "",
  ...patch,
});

describe("firstEmptyLevel", () => {
  it("يُعيد المستوى الاحتياطي عند غياب الصف", () => {
    expect(firstEmptyLevel(null, 1)).toBe(1);
    expect(firstEmptyLevel(undefined, 3)).toBe(3);
  });

  it("يُعيد أول مستوى فارغ ولا يمس المأهول", () => {
    expect(firstEmptyLevel(priceRow(), 1)).toBe(2);
    expect(
      firstEmptyLevel(priceRow({ price2: 7.25, price2Date: "2026-02-01" }), 1)
    ).toBe(3);
  });

  it("عند امتلاء المستويات الأربعة يُعيد الاحتياطي الصريح", () => {
    const full = priceRow({
      price2: 7.25,
      price2Date: "2026-02-01",
      price3: 8.0,
      price3Date: "2026-03-01",
      price4: 9.0,
      price4Date: "2026-04-01",
    });
    expect(firstEmptyLevel(full, 1)).toBe(1);
  });
});

describe("convertToItemCurrency", () => {
  it("يحوّل SAR إلى عملة الصنف مقرباً لمنزلتين", () => {
    expect(convertToItemCurrency(75.5, 3.7585)).toBe(20.09);
  });

  it("يُعيد القيمة كما هي عند غياب صرف صالح", () => {
    expect(convertToItemCurrency(75.5, 0)).toBe(75.5);
    expect(convertToItemCurrency(75.5, Number.NaN)).toBe(75.5);
  });
});

describe("persistSalePrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("يكتب في المستوى 2 ويُبقي المستوى 1 (سعر المورد) حرفياً دون تغيير", async () => {
    const row = priceRow();
    await persistSalePrices({
      items: [cargoItem()],
      saveRows: [{ itemId: "item-1", converted: 20.09, currency: "USD" }],
      selection: { "item-1": true },
      levels: {},
      priceRows: { "item-1": row },
      fileName: "test-file",
      localCurrency: "SAR",
      t,
    });

    expect(mockSavePrice).toHaveBeenCalledTimes(1);
    const saved = mockSavePrice.mock.calls[0][0];
    expect(saved.price1).toBe(5.0);
    expect(saved.price1Date).toBe("2026-01-01");
    expect(saved.price2).toBe(20.09);
    expect(saved.currency).toBe("USD");
    expect(saved.itemId).toBe("item-1");
  });

  it("يتخطى الصنف الأجنبي بلا صرف صالح دون أي كتابة", async () => {
    const result = await persistSalePrices({
      items: [cargoItem({ exchangeRate: 0 })],
      saveRows: [{ itemId: "item-1", converted: 20.09, currency: "USD" }],
      selection: { "item-1": true },
      levels: {},
      priceRows: { "item-1": priceRow() },
      fileName: "test-file",
      localCurrency: "SAR",
      t,
    });

    expect(result).toBe(false);
    expect(mockSavePrice).not.toHaveBeenCalled();
    expect(mockSavePriceHistory).not.toHaveBeenCalled();
  });

  it("الاختيار الصريح لمستوى مأهول يستبدل عمداً مع سجل history بالقيمة الجديدة", async () => {
    await persistSalePrices({
      items: [cargoItem()],
      saveRows: [{ itemId: "item-1", converted: 20.09, currency: "USD" }],
      selection: { "item-1": true },
      levels: { "item-1": 1 },
      priceRows: { "item-1": priceRow() },
      fileName: "test-file",
      localCurrency: "SAR",
      t,
    });

    expect(mockSavePrice).toHaveBeenCalledTimes(1);
    expect(mockSavePrice.mock.calls[0][0].price1).toBe(20.09);
    expect(mockSavePriceHistory).toHaveBeenCalledTimes(1);
    expect(mockSavePriceHistory.mock.calls[0][0]).toMatchObject({
      itemId: "item-1",
      priceLevel: 1,
      price: 20.09,
      currency: "USD",
    });
  });
});
