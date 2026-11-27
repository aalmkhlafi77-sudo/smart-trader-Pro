import { createHash } from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { buildRouteComparisonRows } from "../client/src/lib/cargoDecisionReports";
import type { BackupPayload } from "../client/src/lib/db/repository";
import {
  traderApprove, traderBatch, traderProviderResult, traderProviderSchema, traderQuestion,
  type TraderAssistantAnswer,
} from "../shared/traderAssistant";
import { prepareTraderBatch, TraderAssistantError } from "./traderAssistantBatch";

type OwnerSession = { userId: string; csrfToken: string; expiresAt: Date };
type Snapshot = { revision: number; payload: BackupPayload };
type OwnerStorage = {
  session(req: Request): Promise<OwnerSession | null>;
  read(ownerId: string): Promise<Snapshot>;
  change<T>(ownerId: string, revision: number, apply: (state: Snapshot) => { result: T; payload: BackupPayload | null }): Promise<T>;
};
const birdSize = 2469928;
const birdHash = "00e16859f3deff3a42b3f59d4cf0758fdbc1acb5380069f100a2b3d2f7ba3db4";
const birdUrl = "https://cinema-ui.carpetbazar.org/bird/cinematic-bird.glb";
let birdPromise: Promise<Buffer> | undefined;

function configuration() {
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.TRADER_ASSISTANT_MODEL?.trim() || "gemini-3.5-flash-lite";
  return key && /^gemini-[a-z0-9.-]+$/.test(model) ? { key, model } : null;
}

async function getBird() {
  const response = await fetch(birdUrl, { redirect: "error", signal: AbortSignal.timeout(12_000) });
  if (!response.ok || !response.body) throw new Error("Bird not available");
  const reader = response.body.getReader();
  const model = Buffer.alloc(birdSize);
  let offset = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > birdSize) throw new Error("Unexpected model size");
      model.set(value, offset);
      offset += value.byteLength;
    }
    if (offset !== birdSize || createHash("sha256").update(model).digest("hex") !== birdHash) {
      throw new Error("Unexpected model digest");
    }
    return model;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

async function interpret(input: ReturnType<typeof traderQuestion.parse>, signal: AbortSignal) {
  const config = configuration();
  if (!config) throw new TraderAssistantError(503, "لم يُفعّل اتصال المساعد على الخادم.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": config.key },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: [
        "أنت مساعد مالك التاجر الذكي. أجب بالعربية. لا تدّعِ حفظ سجلات أو حساب تكاليف.",
        "draft: جهّز إضافة جهات (supplier, factory, customer, other) وأصناف وأسعار شراء من البيانات التي قدمها المالك، مع إمكانية ربطها باسم الجهة كما كتبه.",
        "في إنشاء الأسعار يجب أن يحدد المالك المبلغ والعملة ISO وتاريخ اعتماد ميلادي YYYY-MM-DD. إذا نقص شيء لازم، أو لم يتضح ربط الأصناف بالجهات، اختر reply واطلب المعلومة. لا تخمّن الاسم أو الرقم أو التاريخ أو العملة.",
        "إذا لم يذكر رمزًا أو وحدة أو جهة للصنف اترك القيمة فارغة حيث لا تحتاج إلى توضيح. currency وprice يقبلان null عند عدم توفيرهما.",
        "cargo: طلب قراءة تكاليف أو مقارنة الشحنات. استخرج الاسم أو جزءًا منه في cargoName. إذا لم يسمّ الشحنة اتركه فارغًا للسماح للمالك باختيار ملفاتها المحفوظة.",
        "reply: للطلبات غير المدعومة أو أسئلة المتابعة. اترك القوائم غير المستعملة فارغة. الحد 20 جهة و30 صنفًا في الطلب. لا تتجاهل بقية صفوف دفعة أكبر.",
        "استخدم الرسالة الأخيرة للتصحيح، والرسائل السابقة عند الإحالة إليها فقط. لا تعِدّ طلبًا سابقًا تلقائيًا.",
      ].join("\n") }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify({ question: input.question, previous: input.previous }) }] }],
      generationConfig: {
        responseMimeType: "application/json", responseJsonSchema: traderProviderSchema, maxOutputTokens: 8192,
      },
    }),
  }).catch(() => { throw new TraderAssistantError(502, "تعذّر الاتصال بالمساعد. أعد المحاولة."); });
  if (response.status === 429) throw new TraderAssistantError(429, "بلغ مزوّد المساعد حد الاستخدام. أعد المحاولة لاحقًا.");
  if (!response.ok) throw new TraderAssistantError(502, "رفض المزوّد طلب المساعد. راجع إعداد المفتاح والنموذج على الخادم.");
  try {
    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts as Array<{ text?: string; thought?: boolean }> | undefined;
    const raw = parts?.filter(part => !part.thought).map(part => part.text ?? "").join("") ?? "";
    return traderProviderResult.parse(JSON.parse(raw));
  } catch {
    throw new TraderAssistantError(502, "لم تكتمل نتيجة المساعد. جرّب طلبًا أقصر أو دفعة أصغر.");
  }
}

