import { useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable, StatusPill, type Column } from "@/components/patterns";
import { Field } from "@/components/patterns/Fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { db, type LogisticsLocationKind, type LogisticsLocationRow } from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { locationSchema } from "@/lib/validation/schemas";

const KINDS: { value: LogisticsLocationKind; labelKey: string }[] = [
  { value: "origin", labelKey: "settings.originExport" },
  { value: "unloading", labelKey: "settings.discharge" },
  { value: "delivery", labelKey: "settings.delivery" },
  { value: "other", labelKey: "settings.otherLocation" },
];

export function LocationsTab({
  locations,
  onChanged,
}: {
  locations: LogisticsLocationRow[];
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LogisticsLocationRow | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<LogisticsLocationKind>("other");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const openNew = () => {
    setEditing(null);
    setName("");
    setKind("other");
    setCountry("");
    setCity("");
    setNameError(undefined);
    setOpen(true);
  };

  const openEdit = (row: LogisticsLocationRow) => {
    setEditing(row);
    setName(row.name);
    setKind(row.kind);
    setCountry(row.country);
    setCity(row.city);
    setNameError(undefined);
    setOpen(true);
  };

  const save = async () => {
    const parsed = locationSchema(t).safeParse({ name, country, city });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message);
      return;
    }
    setNameError(undefined);
    const timestamp = nowIso();
    await db.saveLogisticsLocation({
      id: editing?.id ?? newId("loc"),
      name: name.trim(),
      kind,
      country: country.trim(),
      city: city.trim(),
      entityId: editing?.entityId ?? null,
      active: editing?.active ?? 1,
      notes: editing?.notes ?? "",
      createdAt: editing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    setOpen(false);
    onChanged();
    toast.success(t("settings.locationSaved"));
  };

  const remove = async (row: LogisticsLocationRow) => {
    if (!window.confirm(t("settings.deleteLogisticsRecordConfirm"))) return;
    await db.deleteLogisticsLocation(row.id);
    onChanged();
  };

  const kindLabel = (k: LogisticsLocationKind) =>
    t(KINDS.find(x => x.value === k)?.labelKey ?? "settings.otherLocation");

  const columns: Column<LogisticsLocationRow>[] = [
    {
      key: "name",
      header: t("settings.locationName"),
      cell: row => (
        <span className="font-semibold text-[var(--ink)]">
          <MapPin className="me-1 inline h-3.5 w-3.5 text-[var(--ink)]/65" />
          {row.name}
          {row.city ? ` · ${row.city}` : ""}
        </span>
      ),
    },
    {
      key: "kind",
      header: t("entities.type"),
      cell: row => <StatusPill tone="info">{kindLabel(row.kind)}</StatusPill>,
    },
    {
      key: "country",
      header: t("entities.country"),
      cell: row => (
        <span className="text-xs text-muted-foreground">{row.country || "—"}</span>
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
          {t("settings.saveLocation")}
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={locations}
        keyOf={row => row.id}
        onRowClick={openEdit}
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editing ? t("settings.editLocation") : t("settings.saveLocation")}
            </SheetTitle>
            <SheetDescription>{t("settings.locationsAddHint")}</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4">
            <Field
              label={t("settings.locationName")}
              required
              error={nameError}
              control={
                <Input
                  className="field-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t("settings.locationName")}
                />
              }
            />
            <Field
              label={t("entities.type")}
              control={
                <Select value={kind} onValueChange={v => setKind(v as LogisticsLocationKind)}>
                  <SelectTrigger className="field-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map(k => (
                      <SelectItem key={k.value} value={k.value}>
                        {t(k.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <Field
              label={t("settings.countryOptional")}
              control={
                <Input
                  className="field-input"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                />
              }
            />
            <Field
              label={t("settings.cityOptional")}
              control={
                <Input
                  className="field-input"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                />
              }
            />
          </div>
          <SheetFooter>
            <Button onClick={() => void save()}>
              {editing ? t("common.save") : t("settings.saveLocation")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
