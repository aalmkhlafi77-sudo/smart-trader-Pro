import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { exportExcel, exportPdf } from "@/lib/exporters";
import { formatDate, formatMoney, formatNumber } from "@/lib/pricing";
import { shareReport } from "@/lib/shareReport";
import { summarizeReportRows, type ReportRow } from "./reportModel";
import {
  DEFAULT_REPORT_COLUMN_VISIBILITY,
  type ReportColumnKey,
  type ReportColumnVisibility,
} from "./reportColumns";

export function useReportExport(
  filtered: ReportRow[],
  visibility: ReportColumnVisibility = DEFAULT_REPORT_COLUMN_VISIBILITY
) {
  const { t } = useLanguage();

  const summary = useMemo(() => summarizeReportRows(filtered), [filtered]);

  const reportTable = useMemo(() => {
    const columns: Array<{
      key: ReportColumnKey;
      headers: string[];
      cells: (row: ReportRow) => string[];
    }> = [
      {
        key: "item",
        headers: [t("common.item")],
        cells: row => [row.item.name],
      },
      {
        key: "entity",
        headers: [t("common.entity")],
        cells: row => [row.entity?.name ?? "—"],
      },
      {
        key: "category",
        headers: [t("common.category")],
        cells: row => [row.item.category || "—"],
      },
      {
        key: "weight",
        headers: [t("common.weight")],
        cells: row => [row.weight],
      },
      {
        key: "material",
        headers: [t("common.material")],
        cells: row => [row.material],
      },
      {
        key: "type",
        headers: [t("entities.type")],
        cells: row => [row.type],
      },
      {
        key: "supplierPrice",
        headers: [
          t("reports.supplierOriginal"),
          t("reports.supplierCurrencyWord"),
        ],
        cells: row => [
          row.supplierPrice == null ? "—" : formatNumber(row.supplierPrice),
          row.item.currency,
        ],
      },
      {
        key: "unitCost",
        headers: [t("home.unitCost")],
        cells: row => [
          row.unitCost == null
            ? "—"
            : `${formatNumber(row.unitCost)} ${row.costCurrency}`,
        ],
      },
      {
        key: "suggestedPrice",
        headers: [t("common.sellingprice")],
        cells: row => [
          row.suggestedPrice == null
            ? "—"
            : `${formatNumber(row.suggestedPrice)} ${row.costCurrency}`,
        ],
      },
      {
        key: "margin",
        headers: [t("settings.profitMargin")],
        cells: row => [
          row.margin == null ? "—" : `${formatNumber(row.margin)}%`,
        ],
      },
      {
        key: "createdAt",
        headers: [t("common.dateadded")],
        cells: row => [formatDate(row.item.createdAt)],
      },
    ];
    const visible = columns.filter(column => visibility[column.key]);
    return {
      header: visible.flatMap(column => column.headers),
      body: filtered.map(row => visible.flatMap(column => column.cells(row))),
    };
  }, [filtered, t, visibility]);

  const exportReportExcel = () => {
    exportExcel({
      sheetName: t("common.reports"),
      header: reportTable.header,
      rows: reportTable.body,
      fileName: t("reports.fileName"),
    });
  };

  const exportReportPdf = () => {
    exportPdf({
      title: t("common.smarttraderreport"),
      subtitle: t("reports.pdfSubtitle"),
      meta: [
        `${t("common.numberofresults")}: ${filtered.length}`,
        `${t("common.reportdate")}: ${formatDate(new Date().toISOString())}`,
      ],
      header: reportTable.header,
      rows: reportTable.body,
      landscape: true,
      footerNote: visibility.supplierPrice
        ? t("reports.supplierCurrencyNote")
        : undefined,
    });
  };

  const shareSummary = () =>
    shareReport(
      t("reports.title"),
      [
        `${t("common.matchingitems")}: ${summary.count}`,
        visibility.supplierPrice
          ? `${t("common.averagesupplierprice")}: ${formatNumber(summary.avgSupplier)}`
          : null,
        visibility.unitCost
          ? `${t("common.averageunitcost")}: ${formatNumber(summary.avgCost)}`
          : null,
        visibility.margin
          ? `${t("common.averagemargin")}: ${formatNumber(summary.avgMargin)}%`
          : null,
      ]
        .filter((line): line is string => line != null)
        .join("\n"),
      t
    );

  return { summary, exportReportExcel, exportReportPdf, shareSummary };
}
