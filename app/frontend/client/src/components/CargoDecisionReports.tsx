/**
 * تقارير قرار الحمولة — أسلوب: دفتر الميناء التحليلي.
 * اللوحة تضع القرار قبل الجداول: المسار الأرخص، أسباب التكلفة، ثم مصدر كل مبلغ.
 */
import EmptyHint from "@/components/EmptyHint";
import SectionCard from "@/components/SectionCard";
import { useLanguage } from "@/contexts/LanguageContext";
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
  buildRouteComparisonRows,
  type CargoDecisionRun,
  type CostStageKey,
} from "@/lib/cargoDecisionReports";
import {
  db,
  type CargoCostItemRow,
  type CargoCostLineRow,
  type CargoCostRunRow,
  type LogisticsLocationRow,
} from "@/lib/db";
import { exportExcel, exportPdf } from "@/lib/exporters";
import { formatDate, formatMoney, formatNumber } from "@/lib/pricing";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  MapPinned,
  Printer,
  ReceiptText,
  Route,
  Share2,
  ShipWheel,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { shareReport } from "@/lib/shareReport";

const stagePdfColors: Record<CostStageKey, string> = {
  factory: "#145B8C",
  port: "#2E74B5",
  customs: "#C98517",
  warehouse: "#1F6F54",
  other: "#7655A5",
};

