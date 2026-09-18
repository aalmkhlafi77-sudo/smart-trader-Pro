import { useLanguage } from "@/contexts/LanguageContext";
import type { CostStageKey } from "@/lib/cargoDecisionReports";
import type { CargoCostLineRow, CargoCostRunRow } from "@/lib/db";
import type { DecisionLabels } from "./decisionExports";

const stagePdfColors: Record<CostStageKey, string> = {
  factory: "#145B8C",
  port: "#2E74B5",
  customs: "#C98517",
  warehouse: "#1F6F54",
  other: "#7655A5",
};

export function useDecisionLabels(): DecisionLabels {
  const { t } = useLanguage();
  return {
    stageMeta: {
      factory: { label: t("common.goodsvalue"), color: "var(--calc-cyan)" },
      port: { label: t("cargo.metaPortShipping"), color: "var(--calc-blue)" },
      customs: { label: t("common.customs"), color: "var(--calc-amber)" },
      warehouse: {
        label: t("cargo.metaDeliveryTransport"),
        color: "var(--calc-green)",
      },
      other: { label: t("common.otherexpenses"), color: "var(--calc-purple)" },
    },
    statusLabel: {
      draft: t("cargo.statusDraft"),
      review: t("cargo.statusReview"),
      approved: t("cargo.statusApproved"),
      archived: t("cargo.statusArchived"),
    } as Record<CargoCostRunRow["status"], string>,
    costStatusLabel: {
      entered: t("cargo.costStatusEntered"),
      included: t("cargo.included"),
      "third-party": t("cargo.costStatusThirdParty"),
      missing: t("cargo.needsPricing"),
      disabled: t("cargo.costStatusDisabled"),
    } as Record<CargoCostLineRow["status"], string>,
    stagePdfColors,
  };
}
