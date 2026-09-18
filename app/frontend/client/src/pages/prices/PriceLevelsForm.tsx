import { useState } from "react";
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
import type { ItemPriceRow, ItemRow, PriceHistoryRow, PriceLevel } from "@/lib/db";
import { PriceHistoryTable } from "./PriceHistoryTable";

export interface PriceDraft {
  price: string;
  date: string;
  source?: string;
}

/** قيمة العملة الاحتياطية للعرض (رمز ISO منذ S5). */
const FALLBACK_CURRENCY = "USD";

interface PriceLevelsFormProps {
  items: ItemRow[];
  selectedId: string;
  onSelectId: (id: string) => void;
  drafts: PriceDraft[];
  setDrafts: (d: PriceDraft[]) => void;
  notes: string;
  setNotes: (n: string) => void;
  customsRate: string;
  setCustomsRate: (c: string) => void;
  history: PriceHistoryRow[];
  onSave: () => void;
  onNewWork: () => void;
}

export function PriceLevelsForm({
  items,
  selectedId,
  onSelectId,
  drafts,
  setDrafts,
  notes,
  setNotes,
  customsRate,
  setCustomsRate,
  history,
  onSave,
  onNewWork,
}: PriceLevelsFormProps) {
  const { t } = useLanguage();
  const [showExtra, setShowExtra] = useState(false);
  const selectedItem = items.find(i => i.id === selectedId) ?? null;

  // حساب آخر سعر مؤرخ بين المستويات الأربعة
  const simulatedRow: ItemPriceRow | null = selectedItem
    ? {
        id: "",
        itemId: selectedItem.id,
        price1: Number(drafts[0]?.price) || null,
        price1Date: drafts[0]?.date || "",
        price2: Number(drafts[1]?.price) || null,
        price2Date: drafts[1]?.date || "",
        price3: Number(drafts[2]?.price) || null,
        price3Date: drafts[2]?.date || "",
        price4: Number(drafts[3]?.price) || null,
        price4Date: drafts[3]?.date || "",
        currency: selectedItem.currency,
        notes,
        createdAt: "",
        updatedAt: "",
      }
    : null;

  const latest = latestDatedItemPrice(simulatedRow);

  const updateDraft = (index: number, patch: Partial<PriceDraft>) => {
    const updated = [...drafts];
    updated[index] = { ...updated[index], ...patch };
    setDrafts(updated);
  };

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
        {selectedItem && (
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
      {selectedItem ? (
        <FormSection title={t("prices.pdfSubtitle")}>
          <div className="space-y-3">
            {[0, 1, 2, 3].map(index => {
              const level = (index + 1) as PriceLevel;
              const isActive = latest?.level === level;
              const d = drafts[index] || { price: "", date: "", source: "" };

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
                      control={
                        <CurrencyField
                          value={d.price}
                          suffix={currencyLabel(selectedItem.currency, t)}
                          onChange={e => updateDraft(index, { price: e.target.value })}
                          placeholder="0.00"
                        />
                      }
                    />
                    <Field
                      label={t("prices.date")}
                      control={
                        <DateField
                          value={d.date}
                          onChange={v => updateDraft(index, { date: v })}
                        />
                      }
                    />
                    <Field
                      label={t("prices.sourceNote")}
                      control={
                        <Input
                          className="field-input text-xs"
                          value={d.source || ""}
                          onChange={e => updateDraft(index, { source: e.target.value })}
                          placeholder={t("prices.sourceExample")}
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
      {selectedItem && (
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
                control={
                  <RateField
                    value={customsRate}
                    onChange={e => setCustomsRate(e.target.value)}
                    placeholder={t("items.example12")}
                  />
                }
              />
              <Field
                label={t("common.notes")}
                control={
                  <Textarea
                    className="field-input min-h-20"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                }
              />
            </div>
          )}
        </div>
      )}

      {/* 5. شريط الإجراءات */}
      {selectedItem && (
        <div className="flex gap-2 pt-2">
          <Button onClick={onSave} className="form-action-bar flex-1">
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
      {selectedItem && (
        <PriceHistoryTable history={history} currency={selectedItem.currency} />
      )}
    </div>
  );
}
