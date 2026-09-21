/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { ReportRow } from "./reportModel";
import { useReportExport } from "./useReportExport";

const { mockExportExcel, mockExportPdf } = vi.hoisted(() => ({
  mockExportExcel: vi.fn(),
  mockExportPdf: vi.fn(),
}));

vi.mock("@/lib/exporters", () => ({
  exportExcel: mockExportExcel,
  exportPdf: mockExportPdf,
}));

const row: ReportRow = {
  item: {
    id: "item-1",
    name: "صنف اختبار",
    code: "ITEM-1",
    category: "أكياس",
    entityId: null,
    unit: "كرتون",
    currency: "USD",
    defaultExchangeRate: 3.75,
    customsRate: null,
    notes: "",
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  },
  entity: null,
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

function ExportHarness() {
  const { exportReportExcel, exportReportPdf } = useReportExport([row], {
    item: true,
    entity: false,
    category: false,
    weight: false,
    material: false,
    type: false,
    supplierPrice: false,
    unitCost: false,
    suggestedPrice: true,
    margin: false,
    createdAt: false,
  });

  return (
    <>
      <button onClick={exportReportExcel}>Excel</button>
      <button onClick={exportReportPdf}>PDF</button>
    </>
  );
}

beforeEach(() => {
  mockExportExcel.mockReset();
  mockExportPdf.mockReset();
  window.localStorage.clear();
  window.localStorage.setItem("smart-trader:ui-language", "ar");
});

afterEach(() => {
  cleanup();
});

describe("تصدير أعمدة تحليل الأصناف", () => {
  it("يرسل الأعمدة الظاهرة فقط إلى Excel وPDF", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <ExportHarness />
      </LanguageProvider>
    );

    await user.click(screen.getByRole("button", { name: "Excel" }));
    await user.click(screen.getByRole("button", { name: "PDF" }));

    expect(mockExportExcel.mock.calls[0][0].header).toEqual([
      "الصنف",
      "سعر البيع",
    ]);
    expect(mockExportPdf.mock.calls[0][0].header).toEqual([
      "الصنف",
      "سعر البيع",
    ]);
    expect(mockExportExcel.mock.calls[0][0].rows).toEqual([
      ["صنف اختبار", "8.65 SAR"],
    ]);
    expect(mockExportPdf.mock.calls[0][0].rows).toEqual([
      ["صنف اختبار", "8.65 SAR"],
    ]);
    expect(mockExportPdf.mock.calls[0][0].footerNote).toBeUndefined();
  });
});
