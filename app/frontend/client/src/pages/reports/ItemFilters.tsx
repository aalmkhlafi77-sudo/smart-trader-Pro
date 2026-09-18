import { useMemo } from "react";
import { ChevronDown, ChevronUp, FilterX } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Direction, SortKey } from "./reportModel";
import { PriceRanges } from "./PriceRanges";

export interface ItemFilterValues {
  entityId: string;
  entityKind: string;
  category: string;
  weight: string;
  material: string;
  type: string;
  supplierMin: string;
  supplierMax: string;
  costMin: string;
  costMax: string;
  saleMin: string;
  saleMax: string;
  marginMin: string;
  marginMax: string;
  sortKey: SortKey;
  direction: Direction;
}

export const initialFilters: ItemFilterValues = {
  entityId: "all",
  entityKind: "all",
  category: "all",
  weight: "",
  material: "",
  type: "",
  supplierMin: "",
  supplierMax: "",
  costMin: "",
  costMax: "",
  saleMin: "",
  saleMax: "",
  marginMin: "",
  marginMax: "",
  sortKey: "createdAt",
  direction: "desc",
};

export function ItemFilters({
  values,
  onChange,
  entities,
  items,
  count,
  open,
  onToggle,
  onReset,
}: {
  values: ItemFilterValues;
  onChange: (patch: Partial<ItemFilterValues>) => void;
  entities: { id: string; name: string }[];
  items: { category: string }[];
  count: number;
  open: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const { t } = useLanguage();
  const set = onChange;
  const categories = useMemo(
    () =>
      Array.from(new Set(items.map(item => item.category).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "ar")
      ),
    [items]
  );

  return (
    <SectionCard
      title={t("common.reportfilters")}
      hint={t("common.choosewhatyouwanttocompa")}
      stamp={t("common.reportengine")}
      action={
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {count} {t("reports.resultWord")}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="bg-card"
            onClick={onReset}
          >
            <FilterX className="h-3.5 w-3.5" />
            {t("common.clear")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={onToggle}
            aria-label={open ? t("reports.collapseAll") : t("reports.expandAll")}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      }
    >
      {open ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t("common.entity")}</Label>
              <Select value={values.entityId} onValueChange={v => set({ entityId: v })}>
                <SelectTrigger className="field-input w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.allpartners")}</SelectItem>
                  {entities.map(entity => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.partnertype")}</Label>
              <Select value={values.entityKind} onValueChange={v => set({ entityKind: v })}>
                <SelectTrigger className="field-input w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.alltypes")}</SelectItem>
                  <SelectItem value="supplier">{t("common.suppliers")}</SelectItem>
                  <SelectItem value="factory">{t("common.factories")}</SelectItem>
                  <SelectItem value="customer">{t("common.customers")}</SelectItem>
                  <SelectItem value="other">{t("entities.kind.other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.category")}</Label>
              <Select value={values.category} onValueChange={v => set({ category: v })}>
                <SelectTrigger className="field-input w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.allcategories")}</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.weight")}</Label>
              <Input
                className="field-input"
                placeholder={t("common.example2000")}
                value={values.weight}
                onChange={e => set({ weight: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.material")}</Label>
              <Input
                className="field-input"
                placeholder={t("common.examplepolypropylene")}
                value={values.material}
                onChange={e => set({ material: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("entities.type")}</Label>
              <Input
                className="field-input"
                placeholder={t("common.examplesupershrink")}
                value={values.type}
                onChange={e => set({ type: e.target.value })}
              />
            </div>
          </div>
          <PriceRanges values={values} onChange={set} />
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end rounded border border-border bg-secondary/40 p-3">
            <div className="space-y-1.5">
              <Label>{t("common.sortby")}</Label>
              <Select
                value={values.sortKey}
                onValueChange={value => set({ sortKey: value as SortKey })}
              >
                <SelectTrigger className="bg-card w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">{t("common.dateadded")}</SelectItem>
                  <SelectItem value="item">{t("items.name")}</SelectItem>
                  <SelectItem value="weight">{t("common.weight")}</SelectItem>
                  <SelectItem value="supplierPrice">{t("common.supplierprice")}</SelectItem>
                  <SelectItem value="unitCost">{t("reports.costWord")}</SelectItem>
                  <SelectItem value="suggestedPrice">{t("common.sellingprice")}</SelectItem>
                  <SelectItem value="margin">{t("settings.profitMargin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.direction")}</Label>
              <Select
                value={values.direction}
                onValueChange={value => set({ direction: value as Direction })}
              >
                <SelectTrigger className="bg-card w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">{t("common.descending")}</SelectItem>
                  <SelectItem value="asc">{t("common.ascending")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex h-10 items-center justify-center gap-1.5 text-sm text-muted-foreground">
              {count} {t("reports.resultWord")}
            </div>
          </div>
        </>
      ) : null}
    </SectionCard>
  );
}
