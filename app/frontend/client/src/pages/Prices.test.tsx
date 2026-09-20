/**
 * @vitest-environment jsdom
 *
 * انحدار علة "تبديل الأسعار": تبديل الصنف في نموذج الأسعار دون حفظ
 * كان يُبقي قيم المستويات من الصنف السابق (لقطات المستخدم الثلاث).
 * يحاكي خطوات البريف حرفياً: A(3.7) → B(5) → A(3.7).
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AccessProvider } from "@/contexts/AccessContext";
import { ActivityThemeProvider } from "@/contexts/ActivityThemeContext";
import { LoginBackgroundProvider } from "@/contexts/LoginBackgroundContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WorkspacePreferencesProvider } from "@/contexts/WorkspacePreferencesContext";
import Prices from "./Prices";
import type { ItemPriceRow, ItemRow } from "@/lib/db";

vi.mock("@/lib/db", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  const items: ItemRow[] = [
    {
      id: "item-a",
      name: "بينجو . فينيل",
      code: "34",
      category: "فينيل",
      entityId: null,
      unit: "متر مربع",
      currency: "USD",
      defaultExchangeRate: 3.7585,
      customsRate: null,
      notes: "",
      createdAt: "2026-09-18",
      updatedAt: "2026-09-18",
    },
    {
      id: "item-b",
      name: "انطوليا",
      code: "123",
      category: "عام",
      entityId: null,
      unit: "متر مربع",
      currency: "USD",
      defaultExchangeRate: 3.7585,
      customsRate: null,
      notes: "",
      createdAt: "2026-09-18",
      updatedAt: "2026-09-18",
    },
  ];
  const prices: ItemPriceRow[] = [
    {
      id: "prc-a",
      itemId: "item-a",
      price1: 3.7,
      price1Date: "2026-09-18",
      price2: null,
      price2Date: "",
      price3: null,
      price3Date: "",
      price4: null,
      price4Date: "",
      currency: "USD",
      notes: "",
      createdAt: "2026-09-18",
      updatedAt: "2026-09-18",
    },
    {
      id: "prc-b",
      itemId: "item-b",
      price1: 5,
      price1Date: "2026-09-18",
      price2: null,
      price2Date: "",
      price3: null,
      price3Date: "",
      price4: null,
      price4Date: "",
      currency: "USD",
      notes: "",
      createdAt: "2026-09-18",
      updatedAt: "2026-09-18",
    },
  ];
  return {
    ...actual,
    db: {
      ...actual.db,
      init: vi.fn(async () => {}),
      listItems: vi.fn(async () => items),
      listEntities: vi.fn(async () => []),
      listPrices: vi.fn(async () => prices),
      listPriceHistory: vi.fn(async () => []),
      listSpecsByItem: vi.fn(async () => []),
      getPriceByItem: vi.fn(async (id: string) => prices.find(p => p.itemId === id) ?? null),
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
        updatedAt: "2026-09-18",
      })),
      savePrice: vi.fn(async () => {}),
      saveItem: vi.fn(async () => {}),
      savePriceHistory: vi.fn(async () => {}),
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

describe("تبديل الصنف في نموذج الأسعار دون حفظ", () => {
  afterEach(() => {
    cleanup();
  });
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    // تهيئة مسودة الجلسة كما لو كان المستخدم يعرض الصنف A مسبقاً (سيناريو اللقطات)
    window.sessionStorage.setItem(
      "smart-trader:draft:prices-item",
      JSON.stringify("item-a")
    );
    window.sessionStorage.setItem(
      "smart-trader:draft:prices-values",
      JSON.stringify([
        { price: "3.7", date: "2026-09-18", source: "" },
        { price: "", date: "2026-09-18", source: "" },
        { price: "", date: "2026-09-18", source: "" },
        { price: "", date: "2026-09-18", source: "" },
      ])
    );
    vi.stubGlobal(
      "ResizeObserver",
      MockResizeObserver as unknown as typeof ResizeObserver
    );
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = (() => {}) as typeof Element.prototype.scrollIntoView;
    }
  });

  it("يعرض دائماً قيم الصنف المحدد حالياً لا السابق", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="light">
        <LanguageProvider>
          <ActivityThemeProvider>
            <WorkspacePreferencesProvider>
              <LoginBackgroundProvider>
                <AccessProvider>
                  <Prices />
                </AccessProvider>
              </LoginBackgroundProvider>
            </WorkspacePreferencesProvider>
          </ActivityThemeProvider>
        </LanguageProvider>
      </ThemeProvider>
    );

    const level1Value = async () => {
      await waitFor(() => {
        if (!document.getElementById("price-amount-1")) {
          throw new Error("level 1 input not mounted yet");
        }
      });
      return (document.getElementById("price-amount-1") as HTMLInputElement).value;
    };

    const pickItem = async (name: string) => {
      const triggers = screen.getAllByRole("combobox");
      const picker = triggers.find(el => el.tagName === "BUTTON");
      if (!picker) throw new Error("item picker trigger not found");
      await user.click(picker);
      const listbox = await screen.findByRole("listbox");
      await user.click(within(listbox).getByText(name));
    };

    // 1+2: اللوحة معروضة مسبقاً بصنف A → الحقل = 3.7
    expect(await level1Value()).toBe("3.7");

    // 3+4: تبديل لـ B دون حفظ → الحقل = 5 بالضبط لا 3.7
    await pickItem("انطوليا");
    expect(await level1Value()).toBe("5");

    // 5+6: رجوع لـ A → الحقل = 3.7 بالضبط لا 5
    await pickItem("بينجو . فينيل");
    expect(await level1Value()).toBe("3.7");
  });
});
