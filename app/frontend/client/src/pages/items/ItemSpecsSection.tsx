import { Plus, X, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { FormSection, StatusPill } from "@/components/patterns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SpecTemplateRow } from "@/lib/db";
import type { SpecDraft } from "./ItemForm";

export function ItemSpecsSection({
  specs,
  setSpecs,
  category,
  specTemplates,
  onAddSpec,
  onToggleKey,
}: {
  specs: SpecDraft[];
  setSpecs: React.Dispatch<React.SetStateAction<SpecDraft[]>>;
  category: string;
  specTemplates: SpecTemplateRow[];
  onAddSpec: (tpl?: SpecTemplateRow) => void;
  onToggleKey: (id: string) => void;
}) {
  const { t } = useLanguage();

  const unusedTemplates = specTemplates.filter(
    tpl =>
      (tpl.category === "" || tpl.category === category) &&
      !specs.some(s => s.label === tpl.label)
  );

  return (
    <FormSection
      title={t("items.specs")}
      note={t("common.addonlythespecifications")}
    >
      <div className="space-y-2">
        {specs.map(s => (
          <div
            key={s.id}
            className="flex items-center gap-2 rounded-md border border-border/80 bg-card p-2 text-xs"
          >
            <button
              type="button"
              onClick={() => onToggleKey(s.id)}
              className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                s.isKey
                  ? "bg-[var(--port-green)] text-white"
                  : "bg-secondary text-muted-foreground hover:text-[var(--ink)]"
              }`}
              title={s.isKey ? t("items.keySpecOn") : t("items.makeKeySpec")}
            >
              <Star className={`h-3 w-3 ${s.isKey ? "fill-white" : ""}`} />
              {s.isKey ? t("items.keySpec") : t("items.standardSpec")}
            </button>
            <span className="w-24 shrink-0 font-semibold truncate text-[var(--ink)]">
              {s.label}
            </span>
            <Input
              className="field-input h-8 text-xs flex-1 min-w-0"
              value={s.value}
              onChange={e =>
                setSpecs(prev =>
                  prev.map(x => (x.id === s.id ? { ...x, value: e.target.value } : x))
                )
              }
              placeholder={s.placeholder}
            />
            <span className="text-[10px] text-muted-foreground shrink-0">
              {s.unit}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => setSpecs(prev => prev.filter(x => x.id !== s.id))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {unusedTemplates.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-muted-foreground">{t("items.suggestedTemplates")}</span>
            {unusedTemplates.slice(0, 4).map(tpl => (
              <Button
                key={tpl.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => onAddSpec(tpl)}
              >
                <Plus className="h-2.5 w-2.5 mr-0.5" />
                {tpl.label}
                {tpl.isKeyDefault === 1 && (
                    <StatusPill tone="success" className="ml-1 py-0 px-1 text-[8px]">
                      {t("items.keySpec")}
                    </StatusPill>
                )}
              </Button>
            ))}
          </div>
        )}
      </div>
    </FormSection>
  );
}
