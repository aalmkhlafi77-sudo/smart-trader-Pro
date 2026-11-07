import * as XLSX from "xlsx";
import type {
  CargoCostLineRow,
  CargoCostRunRow,
  EntityRow,
  ItemPriceRow,
  ItemRow,
  ItemSpecRow,
  PriceHistoryRow,
  PriceListRow,
} from "@/lib/db";
import { newId } from "@/lib/id";
import { exportWorkbook, type WorkbookSheetSpec } from "./exporters";

export type ExcelDuplicateMode = "add" | "update" | "skip";

export interface ExcelWorkbookData {
  sheets: Record<string, Array<Record<string, unknown>>>;
}

export interface ExcelImportContext {
  entities: EntityRow[];
  items: ItemRow[];
  prices: ItemPriceRow[];
  priceHistory?: PriceHistoryRow[];
  cargoRuns: CargoCostRunRow[];
  now?: string;
}

export interface ExcelImportError {
  sheet: string;
  row: number;
  message: string;
}

export interface ExcelImportPlan {
  entities: EntityRow[];
  items: ItemRow[];
  itemPrices: ItemPriceRow[];
  priceHistory: PriceHistoryRow[];
  itemSpecs: ItemSpecRow[];
  cargoCostLines: CargoCostLineRow[];
  priceLists: PriceListRow[];
  warnings: string[];
  errors: ExcelImportError[];
  counts: Record<string, number>;
  canApply: boolean;
}

const SHEET_ALIASES: Record<string, string[]> = {
  "الجهات": ["الجهات", "جهات", "entities", "partners"],
  "الأصناف": ["الأصناف", "اصناف", "items", "products"],
  "أسعار الموردين": ["أسعار الموردين", "اسعار الموردين", "supplier prices", "supplier_prices"],
  "المواصفات": ["المواصفات", "specifications", "specs"],
  "المصاريف": ["المصاريف", "expenses", "cargo expenses"],
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[\s_\-./()]+/g, "");

const text = (row: Record<string, unknown>, ...keys: string[]) => {
  const entries = Object.entries(row);
  const found = entries.find(([key]) => keys.some(alias => normalize(alias) === normalize(key)));
  return String(found?.[1] ?? "").trim();
};

const number = (row: Record<string, unknown>, ...keys: string[]) => {
  const value = text(row, ...keys);
  if (!value) return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const rate = (row: Record<string, unknown>, ...keys: string[]) => {
  const value = number(row, ...keys);
  return value != null && value > 1 ? value / 100 : value;
};

const date = (row: Record<string, unknown>, ...keys: string[]) => text(row, ...keys);

function canonicalSheetName(name: string) {
  const key = normalize(name);
  return Object.entries(SHEET_ALIASES).find(([, aliases]) => aliases.some(alias => normalize(alias) === key))?.[0] ?? name;
}

export function parseExcelWorkbook(source: ArrayBuffer | Uint8Array): ExcelWorkbookData {
  const workbook = XLSX.read(source, { type: "array", cellDates: false });
  const sheets: ExcelWorkbookData["sheets"] = {};
  for (const name of workbook.SheetNames) {
    sheets[canonicalSheetName(name)] = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[name],
      { defval: "", raw: true }
    );
  }
  return { sheets };
}

const entityKind = (value: string): EntityRow["kind"] => {
  if (["مورد", "supplier"].includes(value.toLowerCase())) return "supplier";
  if (["مصنع", "factory"].includes(value.toLowerCase())) return "factory";
  if (["عميل", "customer"].includes(value.toLowerCase())) return "customer";
  return "other";
};

const stage = (value: string): CargoCostLineRow["stage"] =>
  (["factory", "port", "customs", "warehouse", "other"] as const).includes(value as never)
    ? (value as CargoCostLineRow["stage"])
    : "other";

const method = (value: string): CargoCostLineRow["method"] =>
  (["fixed", "per-unit", "percentage", "manual", "included"] as const).includes(value as never)
    ? (value as CargoCostLineRow["method"])
    : "fixed";

