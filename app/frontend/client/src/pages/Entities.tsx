import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageShell, SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { db, type EntityRow } from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import { EntityForm, type EntityFormData } from "./entities/EntityForm";
import { EntityTable } from "./entities/EntityTable";
import { EntityViewDialog } from "./entities/EntityViewDialog";

/** قيمة العملة الافتراضية المخزَّنة (نص عربي) — الترحيل إلى رموز ISO مؤجَّل إلى S5. محمية عبر ALLOW_DEC. */
const ENTITY_DATA_DEFAULTS = { currency: "دولار" };

const emptyForm: EntityFormData = {
  name: "",
  kind: "supplier",
  country: "",
  city: "",
  phone: "",
  email: "",
  contactPerson: "",
  notes: "",
  defaultCurrency: ENTITY_DATA_DEFAULTS.currency,
  defaultExchangeRate: "3.75",
};

export default function Entities() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<EntityRow[]>([]);
  const [form, setForm, clearFormDraft] = useSessionDraft<EntityFormData>(
    "smart-trader:draft:entity-form",
    emptyForm
  );
  const [editingId, setEditingId, clearEditingDraft] = useSessionDraft<
    string | null
  >("smart-trader:draft:entity-editing", null);
  const [viewRow, setViewRow] = useState<EntityRow | null>(null);
  const [linkedCount, setLinkedCount] = useState(0);
  const [attachmentCounts, setAttachmentCounts] = useState<
    Record<string, number>
  >({});

  const load = async () => {
    await db.init();
    const [list, attachments] = await Promise.all([
      db.listEntities(),
      db.listAttachments(),
    ]);
    setRows([...list].sort((a, b) => a.name.localeCompare(b.name, "ar")));
    setAttachmentCounts(
      attachments.reduce<Record<string, number>>((counts, attachment) => {
        if (attachment.entityId)
          counts[attachment.entityId] = (counts[attachment.entityId] ?? 0) + 1;
        return counts;
      }, {})
    );
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    clearFormDraft();
    clearEditingDraft();
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t("entities.nameRequired"));
      return;
    }
    const existing = editingId ? rows.find(r => r.id === editingId) : null;
    const row: EntityRow = {
      id: existing?.id ?? newId("ent"),
      name: form.name.trim(),
      kind: form.kind,
      country: form.country.trim(),
      city: form.city.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      contactPerson: form.contactPerson.trim(),
      notes: form.notes.trim(),
      defaultCurrency: form.defaultCurrency?.trim?.() || ENTITY_DATA_DEFAULTS.currency,
      defaultExchangeRate: Number(form.defaultExchangeRate) || 0,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    await db.saveEntity(row);
    toast.success(existing ? t("entities.updated") : t("entities.saved"));
    reset();
    await load();
  };

  const edit = (row: EntityRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      kind: row.kind,
      country: row.country,
      city: row.city,
      phone: row.phone,
      email: row.email,
      contactPerson: row.contactPerson,
      notes: row.notes,
      defaultCurrency: row.defaultCurrency ?? ENTITY_DATA_DEFAULTS.currency,
      defaultExchangeRate: String(row.defaultExchangeRate ?? 3.75),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const view = async (row: EntityRow) => {
    const items = await db.listItems();
    setLinkedCount(items.filter(i => i.entityId === row.id).length);
    setViewRow(row);
  };

  const remove = async (row: EntityRow) => {
    const items = await db.listItems();
    if (items.some(i => i.entityId === row.id)) {
      toast.error(t("entities.cannotDelete"));
      return;
    }
    if (!window.confirm(`${t("entities.confirmDelete")} "${row.name}"?`))
      return;
    await db.deleteEntity(row.id);
    toast.success(t("toast.deleted"));
    if (editingId === row.id) reset();
    await load();
  };

  return (
    <AppLayout title={t("entities.title")} subtitle={t("entities.subtitle")}>
      <PageShell
        title={t("entities.title")}
        description={t("entities.subtitle")}
        crumbs={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("entities.title") },
        ]}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr] items-start">
          <SectionCard
            title={editingId ? t("entities.edit") : t("entities.add")}
            description={t("common.amberfieldsareenteredbyt")}
            stamp={t("common.entryform")}
            actions={
              <Button
                size="sm"
                variant="outline"
                className="bg-card"
                onClick={reset}
              >
                {editingId ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editingId ? t("entities.discardDraft") : t("common.newWork")}
              </Button>
            }
          >
            <EntityForm
              form={form}
              setForm={setForm}
              editingId={editingId}
              onSave={save}
              onReset={reset}
              onAttachmentsChanged={() => void load()}
            />
          </SectionCard>

          <SectionCard
            title={`${t("entities.record")} (${rows.length})`}
            description={t("common.savedonthisdevice")}
            stamp={t("common.partnerledger")}
          >
            <EntityTable
              rows={rows}
              attachmentCounts={attachmentCounts}
              onView={row => void view(row)}
              onEdit={edit}
              onDelete={row => void remove(row)}
            />
          </SectionCard>
        </div>
      </PageShell>

      <EntityViewDialog
        viewRow={viewRow}
        linkedCount={linkedCount}
        onClose={() => setViewRow(null)}
        onEdit={edit}
      />
    </AppLayout>
  );
}
