import { describe, expect, it } from "vitest";
import { buildQuickCalculatorWorkbook } from "./quickCalculatorExport";
import { calculateQuickCalculator, type QuickCalculatorInput } from "./quickCalculator";

const input: QuickCalculatorInput = {
  itemName: "بوليود",
  supplierName: "اريكس",
  quantity: 10,
  unitPrice: 5,
  currency: "USD",
  exchangeRate: 3.75,
  customsRate: 0.12,
  marginRate: 0.18,
  externalExpenses: [],
  internalExpenses: [],
};

describe("quick calculator workbook", () => {
  it("contains separate input and result sheets", () => {
    const result = calculateQuickCalculator(input);
    const workbook = buildQuickCalculatorWorkbook(input, result);

    expect(workbook.SheetNames).toEqual(["المدخلات", "النتائج"]);
    expect(workbook.Sheets["المدخلات"]["A1"].v).toBe("الحقل");
    expect(workbook.Sheets["النتائج"]["A1"].v).toBe("النتيجة");
    expect(workbook.Sheets["النتائج"]["B2"].v).toBe(result.totalCost);
  });
});
