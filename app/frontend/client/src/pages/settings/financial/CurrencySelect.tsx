import { useLanguage } from "@/contexts/LanguageContext";
import { Field } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save } from "lucide-react";
import { currencyLabel } from "@/lib/currency";

export function CurrencySelect({
  kind,
  label,
  value,
  setValue,
  options,
  adding,
  setAdding,
  draft,
  setDraft,
  onAddOption,
}: {
  kind: "local" | "foreign";
  label: string;
  value: string;
  setValue: (v: string) => void;
  options: string[];
  adding: boolean;
  setAdding: (v: boolean) => void;
  draft: string;
  setDraft: (v: string) => void;
  onAddOption: (kind: "local" | "foreign") => void;
}) {
  const { t } = useLanguage();

  return (
    <Field
      label={label}
      control={
        adding ? (
          <div className="flex gap-1.5">
            <Input
              className="field-input flex-1"
              autoFocus
              placeholder={t("settings.currencyName")}
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <Button
              size="icon"
              variant="outline"
              className="bg-card shrink-0"
              onClick={() => onAddOption(kind)}
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Select
            value={value}
            onValueChange={v => (v === "__new__" ? setAdding(true) : setValue(v))}
          >
            <SelectTrigger className="field-input w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(c => (
                <SelectItem key={c} value={c}>
                  {currencyLabel(c, t)}
                </SelectItem>
              ))}
              <SelectItem value="__new__">
                + {t("common.addanothercurrency")}
              </SelectItem>
            </SelectContent>
          </Select>
        )
      }
    />
  );
}
