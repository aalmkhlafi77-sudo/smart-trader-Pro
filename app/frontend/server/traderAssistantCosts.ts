import { randomUUID } from "node:crypto";
import { calculateCargoPricing } from "../client/src/lib/cargoPricing";
import type { BackupPayload } from "../client/src/lib/db/repository";
import type { CargoCostItemRow, CargoCostLineRow, CargoCostRunRow } from "../client/src/lib/db/schema";
import type { TraderCostDraft } from "../shared/traderAssistantImport";
import { prepareTraderBatch, TraderAssistantError } from "./traderAssistantBatch";

export function planTraderCost(original: BackupPayload, draft: TraderCostDraft) {
  if (!draft.name || !/^[A-Z]{3}$/.test(draft.currency) || !draft.items.length) {
    throw new TraderAssistantError(422, "أكمل اسم ملف التكلفة وعملة الحساب وأضف صنفًا واحدًا على الأقل.");
  }
  const localCurrency = original.tables.settings[0]?.localCurrency;
  if (localCurrency && draft.currency !== localCurrency) {
    throw new TraderAssistantError(422, `اختر عملة الحساب المحلية ${localCurrency}، واستخدم سعر الصرف لكل صف بعملة أخرى.`);
  }
  const exchange = (currency: string, rate: number | null, label: string) => {
    if (!/^[A-Z]{3}$/.test(currency) || (currency !== draft.currency && !(rate && rate > 0))) {
      throw new TraderAssistantError(422, `أكمل العملة وسعر الصرف لـ«${label}».`);
    }
    return currency === draft.currency ? 1 : rate!;
  };
  draft.items.forEach(row => {
    if (!row.name || !row.unit || !row.quantity || row.unitPrice === null) {
      throw new TraderAssistantError(422, "أكمل اسم كل صنف ووحدته وكميته وسعر الوحدة.");
    }
    exchange(row.currency, row.exchangeRate, row.name);
  });
  for (const row of draft.expenses) {
    if (!row.name || row.amount === null) throw new TraderAssistantError(422, "أكمل اسم كل مصروف ومبلغه.");
    exchange(row.currency, row.exchangeRate, row.name);
  }

  const now = new Date().toISOString();
  const runId = randomUUID();
  const catalog = prepareTraderBatch(original, {
    entities: [],
    items: draft.items.map(row => ({
      name: row.name, code: row.code, unit: row.unit, entityName: "", currency: row.currency, price: null,
    })),
  }, now);
  if (new Set(catalog.itemIds).size !== draft.items.length) {
    throw new TraderAssistantError(422, "ادمج الصفوف المتكررة للصنف الواحد أو أكمل رموز الأصناف المختلفة.");
  }
  const items: CargoCostItemRow[] = draft.items.map((row, index) => ({
    id: randomUUID(), runId, itemId: catalog.itemIds[index], itemName: row.name,
    priceLevel: 1, priceSource: "manual", priceEffectiveDate: "", unitPrice: row.unitPrice!,
    currency: row.currency, exchangeRate: exchange(row.currency, row.exchangeRate, row.name),
    quantity: row.quantity!, unit: row.unit, customsCategory: "", customsRate: 0,
    goodsValue: 0, allocatedCost: 0, finalUnitCost: 0, suggestedPrice: 0, createdAt: now, updatedAt: now,
  }));
  const lines: CargoCostLineRow[] = draft.expenses.map((row, index) => ({
    id: randomUUID(), runId, name: row.name, stage: "other", status: "entered", method: "fixed",
    allocationBasis: row.basis, currency: row.currency, exchangeRate: exchange(row.currency, row.exchangeRate, row.name),
    amount: row.amount!, referenceQuantity: 0, referenceUnit: "", percentageBase: 0, itemIds: "",
    sourceLabel: "رفيق التاجر", rateId: "", templateId: "", effectiveDate: "", reason: "",
    sortOrder: index, createdAt: now, updatedAt: now,
  }));
  const calculation = calculateCargoPricing({ items, costLines: lines, customsBaseExtra: 0, marginRate: 0 });
  const run: CargoCostRunRow = {
    id: runId, name: draft.name, reference: "", operationType: "import", entityId: null,
    status: "draft", parentRunId: "", version: 1, currency: draft.currency, marginRate: 0,
    customsBaseExtra: 0, routeTemplateId: "", originLocationId: "", unloadingLocationId: "",
    deliveryLocationId: "", incoterm: "", transportMode: "", clearanceOffice: "",
    invoiceValue: calculation.invoiceValue, customsBase: calculation.customsBase,
    customsAmount: calculation.customsAmount, totalCost: calculation.totalCost,
    totalSuggestedRevenue: calculation.totalSuggestedRevenue, notes: "مسودة من رفيق التاجر",
    approvedAt: "", createdAt: now, updatedAt: now,
  };
  const costs = calculation.items.map((row, index) => ({
    name: items[index].itemName, total: row.finalCost, unitCost: row.unitCost, allocated: row.allocatedCost,
  }));
  const tables = catalog.payload.tables;
  return {
    runId, total: calculation.totalCost, items: costs,
    payload: { ...catalog.payload, tables: {
      ...tables,
      cargo_cost_runs: [run, ...tables.cargo_cost_runs],
      cargo_cost_items: [...items.map((item, index) => ({
        ...item, goodsValue: calculation.items[index].goodsValue,
        allocatedCost: calculation.items[index].allocatedCost, finalUnitCost: calculation.items[index].unitCost,
        suggestedPrice: calculation.items[index].suggestedPrice,
      })), ...tables.cargo_cost_items],
      cargo_cost_lines: [...lines, ...tables.cargo_cost_lines],
      cargo_cost_allocations: [...calculation.allocations.map(row => ({
        ...row, id: randomUUID(), runId, createdAt: now,
      })), ...tables.cargo_cost_allocations],
    } },
  };
}
