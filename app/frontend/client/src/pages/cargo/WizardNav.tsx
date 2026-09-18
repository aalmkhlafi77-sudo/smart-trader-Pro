import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

export function WizardNav({
  step,
  lastStep,
  nextBlocked,
  canApprove,
  hasItems,
  onPrev,
  onNext,
  onSaveDraft,
  onApprove,
}: {
  step: number;
  lastStep: number;
  nextBlocked: boolean;
  canApprove: boolean;
  hasItems: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  onApprove: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap justify-between gap-2 rounded border border-border bg-card p-3">
      <Button
        type="button"
        variant="outline"
        className="bg-card"
        disabled={step === 0}
        onClick={onPrev}
      >
        <ArrowRight className="h-4 w-4" />
        {t("cargo.previous")}
      </Button>
      <div className="flex flex-wrap gap-2">
        {step < lastStep ? (
          <Button
            type="button"
            disabled={nextBlocked}
            title={nextBlocked ? t("cargo.approveBlockedHint") : undefined}
            onClick={onNext}
          >
            {t("cargo.next")}
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="bg-card"
          onClick={onSaveDraft}
        >
          <Save className="h-4 w-4" />
          {t("cargo.saveDraft")}
        </Button>
        <Button
          type="button"
          disabled={!hasItems || !canApprove}
          title={canApprove ? undefined : t("cargo.approveBlockedHint")}
          onClick={onApprove}
        >
          <Check className="h-4 w-4" />
          {t("cargo.approveAndSave")}
        </Button>
      </div>
    </div>
  );
}
