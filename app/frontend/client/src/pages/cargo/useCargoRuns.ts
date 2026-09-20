import { toast } from "sonner";
import { db, type CargoCostRunRow } from "@/lib/db";
import { fetchCargoDraft } from "./cargoPersistence";
import type { CargoDraft } from "./shared";

/**
 * التنقل بين ملفات الحمولة المحفوظة من داخل صفحة الحمولة:
 * فتح ملف في المعالج، وحذف محمي (المعتمد/المؤرشف لا يُحذف).
 */
export function useCargoRuns(args: {
  runs: CargoCostRunRow[];
  activeRunId: string;
  t: (key: string) => string;
  setDraft: (d: CargoDraft) => void;
  setStep: (n: number) => void;
  doNewWork: () => void;
  reloadData: () => Promise<unknown>;
}) {
  const { runs, activeRunId, t, setDraft, setStep, doNewWork, reloadData } = args;

  const openRun = async (id: string) => {
    const loaded = await fetchCargoDraft(id);
    if (!loaded) return;
    setDraft(loaded);
    setStep(0);
  };

  const deleteRun = async (id: string) => {
    const target = runs.find(r => r.id === id);
    if (!target) return;
    if (target.status === "approved" || target.status === "archived") {
      toast.error(t("cargo.deleteRunBlocked"));
      return;
    }
    await db.deleteCargoCostRun(id);
    if (activeRunId === id) doNewWork();
    await reloadData();
    toast.success(t("toast.deleted"));
  };

  return { openRun, deleteRun };
}
