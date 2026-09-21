import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import type { CargoCostRunRow, EntityRow, ItemPriceRow, ItemRow } from "@/lib/db";
import { buildExcelImportPlan, parseExcelWorkbook, type ExcelImportContext } from "./excelImport";

const entity: EntityRow = {
  id: "entity-supplier",
  name: "اريكس",
  kind: "supplier",
  country: "",
  city: "",
  phone: "",
  email: "",
  contactPerson: "",
  notes: "",
  defaultCurrency: "USD",
  defaultExchangeRate: 3.75,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const item: ItemRow = {
  id: "item-plywood",
  name: "بوليود",
  code: "PLY-001",
  category: "خشب",
  entityId: entity.id,
  unit: "قطعة",
  currency: "USD",
  defaultExchangeRate: 3.75,
  customsRate: 0.12,
  notes: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const cargo: CargoCostRunRow = {
  id: "cargo-1",
  name: "حمولة يناير",
  reference: "CARGO-001",
  operationType: "import",
  entityId: entity.id,
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
  incoterm: "",
  transportMode: "",
  clearanceOffice: "",
  invoiceValue: 0,
  customsBase: 0,
  customsAmount: 0,
  totalCost: 0,
  totalSuggestedRevenue: 0,
  notes: "",
  approvedAt: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const context: ExcelImportContext = {
  entities: [entity],
  items: [item],
  prices: [] as ItemPriceRow[],
  cargoRuns: [cargo],
  now: "2026-02-01T00:00:00.000Z",
};

function workbookBuffer() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([{ المعرف: "new-entity", الاسم: "مصنع جديد", النوع: "factory" }]),
    "الجهات"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([{ الكود: "PLY-001", الاسم: "بوليود", سعر1: 5, تاريخ1: "2026-02-01" }]),
    "الأصناف"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([{ itemCode: "PLY-001", price1: 5.85, price1Date: "2026-02-01", currency: "USD" }]),
    "أسعار الموردين"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([{ itemCode: "PLY-001", label: "السمك", value: 18, unit: "مم" }]),
    "المواصفات"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([{ cargoReference: "CARGO-001", name: "نقل داخلي", stage: "warehouse", amount: 400 }]),
    "المصاريف"
  );
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

describe("excel import", () => {
  it("builds a validated plan and keeps supplier prices out of sale lists", () => {
    const plan = buildExcelImportPlan(parseExcelWorkbook(workbookBuffer()), context, { duplicateMode: "update" });

    expect(plan.errors).toEqual([]);
    expect(plan.entities).toHaveLength(1);
    expect(plan.itemPrices[0].itemId).toBe(item.id);
    expect(plan.priceHistory[0].price).toBe(5.85);
    expect(plan.priceLists).toEqual([]);
    expect(plan.cargoCostLines[0].runId).toBe(cargo.id);
  });

  it("rejects unknown item and cargo references before any write plan is accepted", () => {
    const workbook = parseExcelWorkbook(workbookBuffer());
    workbook.sheets["أسعار الموردين"][0].itemCode = "UNKNOWN";
    workbook.sheets["المصاريف"][0].cargoReference = "UNKNOWN-CARGO";

    const plan = buildExcelImportPlan(workbook, context, { duplicateMode: "update" });

    expect(plan.errors.map(error => error.sheet)).toEqual(["أسعار الموردين", "المصاريف"]);
    expect(plan.canApply).toBe(false);
  });

  it("does not match an existing item by name when no stable code is supplied", () => {
    const workbook = parseExcelWorkbook(workbookBuffer());
    workbook.sheets["الأصناف"] = [{ الاسم: "بوليود", الوحدة: "قطعة" }];

    const plan = buildExcelImportPlan(workbook, context, { duplicateMode: "update" });

    expect(plan.warnings.some(warning => warning.includes("معرف") || warning.includes("كود"))).toBe(true);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].id).not.toBe(item.id);
  });
});
