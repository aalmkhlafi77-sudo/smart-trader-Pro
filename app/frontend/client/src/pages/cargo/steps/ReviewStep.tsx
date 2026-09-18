import { useLanguage } from "@/contexts/LanguageContext";
import { Field, SectionCard, StatusPill } from "@/components/patterns";
import { Textarea } from "@/components/ui/textarea";
import type { CargoCheck, CargoDraft } from "../shared";

export function ReviewStep({
  draft,
  checks,
  itemCount,
  missingItemCount,
  missingCostCount,
  isCif,
  onUpdateDraft,
}: {
  draft: CargoDraft;
  checks: CargoCheck[];
  itemCount: number;
  missingItemCount: number;
  missingCostCount: number;
  isCif: boolean;
  onUpdateDraft: (patch: Partial<CargoDraft>) => void;
}) {
  const { t } = useLanguage();

  return (
    <SectionCard
      title={t("cargo.stepReview")}
      description={t("cargo.stepReviewHint")}
      stamp={t("cargo.stepStampReview")}
    >
      <div className="space-y-3">
        <div className="rounded border border-border bg-secondary/35 p-3 text-sm">
          <p className="font-semibold text-[var(--ink)]">
            {t("cargo.readinessSummary")}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li>
              {itemCount} {t("cargo.itemsInLoad")}
            </li>
            <li>
              {missingItemCount
                ? `${missingItemCount} ${t("cargo.itemNeedsCompletion")}`
                : t("cargo.itemsReady")}
            </li>
            <li>
              {missingCostCount
                ? `${missingCostCount} ${t("cargo.expenseNeedsAmount")}`
                : t("cargo.allExpensesSet")}
            </li>
            <li>{isCif ? t("cargo.cifNote") : t("cargo.servicePricesNote")}</li>
          </ul>
        </div>

        <div className="rounded border border-border bg-card p-3">
          <p className="mb-2 text-xs font-bold text-[var(--ink)]">
            {t("cargo.checklistTitle")}
          </p>
          <ul className="space-y-1.5">
            {checks.map(check => (
              <li
                key={check.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-muted-foreground">{t(check.labelKey)}</span>
                <StatusPill
                  tone={check.ok ? "success" : check.warnOnly ? "warning" : "danger"}
                >
                  {check.ok
                    ? t("cargo.checkOk")
                    : check.warnOnly
                      ? t("cargo.checkWarn")
                      : t("cargo.checkFail")}
                </StatusPill>
              </li>
            ))}
          </ul>
        </div>

        <Field
          label={t("cargo.fileNotes")}
          control={
            <Textarea
              className="field-input min-h-28"
              value={draft.notes}
              onChange={event => onUpdateDraft({ notes: event.target.value })}
              placeholder={t("cargo.referenceNotes")}
            />
          }
        />
      </div>
    </SectionCard>
  );
}
