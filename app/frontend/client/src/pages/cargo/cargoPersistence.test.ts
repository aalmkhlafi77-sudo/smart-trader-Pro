/**
 * اختبار انحدار لمسار حفظ أسعار البيع — أخطر مسار في التطبيق
 * (سبّب فقد أسعار مورد حقيقية مرتين قبل تثبيت السلوك الحالي).
 * القواعد المحمية هنا:
 * 1) الافتراضي دائماً أول مستوى فارغ — لا يمس مستوى مأهولاً إلا باختيار صريح.
 * 2) القيمة المحفوظة بعملة الصنف (تحويل صريح مقرب)، لا SAR داخل صف أجنبي.
 * 3) الأجنبي بلا صرف صالح يُتخطَّى دون أي كتابة.
 */
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSavePrice, mockSavePriceHistory } = vi.hoisted(() => ({
  mockSavePrice: vi.fn(),
  mockSavePriceHistory: vi.fn(),
}));

vi.mock("@/lib/db", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
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

import {
  db,
  type CargoCostItemRow,
  type CargoCostLineRow,
  type ItemPriceRow,
} from "@/lib/db";
import { subscribeCargoData } from "@/lib/db/cargoDataEvents";
import { closeIndexedDbConnection } from "@/lib/db/indexedDbRepository";
import { DB_NAME } from "@/lib/db/schema";
import { firstEmptyLevel, convertToItemCurrency, emptyDraft } from "./shared";
import { persistRun, persistSalePrices } from "./cargoPersistence";

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

afterEach(async () => {
  closeIndexedDbConnection();
  await deleteDatabase();
});

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

const cargoItem = (
  patch: Partial<CargoCostItemRow> = {}
): CargoCostItemRow => ({
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

describe("persistRun invalidation", () => {
  it("publishes once after the run and all descendants are persisted", async () => {
    const item: CargoCostItemRow = {
      ...cargoItem(),
      id: "persist-item",
      runId: "",
      quantity: 2,
    };
    const line: CargoCostLineRow = {
      id: "persist-line",
      runId: "",
      name: "مصاريف أخرى",
      stage: "other",
      status: "entered",
      method: "fixed",
      allocationBasis: "value",
      currency: "SAR",
      exchangeRate: 1,
      amount: 10,
      referenceQuantity: 0,
      referenceUnit: "",
      percentageBase: 0,
      itemIds: "",
      sourceLabel: "",
      rateId: "",
      templateId: "",
      effectiveDate: "2026-09-21",
      reason: "",
      sortOrder: 0,
      createdAt: "2026-09-21T00:00:00.000Z",
      updatedAt: "2026-09-21T00:00:00.000Z",
    };
    const draft = {
      ...emptyDraft("SAR"),
      name: "Persisted cargo",
      items: [
        {
          id: item.id,
          itemId: item.itemId,
          priceLevel: item.priceLevel,
          priceSource: item.priceSource,
          priceEffectiveDate: item.priceEffectiveDate,
          unitPrice: String(item.unitPrice),
          currency: item.currency,
          exchangeRate: String(item.exchangeRate),
          quantity: String(item.quantity),
          unit: item.unit,
          customsRate: String(item.customsRate * 100),
        },
      ],
    };

    await db.init();
    let snapshotPromise:
      | Promise<{
          run: Awaited<ReturnType<typeof db.listCargoCostRuns>>[number];
          items: Awaited<ReturnType<typeof db.listCargoCostItems>>;
          lines: Awaited<ReturnType<typeof db.listCargoCostLines>>;
          allocations: Awaited<ReturnType<typeof db.listCargoCostAllocations>>;
        }>
      | undefined;
    const listener = vi.fn(() => {
      snapshotPromise = db.listCargoCostRuns().then(async runs => {
        const savedRun = runs[0];
        return {
          run: savedRun,
          items: await db.listCargoCostItems(savedRun.id),
          lines: await db.listCargoCostLines(savedRun.id),
          allocations: await db.listCargoCostAllocations(savedRun.id),
        };
      });
    });
    const unsubscribe = subscribeCargoData(listener);

    const runId = await persistRun({
      draft,
      items: [item],
      lines: [line],
      status: "draft",
      localCurrency: "SAR",
      t,
    });

    expect(runId).toBeTruthy();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(snapshotPromise).toBeDefined();
    const snapshot = await snapshotPromise!;
    expect(snapshot.run.id).toBe(runId);
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.lines).toHaveLength(1);
    expect(snapshot.allocations).toHaveLength(1);
    unsubscribe();
  });
});
