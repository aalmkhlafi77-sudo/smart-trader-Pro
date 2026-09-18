/**
 * النسخ الاحتياطي والاستعادة — اتجاه التصميم: "دفتر الميناء"
 * البيانات محلية، لذا النسخة الاحتياطية اليدوية وظيفة أساسية لا اختيارية.
 * صيغة النسخة مستقلة عن محرك التخزين لتسهيل الانتقال إلى SQLite.
 */

import AppLayout from "@/components/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import {
  db,
  STORAGE_ENGINE,
  type BackupLogRow,
  type BackupPayload,
} from "@/lib/db";
import { nowIso } from "@/lib/id";
import { formatCount, formatDateTime } from "@/lib/pricing";
import {
  AlertTriangle,
  Check,
  Database,
  Download,
  FileSearch,
  HardDrive,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type RestoreMode = "replace" | "merge";

interface BackupPreview {
  fileName: string;
  payload: BackupPayload;
  schemaVersion: number | string;
  exportedAt: string;
  legacy: boolean;
  counts: Array<[string, number]>;
  entities: string[];
  items: string[];
}

function makePreview(
  raw: unknown,
  fileName: string,
  t: (key: string) => string
): BackupPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const tables =
    payload.tables && typeof payload.tables === "object"
      ? (payload.tables as Record<string, unknown>)
      : payload;
  const rows = (keys: string[]) => {
    for (const key of keys) {
      const value = tables[key];
      if (Array.isArray(value)) return value;
    }
    return [];
  };
  const entities = rows(["entities"]);
  const items = rows(["items"]);
  if (
    payload.format !== "smart-trader-backup" &&
    !payload.tables &&
    entities.length === 0 &&
    items.length === 0
  )
    return null;
  const categories = rows(["categories"]);
  const specs = rows(["item_specs", "itemSpecs", "specs"]);
  const prices = rows(["item_prices", "itemPrices", "prices"]);
  const priceHistory = rows(["price_history", "priceHistory"]);
  const attachments = rows(["attachments"]);
  const notes = rows(["notes"]);
  const tasks = rows(["tasks"]);
  const runs = rows([
    "pricing_runs",
    "pricingRuns",
    "cost_calculations",
    "costCalculations",
  ]);
  const lists = rows(["price_lists", "priceLists"]);
  const names = (records: unknown[]) =>
    records
      .slice(0, 4)
      .map(record =>
        typeof record === "object" && record && "name" in record
          ? String((record as { name: unknown }).name)
          : t("common.unnamedRecord")
      )
      .filter(Boolean);
  return {
    fileName,
    payload: raw as BackupPayload,
    schemaVersion:
      typeof payload.schemaVersion === "number"
        ? payload.schemaVersion
        : t("backup.legacyWord"),
    exportedAt:
      typeof payload.exportedAt === "string"
        ? payload.exportedAt
        : t("export.unspecified"),
    legacy: payload.format !== "smart-trader-backup" || !payload.tables,
    counts: [
      [t("nav.entities"), entities.length],
      [t("backup.countCategories"), categories.length],
      [t("nav.items"), items.length],
      [t("prices.specifications"), specs.length],
      [t("nav.prices"), prices.length],
      [t("backup.countPriceHistory"), priceHistory.length],
      [t("backup.countAttachments"), attachments.length],
      [t("backup.countNotes"), notes.length],
      [t("backup.countTasks"), tasks.length],
      [t("home.costRuns"), runs.length],
      [t("home.priceLists"), lists.length],
    ],
    entities: names(entities),
    items: names(items),
  };
}

