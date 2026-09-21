import type { CargoCostItemRow, CargoCostLineRow } from "@/lib/db";
import { calculateCargoPricing } from "./cargoPricing";
import type { CargoPricingResult } from "./cargoPricing";

export type QuickExpenseCurrency = "foreign" | "local";

export interface QuickExpense {
  id: string;
  name: string;
  amount: number;
  currency: QuickExpenseCurrency;
  includeInCustomsBase: boolean;
}

export interface QuickCalculatorInput {
  itemId?: string | null;
  itemName: string;
  supplierName?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  exchangeRate: number;
  customsRate: number;
  marginRate: number;
  externalExpenses: QuickExpense[];
  internalExpenses: QuickExpense[];
}

export interface QuickCalculatorResult {
  goodsValue: number;
  externalExpenses: number;
  internalExpenses: number;
  customsBaseExtra: number;
  customsBase: number;
  customsAmount: number;
  totalCost: number;
  unitCost: number;
  suggestedPrice: number;
  pricing: CargoPricingResult;
}

const asFinite = (value: number, label: string) => {
  if (!Number.isFinite(value)) throw new Error(`${label} غير صالح`);
  return value;
};

const localExpenseAmount = (expense: QuickExpense, exchangeRate: number) => {
  const amount = asFinite(expense.amount, `قيمة ${expense.name}`);
  if (amount < 0) throw new Error(`قيمة ${expense.name} لا يمكن أن تكون سالبة`);
  return amount * (expense.currency === "foreign" ? exchangeRate : 1);
};

function makeItem(input: QuickCalculatorInput): CargoCostItemRow {
  return {
    id: `quick-item-${input.itemId || "manual"}`,
    runId: "quick-preview",
    itemId: input.itemId || "quick-item",
    itemName: input.itemName.trim() || "صنف يدوي",
    priceLevel: 1,
    priceSource: "manual",
    priceEffectiveDate: "",
    unitPrice: input.unitPrice,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
    quantity: input.quantity,
    unit: "",
    customsCategory: "",
    customsRate: input.customsRate,
    goodsValue: 0,
    allocatedCost: 0,
    finalUnitCost: 0,
    suggestedPrice: 0,
    createdAt: "",
    updatedAt: "",
  };
}

function makeLine(
  expense: QuickExpense,
  index: number,
  localAmount: number
): CargoCostLineRow {
  return {
    id: `quick-expense-${expense.id}-${index}`,
    runId: "quick-preview",
    name: expense.name.trim() || "مصروف",
    stage: "other",
    status: "entered",
    method: "fixed",
    allocationBasis: "value",
    currency: "local",
    exchangeRate: 1,
    amount: localAmount,
    referenceQuantity: 0,
    referenceUnit: "",
    percentageBase: 0,
    itemIds: "",
    sourceLabel: "حاسبة سريعة",
    rateId: "",
    templateId: "",
    effectiveDate: "",
    reason: "",
    sortOrder: (index + 1) * 10,
    createdAt: "",
    updatedAt: "",
  };
}

export function calculateQuickCalculator(
  input: QuickCalculatorInput
): QuickCalculatorResult {
  const quantity = asFinite(input.quantity, "الكمية");
  const unitPrice = asFinite(input.unitPrice, "سعر الوحدة");
  const exchangeRate = asFinite(input.exchangeRate, "سعر الصرف");
  const customsRate = asFinite(input.customsRate, "نسبة الجمارك");
  const marginRate = asFinite(input.marginRate, "نسبة الزيادة");
  if (quantity <= 0) throw new Error("الكمية يجب أن تكون أكبر من صفر");
  if (unitPrice < 0) throw new Error("سعر الوحدة لا يمكن أن يكون سالباً");
  if (exchangeRate <= 0) throw new Error("سعر الصرف يجب أن يكون أكبر من صفر");
  if (customsRate < 0 || marginRate < 0)
    throw new Error("النسب لا يمكن أن تكون سالبة");

  const externalExpenses = input.externalExpenses.map((expense, index) => ({
    expense,
    amount: localExpenseAmount(expense, exchangeRate),
    index,
  }));
  const internalExpenses = input.internalExpenses.map((expense, index) => ({
    expense,
    amount: localExpenseAmount(expense, exchangeRate),
    index: index + externalExpenses.length,
  }));
  const customsBaseExtra = externalExpenses
    .filter(({ expense }) => expense.includeInCustomsBase)
    .reduce((sum, row) => sum + row.amount, 0);
  const items = [makeItem({ ...input, quantity, unitPrice, exchangeRate })];
  const costLines: CargoCostLineRow[] = [
    ...externalExpenses.map(row => makeLine(row.expense, row.index, row.amount)),
    ...internalExpenses.map(row => makeLine(row.expense, row.index, row.amount)),
    {
      ...makeLine(
        {
          id: "customs",
          name: "الجمارك",
          amount: 0,
          currency: "local",
          includeInCustomsBase: false,
        },
        externalExpenses.length + internalExpenses.length,
        0
      ),
      stage: "customs",
    },
  ];
  const pricing = calculateCargoPricing({
    items,
    costLines,
    customsBaseExtra,
    marginRate,
  });
  const row = pricing.items[0];
  return {
    goodsValue: pricing.invoiceValue,
    externalExpenses: externalExpenses.reduce((sum, row) => sum + row.amount, 0),
    internalExpenses: internalExpenses.reduce((sum, row) => sum + row.amount, 0),
    customsBaseExtra,
    customsBase: pricing.customsBase,
    customsAmount: pricing.customsAmount,
    totalCost: pricing.totalCost,
    unitCost: row?.unitCost ?? 0,
    suggestedPrice: row?.suggestedPrice ?? 0,
    pricing,
  };
}
