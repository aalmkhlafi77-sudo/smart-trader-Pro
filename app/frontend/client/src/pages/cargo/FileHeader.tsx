import { useState } from "react";
import { FilePlus2, FolderOpen, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { ConfirmDialog } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currencyLabel } from "@/lib/currency";
import type { CargoCostRunRow, CargoRunStatus } from "@/lib/db";
import type { CargoDraft, OperationType } from "./shared";

const STATUS_KEY: Record<CargoRunStatus, string> = {
  draft: "cargo.statusDraft",
  review: "cargo.statusReview",
  approved: "cargo.statusApproved",
  archived: "cargo.statusArchived",
};

export function FileHeader({
  draft,
  localCurrency,
  onUpdateDraft,
  onNewWork,
  runs,
  onOpenRun,
  onDeleteRun,
}: {
  draft: CargoDraft;
  localCurrency: string;
  onUpdateDraft: (patch: Partial<CargoDraft>) => void;
  onNewWork: () => void;
  runs: CargoCostRunRow[];
  onOpenRun: (id: string) => void;
  onDeleteRun: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [pendingDelete, setPendingDelete] = useState<CargoCostRunRow | null>(null);
  const activeRun = runs.find(r => r.id === draft.runId) ?? null;

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
            {currencyLabel(localCurrency, t)}
          </span>
        </div>
      </div>
      {runs.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-border/70 bg-secondary/30 p-2.5">
          <div className="min-w-[200px] flex-1 space-y-1">
            <span className="text-[11px] font-semibold text-[var(--ink)]">
              {t("cargo.runsTitle")}
            </span>
            <Select
              value={draft.runId || "__none__"}
              onValueChange={v => {
                if (v !== "__none__") onOpenRun(v);
              }}
            >
              <SelectTrigger className="field-input w-full bg-card">
                <SelectValue placeholder={t("cargo.runsEmpty")} />
              </SelectTrigger>
              <SelectContent>
                {runs.map(run => (
                  <SelectItem key={run.id} value={run.id}>
                    {run.name || run.reference || run.id} · {t(STATUS_KEY[run.status])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="bg-card min-h-11"
            disabled={!activeRun}
            onClick={() => activeRun && onOpenRun(activeRun.id)}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {t("cargo.runsOpen")}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="min-h-11 w-11 text-destructive hover:text-destructive"
            title={t("cargo.deleteRun")}
            disabled={!activeRun}
            onClick={() => activeRun && setPendingDelete(activeRun)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={v => !v && setPendingDelete(null)}
        title={t("cargo.deleteRun")}
        description={
          pendingDelete
            ? `${pendingDelete.name || pendingDelete.reference} — ${t("cargo.deleteRunConfirm")}`
            : undefined
        }
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          if (pendingDelete) onDeleteRun(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </SectionCard>
  );
}
