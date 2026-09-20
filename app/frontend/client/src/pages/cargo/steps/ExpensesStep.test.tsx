/**
 * @vitest-environment jsdom
 *
 * إثبات المسار اليدوي: زر "إضافة بند يدوي" يفتح ورقة بكامل الحقول،
 * وتعبئتها وحفظها تُلحق بنداً حقيقياً بالمسودة عبر onUpdateDraft.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ExpensesStep } from "./ExpensesStep";
import type { CargoDraft } from "../shared";

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

const emptyDraft: CargoDraft = {
  runId: "",
  parentRunId: "",
  version: 1,
  name: "",
  reference: "",
  operationType: "import",
  entityId: "",
  status: "draft",
  marginRate: "20",
  customsBaseExtra: "",
  routeTemplateId: "",
  originLocationId: "",
  unloadingLocationId: "",
  deliveryLocationId: "",
  incoterm: "FOB",
  transportMode: "بحري",
  clearanceOffice: "",
  notes: "",
  itemSearch: "",
  newItemId: "",
  items: [],
  costs: [],
};

describe("المسار اليدوي لإضافة بند تكلفة", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal(
      "ResizeObserver",
      MockResizeObserver as unknown as typeof ResizeObserver
    );
  });

  it("الزر يفتح الورقة والحفظ يُلحق البند بالمسودة", async () => {
    const user = userEvent.setup();
    const onUpdateDraft = vi.fn();
    render(
      <LanguageProvider>
        <ExpensesStep
          draft={emptyDraft}
          localCurrency="SAR"
          foreignCurrency="USD"
          defaultExchangeRate={3.7585}
          itemNames={[]}
          onUpdateDraft={onUpdateDraft}
          onUpdateCost={() => {}}
          onToggleCost={() => {}}
        />
      </LanguageProvider>
    );

    await user.click(
      screen.getByRole("button", { name: /إضافة بند يدوي/ })
    );
    const nameInput = await screen.findByLabelText("البند", { exact: false });
    await user.type(nameInput, "نقل إضافي");
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /إضافة بند يدوي/ })
    );

    expect(onUpdateDraft).toHaveBeenCalledTimes(1);
    const patch = onUpdateDraft.mock.calls[0][0] as Partial<CargoDraft>;
    expect(patch.costs).toHaveLength(1);
    expect(patch.costs?.[0]).toMatchObject({
      name: "نقل إضافي",
      stage: "other",
      status: "entered",
      method: "fixed",
      currency: "SAR",
    });
  });
});
