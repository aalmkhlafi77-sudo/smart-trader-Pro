/**
 * ملف تكلفة الحمولة — اتجاه التصميم: "دفتر الميناء".
 * كل خطوة تعرض قدر الحاجة فقط؛ ملخص التكلفة ثابت على الحاسوب وقابل للمتابعة على الهاتف.
 * السعر الافتراضي لكل صنف هو آخر سعر مؤرخ من قائمة الأسعار، ولا يُعدّل سجل المصدر داخل الحاسبة.
 */
import AppLayout from "@/components/AppLayout";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import {
  db,
  type CargoAllocationBasis,
  type CargoCostLineRow,
  type CargoCostMethod,
  type CargoCostStage,
  type CargoCostStatus,
  type CargoCostItemRow,
  type ItemPriceRow,
  type ItemRow,
  type LogisticsRateRow,
  type LogisticsRouteTemplateRow,
  type PriceLevel,
  type SettingsRow,
} from "@/lib/db";
import { calculateCargoPricing } from "@/lib/cargoPricing";
import { newId, nowIso } from "@/lib/id";
import { latestDatedItemPrice } from "@/lib/latestItemPrice";
import { formatMoney, formatNumber, parseNumber } from "@/lib/pricing";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  CopyPlus,
  Factory,
  FilePlus2,
  Landmark,
  MapPin,
  PackagePlus,
  Plus,
  Save,
  ShipWheel,
  Tag,
  Trash2,
  Truck,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type OperationType = "import" | "local";
type RunStatus = "draft" | "review" | "approved";

interface CargoItemDraft {
  id: string;
  itemId: string;
  priceLevel: PriceLevel;
  priceSource: "latest-dated" | "manual" | "selected-level";
  priceEffectiveDate: string;
  unitPrice: string;
  currency: string;
  exchangeRate: string;
  quantity: string;
  unit: string;
  customsRate: string;
}

interface CargoCostDraft {
  id: string;
  name: string;
  stage: CargoCostStage;
  status: CargoCostStatus;
  method: CargoCostMethod;
  allocationBasis: CargoAllocationBasis;
  currency: string;
  exchangeRate: string;
  amount: string;
  itemIds: string[];
  sourceLabel: string;
  rateId: string;
  reason: string;
}

interface CargoDraft {
  runId: string;
  parentRunId: string;
  version: number;
  name: string;
  reference: string;
  operationType: OperationType;
  entityId: string;
  status: RunStatus;
  marginRate: string;
  customsBaseExtra: string;
  routeTemplateId: string;
  originLocationId: string;
  unloadingLocationId: string;
  deliveryLocationId: string;
  incoterm: string;
  transportMode: string;
  clearanceOffice: string;
  notes: string;
  itemSearch: string;
  newItemId: string;
  items: CargoItemDraft[];
  costs: CargoCostDraft[];
}

const COST_BLUEPRINTS: Array<
  Pick<
    CargoCostDraft,
    "name" | "stage" | "method" | "allocationBasis" | "status"
  >
> = [
  {
    name: "الشحن الدولي",
    stage: "port",
    method: "fixed",
    allocationBasis: "value",
    status: "missing",
  },
  {
    name: "الجمارك",
    stage: "customs",
    method: "percentage",
    allocationBasis: "value",
    status: "entered",
  },
  {
    name: "مصاريف ورسوم التخليص",
    stage: "customs",
    method: "fixed",
    allocationBasis: "value",
    status: "missing",
  },
  {
    name: "أتعاب مكتب التخليص",
    stage: "customs",
    method: "fixed",
    allocationBasis: "value",
    status: "missing",
  },
  {
    name: "النقل الداخلي",
    stage: "warehouse",
    method: "fixed",
    allocationBasis: "value",
    status: "missing",
  },
  {
    name: "التحميل والتنزيل",
    stage: "warehouse",
    method: "fixed",
    allocationBasis: "quantity",
    status: "missing",
  },
  {
    name: "مصاريف أخرى",
    stage: "other",
    method: "fixed",
    allocationBasis: "value",
    status: "disabled",
  },
];

const initialCost = (
  blueprint: (typeof COST_BLUEPRINTS)[number],
  currency: string,
  index: number
): CargoCostDraft => ({
  id: `cost-${index}`,
  ...blueprint,
  currency,
  exchangeRate: "1",
  amount: "",
  itemIds: [],
  sourceLabel: "",
  rateId: "",
  reason: "",
});

const emptyDraft = (currency: string, marginRate = "20"): CargoDraft => ({
  runId: "",
  parentRunId: "",
  version: 1,
  name: "",
  reference: "",
  operationType: "import",
  entityId: "",
  status: "draft",
  marginRate,
  customsBaseExtra: "",
  routeTemplateId: "",
  originLocationId: "",
  unloadingLocationId: "",
  deliveryLocationId: "",
  incoterm: "FOB",
  transportMode: "بحري",
  clearanceOffice: "",
  notes: "",
  itemSearch: "",
  newItemId: "",
  items: [],
  costs: COST_BLUEPRINTS.map((blueprint, index) =>
    initialCost(blueprint, currency, index)
  ),
});

