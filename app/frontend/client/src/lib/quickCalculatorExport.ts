import type { WorkBook } from "xlsx";
import { buildWorkbook, exportWorkbook, type WorkbookSheetSpec } from "./exporters";
import type { QuickCalculatorInput, QuickCalculatorResult } from "./quickCalculator";

const expenseRows = (expenses: QuickCalculatorInput["externalExpenses"]) =>
  expenses.map(expense => [
    expense.name,
    expense.amount,
    expense.currency === "foreign" ? "أجنبية" : "محلية",
    expense.includeInCustomsBase ? "نعم" : "لا",
  ]);

export function quickCalculatorSheets(
  input: QuickCalculatorInput,
  result: QuickCalculatorResult
): WorkbookSheetSpec[] {
  return [
    {
      sheetName: "المدخلات",
      header: ["الحقل", "القيمة"],
      rows: [
        ["المورد", input.supplierName || ""],
        ["الصنف", input.itemName],
        ["الكمية", input.quantity],
        ["سعر الوحدة", input.unitPrice],
        ["العملة", input.currency],
        ["سعر الصرف", input.exchangeRate],
        ["نسبة الجمارك", input.customsRate],
        ["نسبة الزيادة على التكلفة", input.marginRate],
        [],
        ["المصاريف الخارجية", "القيمة"],
        ...expenseRows(input.externalExpenses),
        [],
        ["المصاريف الداخلية", "القيمة"],
        ...expenseRows(input.internalExpenses),
      ],
    },
    {
      sheetName: "النتائج",
      header: ["النتيجة", "القيمة"],
      rows: [
        ["إجمالي التكلفة", result.totalCost],
        ["تكلفة الوحدة", result.unitCost],
        ["سعر البيع التقريبي", result.suggestedPrice],
        ["قيمة البضاعة", result.goodsValue],
        ["الوعاء الجمركي", result.customsBase],
        ["الجمارك", result.customsAmount],
        ["المصاريف الخارجية", result.externalExpenses],
        ["المصاريف الداخلية", result.internalExpenses],
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
