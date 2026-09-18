import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import FloatingCalculatorSettingsCard from "@/components/FloatingCalculatorSettingsCard";
import LoginBackgroundSettingsCard from "@/components/LoginBackgroundSettingsCard";
import WorkspaceCustomizationCard from "@/components/WorkspaceCustomizationCard";
import { Field, PageShell, SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function SettingsWorkspace() {
  const { language, setLanguage, t } = useLanguage();
  const { theme } = useTheme();
  const [deviceLanguage, setDeviceLanguage] = useState(language);

  useEffect(() => {
    setDeviceLanguage(language);
  }, [language]);

  const saveDeviceLanguage = () => {
    setLanguage(deviceLanguage);
    toast.success(t("settings.defaultLanguageSaved"));
  };

  return (
    <AppLayout title={t("settings.workspaceTitle")} subtitle={t("settings.workspaceHint")}>
      <PageShell
        title={t("settings.workspaceTitle")}
        description={t("settings.workspaceHint")}
        crumbs={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("settings.title"), href: "/settings" },
          { label: t("settings.workspaceTitle") },
        ]}
      >
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <div className="space-y-5">
            <SectionCard
              title={t("settings.defaultLanguageTitle")}
              description={t("settings.defaultLanguageHint")}
              stamp={t("settings.language")}
              footer={
                <Button type="button" className="w-full" onClick={saveDeviceLanguage}>
                  <Save className="h-4 w-4" />
                  {t("settings.saveDefaultLanguage")}
                </Button>
              }
            >
              <Field
                label={t("settings.defaultLanguageLabel")}
                control={
                  <Select
                    value={deviceLanguage}
                    onValueChange={v => setDeviceLanguage(v as typeof language)}
                  >
                    <SelectTrigger className="field-input w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ar">{t("settings.langArabic")}</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="tr">Türkçe</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
            </SectionCard>

            <SectionCard
              title={t("settings.themeTitle")}
              description={t("settings.themeFixedNote")}
              stamp={t("common.preview")}
            >
              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                <span className="text-xs font-semibold text-[var(--ink)]">
                  {t("settings.themeTitle")}
                </span>
                <span className="ledger-figure text-sm" dir="ltr">
                  {theme}
                </span>
              </div>
            </SectionCard>

            <FloatingCalculatorSettingsCard />
          </div>
          <div className="space-y-5">
            <WorkspaceCustomizationCard />
            <LoginBackgroundSettingsCard />
          </div>
        </div>
      </PageShell>
    </AppLayout>
  );
}
