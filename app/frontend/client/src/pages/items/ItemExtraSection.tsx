import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Field } from "@/components/patterns";
import { Textarea } from "@/components/ui/textarea";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import type { UseFormRegister } from "react-hook-form";
import type { ItemFormData } from "./ItemForm";

/** 7. (قسم قابل للطي) ملاحظات · مرفقات */
export function ItemExtraSection({
  register,
  editingId,
  onAttachmentsChanged,
}: {
  register: UseFormRegister<ItemFormData>;
  editingId: string | null;
  onAttachmentsChanged?: () => void;
}) {
  const { t } = useLanguage();
  const [showExtra, setShowExtra] = useState(false);

  return (
    <div className="rounded-md border border-border/80 bg-secondary/20 p-3">
      <button
        type="button"
        onClick={() => setShowExtra(v => !v)}
        className="flex w-full items-center justify-between text-xs font-semibold text-[var(--ink)]"
      >
        <span>{t("common.extraDetails")}</span>
        {showExtra ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {showExtra && (
        <div className="mt-3 space-y-3 pt-2 border-t border-border/60">
          <Field
            label={t("common.notes")}
            htmlFor="item-notes"
            control={
              <Textarea
                id="item-notes"
                className="field-input min-h-20"
                {...register("notes")}
              />
            }
          />
          {editingId && (
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-[var(--ink)]">{t("common.attachments")}</span>
              <AttachmentsPanel itemId={editingId} compact onChanged={onAttachmentsChanged} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
