import { useState } from "react";
import { Link } from "wouter";
import {
  Building2,
  Database,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Tags,
  Truck,
  WalletCards,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { PageShell, SectionCard } from "@/components/patterns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const GROUPS = [
  {
    href: "/settings/business",
    icon: Building2,
    titleKey: "settings.businessTitle",
    descKey: "settings.groupBusinessFinanceHint",
  },
  {
    href: "/settings/financial",
    icon: WalletCards,
    titleKey: "settings.financialTitle",
    descKey: "settings.financialHint",
  },
  {
    href: "/settings/catalog",
    icon: Tags,
    titleKey: "settings.groupCatalog",
    descKey: "settings.groupCatalogHint",
  },
  {
    href: "/settings/logistics",
    icon: Truck,
    titleKey: "settings.logisticsTemplates",
    descKey: "settings.groupLogisticsLibraryHint",
  },
  {
    href: "/settings/workspace",
    icon: LayoutDashboard,
    titleKey: "settings.workspaceTitle",
    descKey: "settings.workspaceHint",
  },
  {
    href: "/settings/security",
    icon: ShieldCheck,
    titleKey: "settings.securityTitle",
    descKey: "settings.securityHint",
  },
  {
    href: "/settings/data",
    icon: Database,
    titleKey: "settings.dataTitle",
    descKey: "settings.dataHint",
  },
];

export default function SettingsIndex() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = GROUPS.filter(
    g =>
      !q ||
      t(g.titleKey).toLowerCase().includes(q) ||
      t(g.descKey).toLowerCase().includes(q)
  );

  return (
    <AppLayout title={t("settings.title")} subtitle={t("settings.subtitle")}>
      <PageShell
        title={t("settings.title")}
        description={t("settings.subtitle")}
        crumbs={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("settings.title") },
        ]}
      >
        <div className="space-y-5">
          <SectionCard
            title={t("settings.whereToStart")}
            description={t("settings.whereToStartHint")}
            stamp={t("common.entryform")}
            tone="input"
            actions={
              <Link href="/settings/business">
                <Button size="sm">{t("settings.openSection")}</Button>
              </Link>
            }
          >
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="field-input pr-8 text-xs h-9"
                placeholder={t("settings.indexSearch")}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </SectionCard>

          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map(g => (
              <Link key={g.href} href={g.href}>
                <div className="ledger-sheet cursor-pointer p-4 transition-colors hover:border-[var(--port-green)]/50">
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-[var(--port-green)]/12 p-2 text-[var(--port-green)]">
                      <g.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-[var(--ink)]">
                        {t(g.titleKey)}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {t(g.descKey)}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </PageShell>
    </AppLayout>
  );
}
