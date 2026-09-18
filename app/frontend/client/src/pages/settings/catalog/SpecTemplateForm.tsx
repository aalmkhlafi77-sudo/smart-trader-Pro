import { Eye, FileSpreadsheet, LayoutList, RotateCcw, Save, Star, Tags } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Field, FormGrid, SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryRow } from "@/lib/db";

export interface SpecTemplateDraft {
  category: string;
  label: string;
  defaultUnit: string;
  unitOptions: string;
  placeholder: string;
  isKeyDefault: boolean;
  showInItem: boolean;
  showInPrices: boolean;
  showInReports: boolean;
  showInExport: boolean;
}

export const emptyTemplateDraft: SpecTemplateDraft = {
  category: "",
  label: "",
  defaultUnit: "",
  unitOptions: "",
  placeholder: "",
  isKeyDefault: true,
  showInItem: true,
  showInPrices: true,
  showInReports: true,
  showInExport: true,
};

export function SpecTemplateForm({
  categories,
  draft,
  setDraft,
  editingId,
  onSave,
  onReset,
}: {
  categories: CategoryRow[];
  draft: SpecTemplateDraft;
  setDraft: (d: SpecTemplateDraft) => void;
  editingId: string | null;
  onSave: () => void;
  onReset: () => void;
}) {
  const { t } = useLanguage();

  const toggles = [
    { key: "isKeyDefault" as const, label: t("common.keyforcomparison"), Icon: Star },
    { key: "showInItem" as const, label: t("common.itemcard"), Icon: LayoutList },
    { key: "showInPrices" as const, label: t("common.pricetable"), Icon: Tags },
    { key: "showInReports" as const, label: t("common.reports"), Icon: Eye },
    { key: "showInExport" as const, label: t("common.excelexport"), Icon: FileSpreadsheet },
  ];

  return (
    <SectionCard
      title={
        editingId
          ? t("settings.editSpecTemplate")
          : t("common.addtechnicalspecificatio")
      }
      description={t("settings.specFieldsHint")}
      stamp={t("common.details")}
    >
      <div className="space-y-3">
        <FormGrid cols={2}>
          <Field
            label={t("common.linkedcategory")}
            control={
              <Select
                value={draft.category || "__all__"}
                onValueChange={v =>
                  setDraft({ ...draft, category: v === "__all__" ? "" : v })
                }
              >
                <SelectTrigger className="field-input w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    {t("common.generaltemplateforallcat")}
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
            label={t("common.specificationname")}
            control={
              <Input
                className="field-input"
                placeholder={t("settings.specNamePlaceholder")}
                value={draft.label}
                onChange={e => setDraft({ ...draft, label: e.target.value })}
              />
            }
          />
          <Field
            label={t("common.defaultunit")}
            control={
              <Input
                className="field-input"
                placeholder={t("settings.specUnitPlaceholder")}
                value={draft.defaultUnit}
                onChange={e => setDraft({ ...draft, defaultUnit: e.target.value })}
              />
            }
          />
          <Field
            label={t("common.inputhint")}
            control={
              <Input
                className="field-input"
                placeholder={t("settings.specPlaceholderPlaceholder")}
                value={draft.placeholder}
                onChange={e => setDraft({ ...draft, placeholder: e.target.value })}
              />
            }
          />
        </FormGrid>
        <Field
          label={t("common.availableunits")}
          hint={`${t("settings.specUnitsHint")}.`}
          control={
            <Input
              className="field-input"
              placeholder={t("settings.specUnitsPlaceholder")}
              value={draft.unitOptions}
              onChange={e => setDraft({ ...draft, unitOptions: e.target.value })}
            />
          }
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {toggles.map(({ key, label, Icon }) => (
            <Button
              key={key}
              type="button"
              variant={draft[key] ? "default" : "outline"}
              className={draft[key] ? "justify-start" : "justify-start bg-card"}
              onClick={() => setDraft({ ...draft, [key]: !draft[key] })}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[11px]">{label}</span>
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={onSave} className="flex-1">
            <Save className="h-4 w-4" />
            {editingId ? t("followup.updateTask") : t("common.addspecification")}
          </Button>
          {editingId ? (
            <Button variant="outline" className="bg-card" onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
              {t("common.cancel")}
            </Button>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
