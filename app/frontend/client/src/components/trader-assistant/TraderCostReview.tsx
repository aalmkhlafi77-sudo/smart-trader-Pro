import { useLanguage } from "@/contexts/LanguageContext";
import type { TraderCostDraft, TraderCostPreview } from "@shared/traderAssistantImport";

const control = "block w-full rounded border bg-background p-1.5";
type Props = {
  draft: TraderCostDraft;
  preview: TraderCostPreview | null;
  busy: boolean;
  onChange(draft: TraderCostDraft): void;
  onPreview(): void;
  onSave(): void;
};

export function TraderCostReview({ draft, preview, busy, onChange, onPreview, onSave }: Props) {
  const { t } = useLanguage();
  const label = (key: string) => t("assistant." + key);
  const money = (value: number) => new Intl.NumberFormat("en-US-u-nu-latn", {
    style: "currency", currency: draft.currency, maximumFractionDigits: 4,
  }).format(value);
  const field = (key: string, value: string, change: (value: string) => void, max = 180) =>
    <label className="text-xs">{label(key)}<input className={control} maxLength={max} value={value}
      onChange={event => change(event.target.value)} /></label>;
  const number = (key: string, value: number | null, change: (value: number | null) => void) =>
    <label className="text-xs">{label(key)}<input className={control} type="number" dir="ltr" min={0} step="any"
      value={value ?? ""} onChange={event => change(event.target.value === "" ? null : event.target.valueAsNumber)} /></label>;

  return <section className="space-y-3">
    <h3 className="font-semibold">{label("costDraft")}</h3>
    <fieldset disabled={busy} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {field("name", draft.name, name => onChange({ ...draft, name }))}
        {field("currency", draft.currency, currency => onChange({ ...draft, currency: currency.toUpperCase() }), 3)}
      </div>
      {draft.items.map((row, index) => {
        const change = (patch: Partial<typeof row>) => onChange({
          ...draft, items: draft.items.map((item, i) => i === index ? { ...item, ...patch } : item),
        });
        return <fieldset className="space-y-2 rounded-xl border p-3" key={index}>
          <legend>{label("item")} {index + 1}</legend>
          <div className="grid grid-cols-2 gap-2">
            {field("name", row.name, name => change({ name }))}
            {field("code", row.code, code => change({ code }))}
            {field("unit", row.unit, unit => change({ unit }))}
            {field("currency", row.currency, currency => change({ currency: currency.toUpperCase() }), 3)}
            {number("quantity", row.quantity, quantity => change({ quantity }))}
            {number("purchasePrice", row.unitPrice, unitPrice => change({ unitPrice }))}
            {row.currency !== draft.currency && number("exchangeRate", row.exchangeRate, exchangeRate => change({ exchangeRate }))}
          </div>
          <button type="button" className="text-xs underline" onClick={() => onChange({ ...draft, items: draft.items.filter((_, i) => i !== index) })}>{label("removeItem")}</button>
        </fieldset>;
      })}
      {draft.expenses.map((row, index) => {
        const change = (patch: Partial<typeof row>) => onChange({
          ...draft, expenses: draft.expenses.map((expense, i) => i === index ? { ...expense, ...patch } : expense),
        });
        return <fieldset className="space-y-2 rounded-xl border p-3" key={index}>
          <legend>{label("expense")} {index + 1}</legend>
          <div className="grid grid-cols-2 gap-2">
            {field("name", row.name, name => change({ name }))}
            {number("amount", row.amount, amount => change({ amount }))}
            {field("currency", row.currency, currency => change({ currency: currency.toUpperCase() }), 3)}
            {row.currency !== draft.currency && number("exchangeRate", row.exchangeRate, exchangeRate => change({ exchangeRate }))}
            <label className="text-xs">{label("allocation")}<select className={control} value={row.basis}
              onChange={event => change({ basis: event.target.value === "quantity" ? "quantity" : "value" })}>
              <option value="value">{label("allocationValue")}</option>
              <option value="quantity">{label("quantity")}</option>
            </select></label>
          </div>
          <button type="button" className="text-xs underline" onClick={() => onChange({ ...draft, expenses: draft.expenses.filter((_, i) => i !== index) })}>{label("removeExpense")}</button>
        </fieldset>;
      })}
      {draft.expenses.length < 30 && <button type="button" className="text-sm underline" onClick={() => onChange({
        ...draft, expenses: [...draft.expenses, { name: "", amount: null, currency: draft.currency, exchangeRate: null, basis: "value" }],
      })}>{label("addExpense")}</button>}
    </fieldset>
    {preview ? <>
      <ul className="space-y-2">
        {preview.items.map((row, index) => <li key={index} className="rounded border p-2 text-sm">
          <strong>{row.name}</strong>
          <div>{label("unitCost")} <bdi>{money(row.unitCost)}</bdi> · {label("expense")} <bdi>{money(row.allocated)}</bdi> · {label("total")} <bdi>{money(row.total)}</bdi></div>
        </li>)}
      </ul>
      <p className="font-semibold">{label("total")} <bdi>{money(preview.total)}</bdi></p>
      <p className="text-xs text-muted-foreground">{label("costCatalogNotice")}</p>
    </> : null}
    <button type="button" className="rounded-lg bg-emerald-800 px-4 py-2 text-sm text-white disabled:opacity-50"
      disabled={busy || !draft.items.length} onClick={preview ? onSave : onPreview}>{label(preview ? "saveCost" : "showPreview")}</button>
  </section>;
}
