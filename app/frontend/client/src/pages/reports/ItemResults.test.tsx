/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { ReportRow } from "./reportModel";
import { ItemResults } from "./ItemResults";

const row: ReportRow = {
  item: {
    id: "item-1",
    name: "صنف اختبار",
    code: "ITEM-1",
    category: "أكياس",
    entityId: "entity-1",
    unit: "كرتون",
    currency: "USD",
    defaultExchangeRate: 3.75,
    customsRate: null,
    notes: "",
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  },
  entity: {
    id: "entity-1",
    name: "مورد اختبار",
    kind: "supplier",
    country: "",
    city: "",
    phone: "",
    email: "",
    contactPerson: "",
    notes: "",
    defaultCurrency: "USD",
    defaultExchangeRate: 3.75,
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  },
  specs: [],
  weight: "25 كجم",
  material: "بولي بروبلين",
  type: "منسوج",
  supplierPrice: 5.85,
  unitCost: 7.2,
  suggestedPrice: 8.65,
  margin: 20,
  costCurrency: "SAR",
};

function renderResults() {
  return render(
    <LanguageProvider>
      <ItemResults filtered={[row]} open onToggle={() => {}} />
    </LanguageProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("smart-trader:ui-language", "ar");
});

afterEach(() => {
  cleanup();
});

describe("تخصيص أعمدة تحليل الأصناف", () => {
  it("يخفي التكلفة من الشاشة وبطاقة المتوسط ويتذكر الاختيار", async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByRole("button", { name: "تخصيص الأعمدة" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "التكلفة" }));

    expect(
      within(screen.getByRole("table", { hidden: true })).queryByText("التكلفة")
    ).toBeNull();
    expect(screen.queryByText("متوسط تكلفة الوحدة")).toBeNull();

    cleanup();
    renderResults();

    expect(within(screen.getByRole("table")).queryByText("التكلفة")).toBeNull();
    expect(screen.queryByText("متوسط تكلفة الوحدة")).toBeNull();
  });
});
