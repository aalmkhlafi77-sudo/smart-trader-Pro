import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Field,
  NumberField,
  RateField,
  FormGrid,
  FormSection,
} from "@/components/patterns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_OPTIONS } from "../currencyData";
import type { ItemFormData } from "./ItemForm";

export function ItemCurrencySection({
  control,
  register,
  errors,
}: {
  control: Control<ItemFormData>;
  register: UseFormRegister<ItemFormData>;
  errors: FieldErrors<ItemFormData>;
}) {
  const { t } = useLanguage();

  return (
    <FormSection
      title={t("items.currencyApproval")}
      note={t("common.copiedautomaticallytoani")}
    >
      <FormGrid cols={3}>
        <Field
          label={t("items.priceCurrency")}
          error={errors.currency?.message}
          control={
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || CURRENCY_OPTIONS[0].value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="field-input w-full"><SelectValue /></SelectTrigger>
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
          label={t("items.referenceRate")}
          error={errors.defaultExchangeRate?.message}
          control={
            <NumberField
              {...register("defaultExchangeRate")}
            />
          }
        />
        <Field
          label={t("items.customsRate")}
          hint={t("items.customsRateHint")}
          error={errors.customsRate?.message}
          control={
            <RateField
              placeholder={t("items.example12")}
              {...register("customsRate")}
            />
          }
        />
      </FormGrid>
    </FormSection>
  );
}
