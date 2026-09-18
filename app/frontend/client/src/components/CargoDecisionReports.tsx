/**
 * تقارير قرار الحمولة — أسلوب: دفتر الميناء التحليلي.
 * اللوحة تضع القرار قبل الجداول: المسار الأرخص، أسباب التكلفة، ثم مصدر كل مبلغ.
 * الأقسام الثقيلة في مكوّنات مستقلة: مؤشرات، مقارنة، تفصيل.
 */
import EmptyHint from "@/components/EmptyHint";
import SectionCard from "@/components/SectionCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildRouteComparisonRows,
  type CargoDecisionRun,
} from "@/lib/cargoDecisionReports";
import {
  db,
  type CargoCostRunRow,
  type LogisticsLocationRow,
} from "@/lib/db";
import { ShipWheel, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CostBreakdownCard } from "./CostBreakdownCard";
import { DecisionKpiCards } from "./DecisionKpiCards";
import { RouteComparisonCard } from "./RouteComparisonCard";

export default function CargoDecisionReports() {
  const { t } = useLanguage();
  const [details, setDetails] = useState<CargoDecisionRun[]>([]);
  const [locations, setLocations] = useState<LogisticsLocationRow[]>([]);
  const [operation, setOperation] = useState<
    "all" | CargoCostRunRow["operationType"]
  >("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const [runs, locationRows] = await Promise.all([
        db.listCargoCostRuns(),
        db.listLogisticsLocations(),
      ]);
      const loaded = await Promise.all(
        runs.map(async run => ({
          run,
          items: await db.listCargoCostItems(run.id),
          lines: await db.listCargoCostLines(run.id),
        }))
      );
      if (cancelled) return;
      setDetails(loaded);
      setLocations(locationRows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredDetails = useMemo(
    () =>
      details.filter(
        entry =>
          entry.run.status !== "archived" &&
          (operation === "all" || entry.run.operationType === operation)
      ),
    [details, operation]
  );
  const routeRows = useMemo(
    () => buildRouteComparisonRows(filteredDetails, locations),
    [filteredDetails, locations]
  );

  return (
    <section className="space-y-5" aria-label={t("cargo.decisionReportsTitle")}>
      <SectionCard
        title={t("cargo.decisionReportsTitle")}
        hint={t("cargo.decisionCompareHint")}
        stamp={t("cargo.phase1Decision")}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>{t("cargo.compareOperationType")}</Label>
            <Select
              value={operation}
              onValueChange={value => setOperation(value as typeof operation)}
            >
              <SelectTrigger className="field-input w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("cargo.allOperations")}</SelectItem>
                <SelectItem value="import">{t("cargo.importWord")}</SelectItem>
                <SelectItem value="local">
                  {t("cargo.localTransport")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="rounded border border-[var(--port-green)]/25 bg-[var(--port-green-soft)] px-3 py-2 text-xs text-[var(--ink)]">
            <ShipWheel className="ml-1 inline h-3.5 w-3.5" />{" "}
            {t("cargo.compareUsesSnapshots")}.
          </p>
        </div>
      </SectionCard>

      {loading ? (
        <div className="ledger-card p-5 text-sm text-muted-foreground">
          {t("cargo.loadingLocalCostFiles")}…
        </div>
      ) : routeRows.length === 0 ? (
        <EmptyHint text={t("cargo.noCostFilesYet")} />
      ) : (
        <>
          <DecisionKpiCards routeRows={routeRows} />
          <RouteComparisonCard routeRows={routeRows} />
          <CostBreakdownCard details={filteredDetails} routeRows={routeRows} />
          <div className="flex items-start gap-2 rounded border border-border bg-secondary/40 px-3 py-2.5 text-[11px] text-muted-foreground">
            <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink)]/70" />
            <p>{t("cargo.reportsSnapshotNote")}.</p>
          </div>
        </>
      )}
    </section>
  );
}
