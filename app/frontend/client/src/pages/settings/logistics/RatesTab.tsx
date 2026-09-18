import { useState } from "react";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import { DataTable, StatusPill, type Column } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  db,
  type LogisticsLocationRow,
  type LogisticsRateKind,
  type LogisticsRateRow,
} from "@/lib/db";
import { RateSheet } from "./RateSheet";

const KIND_LABELS: Record<LogisticsRateKind, string> = {
  freight: "settings.internationalShipping",
  "clearance-fee": "settings.clearanceFee",
  "clearance-office": "settings.clearanceOfficeFee",
  transport: "settings.inlandTransfer",
  handling: "settings.loadingUnloading",
  other: "settings.otherExpense",
};

export function RatesTab({
  rates,
  locations,
  onChanged,
}: {
  rates: LogisticsRateRow[];
  locations: LogisticsLocationRow[];
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LogisticsRateRow | null>(null);

  const locationName = (id: string) =>
    locations.find(l => l.id === id)?.name || "—";

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row: LogisticsRateRow) => {
    setEditing(row);
    setOpen(true);
  };

  const remove = async (row: LogisticsRateRow) => {
    if (!window.confirm(t("settings.deleteLogisticsRecordConfirm"))) return;
    await db.deleteLogisticsRate(row.id);
    onChanged();
  };

  const columns: Column<LogisticsRateRow>[] = [
    {
      key: "name",
      header: t("settings.servicePriceName"),
      cell: row => (
        <span className="font-semibold text-[var(--ink)]">
          <Truck className="me-1 inline h-3.5 w-3.5 text-[var(--ink)]/65" />
          {row.name}
        </span>
      ),
    },
    {
      key: "kind",
      header: t("entities.type"),
      cell: row => (
        <StatusPill tone="neutral">{t(KIND_LABELS[row.kind] ?? "settings.otherExpense")}</StatusPill>
      ),
    },
    {
      key: "amount",
      header: t("cargo.amount"),
      cell: row => (
        <span className="font-bold tabular-nums" dir="ltr">
          {row.amount.toLocaleString("en-US")} {row.currency}
        </span>
      ),
    },
    {
      key: "route",
      header: t("cargo.originLocation"),
      cell: row => (
        <span className="text-[11px] text-muted-foreground">
          {locationName(row.originLocationId)} ← {locationName(row.destinationLocationId)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-20 text-left",
      cell: row => (
        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title={t("common.edit")}
            onClick={() => openEdit(row)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive"
            title={t("common.delete")}
            onClick={() => void remove(row)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          {t("settings.savePrice")}
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={rates}
        keyOf={row => row.id}
        onRowClick={openEdit}
      />
      <RateSheet
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
        locations={locations}
        onSaved={onChanged}
      />
    </div>
  );
}
