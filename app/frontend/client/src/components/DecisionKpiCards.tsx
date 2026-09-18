import { useMemo } from "react";
import { AlertTriangle, Boxes, Route, WalletCards } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatMoney, formatNumber } from "@/lib/pricing";
import type { RouteComparisonRow } from "@/lib/cargoDecisionReports";

export function DecisionKpiCards({
  routeRows,
}: {
  routeRows: RouteComparisonRow[];
}) {
  const { t } = useLanguage();
  const bestTotal = routeRows[0] ?? null;
  const bestUnit = useMemo(
    () =>
      routeRows
        .filter(row => row.unitCost != null)
        .sort((a, b) => (a.unitCost ?? Infinity) - (b.unitCost ?? Infinity))[0] ??
      null,
    [routeRows]
  );
  const missingCount = routeRows.reduce(
    (sum, row) => sum + row.missingLines.length,
    0
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {
          label: t("cargo.kpiLowestShipment"),
          value: bestTotal
            ? formatMoney(bestTotal.totalCost, bestTotal.run.currency)
            : "—",
          detail: bestTotal?.routeLabel ?? "",
          icon: WalletCards,
          accent: "var(--port-green)",
        },
        {
          label: t("cargo.kpiLowestUnit"),
          value:
            bestUnit?.unitCost == null
              ? "—"
              : formatMoney(bestUnit.unitCost, bestUnit.run.currency),
          detail: bestUnit?.routeLabel ?? "",
          icon: Boxes,
          accent: "var(--calc-cyan)",
        },
        {
          label: t("cargo.kpiComparableFiles"),
          value: formatNumber(routeRows.length),
          detail: t("cargo.kpiNotArchived"),
          icon: Route,
          accent: "var(--calc-blue)",
        },
        {
          label: t("cargo.kpiNeedsPricing"),
          value: formatNumber(missingCount),
          detail: missingCount
            ? t("cargo.notTreatedAsZero")
            : t("cargo.coverageComplete"),
          icon: AlertTriangle,
          accent: missingCount ? "var(--calc-amber)" : "var(--port-green)",
        },
      ].map(card => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="ledger-card border-r-[3px] p-4"
            style={{ borderRightColor: card.accent }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">{card.label}</p>
              <Icon className="h-4 w-4" style={{ color: card.accent }} />
            </div>
            <p
              className="ledger-figure mt-1 truncate text-lg text-[var(--ink)]"
              dir="ltr"
            >
              {card.value}
            </p>
            <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
              {card.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}
