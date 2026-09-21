import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";
import { db } from "./index";
import { closeIndexedDbConnection } from "./indexedDbRepository";
import { DB_NAME, TABLES } from "./schema";

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function createDatabaseWithLegacyCargoSale(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 12);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of Object.values(TABLES)) {
        database.createObjectStore(store, {
          keyPath: store === TABLES.currencies ? "code" : "id",
        });
      }

      const tx = request.transaction!;
      tx.objectStore(TABLES.meta).put({
        id: "app",
        schemaVersion: 12,
        lastBackupAt: "",
        specTemplatesSeeded: true,
        updatedAt: "2026-09-21T00:00:00.000Z",
      });
      tx.objectStore(TABLES.items).put({
        id: "item-miral",
        name: "ميرال",
        code: "MIR-1",
        category: "",
        entityId: null,
        unit: "piece",
        currency: "USD",
        defaultExchangeRate: 3.757,
        customsRate: 0.12,
        notes: "",
        createdAt: "2026-09-20T00:00:00.000Z",
        updatedAt: "2026-09-21T00:00:00.000Z",
      });
      tx.objectStore(TABLES.itemPrices).put({
        id: "price-miral",
        itemId: "item-miral",
        price1: 5.85,
        price1Date: "2026-09-20",
        price2: 8.65,
        price2Date: "2026-09-21",
        price3: null,
        price3Date: "",
        price4: null,
        price4Date: "",
        currency: "USD",
        notes: "من ملف تكلفة الحمولة حمولة اختبار",
        createdAt: "2026-09-20T00:00:00.000Z",
        updatedAt: "2026-09-21T10:00:00.000Z",
      });
      tx.objectStore(TABLES.priceHistory).put({
        id: "history-sale-miral",
        itemId: "item-miral",
        priceLevel: 2,
        price: 8.65,
        effectiveDate: "2026-09-21",
        currency: "USD",
        notes: "من ملف تكلفة الحمولة حمولة اختبار",
        createdAt: "2026-09-21T10:00:00.000Z",
      });
      tx.objectStore(TABLES.cargoCostRuns).put({
        id: "cargo-test",
        name: "حمولة اختبار",
        status: "approved",
        currency: "SAR",
        marginRate: 0.2,
        notes: "",
        createdAt: "2026-09-21T09:00:00.000Z",
        updatedAt: "2026-09-21T10:00:00.000Z",
      });
      tx.objectStore(TABLES.cargoCostItems).put({
        id: "cargo-item-miral",
        runId: "cargo-test",
        itemId: "item-miral",
        itemName: "ميرال",
        suggestedPrice: 32.5,
        createdAt: "2026-09-21T09:00:00.000Z",
        updatedAt: "2026-09-21T10:00:00.000Z",
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

afterEach(async () => {
  closeIndexedDbConnection();
  await deleteDatabase();
});

describe("legacy cargo sale-price cleanup", () => {
  it("moves the generated sale price to a sale list and restores supplier levels", async () => {
    const oldDatabase = await createDatabaseWithLegacyCargoSale();
    oldDatabase.close();

    await db.init();

    const supplierPrices = await db.getPriceByItem("item-miral");
    expect(supplierPrices).toMatchObject({
      price1: 5.85,
      price1Date: "2026-09-20",
      price2: null,
      price2Date: "",
      currency: "USD",
    });
    expect(await db.listPriceHistory("item-miral")).toEqual([]);

    const lists = await db.listPriceLists();
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({
      title: "حمولة اختبار",
      currency: "SAR",
    });
    expect(await db.listPriceListItems(lists[0].id)).toEqual([
      expect.objectContaining({
        itemId: "item-miral",
        itemName: "ميرال",
        price: 32.5,
        currency: "SAR",
      }),
    ]);

    await db.init();
    expect(await db.listPriceLists()).toHaveLength(1);
  });
});