function cargoCards(snapshot: BackupPayload, name: string, currentId?: string) {
  const { tables } = snapshot;
  const searched = name.normalize("NFKC").toLowerCase().trim();
  const candidates = tables.cargo_cost_runs.filter(run => run.status !== "archived");
  const current = candidates.find(run => run.id === currentId);
  const matches = candidates.filter(run =>
    !searched || run.name.normalize("NFKC").toLowerCase().includes(searched)
  ).slice(0, 12);
  if (current && !searched && !matches.some(run => run.id === current.id)) {
    matches.unshift(current);
    matches.length = Math.min(matches.length, 12);
  }
  return buildRouteComparisonRows(matches.map(run => ({
    run,
    items: tables.cargo_cost_items.filter(item => item.runId === run.id),
    lines: tables.cargo_cost_lines.filter(line => line.runId === run.id),
  })), tables.logistics_locations).map(row => ({
    id: row.run.id, name: row.run.name, route: row.routeLabel,
    currency: row.run.currency || tables.settings[0]?.localCurrency || "",
    total: row.totalCost, unitCost: row.unitCost, invoice: row.invoiceValue,
    logistics: row.logisticsCost, customs: row.customsAmount, missing: row.missingLines.length,
  }));
}

const noStore = (res: Response) => res.set("Cache-Control", "private, no-store");
const safe = (callback: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, _next: NextFunction) => {
    void callback(req, res).catch(error => {
      if (res.destroyed || res.headersSent) return;
      if (error instanceof TraderAssistantError) res.status(error.status).json({ error: error.message });
      else res.status(503).json({ error: "تعذّر الوصول إلى مساحة عمل المالك." });
    });
  };

export function createTraderAssistantRouter(storage: OwnerStorage) {
  const router = Router();
  const budgets = new Map<string, { until: number; used: number }>();
  async function owner(req: Request, res: Response, write = false) {
    noStore(res);
    const session = await storage.session(req);
    if (!session) throw new TraderAssistantError(401, "تسجيل دخول المالك مطلوب.");
    if (write && req.get("x-csrf-token") !== session.csrfToken) {
      throw new TraderAssistantError(403, "تعذّر التحقق من جلسة المالك.");
    }
    return session;
  }

  router.get("/status", safe(async (req, res) => {
    const session = await owner(req, res);
    res.json({ enabled: Boolean(configuration()), expiresAt: session.expiresAt.toISOString() });
  }));

  router.get("/bird", safe(async (req, res) => {
    await owner(req, res);
    if (!configuration()) throw new TraderAssistantError(503, "لم يُفعّل المساعد على الخادم.");
    birdPromise ??= getBird().catch(error => { birdPromise = undefined; throw error; });
    const glb = await birdPromise;
    res.type("model/gltf-binary").send(glb);
  }));

  router.post("/ask", safe(async (req, res) => {
    const session = await owner(req, res, true);
    const parsed = traderQuestion.safeParse(req.body);
    if (!parsed.success) throw new TraderAssistantError(400, "اكتب طلبًا صالحًا يصل إلى 6000 حرف.");
    const now = Date.now();
    budgets.forEach((quota, id) => { if (quota.until <= now) budgets.delete(id); });
    const budget = budgets.get(session.userId) ?? { until: now + 60_000, used: 0 };
    if (budget.used >= 8) throw new TraderAssistantError(429, "تكررت طلبات المساعد. حاول بعد دقيقة.");
    budget.used++;
    budgets.set(session.userId, budget);
    const controller = new AbortController();
    const disconnect = () => controller.abort();
    res.once("close", disconnect);
    try {
      const result = await interpret(parsed.data, AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]));
      if (res.destroyed) return;
      await owner(req, res, true);
      const answer: TraderAssistantAnswer = { message: result.message };
      if (result.action === "draft" && result.entities.length + result.items.length) {
        answer.batch = { entities: result.entities, items: result.items };
        answer.message = "راجع الدفعة المقترحة، ثم اعرض معاينة الحفظ.";
      }
      if (result.action === "cargo") {
        const snapshot = await storage.read(session.userId);
        answer.cargo = cargoCards(snapshot.payload, result.cargoName, parsed.data.runId);
        answer.message = answer.cargo.length
          ? "هذه تكاليف الملفات المطابقة كما حسبها محرك التاجر الذكي."
          : "لم أجد شحنات مطابقة. اذكر اسم الملف أو افتح ملفات الشحنات المحفوظة.";
      }
      res.json(answer);
    } finally {
      res.off("close", disconnect);
    }
  }));

  router.post("/preview", safe(async (req, res) => {
    const session = await owner(req, res, true);
    if (!configuration()) throw new TraderAssistantError(503, "لم يُفعّل المساعد على الخادم.");
    const parsed = traderBatch.safeParse(req.body);
    if (!parsed.success || !parsed.data.entities.length && !parsed.data.items.length) {
      throw new TraderAssistantError(400, "راجع أسماء السجلات وعملة كل سعر ومبلغه وتاريخه.");
    }
    const snapshot = await storage.read(session.userId);
    const { rows } = prepareTraderBatch(snapshot.payload, parsed.data);
    res.json({ revision: snapshot.revision, rows });
  }));

  router.post("/commit", safe(async (req, res) => {
    const session = await owner(req, res, true);
    if (!configuration()) throw new TraderAssistantError(503, "لم يُفعّل المساعد على الخادم.");
    const parsed = traderApprove.safeParse(req.body);
    if (!parsed.success || !parsed.data.batch.entities.length && !parsed.data.batch.items.length) {
      throw new TraderAssistantError(400, "طلب اعتماد الدفعة غير صالح.");
    }
    const { batch, revision } = parsed.data;
    const result = await storage.change(session.userId, revision, ({ payload }) => {
      const plan = prepareTraderBatch(payload, batch);
      return { result: plan.result, payload: plan.result.created ? plan.payload : null };
    });
    res.json(result);
  }));
  return router;
}
