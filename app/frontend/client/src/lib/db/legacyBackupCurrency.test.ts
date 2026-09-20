import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";
import { db } from "./index";
import { closeIndexedDbConnection } from "./indexedDbRepository";
import type { BackupPayload } from "./repository";
import { DB_NAME } from "./schema";

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

describe("legacy backup without currencies", () => {
  afterEach(async () => {
    closeIndexedDbConnection();
    await deleteDatabase();
  });

  it("imports the old payload and restores reference currencies", async () => {
    await db.init();

    const legacyPayload = {
      format: "smart-trader-backup",
      schemaVersion: 10,
      exportedAt: "2026-09-21T00:00:00.000Z",
      tables: {
        entities: [
          {
            id: "legacy-entity",
            name: "Legacy supplier",
            kind: "supplier",
            country: "",
            city: "",
            phone: "",
            email: "",
            contactPerson: "",
            notes: "",
            defaultCurrency: "دينار",
            defaultExchangeRate: 1,
            createdAt: "2026-09-21T00:00:00.000Z",
            updatedAt: "2026-09-21T00:00:00.000Z",
          },
        ],
        items: [
          {
            id: "legacy-item",
            name: "Legacy item",
            code: "LEG-1",
            category: "",
            entityId: "legacy-entity",
            unit: "piece",
            currency: "دينار",
            defaultExchangeRate: 1,
            customsRate: null,
            notes: "",
            createdAt: "2026-09-21T00:00:00.000Z",
            updatedAt: "2026-09-21T00:00:00.000Z",
          },
        ],
      },
    } as unknown as BackupPayload;

    await db.importBackup(legacyPayload, "replace");

    expect((await db.getEntity("legacy-entity"))?.defaultCurrency).toBe(
      "دينار"
    );
    expect((await db.getItem("legacy-item"))?.currency).toBe("دينار");
    expect(await db.listCurrencies()).toHaveLength(8);
    expect(await db.listUnits()).toHaveLength(5);
  });
});
