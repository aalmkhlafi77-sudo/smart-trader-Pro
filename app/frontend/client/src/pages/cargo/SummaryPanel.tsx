import { AlertTriangle, Tag, WalletCards } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Field, RateField, SectionCard, SummaryRail } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/pricing";
import type { CargoPricingResult } from "@/lib/cargoPricing";
import type { PriceLevel } from "@/lib/db";

export interface PriceSaveRow {
  itemId: string;
  name: string;
  suggested: number;
}

export function SummaryPanel({
  result,
  localCurrency,
  marginRate,
  onMarginChange,
  canSavePrices,
  showPriceSave,
  onTogglePriceSave,
  saveRows,
  priceSaveSelection,
  priceSaveLevels,
  onToggleSelect,
  onLevelChange,
  onSaveSelected,
}: {
  result: CargoPricingResult;
  localCurrency: string;
  marginRate: string;
  onMarginChange: (v: string) => void;
  canSavePrices: boolean;
  showPriceSave: boolean;
  onTogglePriceSave: () => void;
  saveRows: PriceSaveRow[];
  priceSaveSelection: Record<string, boolean>;
  priceSaveLevels: Record<string, PriceLevel>;
  onToggleSelect: (itemId: string, v: boolean) => void;
  onLevelChange: (itemId: string, level: PriceLevel) => void;
  onSaveSelected: () => void;
}) {
  const { t } = useLanguage();

  const money = (v: number) => (
    <span dir="ltr">{formatMoney(v, localCurrency)}</span>
  );

  const fullRows = [
    { label: t("cargo.stageInvoiceFactory"), value: money(result.invoiceValue) },
    {
      label: t("cargo.stageArrivedPort"),
      value: money(result.invoiceValue + result.stageTotals.port),
    },
    {
      label: t("cargo.stageAfterCustoms"),
      value: money(
        result.invoiceValue + result.stageTotals.port + result.stageTotals.customs
      ),
    },
    {
      label: t("cargo.stageArrivedWarehouse"),
      value: money(result.totalCost),
      tone: "total" as const,
    },
    {
      label: `${t("cargo.customsOnBase")} ${formatMoney(result.customsBase, localCurrency)}`,
      value: money(result.customsAmount),
      tone: "muted" as const,
    },
    {
      label: t("cargo.suggestedRevenue"),
      value: money(result.totalSuggestedRevenue),
      tone: "total" as const,
    },
  ];

  const compactRows = [
    { label: t("cargo.stageInvoiceFactory"), value: money(result.invoiceValue) },
    {
      label: t("cargo.totalCost"),
      value: money(result.totalCost),
      tone: "total" as const,
    },
    {
      label: t("cargo.suggestedRevenue"),
      value: money(result.totalSuggestedRevenue),
      tone: "total" as const,
    },
  ];

  return (
    <div className="space-y-4">
      <SummaryRail
        title={t("cargo.interimSummary")}
        rows={fullRows}
        className="hidden xl:block xl:sticky xl:top-5"
      />
      <SummaryRail
        title={t("cargo.interimSummary")}
        rows={compactRows}
        className="sticky bottom-0 z-10 shadow-lg xl:hidden"
      />
      <SectionCard
        title={t("cargo.pricingDecision")}
        description={t("cargo.profitOnCostNote")}
        stamp={t("common.sale")}
      >
        <div className="grid grid-cols-2 gap-2">
          <Field
            label={`${t("cargo.profitRate")} %`}
            control={
              <RateField
                value={marginRate}
                onChange={event => onMarginChange(event.target.value)}
              />
            }
          />
          <div className="rounded bg-[var(--port-green-soft)] px-3 py-2">
            <p className="text-[10px] text-muted-foreground">
              {t("cargo.suggestedRevenue")}
            </p>
            <p
              className="ledger-figure mt-1 text-sm font-semibold text-[var(--ink)]"
              dir="ltr"
            >
              {formatMoney(result.totalSuggestedRevenue, localCurrency)}
            </p>
          </div>
        </div>
        <Button
          type="button"
          className="mt-3 w-full"
          variant="outline"
          onClick={onTogglePriceSave}
          disabled={!canSavePrices}
        >
          <WalletCards className="h-4 w-4" />
          {t("cargo.saveSelectedSellingPrices")}
        </Button>
        {showPriceSave ? (
          <PriceSavePanel
            saveRows={saveRows}
            localCurrency={localCurrency}
            priceSaveSelection={priceSaveSelection}
            priceSaveLevels={priceSaveLevels}
            onToggleSelect={onToggleSelect}
            onLevelChange={onLevelChange}
            onSaveSelected={onSaveSelected}
          />
        ) : null}
      </SectionCard>
      <div className="rounded border border-border bg-secondary/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        <AlertTriangle className="me-1 inline h-3.5 w-3.5 text-[var(--ink)]/70" />
        {t("cargo.customsDistributionNote")}.
      </div>
    </div>
  );
}

function PriceSavePanel({
  saveRows,
  localCurrency,
  priceSaveSelection,
  priceSaveLevels,
  onToggleSelect,
  onLevelChange,
  onSaveSelected,
}: {
  saveRows: PriceSaveRow[];
  localCurrency: string;
  priceSaveSelection: Record<string, boolean>;
  priceSaveLevels: Record<string, PriceLevel>;
  onToggleSelect: (itemId: string, v: boolean) => void;
  onLevelChange: (itemId: string, level: PriceLevel) => void;
  onSaveSelected: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="mt-3 space-y-2 rounded border border-[var(--amber-line)] bg-[var(--amber-field)]/45 p-2.5">
      {saveRows.map(row => (
        <div
          key={row.itemId}
          className="grid grid-cols-[auto_minmax(0,1fr)_90px] items-center gap-2"
        >
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={Boolean(priceSaveSelection[row.itemId])}
            onChange={event => onToggleSelect(row.itemId, event.target.checked)}
          />
          <span className="truncate text-xs">
            {row.name} · {formatMoney(row.suggested, localCurrency)}
          </span>
          <select
            className="field-input h-8 text-xs"
            value={String(priceSaveLevels[row.itemId] ?? 1)}
            onChange={event =>
              onLevelChange(row.itemId, Number(event.target.value) as PriceLevel)
            }
          >
            <option value="1">{t("cargo.priceWord")} 1</option>
            <option value="2">{t("cargo.priceWord")} 2</option>
            <option value="3">{t("cargo.priceWord")} 3</option>
            <option value="4">{t("cargo.priceWord")} 4</option>
          </select>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        className="mt-1 w-full"
        onClick={onSaveSelected}
      >
        <Tag className="h-3.5 w-3.5" />
        {t("cargo.saveSelectedOnly")}
      </Button>
    </div>
  );
}

