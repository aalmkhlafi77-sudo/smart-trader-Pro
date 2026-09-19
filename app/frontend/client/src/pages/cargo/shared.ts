import type {
  CargoAllocationBasis,
  CargoCostMethod,
  CargoCostStage,
  CargoCostStatus,
  CargoOperationType,
  CargoRunStatus,
  ItemPriceRow,
  PriceLevel,
} from "@/lib/db";

export type OperationType = CargoOperationType;
export type RunStatus = CargoRunStatus;

export interface CargoItemDraft {
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

export interface CargoCostDraft {
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

export interface CargoDraft {
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

/** أسماء بنود التكلفة البدائية — مطابقة حرفية للمنطق (مقارنة الاسم "الجمارك" في المحرك). */
export const CUSTOMS_LINE_NAME = "الجمارك";
export const FREIGHT_LINE_NAME = "الشحن الدولي";
/** قيم مخزَّنة تُكتب في صفوف التكلفة (رموز ISO منذ S5). */
export const FALLBACK_FOREIGN_CURRENCY = "USD";
export const CIF_INCLUDED_LABEL = "مشمول في شرط التوريد (CIF)";
export const CIF_INCLUDED_REASON = "المورد يتحمل الشحن ضمن شرط التوريد";

export const COST_BLUEPRINTS: Array<
  Pick<
    CargoCostDraft,
    "name" | "stage" | "method" | "allocationBasis" | "status"
  >
> = [
  {
    name: FREIGHT_LINE_NAME,
    stage: "port",
    method: "fixed",
    allocationBasis: "value",
    status: "missing",
  },
  {
    name: CUSTOMS_LINE_NAME,
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

export const initialCost = (
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

export const emptyDraft = (currency: string, marginRate = "20"): CargoDraft => ({
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

export const priceAtLevel = (row: ItemPriceRow | undefined, level: PriceLevel) => {
  if (!row) return { price: null, effectiveDate: "" };
  const values = {
    1: { price: row.price1, effectiveDate: row.price1Date },
    2: { price: row.price2, effectiveDate: row.price2Date },
    3: { price: row.price3, effectiveDate: row.price3Date },
    4: { price: row.price4, effectiveDate: row.price4Date },
  };
  return values[level];
};

/**
 * المستوى الافتراضي لحفظ سعر محسوب: أول مستوى فارغ (لا يمس أسعار المورد الأصلية)،
 * وعند امتلاء المستويات الأربعة يُترك مستوى الصنف الحالي (استبدال صريح مسجَّل في history).
 */
export const firstEmptyLevel = (
  row: ItemPriceRow | null | undefined,
  fallback: PriceLevel
): PriceLevel => {
  const levels: PriceLevel[] = [1, 2, 3, 4];
  if (!row) return fallback;
  const empty = levels.find(
    level => priceAtLevel(row, level).price == null
  );
  return empty ?? fallback;
};

/**
 * تحويل سعر محسوب بالعملة المحلية إلى عملة الصنف قبل التخزين —
 * القاعدة التي تمنع خلط العملات داخل صف الأسعار. التقريب لمنزلتين
 * (نفس عرض الواجهة) حتى لا تُخزَّن كسور عشرية طويلة مرعبة.
 */
export const convertToItemCurrency = (
  suggestedLocal: number,
  rate: number
): number => {
  if (!(rate > 0)) return suggestedLocal;
  return Math.round((suggestedLocal / rate) * 100) / 100;
};

export const optionValue = (value: string) => value || "__none__";
export const fromOption = (value: string) => (value === "__none__" ? "" : value);

export interface CargoCheck {
  id: string;
  labelKey: string;
  ok: boolean;
  warnOnly?: boolean;
}
