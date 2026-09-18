import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageShell, SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import {
  db,
  type CategoryRow,
  type EntityRow,
  type ItemPriceRow,
  type ItemRow,
  type ItemSpecRow,
  type PricingRunRow,
  type SpecTemplateRow,
} from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import { ItemForm, type ItemFormData, type SpecDraft } from "./items/ItemForm";
import { ItemTable } from "./items/ItemTable";
import { ItemViewDialog } from "./items/ItemViewDialog";

const emptyForm: ItemFormData = {
  name: "",
  code: "",
  category: "",
  entityId: "none",
  unit: "وحدة",
  currency: "دولار",
  defaultExchangeRate: "3.75",
  customsRate: "",
  notes: "",
};

export default function Items() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [specTemplates, setSpecTemplates] = useState<SpecTemplateRow[]>([]);
  const [specsByItem, setSpecsByItem] = useState<Record<string, ItemSpecRow[]>>({});
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  const [form, setForm, clearFormDraft] = useSessionDraft<ItemFormData>(
    "smart-trader:draft:item-form",
    emptyForm
  );
  const [specs, setSpecs, clearSpecsDraft] = useSessionDraft<SpecDraft[]>(
    "smart-trader:draft:item-specs",
    []
  );
  const [editingId, setEditingId, clearEditingDraft] = useSessionDraft<string | null>(
    "smart-trader:draft:item-editing",
    null
  );

  const [viewItem, setViewItem] = useState<ItemRow | null>(null);
  const [viewSpecs, setViewSpecs] = useState<ItemSpecRow[]>([]);
  const [viewPrice, setViewPrice] = useState<ItemPriceRow | null>(null);
  const [viewRun, setViewRun] = useState<PricingRunRow | null>(null);

  const load = async () => {
    await db.init();
    const [itemList, entityList, catList, templateList, attachments] =
      await Promise.all([
        db.listItems(),
        db.listEntities(),
        db.listCategories(),
        db.listSpecTemplates(),
        db.listAttachments(),
      ]);
    setItems([...itemList].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setEntities(entityList);
    setCategories(catList);
    setSpecTemplates(templateList);
    setAttachmentCounts(
      attachments.reduce<Record<string, number>>((counts, att) => {
        if (att.itemId) counts[att.itemId] = (counts[att.itemId] ?? 0) + 1;
        return counts;
      }, {})
    );
    const map: Record<string, ItemSpecRow[]> = {};
    for (const it of itemList) map[it.id] = await db.listSpecsByItem(it.id);
    setSpecsByItem(map);
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    clearFormDraft();
    clearSpecsDraft();
    clearEditingDraft();
    setSpecs([]);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t("items.nameRequired"));
      return;
    }
    const existing = editingId ? items.find(i => i.id === editingId) : null;
    const itemId = existing?.id ?? newId("itm");
    const row: ItemRow = {
      id: itemId,
      name: form.name.trim(),
      code: form.code.trim(),
      category: form.category.trim(),
      entityId: form.entityId === "none" ? null : form.entityId,
      unit: form.unit.trim() || "وحدة",
      currency: form.currency?.trim?.() || "دولار",
      defaultExchangeRate: Number(form.defaultExchangeRate) || 0,
      customsRate: form.customsRate.trim() === "" ? null : Math.max(0, Number(form.customsRate) || 0) / 100,
      notes: form.notes.trim(),
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    await db.saveItem(row);
    await db.deleteSpecsByItem(itemId);
    for (let i = 0; i < specs.length; i += 1) {
      const s = specs[i];
      if (!s.label.trim()) continue;
      await db.saveSpec({
        id: s.id,
        itemId,
        label: s.label.trim(),
        value: s.value.trim(),
        unit: s.unit.trim(),
        sortOrder: 10000 + i,
        isKey: s.isKey ? 1 : 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
    toast.success(existing ? t("items.updated") : t("items.saved"));
    reset();
    await load();
  };

  const populateForm = (row: ItemRow, rowSpecs: ItemSpecRow[], isEdit: boolean) => {
    setEditingId(isEdit ? row.id : null);
    setForm({
      name: row.name,
      code: isEdit ? row.code : (row.code ? `${row.code}-2` : ""),
      category: row.category,
      entityId: row.entityId ?? "none",
      unit: row.unit,
      currency: row.currency,
      defaultExchangeRate: String(row.defaultExchangeRate ?? 3.75),
      customsRate: row.customsRate == null ? "" : String(row.customsRate * 100),
      notes: row.notes,
    });
    setSpecs(
      rowSpecs.map(s => ({
        id: isEdit ? s.id : newId("spec"),
        label: s.label,
        value: s.value,
        unit: s.unit,
        isKey: s.isKey === 1,
        unitOptions: [],
        placeholder: "",
      }))
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const edit = async (row: ItemRow) => {
    const rowSpecs = await db.listSpecsByItem(row.id);
    populateForm(row, rowSpecs, true);
  };

  const duplicate = async (row: ItemRow) => {
    const rowSpecs = await db.listSpecsByItem(row.id);
    populateForm(row, rowSpecs, false);
    toast.info(t("items.duplicateReady"));
  };

  const view = async (row: ItemRow) => {
    const [specsList, price, runs] = await Promise.all([
      db.listSpecsByItem(row.id),
      db.getPriceByItem(row.id),
      db.listPricingRuns(),
    ]);
    const latest = runs.filter(r => r.itemId === row.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    setViewSpecs(specsList);
    setViewPrice(price);
    setViewRun(latest ?? null);
    setViewItem(row);
  };

  const remove = async (row: ItemRow) => {
    if (!window.confirm(`${t("items.confirmDelete")} "${row.name}"?`)) return;
    await db.deleteSpecsByItem(row.id);
    await db.deletePriceByItem(row.id);
    await db.deleteItem(row.id);
    toast.success(t("toast.deleted"));
    if (editingId === row.id) reset();
    await load();
  };

  return (
    <AppLayout title={t("items.title")} subtitle={t("items.subtitle")}>
      <PageShell
        title={t("items.title")}
        description={t("items.subtitle")}
        crumbs={[{ label: t("nav.dashboard"), href: "/" }, { label: t("items.title") }]}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr] items-start">
          <SectionCard
            title={editingId ? t("items.edit") : t("items.add")}
            description={t("common.addonlythespecifications")}
            stamp={t("common.entryform")}
            actions={
              <Button size="sm" variant="outline" className="bg-card" onClick={reset}>
                {editingId ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? t("items.discardDraft") : t("common.newWork")}
              </Button>
            }
          >
            <ItemForm
              form={form}
              setForm={setForm}
              specs={specs}
              setSpecs={setSpecs}
              editingId={editingId}
              entities={entities}
              categories={categories}
              specTemplates={specTemplates}
              onSave={save}
              onReset={reset}
              onAddSpec={tpl => {
                if (tpl && specs.some(s => s.label === tpl.label)) {
                  toast.info(t("items.specExists"));
                  return;
                }
                setSpecs(prev => [
                  ...prev,
                  {
                    id: newId("spec"),
                    label: tpl?.label ?? "",
                    value: "",
                    unit: tpl?.defaultUnit ?? "",
                    unitOptions: tpl?.unitOptions.split("|").map(u => u.trim()).filter(Boolean) ?? [],
                    isKey: tpl?.isKeyDefault === 1,
                    placeholder: tpl?.placeholder ?? "",
                  },
                ]);
              }}
              onToggleKey={id => setSpecs(prev => prev.map(s => (s.id === id ? { ...s, isKey: !s.isKey } : s)))}
              onAttachmentsChanged={() => void load()}
            />
          </SectionCard>

          <SectionCard
            title={`${t("items.record")} (${items.length})`}
            description={t("common.savedonthisdevice")}
            stamp={t("common.itemscatalog")}
          >
            <ItemTable
              items={items}
              entities={entities}
              categories={categories}
              specsByItem={specsByItem}
              attachmentCounts={attachmentCounts}
              onView={row => void view(row)}
              onEdit={edit}
              onDuplicate={duplicate}
              onCalculate={row => navigate(`/pricing?itemId=${row.id}`)}
              onDelete={remove}
            />
          </SectionCard>
        </div>
      </PageShell>

      <ItemViewDialog
        viewItem={viewItem}
        entities={entities}
        viewSpecs={viewSpecs}
        viewPrice={viewPrice}
        viewRun={viewRun}
        onClose={() => setViewItem(null)}
        onEdit={edit}
        onCalculate={row => navigate(`/pricing?itemId=${row.id}`)}
      />
    </AppLayout>
  );
}
