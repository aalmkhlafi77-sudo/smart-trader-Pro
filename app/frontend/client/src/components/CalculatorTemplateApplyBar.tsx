import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { db, type CalculatorTemplateRow } from "@/lib/db";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CalculatorTemplateApplyBar({
  mode,
  onApply,
}: {
  mode: "single" | "multi";
  onApply: (template: CalculatorTemplateRow) => void;
}) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<CalculatorTemplateRow[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (typeof indexedDB === "undefined") return;
    void db.listCalculatorTemplates().then(setRows).catch(() => setRows([]));
  }, []);

  const compatible = useMemo(
    () => rows.filter(row => row.scope === "both" || row.scope === mode),
    [rows, mode]
  );

  const apply = () => {
    const row = compatible.find(template => template.id === selectedId);
    if (!row) return;
    onApply(row);
    toast.success(t("calcTemplates.applied"));
  };

  return (
    <div className="flex flex-col gap-2 rounded border border-[var(--port-green)]/25 bg-[var(--port-green)]/5 p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <WandSparkles className="h-4 w-4 shrink-0 text-[var(--port-green)]" />
        <select
          className="field-input min-w-0 flex-1"
          value={selectedId}
          onChange={event => setSelectedId(event.target.value)}
        >
          <option value="">
            {compatible.length ? t("calcTemplates.choose") : t("calcTemplates.noCompatible")}
          </option>
          {compatible.map(row => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={!selectedId} onClick={apply}>
          {t("calcTemplates.apply")}
        </Button>
        <Link href="/settings/calculator-templates">
          <Button type="button" size="sm" variant="outline">
            {t("calcTemplates.manage")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