const allocationBasis = (value: string): CargoCostLineRow["allocationBasis"] =>
  (["value", "quantity", "weight", "area", "volume", "manual"] as const).includes(value as never)
    ? (value as CargoCostLineRow["allocationBasis"])
    : "value";

function findItem(reference: string, items: ItemRow[]) {
  return items.find(item => item.id === reference || item.code === reference);
}

function findEntity(reference: string, entities: EntityRow[]) {
  const normalizedReference = normalize(reference);
  return entities.find(
    entity =>
      entity.id === reference ||
      normalize(entity.name) === normalizedReference
  );
}

function upsertPlanRow<T extends { id: string }>(rows: T[], row: T) {
  const index = rows.findIndex(current => current.id === row.id);
  if (index >= 0) rows[index] = row;
  else rows.push(row);
}

function nonEmptyText(raw: Record<string, unknown>, keys: string[], fallback = "") {
  const value = text(raw, ...keys);
  return value || fallback;
}

function hasSamePriceHistory(
  rows: PriceHistoryRow[],
  candidate: Omit<PriceHistoryRow, "id" | "createdAt">
) {
  return rows.some(
    row =>
      row.itemId === candidate.itemId &&
      row.priceLevel === candidate.priceLevel &&
      row.price === candidate.price &&
      row.effectiveDate === candidate.effectiveDate &&
      row.currency === candidate.currency
  );
}

function findCargo(reference: string, cargoRuns: CargoCostRunRow[]) {
  return cargoRuns.find(run => run.id === reference || run.reference === reference);
}

