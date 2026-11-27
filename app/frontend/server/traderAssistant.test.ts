import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import express from "express";
import type { BackupPayload } from "../client/src/lib/db/repository";
import { prepareTraderBatch, TraderAssistantError } from "./traderAssistantBatch";
import { createTraderAssistantRouter } from "./traderAssistant";
import type { TraderAssistantAnswer, TraderBatch, TraderPreview } from "../shared/traderAssistant";

const baseline = (): BackupPayload => ({
  format: "smart-trader-backup",
  schemaVersion: 15,
  exportedAt: "2027-01-01T00:00:00Z",
  tables: {
    entities: [], items: [], categories: [], item_prices: [], price_history: [],
    spec_templates: [], item_specs: [], attachments: [], notes: [], tasks: [],
    backup_logs: [], pricing_runs: [], quick_calculations: [], cargo_cost_runs: [],
    cargo_cost_items: [], cargo_cost_lines: [], cargo_cost_allocations: [],
    logistics_locations: [], logistics_rates: [], logistics_route_templates: [],
    price_lists: [], price_list_items: [], settings: [], meta: [],
    currencies: [], units: [], entity_contacts: [],
  },
});
const batch: TraderBatch = {
  entities: [{ name: "شركة النور", kind: "supplier" }],
  items: ["موكيت", "سجاد", "لباد"].map((name, i) => ({
    name, code: `ABC-${i}`, unit: "قطعة", entityName: "شركة النور", currency: "SAR",
    price: { amount: 25 + i, date: "2027-01-15" },
  })),
};

test("plans a linked supplier and three dated prices without mutating the snapshot", () => {
  const original = baseline();
  const first = prepareTraderBatch(original, batch);
  assert.equal(original.tables.entities.length, 0);
  assert.equal(first.result.created, 7);
  const { entities, items, item_prices, price_history } = first.payload.tables;
  assert.equal(entities.length, 1);
  assert(items.every(item => item.entityId === entities[0].id));
  assert.equal(item_prices.length, 3);
  assert.equal(price_history.length, 3);
  assert(price_history.every(price => price.effectiveDate === "2027-01-15" && price.currency === "SAR"));
  const second = prepareTraderBatch(first.payload, batch);
  assert.equal(second.result.created, 0);
  assert.equal(second.payload.tables.price_history.length, 3);
  const wrong = { ...batch, items: [...batch.items, { ...batch.items[0], name: "مختلف" }] };
  assert.throws(() => prepareTraderBatch(first.payload, wrong), TraderAssistantError);
  assert.equal(first.payload.tables.items.length, 3);
});

test("owner-only API denies guests, requires CSRF and creates records only after approval", async t => {
  const key = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test";
  t.after(() => { if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key; });
  const realFetch = fetch.bind(globalThis);
  let providerCalls = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\//);
    const sent = JSON.parse(String(init.body));
    assert.doesNotMatch(JSON.stringify(sent.generationConfig.responseJsonSchema), /"maxItems"/);
    assert.doesNotMatch(String(init.body), /private-id/);
    providerCalls++;
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      action: "draft", message: "جاهز", cargoName: "", ...batch,
    }) }] } }] });
  });
  let revision = 0;
  let payload = baseline();
  let writes = 0;
  const app = express();
  app.use(express.json());
  app.use("/assistant", createTraderAssistantRouter({
    async session(req) {
      return req.get("cookie") === "test=owner"
        ? { userId: "test-owner", csrfToken: "test-csrf", expiresAt: new Date("2099-01-01") } : null;
    },
    async read(owner) { assert.equal(owner, "test-owner"); return { revision, payload }; },
    async change(owner, expected, apply) {
      assert.equal(owner, "test-owner");
      if (expected !== revision) throw new TraderAssistantError(409, "Revision conflict");
      const next = apply({ revision, payload });
      if (next.payload) { payload = next.payload; revision++; writes++; }
      return next.result;
    },
  }));
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/assistant`;
  const identity = { Cookie: "test=owner", "x-csrf-token": "test-csrf" };
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) => realFetch(`${url}/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
  });
  for (const path of ["status", "bird"]) assert.equal((await realFetch(`${url}/${path}`)).status, 401);
  for (const path of ["ask", "preview", "commit"]) assert.equal((await post(path, {})).status, 401);
  assert.equal((await post("ask", {}, { Cookie: identity.Cookie })).status, 403);
  assert.equal(providerCalls, 0);
  const status = await realFetch(`${url}/status`, { headers: identity });
  assert.equal(status.headers.get("cache-control"), "private, no-store");
  assert.equal((await status.json()).enabled, true);
  const response = await post("ask", { question: "أضف المورد وأصنافه", previous: [], runId: "private-id" }, identity);
  assert.equal(response.status, 200);
  const draft = await response.json() as TraderAssistantAnswer;
  assert.deepEqual(draft.batch, batch);
  const preview = await post("preview", draft.batch, identity);
  assert.equal(preview.status, 200);
  const review = await preview.json() as TraderPreview;
  assert.equal(review.rows.length, 7);
  assert.equal(writes, 0);
  const approve = () => post("commit", { batch, revision: review.revision }, identity);
  const committed = await approve();
  assert.equal(committed.status, 200);
  assert.equal((await committed.json()).created, 7);
  assert.equal(payload.tables.items.length, 3);
  assert.equal((await approve()).status, 409);
  assert.equal(writes, 1);
  assert.equal(providerCalls, 1);
});
