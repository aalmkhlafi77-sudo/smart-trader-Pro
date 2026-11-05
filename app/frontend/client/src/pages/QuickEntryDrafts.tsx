import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FilePenLine, Plus, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalAmountField, Field, FormGrid, PageShell, SectionCard } from "@/components/patterns";
import {
  db,
  type CategoryRow,
  type CurrencyRow,
  type EntityKind,
  type EntityRow,
  type ItemPriceRow,
  type ItemRow,
  type ItemSpecRow,
  type QuickEntryDraftRow,
  type QuickEntryTransferPolicy,
  type SpecTemplateRow,
} from "@/lib/db";
import { newId, nowIso } from "@/lib/id";

type DraftRowStatus = "draft" | "incomplete" | "ready" | "transferred";

type QuickEntryLine = {
  id: string;
  selected: boolean;
  entityName: string;
  entityKind: EntityKind;
  country: string;
  currency: string;
  itemName: string;
  category: string;
  material: string;
  weight: string;
  thickness: string;
  price: number;
  priceDraft: string;
  status: DraftRowStatus;
  transferredItemId: string;
  transferNote: string;
};

const normalize = (value: string) => value.trim().toLocaleLowerCase();

const makeLine = (currency = "USD"): QuickEntryLine => ({
  id: newId("quick-entry-line"),
  selected: false,
  entityName: "",
  entityKind: "supplier",
  country: "",
  currency,
  itemName: "",
  category: "",
  material: "",
  weight: "",
  thickness: "",
  price: 0,
  priceDraft: "",
  status: "draft",
  transferredItemId: "",
  transferNote: "",
});

