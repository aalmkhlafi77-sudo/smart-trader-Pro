import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Field,
  CurrencyField,
  DateField,
  RateField,
  FormGrid,
  FormSection,
  ItemPicker,
  StatusPill,
  InheritedValue,
} from "@/components/patterns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { latestDatedItemPrice } from "@/lib/latestItemPrice";
import { currencyLabel } from "@/lib/currency";
import { priceLevelSchema, optionalNonNegativeText } from "@/lib/validation/schemas";
import type { ItemPriceRow, ItemRow, PriceHistoryRow, PriceLevel } from "@/lib/db";
import { PriceHistoryTable } from "./PriceHistoryTable";

export interface PriceDraft {
  price: string;
  date: string;
  source: string;
}

export interface PriceFormValues {
  levels: PriceDraft[];
  notes: string;
  customsRate: string;
}

/** قيمة العملة الاحتياطية للعرض (رمز ISO منذ S5). */
const FALLBACK_CURRENCY = "USD";

interface PriceLevelsFormProps {
  items: ItemRow[];
  selectedId: string;
  onSelectId: (id: string) => void;
  ready: boolean;
  defaultValues: PriceFormValues;
  history: PriceHistoryRow[];
  onDraftChange: (v: PriceFormValues) => void;
  onSubmit: (v: PriceFormValues) => void;
  onNewWork: () => void;
}

export function PriceLevelsForm({
  items,
  selectedId,
  onSelectId,
  ready,
  defaultValues,
  history,
  onDraftChange,
  onSubmit,
  onNewWork,
}: PriceLevelsFormProps) {
  const { t } = useLanguage();
  const [showExtra, setShowExtra] = useState(false);
  const selectedItem = items.find(i => i.id === selectedId) ?? null;
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PriceFormValues>({
    resolver: zodResolver(
      z.object({
        levels: z.array(priceLevelSchema(t)).length(4),
        notes: z.string(),
        customsRate: optionalNonNegativeText(t),
      })
    ),
    defaultValues,
  });

  useEffect(() => {
    const subscription = watch(values => onDraftChange(values as PriceFormValues));
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // إعادة التهيئة من القيم الطازجة عند الجاهزية فقط (key وحده يلتقط لقطة قديمة لأن التحميل لاحق)
  useEffect(() => {
    if (ready) reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  const levels = watch("levels");
  const simulatedRow: ItemPriceRow | null = selectedItem
    ? {
        id: "",
        itemId: selectedItem.id,
        price1: Number(levels[0]?.price) || null,
        price1Date: levels[0]?.date || "",
        price2: Number(levels[1]?.price) || null,
        price2Date: levels[1]?.date || "",
        price3: Number(levels[2]?.price) || null,
        price3Date: levels[2]?.date || "",
        price4: Number(levels[3]?.price) || null,
        price4Date: levels[3]?.date || "",
        currency: selectedItem.currency,
        notes: watch("notes"),
        createdAt: "",
        updatedAt: "",
      }
    : null;

  const latest = latestDatedItemPrice(simulatedRow);

  return (
    <div className="space-y-4">
      {/* 1. اختيار الصنف */}
      <FormSection title={t("prices.title")}>
        <Field
          label={t("items.name")}
          required
          control={
            <ItemPicker
              value={selectedId}
              onChange={onSelectId}
              placeholder={t("prices.selectFirst")}
              searchPlaceholder={t("items.searchPlaceholder")}
              emptyMessage={t("common.nomatchingrecordsfound")}
              options={items.map(item => ({
                value: item.id,
                label: item.name,
                hint: `${item.code ? `[${item.code}] ` : ""}${currencyLabel(item.currency || FALLBACK_CURRENCY, t)}`,
              }))}
            />
          }
        />

        {/* 2. العملة الموروثة */}
        {selectedItem && ready && (
          <div className="mt-3">
            <InheritedValue
              label={t("items.priceCurrency")}
              value={currencyLabel(selectedItem.currency || FALLBACK_CURRENCY, t)}
              source={selectedItem.name}
              tone="inherited"
            />
          </div>
        )}
      </FormSection>

      {/* 3. أربعة مستويات: المبلغ | تاريخ الاعتماد | مصدر/ملاحظة + وسم آخر سعر مؤرخ */}
      {selectedItem && ready ? (
        <FormSection title={t("prices.pdfSubtitle")}>
          <div className="space-y-3">
            {[0, 1, 2, 3].map(index => {
              const level = (index + 1) as PriceLevel;
              const isActive = latest?.level === level;
              const levelError = errors.levels?.[index];

              return (
                <div
                  key={level}
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
                    {isActive ? (
                      <StatusPill tone="success">{t("prices.latestDated")}</StatusPill>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Field
                      label={t("prices.price")}
                      htmlFor={`price-amount-${level}`}
                      error={levelError?.price?.message}
                      control={
                        <CurrencyField
                          id={`price-amount-${level}`}
                          suffix={currencyLabel(selectedItem.currency, t)}
                          placeholder="0.00"
                          {...register(`levels.${index}.price` as const)}
                        />
                      }
                    />
                    <Field
                      label={t("prices.date")}
                      error={levelError?.date?.message}
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
            })}
          </div>
        </FormSection>
      ) : null}

      {/* 4. تفاصيل إضافية: نسبة الجمارك والملاحظات */}
      {selectedItem && ready && (
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
                label={t("items.customsRate")}
                hint={t("prices.customsRateHint")}
                htmlFor="price-customs"
                error={errors.customsRate?.message}
                control={
                  <RateField
                    id="price-customs"
                    placeholder={t("items.example12")}
                    {...register("customsRate")}
                  />
                }
              />
              <Field
                label={t("common.notes")}
                htmlFor="price-notes"
                control={
                  <Textarea
                    id="price-notes"
                    className="field-input min-h-20"
                    {...register("notes")}
                  />
                }
              />
            </div>
          )}
        </div>
      )}

      {/* 5. شريط الإجراءات */}
      {selectedItem && ready && (
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => void handleSubmit(onSubmit)()}
            className="form-action-bar flex-1"
          >
            <Save className="h-4 w-4" />
            {t("prices.saved")}
          </Button>
          <Button variant="outline" onClick={onNewWork} className="bg-card">
            <Plus className="h-4 w-4" />
            {t("common.newWork")}
          </Button>
        </div>
      )}

      {/* 6. سجل التغيرات أسفل النموذج */}
      {selectedItem && ready && (
        <PriceHistoryTable history={history} />
      )}
    </div>
  );
}
