import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "./index";
import { closeIndexedDbConnection } from "./indexedDbRepository";
import { DB_NAME } from "./schema";
import { subscribeCargoData } from "./cargoDataEvents";
import type {
  CargoCostAllocationRow,
  CargoCostItemRow,
  CargoCostLineRow,
  CargoCostRunRow,
} from "./schema";

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const run = (id: string): CargoCostRunRow => ({
  id,
  name: id,
  reference: "REF",
  operationType: "import",
  entityId: null,
  status: "draft",
  parentRunId: "",
  version: 1,
  currency: "USD",
  marginRate: 0,
  customsBaseExtra: 0,
  routeTemplateId: "",
  originLocationId: "",
  unloadingLocationId: "",
  deliveryLocationId: "",
  incoterm: "",
  transportMode: "",
  clearanceOffice: "",
  invoiceValue: 0,
  customsBase: 0,
  customsAmount: 0,
  totalCost: 0,
  totalSuggestedRevenue: 0,
  notes: "",
  approvedAt: "",
  createdAt: "2026-09-21T00:00:00.000Z",
  updatedAt: "2026-09-21T00:00:00.000Z",
});

const item = (id: string, runId: string): CargoCostItemRow => ({
  id,
  runId,
  itemId: `${runId}-item`,
  itemName: "Item",
  priceLevel: 1,
  priceSource: "manual",
  priceEffectiveDate: "2026-09-21",
  unitPrice: 1,
  currency: "USD",
  exchangeRate: 1,
  quantity: 1,
  unit: "piece",
  customsCategory: "",
  customsRate: 0,
  goodsValue: 1,
  allocatedCost: 0,
  finalUnitCost: 1,
  suggestedPrice: 1,
  createdAt: "2026-09-21T00:00:00.000Z",
  updatedAt: "2026-09-21T00:00:00.000Z",
});

const line = (id: string, runId: string): CargoCostLineRow => ({
  id,
  runId,
  name: "Line",
  stage: "factory",
  status: "entered",
  method: "manual",
  allocationBasis: "value",
  currency: "USD",
  exchangeRate: 1,
  amount: 1,
  referenceQuantity: 1,
  referenceUnit: "piece",
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
});

const allocation = (id: string, runId: string): CargoCostAllocationRow => ({
  id,
  runId,
  costLineId: `${runId}-line`,
  itemId: `${runId}-item`,
  amount: 1,
  createdAt: "2026-09-21T00:00:00.000Z",
});

async function seedRunWithItemLineAndAllocation(runId: string) {
  await Promise.all([
    db.saveCargoCostRun(run(runId)),
    db.saveCargoCostItem(item(`${runId}-item-row`, runId)),
    db.saveCargoCostLine(line(`${runId}-line`, runId)),
    db.saveCargoCostAllocation(allocation(`${runId}-allocation`, runId)),
  ]);
}

describe("cargo repository invalidation", () => {
  afterEach(async () => {
    closeIndexedDbConnection();
    await deleteDatabase();
  });

  it("publishes once after a direct cargo save", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCargoData(listener);
    await db.init();

    await db.saveCargoCostRun(run("run-1"));

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("publishes once after a cascading run delete", async () => {
    await db.init();
    await seedRunWithItemLineAndAllocation("run-delete");
    let notifications = 0;
    const unsubscribe = subscribeCargoData(() => {
      notifications += 1;
    });

    await db.deleteCargoCostRun("run-delete");

    expect(await db.listCargoCostItems("run-delete")).toEqual([]);
    expect(await db.listCargoCostLines("run-delete")).toEqual([]);
    expect(await db.listCargoCostAllocations("run-delete")).toEqual([]);
    expect(notifications).toBe(1);
    unsubscribe();
  });
});
