import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";
import {
  closeIndexedDbConnection,
  indexedDbRepository,
  setIndexedDbNamespace,
} from "./indexedDbRepository";
import { DB_NAME, type CalculatorTemplateRow } from "./schema";

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const template: CalculatorTemplateRow = {
  id: "tpl-route-1",
  name: "Route template",
  scope: "both",
  origin: "Origin",
  unloading: "Port",
  destination: "Destination",
  currency: "USD",
  exchangeRate: 3.75,
  customsRate: 0.12,
  marginRate: 0.2,
  allocationBasis: "value",
  externalExpensesJson: "[]",
  internalExpensesJson: "[]",
  notes: "",
  active: 1,
  createdAt: "2026-11-05T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
};

describe("calculator templates repository", () => {
  afterEach(async () => {
    closeIndexedDbConnection();
    setIndexedDbNamespace("public");
    await deleteDatabase(DB_NAME);
  });

  it("saves templates and includes them in portable backups", async () => {
    setIndexedDbNamespace("public");
    await indexedDbRepository.init();
    await indexedDbRepository.saveCalculatorTemplate(template);

    expect(await indexedDbRepository.listCalculatorTemplates()).toEqual([template]);

    const backup = await indexedDbRepository.exportBackup();
    expect(backup.tables.calculator_templates).toEqual([template]);

    await indexedDbRepository.deleteCalculatorTemplate(template.id);
    expect(await indexedDbRepository.listCalculatorTemplates()).toEqual([]);
  });
});
