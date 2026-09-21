import { describe, expect, it } from "vitest";
import {
  calculateQuickCalculator,
  type QuickCalculatorInput,
} from "./quickCalculator";

const workbookExample: QuickCalculatorInput = {
  itemId: "item-plywood",
  itemName: "بوليود",
  quantity: 10_000,
  unitPrice: 5,
  currency: "USD",
  exchangeRate: 3.75,
  customsRate: 0.12,
  marginRate: 0.18,
  externalExpenses: [
    {
      id: "insurance",
      name: "تأمين",
      amount: 500,
      currency: "foreign",
      includeInCustomsBase: true,
    },
    {
      id: "external-shipping",
      name: "شحن خارجي",
      amount: 3_000,
      currency: "foreign",
      includeInCustomsBase: false,
    },
    {
      id: "external-other",
      name: "مصروف خارجي آخر",
      amount: 1_000,
      currency: "foreign",
      includeInCustomsBase: true,
    },
  ],
  internalExpenses: [
    {
      id: "clearance",
      name: "تخليص",
      amount: 550,
      currency: "local",
      includeInCustomsBase: false,
    },
    {
      id: "transport",
      name: "نقل داخلي",
      amount: 4_000,
      currency: "local",
      includeInCustomsBase: false,
    },
  ],
};

describe("quick calculator", () => {
  it("calculates the workbook flow and taxes selected external expenses once", () => {
    const result = calculateQuickCalculator(workbookExample);

    expect(result.goodsValue).toBe(187_500);
    expect(result.externalExpenses).toBe(16_875);
    expect(result.customsBaseExtra).toBe(5_625);
    expect(result.customsBase).toBe(193_125);
    expect(result.customsAmount).toBe(23_175);
    expect(result.internalExpenses).toBe(4_550);
    expect(result.totalCost).toBe(232_100);
    expect(result.unitCost).toBeCloseTo(23.21, 8);
    expect(result.suggestedPrice).toBeCloseTo(27.3878, 8);
  });

  it("rejects non-positive quantity and exchange rate", () => {
    expect(() =>
      calculateQuickCalculator({ ...workbookExample, quantity: 0 })
    ).toThrow("الكمية");
    expect(() =>
      calculateQuickCalculator({ ...workbookExample, exchangeRate: 0 })
    ).toThrow("سعر الصرف");
  });
});
