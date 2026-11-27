import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearch } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePrivateStorage } from "@/contexts/PrivateStorageContext";
import { commitPrivateAssistant, preparePrivateAssistant } from "@/lib/db/privateStorageClient";
import type { TraderApprovalResult, TraderAssistantAnswer, TraderBatch, TraderPreview } from "@shared/traderAssistant";
import { TraderAssistantReview } from "./TraderAssistantReview";
import birdPortrait from "./bird.webp";
import "./traderAssistant.css";

const endpoint = "/api/private/assistant";
const sectionLabels = { entities: "جهة", items: "صنف", prices: "سعر" };
const money = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

async function askServer<T>(path: string, body: unknown, csrf: string, signal: AbortSignal) {
  const response = await fetch(`${endpoint}/${path}`, {
    method: "POST", credentials: "same-origin", signal,
    headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || "تعذّر إكمال الطلب."), { status: response.status });
  return result as T;
}

function TraderBird({ stationary }: { stationary: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let dispose: (() => void) | undefined;
    let generation = 0;
    const update = () => {
      const current = ++generation;
      dispose?.();
      dispose = undefined;
      setReady(false);
      if (!motion.matches) {
        void import("./traderBirdScene").then(({ mountTraderBird }) => {
          if (current === generation && host.current) dispose = mountTraderBird(host.current, () => setReady(true));
        }).catch(() => { /* Keep the static portrait when WebGL isn't available. */ });
      }
    };
    update();
    motion.addEventListener("change", update);
    return () => { generation++; dispose?.(); motion.removeEventListener("change", update); };
  }, []);
  return <span className="trader-bird__visual" data-stationary={stationary}>
    <img src={birdPortrait} className={ready ? "invisible" : ""} alt="" draggable={false} />
    <span ref={host} aria-hidden="true" className="trader-bird__canvas" />
  </span>;
}

export function TraderAssistant() {
  const owner = usePrivateStorage();
  return owner.ready && owner.authenticated ? <OwnerAssistant key={owner.csrfToken} /> : null;
}

