import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import { db } from "./index";
import {
  DB_NAME,
  DEFAULT_CURRENCIES,
  DEFAULT_UNITS,
  SCHEMA_VERSION,
  TABLES,
} from "./schema";

const EXPECTED_KEY_PATHS: Record<string, "id" | "code"> = {
  [TABLES.entities]: "id",
  [TABLES.categories]: "id",
  [TABLES.items]: "id",
  [TABLES.specTemplates]: "id",
  [TABLES.itemSpecs]: "id",
  [TABLES.itemPrices]: "id",
  [TABLES.priceHistory]: "id",
  [TABLES.attachments]: "id",
  [TABLES.notes]: "id",
  [TABLES.tasks]: "id",
  [TABLES.backupLogs]: "id",
  [TABLES.pricingRuns]: "id",
  [TABLES.quickCalculations]: "id",
  [TABLES.calculatorTemplates]: "id",
  [TABLES.cargoCostRuns]: "id",
  [TABLES.cargoCostItems]: "id",
  [TABLES.cargoCostLines]: "id",
  [TABLES.cargoCostAllocations]: "id",
  [TABLES.logisticsLocations]: "id",
  [TABLES.logisticsRates]: "id",
  [TABLES.logisticsRouteTemplates]: "id",
  [TABLES.priceLists]: "id",
  [TABLES.priceListItems]: "id",
  [TABLES.settings]: "id",
  [TABLES.meta]: "id",
  [TABLES.currencies]: "code",
  [TABLES.units]: "id",
  [TABLES.entityContacts]: "id",
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe("IndexedDB schema integrity", () => {
  it("uses a key path compatible with every TABLES record shape", async () => {
    try {
      await db.init();
    } catch (error) {
      expect(error).toMatchObject({ name: "DataError" });
    }

    const database = await openDatabase();

    expect(Object.keys(EXPECTED_KEY_PATHS).sort()).toEqual(
      Object.values(TABLES).sort()
    );
    expect([...database.objectStoreNames].sort()).toEqual(
      Object.values(TABLES).sort()
    );

    const transaction = database.transaction(Object.values(TABLES), "readonly");
    for (const storeName of Object.values(TABLES)) {
      expect(transaction.objectStore(storeName).keyPath).toBe(
        EXPECTED_KEY_PATHS[storeName]
      );
    }

    expect(DEFAULT_CURRENCIES.every(row => row.code.trim().length > 0)).toBe(
      true
    );
    expect(DEFAULT_UNITS.every(row => row.id.trim().length > 0)).toBe(true);

    database.close();
  });
});