function parseDraftRows(value: string, fallbackCurrency: string): QuickEntryLine[] {
  try {
    const parsed = JSON.parse(value || "[]") as Partial<QuickEntryLine>[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [makeLine(fallbackCurrency)];
    return parsed.map(row => ({
      ...makeLine(fallbackCurrency),
      ...row,
      id: row.id || newId("quick-entry-line"),
      selected: false,
      price: typeof row.price === "number" && Number.isFinite(row.price) ? row.price : 0,
      priceDraft: row.priceDraft ?? (row.price ? String(row.price) : ""),
    }));
  } catch {
    return [makeLine(fallbackCurrency)];
  }
}

export default function QuickEntryDrafts() {
  const { t } = useLanguage();
  const [drafts, setDrafts] = useState<QuickEntryDraftRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [specTemplates, setSpecTemplates] = useState<SpecTemplateRow[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [policy, setPolicy] = useState<QuickEntryTransferPolicy>("warn");
  const [deleteTransferredRows, setDeleteTransferredRows] = useState(false);
  const [rows, setRows] = useState<QuickEntryLine[]>([makeLine()]);
  const [busy, setBusy] = useState(false);

  const loadReference = async () => {
    const [draftRows, entityRows, categoryRows, currencyRows, templates, settings] =
      await Promise.all([
        db.listQuickEntryDrafts(),
        db.listEntities(),
        db.listCategories(),
        db.listCurrencies(),
        db.listSpecTemplates(),
        db.getSettings(),
      ]);
    setDrafts(draftRows);
    setEntities(entityRows);
    setCategories(categoryRows);
    setCurrencies(currencyRows.filter(row => row.active !== 0));
    setSpecTemplates(templates);
    setDefaultCurrency(settings.foreignCurrency || "USD");
    if (!editingId && rows.length === 1 && !rows[0]?.itemName && rows[0]?.currency === "USD") {
      setRows([makeLine(settings.foreignCurrency || "USD")]);
    }
  };

  useEffect(() => {
    void loadReference();
  }, []);

  const reset = () => {
    setEditingId(null);
    setName("");
    setNotes("");
    setPolicy("warn");
    setDeleteTransferredRows(false);
    setRows([makeLine(defaultCurrency)]);
  };

  const updateRow = (id: string, patch: Partial<QuickEntryLine>) => {
    setRows(current =>
      current.map(row => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (patch.status == null && row.status !== "transferred") {
          next.status = computeStatus(next).status;
        }
        return next;
      })
    );
  };

  const computeMissing = (row: QuickEntryLine) => {
    const missing: string[] = [];
    if (!row.entityName.trim()) missing.push(t("quickEntry.entityName"));
    if (!row.country.trim()) missing.push(t("quickEntry.country"));
    if (!row.currency.trim()) missing.push(t("quickEntry.currency"));
    if (!row.category.trim()) missing.push(t("quickEntry.category"));
    if (!row.material.trim()) missing.push(t("quickEntry.material"));
    if (!row.weight.trim()) missing.push(t("quickEntry.weight"));
    if (!row.thickness.trim()) missing.push(t("quickEntry.thickness"));
    if (!row.priceDraft.trim()) missing.push(t("quickEntry.price"));
    return missing;
  };

  const computeStatus = (row: QuickEntryLine): { status: DraftRowStatus; missing: string[] } => {
    if (row.status === "transferred") return { status: "transferred", missing: [] };
    if (!row.itemName.trim()) return { status: "incomplete", missing: [t("quickEntry.itemName"), ...computeMissing(row)] };
    const missing = computeMissing(row);
    return { status: missing.length ? "incomplete" : "ready", missing };
  };

  const saveDraft = async () => {
    const timestamp = nowIso();
    const existing = editingId ? drafts.find(row => row.id === editingId) : null;
    const normalizedRows = rows.map(row => ({
      ...row,
      selected: false,
      status: computeStatus(row).status,
    }));
    const draft: QuickEntryDraftRow = {
      id: editingId ?? newId("quick-entry-draft"),
      name: name.trim() || t("quickEntry.untitled"),
      transferPolicy: policy,
      rowsJson: JSON.stringify(normalizedRows),
      notes: notes.trim(),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await db.saveQuickEntryDraft(draft);
    setEditingId(draft.id);
    setRows(normalizedRows);
    setDrafts(await db.listQuickEntryDrafts());
    toast.success(t("quickEntry.saved"));
  };

  const openDraft = (draft: QuickEntryDraftRow) => {
    setEditingId(draft.id);
    setName(draft.name);
    setNotes(draft.notes || "");
    setPolicy(draft.transferPolicy || "warn");
    setRows(parseDraftRows(draft.rowsJson, defaultCurrency));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeDraft = async (draft: QuickEntryDraftRow) => {
    if (!window.confirm(t("quickEntry.deleteDraftConfirm"))) return;
    await db.deleteQuickEntryDraft(draft.id);
    if (editingId === draft.id) reset();
    setDrafts(await db.listQuickEntryDrafts());
    toast.success(t("quickEntry.draftDeleted"));
  };

  const resolveEntity = async (row: QuickEntryLine, settingsCurrency: string): Promise<EntityRow | null> => {
    if (!row.entityName.trim()) return null;
    const currentEntities = await db.listEntities();
    const match = currentEntities.find(
      entity =>
        normalize(entity.name) === normalize(row.entityName) &&
        entity.kind === row.entityKind
    );
    const timestamp = nowIso();
    if (match) {
      const merged: EntityRow = {
        ...match,
        country: row.country.trim() || match.country,
        defaultCurrency: row.currency.trim() || match.defaultCurrency || settingsCurrency,
        updatedAt: timestamp,
      };
      await db.saveEntity(merged);
      return merged;
    }
    const created: EntityRow = {
      id: newId("ent"),
      name: row.entityName.trim(),
      kind: row.entityKind,
      country: row.country.trim(),
      city: "",
      phone: "",
      email: "",
      contactPerson: "",
      notes: "",
      defaultCurrency: row.currency.trim() || settingsCurrency,
      defaultExchangeRate: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.saveEntity(created);
    return created;
  };

  const upsertSpec = async (
    itemId: string,
    existingSpecs: ItemSpecRow[],
    templateId: string,
    fallbackLabel: string,
    value: string,
    fallbackUnit = "",
    sortOrder = 100
  ) => {
    if (!value.trim()) return;
    const template = specTemplates.find(row => row.id === templateId);
    const label = template?.label || fallbackLabel;
    const current = existingSpecs.find(spec => normalize(spec.label) === normalize(label));
    const timestamp = nowIso();
    await db.saveSpec({
      id: current?.id ?? newId("spec"),
      itemId,
      label,
      value: value.trim(),
      unit: current?.unit || template?.defaultUnit || fallbackUnit,
      sortOrder: current?.sortOrder ?? sortOrder,
      isKey: current?.isKey ?? (template?.isKeyDefault === 1 ? 1 : 0),
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
  };

  const transferOne = async (row: QuickEntryLine): Promise<{ merged: boolean; itemId: string }> => {
    const assessment = computeStatus(row);
    if (!row.itemName.trim()) {
      throw new Error(t("quickEntry.blockedMissing"));
    }
    if (assessment.missing.length > 0) {
      if (policy === "block") throw new Error(t("quickEntry.blockedMissing"));
      if (
        policy === "warn" &&
        !window.confirm(
          `${t("quickEntry.confirmIncomplete")}\n${t("quickEntry.missingFields").replace("{fields}", assessment.missing.join(", "))}`
        )
      ) {
        throw new Error("CANCELLED");
      }
    }

    const settings = await db.getSettings();
    const entity = await resolveEntity(row, settings.foreignCurrency || defaultCurrency);
    const allItems = await db.listItems();
    const existing = allItems.find(
      item =>
        normalize(item.name) === normalize(row.itemName) &&
        (item.entityId || null) === (entity?.id || null)
    );
    const timestamp = nowIso();
    const itemId = existing?.id ?? newId("itm");
    const item: ItemRow = {
      id: itemId,
      name: row.itemName.trim(),
      code: existing?.code || "",
      category: row.category.trim() || existing?.category || "",
      entityId: entity?.id ?? existing?.entityId ?? null,
      unit: existing?.unit || "",
      currency: row.currency.trim() || existing?.currency || entity?.defaultCurrency || settings.foreignCurrency || defaultCurrency,
      defaultExchangeRate:
        existing?.defaultExchangeRate ||
        entity?.defaultExchangeRate ||
        settings.defaultExchangeRate ||
        1,
      customsRate: existing?.customsRate ?? null,
      notes: existing?.notes || "",
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await db.saveItem(item);

    const existingSpecs = await db.listSpecsByItem(itemId);
    await upsertSpec(itemId, existingSpecs, "tpl_material", t("quickEntry.material"), row.material, "", 10);
    await upsertSpec(itemId, existingSpecs, "tpl_weight", t("quickEntry.weight"), row.weight, "", 20);
    await upsertSpec(itemId, existingSpecs, "tpl_thickness", t("quickEntry.thickness"), row.thickness, "", 30);

    if (row.priceDraft.trim()) {
      const price = Number.isFinite(row.price) ? row.price : 0;
      const currentPrice = await db.getPriceByItem(itemId);
      const priceRow: ItemPriceRow = {
        id: currentPrice?.id ?? newId("price"),
        itemId,
        price1: price,
        price1Date: timestamp.slice(0, 10),
        price2: currentPrice?.price2 ?? null,
        price2Date: currentPrice?.price2Date ?? "",
        price3: currentPrice?.price3 ?? null,
        price3Date: currentPrice?.price3Date ?? "",
        price4: currentPrice?.price4 ?? null,
        price4Date: currentPrice?.price4Date ?? "",
        currency: row.currency.trim() || item.currency,
        notes: currentPrice?.notes ?? "",
        createdAt: currentPrice?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      await db.savePrice(priceRow);
      await db.savePriceHistory({
        id: newId("price-history"),
        itemId,
        priceLevel: 1,
        price,
        effectiveDate: timestamp.slice(0, 10),
        currency: priceRow.currency,
        notes: "",
        createdAt: timestamp,
      });
    }
    return { merged: Boolean(existing), itemId };
  };

  const transferRows = async (targetIds: string[]) => {
    if (!targetIds.length) {
      toast.error(t("quickEntry.noSelection"));
      return;
    }
    setBusy(true);
    let count = 0;
    const successful = new Set<string>();
    try {
      for (const id of targetIds) {
        const row = rows.find(item => item.id === id);
        if (!row) continue;
        try {
          const result = await transferOne(row);
          successful.add(id);
          count += 1;
          updateRow(id, {
            status: "transferred",
            transferredItemId: result.itemId,
            transferNote: result.merged ? t("quickEntry.mergedExisting") : t("quickEntry.createdNew"),
            selected: false,
          });
        } catch (error) {
          if (error instanceof Error && error.message === "CANCELLED") continue;
          toast.error(error instanceof Error ? error.message : t("quickEntry.blockedMissing"));
        }
      }
      if (count > 0) {
        const nextRows = deleteTransferredRows
          ? rows.filter(row => !successful.has(row.id))
          : rows.map(row =>
              successful.has(row.id)
                ? {
                    ...row,
                    selected: false,
                    status: "transferred" as const,
                  }
                : row
            );
        setRows(nextRows.length ? nextRows : [makeLine(defaultCurrency)]);
        if (editingId) {
          const currentDraft = drafts.find(row => row.id === editingId);
          if (currentDraft) {
            await db.saveQuickEntryDraft({
              ...currentDraft,
              name: name.trim() || currentDraft.name,
              transferPolicy: policy,
              rowsJson: JSON.stringify(nextRows),
              notes: notes.trim(),
              updatedAt: nowIso(),
            });
            setDrafts(await db.listQuickEntryDrafts());
          }
        }
        await loadReference();
        toast.success(
          count === 1
            ? t("quickEntry.transferDone")
            : t("quickEntry.transferManyDone").replace("{count}", String(count))
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const selectedIds = useMemo(
    () => rows.filter(row => row.selected).map(row => row.id),
    [rows]
  );

  return (
    <AppLayout title={t("quickEntry.title")} subtitle={t("quickEntry.subtitle")}>
      <PageShell
        title={t("quickEntry.title")}
        description={t("quickEntry.description")}
        crumbs={[
          { label: t("nav.home"), href: "/" },
          { label: t("quickEntry.title") },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={reset}>
              <Plus className="h-4 w-4" />
              {t("quickEntry.newDraft")}
            </Button>
            <Button onClick={() => void saveDraft()}>
              <Save className="h-4 w-4" />
              {t("quickEntry.saveDraft")}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <SectionCard title={t("quickEntry.transferSettings")} tone="input">
            <FormGrid cols={3}>
              <Field
                label={t("quickEntry.draftName")}
                control={<Input className="field-input" value={name} onChange={event => setName(event.target.value)} />}
              />
              <Field
                label={t("quickEntry.policy")}
                control={
                  <select className="field-input" value={policy} onChange={event => setPolicy(event.target.value as QuickEntryTransferPolicy)}>
                    <option value="block">{t("quickEntry.policyBlock")}</option>
                    <option value="warn">{t("quickEntry.policyWarn")}</option>
                    <option value="allow">{t("quickEntry.policyAllow")}</option>
                  </select>
                }
              />
              <Field
                label={t("quickEntry.notes")}
                control={<Input className="field-input" value={notes} onChange={event => setNotes(event.target.value)} />}
              />
            </FormGrid>
            <div className="mt-3 space-y-2 text-[11px] text-muted-foreground">
              <p>{t("quickEntry.requiredCore")}</p>
              <p>{t("quickEntry.pricesMerged")}</p>
              <label className="flex items-center gap-2 font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={deleteTransferredRows}
                  onChange={event => setDeleteTransferredRows(event.target.checked)}
                />
                {t("quickEntry.deleteTransferredRows")}
              </label>
            </div>
          </SectionCard>

          <SectionCard
            title={`${t("quickEntry.rows")} (${rows.length})`}
            description={t("quickEntry.desktopHint")}
            actions={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setRows(current => [...current, makeLine(defaultCurrency)])}>
                  <Plus className="h-4 w-4" />
                  {t("quickEntry.addRow")}
                </Button>
                <Button size="sm" variant="outline" disabled={busy || !selectedIds.length} onClick={() => void transferRows(selectedIds)}>
                  <Upload className="h-4 w-4" />
                  {t("quickEntry.transferSelected")}
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void transferRows(rows.map(row => row.id))}>
                  <Upload className="h-4 w-4" />
                  {t("quickEntry.transferAll")}
                </Button>
              </div>
            }
          >
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1450px] text-xs">
                <thead className="bg-secondary/60">
                  <tr>
                    <th className="p-2">{t("quickEntry.select")}</th>
                    <th className="p-2 text-start">{t("quickEntry.entityName")}</th>
                    <th className="p-2 text-start">{t("quickEntry.entityType")}</th>
                    <th className="p-2 text-start">{t("quickEntry.country")}</th>
                    <th className="p-2 text-start">{t("quickEntry.currency")}</th>
                    <th className="p-2 text-start">{t("quickEntry.itemName")}</th>
                    <th className="p-2 text-start">{t("quickEntry.category")}</th>
                    <th className="p-2 text-start">{t("quickEntry.material")}</th>
                    <th className="p-2 text-start">{t("quickEntry.weight")}</th>
                    <th className="p-2 text-start">{t("quickEntry.thickness")}</th>
                    <th className="p-2 text-start">{t("quickEntry.price")}</th>
                    <th className="p-2">{t("quickEntry.status")}</th>
                    <th className="p-2">{t("quickEntry.transfer")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <DesktopRow
                      key={row.id}
                      row={row}
                      entities={entities}
                      categories={categories}
                      currencies={currencies}
                      assessment={computeStatus(row)}
                      onChange={patch => updateRow(row.id, patch)}
                      onDelete={() => setRows(current => current.filter(item => item.id !== row.id))}
                      onTransfer={() => void transferRows([row.id])}
                      t={t}
                      busy={busy}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {rows.map((row, index) => (
                <MobileRow
                  key={row.id}
                  index={index}
                  row={row}
                  entities={entities}
                  categories={categories}
                  currencies={currencies}
                  assessment={computeStatus(row)}
                  onChange={patch => updateRow(row.id, patch)}
                  onDelete={() => setRows(current => current.filter(item => item.id !== row.id))}
                  onTransfer={() => void transferRows([row.id])}
                  t={t}
                  busy={busy}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard title={t("quickEntry.savedDrafts")}>
            {drafts.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {drafts.map(draft => {
                  const draftRows = parseDraftRows(draft.rowsJson, defaultCurrency);
                  const transferred = draftRows.filter(row => row.status === "transferred").length;
                  return (
                    <article key={draft.id} className="rounded border border-border bg-card p-3">
                      <button type="button" className="w-full text-start" onClick={() => openDraft(draft)}>
                        <div className="flex items-center gap-2">
                          <FilePenLine className="h-4 w-4 text-[var(--port-green)]" />
                          <p className="min-w-0 flex-1 truncate text-sm font-bold">{draft.name}</p>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {t("quickEntry.rows")}: {draftRows.length} · {t("quickEntry.transferred")}: {transferred}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {t("quickEntry.lastUpdated")}: {new Date(draft.updatedAt).toLocaleString()}
                        </p>
                      </button>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openDraft(draft)}>{t("quickEntry.open")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => void removeDraft(draft)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                          {t("quickEntry.deleteDraft")}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("quickEntry.noDrafts")}</p>
            )}
          </SectionCard>
        </div>
      </PageShell>
    </AppLayout>
  );
}

function entityKindOptions(t: (key: string) => string) {
  return [
    ["supplier", t("quickEntry.entitySupplier")],
    ["factory", t("quickEntry.entityFactory")],
    ["customer", t("quickEntry.entityCustomer")],
    ["other", t("quickEntry.entityOther")],
  ] as const;
}

function StatusBadge({ status, t }: { status: DraftRowStatus; t: (key: string) => string }) {
  const label =
    status === "transferred"
      ? t("quickEntry.transferred")
      : status === "ready"
        ? t("quickEntry.ready")
        : status === "incomplete"
          ? t("quickEntry.incomplete")
          : t("quickEntry.draft");
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${
      status === "transferred"
        ? "bg-emerald-500/10 text-emerald-700"
        : status === "ready"
          ? "bg-sky-500/10 text-sky-700"
          : "bg-amber-500/10 text-amber-700"
    }`}>
      {label}
    </span>
  );
}

function DesktopRow({
  row, entities, categories, currencies, assessment, onChange, onDelete, onTransfer, t, busy,
}: {
  row: QuickEntryLine;
  entities: EntityRow[];
  categories: CategoryRow[];
  currencies: CurrencyRow[];
  assessment: { status: DraftRowStatus; missing: string[] };
  onChange: (patch: Partial<QuickEntryLine>) => void;
  onDelete: () => void;
  onTransfer: () => void;
  t: (key: string) => string;
  busy: boolean;
}) {
  return (
    <tr className="border-t border-border align-top">
      <td className="p-2 text-center">
        <input type="checkbox" checked={row.selected} onChange={event => onChange({ selected: event.target.checked })} />
      </td>
      <td className="p-1.5">
        <input className="field-input min-w-[150px]" list="quick-entry-entities" value={row.entityName} onChange={event => onChange({ entityName: event.target.value })} />
        <datalist id="quick-entry-entities">{entities.map(entity => <option key={entity.id} value={entity.name} />)}</datalist>
      </td>
      <td className="p-1.5">
        <select className="field-input min-w-[110px]" value={row.entityKind} onChange={event => onChange({ entityKind: event.target.value as EntityKind })}>
          {entityKindOptions(t).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </td>
      <td className="p-1.5"><Input className="field-input min-w-[100px]" value={row.country} onChange={event => onChange({ country: event.target.value })} /></td>
      <td className="p-1.5">
        <select className="field-input min-w-[90px]" value={row.currency} onChange={event => onChange({ currency: event.target.value })}>
          <option value="" />
          {currencies.map(currency => <option key={currency.code} value={currency.code}>{currency.code}</option>)}
        </select>
      </td>
      <td className="p-1.5"><Input className="field-input min-w-[160px]" value={row.itemName} onChange={event => onChange({ itemName: event.target.value })} /></td>
      <td className="p-1.5">
        <select className="field-input min-w-[130px]" value={row.category} onChange={event => onChange({ category: event.target.value })}>
          <option value="" />
          {categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
        </select>
      </td>
      <td className="p-1.5"><Input className="field-input min-w-[120px]" value={row.material} onChange={event => onChange({ material: event.target.value })} /></td>
      <td className="p-1.5"><Input className="field-input min-w-[90px]" value={row.weight} onChange={event => onChange({ weight: event.target.value })} /></td>
      <td className="p-1.5"><Input className="field-input min-w-[90px]" value={row.thickness} onChange={event => onChange({ thickness: event.target.value })} /></td>
      <td className="p-1.5">
        <DecimalAmountField
          className="min-w-[100px]"
          value={row.price}
          onValueChange={price => onChange({ price, priceDraft: String(price) })}
          onChange={undefined}
        />
      </td>
      <td className="p-2 text-center">
        <StatusBadge status={assessment.status} t={t} />
        {row.transferNote ? <p className="mt-1 max-w-[130px] text-[9px] text-muted-foreground">{row.transferNote}</p> : null}
      </td>
      <td className="p-1.5">
        <div className="flex gap-1">
          <Button size="sm" disabled={busy} onClick={onTransfer}><Upload className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      </td>
    </tr>
  );
}

function MobileRow({
  row, index, entities, categories, currencies, assessment, onChange, onDelete, onTransfer, t, busy,
}: {
  row: QuickEntryLine;
  index: number;
  entities: EntityRow[];
  categories: CategoryRow[];
  currencies: CurrencyRow[];
  assessment: { status: DraftRowStatus; missing: string[] };
  onChange: (patch: Partial<QuickEntryLine>) => void;
  onDelete: () => void;
  onTransfer: () => void;
  t: (key: string) => string;
  busy: boolean;
}) {
  return (
    <article className="rounded border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={row.selected} onChange={event => onChange({ selected: event.target.checked })} />
          {t("quickEntry.row")} {index + 1}
        </label>
        <StatusBadge status={assessment.status} t={t} />
      </div>
      <FormGrid cols={2}>
        <Field label={t("quickEntry.entityName")} control={<input className="field-input" list={`mobile-entities-${row.id}`} value={row.entityName} onChange={event => onChange({ entityName: event.target.value })} />} />
        <datalist id={`mobile-entities-${row.id}`}>{entities.map(entity => <option key={entity.id} value={entity.name} />)}</datalist>
        <Field label={t("quickEntry.entityType")} control={<select className="field-input" value={row.entityKind} onChange={event => onChange({ entityKind: event.target.value as EntityKind })}>{entityKindOptions(t).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>} />
        <Field label={t("quickEntry.country")} control={<Input className="field-input" value={row.country} onChange={event => onChange({ country: event.target.value })} />} />
        <Field label={t("quickEntry.currency")} control={<select className="field-input" value={row.currency} onChange={event => onChange({ currency: event.target.value })}><option value="" />{currencies.map(currency => <option key={currency.code} value={currency.code}>{currency.code}</option>)}</select>} />
        <Field label={t("quickEntry.itemName")} required control={<Input className="field-input" value={row.itemName} onChange={event => onChange({ itemName: event.target.value })} />} />
        <Field label={t("quickEntry.category")} control={<select className="field-input" value={row.category} onChange={event => onChange({ category: event.target.value })}><option value="" />{categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}</select>} />
        <Field label={t("quickEntry.material")} control={<Input className="field-input" value={row.material} onChange={event => onChange({ material: event.target.value })} />} />
        <Field label={t("quickEntry.weight")} control={<Input className="field-input" value={row.weight} onChange={event => onChange({ weight: event.target.value })} />} />
        <Field label={t("quickEntry.thickness")} control={<Input className="field-input" value={row.thickness} onChange={event => onChange({ thickness: event.target.value })} />} />
        <Field label={t("quickEntry.price")} control={<DecimalAmountField value={row.price} onValueChange={price => onChange({ price, priceDraft: String(price) })} />} />
      </FormGrid>
      {assessment.missing.length ? (
        <p className="mt-2 text-[10px] text-amber-700">
          {t("quickEntry.missingFields").replace("{fields}", assessment.missing.join(", "))}
        </p>
      ) : null}
      {row.transferNote ? (
        <p className="mt-2 flex items-center gap-1 text-[10px] text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {row.transferNote}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button size="sm" className="flex-1" disabled={busy} onClick={onTransfer}><Upload className="h-4 w-4" />{t("quickEntry.transfer")}</Button>
        <Button size="sm" variant="outline" onClick={onDelete}><Trash2 className="h-4 w-4" />{t("quickEntry.removeRow")}</Button>
      </div>
    </article>
  );
}
