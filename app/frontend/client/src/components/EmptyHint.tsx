/** حالة فراغ موحدة — اتجاه التصميم: "دفتر الميناء" */

import { useLanguage } from "@/contexts/LanguageContext";
import { FileQuestion } from "lucide-react";
import type { ReactNode } from "react";

export default function EmptyHint({
  text,
  action,
}: {
  text: string;
  action?: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="ledger-empty flex flex-col items-start gap-3 rounded-[0.45rem] border border-dashed border-border px-4 py-6">
      <span className="ledger-empty-code" data-ui-text>
        {t("common.blankregister")}
      </span>
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileQuestion className="h-4 w-4" />
        <p className="text-sm" data-ui-text>
          {text}
        </p>
      </div>
      <div className="ledger-empty-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      {action}
    </div>
  );
}
