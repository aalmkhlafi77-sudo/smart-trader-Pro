import { describe, expect, it } from "vitest";
import type { PriceListItemRow, PriceListRow } from "@/lib/db";
import { latestSaleListPrices } from "./exportSalePrices";

const list = (id: string, createdAt: string, currency = "SAR"): PriceListRow => ({
  id,
  title: id,
  clientName: "",
  priceLevel: 1,
  currency,
  notes: "",
  createdAt,
  updatedAt: createdAt,
});

const item = (
  id: string,
  priceListId: string,
  itemId: string,
  price: number,
  currency = "SAR"
): PriceListItemRow => ({
  id,
  priceListId,
  itemId,
  itemName: itemId,
  specSummary: "",
  price,
  currency,
  sortOrder: 0,
  createdAt: "2026-09-21T00:00:00.000Z",
  updatedAt: "2026-09-21T00:00:00.000Z",
});

describe("latestSaleListPrices", () => {
  it("يعرض أحدث سعر بيع محفوظ للصنف من قوائم البيع المستقلة", () => {
    const prices = latestSaleListPrices(
      [
        list("old", "2026-09-20T00:00:00.000Z", "USD"),
        list("new", "2026-09-21T00:00:00.000Z", "SAR"),
      ],
      [
        item("old-item", "old", "item-miral", 8.65, "USD"),
        item("new-item", "new", "item-miral", 32.5, "SAR"),
      ]
    );

    expect(prices["item-miral"]).toEqual({ price: 32.5, currency: "SAR" });
  });
});
