import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Field,
  CurrencyField,
  DateField,
  StatusPill,
} from "@/components/patterns";
import { Input } from "@/components/ui/input";
import { currencyLabel } from "@/lib/currency";
import type { PriceLevel } from "@/lib/db";
import type { PriceFormValues } from "./PriceLevelsForm";

/** بطاقة مستوى سعري واحد: المبلغ | تاريخ الاعتماد | مصدر/ملاحظة + وسم آخر سعر مؤرخ */
export function PriceLevelCard({
  index,
  level,
  isActive,
  currency,
  control,
  register,
  error,
}: {
  index: number;
  level: PriceLevel;
  isActive: boolean;
  currency: string;
  control: Control<PriceFormValues>;
  register: UseFormRegister<PriceFormValues>;
  error?: { price?: { message?: string }; date?: { message?: string } };
}) {
  const { t } = useLanguage();

  return (
    <div
      className={`rounded-md border p-2.5 transition-colors ${
        isActive
          ? "border-[var(--port-green)] bg-[var(--port-green-soft)]/50"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[var(--ink)]">
          {t("prices.priceLevel")} {level}
        </span>
        {isActive && (
          <StatusPill tone="success">{t("prices.latestDated")}</StatusPill>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Field
          label={t("prices.price")}
          htmlFor={`price-amount-${level}`}
          error={error?.price?.message}
          control={
            <CurrencyField
              id={`price-amount-${level}`}
              suffix={currencyLabel(currency, t)}
              placeholder="0.00"
              {...register(`levels.${index}.price` as const)}
            />
          }
        />
        <Field
          label={t("prices.date")}
          error={error?.date?.message}
          control={
            <Controller
              name={`levels.${index}.date` as const}
              control={control}
              render={({ field }) => (
                <DateField
                  value={field.value}
                  onChange={field.onChange}
                  ariaLabel={`${t("prices.date")} ${level}`}
                />
              )}
            />
          }
        />
        <Field
          label={t("prices.sourceNote")}
          htmlFor={`price-source-${level}`}
          control={
            <Input
              id={`price-source-${level}`}
              className="field-input text-xs"
              placeholder={t("prices.sourceExample")}
              {...register(`levels.${index}.source` as const)}
            />
          }
        />
      </div>
    </div>
  );
}
