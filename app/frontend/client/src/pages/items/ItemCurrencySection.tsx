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

/** 5. عملة السعر (موروثة قابلة للتجاوز) · سعر الصرف · نسبة الجمارك % */
export function ItemCurrencySection({
  form,
  setForm,
}: {
  form: ItemFormData;
  setForm: (f: ItemFormData) => void;
}) {
  const { t } = useLanguage();

  return (
    <FormSection title={t("items.currencyApproval")}>
      <FormGrid cols={3}>
        <Field
          label={t("items.priceCurrency")}
          control={
            <Select
              value={form.currency || CURRENCY_OPTIONS[0].value}
              onValueChange={v => setForm({ ...form, currency: v })}
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
          }
        />
        <Field
          label={t("items.referenceRate")}
          control={
            <NumberField
              value={form.defaultExchangeRate}
              onChange={e => setForm({ ...form, defaultExchangeRate: e.target.value })}
            />
          }
        />
        <Field
          label={t("items.customsRate")}
          hint={t("items.customsRateHint")}
          control={
            <RateField
              value={form.customsRate}
              onChange={e => setForm({ ...form, customsRate: e.target.value })}
              placeholder={t("items.example12")}
            />
          }
        />
      </FormGrid>
    </FormSection>
  );
}