export default function Backup() {
  const { t } = useLanguage();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [lastBackup, setLastBackup] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("merge");
  const [isRestoring, setIsRestoring] = useState(false);
  const [logs, setLogs] = useState<BackupLogRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    await db.init();
    const payload = await db.exportBackup();
    const [meta, logRows] = await Promise.all([
      db.getMeta(),
      db.listBackupLogs(),
    ]);
    setCounts({
      [t("nav.entities")]: payload.tables.entities.length,
      [t("nav.items")]: payload.tables.items.length,
      [t("prices.specifications")]: payload.tables.item_specs.length,
      [t("backup.countPriceRecords")]: payload.tables.item_prices.length,
      [t("backup.countPriceHistory")]: payload.tables.price_history.length,
      [t("backup.countAttachments")]: payload.tables.attachments.length,
      [t("backup.countNotes")]: payload.tables.notes.length,
      [t("backup.countTasks")]: payload.tables.tasks.length,
      [t("home.costRuns")]: payload.tables.pricing_runs.length,
      [t("home.priceLists")]: payload.tables.price_lists.length,
    });
    setLastBackup(meta.lastBackupAt);
    setLogs(logRows);
  };

  useEffect(() => {
    void load();
  }, []);

  const exportBackup = async () => {
    const payload = await db.exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart-trader-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const meta = await db.getMeta();
    await db.saveMeta({ ...meta, lastBackupAt: nowIso(), updatedAt: nowIso() });
    await db.saveBackupLog({
      id: `backup-${Date.now()}`,
      action: "export",
      fileName: a.download,
      summary: `${payload.tables.items.length} ${t("backup.itemsAnd")}${payload.tables.entities.length} ${t("backup.partnersWord")}`,
      createdAt: nowIso(),
    });
    toast.success(t("backup.created"));
    await load();
  };

  const inspectBackup = async (file: File) => {
    try {
      const text = await file.text();
      const details = makePreview(JSON.parse(text), file.name, t);
      if (!details) {
        toast.error(t("backup.invalid"));
        return;
      }
      setPreview(details);
      setRestoreMode("merge");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("backup.readFailed");
      toast.error(`${t("backup.readFailed")}: ${message}`);
    }
  };

  const confirmRestore = async () => {
    if (!preview) return;
    setIsRestoring(true);
    try {
      await db.init();
      await db.importBackup(preview.payload, restoreMode);
      const restored = await db.exportBackup();
      await db.saveBackupLog({
        id: `restore-${Date.now()}`,
        action: restoreMode === "merge" ? "merge" : "restore",
        fileName: preview.fileName,
        summary: `${restored.tables.items.length} ${t("backup.itemsAnd")}${restored.tables.entities.length} ${t("backup.partnersWord")}`,
        createdAt: nowIso(),
      });
      toast.success(
        `${t("backup.doneWord")} ${restoreMode === "merge" ? t("backup.mergeWord") : t("backup.restoreWord")}: ${formatCount(restored.tables.items.length)} ${t("backup.itemsAnd")}${formatCount(restored.tables.entities.length)} ${t("backup.partnersWord")}`
      );
      setPreview(null);
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("backup.readFailed");
      toast.error(`${t("backup.importFailed")}: ${message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const clearAll = async () => {
    if (!window.confirm(t("backup.deleteConfirm"))) return;
    if (!window.confirm(t("backup.deleteFinalConfirm"))) return;
    await db.clearAll();
    toast.success(t("backup.deleted"));
    await load();
  };

  return (
    <AppLayout title={t("backup.title")} subtitle={t("backup.localSubtitle")}>
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <SectionCard
          title={t("common.storagestatus")}
          hint={`${t("common.currentstorageengine")}: ${STORAGE_ENGINE}`}
          stamp={t("common.ledgerinventory")}
        >
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(counts).map(([label, value]) => (
              <div
                key={label}
                className="rounded border border-border bg-card px-3 py-2.5"
              >
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="ledger-figure text-lg text-[var(--ink)]">
                  {formatCount(value)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded border border-border bg-secondary/50 px-3 py-2.5">
            <HardDrive className="h-4 w-4 mt-0.5 shrink-0 text-[var(--ink)]" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("common.dataisstoredonlyonthisde")}.
              {lastBackup ? (
                <span className="block mt-1" dir="ltr">
                  {t("common.lastbackup")}: {formatDateTime(lastBackup)}
                </span>
              ) : (
                <span className="block mt-1">
                  {t("common.nobackuphasbeencreatedye")}.
                </span>
              )}
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title={t("common.exportrestore")}
          hint={t("common.onefilecontainingallyour")}
          stamp={t("common.localarchive")}
        >
          <div className="space-y-3">
            <Button onClick={exportBackup} className="w-full">
              <Download className="h-4 w-4" />
              {t("common.createbackup")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) void inspectBackup(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="w-full bg-card"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {t("common.restorefromfile")}
            </Button>
            <div className="flex items-start gap-2 rounded border border-[var(--amber-line)] bg-[var(--amber-field)] px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-[#9a6700]" />
              <p className="text-[11px] leading-relaxed text-[#7a5200]">
                {t("common.thisbackupcontainsintern")}.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded border border-border bg-secondary/50 px-3 py-2.5">
              <Database className="h-4 w-4 mt-0.5 shrink-0 text-[var(--ink)]" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t("backup.formatPortableNote")}.
              </p>
            </div>
            {preview ? (
              <div className="rounded border-2 border-[var(--port-green)]/45 bg-card p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-[var(--port-green)]" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink)]">
                        {t("common.previewbeforeimport")}
                      </p>
                      <p className="mt-0.5 break-all text-[10px] text-muted-foreground">
                        {preview.fileName}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setPreview(null)}
                    title={t("backup.cancelPreview")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {preview.counts.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded border border-border bg-secondary/35 px-2.5 py-2"
                    >
                      <p className="text-[10px] text-muted-foreground">
                        {label}
                      </p>
                      <p className="ledger-figure text-base text-[var(--ink)]">
                        {formatCount(value)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] leading-relaxed text-muted-foreground">
                  <p>
                    {t("backup.fileVersion")}:{" "}
                    <span className="ledger-figure">
                      {preview.schemaVersion}
                    </span>
                    {preview.exportedAt !== t("export.unspecified")
                      ? ` · ${t("backup.exportDate")}: ${formatDateTime(preview.exportedAt)}`
                      : ""}
                  </p>
                  {preview.legacy ? (
                    <p className="mt-1 text-[#9a6700]">
                      {t("backup.legacyWillMigrate")}.
                    </p>
                  ) : null}
                  {preview.entities.length ? (
                    <p className="mt-1">
                      {t("backup.partnersCountWord")}:{" "}
                      {preview.entities.join(t("common.listSeparator"))}
                    </p>
                  ) : null}
                  {preview.items.length ? (
                    <p className="mt-1">
                      {t("backup.itemsCountWord")}:{" "}
                      {preview.items.join(t("common.listSeparator"))}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRestoreMode("merge")}
                    className={`rounded border p-2.5 text-right transition-colors ${restoreMode === "merge" ? "border-[var(--port-green)] bg-[var(--result-green)]" : "border-border bg-secondary/30"}`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                      <Check className="h-3.5 w-3.5" />
                      {t("common.safemergerecommended")}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {t("common.keepscurrentdataandupdat")}.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestoreMode("replace")}
                    className={`rounded border p-2.5 text-right transition-colors ${restoreMode === "replace" ? "border-[#c24d4d] bg-[#fff5f5]" : "border-border bg-secondary/30"}`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      {t("common.fullreplacement")}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {t("common.deletescurrentlocaldatat")}.
                    </span>
                  </button>
                </div>
                <Button
                  className="w-full"
                  disabled={isRestoring}
                  onClick={() => void confirmRestore()}
                >
                  <Upload className="h-4 w-4" />
                  {isRestoring
                    ? t("common.importing")
                    : restoreMode === "merge"
                      ? t("backup.confirmSafeMerge")
                      : t("backup.confirmFullReplace")}
                </Button>
              </div>
            ) : null}
            <Button
              variant="outline"
              className="w-full text-destructive bg-card"
              onClick={clearAll}
            >
              <Trash2 className="h-4 w-4" />
              {t("common.deletealllocaldata")}
            </Button>
          </div>
        </SectionCard>
      </div>
      <SectionCard
        title={t("common.archiveactivitylog")}
        hint={t("backup.activityHint")}
        stamp={t("backup.saveTrace")}
        className="mt-5"
      >
        {logs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {t("common.noarchiveactivityrecorde")}.
          </p>
        ) : (
          <div className="space-y-2">
            {logs.slice(0, 8).map(log => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-3 rounded border border-border bg-secondary/25 px-3 py-2 text-[11px]"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--ink)]">
                    {log.action === "export"
                      ? t("common.createbackup2")
                      : log.action === "merge"
                        ? t("backup.mergeBackup")
                        : t("common.restorebackup")}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {log.fileName || t("backup.localDataWord")} — {log.summary}
                  </p>
                </div>
                <span className="shrink-0 text-muted-foreground" dir="ltr">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </AppLayout>
  );
}
