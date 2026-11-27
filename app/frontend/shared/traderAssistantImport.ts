import { z } from "zod";

export const MAX_TRADER_ATTACHMENT = 5 * 1024 * 1024;
export const traderFormats = ["xlsx", "pdf", "docx"] as const;
export const traderImportMode = z.enum(["records", "cost"]);
export type TraderImportMode = z.infer<typeof traderImportMode>;
export type TraderFormat = typeof traderFormats[number];

const numeric = z.number().nonnegative().max(1e12).nullable();
const text = z.string().trim().max(180);
export const traderCostDraft = z.strictObject({
  name: text,
  currency: text,
  items: z.array(z.strictObject({
    name: text, code: text, unit: text, currency: text,
    quantity: numeric, unitPrice: numeric, exchangeRate: numeric,
  })).max(30),
  expenses: z.array(z.strictObject({
    name: text, amount: numeric, currency: text, exchangeRate: numeric,
    basis: z.enum(["value", "quantity"]),
  })).max(30),
});
export type TraderCostDraft = z.infer<typeof traderCostDraft>;
export type TraderCostPreview = {
  revision: number;
  total: number;
  items: Array<{ name: string; total: number; unitCost: number; allocated: number }>;
};
