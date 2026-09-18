import { useLanguage } from "@/contexts/LanguageContext";
import { SectionCard } from "@/components/patterns";
import { formatMoney } from "@/lib/pricing";
import type { CargoPricingResult } from "@/lib/cargoPricing";
import type { ItemRow } from "@/lib/db";

export function ResultsStep({
  result,
  itemById,
  localCurrency,
}: {
  result: CargoPricingResult;
  itemById: Record<string, ItemRow>;
  localCurrency: string;
}) {
  const { t } = useLanguage();

  return (
    <SectionCard
      title={t("cargo.loadResults")}
      description={t("cargo.stepResultsHint")}
      stamp={t("cargo.stepStampResults")}
    >
      <div className="space-y-2">
        {result.items.length ? (
          result.items.map(row => (
            <div
              key={row.itemId}
              className="grid gap-2 rounded border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {itemById[row.itemId]?.name}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("common.goodsvalue")}{" "}
                  {formatMoney(row.goodsValue, localCurrency)} ·{" "}
                  {t("cargo.expenseDistribution")}{" "}
                  {formatMoney(row.allocatedCost, localCurrency)}
                </p>
              </div>
              <div className="rounded bg-secondary/50 px-3 py-2 text-end">
                <p className="text-[10px] text-muted-foreground">
                  {t("home.unitCost")}
                </p>
                <p
                  className="ledger-figure text-base font-semibold text-[var(--ink)]"
                  dir="ltr"
                >
                  {formatMoney(row.unitCost, localCurrency)}
                </p>
              </div>
              <div className="rounded bg-[var(--port-green-soft)] px-3 py-2 text-end">
                <p className="text-[10px] text-muted-foreground">
                  {t("common.suggestedsellingprice")}
                </p>
                <p
                  className="ledger-figure text-base font-semibold text-[var(--ink)]"
                  dir="ltr"
                >
                  {formatMoney(row.suggestedPrice, localCurrency)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("cargo.addItemsToShowResults")}.
          </p>
        )}
      </div>
    </SectionCard>
  );
}