function OwnerAssistant() {
  const search = useSearch();
  const runId = new URLSearchParams(search).get("runId");
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [stationary, setStationary] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Array<{ request: string; reply: string }>>([]);
  const [answer, setAnswer] = useState<TraderAssistantAnswer | null>(null);
  const [batch, setBatch] = useState<TraderBatch | null>(null);
  const [preview, setPreview] = useState<TraderPreview | null>(null);
  const [approved, setApproved] = useState<TraderApprovalResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"ask" | "preview" | "commit" | null>(null);
  const pending = useRef<AbortController | null>(null);
  const committing = useRef(false);

  useEffect(() => {
    const request = new AbortController();
    let expiry: ReturnType<typeof setTimeout> | undefined;
    function disable() {
      pending.current?.abort();
      setEnabled(false);
      setOpen(false);
      setTurns([]);
      setAnswer(null);
      setBatch(null);
      setPreview(null);
      setApproved(null);
      setQuestion("");
      setError("");
    }
    const read = async () => {
      const response = await fetch(`${endpoint}/status`, {
        signal: request.signal, credentials: "same-origin", cache: "no-store",
      });
      if (response.status === 401) { disable(); return; }
      if (!response.ok) return;
      const status = await response.json();
      if (request.signal.aborted) return;
      if (!status.enabled) { disable(); return; }
      const remaining = Date.parse(status.expiresAt) - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) { disable(); return; }
      clearTimeout(expiry);
      expiry = setTimeout(disable, remaining);
      setEnabled(true);
    };
    const refresh = () => { void read().catch(() => undefined); };
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => {
      request.abort();
      pending.current?.abort();
      clearInterval(interval);
      clearTimeout(expiry);
    };
  }, []);

  function changeOpen(value: boolean) {
    if (!value && committing.current) return;
    if (!value) {
      pending.current?.abort();
      pending.current = null;
      setBusy(null);
      setStationary(false);
    }
    setOpen(value);
  }

  async function run(phase: "ask" | "preview", action: (csrf: string, signal: AbortSignal) => Promise<void>) {
    if (pending.current || committing.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(phase);
    setError("");
    try {
      const csrf = await preparePrivateAssistant();
      if (!controller.signal.aborted) await action(csrf, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        if ((error as { status?: number }).status === 401) changeOpen(false);
        setError(error instanceof Error ? error.message : "تعذّر إكمال الطلب.");
      }
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(null); }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const request = question.trim();
    if (request.length < 2) return;
    void run("ask", async (csrf, signal) => {
      const result = await askServer<TraderAssistantAnswer>("ask", {
        question: request, previous: turns.slice(-4).map(turn => turn.request), ...(runId ? { runId } : {}),
      }, csrf, signal);
      if (signal.aborted) return;
      setTurns(old => [...old.slice(-5), { request, reply: result.message }]);
      setAnswer(result);
      setBatch(result.batch ?? null);
      setPreview(null);
      setApproved(null);
      setQuestion("");
    });
  }

  function previewBatch() {
    if (!batch) return;
    void run("preview", async (csrf, signal) => {
      const result = await askServer<TraderPreview>("preview", batch, csrf, signal);
      if (!signal.aborted) setPreview(result);
    });
  }

  async function approve() {
    if (!batch || !preview || pending.current || committing.current) return;
    committing.current = true;
    setBusy("commit");
    setError("");
    try {
      const { result, cacheUpdated } = await commitPrivateAssistant<TraderApprovalResult>({ batch, revision: preview.revision });
      setApproved(result);
      setBatch(null);
      setPreview(null);
      if (!cacheUpdated) setError("حُفظت الدفعة على الخادم. حدّث مساحة العمل لعرض السجلات.");
    } catch (error) {
      if ((error as { status?: number }).status === 409) setPreview(null);
      setError(error instanceof Error ? error.message : "تعذّر تأكيد الحفظ. تحقّق من السجلات قبل إعادة الاعتماد.");
    } finally {
      committing.current = false;
      setBusy(null);
    }
  }

  if (!enabled) return null;
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild>
      <button type="button" className="trader-bird" aria-label="افتح رفيق التاجر"
        onMouseEnter={() => setStationary(true)} onMouseLeave={() => setStationary(false)}
        onFocus={() => setStationary(true)} onBlur={() => setStationary(false)}>
        <TraderBird stationary={stationary || open} />
        <span className="trader-bird__label">رفيق التاجر</span>
      </button>
    </DialogTrigger>
    <DialogContent dir="rtl" showCloseButton={busy !== "commit"}
      className="trader-assistant-panel grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
      <header className="border-b border-emerald-700/20 px-5 py-4 ps-5 pe-11">
        <DialogTitle>رفيق التاجر</DialogTitle>
        <DialogDescription className="mt-1">
          {runId ? "ملف الشحنة المفتوح مرتبط بهذا الطلب." : "مساحة عمل المالك لإعداد السجلات ومراجعة تكاليف الشحنات."}
        </DialogDescription>
      </header>
      <div className="space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
        {!turns.length && <div className="grid gap-2 text-sm">
          {[
            "أضف المورد شركة النور والصنف موكيت بسعر 25 SAR بتاريخ 2027-01-15",
            "قارن تكاليف الشحنات المحفوظة",
          ].map(prompt => <button key={prompt} type="button" className="rounded-lg border bg-background/80 px-3 py-2 text-start hover:border-emerald-700"
            disabled={Boolean(busy)} onClick={() => setQuestion(prompt)}>{prompt}</button>)}
        </div>}
        {turns.length > 0 && <ol className="space-y-3" aria-label="سياق العمل">
          {turns.map((turn, idx) => <li key={idx} className="space-y-1 break-words text-sm">
            <p className="rounded-lg bg-emerald-950/10 px-3 py-2 font-semibold dark:bg-emerald-300/10">{turn.request}</p>
            <p className="px-3">{turn.reply}</p>
          </li>)}
        </ol>}
        {answer?.cargo?.map(cargo => <article key={cargo.id} className="space-y-2 rounded-xl border bg-background/85 p-3 text-sm">
          <a href={`/cargo?runId=${encodeURIComponent(cargo.id)}`} className="font-semibold underline">{cargo.name}</a>
          <p className="text-xs text-muted-foreground">{cargo.route}</p>
          <dl className="grid grid-cols-2 gap-2">
            {[
              ["التكلفة الإجمالية", cargo.total], ["تكلفة الوحدة", cargo.unitCost],
              ["الفاتورة", cargo.invoice], ["اللوجستيات", cargo.logistics], ["الجمارك", cargo.customs],
            ].map(([label, number]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt>
              <dd><bdi>{typeof number === "number" ? `${money.format(number)} ${cargo.currency}` : "—"}</bdi></dd></div>)}
          </dl>
          {cargo.missing > 0 && <p className="text-xs">بنود تكلفة ناقصة: {cargo.missing}</p>}
        </article>)}
        {batch && <TraderAssistantReview batch={batch} preview={preview} busy={Boolean(busy)}
          onChange={next => { setBatch(next); setPreview(null); }} onPreview={previewBatch} onApprove={() => void approve()} />}
        {approved && <section className="rounded-xl border border-emerald-600/30 bg-background/85 p-3 text-sm" role="status">
          <p>حُفظت الدفعة بنجاح. الإضافات الجديدة: {approved.created}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {approved.records.map((record, i) => <a key={i} className="font-semibold underline"
              href={`/${record.section}?record=${encodeURIComponent(record.id)}`}>{sectionLabels[record.section]} · {record.name}</a>)}
          </div>
        </section>}
        {busy && <p role="status" className="text-sm">{busy === "commit" ? "جارٍ حفظ الدفعة المعتمدة…" : "جارٍ تجهيز النتيجة…"}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-500/10 p-2 text-sm text-red-800 dark:text-red-300">{error}</p>}
      </div>
      <form onSubmit={submit} className="space-y-2 border-t border-emerald-700/20 bg-background/65 px-4 py-3 sm:px-5">
        <label className="block text-sm font-semibold" htmlFor="trader-assistant-question">ماذا تريد أن تنجز؟</label>
        <textarea id="trader-assistant-question" rows={2} maxLength={6000} value={question} disabled={Boolean(busy)}
          onChange={event => setQuestion(event.target.value)} className="w-full resize-y rounded-xl border bg-background p-2 text-sm" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="submit" disabled={Boolean(busy) || question.trim().length < 2} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">إرسال الطلب</button>
          {turns.length > 0 && <button type="button" className="text-xs underline" disabled={Boolean(busy)}
            onClick={() => { setTurns([]); setAnswer(null); setBatch(null); setApproved(null); setPreview(null); setError(""); setQuestion(""); }}>جلسة عمل جديدة</button>}
        </div>
        <p className="text-xs text-muted-foreground">يُرسل نص طلبك والتوضيحات السابقة في هذه الجلسة إلى Gemini.</p>
      </form>
    </DialogContent>
  </Dialog>;
}
