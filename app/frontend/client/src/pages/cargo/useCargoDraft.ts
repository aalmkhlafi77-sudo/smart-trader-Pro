import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import { calculateCargoPricing } from "@/lib/cargoPricing";
import {
  type CargoCostItemRow,
  type CargoCostLineRow,
  type ItemPriceRow,
  type ItemRow,
  type LogisticsRateRow,
  type LogisticsRouteTemplateRow,
  type PriceLevel,
  type SettingsRow,
} from "@/lib/db";
import { newId } from "@/lib/id";
import { latestDatedItemPrice } from "@/lib/latestItemPrice";
import { parseNumber } from "@/lib/pricing";
import type { CargoCostDraft, CargoDraft, CargoItemDraft } from "./shared";
import { FALLBACK_FOREIGN_CURRENCY, emptyDraft } from "./shared";
import { applyRouteTemplate } from "./routeTemplate";
import { buildChecklist } from "./cargoPersistence";

export function useCargoDraft(args: {
  items: ItemRow[];
  settings: SettingsRow | null;
  priceRows: Record<string, ItemPriceRow>;
  rates: LogisticsRateRow[];
  templates: LogisticsRouteTemplateRow[];
  localCurrency: string;
  t: (key: string) => string;
}) {
  const { items, settings, priceRows, rates, templates, localCurrency, t } = args;
  const [draft, setDraft, clearDraft] = useSessionDraft<CargoDraft>(
    "smart-trader:draft:cargo-pricing",
    emptyDraft(t("currency.sar"))
  );

  // بذر مسودة جديدة بقيم الإعدادات (العملة والهامش) — نفس سلوك الشاشة القديمة حرفياً
  const reseeded = useRef(false);
  useEffect(() => {
    if (reseeded.current || !settings) return;
    reseeded.current = true;
    setDraft(current => {
      if (
        current.items.length > 0 ||
        current.name ||
        current.marginRate !== "20"
      )
        return current;
      return emptyDraft(
        localCurrency,
        String(Math.round(settings.defaultMarginRate * 100))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, localCurrency]);

  const itemById = useMemo(
    () => Object.fromEntries(items.map(item => [item.id, item])),
    [items]
  );

  const updateDraft = (patch: Partial<CargoDraft>) =>
    setDraft(current => ({ ...current, ...patch }));
  const updateItem = (id: string, patch: Partial<CargoItemDraft>) =>
    setDraft(current => ({
      ...current,
      items: current.items.map(item =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
  const updateCost = (id: string, patch: Partial<CargoCostDraft>) =>
    setDraft(current => ({
      ...current,
      costs: current.costs.map(cost =>
        cost.id === id ? { ...cost, ...patch } : cost
      ),
    }));
  const toggleCost = (cost: CargoCostDraft) =>
    updateCost(cost.id, {
      status: cost.status === "disabled" ? "missing" : "disabled",
    });
  const removeItem = (id: string) =>
    setDraft(current => ({
      ...current,
      items: current.items.filter(item => item.id !== id),
    }));

  const addSelectedItem = () => {
    const source = itemById[draft.newItemId];
    if (!source) return toast.error(t("cargo.selectItemForLoad"));
    if (draft.items.some(item => item.itemId === source.id))
      return toast.info(t("cargo.itemAlreadyInLoad"));
    const latest = latestDatedItemPrice(priceRows[source.id] ?? null);
    const isLocal = source.currency === localCurrency;
    const next: CargoItemDraft = {
      id: newId("cargoitem"),
      itemId: source.id,
      priceLevel: latest?.level ?? 1,
      priceSource: latest ? "latest-dated" : "manual",
      priceEffectiveDate: latest?.effectiveDate ?? "",
      unitPrice: latest ? String(latest.price) : "",
      currency: source.currency || settings?.foreignCurrency || FALLBACK_FOREIGN_CURRENCY,
      exchangeRate: String(
        isLocal
          ? 1
          : source.defaultExchangeRate || settings?.defaultExchangeRate || 1
      ),
      quantity: "",
      unit: source.unit,
      customsRate: String(
        Number(
          (
            (source.customsRate ?? settings?.defaultCustomsRate ?? 0.12) * 100
          ).toFixed(4)
        )
      ),
    };
    setDraft(current => ({
      ...current,
      newItemId: "",
      items: [...current.items, next],
    }));
  };

  const selectPriceLevel = (cargoItem: CargoItemDraft, level: PriceLevel) => {
    const row = priceRows[cargoItem.itemId];
    const values = {
      1: { price: row?.price1, effectiveDate: row?.price1Date },
      2: { price: row?.price2, effectiveDate: row?.price2Date },
      3: { price: row?.price3, effectiveDate: row?.price3Date },
      4: { price: row?.price4, effectiveDate: row?.price4Date },
    };
    const price = values[level] ?? { price: null, effectiveDate: "" };
    updateItem(cargoItem.id, {
      priceLevel: level,
      priceSource: "selected-level",
      unitPrice: price.price == null ? "" : String(price.price),
      priceEffectiveDate: price.effectiveDate || "",
    });
  };

  const cargoItems: CargoCostItemRow[] = useMemo(
    () =>
      draft.items.map(item => ({
        id: item.id,
        runId: draft.runId || "preview",
        itemId: item.itemId,
        itemName: itemById[item.itemId]?.name ?? t("export.items"),
        priceLevel: item.priceLevel,
        priceSource: item.priceSource,
        priceEffectiveDate: item.priceEffectiveDate,
        unitPrice: parseNumber(item.unitPrice),
        currency: item.currency,
        exchangeRate: parseNumber(item.exchangeRate),
        quantity: parseNumber(item.quantity),
        unit: item.unit,
        customsCategory: "",
        customsRate: parseNumber(item.customsRate) / 100,
        goodsValue: 0,
        allocatedCost: 0,
        finalUnitCost: 0,
        suggestedPrice: 0,
        createdAt: "",
        updatedAt: "",
      })),
    [draft.items, draft.runId, itemById, t]
  );

  const cargoLines: CargoCostLineRow[] = useMemo(
    () =>
      draft.costs.map((cost, index) => ({
        id: cost.id,
        runId: draft.runId || "preview",
        name: cost.name,
        stage: cost.stage,
        status: cost.status,
        method: cost.method,
        allocationBasis: cost.allocationBasis,
        currency: cost.currency || localCurrency,
        exchangeRate: parseNumber(cost.exchangeRate) || 1,
        amount: parseNumber(cost.amount),
        referenceQuantity: 0,
        referenceUnit: cost.method === "per-unit" ? t("cargo.unitWord") : "",
        percentageBase: 0,
        itemIds: cost.itemIds.join("|"),
        sourceLabel: cost.sourceLabel,
        rateId: cost.rateId,
        templateId: draft.routeTemplateId,
        effectiveDate: "",
        reason: cost.reason,
        sortOrder: (index + 1) * 10,
        createdAt: "",
        updatedAt: "",
      })),
    [draft.costs, draft.routeTemplateId, draft.runId, localCurrency, t]
  );

  const result = useMemo(
    () =>
      calculateCargoPricing({
        items: cargoItems,
        costLines: cargoLines,
        customsBaseExtra: parseNumber(draft.customsBaseExtra),
        marginRate: parseNumber(draft.marginRate) / 100,
      }),
    [cargoItems, cargoLines, draft.customsBaseExtra, draft.marginRate]
  );

  const applyTemplate = () => {
    const { draft: next, applied } = applyRouteTemplate({
      draft,
      templates,
      rates,
      settings,
      localCurrency,
      t,
    });
    if (applied) setDraft(next);
  };

  const missingItems = draft.items.filter(
    item =>
      parseNumber(item.quantity) <= 0 ||
      parseNumber(item.unitPrice) < 0 ||
      (item.currency !== localCurrency && parseNumber(item.exchangeRate) <= 0)
  );
  const missingCosts = draft.costs.filter(cost => cost.status === "missing");

  const checks = buildChecklist({
    incoterm: draft.incoterm,
    costs: draft.costs,
    items: draft.items,
    missingCostCount: missingCosts.length,
    customsBase: result.customsBase,
  });
  const blockingOk = checks.every(c => c.ok || c.warnOnly);
  const canApprove =
    draft.items.length > 0 && missingItems.length === 0 && blockingOk;
  const resultsUnlocked =
    draft.items.length > 0 && missingItems.length === 0;

  const selectedTemplate =
    templates.find(row => row.id === draft.routeTemplateId) ?? null;

  const newWork = () => {
    clearDraft();
    setDraft(
      emptyDraft(
        localCurrency,
        String(Math.round((settings?.defaultMarginRate ?? 0.2) * 100))
      )
    );
  };

  return {
    draft,
    setDraft,
    updateDraft,
    updateItem,
    updateCost,
    toggleCost,
    removeItem,
    addSelectedItem,
    selectPriceLevel,
    applyTemplate,
    newWork,
    itemById,
    cargoItems,
    cargoLines,
    result,
    missingItems,
    missingCosts,
    checks,
    canApprove,
    resultsUnlocked,
    selectedTemplate,
    isCif: draft.incoterm === "CIF",
  };
}

