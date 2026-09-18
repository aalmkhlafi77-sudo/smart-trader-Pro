import { useState } from "react";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Field,
  FormGrid,
  FormSection,
  EntityPicker,
  InheritedValue,
} from "@/components/patterns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import type { CategoryRow, EntityRow, SpecTemplateRow } from "@/lib/db";
import { ItemCurrencySection } from "./ItemCurrencySection";
import { ItemSpecsSection } from "./ItemSpecsSection";

export interface ItemFormData {
  name: string;
  code: string;
  category: string;
  entityId: string;
  unit: string;
  currency: string;
  defaultExchangeRate: string;
  customsRate: string;
  notes: string;
}

export interface SpecDraft {
  id: string;
  label: string;
  value: string;
  unit: string;
  unitOptions: string[];
  isKey: boolean;
  placeholder: string;
}

interface ItemFormProps {
  form: ItemFormData;
  setForm: (f: ItemFormData) => void;
  specs: SpecDraft[];
  setSpecs: React.Dispatch<React.SetStateAction<SpecDraft[]>>;
  editingId: string | null;
  entities: EntityRow[];
  categories: CategoryRow[];
  specTemplates: SpecTemplateRow[];
  onSave: () => void;
  onReset: () => void;
  onAddSpec: (tpl?: SpecTemplateRow) => void;
  onToggleKey: (id: string) => void;
  onAttachmentsChanged?: () => void;
}

export function ItemForm({
  form,
  setForm,
  specs,
  setSpecs,
  editingId,
  entities,
  categories,
  specTemplates,
  onSave,
  onReset,
  onAddSpec,
  onToggleKey,
  onAttachmentsChanged,
}: ItemFormProps) {
  const { t } = useLanguage();
  const [showExtra, setShowExtra] = useState(false);
  const selectedEntity = entities.find(e => e.id === form.entityId);

  const handleEntityChange = (entityId: string) => {
    const ent = entities.find(e => e.id === entityId);
    if (ent) {
      setForm({
        ...form,
        entityId,
        currency: ent.defaultCurrency || form.currency,
        defaultExchangeRate: String(ent.defaultExchangeRate ?? form.defaultExchangeRate),
      });
    } else {
      setForm({ ...form, entityId: "none" });
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. اسم الصنف* · كود الصنف */}
      <FormSection title={t("items.title")}>
        <FormGrid cols={2}>
          <Field
            label={t("items.name")}
            required
            control={
              <Input
                className="field-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={t("common.examplealnokhbacompany")}
              />
            }
          />
          <Field
            label={t("items.code")}
            control={
              <Input
                className="field-input"
                dir="ltr"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
              />
            }
          />
        </FormGrid>

        {/* 2. الجهة/المورد (قبل التصنيف لأنه مصدر التوريث) */}
        <div className="mt-3">
          <Field
            label={t("items.selectPartner")}
            control={
              <EntityPicker
                value={form.entityId === "none" ? "" : form.entityId}
                onChange={val => handleEntityChange(val || "none")}
                placeholder={t("items.noPartner")}
                searchPlaceholder={t("common.searchbynamecountrycityo")}
                emptyMessage={t("common.nomatchingpartnersaddone")}
                options={[
                  { value: "none", label: t("items.noPartner") },
                  ...entities.map(e => ({
                    value: e.id,
                    label: e.name,
                    hint: `${e.defaultCurrency} · ${e.defaultExchangeRate}`,
                  })),
                ]}
              />
            }
          />
          {selectedEntity ? (
            <InheritedValue
              className="mt-3"
              label={t("items.inheritedFromPartner")}
              value={
                <span>
                  {selectedEntity.defaultCurrency} ·{" "}
                  <span dir="ltr">{selectedEntity.defaultExchangeRate}</span>
                </span>
              }
              source={selectedEntity.name}
              tone="inherited"
            />
          ) : null}
        </div>

        {/* 3. التصنيف* · 4. وحدة القياس* */}
        <FormGrid cols={2} className="mt-3">
          <Field
            label={t("common.category")}
            required
            control={
              <Select
                value={form.category}
                onValueChange={v => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="field-input w-full">
                  <SelectValue placeholder={t("common.selectcategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <Field
            label={t("items.unit")}
            required
            control={
              <Input
                className="field-input"
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                placeholder={t("items.unitExample")}
              />
            }
          />
        </FormGrid>
      </FormSection>

      {/* 5. عملة السعر (موروثة قابلة للتجاوز) · سعر الصرف · نسبة الجمارك % */}
      <ItemCurrencySection form={form} setForm={setForm} />

      {/* 6. المواصفات الفنية */}
      <ItemSpecsSection
        specs={specs}
        setSpecs={setSpecs}
        category={form.category}
        specTemplates={specTemplates}
        onAddSpec={onAddSpec}
        onToggleKey={onToggleKey}
      />

      {/* 7. (قسم قابل للطي) ملاحظات · مرفقات */}
      <div className="rounded-md border border-border/80 bg-secondary/20 p-3">
        <button
          type="button"
          onClick={() => setShowExtra(v => !v)}
          className="flex w-full items-center justify-between text-xs font-semibold text-[var(--ink)]"
        >
          <span>{t("common.extraDetails")}</span>
          {showExtra ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showExtra && (
          <div className="mt-3 space-y-3 pt-2 border-t border-border/60">
            <Field
              label={t("common.notes")}
              control={
                <Textarea
                  className="field-input min-h-20"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              }
            />
            {editingId && (
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-[var(--ink)]">{t("common.attachments")}</span>
                <AttachmentsPanel itemId={editingId} compact onChanged={onAttachmentsChanged} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* شريط الإجراءات */}
      <div className="flex gap-2 pt-2">
        <Button onClick={onSave} className="form-action-bar flex-1">
          <Plus className="h-4 w-4" />
          {editingId ? t("items.edit") : t("items.save")}
        </Button>
        {editingId && (
          <Button variant="outline" onClick={onReset} className="bg-card">
            <X className="h-4 w-4" />
            {t("items.discardDraft")}
          </Button>
        )}
      </div>
    </div>
  );
}
