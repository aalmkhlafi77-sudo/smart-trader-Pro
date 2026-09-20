import { useState } from "react";
import { ChevronDown, ChevronUp, FileSpreadsheet, Share2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, formatNumber } from "@/lib/pricing";
import { shareReport } from "@/lib/shareReport";
import { costLineLabel } from "@/pages/cargo/shared";
import type { RouteComparisonRow } from "@/lib/cargoDecisionReports";
import { exportRoutesExcel } from "./decisionExports";
import { useDecisionLabels } from "./useDecisionLabels";

export function RouteComparisonCard({
  routeRows,
}: {
  routeRows: RouteComparisonRow[];
}) {
  const { t } = useLanguage();
  const labels = useDecisionLabels();
  const [open, setOpen] = useState(true);

  const bestTotal = routeRows[0] ?? null;
  const share = () =>
    shareReport(
      t("cargo.routesComparison"),
      [
        `${t("cargo.compareRoutesCount")}: ${routeRows.length}`,
        bestTotal
          ? `${t("cargo.kpiLowestShipment")}: ${formatMoney(bestTotal.totalCost, bestTotal.run.currency)} — ${bestTotal.routeLabel}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      t
    );

  return (
    <SectionCard
      title={t("cargo.routesComparison")}
      hint={t("cargo.bestIsCheapestNote")}
      stamp={t("cargo.routeMatrix")}
      action={
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="bg-card"
            onClick={() => exportRoutesExcel(t, labels, routeRows)}
            disabled={routeRows.length === 0}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-card"
            onClick={() => void share()}
            disabled={routeRows.length === 0}
          >
            <Share2 className="h-3.5 w-3.5" />
            {t("reports.share")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setOpen(v => !v)}
            aria-label={open ? t("reports.collapseAll") : t("reports.expandAll")}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      }
    >
      {open ? (
        <>
          <div className="space-y-2 md:hidden">
            {routeRows.map((row, index) => (
              <article
                key={row.run.id}
                className="rounded border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--ink)]">
                      {row.run.name ||
                        row.run.reference ||
                        t("cargo.unnamedFileWord")}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {row.routeLabel}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {labels.statusLabel[row.run.status]}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded bg-secondary/70 p-2">
                    <p className="text-[9px] text-muted-foreground">
                      {t("cargo.totalWord")}
                    </p>
                    <p className="ledger-figure text-xs" dir="ltr">
                      {formatMoney(row.totalCost, row.run.currency)}
                    </p>
                  </div>
                  <div className="rounded bg-[var(--port-green-soft)] p-2">
                    <p className="text-[9px] text-muted-foreground">
                      {t("home.unitCost")}
                    </p>
                    <p className="ledger-figure text-xs" dir="ltr">
                      {row.unitCost == null
                        ? "—"
                        : formatMoney(row.unitCost, row.run.currency)}
                    </p>
                  </div>
                </div>
                {row.missingLines.length > 0 && (
                    <p className="mt-2 text-[10px] text-[var(--calc-amber)]">
                      {t("cargo.needsPricing")}:{" "}
                      {row.missingLines
                        .map(line => costLineLabel(line.name, t))
                        .join(t("common.listSeparator"))}
                    </p>
                )}
                {index === 0 && (
                  <p className="mt-2 text-[10px] text-[var(--port-green)]">
                    {t("cargo.lowestTotalCost")}
                  </p>
                )}
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block touch-pan-x scrollbar-ledger">
            <table className="w-full min-w-[1040px] text-right text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--ink)]/30 text-[11px] text-muted-foreground">
                  {[
                    t("cargo.cargoLoadFileWord"),
                    t("cargo.routeWord"),
                    t("common.status"),
                    t("cargo.invoiceShort"),
                    t("common.customs"),
                    t("cargo.logisticsWord"),
                    t("cargo.totalWord"),
                    t("home.unitCost"),
                    t("cargo.pricingGap"),
                    t("followup.savedDate"),
                  ].map(heading => (
                    <th
                      className="whitespace-nowrap px-3 py-3 font-semibold"
                      key={heading}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {routeRows.map((row, index) => (
                  <tr
                    className="border-b border-border/70 hover:bg-secondary/40"
                    key={row.run.id}
                  >
                    <td className="px-3 py-3 font-semibold text-[var(--ink)]">
                      {row.run.name || row.run.reference || "—"}
                      {index === 0 && (
                        <span className="mr-1.5 rounded bg-[var(--port-green-soft)] px-1.5 py-0.5 text-[9px] text-[var(--port-green)]">
                          {t("cargo.lowestWord")}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[260px] px-3 py-3 text-xs">
                      {row.routeLabel}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline">
                        {labels.statusLabel[row.run.status]}
                      </Badge>
                    </td>
                    <td className="ledger-figure px-3 py-3" dir="ltr">
                      {formatMoney(row.invoiceValue, row.run.currency)}
                    </td>
                    <td className="ledger-figure px-3 py-3" dir="ltr">
                      {formatMoney(row.customsAmount, row.run.currency)}
                    </td>
                    <td className="ledger-figure px-3 py-3" dir="ltr">
                      {formatMoney(row.logisticsCost, row.run.currency)}
                    </td>
                    <td
                      className="ledger-figure px-3 py-3 font-semibold"
                      dir="ltr"
                    >
                      {formatMoney(row.totalCost, row.run.currency)}
                    </td>
                    <td className="ledger-figure px-3 py-3" dir="ltr">
                      {row.unitCost == null
                        ? "—"
                        : formatMoney(row.unitCost, row.run.currency)}
                    </td>
                      <td className="px-3 py-3 text-xs text-[var(--calc-amber)]">
                        {row.missingLines
                          .map(line => costLineLabel(line.name, t))
                          .join(t("common.listSeparator")) || "—"}
                      </td>
                    <td className="px-3 py-3 text-xs" dir="ltr">
                      {formatDate(row.run.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </SectionCard>
  );
}
