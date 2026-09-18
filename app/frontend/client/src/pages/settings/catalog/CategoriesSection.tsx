import { useState } from "react";
import { Plus, Tags, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CategoryRow } from "@/lib/db";

export function CategoriesSection({
  categories,
  onAdd,
  onDelete,
}: {
  categories: CategoryRow[];
  onAdd: (name: string) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState("");

  const add = async () => {
    if (await onAdd(draft.trim())) setDraft("");
  };

  return (
    <SectionCard
      title={t("common.maincategories")}
      description={t("common.shownasadropdownintheite")}
      stamp={t("common.categoryindex")}
    >
      <div className="space-y-3">
        <div className="flex gap-1.5">
          <Input
            className="field-input flex-1"
            placeholder={t("settings.categoryPlaceholder")}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") void add();
            }}
          />
          <Button onClick={() => void add()} className="shrink-0">
            <Plus className="h-4 w-4" />
            {t("common.add")}
          </Button>
        </div>
        {categories.length === 0 ? (
          <div className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            {t("settings.noCategories")}.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded border border-border bg-card">
            {categories.map(c => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Tags className="h-3.5 w-3.5 text-[var(--ink)]/60" />
                  {c.name}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => onDelete(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground">
          {t("settings.deleteCategoryNote")}.
        </p>
      </div>
    </SectionCard>
  );
}
