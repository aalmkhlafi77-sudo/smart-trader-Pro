import { Lock } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import AccessSettingsCard from "@/components/AccessSettingsCard";
import PrivateAccountSettingsCard from "@/components/PrivateAccountSettingsCard";
import { PageShell, SectionCard, StatusPill } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/contexts/AccessContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrivateStorage } from "@/contexts/PrivateStorageContext";

export default function SettingsSecurity() {
  const { t } = useLanguage();
  const { configured, lock, unlocked } = useAccess();
  const privateStorage = usePrivateStorage();

  return (
    <AppLayout title={t("settings.securityTitle")} subtitle={t("settings.securityHint")}>
      <PageShell
        title={t("settings.securityTitle")}
        description={t("settings.securityHint")}
        crumbs={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("settings.title"), href: "/settings" },
          { label: t("settings.securityTitle") },
        ]}
      >
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          {privateStorage.authenticated ? <PrivateAccountSettingsCard /> : <AccessSettingsCard />}
          <SectionCard
            title={t("settings.groupLedgerProtection")}
            description={t("settings.autoLockNote")}
            stamp={t("access.record")}
            footer={
              !privateStorage.authenticated && configured ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-card"
                  onClick={lock}
                >
                  <Lock className="h-4 w-4" />
                  {t("access.lockNow")}
                </Button>
              ) : null
            }
          >
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
              <span className="text-xs font-semibold text-[var(--ink)]">
                {t("settings.groupLedgerProtection")}
              </span>
              <StatusPill tone={privateStorage.authenticated || unlocked ? "success" : "neutral"}>
                {privateStorage.authenticated
                  ? t("access.privateMode")
                  : unlocked
                    ? t("access.opened")
                    : t("access.lockedTitle")}
              </StatusPill>
            </div>
          </SectionCard>
        </div>
      </PageShell>
    </AppLayout>
  );
}
