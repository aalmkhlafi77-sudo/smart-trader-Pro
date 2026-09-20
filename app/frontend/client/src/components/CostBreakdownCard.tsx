import { useState } from "react";
import { ChevronDown, ChevronUp, Printer, Share2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildCostBreakdown,
  type CargoDecisionRun,
  type RouteComparisonRow,
} from "@/lib/cargoDecisionReports";
import { formatDate, formatMoney, formatNumber } from "@/lib/pricing";
import { shareReport } from "@/lib/shareReport";
import { costLineLabel } from "@/pages/cargo/shared";
import {
  exportBreakdownPdf,
  exportComprehensivePdf,
} from "./decisionExports";
import { useDecisionLabels } from "./useDecisionLabels";

export function CostBreakdownCard({
  details,
  routeRows,
}: {
  details: CargoDecisionRun[];
  routeRows: RouteComparisonRow[];
}) {
  const { t } = useLanguage();
  const labels = useDecisionLabels();
  const [selectedRunId, setSelectedRunId] = useState("");
  const [open, setOpen] = useState(true);

  const selectedDetail =
    details.find(entry => entry.run.id === selectedRunId) ?? details[0] ?? null;
  const breakdown = selectedDetail ? buildCostBreakdown(selectedDetail) : null;

  const share = () => {
    if (!selectedDetail || !breakdown) return;
    return shareReport(
      t("cargo.shipmentCostBreakdown"),
      [
        selectedDetail.run.name || selectedDetail.run.reference,
        `${t("cargo.totalWord")}: ${formatMoney(breakdown.totalCost, selectedDetail.run.currency)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      t
    );
  };

  return (
    <SectionCard
      title={t("cargo.shipmentCostBreakdown")}
      hint={t("cargo.breakdownPickHint")}
      stamp={t("pricing.calculate")}
      action={
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="bg-card"
            onClick={() =>
              selectedDetail &&
              breakdown &&
              exportBreakdownPdf(t, labels, selectedDetail, breakdown)
            }
            disabled={!selectedDetail || !breakdown}
          >
            <Printer className="h-3.5 w-3.5" /> {t("cargo.breakdownWord")} PDF
          </Button>
          <Button
            size="sm"
            onClick={() =>
              selectedDetail &&
              breakdown &&
              exportComprehensivePdf(t, labels, selectedDetail, breakdown, routeRows)
            }
            disabled={!selectedDetail || !breakdown || routeRows.length === 0}
          >
            <Printer className="h-3.5 w-3.5" /> PDF {t("cargo.allInclusive")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-card"
            onClick={() => void share()}
            disabled={!selectedDetail || !breakdown}
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
          <div className="mb-4 max-w-xl space-y-1.5">
            <Label>{t("cargo.cargoCostFile")}</Label>
            <Select
              value={selectedDetail?.run.id ?? ""}
              onValueChange={setSelectedRunId}
            >
              <SelectTrigger className="field-input w-full">
                <SelectValue placeholder={t("cargo.selectCostFile")} />
              </SelectTrigger>
              <SelectContent>
                {details.map(entry => (
                  <SelectItem key={entry.run.id} value={entry.run.id}>
                    {entry.run.name || entry.run.reference || entry.run.id} ·{" "}
                    {formatDate(entry.run.updatedAt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedDetail && breakdown && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.82fr)]">
              <div className="space-y-3 rounded border border-border bg-secondary/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--ink)]">
                      {selectedDetail.run.name ||
                        selectedDetail.run.reference ||
                        t("cargo.cargoLoadFileWord")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {selectedDetail.run.incoterm ||
                        t("cargo.noSupplyCondition")}{" "}
                      ·{" "}
                      {selectedDetail.run.transportMode ||
                        t("cargo.noTransportType")}{" "}
                      ·{" "}
                      {selectedDetail.run.clearanceOffice ||
                        t("cargo.unspecifiedOffice")}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {labels.statusLabel[selectedDetail.run.status]}
                  </Badge>
                </div>
                {breakdown.stages.map(stage => (
                  <div key={stage.key}>
                    <div className="mb-1 flex justify-between gap-3 text-xs">
                      <span>{labels.stageMeta[stage.key].label}</span>
                      <span className="ledger-figure" dir="ltr">
                        {formatMoney(
                          stage.amount,
                          selectedDetail.run.currency
                        )}{" "}
                        · {formatNumber(stage.share * 100)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-[width] duration-200"
                        style={{
                          width: `${Math.min(100, Math.max(0, stage.share * 100))}%`,
                          backgroundColor: labels.stageMeta[stage.key].color,
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="font-semibold">
                    {t("cargo.totalCost")}
                  </span>
                  <span
                    className="ledger-figure text-lg font-bold text-[var(--ink)]"
                    dir="ltr"
                  >
                    {formatMoney(breakdown.totalCost, selectedDetail.run.currency)}
                  </span>
                </div>
              </div>
              <div className="rounded border border-border bg-card p-3">
                <p className="mb-2 text-sm font-semibold text-[var(--ink)]">
                  {t("cargo.decisionIndicators")}
                </p>
                <div className="space-y-2 text-xs">
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t("cargo.invoiceValue")}
                    </span>
                    <strong className="ledger-figure" dir="ltr">
                      {formatMoney(
                        breakdown.calculation.invoiceValue,
                        selectedDetail.run.currency
                      )}
                    </strong>
                  </p>
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t("cargo.customsBase")}
                    </span>
                    <strong className="ledger-figure" dir="ltr">
                      {formatMoney(
                        breakdown.calculation.customsBase,
                        selectedDetail.run.currency
                      )}
                    </strong>
                  </p>
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t("common.suggestedsellingprice")}
                    </span>
                    <strong className="ledger-figure" dir="ltr">
                      {formatMoney(
                        breakdown.calculation.totalSuggestedRevenue,
                        selectedDetail.run.currency
                      )}
                    </strong>
                  </p>
                  <p className="border-t border-border pt-2 text-[10px] text-muted-foreground">
                    {t("cargo.sourcesApplyToSnapshot")}.
                  </p>
                </div>
              </div>
            </div>
          )}
          {selectedDetail && breakdown && (
            <div className="mt-4 overflow-x-auto touch-pan-x scrollbar-ledger">
              <table className="w-full min-w-[780px] text-right text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    {[
                      t("cargo.expenseLineWord"),
                      t("cargo.stageWord"),
                      t("common.status"),
                      t("common.source"),
                      t("cargo.localAmountWord"),
                    ].map(heading => (
                      <th key={heading} className="px-2 py-2 font-semibold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {breakdown.lines.map(({ line, localAmount }) => (
                    <tr key={line.id} className="border-b border-border/60">
                      <td className="px-2 py-2 font-medium">{costLineLabel(line.name, t)}</td>
                      <td className="px-2 py-2">
                        {labels.stageMeta[line.stage].label}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className="text-[9px]">
                          {labels.costStatusLabel[line.status]}
                        </Badge>
                      </td>
                      <td className="max-w-[220px] truncate px-2 py-2 text-muted-foreground">
                        {line.sourceLabel ||
                          line.reason ||
                          t("cargo.manualEditEntryFull")}
                      </td>
                      <td className="ledger-figure px-2 py-2" dir="ltr">
                        {line.status === "missing"
                          ? t("cargo.needsPricing")
                          : formatMoney(
                              localAmount,
                              selectedDetail.run.currency
                            )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </SectionCard>
  );
}
