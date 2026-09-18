import { useState } from "react";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable, StatusPill, type Column } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  db,
  type LogisticsLocationRow,
  type LogisticsRateRow,
  type LogisticsRouteTemplateRow,
} from "@/lib/db";
import { TemplateSheet } from "./TemplateSheet";

export function TemplatesTab({
  templates,
  locations,
  rates,
  onChanged,
}: {
  templates: LogisticsRouteTemplateRow[];
  locations: LogisticsLocationRow[];
  rates: LogisticsRateRow[];
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LogisticsRouteTemplateRow | null>(null);

  const locationName = (id: string) =>
    locations.find(l => l.id === id)?.name || "—";

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row: LogisticsRouteTemplateRow) => {
    setEditing(row);
    setOpen(true);
  };

  const remove = async (row: LogisticsRouteTemplateRow) => {
    if (!window.confirm(t("settings.deleteLogisticsRecordConfirm"))) return;
    await db.deleteLogisticsRouteTemplate(row.id);
    onChanged();
  };

  const columns: Column<LogisticsRouteTemplateRow>[] = [
    {
      key: "name",
      header: t("settings.routeTemplates"),
      cell: row => (
        <span className="font-semibold text-[var(--ink)]">
          <Landmark className="me-1 inline h-3.5 w-3.5 text-[var(--ink)]/65" />
          {row.name}
        </span>
      ),
    },
    {
      key: "route",
      header: t("settings.openLocations"),
      cell: row => (
        <span className="text-[11px] text-muted-foreground">
          {locationName(row.originLocationId)} ←{" "}
          {locationName(row.unloadingLocationId)} ←{" "}
          {locationName(row.deliveryLocationId)}
        </span>
      ),
    },
    {
      key: "terms",
      header: t("settings.otherCondition"),
      cell: row => (
        <span className="inline-flex gap-1">
          <StatusPill tone="neutral">{row.incoterm || "—"}</StatusPill>
          <StatusPill tone="info">{row.transportMode || "—"}</StatusPill>
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
          {t("settings.saveRouteTemplate")}
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={templates}
        keyOf={row => row.id}
        onRowClick={openEdit}
      />
      <TemplateSheet
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
        locations={locations}
        rates={rates}
        onSaved={onChanged}
      />
    </div>
  );
}
