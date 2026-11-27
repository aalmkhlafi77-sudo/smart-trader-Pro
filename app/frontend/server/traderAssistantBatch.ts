import { randomUUID } from "node:crypto";
import type { BackupPayload } from "../client/src/lib/db/repository";
import {
  DEFAULT_CURRENCIES,
  type EntityRow, type ItemRow, type ItemPriceRow, type PriceLevel,
} from "../client/src/lib/db/schema";
import type { PreviewRow, TraderApprovalResult, TraderBatch } from "../shared/traderAssistant";

export class TraderAssistantError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const same = (left: string, right: string) => normalize(left) === normalize(right);

function unique<T>(matches: T[], label: string) {
  if (matches.length > 1) throw new TraderAssistantError(422, `يوجد أكثر من سجل مطابق لـ«${label}». حدّد الاسم أو الرمز بدقة.`);
  return matches[0];
}

export function prepareTraderBatch(original: BackupPayload, batch: TraderBatch, now = new Date().toISOString()) {
  const { tables } = original;
  const entities = [...tables.entities];
  const items = [...tables.items];
  const prices = [...tables.item_prices];
  const history = [...tables.price_history];
  const rows: PreviewRow[] = [];
  const itemIds: string[] = [];
  const records: TraderApprovalResult["records"] = [];
  const settings = tables.settings[0];
  const currencies = new Set((tables.currencies.length ? tables.currencies : DEFAULT_CURRENCIES)
    .filter(row => row.active).map(row => row.code));
  const defaultCurrency = settings?.foreignCurrency || "USD";
  const rate = settings?.defaultExchangeRate || 0;
  const kinds = { supplier: "مورد", factory: "مصنع", customer: "عميل", other: "أخرى" };
  const ensureCurrency = (currency: string) => {
    if (!currencies.has(currency)) throw new TraderAssistantError(422, `العملة ${currency} غير مفعّلة في التطبيق.`);
    return currency;
  };

  for (const entry of batch.entities) {
    const found = unique(entities.filter(row => same(row.name, entry.name)), entry.name);
    if (found && found.kind !== entry.kind) {
      throw new TraderAssistantError(422, `الجهة «${entry.name}» مسجلة بنوع مختلف. راجع النوع في المعاينة.`);
    }
    if (!found) {
      const row: EntityRow = {
        id: randomUUID(), name: entry.name, kind: entry.kind, country: "", city: "", phone: "", email: "",
        contactPerson: "", notes: "", defaultCurrency: ensureCurrency(defaultCurrency),
        defaultExchangeRate: rate, createdAt: now, updatedAt: now,
      };
      entities.unshift(row);
      records.push({ section: "entities", id: row.id, name: row.name });
    }
    rows.push({ type: "entity", name: entry.name, outcome: found ? "reuse" : "create", detail: kinds[entry.kind] });
  }

  for (const entry of batch.items) {
    const entity = entry.entityName ? unique(entities.filter(row => same(row.name, entry.entityName)), entry.entityName) : undefined;
    if (entry.entityName && !entity) {
      throw new TraderAssistantError(422, `أضف الجهة «${entry.entityName}» إلى الدفعة أو اختر جهة مسجّلة.`);
    }
    const matching = items.filter(row => row.entityId === (entity?.id ?? null) &&
      (same(row.name, entry.name) || Boolean(entry.code && row.code && same(row.code, entry.code))));
    const found = unique(matching, entry.name);
    if (found && (!same(found.name, entry.name) || (entry.code && !same(found.code, entry.code)))) {
      throw new TraderAssistantError(422, `اسم أو رمز «${entry.name}» يتعارض مع صنف موجود. صحّح الاسم والرمز في المعاينة.`);
    }
    if (entry.price && !entry.currency) throw new TraderAssistantError(422, `حدّد عملة سعر «${entry.name}».`);
    const currency = ensureCurrency(entry.currency || found?.currency || entity?.defaultCurrency || defaultCurrency);
    if (found && currency !== found.currency) {
      throw new TraderAssistantError(422, `العملة المسجّلة للصنف «${entry.name}» هي ${found.currency}. راجع عملة الصنف قبل الحفظ.`);
    }
    const item: ItemRow = found ?? {
      id: randomUUID(), name: entry.name, code: entry.code, category: "", entityId: entity?.id ?? null,
      unit: entry.unit || "قطعة", currency, defaultExchangeRate: entity?.defaultExchangeRate ?? rate,
      customsRate: null, notes: "", createdAt: now, updatedAt: now,
    };
    if (!found) {
      items.unshift(item);
      records.push({ section: "items", id: item.id, name: item.name });
    }
    rows.push({
      type: "item", name: item.name, outcome: found ? "reuse" : "create",
      detail: [item.code, entity?.name, item.unit, item.currency].filter(Boolean).join(" · "),
    });
    itemIds.push(item.id);
    if (!entry.price) continue;

    const { amount, date } = entry.price;
    const current = unique(prices.filter(row => row.itemId === item.id), item.name);
    const matchingHistory = history.find(row =>
      row.itemId === item.id && row.price === amount && row.effectiveDate === date && row.currency === currency
    );
    const levels: PriceLevel[] = [1, 2, 3, 4];
    const matchingCurrent = current?.currency === currency && levels.some(level =>
      current[`price${level}`] === amount && current[`price${level}Date`] === date
    );
    const detail = `${amount} ${currency} · ${date}`;
    if (matchingHistory || matchingCurrent) {
      rows.push({ type: "price", name: item.name, outcome: "reuse", detail });
      continue;
    }
    if (current && current.currency !== currency) {
      throw new TraderAssistantError(422, `عملة عروض «${item.name}» المسجّلة مختلفة. راجعها في شاشة الأسعار.`);
    }
    const slot = levels.find(level => current?.[`price${level}`] == null);
    if (!slot) throw new TraderAssistantError(422, `عروض «${item.name}» الأربعة مشغولة. راجعها في شاشة الأسعار قبل إضافة عرض آخر.`);
    const price: ItemPriceRow = {
      ...(current ?? {
        id: randomUUID(), itemId: item.id, price1: null, price1Date: "", price2: null, price2Date: "",
        price3: null, price3Date: "", price4: null, price4Date: "", currency, notes: "", createdAt: now,
      }),
      [`price${slot}`]: amount, [`price${slot}Date`]: date, updatedAt: now,
    };
    if (current) prices[prices.indexOf(current)] = price;
    else prices.unshift(price);
    history.unshift({
      id: randomUUID(), itemId: item.id, priceLevel: slot, price: amount,
      effectiveDate: date, currency, notes: "", createdAt: now,
    });
    records.push({ section: "prices", id: item.id, name: item.name });
    rows.push({ type: "price", name: item.name, outcome: "create", detail });
  }

  return {
    rows, itemIds,
    result: { created: records.length, records },
    payload: { ...original, exportedAt: now, tables: { ...tables, entities, items, item_prices: prices, price_history: history } },
  };
}
