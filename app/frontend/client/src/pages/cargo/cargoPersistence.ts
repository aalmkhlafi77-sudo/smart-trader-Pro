import { toast } from "sonner";
import { calculateCargoPricing } from "@/lib/cargoPricing";
import {
  db,
  type CargoCostItemRow,
  type CargoCostLineRow,
} from "@/lib/db";
import { withCargoDataBatch } from "@/lib/db/cargoDataEvents";
import { newId, nowIso } from "@/lib/id";
import type { CargoCheck, CargoCostDraft, CargoDraft } from "./shared";
import { FREIGHT_LINE_NAME } from "./shared";
import { parseNumber } from "@/lib/pricing";

export async function fetchCargoDraft(
  runId: string
): Promise<CargoDraft | null> {
  await db.init();
  const run = await db.getCargoCostRun(runId);
  if (!run) return null;
  const [runItems, runLines] = await Promise.all([
    db.listCargoCostItems(runId),
    db.listCargoCostLines(runId),
  ]);
  return {
    runId: run.id,
    parentRunId: run.parentRunId,
    version: run.version,
    name: run.name,
    reference: run.reference,
    operationType: run.operationType,
    entityId: run.entityId ?? "",
    status: run.status,
    marginRate: String(Math.round(run.marginRate * 100)),
    customsBaseExtra: run.customsBaseExtra ? String(run.customsBaseExtra) : "",
    routeTemplateId: run.routeTemplateId,
    originLocationId: run.originLocationId,
    unloadingLocationId: run.unloadingLocationId,
    deliveryLocationId: run.deliveryLocationId,
    incoterm: run.incoterm,
    transportMode: run.transportMode,
    clearanceOffice: run.clearanceOffice,
    notes: run.notes,
    itemSearch: "",
    newItemId: "",
    items: runItems.map(item => ({
      id: item.id,
      itemId: item.itemId,
      priceLevel: item.priceLevel,
      priceSource: item.priceSource,
      priceEffectiveDate: item.priceEffectiveDate,
      unitPrice: String(item.unitPrice),
      currency: item.currency,
      exchangeRate: String(item.exchangeRate),
      quantity: String(item.quantity),
      unit: item.unit,
      customsRate: String(Number((item.customsRate * 100).toFixed(4))),
    })),
    costs: [...runLines]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(line => ({
        id: line.id,
        name: line.name,
        stage: line.stage,
        status: line.status,
        method: line.method,
        allocationBasis: line.allocationBasis,
        currency: line.currency,
        exchangeRate: String(line.exchangeRate),
        amount: line.amount ? String(line.amount) : "",
        itemIds: line.itemIds ? line.itemIds.split("|").filter(Boolean) : [],
        sourceLabel: line.sourceLabel,
        rateId: line.rateId,
        reason: line.reason,
      })),
  };
}

export async function persistRun(args: {
  draft: CargoDraft;
  items: CargoCostItemRow[];
  lines: CargoCostLineRow[];
  status: CargoDraft["status"];
  localCurrency: string;
  t: (key: string) => string;
}): Promise<string> {
  const { draft, items, lines, status, localCurrency, t } = args;
  if (draft.items.length === 0) {
    toast.error(t("cargo.addAtLeastOneItem"));
    return "";
  }
  const result = calculateCargoPricing({
    items,
    costLines: lines,
    customsBaseExtra: parseNumber(draft.customsBaseExtra),
    marginRate: parseNumber(draft.marginRate) / 100,
  });
  const timestamp = nowIso();
  const runId = draft.runId || newId("cargo");
  const run = {
    id: runId,
    name:
      draft.name.trim() || `${t("cargo.loadWord")} ${timestamp.slice(0, 10)}`,
    reference: draft.reference.trim(),
    operationType: draft.operationType,
    entityId: draft.entityId || null,
    status,
    parentRunId: draft.parentRunId,
    version: draft.version,
    currency: localCurrency,
    marginRate: parseNumber(draft.marginRate) / 100,
    customsBaseExtra: parseNumber(draft.customsBaseExtra),
    routeTemplateId: draft.routeTemplateId,
    originLocationId: draft.originLocationId,
    unloadingLocationId: draft.unloadingLocationId,
    deliveryLocationId: draft.deliveryLocationId,
    incoterm: draft.incoterm,
    transportMode: draft.transportMode,
    clearanceOffice: draft.clearanceOffice,
    invoiceValue: result.invoiceValue,
    customsBase: result.customsBase,
    customsAmount: result.customsAmount,
    totalCost: result.totalCost,
    totalSuggestedRevenue: result.totalSuggestedRevenue,
    notes: draft.notes.trim(),
    approvedAt: status === "approved" ? timestamp : "",
    createdAt: timestamp,
    updatedAt: timestamp,
  } as const;
  await withCargoDataBatch(async () => {
    await db.saveCargoCostRun(run);
    await Promise.all([
      db.deleteCargoCostItems(runId),
      db.deleteCargoCostLines(runId),
      db.deleteCargoCostAllocations(runId),
    ]);
    const allocationOf = (itemId: string) =>
      result.items.find(row => row.itemId === itemId);
    const savedItems = items.map(item => {
      const calculation = allocationOf(item.itemId);
      return {
        ...item,
        runId,
        goodsValue: calculation?.goodsValue ?? 0,
        allocatedCost: calculation?.allocatedCost ?? 0,
        finalUnitCost: calculation?.unitCost ?? 0,
        suggestedPrice: calculation?.suggestedPrice ?? 0,
        updatedAt: timestamp,
      };
    });
    await Promise.all(savedItems.map(item => db.saveCargoCostItem(item)));
    await Promise.all(
      lines.map(line =>
        db.saveCargoCostLine({ ...line, runId, updatedAt: timestamp })
      )
    );
    await Promise.all(
      result.allocations.map(allocation =>
        db.saveCargoCostAllocation({
          id: newId("alloc"),
          runId,
          costLineId: allocation.costLineId,
          itemId: allocation.itemId,
          amount: allocation.amount,
          createdAt: timestamp,
        })
      )
    );
  });
  toast.success(
    status === "approved" ? t("cargo.cargoFileApproved") : t("cargo.draftSaved")
  );
  return runId;
}

