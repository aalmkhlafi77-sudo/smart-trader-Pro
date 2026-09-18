/**
 * شاشة الأصناف والمواصفات — اتجاه التصميم: "دفتر الميناء"
 * المواصفات مرنة: يضيف المستخدم أي حقل يحتاجه (غرز، دي تكس، وزن جرام...).
 */

import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import EmptyHint from "@/components/EmptyHint";
import {
  DensityToggle,
  RecordMenu,
  useRecordDensity,
} from "@/components/RecordControls";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
} from "@/lib/pricing";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import {
  Calculator,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Paperclip,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface SpecDraft {
  id: string;
  label: string;
  value: string;
  unit: string;
  unitOptions: string[];
  isKey: boolean;
  placeholder: string;
}

const BASE_CURRENCIES = ["دولار", "ريال"];

const emptyForm = {
  name: "",
  code: "",
  category: "",
  entityId: "none",
  unit: "متر مربع",
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
  const [specsByItem, setSpecsByItem] = useState<Record<string, ItemSpecRow[]>>(
    {}
  );
  const [form, setForm, clearFormDraft] = useSessionDraft(
    "smart-trader:draft:item-form",
    emptyForm
  );
  const [specs, setSpecs, clearSpecsDraft] = useSessionDraft<SpecDraft[]>(
    "smart-trader:draft:item-specs",
    []
  );
  const [editingId, setEditingId, clearEditingDraft] = useSessionDraft<
    string | null
  >("smart-trader:draft:item-editing", null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  /** وضع الاجتماع: يطوي تفاصيل الأصناف حتى لا يراها الطرف الآخر */
  const [discreet, setDiscreet] = useState(false);
  const [currencies, setCurrencies] = useState<string[]>(BASE_CURRENCIES);
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [newCurrency, setNewCurrency] = useState("");
  const [viewItem, setViewItem] = useState<ItemRow | null>(null);
  const [viewSpecs, setViewSpecs] = useState<ItemSpecRow[]>([]);
  const [viewPrice, setViewPrice] = useState<ItemPriceRow | null>(null);
  const [viewRun, setViewRun] = useState<PricingRunRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [density, setDensity] = useRecordDensity();
  const [attachmentCounts, setAttachmentCounts] = useState<
    Record<string, number>
  >({});

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
    const sorted = [...itemList].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
    setItems(sorted);
    setEntities(entityList);
    setCategories(catList);
    setSpecTemplates(templateList);
    setAttachmentCounts(
      attachments.reduce<Record<string, number>>((counts, attachment) => {
        if (attachment.itemId)
          counts[attachment.itemId] = (counts[attachment.itemId] ?? 0) + 1;
        return counts;
      }, {})
    );
    setSpecs(current =>
      current.length > 0
        ? current
        : templateList
            .filter(
              template => template.showInItem === 1 && template.category === ""
            )
            .map(template => ({
              id: newId("spec"),
              label: template.label,
              value: "",
              unit: template.defaultUnit,
              unitOptions: template.unitOptions
                .split("|")
                .map(unit => unit.trim())
                .filter(Boolean),
              isKey: template.isKeyDefault === 1,
              placeholder: template.placeholder,
            }))
    );
    // العملات المستخدمة فعلياً في الأصناف تُضاف إلى القائمة تلقائياً
    const used = Array.from(
      new Set(sorted.map(i => i.currency).filter(Boolean))
    );
    setCurrencies(Array.from(new Set([...BASE_CURRENCIES, ...used])));
    const map: Record<string, ItemSpecRow[]> = {};
    for (const it of sorted) map[it.id] = await db.listSpecsByItem(it.id);
    setSpecsByItem(map);
  };

  useEffect(() => {
    void load();
  }, []);

  const templateFor = (label: string, category = form.category) =>
    specTemplates.find(
      template => template.label === label && template.category === category
    ) ??
    specTemplates.find(
      template => template.label === label && template.category === ""
    );

  const templatesForCategory = (category: string) =>
    specTemplates.filter(
      template =>
        template.showInItem === 1 &&
        (template.category === "" || template.category === category)
    );

  const asDraft = (template: SpecTemplateRow) => ({
    id: newId("spec"),
    label: template.label,
    value: "",
    unit: template.defaultUnit,
    unitOptions: template.unitOptions
      .split("|")
      .map(unit => unit.trim())
      .filter(Boolean),
    isKey: template.isKeyDefault === 1,
    placeholder: template.placeholder,
  });

  const templateDrafts = (category = "") =>
    templatesForCategory(category).map(asDraft);

  const reset = () => {
    clearFormDraft();
    clearSpecsDraft();
    setSpecs(templateDrafts());
    clearEditingDraft();
  };

  const addSpec = (template?: SpecTemplateRow) => {
    if (template && specs.some(spec => spec.label === template.label)) {
      toast.info(t("items.specExists"));
      return;
    }
    setSpecs(prev => [
      ...prev,
      {
        id: newId("spec"),
        label: template?.label ?? "",
        value: "",
        unit: template?.defaultUnit ?? "",
        unitOptions:
          template?.unitOptions
            .split("|")
            .map(unit => unit.trim())
            .filter(Boolean) ?? [],
        isKey: template?.isKeyDefault === 1,
        placeholder: template?.placeholder ?? "",
      },
    ]);
  };

  const orderSpecs = (specList: ItemSpecRow[], category = form.category) => {
    return [...specList].sort(
      (a, b) =>
        (templateFor(a.label, category)?.sortOrder ?? 10000 + a.sortOrder) -
        (templateFor(b.label, category)?.sortOrder ?? 10000 + b.sortOrder)
    );
  };

  const toggleKey = (id: string) =>
    setSpecs(prev =>
      prev.map(s => (s.id === id ? { ...s, isKey: !s.isKey } : s))
    );

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
      customsRate:
        form.customsRate.trim() === ""
          ? null
          : Math.max(0, Number(form.customsRate) || 0) / 100,
      notes: form.notes.trim(),
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    await db.saveItem(row);
    await db.deleteSpecsByItem(itemId);
    for (let index = 0; index < specs.length; index += 1) {
      const s = specs[index];
      if (!s.label.trim()) continue;
      await db.saveSpec({
        id: s.id,
        itemId,
        label: s.label.trim(),
        value: s.value.trim(),
        unit: s.unit.trim(),
        sortOrder:
          templateFor(s.label.trim(), form.category)?.sortOrder ??
          10000 + index,
        isKey: s.isKey ? 1 : 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
    toast.success(existing ? t("items.updated") : t("items.saved"));
    reset();
    await load();
  };

  const edit = async (row: ItemRow) => {
    const rowSpecs = await db.listSpecsByItem(row.id);
    setEditingId(row.id);
    setForm({
      name: row.name,
      code: row.code,
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
        id: s.id,
        label: s.label,
        value: s.value,
        unit: s.unit,
        isKey: s.isKey === 1,
        unitOptions:
          templateFor(s.label, row.category)
            ?.unitOptions.split("|")
            .map(unit => unit.trim())
            .filter(Boolean) ?? [],
        placeholder: templateFor(s.label, row.category)?.placeholder ?? "",
      }))
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** تكرار الصنف: ينسخ البيانات والمواصفات كنموذج جديد لتعديل المتغيرات فقط */
  const duplicate = async (row: ItemRow) => {
    const rowSpecs = await db.listSpecsByItem(row.id);
    setEditingId(null);
    setForm({
      name: row.name,
      code: row.code ? `${row.code}-2` : "",
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
        id: newId("spec"),
        label: s.label,
        value: s.value,
        unit: s.unit,
        isKey: s.isKey === 1,
        unitOptions:
          templateFor(s.label, row.category)
            ?.unitOptions.split("|")
            .map(unit => unit.trim())
            .filter(Boolean) ?? [],
        placeholder: templateFor(s.label, row.category)?.placeholder ?? "",
      }))
    );
    toast.info(t("items.duplicateReady"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** بطاقة عرض تفصيلية: المواصفات + الأسعار الأربعة + آخر تكلفة محسوبة */
  const view = async (row: ItemRow) => {
    const [specsList, price, runs] = await Promise.all([
      db.listSpecsByItem(row.id),
      db.getPriceByItem(row.id),
      db.listPricingRuns(),
    ]);
    const latest = runs
      .filter(r => r.itemId === row.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    setViewSpecs(
      orderSpecs(specsList, row.category).filter(
        spec => templateFor(spec.label, row.category)?.showInItem !== 0
      )
    );
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

  const entityName = (id: string | null) =>
    entities.find(e => e.id === id)?.name ?? t("items.noPartner");

  /** بحث متقدم: يشمل الاسم والكود والتصنيف واسم الجهة وقيم المواصفات */
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
      if (
        filterEntity === "none"
          ? i.entityId !== null
          : i.entityId !== filterEntity
      )
        return false;
    }
    return true;
  });

  return (
    <AppLayout title={t("items.title")} subtitle={t("items.subtitle")}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr] items-start">
        <SectionCard
          title={editingId ? t("items.edit") : t("items.add")}
          hint={t("common.addonlythespecifications")}
          stamp={t("common.registrationform")}
          action={
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
              {editingId ? t("items.discardDraft") : t("common.newWork")}
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="form-cluster">
              <div className="form-cluster-heading">
                <p className="form-cluster-title">
                  {t("common.itemdefinition")}
                </p>
                <p className="form-cluster-note">
                  {t("common.itemnamecodeandcategory")}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="itm-name">{t("items.name")}</Label>
                <Input
                  id="itm-name"
                  className="field-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder={t("common.examplewovencarpet")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="itm-code">{t("items.code")}</Label>
                  <Input
                    id="itm-code"
                    className="field-input"
                    dir="ltr"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="itm-cat">{t("common.category")}</Label>
                  <Select
                    value={form.category || "none"}
                    onValueChange={v => {
                      const category = v === "none" ? "" : v;
                      setForm({ ...form, category });
                      setSpecs(current => [
                        ...current,
                        ...templatesForCategory(category)
                          .filter(
                            template =>
                              !current.some(
                                spec => spec.label === template.label
                              )
                          )
                          .map(asDraft),
                      ]);
                    }}
                  >
                    <SelectTrigger id="itm-cat" className="field-input w-full">
                      <SelectValue placeholder={t("common.selectcategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t("common.nocategory")}
                      </SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {categories.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      {t("items.addCategoriesFromSettings")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="form-cluster">
              <div className="form-cluster-heading">
                <p className="form-cluster-title">{t("items.supply")}</p>
                <p className="form-cluster-note">
                  {t("common.choosethepartnerandthecu")}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.partnersupplier")}</Label>
                <Select
                  value={form.entityId}
                  onValueChange={v => {
                    const selectedEntity = entities.find(
                      entity => entity.id === v
                    );
                    setForm({
                      ...form,
                      entityId: v,
                      currency:
                        selectedEntity?.defaultCurrency ?? form.currency,
                      defaultExchangeRate: String(
                        selectedEntity?.defaultExchangeRate ??
                          form.defaultExchangeRate
                      ),
                    });
                  }}
                >
                  <SelectTrigger className="field-input w-full">
                    <SelectValue placeholder={t("items.selectPartner")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("items.noPartner")}</SelectItem>
                    {entities.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="itm-unit">{t("items.unit")}</Label>
                  <Input
                    id="itm-unit"
                    className="field-input"
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="itm-cur">{t("items.priceCurrency")}</Label>
                  {addingCurrency ? (
                    <div className="flex gap-1.5">
                      <Input
                        id="itm-cur"
                        className="field-input flex-1"
                        autoFocus
                        placeholder={t("settings.currencyName")}
                        value={newCurrency}
                        onChange={e => setNewCurrency(e.target.value)}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="bg-card shrink-0"
                        title={t("items.currencyApproval")}
                        onClick={() => {
                          const v = newCurrency.trim();
                          if (!v) return;
                          setCurrencies(prev =>
                            Array.from(new Set([...prev, v]))
                          );
                          setForm({ ...form, currency: v });
                          setNewCurrency("");
                          setAddingCurrency(false);
                        }}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={form.currency}
                      onValueChange={v => {
                        if (v === "__new__") {
                          setAddingCurrency(true);
                          return;
                        }
                        setForm({ ...form, currency: v });
                      }}
                    >
                      <SelectTrigger
                        id="itm-cur"
                        className="field-input w-full"
                      >
                        <SelectValue placeholder={t("items.selectCurrency")} />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(c => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">
                          + {t("common.addanothercurrency")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="itm-rate">{t("items.referenceRate")}</Label>
                  <Input
                    id="itm-rate"
                    type="number"
                    step="0.0001"
                    min="0"
                    dir="ltr"
                    className="field-input"
                    value={form.defaultExchangeRate ?? "3.75"}
                    onChange={e =>
                      setForm({ ...form, defaultExchangeRate: e.target.value })
                    }
                    placeholder={t("common.example375")}
                  />
                  <p className="form-cluster-note">
                    {t("common.inheritedfromthepartnera")}.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="itm-customs-rate">
                    {t("items.customsRate")}
                  </Label>
                  <Input
                    id="itm-customs-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    dir="ltr"
                    className="field-input"
                    value={form.customsRate}
                    onChange={e =>
                      setForm({ ...form, customsRate: e.target.value })
                    }
                    placeholder={t("items.example12")}
                  />
                  <p className="form-cluster-note">
                    {t("items.customsRateHint")}
                  </p>
                </div>
              </div>
            </div>
            <div className="form-cluster space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[var(--ink)]">
                  {t("items.specs")}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-card"
                  onClick={() => addSpec()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("common.specification")}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("common.selectthestarbesideaspec")}.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {templatesForCategory(form.category).map(template => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => addSpec(template)}
                    className="rounded border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground transition-colors duration-150 hover:border-[var(--port-green)]/60 hover:text-[var(--ink)]"
                  >
                    + {template.label}
                  </button>
                ))}
              </div>
              {specs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {t("common.nospecificationsaddedcho")}.
                </p>
              ) : (
                <div className="space-y-2">
                  {specs.map((s, idx) => (
                    <div
                      key={s.id}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-1.5 sm:flex"
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        className={
                          s.isKey
                            ? "col-start-1 row-start-1 shrink-0 text-[var(--port-green)] sm:col-auto sm:row-auto"
                            : "col-start-1 row-start-1 shrink-0 text-muted-foreground sm:col-auto sm:row-auto"
                        }
                        title={
                          s.isKey
                            ? t("common.comparisonspecification")
                            : t("common.markascomparisonspecific")
                        }
                        onClick={() => toggleKey(s.id)}
                      >
                        <Star
                          className={`h-4 w-4 ${s.isKey ? "fill-current" : ""}`}
                        />
                      </Button>
                      <Input
                        className="field-input col-span-3 min-w-0 sm:col-auto sm:flex-1"
                        placeholder={t("common.specificationname")}
                        value={s.label}
                        onChange={e => {
                          const next = [...specs];
                          next[idx] = { ...s, label: e.target.value };
                          setSpecs(next);
                        }}
                      />
                      <div className="col-span-3 flex min-w-0 gap-1.5 sm:col-auto sm:contents">
                        <Input
                          className="field-input min-w-0 flex-1 sm:flex-none sm:w-24"
                          placeholder={s.placeholder || "القيمة"}
                          value={s.value}
                          onChange={e => {
                            const next = [...specs];
                            next[idx] = { ...s, value: e.target.value };
                            setSpecs(next);
                          }}
                        />
                        {s.unitOptions.length > 1 ? (
                          <Select
                            value={s.unit || s.unitOptions[0]}
                            onValueChange={unit => {
                              const next = [...specs];
                              next[idx] = { ...s, unit };
                              setSpecs(next);
                            }}
                          >
                            <SelectTrigger className="field-input min-w-0 w-24 sm:w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {s.unitOptions.map(unit => (
                                <SelectItem key={unit} value={unit}>
                                  {unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className="field-input min-w-0 w-24 sm:w-20"
                            placeholder={t("common.unit")}
                            value={s.unit}
                            onChange={e => {
                              const next = [...specs];
                              next[idx] = { ...s, unit: e.target.value };
                              setSpecs(next);
                            }}
                          />
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="col-start-3 row-start-1 shrink-0 text-destructive sm:col-auto sm:row-auto"
                        onClick={() =>
                          setSpecs(specs.filter(x => x.id !== s.id))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={save} className="form-action-bar w-full">
              <Save className="h-4 w-4" />
              {editingId ? t("common.updateitem") : t("items.save")}
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title={`${t("items.record")} (${items.length})`}
          hint={
            discreet
              ? t("common.meetingmodeactivedetails")
              : t("common.savedonthisdevice")
          }
          stamp={t("common.itemledger")}
          action={
            <div className="flex items-center gap-1.5">
              <DensityToggle
                value={density}
                onChange={setDensity}
                className="hidden sm:inline-flex"
              />
              <Button
                size="sm"
                variant={discreet ? "default" : "outline"}
                className={discreet ? "" : "bg-card"}
                title={t("common.hidedetailsduringmeeting")}
                onClick={() => setDiscreet(v => !v)}
              >
                {discreet ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  {t("common.meetingmode")}
                </span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-card"
                onClick={() => setShowFilters(v => !v)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("common.filter")}</span>
              </Button>
            </div>
          }
        >
          <div className="mb-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="field-input pr-9"
                placeholder={t("items.searchPlaceholder")}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <DensityToggle
              value={density}
              onChange={setDensity}
              className="sm:hidden"
            />
            {showFilters ? (
              <div className="grid gap-2 sm:grid-cols-2 rounded border border-border bg-secondary/40 p-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px]">{t("common.category")}</Label>
                  <Select
                    value={filterCategory}
                    onValueChange={setFilterCategory}
                  >
                    <SelectTrigger className="h-8 bg-card w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("common.allcategories")}
                      </SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">{t("common.entity")}</Label>
                  <Select value={filterEntity} onValueChange={setFilterEntity}>
                    <SelectTrigger className="h-8 bg-card w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("common.allpartners")}
                      </SelectItem>
                      <SelectItem value="none">
                        {t("items.noPartner")}
                      </SelectItem>
                      {entities.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                  {t("entities.results")}: {filtered.length} {t("entities.of")}{" "}
                  {items.length}
                </p>
              </div>
            ) : null}
          </div>
          {discreet ? (
            <div className="rounded border border-dashed border-[var(--amber-line)] bg-[var(--amber-field)] px-4 py-8 text-center">
              <EyeOff className="mx-auto h-5 w-5 text-[#9a6700]" />
              <p className="mt-2 text-sm font-semibold text-[#7a5200]">
                {t("common.itemregisterishiddenduri")}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#7a5200]">
                {t("items.meetingModeNote")}.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyHint text={t("common.nomatchingitemsaddonefro")} />
          ) : (
            <ul className="space-y-2.5">
              {filtered.map(row => (
                <li
                  key={row.id}
                  className="record-card cursor-pointer rounded-[0.45rem] px-3.5 py-3"
                  onClick={() =>
                    setExpandedId(current =>
                      current === row.id ? null : row.id
                    )
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-[var(--ink)]">
                          {row.name}
                        </p>
                        {row.code ? (
                          <span
                            className="rounded bg-secondary px-1.5 py-0.5 text-[10px]"
                            dir="ltr"
                          >
                            {row.code}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {entityName(row.entityId)} — {row.unit}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-[var(--port-green)]">
                        {row.currency} · {t("cargo.rateShort")}{" "}
                        {row.defaultExchangeRate ?? 3.75}
                        {row.customsRate != null
                          ? ` · ${t("cargo.customsShort")} ${(row.customsRate * 100).toFixed(2)}%`
                          : ""}
                      </p>
                      {(attachmentCounts[row.id] ?? 0) > 0 ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded border border-[var(--port-green)]/35 bg-[var(--port-green-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink-deep)]">
                          <Paperclip className="h-2.5 w-2.5" />
                          {attachmentCounts[row.id]} {t("common.attachments2")}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="action-strip shrink-0"
                      onClick={event => event.stopPropagation()}
                    >
                      <RecordMenu
                        actions={[
                          {
                            label: t("common.calculatecost"),
                            icon: Calculator,
                            onSelect: () => navigate(`/pricing?item=${row.id}`),
                          }, // i18n-deep
                          {
                            label: t("common.viewfullcard"),
                            icon: Eye,
                            onSelect: () => void view(row),
                          }, // i18n-deep
                          {
                            label: t("common.attachments"),
                            icon: Paperclip,
                            onSelect: () => setExpandedId(row.id),
                          }, // i18n-deep
                          {
                            label: t("common.duplicateitem"),
                            icon: Copy,
                            onSelect: () => void duplicate(row),
                          }, // i18n-deep
                          {
                            label: t("items.editItem"),
                            icon: Pencil,
                            onSelect: () => void edit(row),
                          }, // i18n-deep
                          {
                            label: t("items.deleteItem"),
                            icon: Trash2,
                            destructive: true,
                            separatorBefore: true,
                            onSelect: () => void remove(row),
                          }, // i18n-deep
                        ]}
                      />
                    </div>
                  </div>
                  {(specsByItem[row.id]?.length ?? 0) > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
                      {orderSpecs(specsByItem[row.id], row.category)
                        .filter(
                          s =>
                            templateFor(s.label, row.category)?.showInItem !== 0
                        )
                        .filter(
                          s =>
                            density === "detailed" ||
                            expandedId === row.id ||
                            s.isKey === 1
                        )
                        .map(s => (
                          <span
                            key={s.id}
                            className={
                              s.isKey === 1
                                ? "inline-flex items-center gap-1 rounded bg-[var(--port-green-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-deep)]"
                                : "rounded bg-secondary/70 px-2 py-0.5 text-[11px] text-secondary-foreground"
                            }
                          >
                            {s.isKey === 1 ? (
                              <Star className="h-3 w-3 fill-current" />
                            ) : null}
                            {s.label}: <span dir="ltr">{s.value}</span> {s.unit}
                          </span>
                        ))}
                    </div>
                  ) : null}
                  {density === "detailed" || expandedId === row.id ? (
                    <div className="mt-3 grid gap-2 border-t border-dashed border-border pt-3 text-[11px] text-muted-foreground sm:grid-cols-2">
                      <p>
                        <span className="font-semibold text-[var(--ink)]">
                          {t("common.category")}:
                        </span>{" "}
                        {row.category || "—"}
                      </p>
                      <p>
                        <span className="font-semibold text-[var(--ink)]">
                          {t("common.currency")}:
                        </span>{" "}
                        {row.currency}
                      </p>
                      <p>
                        <span className="font-semibold text-[var(--ink)]">
                          {t("items.referenceRate")}:
                        </span>{" "}
                        <span dir="ltr">{row.defaultExchangeRate ?? 3.75}</span>
                      </p>
                      <p>
                        <span className="font-semibold text-[var(--ink)]">
                          {t("items.customsRate")}:
                        </span>{" "}
                        <span dir="ltr">
                          {row.customsRate == null
                            ? "—"
                            : `${(row.customsRate * 100).toFixed(2)}%`}
                        </span>
                      </p>
                      {row.notes ? (
                        <p className="sm:col-span-2">
                          <span className="font-semibold text-[var(--ink)]">
                            {t("common.notes")}:
                          </span>{" "}
                          {row.notes}
                        </p>
                      ) : null}
                      <div
                        className="sm:col-span-2"
                        onClick={event => event.stopPropagation()}
                      >
                        <AttachmentsPanel
                          itemId={row.id}
                          compact
                          onChanged={() => void load()}
                        />
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <Dialog
        open={viewItem !== null}
        onOpenChange={o => !o && setViewItem(null)}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-[var(--ink)]">
              {viewItem?.name ?? ""}
            </DialogTitle>
            <DialogDescription>
              {viewItem
                ? `${entityName(viewItem.entityId)} — ${viewItem.unit} — ${viewItem.currency}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {viewItem ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-[var(--ink)] mb-1.5">
                  {t("items.specs")}
                </p>
                {viewSpecs.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {t("common.nospecificationsrecorded")}
                  </p>
                ) : (
                  <div className="rounded border border-border overflow-hidden">
                    {viewSpecs.map(s => (
                      <div
                        key={s.id}
                        className={
                          s.isKey === 1
                            ? "flex items-center justify-between gap-3 border-b border-border/70 bg-[var(--port-green-soft)] px-3 py-2 last:border-b-0"
                            : "flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2 last:border-b-0"
                        }
                      >
                        <span className="inline-flex items-center gap-1.5 text-xs text-foreground/85">
                          {s.isKey === 1 ? (
                            <Star className="h-3 w-3 fill-current text-[var(--port-green)]" />
                          ) : null}
                          {s.label}
                        </span>
                        <span
                          className="ledger-figure text-sm text-[var(--ink)]"
                          dir="ltr"
                        >
                          {s.value} {s.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-[var(--ink)] mb-1.5">
                  {t("common.pricelevels")} ({viewItem.currency})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { n: 1, v: viewPrice?.price1, d: viewPrice?.price1Date },
                    { n: 2, v: viewPrice?.price2, d: viewPrice?.price2Date },
                    { n: 3, v: viewPrice?.price3, d: viewPrice?.price3Date },
                    { n: 4, v: viewPrice?.price4, d: viewPrice?.price4Date },
                  ].map(p => (
                    <div
                      key={p.n}
                      className="rounded border border-border px-3 py-2"
                    >
                      <p className="text-[11px] text-muted-foreground">
                        {t("prices.price")} {p.n}
                      </p>
                      {p.v == null ? (
                        <p className="text-sm text-muted-foreground">—</p>
                      ) : (
                        <>
                          <p
                            className="ledger-figure text-base text-[var(--ink)]"
                            dir="ltr"
                          >
                            {formatNumber(p.v)}
                          </p>
                          <p
                            className="text-[10px] text-muted-foreground"
                            dir="ltr"
                          >
                            {p.d ? formatDate(p.d) : t("common.nodate")}
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {viewPrice?.notes ? (
                  <p className="mt-2 rounded bg-secondary/50 px-3 py-2 text-[11px]">
                    {viewPrice.notes}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-xs font-semibold text-[var(--ink)] mb-1.5">
                  {t("common.lastcalculatedcost")}
                </p>
                {!viewRun ? (
                  <p className="text-[11px] text-muted-foreground">
                    {t("common.nocosthasbeencalculatedf")}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="result-card rounded px-3 py-2.5">
                        <p className="text-[11px] text-[var(--ink)]/70">
                          {t("home.unitCost")}
                        </p>
                        <p
                          className="ledger-figure text-base text-[var(--ink-deep)]"
                          dir="ltr"
                        >
                          {formatMoney(viewRun.unitCost, viewRun.currency)}
                        </p>
                      </div>
                      <div className="result-card rounded px-3 py-2.5">
                        <p className="text-[11px] text-[var(--ink)]/70">
                          {t("common.suggestedsellingprice")}
                        </p>
                        <p
                          className="ledger-figure text-base text-[var(--ink-deep)]"
                          dir="ltr"
                        >
                          {formatMoney(
                            viewRun.suggestedPrice,
                            viewRun.currency
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground" dir="ltr">
                      {formatDateTime(viewRun.createdAt)}
                    </p>
                  </div>
                )}
              </div>

              <AttachmentsPanel itemId={viewItem.id} compact />

              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1"
                  onClick={() => {
                    void edit(viewItem);
                    setViewItem(null);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  {t("common.edit")}
                </Button>
                <Button
                  variant="outline"
                  className="bg-card"
                  onClick={() => {
                    void duplicate(viewItem);
                    setViewItem(null);
                  }}
                >
                  <Copy className="h-4 w-4" />
                  {t("common.duplicate")}
                </Button>
                <Button
                  variant="outline"
                  className="bg-card"
                  onClick={() => setViewItem(null)}
                >
                  {t("common.close")}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
