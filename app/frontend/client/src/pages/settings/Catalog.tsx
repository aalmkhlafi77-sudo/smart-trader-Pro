import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { PageShell, SectionCard } from "@/components/patterns";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  db,
  type CategoryRow,
  type SpecTemplateRow,
} from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { specTemplateSchema } from "@/lib/validation/schemas";
import { CategoriesSection } from "./catalog/CategoriesSection";
import {
  emptyTemplateDraft,
  SpecTemplateForm,
  type SpecTemplateDraft,
} from "./catalog/SpecTemplateForm";
import { SpecTemplatesTable } from "./catalog/SpecTemplatesTable";
import { TemplateCopySection } from "./catalog/TemplateCopySection";

export default function SettingsCatalog() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [templates, setTemplates] = useState<SpecTemplateRow[]>([]);
  const [draft, setDraft] = useState<SpecTemplateDraft>(emptyTemplateDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | undefined>(undefined);
  const [copySource, setCopySource] = useState("__all__");
  const [copyTarget, setCopyTarget] = useState("");

  const load = async () => {
    await db.init();
    const [cats, tpls] = await Promise.all([
      db.listCategories(),
      db.listSpecTemplates(),
    ]);
    setCategories(cats);
    setTemplates(tpls);
  };

  useEffect(() => {
    void load();
  }, []);

  const unitsInUse = useMemo(() => {
    const set = new Set<string>();
    for (const tpl of templates) {
      if (tpl.defaultUnit.trim()) set.add(tpl.defaultUnit.trim());
      for (const u of tpl.unitOptions
        .split(/[|,،]/)
        .map(x => x.trim())
        .filter(Boolean))
        set.add(u);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
  }, [templates]);

  const addCategory = async (name: string) => {
    if (!name) {
      toast.error(t("common.entercategoryname"));
      return false;
    }
    if (categories.some(c => c.name === name)) {
      toast.error(t("common.thiscategoryalreadyexist"));
      return false;
    }
    const now = nowIso();
    await db.saveCategory({
      id: newId("cat"),
      name,
      notes: "",
      sortOrder: categories.length,
      createdAt: now,
      updatedAt: now,
    });
    setCategories(await db.listCategories());
    toast.success(t("common.categoryadded"));
    return true;
  };

  const removeCategory = async (id: string) => {
    await db.deleteCategory(id);
    setCategories(await db.listCategories());
    toast.success(t("common.categorydeleted"));
  };

  const resetDraft = () => {
    setDraft(emptyTemplateDraft);
    setEditingId(null);
    setLabelError(undefined);
  };

  const saveTemplate = async () => {
    const parsed = specTemplateSchema(t).safeParse(draft);
    if (!parsed.success) {
      setLabelError(parsed.error.issues[0]?.message);
      return;
    }
    setLabelError(undefined);
    const label = draft.label.trim();
    const duplicate = templates.some(
      x => x.label === label && x.category === draft.category && x.id !== editingId
    );
    if (duplicate) {
      toast.error(t("common.thisspecificationalready"));
      return;
    }
    const existing = editingId
      ? (templates.find(x => x.id === editingId) ?? null)
      : null;
    const timestamp = nowIso();
    const units = draft.unitOptions
      .split(/[|,،]/)
      .map(u => u.trim())
      .filter(Boolean);
    await db.saveSpecTemplate({
      id: existing?.id ?? newId("tpl"),
      category: draft.category,
      label,
      defaultUnit: draft.defaultUnit.trim() || units[0] || "",
      unitOptions: Array.from(new Set(units)).join("|"),
      placeholder: draft.placeholder.trim(),
      sortOrder: existing?.sortOrder ?? (templates.length + 1) * 10,
      isKeyDefault: draft.isKeyDefault ? 1 : 0,
      showInItem: draft.showInItem ? 1 : 0,
      showInPrices: draft.showInPrices ? 1 : 0,
      showInReports: draft.showInReports ? 1 : 0,
      showInExport: draft.showInExport ? 1 : 0,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    setTemplates(await db.listSpecTemplates());
    resetDraft();
    toast.success(
      existing ? t("settings.specTemplateUpdated") : t("settings.specTemplateAdded")
    );
  };

  const editTemplate = (row: SpecTemplateRow) => {
    setEditingId(row.id);
    setDraft({
      category: row.category,
      label: row.label,
      defaultUnit: row.defaultUnit,
      unitOptions: row.unitOptions,
      placeholder: row.placeholder,
      isKeyDefault: row.isKeyDefault === 1,
      showInItem: row.showInItem === 1,
      showInPrices: row.showInPrices === 1,
      showInReports: row.showInReports === 1,
      showInExport: row.showInExport === 1,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeTemplate = async (row: SpecTemplateRow) => {
    if (
      !window.confirm(
        `${t("settings.deleteTemplate")} «${row.label}»${t("settings.deleteTemplateNote")}.`
      )
    )
      return;
    await db.deleteSpecTemplate(row.id);
    setTemplates(await db.listSpecTemplates());
    if (editingId === row.id) resetDraft();
    toast.success(t("common.templatedeletedfromsetti"));
  };

  const moveTemplate = async (id: string, direction: -1 | 1) => {
    const current = templates.find(x => x.id === id);
    if (!current) return;
    const ordered = templates.filter(x => x.category === current.category);
    const index = ordered.findIndex(x => x.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const timestamp = nowIso();
    await Promise.all(
      ordered.map((x, sortOrder) =>
        db.saveSpecTemplate({ ...x, sortOrder: (sortOrder + 1) * 10, updatedAt: timestamp })
      )
    );
    setTemplates(await db.listSpecTemplates());
  };

  const copyTemplates = async () => {
    if (!copyTarget) {
      toast.error(t("common.selectthecategorytocopyt"));
      return;
    }
    const sourceCategory = copySource === "__all__" ? "" : copySource;
    if (sourceCategory === copyTarget) {
      toast.error(t("common.selectadifferenttargetca"));
      return;
    }
    const source = templates.filter(x => x.category === sourceCategory);
    if (source.length === 0) {
      toast.error(t("common.notemplatesintheselected"));
      return;
    }
    const existingNames = new Set(
      templates.filter(x => x.category === copyTarget).map(x => x.label)
    );
    const toCopy = source.filter(x => !existingNames.has(x.label));
    if (toCopy.length === 0) {
      toast.info(t("common.allsourcetemplatesalread"));
      return;
    }
    const timestamp = nowIso();
    const offset = templates.filter(x => x.category === copyTarget).length;
    await Promise.all(
      toCopy.map((x, index) =>
        db.saveSpecTemplate({
          ...x,
          id: newId("tpl"),
          category: copyTarget,
          sortOrder: (offset + index + 1) * 10,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      )
    );
    setTemplates(await db.listSpecTemplates());
    toast.success(
      `${t("settings.templatesCopiedPrefix")} ${toCopy.length} ${t("settings.templatesCopiedSuffix")} ${copyTarget}`
    );
  };

  return (
    <AppLayout title={t("settings.groupCatalog")} subtitle={t("settings.groupCatalogHint")}>
      <PageShell
        title={t("settings.groupCatalog")}
        description={t("settings.groupCatalogHint")}
        crumbs={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("settings.title"), href: "/settings" },
          { label: t("settings.groupCatalog") },
        ]}
      >
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <div className="space-y-5">
            <CategoriesSection
              categories={categories}
              onAdd={addCategory}
              onDelete={row => void removeCategory(row)}
            />
            <SectionCard
              title={t("settings.unitsTitle")}
              description={t("settings.unitsDerivedNote")}
              stamp={t("settings.unitsLabel")}
            >
              {unitsInUse.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("settings.noSpecTemplates")}.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {unitsInUse.map(u => (
                    <span
                      key={u}
                      className="rounded bg-secondary px-2 py-1 text-[11px] font-medium"
                    >
                      {u}
                    </span>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
          <div className="space-y-5">
            <SpecTemplateForm
              categories={categories}
              draft={draft}
              setDraft={setDraft}
              editingId={editingId}
              labelError={labelError}
              onSave={() => void saveTemplate()}
              onReset={resetDraft}
            />
            <TemplateCopySection
              categories={categories}
              source={copySource}
              setSource={setCopySource}
              target={copyTarget}
              setTarget={setCopyTarget}
              onCopy={() => void copyTemplates()}
            />
            <SpecTemplatesTable
              templates={templates}
              onEdit={editTemplate}
              onDelete={row => void removeTemplate(row)}
              onMove={(id, dir) => void moveTemplate(id, dir)}
            />
          </div>
        </div>
      </PageShell>
    </AppLayout>
  );
}
