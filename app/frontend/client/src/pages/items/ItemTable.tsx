import { useState } from "react";
import { Search, Eye, Pencil, Copy, Calculator, Trash2, Paperclip } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataTable, StatusPill, type Column } from "@/components/patterns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import EmptyHint from "@/components/EmptyHint";
import type { CategoryRow, EntityRow, ItemRow, ItemSpecRow } from "@/lib/db";
import { currencyLabel } from "@/lib/currency";

/** قيمة العملة الاحتياطية للعرض (رمز ISO منذ S5). */
const FALLBACK_CURRENCY = "USD";

export function ItemTable({
  items,
  entities,
  categories,
  specsByItem,
  attachmentCounts,
  onView,
  onEdit,
  onDuplicate,
  onCalculate,
  onDelete,
  initialSearch = "",
}: {
  items: ItemRow[];
  entities: EntityRow[];
  categories: CategoryRow[];
  specsByItem: Record<string, ItemSpecRow[]>;
  attachmentCounts: Record<string, number>;
  onView: (row: ItemRow) => void;
  onEdit: (row: ItemRow) => void;
  onDuplicate: (row: ItemRow) => void;
  onCalculate: (row: ItemRow) => void;
  onDelete: (row: ItemRow) => void;
  initialSearch?: string;
}) {
  const { t } = useLanguage();
  const [search, setSearch] = useState(initialSearch);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");

  const entityName = (id: string | null) =>
    entities.find(e => e.id === id)?.name ?? t("items.noPartner");

  const filtered = items.filter(i => {
    const q = search.trim().toLowerCase();
    if (q) {
      const specText = (specsByItem[i.id] ?? [])
        .map(s => `${s.label} ${s.value} ${s.unit}`)
        .join(" ");
      const haystack = [
        i.name,
        i.code,
        i.category,
        entityName(i.entityId),
        i.notes,
        specText,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filterCategory !== "all" && i.category !== filterCategory) return false;
    if (filterEntity !== "all") {
      if (filterEntity === "none" ? i.entityId !== null : i.entityId !== filterEntity)
        return false;
    }
    return true;
  });

  const columns: Column<ItemRow>[] = [
    {
      key: "name",
      header: t("items.name"),
      cell: row => (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-[var(--ink)]">
            {row.name}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
            {row.code && <span dir="ltr">[{row.code}]</span>}
            <StatusPill tone="neutral">{row.category || t("items.generalCategory")}</StatusPill>
            {(attachmentCounts[row.id] ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--guidance)]">
                <Paperclip className="h-3 w-3" />
                {attachmentCounts[row.id]}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "entity",
      header: t("entities.title"),
      cell: row => (
        <span className="text-xs text-muted-foreground">
          {entityName(row.entityId)}
        </span>
      ),
    },
    {
      key: "specs",
      header: t("items.specs"),
      cell: row => {
        const itemSpecs = specsByItem[row.id] ?? [];
        const keySpecs = itemSpecs.filter(s => s.isKey === 1);
        const displaySpecs = keySpecs.length > 0 ? keySpecs : itemSpecs.slice(0, 2);
        if (displaySpecs.length === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {displaySpecs.map(s => (
              <span
                key={s.id}
                className="inline-flex items-center rounded bg-secondary/80 px-1.5 py-0.5 text-[10px]"
              >
                <span className="font-semibold text-[var(--ink)]">{s.label}:</span>{" "}
                <span className="ml-1 text-muted-foreground">{s.value}</span>
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "currency",
      header: t("items.priceCurrency"),
      cell: row => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-[var(--port-green)]">
            {currencyLabel(row.currency || FALLBACK_CURRENCY, t)}
          </span>
          {row.customsRate != null && (
            <span className="text-[10px] text-muted-foreground" dir="ltr">
              {t("items.customsShort")}: {(row.customsRate * 100).toFixed(0)}%
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-32 text-left",
      cell: row => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={e => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => onView(row)}
            title={t("items.viewFullCard")}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => onEdit(row)}
            title={t("items.editItem")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => onDuplicate(row)}
            title={t("items.duplicateItem")}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-[var(--port-green)]"
            onClick={() => onCalculate(row)}
            title={t("items.calculateCost")}
          >
            <Calculator className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(row)}
            title={t("items.deleteItem")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {/* شريط البحث والفلترة */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="field-input pr-8 text-xs h-9"
            placeholder={t("items.searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-9 bg-card w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.allcategories")}</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyHint text={t("common.nomatchingrecordsfound")} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          keyOf={row => row.id}
          onRowClick={onView}
        />
      )}
    </div>
  );
}
