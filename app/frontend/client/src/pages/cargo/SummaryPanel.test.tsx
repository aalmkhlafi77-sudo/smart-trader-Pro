/**
 * @vitest-environment jsdom
 *
 * اختبار تكامل لمسار حفظ أسعار البيع عبر الأزرار الحقيقية
 * (سيناريو صنفي تركواز/تيفاني): النقر على مربع اختيار صنف واحد
 * ثم زر "حفظ المختار فقط" يجب أن ينشئ قائمة بيع محلية للصنف المحدد
 * من دون أي كتابة في مستويات أسعار المورد.
 */
import { useState } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { SummaryPanel } from "./SummaryPanel";
import { persistSalePrices } from "./cargoPersistence";
import type { CargoCostItemRow } from "@/lib/db";
import type { CargoPricingResult } from "@/lib/cargoPricing";

const {
  mockSavePrice,
  mockSavePriceHistory,
  mockSavePriceList,
  mockSavePriceListItem,
} = vi.hoisted(() => ({
  mockSavePrice: vi.fn(),
  mockSavePriceHistory: vi.fn(),
  mockSavePriceList: vi.fn(),
  mockSavePriceListItem: vi.fn(),
}));

vi.mock("@/lib/db", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    db: {
      ...actual.db,
      savePrice: mockSavePrice,
      savePriceHistory: mockSavePriceHistory,
      savePriceList: mockSavePriceList,
      savePriceListItem: mockSavePriceListItem,
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

afterEach(() => {
  cleanup();
});

const t = (key: string) => key;

const cargoItem = (patch: Partial<CargoCostItemRow>): CargoCostItemRow => ({
  id: `ci-${patch.itemId ?? "x"}`,
  runId: "run-1",
  itemId: "item-x",
  itemName: "x",
  priceLevel: 1,
  priceSource: "latest-dated",
  priceEffectiveDate: "2026-09-18",
  unitPrice: 0,
  currency: "USD",
  exchangeRate: 3.7585,
  quantity: 100,
  unit: "unit",
  customsCategory: "",
  customsRate: 0.12,
  goodsValue: 0,
  allocatedCost: 0,
  finalUnitCost: 0,
  suggestedPrice: 0,
  createdAt: "",
  updatedAt: "",
  ...patch,
});

const TQZ = {
  item: cargoItem({ itemId: "item-tqz", itemName: "تركواز", unitPrice: 7.4 }),
  suggested: 33.31,
  converted: 8.86,
};
const TFN = {
  item: cargoItem({ itemId: "item-tfn", itemName: "تيفاني", unitPrice: 8.1 }),
  suggested: 35.86,
  converted: 9.54,
};

const resultOf = (entries: { itemId: string; suggested: number }[]): CargoPricingResult => ({
  invoiceValue: 0,
  customsBase: 0,
  customsAmount: 0,
  sharedCosts: 0,
  totalCost: 0,
  totalSuggestedRevenue: 0,
  allocations: [],
  items: entries.map(e => ({
    itemId: e.itemId,
    goodsValue: 0,
    customsAmount: 0,
    allocatedCost: 0,
    finalCost: 0,
    unitCost: 0,
    suggestedPrice: e.suggested,
  })),
  stageTotals: { factory: 0, port: 0, customs: 0, warehouse: 0, other: 0 },
});

function Harness() {
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const saveRows = [TQZ, TFN].map(e => ({
    itemId: e.item.itemId,
    name: e.item.itemName,
    suggested: e.suggested,
    converted: e.converted,
    currency: "USD",
  }));
  return (
    <LanguageProvider>
      <SummaryPanel
        result={resultOf([
          { itemId: "item-tqz", suggested: TQZ.suggested },
          { itemId: "item-tfn", suggested: TFN.suggested },
        ])}
        localCurrency="SAR"
        marginRate="20"
        onMarginChange={() => {}}
        canSavePrices
        showPriceSave
        onTogglePriceSave={() => {}}
        saveRows={saveRows}
        priceSaveSelection={selection}
        onToggleSelect={(id, v) => setSelection(s => ({ ...s, [id]: v }))}
        onSaveSelected={() =>
          void persistSalePrices({
            items: [TQZ.item, TFN.item],
            saveRows,
            selection,
            fileName: "test-file",
            localCurrency: "SAR",
            t,
          })
        }
      />
    </LanguageProvider>
  );
}

async function checkOnly(itemName: string) {
  const user = userEvent.setup();
  render(<Harness />);
  const label = screen.getByText(itemName, { exact: false });
  const rowEl = label.closest("div");
  if (!rowEl) throw new Error("save row not found");
  await user.click(within(rowEl as HTMLElement).getByRole("checkbox"));
  await user.click(
    screen.getByRole("button", { name: /حفظ المختار فقط/ })
  );
}

describe("حفظ أسعار البيع من الأزرار الحقيقية يعزل الأصناف", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal(
      "ResizeObserver",
      MockResizeObserver as unknown as typeof ResizeObserver
    );
  });

  it("تحديد تيفاني فقط يحفظ سعر بيعها المحلي ويترك أسعار المورد untouched", async () => {
    render(<Harness />);
    expect(screen.queryByRole("combobox")).toBeNull();
    cleanup();
    await checkOnly("تيفاني");

    expect(mockSavePrice).not.toHaveBeenCalled();
    expect(mockSavePriceHistory).not.toHaveBeenCalled();
    expect(mockSavePriceList).toHaveBeenCalledTimes(1);
    expect(mockSavePriceListItem).toHaveBeenCalledTimes(1);
    expect(mockSavePriceListItem.mock.calls[0][0]).toMatchObject({
      itemId: "item-tfn",
      price: 35.86,
      currency: "SAR",
    });
  });

  it("تحديد تركواز فقط يحفظ تركواز في قائمة البيع دون تيفاني", async () => {
    await checkOnly("تركواز");

    expect(mockSavePrice).not.toHaveBeenCalled();
    expect(mockSavePriceHistory).not.toHaveBeenCalled();
    expect(mockSavePriceListItem).toHaveBeenCalledTimes(1);
    expect(mockSavePriceListItem.mock.calls[0][0]).toMatchObject({
      itemId: "item-tqz",
      price: 33.31,
      currency: "SAR",
    });
  });
});
