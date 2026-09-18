import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
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
import type { CategoryRow, EntityRow, SpecTemplateRow } from "@/lib/db";
import { currencyLabel } from "@/lib/currency";
import { itemSchema } from "@/lib/validation/schemas";
import { ItemCurrencySection } from "./ItemCurrencySection";
import { ItemExtraSection } from "./ItemExtraSection";
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
  defaultValues: ItemFormData;
  specs: SpecDraft[];
  setSpecs: React.Dispatch<React.SetStateAction<SpecDraft[]>>;
  editingId: string | null;
  entities: EntityRow[];
  categories: CategoryRow[];
  specTemplates: SpecTemplateRow[];
  onDraftChange: (f: ItemFormData) => void;
  onSubmit: (f: ItemFormData) => void;
  onReset: () => void;
  onAddSpec: (tpl?: SpecTemplateRow) => void;
  onToggleKey: (id: string) => void;
  onAttachmentsChanged?: () => void;
}

export function ItemForm({
  defaultValues,
  specs,
  setSpecs,
  editingId,
  entities,
  categories,
  specTemplates,
  onDraftChange,
  onSubmit,
  onReset,
  onAddSpec,
  onToggleKey,
  onAttachmentsChanged,
}: ItemFormProps) {
  const { t } = useLanguage();
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema(t)),
    defaultValues,
  });

  useEffect(() => {
    const subscription = watch(values => onDraftChange(values as ItemFormData));
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entityId = watch("entityId");
  const category = watch("category");
  const selectedEntity = entities.find(e => e.id === entityId);

  const handleEntityChange = (nextId: string) => {
    const ent = entities.find(e => e.id === nextId);
    if (!ent) return setValue("entityId", "none");
    setValue("entityId", nextId);
    setValue("currency", ent.defaultCurrency || watch("currency"));
    setValue(
      "defaultExchangeRate",
      String(ent.defaultExchangeRate ?? watch("defaultExchangeRate"))
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. اسم الصنف* · كود الصنف */}
      <FormSection title={t("items.title")}>
        <FormGrid cols={2}>
          <Field
            label={t("items.name")}
            required
            htmlFor="item-name"
            error={errors.name?.message}
            control={
              <Input
                id="item-name"
                className="field-input"
                placeholder={t("common.examplealnokhbacompany")}
                {...register("name")}
              />
            }
          />
          <Field
            label={t("items.code")}
            htmlFor="item-code"
            control={
              <Input
                id="item-code"
                className="field-input"
                dir="ltr"
                {...register("code")}
              />
            }
          />
        </FormGrid>

        {/* 2. الجهة/المورد (قبل التصنيف لأنه مصدر التوريث) */}
        <div className="mt-3">
          <Field
            label={t("items.selectPartner")}
            control={
              <Controller
                name="entityId"
                control={control}
                render={({ field }) => (
                  <EntityPicker
                    value={field.value === "none" ? "" : field.value}
                    onChange={val => handleEntityChange(val || "none")}
                    placeholder={t("items.noPartner")}
                    searchPlaceholder={t("common.searchbynamecountrycityo")}
                    emptyMessage={t("common.nomatchingpartnersaddone")}
                    options={[
                      { value: "none", label: t("items.noPartner") },
                      ...entities.map(e => ({
                        value: e.id,
                        label: e.name,
                        hint: `${currencyLabel(e.defaultCurrency, t)} · ${e.defaultExchangeRate}`,
                      })),
                    ]}
                  />
                )}
              />
            }
          />
          {selectedEntity ? (
            <div className="mt-3">
              <InheritedValue
                label={t("items.inheritedFromPartner")}
              value={
                <span>
                  {currencyLabel(selectedEntity.defaultCurrency, t)} · <span dir="ltr">{selectedEntity.defaultExchangeRate}</span>
                </span>
              }
                source={selectedEntity.name}
                tone="inherited"
              />
            </div>
          ) : null}
        </div>

        {/* 3. التصنيف* · 4. وحدة القياس* */}
        <FormGrid cols={2} className="mt-3">
          <Field
            label={t("common.category")}
            required
            error={errors.category?.message}
            control={
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="field-input w-full">
                      <SelectValue placeholder={t("common.selectcategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            }
          />
          <Field
            label={t("items.unit")}
            required
            htmlFor="item-unit"
            error={errors.unit?.message}
            control={
              <Input
                id="item-unit"
                className="field-input"
                placeholder={t("items.unitExample")}
                {...register("unit")}
              />
            }
          />
        </FormGrid>
      </FormSection>

      {/* 5. عملة السعر (موروثة قابلة للتجاوز) · سعر الصرف · نسبة الجمارك % */}
      <ItemCurrencySection control={control} register={register} errors={errors} />

      {/* 6. المواصفات الفنية */}
      <ItemSpecsSection
        specs={specs}
        setSpecs={setSpecs}
        category={category}
        specTemplates={specTemplates}
        onAddSpec={onAddSpec}
        onToggleKey={onToggleKey}
      />

      {/* 7. (قسم قابل للطي) ملاحظات · مرفقات */}
      <ItemExtraSection
        register={register}
        editingId={editingId}
        onAttachmentsChanged={onAttachmentsChanged}
      />

      {/* شريط الإجراءات */}
      <div className="flex gap-2 pt-2">
        <Button onClick={() => void handleSubmit(onSubmit)()} className="form-action-bar flex-1">
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
