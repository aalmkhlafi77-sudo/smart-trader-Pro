import type { WorkBook } from "xlsx";
import { buildWorkbook, exportWorkbook, type WorkbookSheetSpec } from "./exporters";
import type { QuickCalculatorInput, QuickCalculatorResult } from "./quickCalculator";

const QUICK_EXPORT_LABELS = {
  foreign: "أجنبية", local: "محلية", yes: "نعم", no: "لا", inputs: "المدخلات", field: "الحقل", value: "القيمة",
  supplier: "المورد", item: "الصنف", quantity: "الكمية", unitPrice: "سعر الوحدة", currency: "العملة", exchangeRate: "سعر الصرف",
  customsRate: "نسبة الجمارك", markup: "نسبة الزيادة على التكلفة", external: "المصاريف الخارجية", internal: "المصاريف الداخلية",
  results: "النتائج", result: "النتيجة", totalCost: "إجمالي التكلفة", unitCost: "تكلفة الوحدة", suggested: "سعر البيع التقريبي",
  goods: "قيمة البضاعة", customsBase: "الوعاء الجمركي", customs: "الجمارك",
} as const;

const expenseRows = (expenses: QuickCalculatorInput["externalExpenses"]) =>
  expenses.map(expense => [
    expense.name,
    expense.amount,
    expense.currency === "foreign" ? QUICK_EXPORT_LABELS.foreign : QUICK_EXPORT_LABELS.local,
    expense.includeInCustomsBase ? QUICK_EXPORT_LABELS.yes : QUICK_EXPORT_LABELS.no,
  ]);

export function quickCalculatorSheets(
  input: QuickCalculatorInput,
  result: QuickCalculatorResult
): WorkbookSheetSpec[] {
  return [
    {
      sheetName: QUICK_EXPORT_LABELS.inputs,
      header: [QUICK_EXPORT_LABELS.field, QUICK_EXPORT_LABELS.value],
      rows: [
        [QUICK_EXPORT_LABELS.supplier, input.supplierName || ""],
        [QUICK_EXPORT_LABELS.item, input.itemName],
        [QUICK_EXPORT_LABELS.quantity, input.quantity],
        [QUICK_EXPORT_LABELS.unitPrice, input.unitPrice],
        [QUICK_EXPORT_LABELS.currency, input.currency],
        [QUICK_EXPORT_LABELS.exchangeRate, input.exchangeRate],
        [QUICK_EXPORT_LABELS.customsRate, input.customsRate],
        [QUICK_EXPORT_LABELS.markup, input.marginRate],
        [],
        [QUICK_EXPORT_LABELS.external, QUICK_EXPORT_LABELS.value],
        ...expenseRows(input.externalExpenses),
        [],
        [QUICK_EXPORT_LABELS.internal, QUICK_EXPORT_LABELS.value],
        ...expenseRows(input.internalExpenses),
      ],
    },
    {
      sheetName: QUICK_EXPORT_LABELS.results,
      header: [QUICK_EXPORT_LABELS.result, QUICK_EXPORT_LABELS.value],
      rows: [
        [QUICK_EXPORT_LABELS.totalCost, result.totalCost],
        [QUICK_EXPORT_LABELS.unitCost, result.unitCost],
        [QUICK_EXPORT_LABELS.suggested, result.suggestedPrice],
        [QUICK_EXPORT_LABELS.goods, result.goodsValue],
        [QUICK_EXPORT_LABELS.customsBase, result.customsBase],
        [QUICK_EXPORT_LABELS.customs, result.customsAmount],
        [QUICK_EXPORT_LABELS.external, result.externalExpenses],
        [QUICK_EXPORT_LABELS.internal, result.internalExpenses],
      ],
    },
  ];
}

export function buildQuickCalculatorWorkbook(
  input: QuickCalculatorInput,
  result: QuickCalculatorResult
): WorkBook {
  return buildWorkbook(quickCalculatorSheets(input, result));
}

export function exportQuickCalculator(
  input: QuickCalculatorInput,
  result: QuickCalculatorResult,
  fileName = "smart-trader-quick-calculation"
) {
  exportWorkbook({ sheets: quickCalculatorSheets(input, result), fileName });
}