export function buildExcelImportPlan(
  workbook: ExcelWorkbookData,
  context: ExcelImportContext,
  options: { duplicateMode: ExcelDuplicateMode }
): ExcelImportPlan {
  const now = context.now ?? new Date().toISOString();
  const plan: ExcelImportPlan = {
    entities: [], items: [], itemPrices: [], priceHistory: [], itemSpecs: [],
    cargoCostLines: [], priceLists: [], warnings: [], errors: [], counts: {}, canApply: false,
  };
  const entities = [...context.entities];
  const items = [...context.items];
  const prices = [...context.prices];
  const priceHistory = [...(context.priceHistory ?? [])];
  const rows = (sheet: string) => workbook.sheets[sheet] ?? [];
  const duplicate = (sheet: string, row: number, message: string) => plan.warnings.push(`${sheet} صف ${row}: ${message}`);
  const error = (sheet: string, row: number, message: string) => plan.errors.push({ sheet, row, message });

  rows("الجهات").forEach((raw, index) => {
    const row = index + 2;
    const id = text(raw, "id", "المعرف", "معرف");
    const incomingName = text(raw, "name", "الاسم");
    const incomingKindText = text(raw, "kind", "النوع");
    const incomingKind = incomingKindText ? entityKind(incomingKindText) : undefined;
    const nameMatches = incomingName
      ? entities.filter(entity => normalize(entity.name) === normalize(incomingName))
      : [];
    const existing =
      (id ? entities.find(entity => entity.id === id) : undefined) ??
      (incomingName
        ? nameMatches.find(entity => !incomingKind || entity.kind === incomingKind) ??
          (!incomingKind && nameMatches.length === 1 ? nameMatches[0] : undefined)
        : undefined);

    if (existing && options.duplicateMode === "skip") {
      duplicate("الجهات", row, "تم تخطي سجل موجود");
      return;
    }
    if (existing && options.duplicateMode === "add") {
      error("الجهات", row, "الجهة موجودة بالفعل؛ استخدم التحديث أو غيّر الاسم/المعرف");
      return;
    }

    const timestamp = existing?.createdAt ?? now;
    const entity: EntityRow = {
      ...(existing ?? { id: id || newId("entity"), createdAt: timestamp }),
      name: incomingName || existing?.name || "",
      kind: incomingKind ?? existing?.kind ?? "other",
      country: nonEmptyText(raw, ["country", "الدولة"], existing?.country ?? ""),
      city: nonEmptyText(raw, ["city", "المدينة"], existing?.city ?? ""),
      phone: nonEmptyText(raw, ["phone", "الهاتف"], existing?.phone ?? ""),
      email: nonEmptyText(raw, ["email", "البريد"], existing?.email ?? ""),
      contactPerson: nonEmptyText(raw, ["contactPerson", "جهة الاتصال"], existing?.contactPerson ?? ""),
      notes: nonEmptyText(raw, ["notes", "ملاحظات"], existing?.notes ?? ""),
      defaultCurrency:
        text(raw, "defaultCurrency", "العملة") || existing?.defaultCurrency || "USD",
      defaultExchangeRate:
        number(raw, "defaultExchangeRate", "سعر الصرف") ??
        existing?.defaultExchangeRate ??
        1,
      updatedAt: now,
    };

    if (!entity.name) {
      error("الجهات", row, "اسم الجهة مطلوب");
      return;
    }

    upsertPlanRow(plan.entities, entity);
    const entityIndex = entities.findIndex(current => current.id === entity.id);
    if (entityIndex >= 0) entities[entityIndex] = entity;
    else entities.push(entity);
  });

  rows("الأصناف").forEach((raw, index) => {
    const row = index + 2;
    const id = text(raw, "id", "المعرف", "معرف");
    const code = text(raw, "code", "الكود", "رمز الصنف");
    const incomingName = text(raw, "name", "الاسم");
    const entityReference = text(
      raw,
      "entityId",
      "entityCode",
      "معرف الجهة",
      "كود الجهة",
      "اسم الجهة",
      "الجهة"
    );
    const linkedEntity = entityReference ? findEntity(entityReference, entities) : undefined;
    if (entityReference && !linkedEntity) {
      error("الأصناف", row, `الجهة غير معروفة: ${entityReference}`);
      return;
    }

    const stableMatch = items.find(
      item => (id && item.id === id) || (code && item.code === code)
    );
    const nameMatches = incomingName
      ? items.filter(item => normalize(item.name) === normalize(incomingName))
      : [];
    const nameMatch = linkedEntity
      ? nameMatches.find(item => (item.entityId ?? null) === linkedEntity.id)
      : nameMatches.length === 1
        ? nameMatches[0]
        : undefined;
    const existing = stableMatch ?? (!id && !code ? nameMatch : undefined);

    if (!id && !code && !existing && nameMatches.length > 1 && !linkedEntity) {
      error(
        "الأصناف",
        row,
        "يوجد أكثر من صنف بالاسم نفسه؛ أضف كود الصنف أو مرجع الجهة لتحديد المطابق"
      );
      return;
    }
    if (!id && !code && existing) {
      duplicate("الأصناف", row, "تمت المطابقة بالاسم والجهة لعدم وجود معرف أو كود");
    }
    if (existing && options.duplicateMode === "skip") {
      duplicate("الأصناف", row, "تم تخطي سجل موجود");
      return;
    }
    if (existing && options.duplicateMode === "add") {
      error("الأصناف", row, "الصنف موجود بالفعل؛ استخدم التحديث أو غيّر الكود/الاسم");
      return;
    }

    const timestamp = existing?.createdAt ?? now;
    const item: ItemRow = {
      ...(existing ?? { id: id || newId("item"), createdAt: timestamp }),
      name: incomingName || existing?.name || "",
      code: code || existing?.code || "",
      category: nonEmptyText(raw, ["category", "التصنيف"], existing?.category ?? ""),
      entityId: linkedEntity?.id ?? existing?.entityId ?? null,
      unit: nonEmptyText(raw, ["unit", "الوحدة"], existing?.unit ?? ""),
      currency: text(raw, "currency", "العملة") || existing?.currency || "USD",
      defaultExchangeRate:
        number(raw, "defaultExchangeRate", "سعر الصرف") ??
        existing?.defaultExchangeRate ??
        1,
      customsRate:
        rate(raw, "customsRate", "نسبة الجمارك") ??
        existing?.customsRate ??
        null,
      notes: nonEmptyText(raw, ["notes", "ملاحظات"], existing?.notes ?? ""),
      updatedAt: now,
    };

    if (!item.name) {
      error("الأصناف", row, "اسم الصنف مطلوب");
      return;
    }

    upsertPlanRow(plan.items, item);
    const itemIndex = items.findIndex(current => current.id === item.id);
    if (itemIndex >= 0) items[itemIndex] = item;
    else items.push(item);
  });

  rows("أسعار الموردين").forEach((raw, index) => {
    const row = index + 2;
    const reference = text(raw, "itemId", "itemCode", "كود الصنف", "معرف الصنف");
    const item = findItem(reference, items);
    if (!item) {
      error("أسعار الموردين", row, `الصنف غير معروف: ${reference || "بدون كود"}`);
      return;
    }
    const existing = prices.find(price => price.itemId === item.id);
    if (existing && options.duplicateMode === "skip") {
      duplicate("أسعار الموردين", row, "تم تخطي أسعار موجودة");
      return;
    }
    if (existing && options.duplicateMode === "add") {
      error("أسعار الموردين", row, "سعر المورد للصنف موجود؛ استخدم تحديثاً أو مفتاح صنف فريداً");
      return;
    }
    const values = [1, 2, 3, 4].map(level => number(raw, `price${level}`, `سعر${level}`, `السعر${level}`));
    const dates = [1, 2, 3, 4].map(level => date(raw, `price${level}Date`, `تاريخ${level}`, `تاريخ السعر${level}`) || now.slice(0, 10));
    const price: ItemPriceRow = {
      ...(existing ?? { id: newId("price"), itemId: item.id, createdAt: now }),
      itemId: item.id,
      price1: values[0] ?? existing?.price1 ?? null, price1Date: dates[0] || existing?.price1Date || "",
      price2: values[1] ?? existing?.price2 ?? null, price2Date: dates[1] || existing?.price2Date || "",
      price3: values[2] ?? existing?.price3 ?? null, price3Date: dates[2] || existing?.price3Date || "",
      price4: values[3] ?? existing?.price4 ?? null, price4Date: dates[3] || existing?.price4Date || "",
      currency: text(raw, "currency", "العملة") || item.currency,
      notes: text(raw, "notes", "ملاحظات"), updatedAt: now,
    };
    upsertPlanRow(plan.itemPrices, price);
    const priceIndex = prices.findIndex(current => current.itemId === item.id);
    if (priceIndex >= 0) prices[priceIndex] = price;
    else prices.push(price);

    values.forEach((value, level) => {
      if (value == null) return;
      const candidate = {
        itemId: item.id,
        priceLevel: (level + 1) as 1 | 2 | 3 | 4,
        price: value,
        effectiveDate: dates[level],
        currency: price.currency,
        notes: price.notes,
      };
      if (hasSamePriceHistory(priceHistory, candidate)) return;
      const historyRow: PriceHistoryRow = {
        id: newId("price-history"),
        ...candidate,
        createdAt: now,
      };
      plan.priceHistory.push(historyRow);
      priceHistory.push(historyRow);
    });
  });

  rows("المواصفات").forEach((raw, index) => {
    const row = index + 2;
    const reference = text(raw, "itemId", "itemCode", "كود الصنف", "معرف الصنف");
    const item = findItem(reference, items);
    if (!item) {
      error("المواصفات", row, `الصنف غير معروف: ${reference || "بدون كود"}`);
      return;
    }
    const label = text(raw, "label", "الخاصية", "اسم المواصفة");
    if (!label) {
      error("المواصفات", row, "اسم المواصفة مطلوب");
      return;
    }
    plan.itemSpecs.push({
      id: newId("spec"), itemId: item.id, label, value: text(raw, "value", "القيمة"),
      unit: text(raw, "unit", "الوحدة"), sortOrder: number(raw, "sortOrder", "الترتيب") ?? (index + 1) * 10,
      isKey: number(raw, "isKey", "مميزة") ?? 0, createdAt: now, updatedAt: now,
    });
  });

  rows("المصاريف").forEach((raw, index) => {
    const row = index + 2;
    const reference = text(raw, "cargoReference", "cargoId", "مرجع الحمولة", "معرف الحمولة");
    const cargo = findCargo(reference, context.cargoRuns);
    if (!cargo) {
      error("المصاريف", row, `الحمولة غير معروفة: ${reference || "بدون مرجع"}`);
      return;
    }
    const amount = number(raw, "amount", "المبلغ", "القيمة");
    if (amount == null || amount < 0) {
      error("المصاريف", row, "قيمة المصروف مطلوبة وغير سالبة");
      return;
    }
    const itemReferenceText = text(raw, "itemIds", "أصناف");
    const itemReferences = itemReferenceText.split(/[|,]/).map(value => value.trim()).filter(Boolean);
    const linkedItems = itemReferences.map(reference => findItem(reference, items));
    if (linkedItems.some(item => !item)) {
      error("المصاريف", row, `الصنف المرتبط غير معروف: ${itemReferenceText}`);
      return;
    }
    plan.cargoCostLines.push({
      id: newId("cargo-line"), runId: cargo.id, name: text(raw, "name", "الاسم") || "مصروف مستورد",
      stage: stage(text(raw, "stage", "المرحلة")), status: "entered",
      method: method(text(raw, "method", "الطريقة")), allocationBasis: allocationBasis(text(raw, "allocationBasis", "أساس التوزيع")),
      currency: text(raw, "currency", "العملة") || cargo.currency, exchangeRate: number(raw, "exchangeRate", "سعر الصرف") ?? 1,
      amount, referenceQuantity: number(raw, "referenceQuantity", "الكمية المرجعية") ?? 0,
      referenceUnit: text(raw, "referenceUnit", "وحدة المرجع"), percentageBase: number(raw, "percentageBase", "أساس النسبة") ?? 0,
      itemIds: linkedItems.filter((item): item is ItemRow => Boolean(item)).map(item => item.id).join("|"), sourceLabel: text(raw, "sourceLabel", "المصدر"), rateId: "", templateId: "",
      effectiveDate: date(raw, "effectiveDate", "التاريخ") || now.slice(0, 10), reason: text(raw, "reason", "السبب"),
      sortOrder: (index + 1) * 10, createdAt: now, updatedAt: now,
    });
  });

  plan.counts = {
    entities: plan.entities.length, items: plan.items.length, itemPrices: plan.itemPrices.length,
    priceHistory: plan.priceHistory.length, itemSpecs: plan.itemSpecs.length, cargoCostLines: plan.cargoCostLines.length,
  };
  plan.canApply = plan.errors.length === 0;
  return plan;
}

