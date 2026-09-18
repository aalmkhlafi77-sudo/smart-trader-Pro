import { exportExcel, exportPdf } from "@/lib/exporters";
import { formatDate, formatNumber } from "@/lib/pricing";
import type { ItemPriceRow, ItemRow, ItemSpecRow } from "@/lib/db";

export function handleExportExcelAction(
  items: ItemRow[],
  prices: ItemPriceRow[],
  allSpecsByItem: Record<string, ItemSpecRow[]>,
  t: (key: string) => string
) {
  const priceMap: Record<string, ItemPriceRow> = {};
  for (const p of prices) priceMap[p.itemId] = p;

  const specColumns = Array.from(
    new Set(
      Object.values(allSpecsByItem).flatMap(specs =>
        specs.map(spec => spec.label.trim()).filter(Boolean)
      )
    )
  ).sort((a, b) => a.localeCompare(b, "ar"));

  const header = [
    t("common.item"),
    t("common.category"),
    t("common.currency"),
    ...specColumns,
    `${t("prices.price")} 1`,
    `${t("prices.date")} 1`,
    `${t("prices.price")} 2`,
    `${t("prices.date")} 2`,
    `${t("prices.price")} 3`,
    `${t("prices.date")} 3`,
    `${t("prices.price")} 4`,
    `${t("prices.date")} 4`,
  ];

  const body = items.map(it => {
    const p = priceMap[it.id];
    const values = (allSpecsByItem[it.id] ?? []).reduce<Record<string, string>>(
      (acc, spec) => {
        const value = `${spec.value} ${spec.unit}`.trim();
        acc[spec.label] = acc[spec.label] ? `${acc[spec.label]} | ${value}` : value;
        return acc;
      },
      {}
    );

    return [
      it.name,
      it.category || "—",
      it.currency,
      ...specColumns.map(col => values[col] || "—"),
      p?.price1 == null ? "—" : formatNumber(p.price1),
      p?.price1Date ? formatDate(p.price1Date) : "—",
      p?.price2 == null ? "—" : formatNumber(p.price2),
      p?.price2Date ? formatDate(p.price2Date) : "—",
      p?.price3 == null ? "—" : formatNumber(p.price3),
      p?.price3Date ? formatDate(p.price3Date) : "—",
      p?.price4 == null ? "—" : formatNumber(p.price4),
      p?.price4Date ? formatDate(p.price4Date) : "—",
    ];
  });

  exportExcel({
    sheetName: t("prices.sheetName"),
    header,
    rows: body,
    fileName: `${t("prices.fileName")}-${formatDate(new Date())}`,
  });
}

export function handleExportPdfAction(
  items: ItemRow[],
  prices: ItemPriceRow[],
  allSpecsByItem: Record<string, ItemSpecRow[]>,
  t: (key: string) => string
): boolean {
  const priceMap: Record<string, ItemPriceRow> = {};
  for (const p of prices) priceMap[p.itemId] = p;

  const header = [
    t("common.item"),
    t("prices.specifications"),
    t("common.currency"),
    `${t("prices.price")} 1`,
    `${t("prices.date")} 1`,
    `${t("prices.price")} 2`,
    `${t("prices.date")} 2`,
    `${t("prices.price")} 3`,
    `${t("prices.date")} 3`,
    `${t("prices.price")} 4`,
    `${t("prices.date")} 4`,
  ];

  const body = items.map(it => {
    const p = priceMap[it.id];
    const specList = allSpecsByItem[it.id] ?? [];
    const specSummaryText = specList
      .slice(0, 3)
      .map(s => `${s.label}: ${s.value} ${s.unit}`)
      .join(" | ");

    return [
      it.name,
      specSummaryText || "—",
      it.currency,
      p?.price1 == null ? "—" : formatNumber(p.price1),
      p?.price1Date ? formatDate(p.price1Date) : "—",
      p?.price2 == null ? "—" : formatNumber(p.price2),
      p?.price2Date ? formatDate(p.price2Date) : "—",
      p?.price3 == null ? "—" : formatNumber(p.price3),
      p?.price3Date ? formatDate(p.price3Date) : "—",
      p?.price4 == null ? "—" : formatNumber(p.price4),
      p?.price4Date ? formatDate(p.price4Date) : "—",
    ];
  });

  return exportPdf({
    title: t("prices.pdfTitle"),
    subtitle: t("prices.pdfSubtitle"),
    meta: [
      `${t("prices.itemCount")}: ${items.length}`,
      `${t("prices.issueDate")}: ${formatDate(new Date())}`,
    ],
    header,
    rows: body,
    footerNote: t("prices.pdfNote"),
  });
}
