import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemFilterValues } from "./ItemFilters";

export function PriceRanges({
  values,
  onChange,
}: {
  values: ItemFilterValues;
  onChange: (patch: Partial<ItemFilterValues>) => void;
}) {
  const { t } = useLanguage();
  const set = onChange;
  return (
    <div className="mt-3 rounded border border-border bg-secondary/40 p-3">
      <p className="mb-2 text-xs font-semibold text-[var(--ink)]">
        {t("common.pricerangesresults")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: t("common.purchasesupplierprice"),
            min: values.supplierMin,
            max: values.supplierMax,
            setMin: (v: string) => set({ supplierMin: v }),
            setMax: (v: string) => set({ supplierMax: v }),
            suffix: t("common.byitemcurrency"),
          },
          {
            label: t("home.unitCost"),
            min: values.costMin,
            max: values.costMax,
            setMin: (v: string) => set({ costMin: v }),
            setMax: (v: string) => set({ costMax: v }),
            suffix: t("reports.byLastCalc"),
          },
          {
            label: t("common.sellingprice"),
            min: values.saleMin,
            max: values.saleMax,
            setMin: (v: string) => set({ saleMin: v }),
            setMax: (v: string) => set({ saleMax: v }),
            suffix: t("reports.byLastCalc"),
          },
          {
            label: t("common.margin"),
            min: values.marginMin,
            max: values.marginMax,
            setMin: (v: string) => set({ marginMin: v }),
            setMax: (v: string) => set({ marginMax: v }),
            suffix: t("common.percentage"),
          },
        ].map(field => (
          <div key={field.label} className="space-y-1">
            <Label className="text-[11px]">{field.label}</Label>
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                className="field-input"
                dir="ltr"
                inputMode="decimal"
                placeholder={t("entities.of")}
                value={field.min}
                onChange={e => field.setMin(e.target.value)}
              />
              <Input
                className="field-input"
                dir="ltr"
                inputMode="decimal"
                placeholder={t("common.to")}
                value={field.max}
                onChange={e => field.setMax(e.target.value)}
              />
            </div>
            <p className="text-[9px] text-muted-foreground">{field.suffix}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
