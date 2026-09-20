import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { PageShell, SectionCard } from "@/components/patterns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  db,
  type LogisticsLocationRow,
  type LogisticsRateRow,
  type LogisticsRouteTemplateRow,
} from "@/lib/db";
import { LocationsTab } from "./logistics/LocationsTab";
import { RatesTab } from "./logistics/RatesTab";
import { TemplatesTab } from "./logistics/TemplatesTab";

export default function SettingsLogistics() {
  const { t } = useLanguage();
  const [locations, setLocations] = useState<LogisticsLocationRow[]>([]);
  const [rates, setRates] = useState<LogisticsRateRow[]>([]);
  const [templates, setTemplates] = useState<LogisticsRouteTemplateRow[]>([]);

  const load = async () => {
    await db.init();
    const [locs, rateList, tplList] = await Promise.all([
      db.listLogisticsLocations(),
      db.listLogisticsRates(),
      db.listLogisticsRouteTemplates(),
    ]);
    setLocations(locs);
    setRates(rateList);
    setTemplates(tplList);
  };

  useEffect(() => {
    void load();
  }, []);

  const refresh = () => void load();

  return (
    <AppLayout title={t("settings.logisticsTemplates")} subtitle={t("settings.logisticsTemplatesHint")}>
      <PageShell
        title={t("settings.logisticsTemplates")}
        description={t("settings.logisticsTemplatesHint")}
        crumbs={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("settings.title"), href: "/settings" },
          { label: t("settings.logisticsTemplates") },
        ]}
      >
        <SectionCard
          title={t("settings.routeLibrary")}
          description={t("settings.logisticsTemplatesHint")}
          stamp={t("settings.routeLibrary")}
        >
          <Tabs defaultValue="locations" dir="rtl">
            <TabsList className="w-full sm:w-auto border border-border bg-secondary/40 p-1 gap-1">
              <TabsTrigger
                value="locations"
                className="border border-transparent rounded-md data-[state=active]:bg-card data-[state=active]:border-border data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground"
              >
                {t("settings.openLocations")} ({locations.length})
              </TabsTrigger>
              <TabsTrigger
                value="rates"
                className="border border-transparent rounded-md data-[state=active]:bg-card data-[state=active]:border-border data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground"
              >
                {t("settings.servicePrices")} ({rates.length})
              </TabsTrigger>
              <TabsTrigger
                value="templates"
                className="border border-transparent rounded-md data-[state=active]:bg-card data-[state=active]:border-border data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground"
              >
                {t("settings.routeTemplates")} ({templates.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="locations">
              <LocationsTab locations={locations} onChanged={refresh} />
            </TabsContent>
            <TabsContent value="rates">
              <RatesTab rates={rates} locations={locations} onChanged={refresh} />
            </TabsContent>
            <TabsContent value="templates">
              <TemplatesTab
                templates={templates}
                locations={locations}
                rates={rates}
                onChanged={refresh}
              />
            </TabsContent>
          </Tabs>
        </SectionCard>
      </PageShell>
    </AppLayout>
  );
}
