import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeCargoData } from "./cargoDataEvents";
import { db } from "./index";
import { closeIndexedDbConnection } from "./indexedDbRepository";
import { DB_NAME, TABLES } from "./schema";
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

const makeRun = (id: string): CargoCostRunRow => ({
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

const makeItem = (id: string, runId: string): CargoCostItemRow => ({
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

const makeLine = (id: string, runId: string): CargoCostLineRow => ({
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

const makeAllocation = (id: string, runId: string): CargoCostAllocationRow => ({
  id,
  runId,
  costLineId: `${runId}-line`,
  itemId: `${runId}-item`,
  amount: 1,
  createdAt: "2026-09-21T00:00:00.000Z",
});

async function seedRunWithItemLineAndAllocation(runId: string) {
  await Promise.all([
    db.saveCargoCostRun(makeRun(runId)),
    db.saveCargoCostItem(makeItem(`${runId}-item-row`, runId)),
    db.saveCargoCostLine(makeLine(`${runId}-line`, runId)),
    db.saveCargoCostAllocation(makeAllocation(`${runId}-allocation`, runId)),
  ]);
}

describe("atomic cargo cascade deletion", () => {
  afterEach(async () => {
    closeIndexedDbConnection();
    await deleteDatabase();
  });

  it("deletes the parent and descendants in one multi-store transaction", async () => {
    await db.init();
    await seedRunWithItemLineAndAllocation("run-delete");
    await db.saveCargoCostRun(makeRun("run-keep"));
    const transactionSpy = vi.spyOn(IDBDatabase.prototype, "transaction");

    await db.deleteCargoCostRun("run-delete");

    const cargoCascadeTransaction = transactionSpy.mock.calls.find(
      ([stores, mode]) =>
        mode === "readwrite" &&
        Array.isArray(stores) &&
        [
          TABLES.cargoCostRuns,
          TABLES.cargoCostItems,
          TABLES.cargoCostLines,
          TABLES.cargoCostAllocations,
        ].every(store => stores.includes(store))
    );
    expect(cargoCascadeTransaction).toBeDefined();
    expect(await db.getCargoCostRun("run-delete")).toBeNull();
    expect(await db.getCargoCostRun("run-keep")).toEqual(makeRun("run-keep"));
    transactionSpy.mockRestore();
  });

  it("rolls back all cascade rows and emits no invalidation when aborted", async () => {
    await db.init();
    await seedRunWithItemLineAndAllocation("run-abort");
    let notifications = 0;
    const unsubscribe = subscribeCargoData(() => {
      notifications += 1;
    });
    const originalTransaction = IDBDatabase.prototype.transaction;
    const transactionSpy = vi.spyOn(IDBDatabase.prototype, "transaction");
    transactionSpy.mockImplementation(function (
      this: IDBDatabase,
      stores: string | string[],
      mode?: IDBTransactionMode,
      options?: IDBTransactionOptions
    ) {
      const transaction = originalTransaction.call(
        this,
        stores as never,
        mode,
        options
      );
      if (
        mode === "readwrite" &&
        Array.isArray(stores) &&
        stores.includes(TABLES.cargoCostRuns)
      ) {
        queueMicrotask(() => transaction.abort());
      }
      return transaction;
    } as typeof IDBDatabase.prototype.transaction);

    await expect(db.deleteCargoCostRun("run-abort")).rejects.toThrow();

    expect(await db.getCargoCostRun("run-abort")).toEqual(makeRun("run-abort"));
    expect(await db.listCargoCostItems("run-abort")).toHaveLength(1);
    expect(await db.listCargoCostLines("run-abort")).toHaveLength(1);
    expect(await db.listCargoCostAllocations("run-abort")).toHaveLength(1);
    expect(notifications).toBe(0);
    unsubscribe();
    transactionSpy.mockRestore();
  });
});
