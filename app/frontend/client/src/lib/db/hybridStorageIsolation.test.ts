import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";
import {
  closeIndexedDbConnection,
  indexedDbRepository,
  setIndexedDbNamespace,
} from "./indexedDbRepository";
import { DB_NAME, type CategoryRow } from "./schema";

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const category = (id: string, name: string): CategoryRow => ({
  id,
  name,
  notes: "",
  sortOrder: 1,
  createdAt: "2026-11-04T00:00:00.000Z",
  updatedAt: "2026-11-04T00:00:00.000Z",
});

describe("hybrid storage namespace isolation", () => {
  afterEach(async () => {
    closeIndexedDbConnection();
    setIndexedDbNamespace("public");
    await Promise.all([
      deleteDatabase(DB_NAME),
      deleteDatabase(`${DB_NAME}_private_cache`),
    ]);
  });

  it("keeps public and private browser data physically separated", async () => {
    setIndexedDbNamespace("public");
    await indexedDbRepository.init();
    await indexedDbRepository.saveCategory(category("public-cat", "Public"));

    setIndexedDbNamespace("private");
    await indexedDbRepository.init();
    expect(
      (await indexedDbRepository.listCategories()).some(
        row => row.id === "public-cat"
      )
    ).toBe(false);

    await indexedDbRepository.saveCategory(category("private-cat", "Private"));

    setIndexedDbNamespace("public");
    expect(
      (await indexedDbRepository.listCategories()).map(row => row.id)
    ).toContain("public-cat");
    expect(
      (await indexedDbRepository.listCategories()).map(row => row.id)
    ).not.toContain("private-cat");
  });
});
