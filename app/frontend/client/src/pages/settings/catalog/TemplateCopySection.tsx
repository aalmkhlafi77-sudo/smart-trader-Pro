import { Copy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Field, FormGrid, SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryRow } from "@/lib/db";

export function TemplateCopySection({
  categories,
  source,
  setSource,
  target,
  setTarget,
  onCopy,
}: {
  categories: CategoryRow[];
  source: string;
  setSource: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  onCopy: () => void;
}) {
  const { t } = useLanguage();

  return (
    <SectionCard
      title={t("common.copytemplatesbetweencate")}
      description={t("settings.copyTemplatesHint")}
      stamp={t("common.details")}
    >
      <div className="space-y-3">
        <p className="text-[10px] text-muted-foreground">
          {t("common.copyunitsorderanddisplay")}.
        </p>
        <FormGrid cols={2}>
          <Field
            label={t("common.source")}
            control={
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="field-input w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    {t("common.generaltemplates")}
                  </SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <Field
            label={t("common.targetcategory")}
            control={
              <Select
                value={target}
                onValueChange={setTarget}
                disabled={categories.length === 0}
              >
                <SelectTrigger className="field-input w-full">
                  <SelectValue placeholder={t("common.selectcategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </FormGrid>
        <Button
          className="w-full"
          variant="outline"
          disabled={categories.length === 0}
          onClick={onCopy}
        >
          <Copy className="h-4 w-4" />
          {t("common.copytemplates")}
        </Button>
      </div>
    </SectionCard>
  );
}
