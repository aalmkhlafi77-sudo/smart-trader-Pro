import { z } from "zod";

const name = z.string().trim().min(1).max(180);
const detail = z.string().trim().max(180);
const currency = z.string().trim().regex(/^[A-Z]{3}$/);
const kind = z.enum(["supplier", "factory", "customer", "other"]);

export const traderBatch = z.strictObject({
  entities: z.array(z.strictObject({ name, kind })).max(20),
  items: z.array(z.strictObject({
    name,
    code: detail,
    unit: detail,
    entityName: detail,
    currency: currency.nullable(),
    price: z.strictObject({ amount: z.number().positive().max(1e12), date: z.iso.date() }).nullable(),
  })).max(30),
});
export type TraderBatch = z.infer<typeof traderBatch>;

export const traderQuestion = z.strictObject({
  question: z.string().trim().min(2).max(6000),
  previous: z.array(z.string().trim().min(2).max(6000)).max(4),
  runId: z.string().min(1).max(120).optional(),
});

const providerOutput = z.object({
  action: z.enum(["draft", "cargo", "reply"]),
  message: z.string(),
  cargoName: z.string(),
  entities: z.array(z.object({ name: z.string(), kind: z.string() })),
  items: z.array(z.object({
    name: z.string(), code: z.string(), unit: z.string(), entityName: z.string(),
    currency: z.string().nullable(), price: z.object({ amount: z.number(), date: z.string() }).nullable(),
  })),
});
export const traderProviderSchema = z.toJSONSchema(providerOutput, { target: "draft-7" });
export const traderProviderResult = providerOutput.extend({
  message: z.string().trim().min(1).max(1600),
  cargoName: detail,
  ...traderBatch.shape,
});

export const traderApprove = z.strictObject({ batch: traderBatch, revision: z.number().int().nonnegative() });

export type PreviewRow = {
  type: "entity" | "item" | "price";
  name: string;
  outcome: "create" | "reuse";
  detail: string;
};
export type TraderPreview = { revision: number; rows: PreviewRow[] };
export type TraderCargoCard = {
  id: string; name: string; route: string; currency: string;
  total: number; unitCost: number | null; invoice: number; logistics: number; customs: number; missing: number;
};
export type TraderAssistantAnswer = {
  message: string;
  batch?: TraderBatch;
  cargo?: TraderCargoCard[];
};
export type TraderApprovalResult = {
  created: number;
  records: Array<{ section: "entities" | "items" | "prices"; id: string; name: string }>;
};
