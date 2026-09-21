import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { EntityRow } from "./schema";
import type { ExcelImportPlan } from "../excelImport";
import { db } from "./index";
import { closeIndexedDbConnection } from "./indexedDbRepository";
import { DB_NAME } from "./schema";

function deleteDatabase() {
  closeIndexedDbConnection();
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

const existing: EntityRow = {
  id: "entity-existing", name: "موجود", kind: "supplier", country: "", city: "",
  phone: "", email: "", contactPerson: "", notes: "", defaultCurrency: "USD",
  defaultExchangeRate: 3.75, createdAt: "2026-01-01", updatedAt: "2026-01-01",
};

const basePlan = (overrides: Partial<ExcelImportPlan> = {}): ExcelImportPlan => ({
  entities: [], items: [], itemPrices: [], priceHistory: [], itemSpecs: [],
  cargoCostLines: [], priceLists: [], warnings: [], errors: [], counts: {}, canApply: true,
  ...overrides,
});

describe("excel import repository", () => {
  beforeEach(async () => {
    await deleteDatabase();
    await db.init();
    await db.saveEntity(existing);
  });

  it("rejects an invalid plan without writing any of its rows", async () => {
    const invalid = basePlan({
      canApply: false,
      errors: [{ sheet: "أسعار الموردين", row: 2, message: "الصنف غير معروف" }],
      entities: [{ ...existing, id: "entity-must-not-write", name: "غير مكتوب" }],
    });

    await expect(db.importExcel(invalid)).rejects.toThrow("لا يمكن تطبيق");
    expect((await db.listEntities()).map(row => row.id)).toEqual([existing.id]);
  });

  it("writes a valid supplier price plan without creating sale-price lists", async () => {
    const valid = basePlan({ entities: [{ ...existing, id: "entity-updated", name: "جهة جديدة" }] });

    await db.importExcel(valid);

    expect((await db.listEntities()).some(row => row.id === "entity-updated")).toBe(true);
    expect(await db.listPriceLists()).toEqual([]);
  });
});
