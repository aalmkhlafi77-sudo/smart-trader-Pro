import { Pencil } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import { formatDateTime } from "@/lib/pricing";
import { currencyLabel } from "@/lib/currency";
import type { EntityKind, EntityRow } from "@/lib/db";

const KINDS: { value: EntityKind; labelKey: string }[] = [
  { value: "supplier", labelKey: "entities.kind.supplier" },
  { value: "customer", labelKey: "entities.kind.customer" },
  { value: "factory", labelKey: "entities.kind.factory" },
  { value: "other", labelKey: "entities.kind.other" },
];

/** قيمة العملة الاحتياطية للعرض (رمز ISO منذ S5). */
const FALLBACK_CURRENCY = "USD";

export function EntityViewDialog({
  viewRow,
  linkedCount,
  onClose,
  onEdit,
}: {
  viewRow: EntityRow | null;
  linkedCount: number;
  onClose: () => void;
  onEdit: (row: EntityRow) => void;
}) {
  const { t } = useLanguage();

  const kindLabel = (kind: EntityKind) =>
    t(
      KINDS.find(entry => entry.value === kind)?.labelKey ??
        "entities.kind.other"
    );

  if (!viewRow) return null;

  return (
    <Dialog open={viewRow !== null} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-[var(--ink)]">
            {viewRow.name}
          </DialogTitle>
          <DialogDescription>
            {kindLabel(viewRow.kind)} — {t("common.partnercard")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          {[
            { k: t("entities.country"), v: viewRow.country },
            { k: t("entities.city"), v: viewRow.city },
            { k: t("entities.contact"), v: viewRow.contactPerson },
            { k: t("entities.phone"), v: viewRow.phone, ltr: true },
            { k: t("entities.email"), v: viewRow.email, ltr: true },
            {
              k: t("common.linkeditems"),
              v: String(linkedCount),
              ltr: true,
            },
            {
              k: t("common.purchasesettings"),
              v: `${currencyLabel(viewRow.defaultCurrency ?? FALLBACK_CURRENCY, t)} · ${viewRow.defaultExchangeRate ?? 3.75}`,
              ltr: true,
            },
            {
              k: t("common.lastupdated"),
              v: formatDateTime(viewRow.updatedAt),
              ltr: true,
            },
          ].map(f => (
            <div
              key={f.k}
              className="flex items-center justify-between gap-3 border-b border-border/70 py-1.5"
            >
              <span className="text-xs text-muted-foreground">{f.k}</span>
              <span
                className="text-sm text-[var(--ink)]"
                dir={f.ltr ? "ltr" : undefined}
              >
                {f.v || "—"}
              </span>
            </div>
          ))}

          {viewRow.notes ? (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-1">
                {t("common.notes")}
              </p>
              <p className="rounded bg-secondary/50 px-3 py-2 text-xs">
                {viewRow.notes}
              </p>
            </div>
          ) : null}

          <div className="pt-2">
            <AttachmentsPanel entityId={viewRow.id} compact />
          </div>

          <div className="flex gap-2 pt-3">
            <Button
              className="flex-1"
              onClick={() => {
                onEdit(viewRow);
                onClose();
              }}
            >
              <Pencil className="h-4 w-4" />
              {t("common.edit")}
            </Button>
            <Button variant="outline" className="bg-card" onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
