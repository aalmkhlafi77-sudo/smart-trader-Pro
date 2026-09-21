import { useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Columns3,
  FileSpreadsheet,
  Printer,
  Share2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import EmptyHint from "@/components/EmptyHint";
import SectionCard from "@/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatMoney, formatNumber } from "@/lib/pricing";
import type { ReportRow } from "./reportModel";
import { summarizeReportRows } from "./reportModel";
import {
  REPORT_COLUMN_KEYS,
  type ReportColumnKey,
  type ReportColumnVisibility,
  useReportColumnVisibility,
} from "./reportColumns";
import { useReportExport } from "./useReportExport";

function SummaryCards({
  filtered,
  visibility,
}: {
  filtered: ReportRow[];
  visibility: ReportColumnVisibility;
}) {
  const { t } = useLanguage();
  const summary = useMemo(() => summarizeReportRows(filtered), [filtered]);
  const cards = [
    {
      column: "item" as const,
      label: t("common.matchingitems"),
      value: formatNumber(summary.count),
      suffix: t("export.items"),
    },
    {
      column: "supplierPrice" as const,
      label: t("common.averagesupplierprice"),
      value: formatNumber(summary.avgSupplier),
      suffix: t("common.byitemcurrency"),
    },
    {
      column: "unitCost" as const,
      label: t("common.averageunitcost"),
      value: formatNumber(summary.avgCost),
      suffix: t("reports.lastSavedCalc"),
    },
    {
      column: "margin" as const,
      label: t("common.averagemargin"),
      value: formatNumber(summary.avgMargin),
      suffix: "%",
    },
  ].filter(card => visibility[card.column]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => (
        <div
          key={card.label}
          className="ledger-card border-r-[3px] border-r-[var(--port-green)] p-4"
        >
          <p className="text-[11px] text-muted-foreground">{card.label}</p>
          <p className="ledger-figure mt-1 text-xl text-[var(--ink)]" dir="ltr">
            {card.value}
          </p>
          <p className="text-[10px] text-muted-foreground">{card.suffix}</p>
        </div>
      ))}
    </div>
  );
}

