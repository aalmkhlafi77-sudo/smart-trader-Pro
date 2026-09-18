import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Field,
  NumberField,
  FormGrid,
  FormSection,
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
import type { EntityKind } from "@/lib/db";
import { entitySchema } from "@/lib/validation/schemas";
import { CURRENCY_OPTIONS } from "../currencyData";
import { EntityExtraSection } from "./EntityExtraSection";

export interface EntityFormData {
  name: string;
  kind: EntityKind;
  country: string;
  city: string;
  phone: string;
  email: string;
  contactPerson: string;
  notes: string;
  defaultCurrency: string;
  defaultExchangeRate: string;
}

const KINDS: { value: EntityKind; labelKey: string }[] = [
  { value: "supplier", labelKey: "entities.kind.supplier" },
  { value: "customer", labelKey: "entities.kind.customer" },
  { value: "factory", labelKey: "entities.kind.factory" },
  { value: "other", labelKey: "entities.kind.other" },
];

export function EntityForm({
  defaultValues,
  editingId,
  onDraftChange,
  onSubmit,
  onReset,
  onAttachmentsChanged,
}: {
  defaultValues: EntityFormData;
  editingId: string | null;
  onDraftChange: (f: EntityFormData) => void;
  onSubmit: (f: EntityFormData) => void;
  onReset: () => void;
  onAttachmentsChanged?: () => void;
}) {
  const { t } = useLanguage();
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EntityFormData>({
    resolver: zodResolver(entitySchema(t)),
    defaultValues,
  });

  useEffect(() => {
    const subscription = watch(values => onDraftChange(values as EntityFormData));
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveCurrency = watch("defaultCurrency") || CURRENCY_OPTIONS[0].value;
  const liveRate = watch("defaultExchangeRate") || "3.75";

  return (
    <div className="space-y-4">
      {/* 1. الاسم* · نوع العلاقة* */}
      <FormSection
        title={t("common.partneridentity")}
        note={t("common.nametypeandlocation")}
      >
        <FormGrid cols={2}>
          <Field
            label={t("entities.name")}
            required
            htmlFor="ent-name"
            error={errors.name?.message}
            control={
              <Input
                id="ent-name"
                className="field-input"
                placeholder={t("common.examplealnokhbacompany")}
                {...register("name")}
              />
            }
          />
          <Field
            label={t("entities.type")}
            required
            error={errors.kind?.message}
            control={
              <Controller
                name="kind"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
                )}
              />
            }
          />
        </FormGrid>

        {/* 2. الدولة · المدينة */}
        <FormGrid cols={2} className="mt-3">
          <Field
            label={t("entities.country")}
            htmlFor="ent-country"
            control={
              <Input id="ent-country" className="field-input" {...register("country")} />
            }
          />
          <Field
            label={t("entities.city")}
            htmlFor="ent-city"
            control={
              <Input id="ent-city" className="field-input" {...register("city")} />
            }
          />
        </FormGrid>
      </FormSection>

      {/* 3. العملة الافتراضية* · سعر الصرف المرجعي* (تلميح: تورث لكل صنف جديد) */}
      <FormSection
        title={t("entities.defaultPurchase")}
        note={t("common.copiedautomaticallytoani")}
      >
        <FormGrid cols={2}>
          <Field
            label={t("entities.defaultCurrency")}
            required
            hint={t("common.copiedautomaticallytoani")}
            error={errors.defaultCurrency?.message}
            control={
              <Controller
                name="defaultCurrency"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || CURRENCY_OPTIONS[0].value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="field-input w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>
                          {t(o.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            }
          />
          <Field
            label={t("entities.defaultRate")}
            required
            htmlFor="ent-rate"
            hint={t("common.copiedautomaticallytoani")}
            error={errors.defaultExchangeRate?.message}
            control={
              <NumberField
                id="ent-rate"
                placeholder={t("common.example375")}
                {...register("defaultExchangeRate")}
              />
            }
          />
        </FormGrid>
        <InheritedValue
          className="mt-3"
          label={t("entities.willInherit")}
          value={
            <span>
              {liveCurrency} · <span dir="ltr">{liveRate}</span>
            </span>
          }
          tone="inherited"
        />
      </FormSection>

      {/* 4. الشخص المسؤول · الهاتف · البريد */}
      <FormSection
        title={t("common.contactdetails")}
        note={t("common.adddetailsthathelpyouret")}
      >
        <Field
          label={t("entities.contact")}
          htmlFor="ent-contact"
          control={
            <Input
              id="ent-contact"
              className="field-input"
              {...register("contactPerson")}
            />
          }
        />
        <FormGrid cols={2} className="mt-3">
          <Field
            label={t("entities.phone")}
            htmlFor="ent-phone"
            control={
              <Input
                id="ent-phone"
                className="field-input"
                dir="ltr"
                {...register("phone")}
              />
            }
          />
          <Field
            label={t("entities.email")}
            htmlFor="ent-email"
            error={errors.email?.message}
            control={
              <Input
                id="ent-email"
                className="field-input"
                dir="ltr"
                {...register("email")}
              />
            }
          />
        </FormGrid>
      </FormSection>

      {/* 5. (قسم قابل للطي) ملاحظات · مرفقات */}
      <EntityExtraSection
        register={register}
        editingId={editingId}
        onAttachmentsChanged={onAttachmentsChanged}
      />

      {/* شريط الإجراءات */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={() => void handleSubmit(onSubmit)()}
          className="form-action-bar flex-1"
        >
          <Plus className="h-4 w-4" />
          {editingId ? t("entities.update") : t("entities.save")}
        </Button>
        {editingId && (
          <Button variant="outline" onClick={onReset} className="bg-card">
            <X className="h-4 w-4" />
            {t("entities.discardDraft")}
          </Button>
        )}
      </div>
    </div>
  );
}
