import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import type { SpecTemplateRow } from "@/lib/db";

export function SpecTemplatesTable({
  templates,
  onEdit,
  onDelete,
  onMove,
}: {
  templates: SpecTemplateRow[];
  onEdit: (template: SpecTemplateRow) => void;
  onDelete: (template: SpecTemplateRow) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  const { t } = useLanguage();

  return (
    <SectionCard
      title={t("settings.savedTemplatesRegister")}
      description={t("settings.templatesRegisterHint")}
      stamp={`${templates.length} ${t("settings.templateCountWord")}`}
    >
      {templates.length === 0 ? (
        <div className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          {t("settings.noSpecTemplates")}.
        </div>
      ) : (
        <ul className="overflow-hidden rounded border border-border bg-card">
          {templates.map((template, index) => (
            <li
              key={template.id}
              className="border-b border-border p-2.5 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {template.label}{" "}
                    {template.defaultUnit ? (
                      <span className="text-[11px] font-normal text-muted-foreground">
                        ({template.defaultUnit})
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {template.category
                      ? `${t("settings.categoryLabel")}: ${template.category}`
                      : t("settings.generalTemplate")}
                    {template.unitOptions
                      ? ` · ${t("settings.unitsLabel")}: ${template.unitOptions.split("|").join(t("common.listSeparator"))}`
                      : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {template.isKeyDefault === 1 ? (
                      <span className="rounded bg-[var(--port-green-soft)] px-1.5 py-0.5 text-[9px] text-[var(--ink)]">
                        {t("settings.compareLabel")}
                      </span>
                    ) : null}
                    {template.showInItem === 1 ? (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px]">
                        {t("common.item")}
                      </span>
                    ) : null}
                    {template.showInPrices === 1 ? (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px]">
                        {t("nav.prices")}
                      </span>
                    ) : null}
                    {template.showInReports === 1 ? (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px]">
                        {t("common.reports")}
                      </span>
                    ) : null}
                    {template.showInExport === 1 ? (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px]">
                        {t("settings.exportLabel")}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={index === 0}
                    title={t("common.moveup")}
                    onClick={() => onMove(template.id, -1)}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={index === templates.length - 1}
                    title={t("common.movedown")}
                    onClick={() => onMove(template.id, 1)}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title={t("common.edit")}
                    onClick={() => onEdit(template)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    title={t("common.delete")}
                    onClick={() => onDelete(template)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {t("settings.hideTemplateNote")}.
      </p>
    </SectionCard>
  );
}
