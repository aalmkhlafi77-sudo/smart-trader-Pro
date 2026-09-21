import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { closeIndexedDbConnection } from "./db/indexedDbRepository";
import { DB_NAME, type EntityRow, type ItemRow } from "./db/schema";
import { buildExcelImportPlan } from "./excelImport";

function deleteDatabase() {
  closeIndexedDbConnection();
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

const entity: EntityRow = {
  id: "entity-1", name: "اريكس", kind: "supplier", country: "", city: "", phone: "", email: "",
  contactPerson: "", notes: "", defaultCurrency: "USD", defaultExchangeRate: 3.75,
  createdAt: "2026-01-01", updatedAt: "2026-01-01",
};
const item: ItemRow = {
  id: "item-1", name: "بوليود", code: "PLY-001", category: "", entityId: entity.id,
  unit: "قطعة", currency: "USD", defaultExchangeRate: 3.75, customsRate: 0.12, notes: "",
  createdAt: "2026-01-01", updatedAt: "2026-01-01",
};

describe("excel import integration", () => {
  beforeEach(async () => {
    await deleteDatabase();
    await db.init();
    await db.saveEntity(entity);
    await db.saveItem(item);
  });

  it("writes a supplier price and history row while keeping sale lists empty", async () => {
    const plan = buildExcelImportPlan(
      { sheets: { "أسعار الموردين": [{ itemCode: "PLY-001", price1: 5.85, price1Date: "2026-02-01", currency: "USD" }] } },
      { entities: [entity], items: [item], prices: [], cargoRuns: [], now: "2026-02-01" },
      { duplicateMode: "update" }
    );

    await db.importExcel(plan);

    expect((await db.listPrices())[0].price1).toBe(5.85);
    expect((await db.listPriceHistory(item.id))[0].price).toBe(5.85);
    expect(await db.listPriceLists()).toEqual([]);
  });
});