const priceAtLevel = (row: ItemPriceRow | undefined, level: PriceLevel) => {
  if (!row) return { price: null, effectiveDate: "" };
  const values = {
    1: { price: row.price1, effectiveDate: row.price1Date },
    2: { price: row.price2, effectiveDate: row.price2Date },
    3: { price: row.price3, effectiveDate: row.price3Date },
    4: { price: row.price4, effectiveDate: row.price4Date },
  };
  return values[level];
};
const optionValue = (value: string) => value || "__none__";
const fromOption = (value: string) => (value === "__none__" ? "" : value);

export default function Pricing() {
  const { t } = useLanguage();
  const STEP_TITLES = [
    t("cargo.stepTitleLoad"),
    t("cargo.stepTitleRoute"),
    t("cargo.stepTitleExpenses"),
    t("cargo.stepTitleReview"),
    t("cargo.stepTitleResults"),
  ];
  const stageLabel: Record<CargoCostStage, string> = {
    factory: t("cargo.stageFactory"),
    port: t("cargo.stagePort"),
    customs: t("cargo.stageCustoms"),
    warehouse: t("cargo.stageWarehouse"),
    other: t("cargo.stageOther"),
  };
  const [items, setItems] = useState<ItemRow[]>([]);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [priceRows, setPriceRows] = useState<Record<string, ItemPriceRow>>({});
  const [locations, setLocations] = useState<
    Awaited<ReturnType<typeof db.listLogisticsLocations>>
  >([]);
  const [rates, setRates] = useState<LogisticsRateRow[]>([]);
  const [templates, setTemplates] = useState<LogisticsRouteTemplateRow[]>([]);
  const [step, setStep] = useState(0);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [showPriceSave, setShowPriceSave] = useState(false);
  const [priceSaveSelection, setPriceSaveSelection] = useState<
    Record<string, boolean>
  >({});
  const [priceSaveLevels, setPriceSaveLevels] = useState<
    Record<string, PriceLevel>
  >({});
  const [draft, setDraft, clearDraft] = useSessionDraft(
    "smart-trader:draft:cargo-pricing",
    emptyDraft(t("currency.sar"))
  );

  const load = async () => {
    await db.init();
    const [
      itemList,
      settingsRow,
      priceList,
      locationList,
      rateList,
      templateList,
    ] = await Promise.all([
      db.listItems(),
      db.getSettings(),
      db.listPrices(),
      db.listLogisticsLocations(),
      db.listLogisticsRates(),
      db.listLogisticsRouteTemplates(),
    ]);
    setItems([...itemList].sort((a, b) => a.name.localeCompare(b.name, "ar")));
    setSettings(settingsRow);
    setPriceRows(Object.fromEntries(priceList.map(row => [row.itemId, row])));
    setLocations(locationList.filter(row => row.active === 1));
    setRates(rateList.filter(row => row.active === 1));
    setTemplates(templateList.filter(row => row.active === 1));
    setDraft(current => {
      if (
        current.items.length > 0 ||
        current.name ||
        current.marginRate !== "20"
      )
        return current;
      return emptyDraft(
        settingsRow.localCurrency,
        String(Math.round(settingsRow.defaultMarginRate * 100))
      );
    });
  };

  useEffect(() => {
    void load();
  }, []);

  const localCurrency = settings?.localCurrency ?? "ريال";
  const foreignCurrency = settings?.foreignCurrency ?? "دولار";
  const selectedTemplate =
    templates.find(row => row.id === draft.routeTemplateId) ?? null;
  const matchingItems = items.filter(item =>
    [item.name, item.code, item.category]
      .join(" ")
      .toLowerCase()
      .includes(draft.itemSearch.trim().toLowerCase())
  );
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
      currency: source.currency || settings?.foreignCurrency || "دولار",
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
    const price = priceAtLevel(priceRows[cargoItem.itemId], level);
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
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })),
    [draft.items, draft.runId, itemById]
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
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })),
    [draft.costs, draft.routeTemplateId, draft.runId, localCurrency]
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

  const applyRate = (name: string, rateId: string) => {
    const rate = rates.find(row => row.id === rateId);
    if (!rate) return;
    setDraft(current => ({
      ...current,
      costs: current.costs.map(cost =>
        cost.name === name
          ? {
              ...cost,
              status: "entered",
              method: rate.method,
              amount: String(rate.amount),
              currency: rate.currency,
              exchangeRate:
                rate.currency === localCurrency
                  ? "1"
                  : String(settings?.defaultExchangeRate ?? 1),
              sourceLabel: `${t("settings.templateCountWord")}: ${rate.name}`,
              rateId: rate.id,
              reason: "",
            }
          : cost
      ),
    }));
  };

  const applyTemplate = () => {
    if (!selectedTemplate)
      return toast.error(t("cargo.selectRouteTemplateFirst"));
    setDraft(current => {
      let next: CargoDraft = {
        ...current,
        originLocationId: selectedTemplate.originLocationId,
        unloadingLocationId: selectedTemplate.unloadingLocationId,
        deliveryLocationId: selectedTemplate.deliveryLocationId,
        incoterm: selectedTemplate.incoterm,
        transportMode: selectedTemplate.transportMode,
      };
      if (selectedTemplate.incoterm === "CIF") {
        next = {
          ...next,
          costs: next.costs.map(cost =>
            cost.name === "الشحن الدولي"
              ? {
                  ...cost,
                  status: "included",
                  amount: "0",
                  sourceLabel: "مشمول في شرط التوريد (CIF)",
                  reason: "المورد يتحمل الشحن ضمن شرط التوريد",
                }
              : cost
          ),
        };
      }
      return next;
    });
    if (selectedTemplate.freightRateId && selectedTemplate.incoterm !== "CIF")
      applyRate(
        t("common.internationalfreight"),
        selectedTemplate.freightRateId
      );
    if (selectedTemplate.clearanceFeeRateId)
      applyRate(
        t("cargo.clearanceExpenses"),
        selectedTemplate.clearanceFeeRateId
      );
    if (selectedTemplate.transportRateId)
      applyRate(t("cargo.inlandTransport"), selectedTemplate.transportRateId);
    setShowTemplatePreview(false);
    toast.success(t("cargo.templateAppliedReview"));
  };

  const missingItems = draft.items.filter(
    item =>
      parseNumber(item.quantity) <= 0 ||
      parseNumber(item.unitPrice) < 0 ||
      (item.currency !== localCurrency && parseNumber(item.exchangeRate) <= 0)
  );
  const missingCosts = draft.costs.filter(cost => cost.status === "missing");
  const allocationForItem = (itemId: string) =>
    result.items.find(row => row.itemId === itemId);

  const saveRun = async (status: RunStatus) => {
    if (draft.items.length === 0)
      return toast.error(t("cargo.addAtLeastOneItem"));
    if (status === "approved" && missingItems.length > 0)
      return toast.error(t("cargo.completeItemBeforeApproval"));
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
    await db.saveCargoCostRun(run);
    await Promise.all([
      db.deleteCargoCostItems(runId),
      db.deleteCargoCostLines(runId),
      db.deleteCargoCostAllocations(runId),
    ]);
    const savedItems = cargoItems.map(item => {
      const calculation = allocationForItem(item.itemId);
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
      cargoLines.map(line =>
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
    setDraft(current => ({ ...current, runId, status }));
    toast.success(
      status === "approved"
        ? t("cargo.cargoFileApproved")
        : t("cargo.draftSaved")
    );
    if (status === "approved") {
      setPriceSaveSelection(
        Object.fromEntries(savedItems.map(item => [item.itemId, false]))
      );
      setPriceSaveLevels(
        Object.fromEntries(
          savedItems.map(item => [item.itemId, item.priceLevel])
        )
      );
      setShowPriceSave(true);
    }
  };

  const saveSelectedSalePrices = async () => {
    const selected = cargoItems.filter(item => priceSaveSelection[item.itemId]);
    if (selected.length === 0)
      return toast.info(t("cargo.selectItemToSaveSellingPrice"));
    const timestamp = nowIso();
    await Promise.all(
      selected.map(async cargoItem => {
        const level = priceSaveLevels[cargoItem.itemId] ?? cargoItem.priceLevel;
        const calculated = allocationForItem(cargoItem.itemId);
        const current = priceRows[cargoItem.itemId];
        const value = calculated?.suggestedPrice ?? 0;
        const fields =
          level === 1
            ? { price1: value, price1Date: timestamp.slice(0, 10) }
            : level === 2
              ? { price2: value, price2Date: timestamp.slice(0, 10) }
              : level === 3
                ? { price3: value, price3Date: timestamp.slice(0, 10) }
                : { price4: value, price4Date: timestamp.slice(0, 10) };
        const next: ItemPriceRow = {
          id: current?.id ?? newId("prc"),
          itemId: cargoItem.itemId,
          price1: current?.price1 ?? null,
          price1Date: current?.price1Date ?? "",
          price2: current?.price2 ?? null,
          price2Date: current?.price2Date ?? "",
          price3: current?.price3 ?? null,
          price3Date: current?.price3Date ?? "",
          price4: current?.price4 ?? null,
          price4Date: current?.price4Date ?? "",
          currency: localCurrency,
          notes: `${t("cargo.fromCargoFile")} ${draft.name || draft.runId}`,
          createdAt: current?.createdAt ?? timestamp,
          updatedAt: timestamp,
          ...fields,
        };
        await db.savePrice(next);
        await db.savePriceHistory({
          id: newId("hist"),
          itemId: cargoItem.itemId,
          priceLevel: level,
          price: value,
          effectiveDate: timestamp.slice(0, 10),
          currency: localCurrency,
          notes: next.notes,
          createdAt: timestamp,
        });
      })
    );
    setShowPriceSave(false);
    await load();
    toast.success(t("cargo.sellingPricesSaved"));
  };

  const newWork = () => {
    clearDraft();
    setDraft(
      emptyDraft(
        localCurrency,
        String(Math.round((settings?.defaultMarginRate ?? 0.2) * 100))
      )
    );
    setStep(0);
    toast.info(t("cargo.newCargoFileStarted"));
  };

  const templateRateName = (id: string) =>
    rates.find(row => row.id === id)?.name || t("common.none");
  const locationName = (id: string) =>
    locations.find(row => row.id === id)?.name || "—";
  const isCif = draft.incoterm === "CIF";

  return (
    <AppLayout
      title={t("cargo.cargoCostFile")}
      subtitle={t("cargo.cargoFileSubtitle")}
    >
      <div className="space-y-4 pb-8">
        <SectionCard
          title={draft.name || t("cargo.newCostFileTitle")}
          hint={
            draft.runId
              ? `${t("cargo.versionWord")} ${draft.version} · ${draft.status === "approved" ? t("cargo.statusApproved") : t("cargo.statusDraft")}`
              : t("cargo.localDraftHint")
          }
          stamp={t("nav.cargo")}
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-card"
              onClick={newWork}
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              {t("common.newWork")}
            </Button>
          }
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                className="field-input sm:col-span-2"
                value={draft.name}
                onChange={event => updateDraft({ name: event.target.value })}
                placeholder={t("cargo.fileNameExample")}
              />
              <Input
                className="field-input"
                value={draft.reference}
                onChange={event =>
                  updateDraft({ reference: event.target.value })
                }
                placeholder={t("cargo.referenceOrInvoice")}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="field-input min-h-11"
                value={draft.operationType}
                onChange={event =>
                  updateDraft({
                    operationType: event.target.value as OperationType,
                  })
                }
              >
                <option value="import">{t("cargo.importWord")}</option>
                <option value="local">{t("cargo.localPurchase")}</option>
              </select>
              <span
                className="flex min-h-11 items-center rounded border border-border bg-secondary/45 px-3 text-xs font-semibold text-[var(--ink)]"
                dir="ltr"
              >
                {localCurrency}
              </span>
            </div>
          </div>
        </SectionCard>

        <nav
          aria-label={t("cargo.costFileSteps")}
          className="overflow-x-auto rounded border border-border bg-card p-1.5"
        >
          <ol className="flex min-w-max gap-1.5">
            {STEP_TITLES.map((title, index) => (
              <li key={title}>
                <Button
                  type="button"
                  variant={step === index ? "default" : "ghost"}
                  className={
                    step === index
                      ? "min-h-11"
                      : "min-h-11 text-muted-foreground"
                  }
                  onClick={() => setStep(index)}
                >
                  <span
                    className="rounded bg-black/10 px-1.5 py-0.5 text-[10px]"
                    dir="ltr"
                  >
                    {index + 1}
                  </span>
                  {title}
                </Button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="space-y-4">
            {step === 0 ? (
              <SectionCard
                title={t("cargo.stepItemsLoad")}
                hint={t("cargo.stepItemsLoadHint")}
                stamp={t("cargo.stepStampLoad")}
              >
                <div className="rounded border border-[var(--amber-line)] bg-[var(--amber-field)]/55 p-3">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <Input
                      className="field-input"
                      value={draft.itemSearch}
                      onChange={event =>
                        updateDraft({ itemSearch: event.target.value })
                      }
                      placeholder={t("common.searchbynamecodeorcatego")}
                    />
                    <select
                      className="field-input"
                      value={optionValue(draft.newItemId)}
                      onChange={event =>
                        updateDraft({
                          newItemId: fromOption(event.target.value),
                        })
                      }
                    >
                      <option value="__none__">
                        {t("common.selectanitem")}
                      </option>
                      {matchingItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                          {item.code ? ` — ${item.code}` : ""}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      className="min-h-11"
                      onClick={addSelectedItem}
                    >
                      <PackagePlus className="h-4 w-4" />
                      {t("cargo.addToLoad")}
                    </Button>
                  </div>
                </div>
                {draft.items.length === 0 ? (
                  <div className="rounded border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    {t("cargo.noItemsInLoad")}.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {draft.items.map(cargoItem => {
                      const source = itemById[cargoItem.itemId];
                      const latest = latestDatedItemPrice(
                        priceRows[cargoItem.itemId] ?? null
                      );
                      const local = cargoItem.currency === localCurrency;
                      return (
                        <div
                          key={cargoItem.id}
                          className="rounded border border-border bg-card p-3"
                        >
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-[var(--ink-deep)]">
                                {source?.name ?? t("export.items")}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {source?.code || t("cargo.noCodeWord")} ·{" "}
                                {cargoItem.unit ||
                                  t("cargo.unspecifiedUnitWord")}{" "}
                                ·{" "}
                                {cargoItem.priceSource === "latest-dated"
                                  ? t("cargo.latestDatedPrice")
                                  : cargoItem.priceSource === "selected-level"
                                    ? t("cargo.manualLevel")
                                    : t("cargo.manualAdjustedPrice")}
                                {cargoItem.priceEffectiveDate
                                  ? ` · ${cargoItem.priceEffectiveDate}`
                                  : ""}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() =>
                                setDraft(current => ({
                                  ...current,
                                  items: current.items.filter(
                                    item => item.id !== cargoItem.id
                                  ),
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                            <div className="space-y-1">
                              <Label className="text-[11px]">
                                {t("common.pricelevel")}
                              </Label>
                              <select
                                className="field-input"
                                value={String(cargoItem.priceLevel)}
                                onChange={event =>
                                  selectPriceLevel(
                                    cargoItem,
                                    Number(event.target.value) as PriceLevel
                                  )
                                }
                              >
                                {[1, 2, 3, 4].map(level => {
                                  const row = priceAtLevel(
                                    priceRows[cargoItem.itemId],
                                    level as PriceLevel
                                  );
                                  return (
                                    <option key={level} value={level}>
                                      {t("prices.price")} {level}
                                      {row.price != null
                                        ? ` — ${row.price}`
                                        : t("common.notrecorded")}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">
                                {t("common.unitprice")} ({cargoItem.currency})
                              </Label>
                              <Input
                                className="field-input"
                                dir="ltr"
                                inputMode="decimal"
                                value={cargoItem.unitPrice}
                                onChange={event =>
                                  updateItem(cargoItem.id, {
                                    unitPrice: event.target.value,
                                    priceSource: "manual",
                                  })
                                }
                                placeholder={
                                  latest
                                    ? String(latest.price)
                                    : t("cargo.enterPrice")
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">
                                {t("common.exchangeRate")}
                              </Label>
                              <Input
                                className="field-input"
                                dir="ltr"
                                inputMode="decimal"
                                disabled={local}
                                value={local ? "1" : cargoItem.exchangeRate}
                                onChange={event =>
                                  updateItem(cargoItem.id, {
                                    exchangeRate: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">
                                {t("cargo.quantity")} ({cargoItem.unit})
                              </Label>
                              <Input
                                className="field-input"
                                dir="ltr"
                                inputMode="decimal"
                                value={cargoItem.quantity}
                                onChange={event =>
                                  updateItem(cargoItem.id, {
                                    quantity: event.target.value,
                                  })
                                }
                                placeholder="0"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">
                                {t("items.customsRate")}
                              </Label>
                              <Input
                                className="field-input"
                                dir="ltr"
                                inputMode="decimal"
                                value={cargoItem.customsRate}
                                onChange={event =>
                                  updateItem(cargoItem.id, {
                                    customsRate: event.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            ) : null}

            {step === 1 ? (
              <SectionCard
                title={t("cargo.stepRouteTemplate")}
                hint={t("cargo.stepRouteHint")}
                stamp={t("cargo.stepStampRoute")}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("cargo.routeTemplate")}</Label>
                    <select
                      className="field-input"
                      value={optionValue(draft.routeTemplateId)}
                      onChange={event => {
                        updateDraft({
                          routeTemplateId: fromOption(event.target.value),
                        });
                        setShowTemplatePreview(false);
                      }}
                    >
                      <option value="__none__">
                        {t("cargo.startWithoutTemplate")}
                      </option>
                      {templates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 flex-1 bg-card"
                      disabled={!selectedTemplate}
                      onClick={() => setShowTemplatePreview(true)}
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      {t("cargo.previewTemplate")}
                    </Button>
                    <Button
                      type="button"
                      className="min-h-11 flex-1"
                      disabled={!selectedTemplate}
                      onClick={applyTemplate}
                    >
                      <Check className="h-4 w-4" />
                      {t("cargo.applyTemplate")}
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("cargo.originLocation")}</Label>
                    <select
                      className="field-input"
                      value={optionValue(draft.originLocationId)}
                      onChange={event =>
                        updateDraft({
                          originLocationId: fromOption(event.target.value),
                        })
                      }
                    >
                      <option value="__none__">
                        {t("cargo.selectLocationIfNeeded")}
                      </option>
                      {locations.map(location => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("cargo.dischargePort")}</Label>
                    <select
                      className="field-input"
                      value={optionValue(draft.unloadingLocationId)}
                      onChange={event =>
                        updateDraft({
                          unloadingLocationId: fromOption(event.target.value),
                        })
                      }
                    >
                      <option value="__none__">
                        {t("cargo.selectLocationIfNeeded")}
                      </option>
                      {locations.map(location => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("cargo.deliveryLocation")}</Label>
                    <select
                      className="field-input"
                      value={optionValue(draft.deliveryLocationId)}
                      onChange={event =>
                        updateDraft({
                          deliveryLocationId: fromOption(event.target.value),
                        })
                      }
                    >
                      <option value="__none__">
                        {t("cargo.selectLocationIfNeeded")}
                      </option>
                      {locations.map(location => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>{t("cargo.supplyCondition")}</Label>
                      <select
                        className="field-input"
                        disabled={draft.operationType === "local"}
                        value={draft.incoterm}
                        onChange={event =>
                          updateDraft({ incoterm: event.target.value })
                        }
                      >
                        <option value="EXW">EXW</option>
                        <option value="FOB">FOB</option>
                        <option value="CFR">CFR</option>
                        <option value="CIF">CIF</option>
                        <option value="other">{t("common.other")}</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("cargo.transportType")}</Label>
                      <select
                        className="field-input"
                        value={draft.transportMode}
                        onChange={event =>
                          updateDraft({ transportMode: event.target.value })
                        }
                      >
                        <option value="بحري">{t("common.sea")}</option>
                        <option value="بري">{t("common.land")}</option>
                        <option value="جوي">{t("common.air")}</option>
                        <option value="محلي">{t("multiCalc.local")}</option>
                      </select>
                    </div>
                  </div>
                </div>
                {showTemplatePreview && selectedTemplate ? (
                  <div className="mt-4 rounded border border-[var(--port-green)]/25 bg-[var(--port-green-soft)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--ink)]">
                          {t("common.preview")}: {selectedTemplate.name}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {locationName(selectedTemplate.originLocationId)} ←{" "}
                          {locationName(selectedTemplate.unloadingLocationId)} ←{" "}
                          {locationName(selectedTemplate.deliveryLocationId)} ·{" "}
                          {selectedTemplate.incoterm} ·{" "}
                          {selectedTemplate.transportMode}
                        </p>
                      </div>
                      <Button type="button" size="sm" onClick={applyTemplate}>
                        {t("cargo.applyAfterReview")}
                      </Button>
                    </div>
                    <ul className="mt-3 grid gap-1 text-[11px] text-[var(--ink)]">
                      <li>
                        {t("common.freight")}:{" "}
                        {selectedTemplate.incoterm === "CIF"
                          ? t("cargo.includedInSupplyCondition")
                          : templateRateName(selectedTemplate.freightRateId)}
                      </li>
                      <li>
                        {t("cargo.clearanceFees")}:{" "}
                        {templateRateName(selectedTemplate.clearanceFeeRateId)}
                      </li>
                      <li>
                        {t("cargo.inlandTransport")}:{" "}
                        {templateRateName(selectedTemplate.transportRateId)}
                      </li>
                    </ul>
                  </div>
                ) : null}
              </SectionCard>
            ) : null}

            {step === 2 ? (
              <SectionCard
                title={t("cargo.stepExpenses")}
                hint={t("cargo.stepExpensesHint")}
                stamp={t("cargo.stepStampExpenses")}
              >
                <div className="space-y-3">
                  {draft.costs.map(cost => (
                    <div
                      key={cost.id}
                      className="rounded border border-border bg-card p-3"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {stageLabel[cost.stage]}
                          </span>
                          <p className="text-sm font-semibold text-[var(--ink)]">
                            {cost.name}
                          </p>
                          {cost.status === "included" ? (
                            <span className="rounded bg-[var(--port-green-soft)] px-1.5 py-0.5 text-[10px] text-[var(--ink)]">
                              {t("cargo.included")}
                            </span>
                          ) : null}
                          {cost.status === "missing" ? (
                            <span className="rounded bg-[var(--amber-field)] px-1.5 py-0.5 text-[10px] text-[var(--ink)]">
                              {t("cargo.amountRequired")}
                            </span>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() =>
                            updateCost(cost.id, {
                              status:
                                cost.status === "disabled"
                                  ? "missing"
                                  : "disabled",
                            })
                          }
                        >
                          {cost.status === "disabled" ? (
                            <Plus className="h-4 w-4" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {cost.status !== "disabled" ? (
                        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
                          <select
                            className="field-input"
                            value={cost.status}
                            onChange={event =>
                              updateCost(cost.id, {
                                status: event.target.value as CargoCostStatus,
                              })
                            }
                          >
                            <option value="entered">
                              {t("cargo.enteredAmount")}
                            </option>
                            <option value="included">
                              {t("cargo.includedInSupplierPrice")}
                            </option>
                            <option value="third-party">
                              {t("cargo.borneByOtherParty")}
                            </option>
                            <option value="missing">
                              {t("cargo.enterAmountNeeded")}
                            </option>
                          </select>
                          <select
                            className="field-input"
                            disabled={
                              cost.name === "الجمارك" ||
                              cost.status !== "entered"
                            }
                            value={cost.method}
                            onChange={event =>
                              updateCost(cost.id, {
                                method: event.target.value as CargoCostMethod,
                              })
                            }
                          >
                            <option value="fixed">
                              {t("cargo.fixedAmount")}
                            </option>
                            <option value="per-unit">
                              {t("cargo.perUnit")}
                            </option>
                            <option value="manual">{t("cargo.manual")}</option>
                          </select>
                          <Input
                            className="field-input"
                            dir="ltr"
                            inputMode="decimal"
                            disabled={
                              cost.name === "الجمارك" ||
                              cost.status !== "entered"
                            }
                            value={cost.amount}
                            onChange={event =>
                              updateCost(cost.id, {
                                amount: event.target.value,
                              })
                            }
                            placeholder={
                              cost.name === "الجمارك"
                                ? t("cargo.calcFromItemShare")
                                : t("cargo.amount")
                            }
                          />
                          <select
                            className="field-input"
                            disabled={
                              cost.name === "الجمارك" ||
                              cost.status !== "entered"
                            }
                            value={cost.currency}
                            onChange={event =>
                              updateCost(cost.id, {
                                currency: event.target.value,
                                exchangeRate:
                                  event.target.value === localCurrency
                                    ? "1"
                                    : cost.exchangeRate ||
                                      String(
                                        settings?.defaultExchangeRate ?? 1
                                      ),
                              })
                            }
                          >
                            <option value={localCurrency}>
                              {localCurrency}
                            </option>
                            <option value={foreignCurrency}>
                              {foreignCurrency}
                            </option>
                          </select>
                          <Input
                            className="field-input"
                            dir="ltr"
                            inputMode="decimal"
                            disabled={
                              cost.name === "الجمارك" ||
                              cost.status !== "entered" ||
                              cost.currency === localCurrency
                            }
                            value={
                              cost.currency === localCurrency
                                ? "1"
                                : cost.exchangeRate
                            }
                            onChange={event =>
                              updateCost(cost.id, {
                                exchangeRate: event.target.value,
                              })
                            }
                            placeholder={t("common.exchangerate")}
                          />
                          <select
                            className="field-input"
                            value={cost.allocationBasis}
                            disabled={cost.name === "الجمارك"}
                            onChange={event =>
                              updateCost(cost.id, {
                                allocationBasis: event.target
                                  .value as CargoAllocationBasis,
                              })
                            }
                          >
                            <option value="value">{t("cargo.byValue")}</option>
                            <option value="quantity">
                              {t("cargo.byQuantity")}
                            </option>
                            <option value="weight">
                              {t("cargo.byWeight")}
                            </option>
                            <option value="area">{t("cargo.byArea")}</option>
                            <option value="manual">{t("cargo.manual")}</option>
                          </select>
                          <select
                            className="field-input"
                            value={optionValue(cost.itemIds[0] || "")}
                            disabled={cost.method !== "per-unit"}
                            onChange={event =>
                              updateCost(cost.id, {
                                itemIds: fromOption(event.target.value)
                                  ? [fromOption(event.target.value)]
                                  : [],
                              })
                            }
                          >
                            <option value="__none__">
                              {t("cargo.allCompatibleItems")}
                            </option>
                            {draft.items.map(item => (
                              <option key={item.id} value={item.itemId}>
                                {itemById[item.itemId]?.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      {cost.name === "الجمارك" ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div className="rounded bg-secondary/55 px-2.5 py-2 text-[11px] text-muted-foreground">
                            {t("cargo.customsBaseNote")}.
                          </div>
                          <Input
                            className="field-input"
                            dir="ltr"
                            inputMode="decimal"
                            value={draft.customsBaseExtra}
                            onChange={event =>
                              updateDraft({
                                customsBaseExtra: event.target.value,
                              })
                            }
                            placeholder={t("cargo.customsBaseExtra")}
                          />
                        </div>
                      ) : null}
                      {cost.status === "included" ||
                      cost.status === "third-party" ? (
                        <Input
                          className="field-input mt-2"
                          value={cost.reason}
                          onChange={event =>
                            updateCost(cost.id, { reason: event.target.value })
                          }
                          placeholder={t("cargo.stateReason")}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {step === 3 ? (
              <SectionCard
                title={t("cargo.stepReview")}
                hint={t("cargo.stepReviewHint")}
                stamp={t("cargo.stepStampReview")}
              >
                <div className="space-y-3">
                  <div className="rounded border border-border bg-secondary/35 p-3 text-sm">
                    <p className="font-semibold text-[var(--ink)]">
                      {t("cargo.readinessSummary")}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li>
                        {draft.items.length} {t("cargo.itemsInLoad")}
                      </li>
                      <li>
                        {missingItems.length
                          ? `${missingItems.length} ${t("cargo.itemNeedsCompletion")}`
                          : t("cargo.itemsReady")}
                      </li>
                      <li>
                        {missingCosts.length
                          ? `${missingCosts.length} ${t("cargo.expenseNeedsAmount")}`
                          : t("cargo.allExpensesSet")}
                      </li>
                      <li>
                        {isCif
                          ? t("cargo.cifNote")
                          : t("cargo.servicePricesNote")}
                      </li>
                    </ul>
                  </div>
                  <Label>{t("cargo.fileNotes")}</Label>
                  <textarea
                    className="field-input min-h-28 w-full resize-y"
                    value={draft.notes}
                    onChange={event =>
                      updateDraft({ notes: event.target.value })
                    }
                    placeholder={t("cargo.referenceNotes")}
                  />
                </div>
              </SectionCard>
            ) : null}

            {step === 4 ? (
              <SectionCard
                title={t("cargo.loadResults")}
                hint={t("cargo.stepResultsHint")}
                stamp={t("cargo.stepStampResults")}
              >
                <div className="space-y-2">
                  {result.items.length ? (
                    result.items.map(row => (
                      <div
                        key={row.itemId}
                        className="grid gap-2 rounded border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[var(--ink)]">
                            {itemById[row.itemId]?.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {t("common.goodsvalue")}{" "}
                            {formatMoney(row.goodsValue, localCurrency)} ·{" "}
                            {t("cargo.expenseDistribution")}{" "}
                            {formatMoney(row.allocatedCost, localCurrency)}
                          </p>
                        </div>
                        <div className="rounded bg-secondary/50 px-3 py-2 text-end">
                          <p className="text-[10px] text-muted-foreground">
                            {t("home.unitCost")}
                          </p>
                          <p
                            className="ledger-figure text-base font-semibold text-[var(--ink)]"
                            dir="ltr"
                          >
                            {formatMoney(row.unitCost, localCurrency)}
                          </p>
                        </div>
                        <div className="rounded bg-[var(--port-green-soft)] px-3 py-2 text-end">
                          <p className="text-[10px] text-muted-foreground">
                            {t("common.suggestedsellingprice")}
                          </p>
                          <p
                            className="ledger-figure text-base font-semibold text-[var(--ink)]"
                            dir="ltr"
                          >
                            {formatMoney(row.suggestedPrice, localCurrency)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      {t("cargo.addItemsToShowResults")}.
                    </p>
                  )}
                </div>
              </SectionCard>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2 rounded border border-border bg-card p-3">
              <Button
                type="button"
                variant="outline"
                className="bg-card"
                disabled={step === 0}
                onClick={() => setStep(current => Math.max(0, current - 1))}
              >
                <ArrowRight className="h-4 w-4" />
                {t("cargo.previous")}
              </Button>
              <div className="flex flex-wrap gap-2">
                {step < STEP_TITLES.length - 1 ? (
                  <Button
                    type="button"
                    onClick={() =>
                      setStep(current =>
                        Math.min(STEP_TITLES.length - 1, current + 1)
                      )
                    }
                  >
                    {t("cargo.next")}
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="bg-card"
                  onClick={() => void saveRun("draft")}
                >
                  <Save className="h-4 w-4" />
                  {t("cargo.saveDraft")}
                </Button>
                <Button
                  type="button"
                  disabled={draft.items.length === 0 || missingItems.length > 0}
                  onClick={() => void saveRun("approved")}
                >
                  <Check className="h-4 w-4" />
                  {t("cargo.approveAndSave")}
                </Button>
              </div>
            </div>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-5">
            <SectionCard
              title={t("pricing.calculate")}
              hint={t("cargo.liveResultHint")}
              stamp={t("cargo.interimSummary")}
            >
              <div className="calc-line">
                <ul>
                  {[
                    {
                      label: t("cargo.stageInvoiceFactory"),
                      value: result.invoiceValue,
                    }, // i18n-deep
                    {
                      label: t("cargo.stageArrivedPort"),
                      value: result.invoiceValue + result.stageTotals.port,
                    }, // i18n-deep
                    {
                      label: t("cargo.stageAfterCustoms"),
                      value:
                        result.invoiceValue +
                        result.stageTotals.port +
                        result.stageTotals.customs,
                    }, // i18n-deep
                    {
                      label: t("cargo.stageArrivedWarehouse"),
                      value: result.totalCost,
                    }, // i18n-deep
                  ].map(line => (
                    <li
                      key={line.label}
                      className="calc-node flex items-center justify-between gap-3 border-b border-border/70 py-2.5"
                    >
                      <span className="text-xs text-foreground/85">
                        {line.label}
                      </span>
                      <span
                        className="ledger-figure text-sm text-[var(--ink)]"
                        dir="ltr"
                      >
                        {formatMoney(line.value, localCurrency)}
                      </span>
                    </li>
                  ))}
                  <li className="calc-node pt-3" data-total="true">
                    <div className="result-card rounded px-3 py-3">
                      <p className="text-[11px] text-[var(--ink)]/70">
                        {t("cargo.customsOnBase")}{" "}
                        {formatMoney(result.customsBase, localCurrency)}
                      </p>
                      <p
                        className="ledger-figure mt-1 text-xl text-[var(--ink-deep)]"
                        dir="ltr"
                      >
                        {formatMoney(result.customsAmount, localCurrency)}
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="mt-3 rounded border border-border bg-secondary/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                <InfoLine /> {t("cargo.customsDistributionNote")}.
              </div>
            </SectionCard>
            <SectionCard
              title={t("cargo.pricingDecision")}
              hint={t("cargo.profitOnCostNote")}
              stamp={t("common.sale")}
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">
                    {t("cargo.profitRate")} %
                  </Label>
                  <Input
                    className="field-input"
                    dir="ltr"
                    inputMode="decimal"
                    value={draft.marginRate}
                    onChange={event =>
                      updateDraft({ marginRate: event.target.value })
                    }
                  />
                </div>
                <div className="rounded bg-[var(--port-green-soft)] px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">
                    {t("cargo.suggestedRevenue")}
                  </p>
                  <p
                    className="ledger-figure mt-1 text-sm font-semibold text-[var(--ink)]"
                    dir="ltr"
                  >
                    {formatMoney(result.totalSuggestedRevenue, localCurrency)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                className="mt-3 w-full"
                variant="outline"
                onClick={() => setShowPriceSave(current => !current)}
                disabled={!draft.runId || draft.status !== "approved"}
              >
                <WalletCards className="h-4 w-4" />
                {t("cargo.saveSelectedSellingPrices")}
              </Button>
              {showPriceSave ? (
                <div className="mt-3 space-y-2 rounded border border-[var(--amber-line)] bg-[var(--amber-field)]/45 p-2.5">
                  {cargoItems.map(item => {
                    const calculated = allocationForItem(item.itemId);
                    return (
                      <div
                        key={item.itemId}
                        className="grid grid-cols-[auto_minmax(0,1fr)_90px] items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={Boolean(priceSaveSelection[item.itemId])}
                          onChange={event =>
                            setPriceSaveSelection(current => ({
                              ...current,
                              [item.itemId]: event.target.checked,
                            }))
                          }
                        />
                        <span className="truncate text-xs">
                          {itemById[item.itemId]?.name} ·{" "}
                          {formatMoney(
                            calculated?.suggestedPrice ?? 0,
                            localCurrency
                          )}
                        </span>
                        <select
                          className="field-input h-8 text-xs"
                          value={String(priceSaveLevels[item.itemId] ?? 1)}
                          onChange={event =>
                            setPriceSaveLevels(current => ({
                              ...current,
                              [item.itemId]: Number(
                                event.target.value
                              ) as PriceLevel,
                            }))
                          }
                        >
                          <option value="1">{t("cargo.priceWord")} 1</option>
                          <option value="2">{t("cargo.priceWord")} 2</option>
                          <option value="3">{t("cargo.priceWord")} 3</option>
                          <option value="4">{t("cargo.priceWord")} 4</option>
                        </select>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    size="sm"
                    className="mt-1 w-full"
                    onClick={() => void saveSelectedSalePrices()}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    {t("cargo.saveSelectedOnly")}
                  </Button>
                </div>
              ) : null}
            </SectionCard>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

function InfoLine() {
  return (
    <AlertTriangle className="me-1 inline h-3.5 w-3.5 text-[var(--ink)]/70" />
  );
}
