import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CurrencyField,
  Field,
  FormGrid,
  NumberField,
  SectionCard,
  StatusPill,
} from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CargoAllocationBasis,
  CargoCostMethod,
  CargoCostStage,
  CargoCostStatus,
} from "@/lib/db";
import type { CargoCostDraft, CargoDraft } from "../shared";
import { CUSTOMS_LINE_NAME, fromOption, optionValue } from "../shared";
import { ExpenseLineSheet } from "./ExpenseLineSheet";

const STATUS_PILL: Record<
  CargoCostStatus,
  { key: string; tone: "success" | "info" | "neutral" | "warning" }
> = {
  entered: { key: "cargo.costStatusEntered", tone: "info" },
  included: { key: "cargo.included", tone: "success" },
  "third-party": { key: "cargo.costStatusThirdParty", tone: "neutral" },
  missing: { key: "cargo.amountRequired", tone: "warning" },
  disabled: { key: "cargo.costStatusDisabled", tone: "neutral" },
};

export function ExpensesStep({
  draft,
  localCurrency,
  foreignCurrency,
  defaultExchangeRate,
  itemNames,
  onUpdateDraft,
  onUpdateCost,
  onToggleCost,
}: {
  draft: CargoDraft;
  localCurrency: string;
  foreignCurrency: string;
  defaultExchangeRate: number;
  itemNames: { id: string; itemId: string; name: string }[];
  onUpdateDraft: (patch: Partial<CargoDraft>) => void;
  onUpdateCost: (id: string, patch: Partial<CargoCostDraft>) => void;
  onToggleCost: (cost: CargoCostDraft) => void;
}) {
  const { t } = useLanguage();
  const [sheetOpen, setSheetOpen] = useState(false);
  const stageLabel: Record<CargoCostStage, string> = {
    factory: t("cargo.stageFactory"),
    port: t("cargo.stagePort"),
    customs: t("cargo.stageCustoms"),
    warehouse: t("cargo.stageWarehouse"),
    other: t("cargo.stageOther"),
  };

  return (
    <SectionCard
      title={t("cargo.stepExpenses")}
      description={t("cargo.stepExpensesHint")}
      stamp={t("cargo.stepStampExpenses")}
      actions={
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          {t("cargo.addCustomLine")}
        </Button>
      }
    >
      <div className="space-y-3">
        {draft.costs.map(cost => {
          const pill = STATUS_PILL[cost.status];
          const locked = cost.name === CUSTOMS_LINE_NAME;
          const editable = cost.status === "entered" && !locked;
          return (
            <div
              key={cost.id}
              className="rounded border border-border bg-card p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {stageLabel[cost.stage]}
                  </span>
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {cost.name}
                  </p>
                  <StatusPill tone={pill.tone}>{t(pill.key)}</StatusPill>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => onToggleCost(cost)}
                >
                  {cost.status === "disabled" ? (
                    <Plus className="h-4 w-4" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {cost.status !== "disabled" ? (
                <FormGrid cols={3}>
                  <Field
                    label={t("cargo.enteredAmount")}
                    control={
                      <select
                        className="field-input"
                        value={cost.status}
                        onChange={event =>
                          onUpdateCost(cost.id, {
                            status: event.target.value as CargoCostStatus,
                          })
                        }
                      >
                        <option value="entered">{t("cargo.enteredAmount")}</option>
                        <option value="included">
                          {t("cargo.includedInSupplierPrice")}
                        </option>
                        <option value="third-party">
                          {t("cargo.borneByOtherParty")}
                        </option>
                        <option value="missing">{t("cargo.enterAmountNeeded")}</option>
                      </select>
                    }
                  />
                  <Field
                    label={t("cargo.fixedAmount")}
                    control={
                      <select
                        className="field-input"
                        disabled={!editable}
                        value={cost.method}
                        onChange={event =>
                          onUpdateCost(cost.id, {
                            method: event.target.value as CargoCostMethod,
                          })
                        }
                      >
                        <option value="fixed">{t("cargo.fixedAmount")}</option>
                        <option value="per-unit">{t("cargo.perUnit")}</option>
                        <option value="manual">{t("cargo.manual")}</option>
                      </select>
                    }
                  />
                  <Field
                    label={t("cargo.amount")}
                    control={
                      <CurrencyField
                        disabled={!editable}
                        value={cost.amount}
                        suffix={cost.currency}
                        onChange={event =>
                          onUpdateCost(cost.id, { amount: event.target.value })
                        }
                        placeholder={
                          locked ? t("cargo.calcFromItemShare") : t("cargo.amount")
                        }
                      />
                    }
                  />
                  <Field
                    label={t("common.currency")}
                    control={
                      <select
                        className="field-input"
                        disabled={!editable}
                        value={cost.currency}
                        onChange={event =>
                          onUpdateCost(cost.id, {
                            currency: event.target.value,
                            exchangeRate:
                              event.target.value === localCurrency
                                ? "1"
                                : cost.exchangeRate ||
                                  String(defaultExchangeRate),
                          })
                        }
                      >
                        <option value={localCurrency}>{localCurrency}</option>
                        <option value={foreignCurrency}>{foreignCurrency}</option>
                      </select>
                    }
                  />
                  <Field
                    label={t("common.exchangerate")}
                    control={
                      <NumberField
                        disabled={!editable || cost.currency === localCurrency}
                        value={
                          cost.currency === localCurrency ? "1" : cost.exchangeRate
                        }
                        onChange={event =>
                          onUpdateCost(cost.id, { exchangeRate: event.target.value })
                        }
                        placeholder={t("common.exchangerate")}
                      />
                    }
                  />
                  <Field
                    label={t("cargo.byValue")}
                    control={
                      <select
                        className="field-input"
                        value={cost.allocationBasis}
                        disabled={locked}
                        onChange={event =>
                          onUpdateCost(cost.id, {
                            allocationBasis: event.target
                              .value as CargoAllocationBasis,
                          })
                        }
                      >
                        <option value="value">{t("cargo.byValue")}</option>
                        <option value="quantity">{t("cargo.byQuantity")}</option>
                        <option value="weight">{t("cargo.byWeight")}</option>
                        <option value="area">{t("cargo.byArea")}</option>
                        <option value="manual">{t("cargo.manual")}</option>
                      </select>
                    }
                  />
                  <Field
                    label={t("cargo.allCompatibleItems")}
                    control={
                      <select
                        className="field-input"
                        value={optionValue(cost.itemIds[0] || "")}
                        disabled={cost.method !== "per-unit"}
                        onChange={event =>
                          onUpdateCost(cost.id, {
                            itemIds: fromOption(event.target.value)
                              ? [fromOption(event.target.value)]
                              : [],
                          })
                        }
                      >
                        <option value="__none__">
                          {t("cargo.allCompatibleItems")}
                        </option>
                        {itemNames.map(item => (
                          <option key={item.id} value={item.itemId}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    }
                  />
                </FormGrid>
              ) : null}
              {locked ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded bg-secondary/55 px-2.5 py-2 text-[11px] text-muted-foreground">
                    {t("cargo.customsBaseNote")}.
                  </div>
                  <NumberField
                    className="field-input"
                    value={draft.customsBaseExtra}
                    onChange={event =>
                      onUpdateDraft({ customsBaseExtra: event.target.value })
                    }
                    placeholder={t("cargo.customsBaseExtra")}
                    aria-label={t("cargo.customsBaseExtra")}
                  />
                </div>
              ) : null}
              {cost.status === "included" || cost.status === "third-party" ? (
                <Input
                  className="field-input mt-2"
                  value={cost.reason}
                  onChange={event =>
                    onUpdateCost(cost.id, { reason: event.target.value })
                  }
                  placeholder={t("cargo.stateReason")}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <ExpenseLineSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        localCurrency={localCurrency}
        foreignCurrency={foreignCurrency}
        defaultExchangeRate={defaultExchangeRate}
        itemNames={itemNames}
        onAdd={line => onUpdateDraft({ costs: [...draft.costs, line] })}
      />
    </SectionCard>
  );
}
