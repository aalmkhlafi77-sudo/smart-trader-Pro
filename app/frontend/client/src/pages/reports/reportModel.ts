import type {
  EntityRow,
  ItemPriceRow,
  ItemRow,
  ItemSpecRow,
  PricingRunRow,
  SpecTemplateRow,
} from "@/lib/db";

export type SortKey =
  | "createdAt"
  | "item"
  | "supplierPrice"
  | "unitCost"
  | "suggestedPrice"
  | "margin"
  | "weight";
export type Direction = "asc" | "desc";

export interface ReportRow {
  item: ItemRow;
  entity: EntityRow | null;
  specs: ItemSpecRow[];
  weight: string;
  material: string;
  type: string;
  supplierPrice: number | null;
  unitCost: number | null;
  suggestedPrice: number | null;
  margin: number | null;
  costCurrency: string;
}

export const lookupSpec = (specs: ItemSpecRow[], labels: string[]) => {
  const found = specs.find(s =>
    labels.some(label => s.label.trim().includes(label))
  );
  return found ? `${found.value} ${found.unit}`.trim() : "—";
};

export const extractNumber = (value: string) => {
  const found = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return found ? Number(found[0]) : 0;
};

/** مجموعات تسميات المواصفات للمطابقة مع بيانات المستخدم العربية — محمية عبر ALLOW_DEC. */
const SPEC_LABEL_GROUPS = {
  weight: ["وزن", "جرام", "غرام"],
  material: ["خامة", "مادة", "خيط"],
  type: ["نوع"],
};

export function summarizeReportRows(filtered: ReportRow[]) {
  const withCost = filtered.filter(r => r.unitCost != null);
  const avg = (values: number[]) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  return {
    count: filtered.length,
    avgSupplier: avg(
      filtered.flatMap(r => (r.supplierPrice == null ? [] : [r.supplierPrice]))
    ),
    avgCost: avg(withCost.flatMap(r => (r.unitCost == null ? [] : [r.unitCost]))),
    avgMargin: avg(withCost.flatMap(r => (r.margin == null ? [] : [r.margin]))),
  };
}

export function buildReportRows(args: {
  items: ItemRow[];
  entities: EntityRow[];
  prices: ItemPriceRow[];
  runs: PricingRunRow[];
  specTemplates: SpecTemplateRow[];
  specsByItem: Record<string, ItemSpecRow[]>;
}): ReportRow[] {
  const { items, entities, prices, runs, specTemplates, specsByItem } = args;
  const templateFor = (label: string, category: string) =>
    specTemplates.find(
      template => template.label === label && template.category === category
    ) ??
    specTemplates.find(
      template => template.label === label && template.category === ""
    );
  return items.map(item => {
    const specs = [...(specsByItem[item.id] ?? [])]
      .filter(
        spec => templateFor(spec.label, item.category)?.showInReports !== 0
      )
      .sort(
        (a, b) =>
          (templateFor(a.label, item.category)?.sortOrder ??
            10000 + a.sortOrder) -
          (templateFor(b.label, item.category)?.sortOrder ??
            10000 + b.sortOrder)
      );
    const price = prices.find(row => row.itemId === item.id);
    const latest = runs
      .filter(run => run.itemId === item.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return {
      item,
      entity: entities.find(entity => entity.id === item.entityId) ?? null,
      specs,
        weight: lookupSpec(specs, SPEC_LABEL_GROUPS.weight),
        material: lookupSpec(specs, SPEC_LABEL_GROUPS.material),
        type: lookupSpec(specs, SPEC_LABEL_GROUPS.type),
      supplierPrice: price?.price1 ?? null,
      unitCost: latest?.unitCost ?? null,
      suggestedPrice: latest?.suggestedPrice ?? null,
      margin: latest ? latest.marginRate * 100 : null,
      costCurrency: latest?.currency ?? item.currency,
    };
  });
}
