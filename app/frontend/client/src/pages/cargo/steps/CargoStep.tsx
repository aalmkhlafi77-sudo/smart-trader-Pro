import { PackagePlus, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Field,
  FormGrid,
  NumberField,
  SectionCard,
  StatusPill,
} from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { latestDatedItemPrice } from "@/lib/latestItemPrice";
import type { ItemPriceRow, ItemRow, EntityRow } from "@/lib/db";
import type { PriceLevel } from "@/lib/db";
import type { CargoDraft, CargoItemDraft } from "../shared";
import { fromOption, optionValue, priceAtLevel } from "../shared";

export function CargoStep({
  draft,
  matchingItems,
  itemById,
  priceRows,
  localCurrency,
  entities,
  onUpdateDraft,
  onUpdateItem,
  onAddItem,
  onSelectLevel,
  onRemoveItem,
}: {
  draft: CargoDraft;
  matchingItems: ItemRow[];
  itemById: Record<string, ItemRow>;
  priceRows: Record<string, ItemPriceRow>;
  localCurrency: string;
  entities: EntityRow[];
  onUpdateDraft: (patch: Partial<CargoDraft>) => void;
  onUpdateItem: (id: string, patch: Partial<CargoItemDraft>) => void;
  onAddItem: () => void;
  onSelectLevel: (item: CargoItemDraft, level: PriceLevel) => void;
  onRemoveItem: (id: string) => void;
}) {
  const { t } = useLanguage();
  const entityName = (id: string | null) =>
    entities.find(e => e.id === id)?.name ?? "";

  return (
    <SectionCard
      title={t("cargo.stepItemsLoad")}
      description={t("cargo.stepItemsLoadHint")}
      stamp={t("cargo.stepStampLoad")}
    >
      <div className="rounded border border-[var(--amber-line)] bg-[var(--amber-field)]/55 p-3">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input
            className="field-input"
            value={draft.itemSearch}
            onChange={event => onUpdateDraft({ itemSearch: event.target.value })}
            placeholder={t("common.searchbynamecodeorcatego")}
          />
          <select
            className="field-input"
            value={optionValue(draft.newItemId)}
            onChange={event =>
              onUpdateDraft({ newItemId: fromOption(event.target.value) })
            }
          >
            <option value="__none__">{t("common.selectanitem")}</option>
            {matchingItems.map(item => {
              const supplier = entityName(item.entityId);
              return (
                <option key={item.id} value={item.id}>
                  {item.code ? `${item.code} — ` : ""}
                  {item.name}
                  {supplier ? ` · ${supplier}` : ""}
                </option>
              );
            })}
          </select>
          <Button type="button" className="min-h-11" onClick={onAddItem}>
            <PackagePlus className="h-4 w-4" />
            {t("cargo.addToLoad")}
          </Button>
        </div>
      </div>
      {draft.items.length === 0 ? (
        <div className="mt-3 rounded border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t("cargo.noItemsInLoad")}.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {draft.items.map(cargoItem => {
            const source = itemById[cargoItem.itemId];
            const latest = latestDatedItemPrice(
              priceRows[cargoItem.itemId] ?? null
            );
            const local = cargoItem.currency === localCurrency;
            return (
              <div
                key={cargoItem.id}
                className="rounded border border-border bg-card p-3"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--ink-deep)]">
                      {source?.name ?? t("export.items")}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                      <span>
                        {source?.code || t("cargo.noCodeWord")} ·{" "}
                        {cargoItem.unit || t("cargo.unspecifiedUnitWord")}
                      </span>
                      <StatusPill tone="info">
                        {cargoItem.priceSource === "latest-dated"
                          ? t("cargo.latestDatedPrice")
                          : cargoItem.priceSource === "selected-level"
                            ? t("cargo.manualLevel")
                            : t("cargo.manualAdjustedPrice")}
                      </StatusPill>
                      {cargoItem.priceEffectiveDate ? (
                        <span dir="ltr">{cargoItem.priceEffectiveDate}</span>
                      ) : null}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => onRemoveItem(cargoItem.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <FormGrid cols={3}>
                  <Field
                    label={t("common.pricelevel")}
                    control={
                      <select
                        className="field-input"
                        value={String(cargoItem.priceLevel)}
                        onChange={event =>
                          onSelectLevel(
                            cargoItem,
                            Number(event.target.value) as PriceLevel
                          )
                        }
                      >
                        {[1, 2, 3, 4].map(level => {
                          const row = priceAtLevel(
                            priceRows[cargoItem.itemId],
                            level as PriceLevel
                          );
                          return (
                            <option key={level} value={level}>
                              {t("prices.price")} {level}
                              {row.price != null
                                ? ` — ${row.price}`
                                : t("common.notrecorded")}
                            </option>
                          );
                        })}
                      </select>
                    }
                  />
                  <Field
                    label={`${t("common.unitprice")} (${cargoItem.currency})`}
                    control={
                      <NumberField
                        value={cargoItem.unitPrice}
                        onChange={event =>
                          onUpdateItem(cargoItem.id, {
                            unitPrice: event.target.value,
                            priceSource: "manual",
                          })
                        }
                        placeholder={
                          latest ? String(latest.price) : t("cargo.enterPrice")
                        }
                      />
                    }
                  />
                  <Field
                    label={t("common.exchangeRate")}
                    control={
                      <NumberField
                        disabled={local}
                        value={local ? "1" : cargoItem.exchangeRate}
                        onChange={event =>
                          onUpdateItem(cargoItem.id, {
                            exchangeRate: event.target.value,
                          })
                        }
                      />
                    }
                  />
                  <Field
                    label={`${t("cargo.quantity")} (${cargoItem.unit})`}
                    control={
                      <NumberField
                        value={cargoItem.quantity}
                        onChange={event =>
                          onUpdateItem(cargoItem.id, {
                            quantity: event.target.value,
                          })
                        }
                        placeholder="0"
                      />
                    }
                  />
                  <Field
                    label={t("items.customsRate")}
                    hint={t("items.customsRateHint")}
                    control={
                      <NumberField
                        value={cargoItem.customsRate}
                        onChange={event =>
                          onUpdateItem(cargoItem.id, {
                            customsRate: event.target.value,
                          })
                        }
                      />
                    }
                  />
                </FormGrid>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
