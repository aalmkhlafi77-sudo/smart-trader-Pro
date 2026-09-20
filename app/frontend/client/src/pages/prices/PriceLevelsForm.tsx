import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Field,
  RateField,
  FormGrid,
  FormSection,
  ItemPicker,
  InheritedValue,
} from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { latestDatedItemPrice } from "@/lib/latestItemPrice";
import { currencyLabel } from "@/lib/currency";
import { priceLevelSchema, optionalNonNegativeText } from "@/lib/validation/schemas";
import type { ItemPriceRow, ItemRow, EntityRow, PriceHistoryRow, PriceLevel } from "@/lib/db";
import { PriceHistoryTable } from "./PriceHistoryTable";
import { PriceLevelCard } from "./PriceLevelCard";

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
  entities: EntityRow[];
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
  entities,
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
              options={items.map(item => {
                const supplier = entities.find(e => e.id === item.entityId)?.name ?? "";
                return {
                  value: item.id,
                  label: item.name,
                  hint: `${item.code ? `[${item.code}] ` : ""}${currencyLabel(item.currency || FALLBACK_CURRENCY, t)}${supplier ? ` · ${supplier}` : ""}`,
                };
              })}
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
              return (
                <PriceLevelCard
                  key={level}
                  index={index}
                  level={level}
                  isActive={latest?.level === level}
                  currency={selectedItem.currency}
                  control={control}
                  register={register}
                  error={errors.levels?.[index]}
                />
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