export default function CargoDecisionReports() {
  const { t } = useLanguage();
  const stageMeta: Record<CostStageKey, { label: string; color: string }> = {
    factory: { label: t("common.goodsvalue"), color: "var(--calc-cyan)" }, // i18n-deep
    port: { label: t("cargo.metaPortShipping"), color: "var(--calc-blue)" }, // i18n-deep
    customs: { label: t("common.customs"), color: "var(--calc-amber)" }, // i18n-deep
    warehouse: {
      label: t("cargo.metaDeliveryTransport"),
      color: "var(--calc-green)",
    }, // i18n-deep
    other: { label: t("common.otherexpenses"), color: "var(--calc-purple)" }, // i18n-deep
  };
  const statusLabel: Record<CargoCostRunRow["status"], string> = {
    draft: t("cargo.statusDraft"), // i18n-deep
    review: t("cargo.statusReview"), // i18n-deep
    approved: t("cargo.statusApproved"), // i18n-deep
    archived: t("cargo.statusArchived"), // i18n-deep
  };
  const costStatusLabel: Record<CargoCostLineRow["status"], string> = {
    entered: t("cargo.costStatusEntered"), // i18n-deep
    included: t("cargo.included"), // i18n-deep
    "third-party": t("cargo.costStatusThirdParty"), // i18n-deep
    missing: t("cargo.needsPricing"), // i18n-deep
    disabled: t("cargo.costStatusDisabled"), // i18n-deep
  };
  const [details, setDetails] = useState<CargoDecisionRun[]>([]);
  const [locations, setLocations] = useState<LogisticsLocationRow[]>([]);
  const [operation, setOperation] = useState<
    "all" | CargoCostRunRow["operationType"]
  >("all");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [loading, setLoading] = useState(true);
  const [openCompare, setOpenCompare] = useState(true);
  const [openBreakdown, setOpenBreakdown] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const [runs, locationRows] = await Promise.all([
        db.listCargoCostRuns(),
        db.listLogisticsLocations(),
      ]);
      const loaded = await Promise.all(
        runs.map(async run => ({
          run,
          items: await db.listCargoCostItems(run.id),
          lines: await db.listCargoCostLines(run.id),
        }))
      );
      if (cancelled) return;
      setDetails(loaded);
      setLocations(locationRows);
      setSelectedRunId(
        loaded.find(entry => entry.run.status !== "archived")?.run.id ?? ""
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredDetails = useMemo(
    () =>
      details.filter(
        entry =>
          entry.run.status !== "archived" &&
          (operation === "all" || entry.run.operationType === operation)
      ),
    [details, operation]
  );
  const routeRows = useMemo(
    () => buildRouteComparisonRows(filteredDetails, locations),
    [filteredDetails, locations]
  );
  const selectedDetail = useMemo(
    () =>
      filteredDetails.find(entry => entry.run.id === selectedRunId) ??
      filteredDetails[0] ??
      null,
    [filteredDetails, selectedRunId]
  );
  const breakdown = useMemo(
    () => (selectedDetail ? buildCostBreakdown(selectedDetail) : null),
    [selectedDetail]
  );
  const bestTotal = routeRows[0] ?? null;
  const bestUnit = useMemo(
    () =>
      routeRows
        .filter(row => row.unitCost != null)
        .sort(
          (a, b) => (a.unitCost ?? Infinity) - (b.unitCost ?? Infinity)
        )[0] ?? null,
    [routeRows]
  );
  const missingCount = routeRows.reduce(
    (sum, row) => sum + row.missingLines.length,
    0
  );

  const shareComparison = () =>
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

  const shareBreakdown = () => {
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

  const exportRoutes = () => {
    exportExcel({
      sheetName: t("cargo.routesComparison"), // i18n-deep
      fileName: t("cargo.routesComparisonFileName"), // i18n-deep
      header: [
        t("cargo.cargoLoadFileWord"),
        t("cargo.routeWord"),
        t("common.status"),
        t("followup.savedDate"),
        t("cargo.invoiceValue"),
        t("common.customs"),
        t("cargo.logisticsWord"),
        t("cargo.totalWord"),
        t("home.unitCost"),
        t("cargo.pricingGap"),
      ], // i18n-deep
      rows: routeRows.map(row => [
        row.run.name || row.run.reference || row.run.id,
        row.routeLabel,
        statusLabel[row.run.status],
        formatDate(row.run.updatedAt),
        formatNumber(row.invoiceValue),
        formatNumber(row.customsAmount),
        formatNumber(row.logisticsCost),
        formatNumber(row.totalCost),
        row.unitCost == null ? "—" : formatNumber(row.unitCost),
        row.missingLines
          .map(line => line.name)
          .join(t("common.listSeparator")) || "—",
      ]),
    });
  };

  const exportBreakdown = () => {
    if (!selectedDetail || !breakdown) return;
    exportPdf({
      title: t("cargo.shipmentCostBreakdown"), // i18n-deep
      subtitle:
        selectedDetail.run.name ||
        selectedDetail.run.reference ||
        t("cargo.cargoLoadFileWord"),
      meta: [
        `${t("common.status")}: ${statusLabel[selectedDetail.run.status]}`,
        `${t("followup.savedDate")}: ${formatDate(selectedDetail.run.updatedAt)}`,
        `${t("cargo.totalWord")}: ${formatMoney(breakdown.totalCost, selectedDetail.run.currency)}`,
      ],
      header: [
        t("cargo.lineItemWord"),
        t("cargo.stageWord"),
        t("common.status"),
        t("common.source"),
        t("cargo.localAmountWord"),
      ], // i18n-deep
      rows: breakdown.lines.map(({ line, localAmount }) => [
        line.name,
        stageMeta[line.stage].label,
        costStatusLabel[line.status],
        line.sourceLabel || t("cargo.manualEditEntry"),
        formatNumber(localAmount),
      ]),
      footerNote: t("cargo.breakdownFooterNote"), // i18n-deep
    });
  };

  const exportComprehensivePdf = () => {
    if (!selectedDetail || !breakdown || routeRows.length === 0) return;
    exportPdf({
      title: t("cargo.decisionReportTitle"), // i18n-deep
      subtitle: t("cargo.decisionReportSubtitle"), // i18n-deep
      meta: [
        `${t("cargo.compareRoutesCount")}: ${routeRows.length}`,
        `${t("cargo.breakdownFile")}: ${selectedDetail.run.name || selectedDetail.run.reference || selectedDetail.run.id}`,
        `${t("common.reportdate")}: ${formatDate(new Date().toISOString())}`,
      ],
      header: [],
      rows: [],
      sections: [
        {
          title: t("cargo.sectionRoutesComparison"), // i18n-deep
          description: t("cargo.sectionRoutesNote"), // i18n-deep
          header: [
            t("cargo.cargoLoadFileWord"),
            t("cargo.routeWord"),
            t("common.status"),
            t("cargo.invoiceShort"),
            t("common.customs"),
            t("cargo.logisticsWord"),
            t("cargo.totalWord"),
            t("home.unitCost"),
            t("cargo.pricingGap"),
          ], // i18n-deep
          rows: routeRows.map(row => [
            row.run.name || row.run.reference || row.run.id,
            row.routeLabel,
            statusLabel[row.run.status],
            formatMoney(row.invoiceValue, row.run.currency),
            formatMoney(row.customsAmount, row.run.currency),
            formatMoney(row.logisticsCost, row.run.currency),
            formatMoney(row.totalCost, row.run.currency),
            row.unitCost == null
              ? "—"
              : formatMoney(row.unitCost, row.run.currency),
            row.missingLines
              .map(line => line.name)
              .join(t("common.listSeparator")) || "—",
          ]),
        },
        {
          title: t("cargo.sectionStageDistribution"), // i18n-deep
          description: t("cargo.sectionDonutNote"), // i18n-deep
          donutChart: {
            title: t("cargo.donutTitle"), // i18n-deep
            entries: breakdown.stages.map(stage => ({
              label: stageMeta[stage.key].label,
              value: stage.amount,
              color: stagePdfColors[stage.key],
            })),
          },
          header: [
            t("cargo.stageWord"),
            t("cargo.amount"),
            t("cargo.shareWord"),
          ], // i18n-deep
          rows: breakdown.stages.map(stage => [
            stageMeta[stage.key].label,
            formatMoney(stage.amount, selectedDetail.run.currency),
            `${formatNumber(stage.share * 100)}%`,
          ]),
        },
        {
          title: t("cargo.sectionSelectedIndicators"), // i18n-deep
          description: `${selectedDetail.run.incoterm || t("cargo.noSupplyCondition")} · ${selectedDetail.run.transportMode || t("cargo.noTransportType")} · ${selectedDetail.run.clearanceOffice || t("cargo.unspecifiedOffice")}`,
          header: [t("cargo.indicatorWord"), t("common.value")], // i18n-deep
          rows: [
            [
              t("cargo.invoiceValue"),
              formatMoney(
                breakdown.calculation.invoiceValue,
                selectedDetail.run.currency
              ),
            ], // i18n-deep
            [
              t("cargo.customsBase"),
              formatMoney(
                breakdown.calculation.customsBase,
                selectedDetail.run.currency
              ),
            ], // i18n-deep
            [
              t("cargo.totalCost"),
              formatMoney(breakdown.totalCost, selectedDetail.run.currency),
            ], // i18n-deep
            [
              t("common.suggestedsellingprice"),
              formatMoney(
                breakdown.calculation.totalSuggestedRevenue,
                selectedDetail.run.currency
              ),
            ], // i18n-deep
          ],
        },
        {
          title: t("cargo.sectionBreakdownLines"), // i18n-deep
          description: t("cargo.breakdownLinesNote"), // i18n-deep
          header: [
            t("cargo.lineItemWord"),
            t("cargo.stageWord"),
            t("common.status"),
            t("common.source"),
            t("cargo.localAmountWord"),
          ], // i18n-deep
          rows: breakdown.lines.map(({ line, localAmount }) => [
            line.name,
            stageMeta[line.stage].label,
            costStatusLabel[line.status],
            line.sourceLabel || line.reason || t("cargo.manualEditEntryFull"),
            line.status === "missing"
              ? t("cargo.needsPricing")
              : formatMoney(localAmount, selectedDetail.run.currency),
          ]),
        },
      ],
      footerNote: t("cargo.comprehensiveFooterNote"), // i18n-deep
      landscape: true,
    });
  };

  return (
    <section className="space-y-5" aria-label={t("cargo.decisionReportsTitle")}>
      <SectionCard
        title={t("cargo.decisionReportsTitle")}
        hint={t("cargo.decisionCompareHint")}
        stamp={t("cargo.phase1Decision")}
        action={
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={exportRoutes}
              disabled={!routeRows.length}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportBreakdown}
              disabled={!breakdown}
            >
              <Printer className="h-3.5 w-3.5" /> {t("cargo.breakdownWord")} PDF
            </Button>
            <Button
              size="sm"
              onClick={exportComprehensivePdf}
              disabled={!breakdown || !routeRows.length}
            >
              <Printer className="h-3.5 w-3.5" /> PDF {t("cargo.allInclusive")}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>{t("cargo.compareOperationType")}</Label>
            <Select
              value={operation}
              onValueChange={value => setOperation(value as typeof operation)}
            >
              <SelectTrigger className="field-input w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("cargo.allOperations")}</SelectItem>
                <SelectItem value="import">{t("cargo.importWord")}</SelectItem>
                <SelectItem value="local">
                  {t("cargo.localTransport")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="rounded border border-[var(--port-green)]/25 bg-[var(--port-green-soft)] px-3 py-2 text-xs text-[var(--ink)]">
            <ShipWheel className="ml-1 inline h-3.5 w-3.5" />{" "}
            {t("cargo.compareUsesSnapshots")}.
          </p>
        </div>
      </SectionCard>

      {loading ? (
        <div className="ledger-card p-5 text-sm text-muted-foreground">
          {t("cargo.loadingLocalCostFiles")}…
        </div>
      ) : routeRows.length === 0 ? (
        <EmptyHint text={t("cargo.noCostFilesYet")} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: t("cargo.kpiLowestShipment"),
                value: bestTotal
                  ? formatMoney(bestTotal.totalCost, bestTotal.run.currency)
                  : "—",
                detail: bestTotal?.routeLabel ?? "",
                icon: WalletCards,
                accent: "var(--port-green)",
              }, // i18n-deep
              {
                label: t("cargo.kpiLowestUnit"),
                value:
                  bestUnit?.unitCost == null
                    ? "—"
                    : formatMoney(bestUnit.unitCost, bestUnit.run.currency),
                detail: bestUnit?.routeLabel ?? "",
                icon: Boxes,
                accent: "var(--calc-cyan)",
              }, // i18n-deep
              {
                label: t("cargo.kpiComparableFiles"),
                value: formatNumber(routeRows.length),
                detail: t("cargo.kpiNotArchived"),
                icon: Route,
                accent: "var(--calc-blue)",
              }, // i18n-deep
              {
                label: t("cargo.kpiNeedsPricing"),
                value: formatNumber(missingCount),
                detail: missingCount
                  ? t("cargo.notTreatedAsZero")
                  : t("cargo.coverageComplete"),
                icon: AlertTriangle,
                accent: missingCount
                  ? "var(--calc-amber)"
                  : "var(--port-green)",
              }, // i18n-deep
            ].map(card => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="ledger-card border-r-[3px] p-4"
                  style={{ borderRightColor: card.accent }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      {card.label}
                    </p>
                    <Icon className="h-4 w-4" style={{ color: card.accent }} />
                  </div>
                  <p
                    className="ledger-figure mt-1 truncate text-lg text-[var(--ink)]"
                    dir="ltr"
                  >
                    {card.value}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                    {card.detail}
                  </p>
                </div>
              );
            })}
          </div>

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
                  onClick={() => void shareComparison()}
                  disabled={routeRows.length === 0}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {t("reports.share")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => setOpenCompare(v => !v)}
                  aria-label={openCompare ? t("reports.collapseAll") : t("reports.expandAll")}
                >
                  {openCompare ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            }
          >
            {openCompare ? (
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
                      {statusLabel[row.run.status]}
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
                        .map(line => line.name)
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
                      /* i18n-deep */ t("cargo.cargoLoadFileWord"),
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
                          {statusLabel[row.run.status]}
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
                          .map(line => line.name)
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
                  onClick={() => void shareBreakdown()}
                  disabled={!selectedDetail || !breakdown}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {t("reports.share")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => setOpenBreakdown(v => !v)}
                  aria-label={openBreakdown ? t("reports.collapseAll") : t("reports.expandAll")}
                >
                  {openBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            }
          >
            {openBreakdown ? (
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
                  {filteredDetails.map(entry => (
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
                      {statusLabel[selectedDetail.run.status]}
                    </Badge>
                  </div>
                  {breakdown.stages.map(stage => (
                    <div key={stage.key}>
                      <div className="mb-1 flex justify-between gap-3 text-xs">
                        <span>{stageMeta[stage.key].label}</span>
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
                            backgroundColor: stageMeta[stage.key].color,
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
                      {formatMoney(
                        breakdown.totalCost,
                        selectedDetail.run.currency
                      )}
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
                        /* i18n-deep */ t("cargo.expenseLineWord"),
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
                        <td className="px-2 py-2 font-medium">{line.name}</td>
                        <td className="px-2 py-2">
                          {stageMeta[line.stage].label}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className="text-[9px]">
                            {costStatusLabel[line.status]}
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

          <div className="flex items-start gap-2 rounded border border-border bg-secondary/40 px-3 py-2.5 text-[11px] text-muted-foreground">
            <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink)]/70" />
            <p>{t("cargo.reportsSnapshotNote")}.</p>
          </div>
        </>
      )}
    </section>
  );
}
