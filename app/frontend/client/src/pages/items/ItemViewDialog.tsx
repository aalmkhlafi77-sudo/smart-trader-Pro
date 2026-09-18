import { Pencil, Calculator } from "lucide-react";
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
import { formatDateTime, formatMoney } from "@/lib/pricing";
import type { EntityRow, ItemPriceRow, ItemRow, ItemSpecRow, PricingRunRow } from "@/lib/db";

/** عملة عرض تقرير التكلفة (نص عربي مخزَّن) — الترحيل إلى ISO مؤجَّل إلى S5. محمية عبر ALLOW_DEC. */
const REPORT_CURRENCY = "ريال";

export function ItemViewDialog({
  viewItem,
  entities,
  viewSpecs,
  viewPrice,
  viewRun,
  onClose,
  onEdit,
  onCalculate,
}: {
  viewItem: ItemRow | null;
  entities: EntityRow[];
  viewSpecs: ItemSpecRow[];
  viewPrice: ItemPriceRow | null;
  viewRun: PricingRunRow | null;
  onClose: () => void;
  onEdit: (item: ItemRow) => void;
  onCalculate: (item: ItemRow) => void;
}) {
  const { t } = useLanguage();

  if (!viewItem) return null;

  const entity = entities.find(e => e.id === viewItem.entityId);

  return (
    <Dialog open={viewItem !== null} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-[var(--ink)]">
            {viewItem.name}
          </DialogTitle>
          <DialogDescription>
            {viewItem.code ? `[${viewItem.code}] ` : ""}
            {viewItem.category || t("items.generalCategory")} — {entity?.name ?? t("items.noPartner")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* بيانات التوريد */}
          <div className="rounded-md border border-border/70 bg-secondary/30 p-2.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("items.unit")}:</span>
              <span className="font-semibold">{viewItem.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("items.priceCurrency")}:</span>
              <span className="font-semibold text-[var(--port-green)]">
                {viewItem.currency} ({t("items.exchangeShort")}: {viewItem.defaultExchangeRate ?? 3.75})
              </span>
            </div>
            {viewItem.customsRate != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("items.customsRate")}:</span>
                <span className="font-semibold">{(viewItem.customsRate * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>

          {/* المواصفات الفنية */}
          {viewSpecs.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[var(--ink)] mb-1.5">{t("items.specs")}</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {viewSpecs.map(s => (
                  <div
                    key={s.id}
                    className={`rounded border p-1.5 ${
                      s.isKey ? "border-[var(--port-green)]/40 bg-[var(--port-green-soft)]" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{s.label}</span>
                      {s.isKey ? <span className="font-bold text-[var(--port-green)]">{t("items.keySpec")}</span> : null}
                    </div>
                    <p className="font-semibold text-sm mt-0.5 text-[var(--ink)]">
                      {s.value} <span className="text-[10px] font-normal">{s.unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* الأسعار إن وجدت */}
          {viewPrice && (
            <div>
              <h4 className="text-xs font-bold text-[var(--ink)] mb-1.5">{t("prices.title")}</h4>
              <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                {[
                  { p: viewPrice.price1, d: viewPrice.price1Date },
                  { p: viewPrice.price2, d: viewPrice.price2Date },
                  { p: viewPrice.price3, d: viewPrice.price3Date },
                  { p: viewPrice.price4, d: viewPrice.price4Date },
                ].map((lvl, idx) => (
                  <div key={idx} className="rounded border border-border bg-card p-1.5">
                    <span className="text-[10px] text-muted-foreground">{t("prices.price")} {idx + 1}</span>
                    <p className="font-bold text-[var(--ink)] text-xs mt-0.5" dir="ltr">
                      {lvl.p != null ? formatMoney(lvl.p, viewItem.currency) : "—"}
                    </p>
                    {lvl.d && <span className="text-[9px] text-muted-foreground">{lvl.d}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* آخر تسعير محسوب إن وجد */}
          {viewRun && (
            <div className="rounded border border-[var(--port-green)]/40 bg-[var(--port-green-soft)] p-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[var(--port-green)]">{t("items.lastCostCalc")}</span>
                <span className="text-[10px] text-muted-foreground" dir="ltr">
                  {formatDateTime(viewRun.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm font-extrabold text-[var(--ink)]" dir="ltr">
                {t("items.unitCostIs")} {formatMoney(viewRun.unitCost, REPORT_CURRENCY)}
              </p>
            </div>
          )}

          {viewItem.notes && (
            <div className="text-xs">
              <span className="text-muted-foreground">{t("common.notes")}:</span>
              <p className="mt-0.5 rounded bg-secondary/50 p-2 text-xs">{viewItem.notes}</p>
            </div>
          )}

          <AttachmentsPanel itemId={viewItem.id} compact />

          {/* شريط الإجراءات */}
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={() => {
                onEdit(viewItem);
                onClose();
              }}
            >
              <Pencil className="h-4 w-4" />
              {t("items.edit")}
            </Button>
            <Button
              variant="outline"
              className="bg-card"
              onClick={() => {
                onCalculate(viewItem);
                onClose();
              }}
            >
              <Calculator className="h-4 w-4" />
              {t("items.calculateCost")}
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
