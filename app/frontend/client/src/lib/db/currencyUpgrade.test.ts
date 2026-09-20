import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import { db } from "./index";
import { DB_NAME, TABLES } from "./schema";

function createV11Database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 11);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of Object.values(TABLES)) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: "id" });
        }
      }
      request.transaction?.objectStore(TABLES.entities).put({
        id: "keep-entity",
        defaultCurrency: "USD",
      });
      request.transaction?.objectStore(TABLES.currencies).put({
        id: "legacy-usd",
        code: "USD",
        symbol: "$",
        decimals: 2,
        active: 1,
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function inspectCurrencyKeyPath(): Promise<IDBObjectStore["keyPath"]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(TABLES.currencies, "readonly");
      const keyPath = transaction.objectStore(TABLES.currencies).keyPath;
      transaction.oncomplete = () => {
        database.close();
        resolve(keyPath);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

describe("v11 to v12 currency schema upgrade", () => {
  it("recreates only currencies with code and preserves unrelated data", async () => {
    const oldDatabase = await createV11Database();
    oldDatabase.close();

    await db.init();

    expect(await inspectCurrencyKeyPath()).toBe("code");
    expect((await db.getEntity("keep-entity"))?.id).toBe("keep-entity");
    expect((await db.listCurrencies()).map(row => row.code).sort()).toEqual([
      "AED",
      "CNY",
      "EGP",
      "EUR",
      "INR",
      "SAR",
      "TRY",
      "USD",
    ]);
    expect(await db.listUnits()).toHaveLength(5);
  });
});
