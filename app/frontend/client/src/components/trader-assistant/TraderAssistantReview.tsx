import EnglishDatePicker from "@/components/EnglishDatePicker";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TraderBatch, TraderPreview } from "@shared/traderAssistant";

const control = "min-w-0 w-full rounded-lg border border-emerald-700/25 bg-background px-2 py-1.5 text-sm";
const kinds = ["supplier", "factory", "customer", "other"] as const;

export function TraderAssistantReview({ batch, preview, busy, onChange, onPreview, onApprove }: {
  batch: TraderBatch;
  preview: TraderPreview | null;
  busy: boolean;
  onChange(batch: TraderBatch): void;
  onPreview(): void;
  onApprove(): void;
}) {
  const { t } = useLanguage();
  const counts = preview?.rows.filter(row => row.outcome !== "reuse").length ?? 0;

  if (preview) return <section className="space-y-3" aria-label={t("assistant.preview")}>
    <h3 className="font-semibold">{t("assistant.preview")}</h3>
    <ul className="space-y-2">
      {preview.rows.map((row, index) => <li key={index} className="rounded-xl border border-emerald-700/20 bg-background/85 p-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <strong>{t(`assistant.${row.type}`)} · {row.name}</strong>
          <span className={row.outcome === "reuse" ? "text-muted-foreground" : "font-semibold text-emerald-700 dark:text-emerald-300"}>{t(`assistant.${row.outcome}`)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground"><bdi>{row.detail}</bdi></p>
      </li>)}
    </ul>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || !counts} onClick={onApprove} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t("assistant.approve").replace("{count}", String(counts))}</button>
      <button type="button" disabled={busy} onClick={() => onChange(batch)} className="rounded-lg border px-3 py-2 text-sm">{t("assistant.editBatch")}</button>
    </div>
    {!counts && <p className="text-sm">{t("assistant.allExist")}</p>}
  </section>;

  return <section className="space-y-3" aria-label={t("assistant.draft")}>
    <h3 className="font-semibold">{t("assistant.draft")}</h3>
    {batch.entities.map((entity, i) => <fieldset disabled={busy} key={i} className="space-y-2 rounded-xl border bg-background/85 p-3">
      <legend className="px-1 text-xs font-semibold">{t("assistant.entity")} {i + 1}</legend>
      <div className="grid grid-cols-[1fr_minmax(5rem,7rem)] gap-2">
        <label className="min-w-0 text-xs">{t("assistant.name")}<input className={control} value={entity.name} maxLength={180} onChange={e =>
          onChange({ ...batch, entities: batch.entities.map((row, j) => j === i ? { ...row, name: e.target.value } : row),
            items: batch.items.map(row => row.entityName === entity.name && entity.name ? { ...row, entityName: e.target.value } : row) })} /></label>
        <label className="text-xs">{t("assistant.kind")}<select className={control} value={entity.kind} onChange={e =>
          onChange({ ...batch, entities: batch.entities.map((row, j) => j === i ? { ...row, kind: e.target.value as typeof entity.kind } : row) })}>
          {kinds.map(value => <option key={value} value={value}>{t(`assistant.${value}`)}</option>)}
        </select></label>
      </div>
      <button type="button" className="text-xs underline" onClick={() => onChange({ ...batch, entities: batch.entities.filter((_, j) => j !== i) })}>{t("assistant.removeEntity")}</button>
    </fieldset>)}
    {batch.items.map((item, i) => {
      const change = (patch: Partial<typeof item>) => onChange({ ...batch, items: batch.items.map((row, j) => j === i ? { ...row, ...patch } : row) });
      return <fieldset disabled={busy} key={i} className="space-y-2 rounded-xl border bg-background/85 p-3">
        <legend className="px-1 text-xs font-semibold">{t("assistant.item")} {i + 1}</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="min-w-0 text-xs">{t("assistant.name")}<input className={control} maxLength={180} value={item.name} onChange={e => change({ name: e.target.value })} /></label>
          <label className="min-w-0 text-xs">{t("assistant.code")}<input className={control} maxLength={180} value={item.code} onChange={e => change({ code: e.target.value })} /></label>
          <label className="min-w-0 text-xs">{t("assistant.linkedEntity")}<input className={control} maxLength={180} value={item.entityName} onChange={e => change({ entityName: e.target.value })} /></label>
          <label className="min-w-0 text-xs">{t("assistant.unit")}<input className={control} maxLength={180} value={item.unit} onChange={e => change({ unit: e.target.value })} /></label>
          <label className="min-w-0 text-xs">{t("assistant.currency")}<input dir="ltr" className={control} maxLength={3} value={item.currency ?? ""} onChange={e => change({ currency: e.target.value.toUpperCase() || null })} /></label>
          {item.price && <>
            <label className="min-w-0 text-xs">{t("assistant.purchasePrice")}<input type="number" dir="ltr" lang="en-US" min="0" step="any" className={control} value={item.price.amount || ""} onChange={e => change({ price: { ...item.price!, amount: Number(e.target.value) } })} /></label>
            <label className="min-w-0 text-xs">{t("assistant.priceDate")}<EnglishDatePicker className={control} ariaLabel={t("assistant.priceDate")} value={item.price.date} disabled={busy} onChange={date => change({ price: { ...item.price!, date } })} /></label>
          </>}
        </div>
        <div className="flex gap-3">
          <button type="button" className="text-xs underline" onClick={() => change({ price: item.price ? null : { amount: 0, date: "" } })}>{item.price ? t("assistant.removePrice") : t("assistant.addPrice")}</button>
          <button type="button" className="text-xs underline" onClick={() => onChange({ ...batch, items: batch.items.filter((_, j) => j !== i) })}>{t("assistant.removeItem")}</button>
        </div>
      </fieldset>;
    })}
    <button type="button" disabled={busy || (!batch.entities.length && !batch.items.length)} onClick={onPreview}
      className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t("assistant.showPreview")}</button>
  </section>;
}