export const excelImportTemplateSheets: WorkbookSheetSpec[] = [
  { sheetName: "الجهات", header: ["المعرف", "الاسم", "النوع", "الدولة", "المدينة", "الهاتف", "البريد", "جهة الاتصال", "العملة", "سعر الصرف", "ملاحظات"], rows: [] },
  { sheetName: "الأصناف", header: ["المعرف", "الكود", "الاسم", "التصنيف", "معرف الجهة", "الوحدة", "العملة", "سعر الصرف", "نسبة الجمارك", "ملاحظات"], rows: [] },
  { sheetName: "أسعار الموردين", header: ["معرف الصنف", "كود الصنف", "سعر1", "تاريخ1", "سعر2", "تاريخ2", "سعر3", "تاريخ3", "سعر4", "تاريخ4", "العملة", "ملاحظات"], rows: [] },
  { sheetName: "المواصفات", header: ["معرف الصنف", "كود الصنف", "اسم المواصفة", "القيمة", "الوحدة", "الترتيب", "مميزة"], rows: [] },
  { sheetName: "المصاريف", header: ["مرجع الحمولة", "الاسم", "المرحلة", "الطريقة", "أساس التوزيع", "العملة", "سعر الصرف", "المبلغ", "التاريخ", "السبب"], rows: [] },
];

export function exportExcelImportTemplate(fileName = "smart-trader-import-template") {
  exportWorkbook({ sheets: excelImportTemplateSheets, fileName });
}
