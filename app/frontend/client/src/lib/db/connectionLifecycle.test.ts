import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "./index";
import { closeIndexedDbConnection } from "./indexedDbRepository";
import { DB_NAME } from "./schema";

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onblocked = () => reject(new Error("database deletion blocked"));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

describe("IndexedDB connection lifecycle", () => {
  afterEach(async () => {
    closeIndexedDbConnection();
    await deleteDatabase();
  });

  it("reuses the initialized connection for subsequent repository calls", async () => {
    await db.init();
    const openSpy = vi.spyOn(indexedDB, "open");

    await Promise.all([
      db.listCargoCostRuns(),
      db.listCargoCostItems("missing-run"),
      db.getSettings(),
    ]);

    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("closes the cached connection before a database replacement boundary", async () => {
    await db.init();
    closeIndexedDbConnection();

    await deleteDatabase();
    expect(true).toBe(true);
  });
});
