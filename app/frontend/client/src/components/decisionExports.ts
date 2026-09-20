import type { TFunction } from "@/lib/validation/schemas";
import { exportExcel, exportPdf } from "@/lib/exporters";
import { formatDate, formatMoney, formatNumber } from "@/lib/pricing";
import { costLineLabel } from "@/pages/cargo/shared";
import type {
  CargoDecisionRun,
  CostStageKey,
  RouteComparisonRow,
} from "@/lib/cargoDecisionReports";
import type { CargoCostLineRow, CargoCostRunRow } from "@/lib/db";

export interface DecisionLabels {
  stageMeta: Record<CostStageKey, { label: string; color: string }>;
  statusLabel: Record<CargoCostRunRow["status"], string>;
  costStatusLabel: Record<CargoCostLineRow["status"], string>;
  stagePdfColors: Record<CostStageKey, string>;
}

export function exportRoutesExcel(
  t: TFunction,
  labels: DecisionLabels,
  routeRows: RouteComparisonRow[]
) {
  exportExcel({
    sheetName: t("cargo.routesComparison"),
    fileName: t("cargo.routesComparisonFileName"),
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
    ],
    rows: routeRows.map(row => [
      row.run.name || row.run.reference || row.run.id,
      row.routeLabel,
      labels.statusLabel[row.run.status],
      formatDate(row.run.updatedAt),
      formatNumber(row.invoiceValue),
      formatNumber(row.customsAmount),
      formatNumber(row.logisticsCost),
      formatNumber(row.totalCost),
      row.unitCost == null ? "—" : formatNumber(row.unitCost),
      row.missingLines
        .map(line => costLineLabel(line.name, t))
        .join(t("common.listSeparator")) || "—",
    ]),
  });
}

export function exportBreakdownPdf(
  t: TFunction,
  labels: DecisionLabels,
  detail: CargoDecisionRun,
  breakdown: { totalCost: number; lines: { line: CargoCostLineRow; localAmount: number }[] }
) {
  exportPdf({
    title: t("cargo.shipmentCostBreakdown"),
    subtitle:
      detail.run.name ||
      detail.run.reference ||
      t("cargo.cargoLoadFileWord"),
    meta: [
      `${t("common.status")}: ${labels.statusLabel[detail.run.status]}`,
      `${t("followup.savedDate")}: ${formatDate(detail.run.updatedAt)}`,
      `${t("cargo.totalWord")}: ${formatMoney(breakdown.totalCost, detail.run.currency)}`,
    ],
    header: [
      t("cargo.lineItemWord"),
      t("cargo.stageWord"),
      t("common.status"),
      t("common.source"),
      t("cargo.localAmountWord"),
    ],
    rows: breakdown.lines.map(({ line, localAmount }) => [
      costLineLabel(line.name, t),
      labels.stageMeta[line.stage].label,
      labels.costStatusLabel[line.status],
      line.sourceLabel || t("cargo.manualEditEntry"),
      formatNumber(localAmount),
    ]),
    footerNote: t("cargo.breakdownFooterNote"),
  });
}

export function exportComprehensivePdf(
  t: TFunction,
  labels: DecisionLabels,
  detail: CargoDecisionRun,
  breakdown: {
    totalCost: number;
    calculation: {
      invoiceValue: number;
      customsBase: number;
      totalCost: number;
      totalSuggestedRevenue: number;
    };
    stages: { key: CostStageKey; amount: number; share: number }[];
    lines: { line: CargoCostLineRow; localAmount: number }[];
  },
  routeRows: RouteComparisonRow[]
) {
  exportPdf({
    title: t("cargo.decisionReportTitle"),
    subtitle: t("cargo.decisionReportSubtitle"),
    meta: [
      `${t("cargo.compareRoutesCount")}: ${routeRows.length}`,
      `${t("cargo.breakdownFile")}: ${detail.run.name || detail.run.reference || detail.run.id}`,
      `${t("common.reportdate")}: ${formatDate(new Date().toISOString())}`,
    ],
    header: [],
    rows: [],
    sections: [
      {
        title: t("cargo.sectionRoutesComparison"),
        description: t("cargo.sectionRoutesNote"),
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
        ],
        rows: routeRows.map(row => [
          row.run.name || row.run.reference || row.run.id,
          row.routeLabel,
          labels.statusLabel[row.run.status],
          formatMoney(row.invoiceValue, row.run.currency),
          formatMoney(row.customsAmount, row.run.currency),
          formatMoney(row.logisticsCost, row.run.currency),
          formatMoney(row.totalCost, row.run.currency),
          row.unitCost == null
            ? "—"
            : formatMoney(row.unitCost, row.run.currency),
          row.missingLines
            .map(line => costLineLabel(line.name, t))
            .join(t("common.listSeparator")) || "—",
        ]),
      },
      {
        title: t("cargo.sectionStageDistribution"),
        description: t("cargo.sectionDonutNote"),
        donutChart: {
          title: t("cargo.donutTitle"),
          entries: breakdown.stages.map(stage => ({
            label: labels.stageMeta[stage.key].label,
            value: stage.amount,
            color: labels.stagePdfColors[stage.key],
          })),
        },
        header: [
          t("cargo.stageWord"),
          t("cargo.amount"),
          t("cargo.shareWord"),
        ],
        rows: breakdown.stages.map(stage => [
          labels.stageMeta[stage.key].label,
          formatMoney(stage.amount, detail.run.currency),
          `${formatNumber(stage.share * 100)}%`,
        ]),
      },
      {
        title: t("cargo.sectionSelectedIndicators"),
        description: `${detail.run.incoterm || t("cargo.noSupplyCondition")} · ${detail.run.transportMode || t("cargo.noTransportType")} · ${detail.run.clearanceOffice || t("cargo.unspecifiedOffice")}`,
        header: [t("cargo.indicatorWord"), t("common.value")],
        rows: [
          [
            t("cargo.invoiceValue"),
            formatMoney(
              breakdown.calculation.invoiceValue,
              detail.run.currency
            ),
          ],
          [
            t("cargo.customsBase"),
            formatMoney(
              breakdown.calculation.customsBase,
              detail.run.currency
            ),
          ],
          [
            t("cargo.totalCost"),
            formatMoney(breakdown.totalCost, detail.run.currency),
          ],
          [
            t("common.suggestedsellingprice"),
            formatMoney(
              breakdown.calculation.totalSuggestedRevenue,
              detail.run.currency
            ),
          ],
        ],
      },
      {
        title: t("cargo.sectionBreakdownLines"),
        description: t("cargo.breakdownLinesNote"),
        header: [
          t("cargo.lineItemWord"),
          t("cargo.stageWord"),
          t("common.status"),
          t("common.source"),
          t("cargo.localAmountWord"),
        ],
        rows: breakdown.lines.map(({ line, localAmount }) => [
          costLineLabel(line.name, t),
          labels.stageMeta[line.stage].label,
          labels.costStatusLabel[line.status],
          line.sourceLabel || line.reason || t("cargo.manualEditEntryFull"),
          line.status === "missing"
            ? t("cargo.needsPricing")
            : formatMoney(localAmount, detail.run.currency),
        ]),
      },
    ],
    footerNote: t("cargo.comprehensiveFooterNote"),
    landscape: true,
  });
}