function MobileItemCard({
  row,
  visibility,
  labels,
  t,
}: {
  row: ReportRow;
  visibility: ReportColumnVisibility;
  labels: Record<ReportColumnKey, string>;
  t: (key: string) => string;
}) {
  const details = [
    {
      key: "entity" as const,
      value: row.entity?.name ?? t("items.noPartner"),
    },
    { key: "weight" as const, value: row.weight },
    { key: "material" as const, value: row.material },
    { key: "type" as const, value: row.type },
    { key: "createdAt" as const, value: formatDate(row.item.createdAt) },
  ].filter(detail => visibility[detail.key]);
  const metrics = [
    {
      key: "supplierPrice" as const,
      value:
        row.supplierPrice == null
          ? "—"
          : formatMoney(row.supplierPrice, row.item.currency),
    },
    {
      key: "unitCost" as const,
      value:
        row.unitCost == null
          ? "—"
          : formatMoney(row.unitCost, row.costCurrency),
    },
    {
      key: "suggestedPrice" as const,
      value:
        row.suggestedPrice == null
          ? "—"
          : formatMoney(row.suggestedPrice, row.costCurrency),
    },
    {
      key: "margin" as const,
      value: row.margin == null ? "—" : `${formatNumber(row.margin)}%`,
    },
  ].filter(metric => visibility[metric.key]);

  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="flex justify-between gap-3">
        <p className="font-semibold text-[var(--ink)]">{row.item.name}</p>
        {visibility.category ? (
          <Badge variant="outline">
            {row.item.category || t("items.generalCategory")}
          </Badge>
        ) : null}
      </div>
      {details.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {details.map(detail => (
            <span key={detail.key}>
              {labels[detail.key]}: {detail.value}
            </span>
          ))}
        </div>
      ) : null}
      {metrics.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
          {metrics.map(metric => (
            <div
              key={metric.key}
              className="rounded bg-[var(--port-green-soft)] p-1.5"
            >
              <p className="text-[9px] text-muted-foreground">
                {labels[metric.key]}
              </p>
              <p className="ledger-figure text-xs" dir="ltr">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ItemResults({
  filtered,
  open,
  onToggle,
}: {
  filtered: ReportRow[];
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useLanguage();
  const { visibility, setColumnVisible } = useReportColumnVisibility();
  const { exportReportExcel, exportReportPdf, shareSummary } = useReportExport(
    filtered,
    visibility
  );
  const labels: Record<ReportColumnKey, string> = {
    item: t("common.item"),
    entity: t("common.entity"),
    category: t("common.category"),
    weight: t("common.weight"),
    material: t("common.material"),
    type: t("entities.type"),
    supplierPrice: t("common.supplierprice"),
    unitCost: t("reports.costWord"),
    suggestedPrice: t("common.sellingprice"),
    margin: t("common.margin2"),
    createdAt: t("common.dateadded"),
  };
  const screenColumns: Array<{
    key: ReportColumnKey;
    label: string;
    value: (row: ReportRow) => string;
    className?: string;
    dir?: "ltr";
  }> = [
    {
      key: "item",
      label: labels.item,
      value: row => row.item.name,
      className: "font-semibold text-[var(--ink)]",
    },
    {
      key: "entity",
      label: labels.entity,
      value: row => row.entity?.name ?? "—",
    },
    {
      key: "category",
      label: labels.category,
      value: row => row.item.category || "—",
    },
    {
      key: "weight",
      label: labels.weight,
      value: row => row.weight,
      dir: "ltr",
    },
    {
      key: "material",
      label: labels.material,
      value: row => row.material,
    },
    {
      key: "type",
      label: labels.type,
      value: row => row.type,
    },
    {
      key: "supplierPrice",
      label: labels.supplierPrice,
      value: row =>
        row.supplierPrice == null
          ? "—"
          : formatMoney(row.supplierPrice, row.item.currency),
      className: "ledger-figure",
      dir: "ltr",
    },
    {
      key: "unitCost",
      label: labels.unitCost,
      value: row =>
        row.unitCost == null
          ? "—"
          : formatMoney(row.unitCost, row.costCurrency),
      className: "ledger-figure",
      dir: "ltr",
    },
    {
      key: "suggestedPrice",
      label: labels.suggestedPrice,
      value: row =>
        row.suggestedPrice == null
          ? "—"
          : formatMoney(row.suggestedPrice, row.costCurrency),
      className: "ledger-figure font-semibold text-[var(--ink)]",
      dir: "ltr",
    },
    {
      key: "margin",
      label: labels.margin,
      value: row => (row.margin == null ? "—" : `${formatNumber(row.margin)}%`),
      className: "ledger-figure",
      dir: "ltr",
    },
    {
      key: "createdAt",
      label: labels.createdAt,
      value: row => formatDate(row.item.createdAt),
      dir: "ltr",
    },
  ];
  const visibleScreenColumns = screenColumns.filter(
    column => visibility[column.key]
  );

  return (
    <div className="space-y-5">
      <SummaryCards filtered={filtered} visibility={visibility} />

      <SectionCard
        title={t("common.reportresults")}
        hint={t("common.comparableregisterbasedo")}
        stamp={t("common.analyticalstatement")}
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="bg-card">
                  <Columns3 className="h-3.5 w-3.5" />
                  {t("reports.customizeColumns")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  {t("reports.visibleColumns")}
                </DropdownMenuLabel>
                {REPORT_COLUMN_KEYS.map(key => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={visibility[key]}
                    disabled={key === "item"}
                    onCheckedChange={checked =>
                      setColumnVisible(key, checked === true)
                    }
                    onSelect={event => event.preventDefault()}
                  >
                    {labels[key]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="outline"
              className="bg-card"
              onClick={exportReportExcel}
              disabled={filtered.length === 0}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-card"
              onClick={exportReportPdf}
              disabled={filtered.length === 0}
            >
              <Printer className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-card"
              onClick={() => void shareSummary()}
              disabled={filtered.length === 0}
            >
              <Share2 className="h-3.5 w-3.5" />
              {t("reports.share")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={onToggle}
              aria-label={
                open ? t("reports.collapseAll") : t("reports.expandAll")
              }
            >
              {open ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        }
      >
        {open ? (
          filtered.length === 0 ? (
            <EmptyHint text={t("common.nomatchingresultsadjustf")} />
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {filtered.map(row => (
                  <MobileItemCard
                    key={row.item.id}
                    row={row}
                    visibility={visibility}
                    labels={labels}
                    t={t}
                  />
                ))}
              </div>
              <div className="hidden touch-pan-x overflow-x-auto scrollbar-ledger md:block">
                <table className="w-full min-w-max text-right text-sm">
                  <thead>
                    <tr className="border-b-2 border-[var(--ink)]/30 text-[11px] text-muted-foreground">
                      {visibleScreenColumns.map(column => (
                        <th
                          key={column.key}
                          className="whitespace-nowrap px-3 py-3 font-semibold"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(row => (
                      <tr
                        key={row.item.id}
                        className="border-b border-border/70 hover:bg-secondary/40"
                      >
                        {visibleScreenColumns.map(column => (
                          <td
                            key={column.key}
                            className={`px-3 py-3 ${column.className ?? ""}`}
                            dir={column.dir}
                          >
                            {column.value(row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : null}
      </SectionCard>
    </div>
  );
}
