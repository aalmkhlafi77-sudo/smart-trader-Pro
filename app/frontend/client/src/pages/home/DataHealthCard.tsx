import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { db } from "@/lib/db";
import { latestDatedItemPrice } from "@/lib/latestItemPrice";
import { formatDateTime } from "@/lib/pricing";

/** مدة اعتبار السعر قديماً — تُقرأ من إعداد لاحقاً؛ ثابت مؤقت موثّق (S4). */
const STALE_DAYS = 90;

interface HealthRow {
  id: string;
  labelKey: string;
  count: number | null;
  extra?: string | null;
  href: string;
  tone: "warn" | "info";
}

export function DataHealthCard() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<HealthRow[]>([]);
  const [healthy, setHealthy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const [items, prices, runs, templates, rates, locations, logs] =
        await Promise.all([
          db.listItems(),
          db.listPrices(),
          db.listCargoCostRuns(),
          db.listLogisticsRouteTemplates(),
          db.listLogisticsRates(),
          db.listLogisticsLocations(),
          db.listBackupLogs(),
        ]);
      const priceMap = Object.fromEntries(prices.map(p => [p.itemId, p]));
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - STALE_DAYS);
      const cutoffIso = cutoff.toISOString().slice(0, 10);

      let noPrice = 0;
      let stale = 0;
      for (const item of items) {
        const latest = latestDatedItemPrice(priceMap[item.id] ?? null);
        if (!latest) noPrice += 1;
        else if (latest.effectiveDate < cutoffIso) stale += 1;
      }

      let runsMissing = 0;
      for (const run of runs) {
        const lines = await db.listCargoCostLines(run.id);
        if (lines.some(l => l.status === "missing")) runsMissing += 1;
      }

      const rateIds = new Set(rates.map(r => r.id));
      const locationIds = new Set(locations.map(l => l.id));
      const broken = templates.filter(
        tpl =>
          (tpl.freightRateId && !rateIds.has(tpl.freightRateId)) ||
          (tpl.clearanceFeeRateId && !rateIds.has(tpl.clearanceFeeRateId)) ||
          (tpl.transportRateId && !rateIds.has(tpl.transportRateId)) ||
          (tpl.originLocationId && !locationIds.has(tpl.originLocationId)) ||
          (tpl.unloadingLocationId && !locationIds.has(tpl.unloadingLocationId)) ||
          (tpl.deliveryLocationId && !locationIds.has(tpl.deliveryLocationId))
      ).length;

      const latestBackup = logs
        .filter(l => l.action === "export")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

      if (cancelled) return;
      const next: HealthRow[] = [];
      if (noPrice > 0)
        next.push({
          id: "no-price",
          labelKey: "home.healthNoPrice",
          count: noPrice,
          href: "/prices",
          tone: "warn",
        });
      if (stale > 0)
        next.push({
          id: "stale",
          labelKey: "home.healthStalePrice",
          count: stale,
          href: "/prices",
          tone: "warn",
        });
      if (runsMissing > 0)
        next.push({
          id: "runs",
          labelKey: "home.healthMissingLines",
          count: runsMissing,
          href: "/cargo/runs",
          tone: "warn",
        });
      if (broken > 0)
        next.push({
          id: "templates",
          labelKey: "home.healthBrokenTemplates",
          count: broken,
          href: "/settings/logistics",
          tone: "warn",
        });
      next.push({
        id: "backup",
        labelKey: "settings.lastBackup",
        count: null,
        extra: latestBackup ? formatDateTime(latestBackup.createdAt) : null,
        href: "/backup",
        tone: latestBackup ? "info" : "warn",
      });
      setRows(next);
      setHealthy(
        noPrice === 0 && stale === 0 && runsMissing === 0 && broken === 0
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SectionCard
      title={t("home.healthTitle")}
      hint={t("home.entriesHint")}
      stamp={t("home.ledgerIndex")}
    >
      {healthy ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-[var(--port-green)]">
          <CheckCircle2 className="h-4 w-4" />
          {t("home.healthEmpty")}
        </p>
      ) : null}
      <ul className="mt-2 space-y-1.5">
        {rows.map(row => (
          <li key={row.id}>
            <Link
              href={row.href}
              className="flex items-center justify-between gap-2 rounded border border-border bg-card px-3 py-2 text-xs transition-colors hover:border-[var(--port-green)]/50"
            >
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                {row.tone === "warn" ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
                ) : null}
                <span className="truncate">{t(row.labelKey)}</span>
              </span>
              <span className="shrink-0 font-bold tabular-nums text-[var(--ink)]" dir="ltr">
                {row.count ?? row.extra ?? t("settings.noBackupYet")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
