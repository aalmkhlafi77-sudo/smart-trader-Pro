/**
 * @vitest-environment jsdom
 *
 * انحدار علة "آثار الحذف": حذف ملف حمولة يجب أن يمسح مسودة الجلسة
 * التي تشير إليه، وإلا عاد الملف للظهور في /cargo وأحياه أول حفظ.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AccessProvider } from "@/contexts/AccessContext";
import { ActivityThemeProvider } from "@/contexts/ActivityThemeContext";
import { LoginBackgroundProvider } from "@/contexts/LoginBackgroundContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WorkspacePreferencesProvider } from "@/contexts/WorkspacePreferencesContext";
import Runs from "./Runs";
import type { CargoCostRunRow } from "@/lib/db";

const { mockDeleteRun, mockListRuns } = vi.hoisted(() => ({
  mockDeleteRun: vi.fn(),
  mockListRuns: vi.fn(),
}));

const DRAFT_KEY = "smart-trader:draft:cargo-pricing";

const runRow = (patch: Partial<CargoCostRunRow> = {}): CargoCostRunRow => ({
  id: "run-x",
  name: "حمولة تجريبية",
  reference: "",
  operationType: "import",
  entityId: null,
  status: "draft",
  parentRunId: "",
  version: 1,
  currency: "SAR",
  marginRate: 0.2,
  customsBaseExtra: 0,
  routeTemplateId: "",
  originLocationId: "",
  unloadingLocationId: "",
  deliveryLocationId: "",
  incoterm: "FOB",
  transportMode: "بحري",
  clearanceOffice: "",
  invoiceValue: 0,
  customsBase: 0,
  customsAmount: 0,
  totalCost: 0,
  totalSuggestedRevenue: 0,
  notes: "",
  approvedAt: "",
  createdAt: "2026-09-20",
  updatedAt: "2026-09-20",
  ...patch,
});

vi.mock("@/lib/db", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    db: {
      ...actual.db,
      init: vi.fn(async () => {}),
      listCargoCostRuns: mockListRuns,
      deleteCargoCostRun: mockDeleteRun,
      getSettings: vi.fn(async () => ({
        id: "app",
        localCurrency: "SAR",
        foreignCurrency: "USD",
        defaultExchangeRate: 3.7585,
        defaultCustomsRate: 0.12,
        defaultMarginRate: 0.2,
        companyName: "",
        mainActivity: "import-export",
        customActivity: "",
        updatedAt: "2026-09-20",
      })),
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

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderRuns() {
  return render(
    <ThemeProvider defaultTheme="light">
      <LanguageProvider>
        <ActivityThemeProvider>
          <WorkspacePreferencesProvider>
            <LoginBackgroundProvider>
              <AccessProvider>
                <Runs />
              </AccessProvider>
            </LoginBackgroundProvider>
          </WorkspacePreferencesProvider>
        </ActivityThemeProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

describe("حذف ملف الحمولة ينظف مسودته من الجلسة", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal(
      "ResizeObserver",
      MockResizeObserver as unknown as typeof ResizeObserver
    );
    mockListRuns.mockResolvedValue([runRow()]);
    mockDeleteRun.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("حذف الملف المفتوح في المسودة يمسح المسودة فلا يعود شبحاً", async () => {
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ runId: "run-x", name: "حمولة تجريبية", items: [], costs: [] })
    );
    const user = userEvent.setup();
    renderRuns();

    await screen.findByText("حمولة تجريبية");
    await user.click(
      screen.getByRole("button", { name: "حذف ملف الحمولة" })
    );
    await user.click(screen.getByRole("button", { name: "حذف" }));

    expect(mockDeleteRun).toHaveBeenCalledWith("run-x");
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("حذف ملف معتمد مرفوض ولا يمس المسودة", async () => {
    mockListRuns.mockResolvedValue([runRow({ id: "run-a", status: "approved" })]);
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ runId: "run-a", name: "x", items: [], costs: [] })
    );
    const user = userEvent.setup();
    renderRuns();

    await screen.findByText("حمولة تجريبية");
    await user.click(
      screen.getByRole("button", { name: "حذف ملف الحمولة" })
    );
    await user.click(screen.getByRole("button", { name: "حذف" }));

    expect(mockDeleteRun).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });
});
