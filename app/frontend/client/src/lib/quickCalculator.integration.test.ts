import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { closeIndexedDbConnection } from "./db/indexedDbRepository";
import { DB_NAME } from "./db/schema";
import { calculateQuickCalculator } from "./quickCalculator";

function deleteDatabase() {
  closeIndexedDbConnection();
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

describe("quick calculator integration", () => {
  beforeEach(async () => {
    await deleteDatabase();
    await db.init();
  });

  it("stores a calculator draft in the portable backup without touching sale lists", async () => {
    const input = {
      itemName: "بوليود", quantity: 100, unitPrice: 5, currency: "USD",
      exchangeRate: 3.75, customsRate: 0.12, marginRate: 0.2,
      externalExpenses: [], internalExpenses: [],
    } as const;
    const result = calculateQuickCalculator(input);
    await db.saveQuickCalculation({
      id: "quick-1", supplierName: "اريكس", itemId: null, itemName: input.itemName,
      quantity: input.quantity, unitPrice: input.unitPrice, currency: input.currency,
      exchangeRate: input.exchangeRate, customsRate: input.customsRate, marginRate: input.marginRate,
      externalExpensesJson: "[]", internalExpensesJson: "[]", goodsValue: result.goodsValue,
      externalExpenses: result.externalExpenses, internalExpenses: result.internalExpenses,
      customsBaseExtra: result.customsBaseExtra, customsBase: result.customsBase,
      customsAmount: result.customsAmount, totalCost: result.totalCost,
      unitCost: result.unitCost, suggestedPrice: result.suggestedPrice,
      createdAt: "2026-02-01", updatedAt: "2026-02-01",
    });

    const backup = await db.exportBackup();

    expect(backup.tables.quick_calculations).toHaveLength(1);
    expect(backup.tables.quick_calculations[0].suggestedPrice).toBe(result.suggestedPrice);
    expect(backup.tables.price_lists).toEqual([]);
  });
});
