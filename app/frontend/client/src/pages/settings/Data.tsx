import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Database } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { PageShell, SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/pricing";

export default function SettingsData() {
  const { t } = useLanguage();
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const logs = await db.listBackupLogs();
      if (cancelled) return;
      const latest = logs
        .filter(l => l.action === "export")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      setLastBackupAt(latest?.createdAt ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppLayout title={t("settings.dataTitle")} subtitle={t("settings.dataHint")}>
      <PageShell
        title={t("settings.dataTitle")}
        description={t("settings.dataHint")}
        crumbs={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("settings.title"), href: "/settings" },
          { label: t("settings.dataTitle") },
        ]}
      >
        <SectionCard
          title={t("settings.lastBackup")}
          description={t("settings.dataDesc")}
          stamp={t("nav.backup")}
          footer={
            <Link href="/backup">
              <Button className="w-full">
                <Database className="h-4 w-4" />
                {t("settings.openBackup")}
              </Button>
            </Link>
          }
        >
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
            <span className="text-xs font-semibold text-[var(--ink)]">
              {t("settings.lastBackup")}
            </span>
            <span className="text-sm text-muted-foreground" dir="ltr">
              {lastBackupAt ? formatDateTime(lastBackupAt) : t("settings.noBackupYet")}
            </span>
          </div>
        </SectionCard>
      </PageShell>
    </AppLayout>
  );
}
