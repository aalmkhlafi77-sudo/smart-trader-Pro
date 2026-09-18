import { useState } from "react";
import { Search, FileDown, Printer, Pencil } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataTable, StatusPill, type Column } from "@/components/patterns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/pricing";
import { latestDatedItemPrice } from "@/lib/latestItemPrice";
import type { ItemPriceRow, ItemRow } from "@/lib/db";

export function PriceTable({
  items,
  prices,
  onSelect,
  onExportExcel,
  onExportPdf,
}: {
  items: ItemRow[];
  prices: ItemPriceRow[];
  onSelect: (item: ItemRow) => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
}) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");

  const priceMap: Record<string, ItemPriceRow> = {};
  for (const p of prices) priceMap[p.itemId] = p;

  const filtered = items.filter(item =>
    [item.name, item.code, item.category]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const columns: Column<ItemRow>[] = [
    {
      key: "name",
      header: t("items.name"),
      cell: row => (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-[var(--ink)]">{row.name}</span>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {row.code && <span dir="ltr">[{row.code}]</span>}
            <span>{row.category || "عام"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "currency",
      header: t("items.priceCurrency"),
      cell: row => (
        <span className="text-xs font-semibold text-[var(--port-green)]">
          {row.currency || "دولار"}
        </span>
      ),
    },
    {
      key: "latestPrice",
      header: "آخر سعر مؤرخ",
      cell: row => {
        const p = priceMap[row.id];
        const latest = latestDatedItemPrice(p ?? null);
        if (!latest) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col text-xs">
            <span className="font-extrabold text-[var(--ink)]" dir="ltr">
              {formatMoney(latest.price, row.currency)}
            </span>
            <span className="text-[9px] text-muted-foreground" dir="ltr">
              {latest.effectiveDate} (سعر {latest.level})
            </span>
          </div>
        );
      },
    },
    {
      key: "levels",
      header: "المستويات 1 - 4",
      cell: row => {
        const p = priceMap[row.id];
        if (!p) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-1.5 text-[11px]" dir="ltr">
            {[p.price1, p.price2, p.price3, p.price4].map((val, idx) => (
              <span
                key={idx}
                className={`px-1 py-0.5 rounded text-[10px] ${
                  val != null ? "bg-secondary font-medium" : "text-muted-foreground"
                }`}
              >
                {val != null ? val : "—"}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-16 text-left",
      cell: row => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => onSelect(row)}
            title={t("prices.editPrices")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {/* شريط البحث والتصدير */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="field-input pr-8 text-xs h-9"
            placeholder={t("items.searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="bg-card text-xs h-9 px-2.5"
            onClick={onExportExcel}
            title={t("prices.excelExported")}
          >
            <FileDown className="h-3.5 w-3.5 mr-1" />
            Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-card text-xs h-9 px-2.5"
            onClick={onExportPdf}
            title={t("prices.pdfTitle")}
          >
            <Printer className="h-3.5 w-3.5 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        keyOf={row => row.id}
        onRowClick={onSelect}
      />
    </div>
  );
}
