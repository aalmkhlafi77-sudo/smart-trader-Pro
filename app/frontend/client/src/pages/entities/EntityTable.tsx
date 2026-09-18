import { useState } from "react";
import { Search, Eye, Pencil, Trash2, Paperclip } from "lucide-react";
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
import type { EntityKind, EntityRow } from "@/lib/db";
import { currencyLabel } from "@/lib/currency";

const KINDS: { value: EntityKind; labelKey: string }[] = [
  { value: "supplier", labelKey: "entities.kind.supplier" },
  { value: "customer", labelKey: "entities.kind.customer" },
  { value: "factory", labelKey: "entities.kind.factory" },
  { value: "other", labelKey: "entities.kind.other" },
];

/** قيمة العملة الاحتياطية للعرض (رمز ISO منذ S5). */
const FALLBACK_CURRENCY = "USD";

export function EntityTable({
  rows,
  attachmentCounts,
  onView,
  onEdit,
  onDelete,
}: {
  rows: EntityRow[];
  attachmentCounts: Record<string, number>;
  onView: (row: EntityRow) => void;
  onEdit: (row: EntityRow) => void;
  onDelete: (row: EntityRow) => void;
}) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<string>("all");

  const kindLabel = (kind: EntityKind) =>
    t(
      KINDS.find(entry => entry.value === kind)?.labelKey ??
        "entities.kind.other"
    );

  const currencyName = (currency: string) =>
    currencyLabel(currency, t);

  const filtered = rows.filter(r => {
    const q = search.trim().toLowerCase();
    if (q) {
      const haystack = [
        r.name,
        r.country,
        r.city,
        r.contactPerson,
        r.phone,
        r.email,
        r.notes,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filterKind !== "all" && r.kind !== filterKind) return false;
    return true;
  });

  const columns: Column<EntityRow>[] = [
    {
      key: "name",
      header: t("entities.name"),
      cell: row => (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-[var(--ink)]">{row.name}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusPill tone="info">{kindLabel(row.kind)}</StatusPill>
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
      key: "location",
      header: t("entities.country"),
      cell: row => (
        <span className="text-xs text-muted-foreground">
          {[row.country, row.city].filter(Boolean).join(" — ") || "—"}
        </span>
      ),
    },
    {
      key: "currency",
      header: t("entities.defaultCurrency"),
      cell: row => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-[var(--port-green)]">
            {currencyName(row.defaultCurrency ?? FALLBACK_CURRENCY)}
          </span>
          <span className="text-[10px] text-muted-foreground" dir="ltr">
            {t("common.exchangeRate")}: {row.defaultExchangeRate ?? 3.75}
          </span>
        </div>
      ),
    },
    {
      key: "contact",
      header: t("entities.contact"),
      cell: row => (
        <div className="flex flex-col text-xs">
          <span>{row.contactPerson || "—"}</span>
          {row.phone && (
            <span className="text-[11px] text-muted-foreground" dir="ltr">
              {row.phone}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-28 text-left",
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
            title={t("common.viewfullcard")}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => onEdit(row)}
            title={t("entities.editPartner")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(row)}
            title={t("common.deletepartner")}
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
            placeholder={t("common.searchbynamecountrycityo")}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterKind} onValueChange={setFilterKind}>
          <SelectTrigger className="h-9 bg-card w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.alltypes")}</SelectItem>
            {KINDS.map(k => (
              <SelectItem key={k.value} value={k.value}>
                {t(k.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyHint text={t("common.nomatchingpartnersaddone")} />
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
