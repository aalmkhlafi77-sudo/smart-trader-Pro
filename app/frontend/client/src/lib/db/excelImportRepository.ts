import type { ExcelImportPlan } from "../excelImport";

export function assertExcelImportPlan(plan: ExcelImportPlan): void {
  if (!plan.canApply || plan.errors.length > 0) {
    throw new Error(`لا يمكن تطبيق الاستيراد: ${plan.errors.length} أخطاء`);
  }
}
