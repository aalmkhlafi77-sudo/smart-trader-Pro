import { FilePlus2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CargoDraft, OperationType } from "./shared";

export function FileHeader({
  draft,
  localCurrency,
  onUpdateDraft,
  onNewWork,
}: {
  draft: CargoDraft;
  localCurrency: string;
  onUpdateDraft: (patch: Partial<CargoDraft>) => void;
  onNewWork: () => void;
}) {
  const { t } = useLanguage();

  return (
    <SectionCard
      title={draft.name || t("cargo.newCostFileTitle")}
      hint={
        draft.runId
          ? `${t("cargo.versionWord")} ${draft.version} · ${draft.status === "approved" ? t("cargo.statusApproved") : t("cargo.statusDraft")}`
          : t("cargo.localDraftHint")
      }
      stamp={t("nav.cargo")}
      action={
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-card"
          onClick={onNewWork}
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          {t("common.newWork")}
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            className="field-input sm:col-span-2"
            value={draft.name}
            onChange={event => onUpdateDraft({ name: event.target.value })}
            placeholder={t("cargo.fileNameExample")}
          />
          <Input
            className="field-input"
            value={draft.reference}
            onChange={event => onUpdateDraft({ reference: event.target.value })}
            placeholder={t("cargo.referenceOrInvoice")}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="field-input min-h-11"
            value={draft.operationType}
            onChange={event =>
              onUpdateDraft({
                operationType: event.target.value as OperationType,
              })
            }
          >
            <option value="import">{t("cargo.importWord")}</option>
            <option value="local">{t("cargo.localPurchase")}</option>
          </select>
          <span
            className="flex min-h-11 items-center rounded border border-border bg-secondary/45 px-3 text-xs font-semibold text-[var(--ink)]"
            dir="ltr"
          >
            {localCurrency}
          </span>
        </div>
      </div>
    </SectionCard>
  );
}
