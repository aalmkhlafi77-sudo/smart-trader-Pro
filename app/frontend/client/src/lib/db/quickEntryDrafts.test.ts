import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";
import {
  closeIndexedDbConnection,
  indexedDbRepository,
  setIndexedDbNamespace,
} from "./indexedDbRepository";
import { DB_NAME, type QuickEntryDraftRow } from "./schema";

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const draft: QuickEntryDraftRow = {
  id: "quick-entry-draft-1",
  name: "Negotiation draft",
  transferPolicy: "warn",
  rowsJson: JSON.stringify([{ id: "row-1", itemName: "Sample" }]),
  notes: "",
  createdAt: "2026-11-05T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
};

describe("quick entry drafts repository", () => {
  afterEach(async () => {
    closeIndexedDbConnection();
    setIndexedDbNamespace("public");
    await deleteDatabase(DB_NAME);
  });

  it("persists drafts and includes them in backup payloads", async () => {
    setIndexedDbNamespace("public");
    await indexedDbRepository.init();
    await indexedDbRepository.saveQuickEntryDraft(draft);

    expect(await indexedDbRepository.listQuickEntryDrafts()).toEqual([draft]);

    const backup = await indexedDbRepository.exportBackup();
    expect(backup.tables.quick_entry_drafts).toEqual([draft]);

    await indexedDbRepository.deleteQuickEntryDraft(draft.id);
    expect(await indexedDbRepository.listQuickEntryDrafts()).toEqual([]);
  });
});
