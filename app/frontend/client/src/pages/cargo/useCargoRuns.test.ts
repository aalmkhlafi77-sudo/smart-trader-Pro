import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";
import { db, type CargoCostItemRow, type CargoCostRunRow } from "@/lib/db";
import { closeIndexedDbConnection } from "@/lib/db/indexedDbRepository";
import { DB_NAME } from "@/lib/db/schema";
import { useCargoRuns } from "./useCargoRuns";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const runRow = (status: "approved" | "archived"): CargoCostRunRow => ({
  id: `run-${status}`,
  name: `run-${status}`,
  reference: "",
  operationType: "import",
  entityId: null,
  status,
  parentRunId: "",
  version: 1,
  currency: "SAR",
  marginRate: 0.2,
  customsBaseExtra: 0,
  routeTemplateId: "",
  originLocationId: "",
  unloadingLocationId: "",
  deliveryLocationId: "",
  incoterm: "FOB",
  transportMode: "sea",
  clearanceOffice: "",
  invoiceValue: 10,
  customsBase: 10,
  customsAmount: 1,
  totalCost: 11,
  totalSuggestedRevenue: 13.2,
  notes: "",
  approvedAt: "2026-09-21T00:00:00.000Z",
  createdAt: "2026-09-21T00:00:00.000Z",
  updatedAt: "2026-09-21T00:00:00.000Z",
});

const itemRow = (runId: string): CargoCostItemRow => ({
  id: `${runId}-item-row`,
  runId,
  itemId: "item-1",
  itemName: "صنف اختبار",
  priceLevel: 1,
  priceSource: "selected-level",
  priceEffectiveDate: "2026-09-21",
  unitPrice: 10,
  currency: "USD",
  exchangeRate: 3.75,
  quantity: 1,
  unit: "piece",
  customsCategory: "",
  customsRate: 0.1,
  goodsValue: 37.5,
  allocatedCost: 0,
  finalUnitCost: 41.25,
  suggestedPrice: 49.5,
  createdAt: "2026-09-21T00:00:00.000Z",
  updatedAt: "2026-09-21T00:00:00.000Z",
});

afterEach(async () => {
  closeIndexedDbConnection();
  await deleteDatabase();
});

describe("useCargoRuns deletion", () => {
  it.each(["approved", "archived"] as const)(
    "يحذف ملف %s وبنوده كي لا تبقى له بيانات في التقارير",
    async status => {
      await db.init();
      const run = runRow(status);
      await db.saveCargoCostRun(run);
      await db.saveCargoCostItem(itemRow(run.id));
      const doNewWork = vi.fn();
      const reloadData = vi.fn(async () => {});
      const { deleteRun } = useCargoRuns({
        runs: [run],
        activeRunId: run.id,
        t: key => key,
        setDraft: vi.fn(),
        setStep: vi.fn(),
        doNewWork,
        reloadData,
      });

      await deleteRun(run.id);

      expect(await db.getCargoCostRun(run.id)).toBeNull();
      expect(await db.listCargoCostItems(run.id)).toEqual([]);
      expect(doNewWork).toHaveBeenCalledTimes(1);
      expect(reloadData).toHaveBeenCalledTimes(1);
    }
  );
});
