import { useEffect, useState } from "react";
import { Link } from "wouter";
import { FolderOpen, Search } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { DataTable, PageShell, StatusPill } from "@/components/patterns";
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
import { db, type CargoCostRunRow, type CargoRunStatus } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/pricing";
import { currencyLabel } from "@/lib/currency";

const STATUS_TONE: Record<CargoRunStatus, "neutral" | "info" | "success" | "warning"> = {
  draft: "neutral",
  review: "info",
  approved: "success",
  archived: "warning",
};

const STATUS_KEY: Record<CargoRunStatus, string> = {
  draft: "cargo.statusDraft",
  review: "cargo.statusReview",
  approved: "cargo.statusApproved",
  archived: "cargo.statusArchived",
};

export default function Runs() {
  const { t } = useLanguage();
  const [runs, setRuns] = useState<CargoCostRunRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const list = await db.listCargoCostRuns();
      if (cancelled) return;
      setRuns(
        [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = runs.filter(
    r =>
      (statusFilter === "all" || r.status === statusFilter) &&
      (!q ||
        r.name.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q))
  );

  return (
    <AppLayout title={t("cargo.runsTitle")} subtitle={t("cargo.runsDesc")}>
      <PageShell
        title={t("cargo.runsTitle")}
        description={t("cargo.runsDesc")}
        crumbs={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("nav.cargo"), href: "/cargo" },
          { label: t("cargo.runsTitle") },
        ]}
        actions={
          <Link href="/cargo">
            <Button size="sm" variant="outline" className="bg-card">
              <FolderOpen className="h-3.5 w-3.5" />
              {t("nav.cargo")}
            </Button>
          </Link>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="field-input pr-8 text-xs h-9"
                placeholder={t("cargo.runsSearch")}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 bg-card w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("cargo.allOperations")}</SelectItem>
                {(Object.keys(STATUS_KEY) as CargoRunStatus[]).map(s => (
                  <SelectItem key={s} value={s}>
                    {t(STATUS_KEY[s])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {t("cargo.runsEmpty")}
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: "name",
                  header: t("cargo.breakdownFile"),
                  cell: row => (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-[var(--ink)]">
                        {row.name}
                      </span>
                      {row.reference ? (
                        <span className="text-[11px] text-muted-foreground" dir="ltr">
                          {row.reference}
                        </span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: t("common.status"),
                  cell: row => (
                    <StatusPill tone={STATUS_TONE[row.status]}>
                      {t(STATUS_KEY[row.status])}
                    </StatusPill>
                  ),
                },
                {
                  key: "total",
                  header: t("cargo.totalCost"),
                  cell: row => (
                    <span className="font-bold tabular-nums" dir="ltr">
                      {formatMoney(row.totalCost, currencyLabel(row.currency, t))}
                    </span>
                  ),
                },
                {
                  key: "updated",
                  header: t("common.lastupdated"),
                  cell: row => (
                    <span className="text-[11px] text-muted-foreground" dir="ltr">
                      {formatDateTime(row.updatedAt)}
                    </span>
                  ),
                },
                {
                  key: "open",
                  header: "",
                  className: "w-24 text-left",
                  cell: row => (
                    <div onClick={e => e.stopPropagation()}>
                      <Link href={`/cargo?runId=${row.id}`}>
                        <Button size="sm" variant="outline" className="bg-card h-8 text-xs">
                          <FolderOpen className="h-3.5 w-3.5" />
                          {t("cargo.runsOpen")}
                        </Button>
                      </Link>
                    </div>
                  ),
                },
              ]}
              rows={filtered}
              keyOf={row => row.id}
            />
          )}
        </div>
      </PageShell>
    </AppLayout>
  );
}
