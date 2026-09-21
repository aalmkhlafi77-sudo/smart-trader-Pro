/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AccessProvider } from "@/contexts/AccessContext";
import { ActivityThemeProvider } from "@/contexts/ActivityThemeContext";
import { LoginBackgroundProvider } from "@/contexts/LoginBackgroundContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WorkspacePreferencesProvider } from "@/contexts/WorkspacePreferencesContext";
import QuickCalculator from "./QuickCalculator";
import type { QuickCalculationRow } from "@/lib/db";

const { mockDeleteDraft, mockListDrafts } = vi.hoisted(() => ({
  mockDeleteDraft: vi.fn(),
  mockListDrafts: vi.fn(),
}));

const draft: QuickCalculationRow = {
  id: "quick-1",
  supplierName: "مصنع تجريبي",
  itemId: null,
  itemName: "صنف تجريبي",
  quantity: 10,
  unitPrice: 5,
  currency: "USD",
  exchangeRate: 3.75,
  customsRate: 0.12,
  marginRate: 0.2,
  externalExpensesJson: "[]",
  internalExpensesJson: "[]",
  goodsValue: 50,
  externalExpenses: 0,
  internalExpenses: 0,
  customsBaseExtra: 0,
  customsBase: 50,
  customsAmount: 6,
  totalCost: 56,
  unitCost: 5.6,
  suggestedPrice: 6.72,
  createdAt: "2026-09-21T00:00:00.000Z",
  updatedAt: "2026-09-21T00:00:00.000Z",
};

vi.mock("@/lib/db", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    db: {
      ...actual.db,
      init: vi.fn(async () => {}),
      listEntities: vi.fn(async () => []),
      listItems: vi.fn(async () => []),
      getSettings: vi.fn(async () => ({
        id: "app",
        localCurrency: "SAR",
        foreignCurrency: "USD",
        defaultExchangeRate: 3.75,
        defaultCustomsRate: 0.12,
        defaultMarginRate: 0.2,
        companyName: "",
        mainActivity: "import-export",
        customActivity: "",
        updatedAt: "2026-09-21",
      })),
      listQuickCalculations: mockListDrafts,
      deleteQuickCalculation: mockDeleteDraft,
    },
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

function renderQuickCalculator() {
  return render(
    <ThemeProvider defaultTheme="light">
      <LanguageProvider>
        <ActivityThemeProvider>
          <WorkspacePreferencesProvider>
            <LoginBackgroundProvider>
              <AccessProvider>
                <QuickCalculator />
              </AccessProvider>
            </LoginBackgroundProvider>
          </WorkspacePreferencesProvider>
        </ActivityThemeProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

describe("حذف مسودات الحاسبة السريعة", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDrafts.mockResolvedValue([draft]);
    mockDeleteDraft.mockResolvedValue(undefined);
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  });

  afterEach(() => cleanup());

  it("يحذف المسودة من التخزين والقائمة بعد التأكيد", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const user = userEvent.setup();
    renderQuickCalculator();

    await screen.findByText("صنف تجريبي");
    await user.click(screen.getByRole("button", { name: "حذف المسودة" }));

    expect(mockDeleteDraft).toHaveBeenCalledWith("quick-1");
    await waitFor(() => expect(screen.queryByText("صنف تجريبي")).toBeNull());
  });

  it("يبقي المسودة عند إلغاء التأكيد", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const user = userEvent.setup();
    renderQuickCalculator();

    await screen.findByText("صنف تجريبي");
    await user.click(screen.getByRole("button", { name: "حذف المسودة" }));

    expect(mockDeleteDraft).not.toHaveBeenCalled();
    expect(screen.getByText("صنف تجريبي")).toBeTruthy();
  });
});
