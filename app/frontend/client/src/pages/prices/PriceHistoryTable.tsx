import { useLanguage } from "@/contexts/LanguageContext";
import { DataTable, StatusPill, type Column } from "@/components/patterns";
import { formatMoney } from "@/lib/pricing";
import type { PriceHistoryRow } from "@/lib/db";

export function PriceHistoryTable({
  history,
  currency,
}: {
  history: PriceHistoryRow[];
  currency: string;
}) {
  const { t } = useLanguage();

  if (history.length === 0) {
    return (
      <div className="py-2 text-center text-xs text-muted-foreground border border-dashed rounded-md">
        {t("common.nohistoryentries")}
      </div>
    );
  }

  const columns: Column<PriceHistoryRow>[] = [
    {
      key: "level",
      header: "المستوى",
      cell: row => (
        <StatusPill tone="neutral">سعر {row.priceLevel}</StatusPill>
      ),
    },
    {
      key: "price",
      header: t("prices.price"),
      cell: row => (
        <span className="font-bold text-xs" dir="ltr">
          {row.price != null ? formatMoney(row.price, currency) : "—"}
        </span>
      ),
    },
    {
      key: "date",
      header: t("prices.date"),
      cell: row => (
        <span className="text-xs text-muted-foreground" dir="ltr">
          {row.effectiveDate || "—"}
        </span>
      ),
    },
    {
      key: "notes",
      header: t("common.notes"),
      cell: row => (
        <span className="text-xs text-muted-foreground truncate max-w-[150px] inline-block">
          {row.notes || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="mt-3">
      <h4 className="text-xs font-bold text-[var(--ink)] mb-2">
        {t("common.pricehistorylog")} ({history.length})
      </h4>
      <DataTable
        columns={columns}
        rows={history.slice(0, 10)}
        keyOf={row => row.id}
        dense
      />
    </div>
  );
}
