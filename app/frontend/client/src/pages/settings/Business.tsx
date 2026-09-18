import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  Field,
  FormSection,
  PageShell,
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
import { nowIso } from "@/lib/id";

const ACTIVITIES = [
  "import-export",
  "wholesale",
  "retail",
  "manufacturing",
  "logistics",
  "custom",
];

export default function SettingsBusiness() {
  const { t } = useLanguage();
  const [companyName, setCompanyName] = useState("");
  const [mainActivity, setMainActivity] = useState("import-export");
  const [customActivity, setCustomActivity] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const s = await db.getSettings();
      if (cancelled) return;
      setCompanyName(s.companyName);
      setMainActivity(s.mainActivity ?? "import-export");
      setCustomActivity(s.customActivity ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveCompany = async () => {
    const s = await db.getSettings();
    await db.saveSettings({
      ...s,
      companyName: companyName.trim(),
      updatedAt: nowIso(),
    });
    toast.success(t("common.settingssavedonyourdevic"));
  };

  const saveActivity = async () => {
    const s = await db.getSettings();
    await db.saveSettings({
      ...s,
      mainActivity,
      customActivity: customActivity.trim(),
      updatedAt: nowIso(),
    });
    toast.success(t("common.settingssavedonyourdevic"));
  };

  return (
    <AppLayout title={t("settings.businessTitle")} subtitle={t("settings.businessNameHint")}>
      <PageShell
        title={t("settings.businessTitle")}
        description={t("settings.businessNameHint")}
        crumbs={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("settings.title"), href: "/settings" },
          { label: t("settings.businessTitle") },
        ]}
      >
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <SectionCard
            title={t("common.businessdetails")}
            description={t("common.thenameappearsinexported")}
            stamp={t("common.ledgeridentity")}
            footer={
              <Button onClick={() => void saveCompany()} className="w-full">
                <Save className="h-4 w-4" />
                {t("common.savesettings")}
              </Button>
            }
          >
            <Field
              label={t("common.businessname")}
              hint={t("common.leaveemptyifyoudonotwant")}
              control={
                <Input
                  className="field-input"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder={t("settings.businessNamePlaceholder")}
                />
              }
            />
          </SectionCard>

          <SectionCard
            title={t("activity.title")}
            description={t("activity.hint")}
            stamp={t("activity.stamp")}
            footer={
              <Button onClick={() => void saveActivity()} className="w-full">
                <Save className="h-4 w-4" />
                {t("common.savesettings")}
              </Button>
            }
          >
            <FormSection>
              <Field
                label={t("activity.label")}
                control={
                  <Select value={mainActivity} onValueChange={setMainActivity}>
                    <SelectTrigger className="field-input w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITIES.map(a => (
                        <SelectItem key={a} value={a}>
                          {t(
                            `activity.${a === "import-export" ? "importExport" : a}` as string
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              {mainActivity === "custom" ? (
                <div className="mt-3">
                  <Field
                    label={t("activity.customLabel")}
                    control={
                      <Input
                        className="field-input"
                        value={customActivity}
                        onChange={e => setCustomActivity(e.target.value)}
                        placeholder={t("activity.customPlaceholder")}
                      />
                    }
                  />
                </div>
              ) : null}
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {t("activity.note")}
              </p>
            </FormSection>
          </SectionCard>
        </div>
      </PageShell>
    </AppLayout>
  );
}
