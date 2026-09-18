import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { exportExcel, exportPdf } from "@/lib/exporters";
import { formatDate, formatMoney, formatNumber } from "@/lib/pricing";
import { shareReport } from "@/lib/shareReport";
import { summarizeReportRows, type ReportRow } from "./reportModel";

export function useReportExport(filtered: ReportRow[]) {
  const { t } = useLanguage();

  const summary = useMemo(() => summarizeReportRows(filtered), [filtered]);

  const reportTable = useMemo(
    () => ({
      header: [
        t("common.item"),
        t("common.entity"),
        t("common.category"),
        t("common.weight"),
        t("common.material"),
        t("entities.type"),
        t("reports.supplierOriginal"),
        t("reports.supplierCurrencyWord"),
        t("home.unitCost"),
        t("common.sellingprice"),
        t("settings.profitMargin"),
        t("common.dateadded"),
      ],
      body: filtered.map(row => [
        row.item.name,
        row.entity?.name ?? "—",
        row.item.category || "—",
        row.weight,
        row.material,
        row.type,
        row.supplierPrice == null ? "—" : formatNumber(row.supplierPrice),
        row.item.currency,
        row.unitCost == null
          ? "—"
          : `${formatNumber(row.unitCost)} ${row.costCurrency}`,
        row.suggestedPrice == null
          ? "—"
          : `${formatNumber(row.suggestedPrice)} ${row.costCurrency}`,
        row.margin == null ? "—" : `${formatNumber(row.margin)}%`,
        formatDate(row.item.createdAt),
      ]),
    }),
    [filtered, t]
  );

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
      footerNote: t("reports.supplierCurrencyNote"),
    });
  };

  const shareSummary = () =>
    shareReport(
      t("reports.title"),
      [
        `${t("common.matchingitems")}: ${summary.count}`,
        `${t("common.averagesupplierprice")}: ${formatNumber(summary.avgSupplier)}`,
        `${t("common.averageunitcost")}: ${formatNumber(summary.avgCost)}`,
        `${t("common.averagemargin")}: ${formatNumber(summary.avgMargin)}%`,
      ].join("\n"),
      t
    );

  return { summary, exportReportExcel, exportReportPdf, shareSummary };
}
