import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, Database, Download, FileSearch, Upload } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { PageShell, SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/pricing";
import {
  buildExcelImportPlan,
  exportExcelImportTemplate,
  parseExcelWorkbook,
  type ExcelDuplicateMode,
  type ExcelImportPlan,
} from "@/lib/excelImport";
import { toast } from "sonner";

export default function SettingsData() {
  const { t } = useLanguage();
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ fileName: string; plan: ExcelImportPlan } | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<ExcelDuplicateMode>("update");
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const inspectExcel = async (file: File) => {
    try {
      const [entities, items, prices, cargoRuns] = await Promise.all([
        db.listEntities(),
        db.listItems(),
        db.listPrices(),
        db.listCargoCostRuns(),
      ]);
      const plan = buildExcelImportPlan(
        parseExcelWorkbook(await file.arrayBuffer()),
        { entities, items, prices, cargoRuns },
        { duplicateMode }
      );
      setPreview({ fileName: file.name, plan });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر قراءة ملف Excel");
    }
  };

  const applyExcel = async () => {
    if (!preview || !preview.plan.canApply) return;
    setIsImporting(true);
    try {
      await db.importExcel(preview.plan);
      toast.success("تم استيراد البيانات في معاملة واحدة");
      setPreview(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تطبيق الاستيراد");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadErrors = () => {
    if (!preview?.plan.errors.length) return;
    const blob = new Blob([JSON.stringify(preview.plan.errors, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "smart-trader-excel-import-errors.json";
    link.click();
    URL.revokeObjectURL(url);
  };

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

        <SectionCard
          className="mt-5"
          title="استيراد Excel"
          description="استيراد الجهات والأصناف وأسعار الموردين والمواصفات ومصاريف مرتبطة بحمولة محددة بعد معاينة كاملة."
          stamp="معاينة قبل الحفظ"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => exportExcelImportTemplate()}>
                <Download className="h-4 w-4" /> تنزيل القالب
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void inspectExcel(file);
                  event.target.value = "";
                }}
              />
              <Button onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> معاينة ملف Excel
              </Button>
              <label className="flex items-center gap-2 rounded border border-border px-3 text-xs">
                <span>التكرار</span>
                <select className="bg-transparent py-1.5" value={duplicateMode} onChange={event => setDuplicateMode(event.target.value as ExcelDuplicateMode)}>
                  <option value="update">تحديث المطابق</option>
                  <option value="skip">تخطي المطابق</option>
                  <option value="add">إضافة كسجل جديد</option>
                </select>
              </label>
            </div>
            <div className="flex items-start gap-2 rounded border border-[var(--amber-line)] bg-[var(--amber-field)] px-3 py-2.5 text-[11px] leading-relaxed text-[#7a5200]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>أسعار الموردين تذهب إلى مستويات المورد وسجل التاريخ فقط. المصروف لا يُقبل بلا مرجع حمولة معروف.</p>
            </div>
            {preview ? (
              <div className="rounded border-2 border-[var(--port-green)]/45 bg-card p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-[var(--port-green)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--ink)]">نتيجة المعاينة</p>
                    <p className="break-all text-[10px] text-muted-foreground">{preview.fileName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Object.entries(preview.plan.counts).map(([label, count]) => <div key={label} className="rounded border border-border px-2.5 py-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="ledger-figure text-base">{count}</p></div>)}
                </div>
                {preview.plan.errors.length ? <div className="space-y-2 rounded border border-destructive/30 bg-destructive/5 p-2.5"><p className="text-xs font-bold text-destructive">لا يمكن التطبيق قبل تصحيح {preview.plan.errors.length} أخطاء</p><ul className="list-disc space-y-1 ps-4 text-[11px] text-destructive">{preview.plan.errors.slice(0, 8).map((error, index) => <li key={`${error.sheet}-${error.row}-${index}`}>{error.sheet} · صف {error.row}: {error.message}</li>)}</ul><Button variant="outline" size="sm" onClick={downloadErrors}><Download className="h-3.5 w-3.5" /> تنزيل تقرير الأخطاء</Button></div> : <p className="text-xs text-[var(--port-green)]">المعاينة سليمة ويمكن تطبيقها بأمان.</p>}
                <div className="flex flex-wrap gap-2"><Button disabled={!preview.plan.canApply || isImporting} onClick={() => void applyExcel()}>{isImporting ? "جارٍ الاستيراد..." : "تطبيق الاستيراد"}</Button><Button variant="outline" onClick={() => setPreview(null)}>إلغاء المعاينة</Button></div>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </PageShell>
    </AppLayout>
  );
}
