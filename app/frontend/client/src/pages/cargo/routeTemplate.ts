import { toast } from "sonner";
import type {
  LogisticsRateRow,
  LogisticsRouteTemplateRow,
  SettingsRow,
} from "@/lib/db";
import type { CargoDraft } from "./shared";
import {
  CIF_INCLUDED_LABEL,
  CIF_INCLUDED_REASON,
  FREIGHT_LINE_NAME,
} from "./shared";

export function applyRateToCosts(args: {
  draft: CargoDraft;
  name: string;
  rateId: string;
  rates: LogisticsRateRow[];
  settings: SettingsRow | null;
  localCurrency: string;
  t: (key: string) => string;
}): CargoDraft["costs"] {
  const { draft, name, rateId, rates, settings, localCurrency, t } = args;
  const rate = rates.find(row => row.id === rateId);
  if (!rate) return draft.costs;
  return draft.costs.map(cost =>
    cost.name === name
      ? {
          ...cost,
          status: "entered" as const,
          method: rate.method,
          amount: String(rate.amount),
          currency: rate.currency,
          exchangeRate:
            rate.currency === localCurrency
              ? "1"
              : String(settings?.defaultExchangeRate ?? 1),
          sourceLabel: `${t("settings.templateCountWord")}: ${rate.name}`,
          rateId: rate.id,
          reason: "",
        }
      : cost
  );
}

export function applyRouteTemplate(args: {
  draft: CargoDraft;
  templates: LogisticsRouteTemplateRow[];
  rates: LogisticsRateRow[];
  settings: SettingsRow | null;
  localCurrency: string;
  t: (key: string) => string;
}): { draft: CargoDraft; applied: boolean } {
  const { draft, templates, rates, settings, localCurrency, t } = args;
  const selected = templates.find(row => row.id === draft.routeTemplateId);
  if (!selected) {
    toast.error(t("cargo.selectRouteTemplateFirst"));
    return { draft, applied: false };
  }
  let next: CargoDraft = {
    ...draft,
    originLocationId: selected.originLocationId,
    unloadingLocationId: selected.unloadingLocationId,
    deliveryLocationId: selected.deliveryLocationId,
    incoterm: selected.incoterm,
    transportMode: selected.transportMode,
  };
  if (selected.incoterm === "CIF") {
    next = {
      ...next,
      costs: next.costs.map(cost =>
        cost.name === FREIGHT_LINE_NAME
          ? {
              ...cost,
              status: "included" as const,
              amount: "0",
              sourceLabel: CIF_INCLUDED_LABEL,
              reason: CIF_INCLUDED_REASON,
            }
          : cost
      ),
    };
  }
  if (selected.freightRateId && selected.incoterm !== "CIF")
    next = {
      ...next,
      costs: applyRateToCosts({
        draft: next,
        name: t("common.internationalfreight"),
        rateId: selected.freightRateId,
        rates,
        settings,
        localCurrency,
        t,
      }),
    };
  if (selected.clearanceFeeRateId)
    next = {
      ...next,
      costs: applyRateToCosts({
        draft: next,
        name: t("cargo.clearanceExpenses"),
        rateId: selected.clearanceFeeRateId,
        rates,
        settings,
        localCurrency,
        t,
      }),
    };
  if (selected.transportRateId)
    next = {
      ...next,
      costs: applyRateToCosts({
        draft: next,
        name: t("cargo.inlandTransport"),
        rateId: selected.transportRateId,
        rates,
        settings,
        localCurrency,
        t,
      }),
    };
  toast.success(t("cargo.templateAppliedReview"));
  return { draft: next, applied: true };
}
