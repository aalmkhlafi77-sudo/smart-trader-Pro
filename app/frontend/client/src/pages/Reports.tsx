/**
 * التقارير الذكية — فلاتر وبحث في الأعلى، وعرض التقارير حسب الطلب.
 * تحليل الأصناف (فلاتر + نتائج) في ملفات reports/، وتقارير القرار في مكوّنها الخاص.
 */

import AppLayout from "@/components/AppLayout";
import CargoDecisionReports from "@/components/CargoDecisionReports";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChartNoAxesCombined, Search } from "lucide-react";
import {
  db,
  type CargoCostItemRow,
  type EntityRow,
  type ItemPriceRow,
  type ItemRow,
  type ItemSpecRow,
  type PricingRunRow,
  type SpecTemplateRow,
} from "@/lib/db";
import { useEffect, useMemo, useState } from "react";
import {
  ItemFilters,
  initialFilters,
  type ItemFilterValues,
} from "./reports/ItemFilters";
import { ItemResults } from "./reports/ItemResults";
import { useCargoDataRevision } from "@/lib/useCargoDataRevision";
import {
  buildReportRows,
  extractNumber,
  type ReportRow,
} from "./reports/reportModel";

export default function Reports() {
  const { t } = useLanguage();
  const cargoRevision = useCargoDataRevision();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [prices, setPrices] = useState<ItemPriceRow[]>([]);
  const [runs, setRuns] = useState<PricingRunRow[]>([]);
  const [specTemplates, setSpecTemplates] = useState<SpecTemplateRow[]>([]);
  const [specsByItem, setSpecsByItem] = useState<Record<string, ItemSpecRow[]>>(
    {}
  );
  const [filters, setFilters] = useState<ItemFilterValues>(initialFilters);
  const [reportSearch, setReportSearch] = useState("");
  const [showItems, setShowItems] = useState(true);
  const [showDecisions, setShowDecisions] = useState(false);
  const [openFilters, setOpenFilters] = useState(true);
  const [openResults, setOpenResults] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const [
        itemList,
        entityList,
        priceList,
        legacyRuns,
        cargoRuns,
        templateList,
      ] = await Promise.all([
        db.listItems(),
        db.listEntities(),
        db.listPrices(),
        db.listPricingRuns(),
        db.listCargoCostRuns(),
        db.listSpecTemplates(),
      ]);
      const cargoItemsNested = await Promise.all(
        cargoRuns.map(run => db.listCargoCostItems(run.id))
      );
      const fromCargo: PricingRunRow[] = cargoRuns.flatMap((run, index) =>
        cargoItemsNested[index].map((item: CargoCostItemRow) => ({
          id: `${run.id}:${item.id}`,
          itemId: item.itemId,
          itemName: item.itemName,
          priceLevel: item.priceLevel,
          unitPriceForeign: item.unitPrice,
          exchangeRate: item.exchangeRate,
          quantity: item.quantity,
          freight: 0,
          freightCurrency: "",
          shippingRoute: "",
          shippingType: "",
          freightLocal: 0,
          customsRate: item.customsRate,
          clearance: 0,
          transport: 0,
          otherCosts: 0,
          marginRate: run.marginRate,
          goodsValue: item.goodsValue,
          customsAmount: 0,
          totalContainerCost: item.finalUnitCost * item.quantity,
          unitCost: item.finalUnitCost,
          suggestedPrice: item.suggestedPrice,
          currency: run.currency,
          notes: run.notes,
          createdAt: run.updatedAt,
          updatedAt: run.updatedAt,
        }))
      );
      const specs: Record<string, ItemSpecRow[]> = {};
      for (const item of itemList)
        specs[item.id] = await db.listSpecsByItem(item.id);
      if (cancelled) return;
      setItems(itemList);
      setEntities(entityList);
      setPrices(priceList);
      setRuns([...legacyRuns, ...fromCargo]);
      setSpecTemplates(templateList);
      setSpecsByItem(specs);
    })();
    return () => {
      cancelled = true;
    };
  }, [cargoRevision]);

  const rows = useMemo<ReportRow[]>(
    () =>
      buildReportRows({
        items,
        entities,
        prices,
        runs,
        specTemplates,
        specsByItem,
      }),
    [entities, items, prices, runs, specTemplates, specsByItem]
  );

  const filtered = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    const includes = (actual: string, query: string) =>
      !query.trim() ||
      actual.toLowerCase().includes(query.trim().toLowerCase());
    const withinRange = (
      value: number | null,
      minText: string,
      maxText: string
    ) => {
      const min = minText.trim() === "" ? null : Number(minText);
      const max = maxText.trim() === "" ? null : Number(maxText);
      if (min == null && max == null) return true;
      if (value == null) return false;
      if (min != null && (!Number.isFinite(min) || value < min)) return false;
      if (max != null && (!Number.isFinite(max) || value > max)) return false;
      return true;
    };
    const result = rows.filter(row => {
      if (
        q &&
        ![row.item.name, row.entity?.name ?? "", row.item.category]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (filters.entityId !== "all" && row.item.entityId !== filters.entityId)
        return false;
      if (
        filters.entityKind !== "all" &&
        row.entity?.kind !== filters.entityKind
      )
        return false;
      if (filters.category !== "all" && row.item.category !== filters.category)
        return false;
      if (!includes(row.weight, filters.weight)) return false;
      if (!includes(row.material, filters.material)) return false;
      if (!includes(row.type, filters.type)) return false;
      if (
        !withinRange(
          row.supplierPrice,
          filters.supplierMin,
          filters.supplierMax
        )
      )
        return false;
      if (!withinRange(row.unitCost, filters.costMin, filters.costMax))
        return false;
      if (!withinRange(row.suggestedPrice, filters.saleMin, filters.saleMax))
        return false;
      if (!withinRange(row.margin, filters.marginMin, filters.marginMax))
        return false;
      return true;
    });
    const valueFor = (row: ReportRow): string | number => {
      if (filters.sortKey === "item") return row.item.name;
      if (filters.sortKey === "createdAt") return row.item.createdAt;
      if (filters.sortKey === "supplierPrice") return row.supplierPrice ?? -1;
      if (filters.sortKey === "unitCost") return row.unitCost ?? -1;
      if (filters.sortKey === "suggestedPrice") return row.suggestedPrice ?? -1;
      if (filters.sortKey === "margin") return row.margin ?? -1;
      return extractNumber(row.weight);
    };
    return result.sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      const base =
        typeof av === "string" && typeof bv === "string"
          ? av.localeCompare(bv, "ar")
          : av < bv
            ? -1
            : av > bv
              ? 1
              : 0;
      return filters.direction === "desc" ? -base : base;
    });
  }, [rows, filters, reportSearch]);

  const patchFilters = (patch: Partial<ItemFilterValues>) =>
    setFilters(current => ({ ...current, ...patch }));

  const resetFilters = () => {
    setFilters(initialFilters);
    setReportSearch("");
  };

  const toggleAll = () => {
    const next = !(openFilters && openResults);
    setOpenFilters(next);
    setOpenResults(next);
  };

  return (
    <AppLayout title={t("reports.title")} subtitle={t("reports.localSubtitle")}>
      <div className="space-y-5">
        <SectionCard
          title={t("reports.showReport")}
          hint={t("reports.localSubtitle")}
          stamp={t("common.reportengine")}
        >
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="field-input pr-8 text-xs h-9"
                placeholder={t("reports.searchReports")}
                value={reportSearch}
                onChange={e => setReportSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--ink)]">
                <Checkbox
                  checked={showItems}
                  onCheckedChange={v => setShowItems(v === true)}
                />
                {t("reports.viewItems")}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--ink)]">
                <Checkbox
                  checked={showDecisions}
                  onCheckedChange={v => setShowDecisions(v === true)}
                />
                {t("reports.viewDecisions")}
              </label>
              <Button
                size="sm"
                variant="outline"
                className="bg-card mr-auto"
                onClick={toggleAll}
              >
                {openFilters && openResults
                  ? t("reports.collapseAll")
                  : t("reports.expandAll")}
              </Button>
            </div>
          </div>
        </SectionCard>

        {showItems ? (
          <>
            <ItemFilters
              values={filters}
              onChange={patchFilters}
              entities={entities}
              items={items}
              count={filtered.length}
              open={openFilters}
              onToggle={() => setOpenFilters(v => !v)}
              onReset={resetFilters}
            />
            <ItemResults
              filtered={filtered}
              open={openResults}
              onToggle={() => setOpenResults(v => !v)}
            />
            <div className="flex items-start gap-2 rounded border border-border bg-secondary/40 px-3 py-2.5 text-[11px] text-muted-foreground">
              <ChartNoAxesCombined className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink)]/70" />
              <p>{t("reports.sourceNote")}.</p>
            </div>
          </>
        ) : null}

        {showDecisions ? <CargoDecisionReports /> : null}
      </div>
    </AppLayout>
  );
}
