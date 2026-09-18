import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  Field,
  FormGrid,
  NumberField,
  PageShell,
  RateField,
  SectionCard,
} from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { db } from "@/lib/db";
import { currencyLabel } from "@/lib/currency";
import { financialDefaultsSchema } from "@/lib/validation/schemas";
import { CurrencySelect } from "./financial/CurrencySelect";
import { nowIso } from "@/lib/id";
import { parseNumber } from "@/lib/pricing";
import { SamplePreview } from "./financial/SamplePreview";

/** العملات المخزَّنة برموز ISO (منذ S5) — "دينار" القديمة الغامضة أُسقطت من الخيارات مع بقاء قراءتها. */
const FINANCE_DATA = {
  localOptions: ["SAR", "AED", "EGP"],
  foreignOptions: ["USD", "EUR", "CNY", "INR"],
  fallbackLocal: "SAR",
  fallbackForeign: "USD",
};

export default function SettingsFinancial() {
  const { t } = useLanguage();
  const [localCurrency, setLocalCurrency] = useState(FINANCE_DATA.fallbackLocal);
  const [foreignCurrency, setForeignCurrency] = useState(FINANCE_DATA.fallbackForeign);
  const [localOptions, setLocalOptions] = useState<string[]>(FINANCE_DATA.localOptions);
  const [foreignOptions, setForeignOptions] = useState<string[]>(FINANCE_DATA.foreignOptions);
  const [addingLocal, setAddingLocal] = useState(false);
  const [addingForeign, setAddingForeign] = useState(false);
  const [newLocal, setNewLocal] = useState("");
  const [newForeign, setNewForeign] = useState("");
  const [rate, setRate] = useState("3.75");
  const [customs, setCustoms] = useState("12");
  const [margin, setMargin] = useState("20");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const s = await db.getSettings();
      if (cancelled) return;
      setLocalCurrency(s.localCurrency);
      setForeignCurrency(s.foreignCurrency);
      setLocalOptions(prev => Array.from(new Set([...prev, s.localCurrency])));
      setForeignOptions(prev => Array.from(new Set([...prev, s.foreignCurrency])));
      setRate(String(s.defaultExchangeRate));
      setCustoms(String(Math.round(s.defaultCustomsRate * 100)));
      setMargin(String(Math.round(s.defaultMarginRate * 100)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addOption = (kind: "local" | "foreign") => {
    const v = (kind === "local" ? newLocal : newForeign).trim();
    if (!v) return;
    if (kind === "local") {
      setLocalOptions(p => Array.from(new Set([...p, v])));
      setLocalCurrency(v);
      setNewLocal("");
      setAddingLocal(false);
    } else {
      setForeignOptions(p => Array.from(new Set([...p, v])));
      setForeignCurrency(v);
      setNewForeign("");
      setAddingForeign(false);
    }
  };

  const saveCurrencies = async () => {
    const s = await db.getSettings();
    await db.saveSettings({
      ...s,
      localCurrency: localCurrency.trim() || FINANCE_DATA.fallbackLocal,
      foreignCurrency: foreignCurrency.trim() || FINANCE_DATA.fallbackForeign,
      updatedAt: nowIso(),
    });
    window.dispatchEvent(new Event("smart-trader:activity-updated"));
    toast.success(t("common.settingssavedonyourdevic"));
  };

  const saveDefaults = async () => {
    const parsed = financialDefaultsSchema(t).safeParse({ rate, customs, margin });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    const rateVal = parseNumber(rate);
    const s = await db.getSettings();
    await db.saveSettings({
      ...s,
      defaultExchangeRate: rateVal,
      defaultCustomsRate: parseNumber(customs) / 100,
      defaultMarginRate: parseNumber(margin) / 100,
      updatedAt: nowIso(),
    });
    window.dispatchEvent(new Event("smart-trader:activity-updated"));
    toast.success(t("common.settingssavedonyourdevic"));
  };

  const restore = () => {
    setLocalCurrency(FINANCE_DATA.fallbackLocal);
    setForeignCurrency(FINANCE_DATA.fallbackForeign);
    setRate("3.75");
    setCustoms("12");
    setMargin("20");
    toast.info(t("common.initialvaluesrestoredsav"));
  };

  return (
    <AppLayout title={t("settings.financialTitle")} subtitle={t("settings.financialHint")}>
      <PageShell
        title={t("settings.financialTitle")}
        description={t("settings.financialHint")}
        crumbs={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("settings.title"), href: "/settings" },
          { label: t("settings.financialTitle") },
        ]}
      >
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <div className="space-y-5">
            <SectionCard
              title={t("common.currencies")}
              description={t("common.thelocalcurrencyisforcos")}
              stamp={t("common.conversionbasis")}
              footer={
                <Button onClick={() => void saveCurrencies()} className="w-full">
                  <Save className="h-4 w-4" />
                  {t("common.savesettings")}
                </Button>
              }
            >
              <FormGrid cols={2}>
                <CurrencySelect
                  kind="local"
                  label={t("common.localcurrency")}
                  value={localCurrency}
                  setValue={setLocalCurrency}
                  options={localOptions}
                  adding={addingLocal}
                  setAdding={setAddingLocal}
                  draft={newLocal}
                  setDraft={setNewLocal}
                  onAddOption={addOption}
                />
                <CurrencySelect
                  kind="foreign"
                  label={t("common.foreigncurrency")}
                  value={foreignCurrency}
                  setValue={setForeignCurrency}
                  options={foreignOptions}
                  adding={addingForeign}
                  setAdding={setAddingForeign}
                  draft={newForeign}
                  setDraft={setNewForeign}
                  onAddOption={addOption}
                />
              </FormGrid>
            </SectionCard>

            <SectionCard
              title={t("common.defaultcalculationvalues")}
              description={t("common.loadedautomaticallywheno")}
              stamp={t("common.calculationconstants")}
              footer={
                <div className="flex gap-2">
                  <Button onClick={() => void saveDefaults()} className="flex-1">
                    <Save className="h-4 w-4" />
                    {t("common.savesettings")}
                  </Button>
                  <Button variant="outline" className="bg-card" onClick={restore}>
                    <RotateCcw className="h-4 w-4" />
                    {t("common.initialvalues")}
                  </Button>
                </div>
              }
            >
              <div className="space-y-3">
                <Field
                  label={`${t("common.exchangeRate")} (${currencyLabel(foreignCurrency, t)} ${t("common.to")} ${currencyLabel(localCurrency, t)})`}
                  hint={t("settings.useRate")}
                  error={errors.rate}
                  control={
                    <NumberField
                      value={rate}
                      onChange={e => setRate(e.target.value)}
                    />
                  }
                />
                <FormGrid cols={2}>
                  <Field
                    label={`${t("settings.customsRate")} %`}
                    hint={t("prices.customsRateHint")}
                    error={errors.customs}
                    control={
                      <RateField
                        value={customs}
                        onChange={e => setCustoms(e.target.value)}
                      />
                    }
                  />
                  <Field
                    label={`${t("settings.profitMargin")} %`}
                    hint={t("settings.useMargin")}
                    error={errors.margin}
                    control={
                      <RateField
                        value={margin}
                        onChange={e => setMargin(e.target.value)}
                      />
                    }
                  />
                </FormGrid>
              </div>
            </SectionCard>
          </div>

          <SamplePreview
            rate={rate}
            customs={customs}
            margin={margin}
            localCurrency={localCurrency}
          />
        </div>
      </PageShell>
    </AppLayout>
  );
}
