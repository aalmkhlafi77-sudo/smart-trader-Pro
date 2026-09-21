/**
 * اختبار انحدار لمسار حفظ أسعار البيع.
 * سعر البيع الناتج من الحمولة يجب أن يُحفظ في قائمة بيع مستقلة،
 * وألا يكتب مطلقاً في مستويات أسعار المورد أو سجل تفاوضه.
 */
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSavePrice,
  mockSavePriceHistory,
  mockSavePriceList,
  mockSavePriceListItem,
} = vi.hoisted(() => ({
  mockSavePrice: vi.fn(),
  mockSavePriceHistory: vi.fn(),
  mockSavePriceList: vi.fn(),
  mockSavePriceListItem: vi.fn(),
}));

vi.mock("@/lib/db", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    db: {
      ...actual.db,
      savePrice: mockSavePrice,
      savePriceHistory: mockSavePriceHistory,
      savePriceList: mockSavePriceList,
      savePriceListItem: mockSavePriceListItem,
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
} from "@/lib/db";
import { subscribeCargoData } from "@/lib/db/cargoDataEvents";
import { closeIndexedDbConnection } from "@/lib/db/indexedDbRepository";
import { DB_NAME } from "@/lib/db/schema";
import { convertToItemCurrency, emptyDraft } from "./shared";
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

  it("يحفظ سعر البيع المحلي في قائمة مستقلة ولا يلمس سعر المورد أو تاريخه", async () => {
    await persistSalePrices({
      items: [cargoItem()],
      saveRows: [
        {
          itemId: "item-1",
          name: "بينجو فينيل",
          suggested: 75.5,
          converted: 20.09,
          currency: "USD",
        },
      ],
      selection: { "item-1": true },
      fileName: "test-file",
      localCurrency: "SAR",
      t,
    });

    expect(mockSavePrice).not.toHaveBeenCalled();
    expect(mockSavePriceHistory).not.toHaveBeenCalled();
    expect(mockSavePriceList).toHaveBeenCalledTimes(1);
    const list = mockSavePriceList.mock.calls[0][0];
    expect(list).toMatchObject({
      title: "test-file",
      currency: "SAR",
    });
    expect(mockSavePriceListItem).toHaveBeenCalledTimes(1);
    expect(mockSavePriceListItem.mock.calls[0][0]).toMatchObject({
      priceListId: list.id,
      itemId: "item-1",
      itemName: "بينجو فينيل",
      price: 75.5,
      currency: "SAR",
    });
  });

  it("لا ينشئ قائمة عندما لا يُحدَّد أي صنف", async () => {
    const result = await persistSalePrices({
      items: [cargoItem()],
      saveRows: [
        {
          itemId: "item-1",
          name: "بينجو فينيل",
          suggested: 75.5,
          converted: 20.09,
          currency: "USD",
        },
      ],
      selection: {},
      fileName: "test-file",
      localCurrency: "SAR",
      t,
    });

    expect(result).toBe(false);
    expect(mockSavePrice).not.toHaveBeenCalled();
    expect(mockSavePriceHistory).not.toHaveBeenCalled();
    expect(mockSavePriceList).not.toHaveBeenCalled();
    expect(mockSavePriceListItem).not.toHaveBeenCalled();
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
