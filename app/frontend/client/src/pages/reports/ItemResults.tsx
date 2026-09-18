import { useMemo } from "react";
import { ChevronDown, ChevronUp, FileSpreadsheet, Printer, Share2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import EmptyHint from "@/components/EmptyHint";
import SectionCard from "@/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, formatNumber } from "@/lib/pricing";
import type { ReportRow } from "./reportModel";
import { summarizeReportRows } from "./reportModel";
import { useReportExport } from "./useReportExport";

function SummaryCards({ filtered }: { filtered: ReportRow[] }) {
  const { t } = useLanguage();
  const summary = useMemo(() => summarizeReportRows(filtered), [filtered]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {
          label: t("common.matchingitems"),
          value: formatNumber(summary.count),
          suffix: t("export.items"),
        },
        {
          label: t("common.averagesupplierprice"),
          value: formatNumber(summary.avgSupplier),
          suffix: t("common.byitemcurrency"),
        },
        {
          label: t("common.averageunitcost"),
          value: formatNumber(summary.avgCost),
          suffix: t("reports.lastSavedCalc"),
        },
        {
          label: t("common.averagemargin"),
          value: formatNumber(summary.avgMargin),
          suffix: "%",
        },
      ].map(card => (
        <div
          key={card.label}
          className="ledger-card border-r-[3px] border-r-[var(--port-green)] p-4"
        >
          <p className="text-[11px] text-muted-foreground">{card.label}</p>
          <p
            className="ledger-figure mt-1 text-xl text-[var(--ink)]"
            dir="ltr"
          >
            {card.value}
          </p>
          <p className="text-[10px] text-muted-foreground">{card.suffix}</p>
        </div>
      ))}
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
  const { exportReportExcel, exportReportPdf, shareSummary } =
    useReportExport(filtered);

  return (
    <div className="space-y-5">
      <SummaryCards filtered={filtered} />

      <SectionCard
        title={t("common.reportresults")}
        hint={t("common.comparableregisterbasedo")}
        stamp={t("common.analyticalstatement")}
        action={
          <div className="flex flex-wrap items-center gap-1.5">
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
              aria-label={open ? t("reports.collapseAll") : t("reports.expandAll")}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                  <div
                    key={row.item.id}
                    className="rounded border border-border bg-card p-3"
                  >
                    <div className="flex justify-between gap-3">
                      <p className="font-semibold text-[var(--ink)]">
                        {row.item.name}
                      </p>
                      <Badge variant="outline">
                        {row.item.category || "بدون تصنيف"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {row.entity?.name ?? "غير مرتبط بجهة"} · {row.weight} ·{" "}
                      {row.material} · {t("entities.type")}: {row.type}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                      <div className="rounded bg-secondary/70 p-1.5">
                        <p className="text-[9px] text-muted-foreground">
                          {t("common.originalsupplier")}
                        </p>
                        <p className="ledger-figure text-xs" dir="ltr">
                          {row.supplierPrice == null
                            ? "—"
                            : formatMoney(row.supplierPrice, row.item.currency)}
                        </p>
                      </div>
                      <div className="rounded bg-[var(--port-green-soft)] p-1.5">
                        <p className="text-[9px] text-muted-foreground">
                          {t("reports.costWord")}
                        </p>
                        <p className="ledger-figure text-xs" dir="ltr">
                          {row.unitCost == null
                            ? "—"
                            : formatNumber(row.unitCost)}
                        </p>
                      </div>
                      <div className="rounded bg-[var(--port-green-soft)] p-1.5">
                        <p className="text-[9px] text-muted-foreground">
                          {t("common.sale")}
                        </p>
                        <p className="ledger-figure text-xs" dir="ltr">
                          {row.suggestedPrice == null
                            ? "—"
                            : formatNumber(row.suggestedPrice)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto touch-pan-x scrollbar-ledger">
                <table className="w-full min-w-[1040px] text-right text-sm">
                  <thead>
                    <tr className="border-b-2 border-[var(--ink)]/30 text-[11px] text-muted-foreground">
                      {[
                        t("common.item"),
                        t("common.entity"),
                        t("common.category"),
                        t("common.weight"),
                        t("common.material"),
                        t("entities.type"),
                        t("common.supplierprice"),
                        t("reports.costWord"),
                        t("common.sellingprice"),
                        t("common.margin2"),
                        t("common.dateadded"),
                      ].map(heading => (
                        <th
                          key={heading}
                          className="whitespace-nowrap px-3 py-3 font-semibold"
                        >
                          {heading}
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
                        <td className="px-3 py-3 font-semibold text-[var(--ink)]">
                          {row.item.name}
                        </td>
                        <td className="px-3 py-3">{row.entity?.name ?? "—"}</td>
                        <td className="px-3 py-3">
                          {row.item.category || "—"}
                        </td>
                        <td className="px-3 py-3" dir="ltr">
                          {row.weight}
                        </td>
                        <td className="px-3 py-3">{row.material}</td>
                        <td className="px-3 py-3">{row.type}</td>
                        <td className="ledger-figure px-3 py-3" dir="ltr">
                          {row.supplierPrice == null
                            ? "—"
                            : formatMoney(row.supplierPrice, row.item.currency)}
                        </td>
                        <td className="ledger-figure px-3 py-3" dir="ltr">
                          {row.unitCost == null
                            ? "—"
                            : formatMoney(row.unitCost, row.costCurrency)}
                        </td>
                        <td
                          className="ledger-figure px-3 py-3 font-semibold text-[var(--ink)]"
                          dir="ltr"
                        >
                          {row.suggestedPrice == null
                            ? "—"
                            : formatMoney(row.suggestedPrice, row.costCurrency)}
                        </td>
                        <td className="ledger-figure px-3 py-3" dir="ltr">
                          {row.margin == null
                            ? "—"
                            : `${formatNumber(row.margin)}%`}
                        </td>
                        <td className="px-3 py-3" dir="ltr">
                          {formatDate(row.item.createdAt)}
                        </td>
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
