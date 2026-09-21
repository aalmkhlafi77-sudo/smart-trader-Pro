import type { PriceListItemRow, PriceListRow } from "@/lib/db";

export interface SavedSalePrice {
  price: number | null;
  currency: string;
}

/** أحدث سعر بيع محفوظ لكل صنف، وفق تاريخ آخر قائمة أسعار. */
export function latestSaleListPrices(
  lists: PriceListRow[],
  items: PriceListItemRow[]
): Record<string, SavedSalePrice> {
  const listById = new Map(lists.map(list => [list.id, list]));
  const ordered = [...items].sort((a, b) => {
    const listA = listById.get(a.priceListId);
    const listB = listById.get(b.priceListId);
    const dateA = listA?.updatedAt || listA?.createdAt || a.updatedAt;
    const dateB = listB?.updatedAt || listB?.createdAt || b.updatedAt;
    return dateB.localeCompare(dateA) || b.updatedAt.localeCompare(a.updatedAt);
  });
  const result: Record<string, SavedSalePrice> = {};
  for (const item of ordered) {
    const list = listById.get(item.priceListId);
    if (!list || result[item.itemId]) continue;
    result[item.itemId] = {
      price: item.price,
      currency: item.currency || list.currency,
    };
  }
  return result;
}