export async function persistSalePrices(args: {
  items: CargoCostItemRow[];
  saveRows: {
    itemId: string;
    name: string;
    suggested: number;
    converted: number;
    currency: string;
  }[];
  selection: Record<string, boolean>;
  fileName: string;
  localCurrency: string;
  t: (key: string) => string;
}): Promise<boolean> {
  const { items, saveRows, selection, fileName, localCurrency, t } = args;
  const selected = items.filter(item => selection[item.itemId]);
  if (selected.length === 0) {
    toast.info(t("cargo.selectItemToSaveSellingPrice"));
    return false;
  }

  // أسعار البيع ناتج مستقل عن عروض المورد: تُحفظ بعملة ملف الحمولة
  // في قائمة أسعار بيع، ولا تكتب إطلاقاً في مستويات item_prices أو سجل تفاوضها.
  const timestamp = nowIso();
  const listId = newId("plist");
  const title = fileName.trim() || t("cargo.cargoCostFile");
  await db.savePriceList({
    id: listId,
    title,
    clientName: "",
    priceLevel: 1,
    currency: localCurrency,
    notes: `${t("cargo.fromCargoFile")} ${title}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await Promise.all(
    selected.map(async (cargoItem, sortOrder) => {
      const row = saveRows.find(candidate => candidate.itemId === cargoItem.itemId);
      await db.savePriceListItem({
        id: newId("plistitem"),
        priceListId: listId,
        itemId: cargoItem.itemId,
        itemName: row?.name || cargoItem.itemName || cargoItem.itemId,
        specSummary: "",
        price: row?.suggested ?? cargoItem.suggestedPrice ?? 0,
        currency: localCurrency,
        sortOrder,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    })
  );
  toast.success(t("cargo.sellingPricesSaved"));
  return true;
}

export function buildChecklist(args: {
  incoterm: string;
  costs: CargoCostDraft[];
  items: { priceEffectiveDate: string }[];
  missingCostCount: number;
  customsBase: number;
}): CargoCheck[] {
  const { incoterm, costs, items, missingCostCount, customsBase } = args;
  const freight = costs.find(c => c.name === FREIGHT_LINE_NAME);
  const cifOk =
    incoterm !== "CIF" ||
    !(
      freight &&
      freight.status === "entered" &&
      parseNumber(freight.amount) > 0
    );
  return [
    {
      id: "incoterm",
      labelKey: "cargo.checkIncoterm",
      ok: incoterm.trim() !== "",
    },
    { id: "cif", labelKey: "cargo.checkCifFreight", ok: cifOk },
    {
      id: "dated",
      labelKey: "cargo.checkDatedPrices",
      ok:
        items.length > 0 &&
        items.every(i => i.priceEffectiveDate.trim() !== ""),
      warnOnly: true,
    },
    {
      id: "lines",
      labelKey: "cargo.checkNoMissing",
      ok: missingCostCount === 0,
    },
    { id: "base", labelKey: "cargo.checkCustomsBase", ok: customsBase > 0 },
  ];
}
