import { useEffect, useMemo, useState } from "react";
import { Copy, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormGrid, NumberField, PageShell, SectionCard } from "@/components/patterns";
import { db, type CalculatorTemplateRow } from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { parseNumber } from "@/lib/pricing";
import type { QuickExpense } from "@/lib/quickCalculator";
import { useLanguage } from "@/contexts/LanguageContext";

const cloneExpenses = (rows: QuickExpense[]) => rows.map(row => ({ ...row }));

function makeExternal(t: (key: string) => string): QuickExpense[] {
  return [
    { id: "insurance", name: t("quick.insurance"), amount: 0, currency: "foreign", includeInCustomsBase: true },
    { id: "external-shipping", name: t("quick.externalShipping"), amount: 0, currency: "foreign", includeInCustomsBase: false },
    { id: "external-other", name: t("quick.externalOther"), amount: 0, currency: "foreign", includeInCustomsBase: true },
  ];
}

function makeInternal(t: (key: string) => string): QuickExpense[] {
  return [
    { id: "clearance", name: t("quick.clearance"), amount: 0, currency: "local", includeInCustomsBase: false },
    { id: "shipping-agent", name: t("quick.shippingAgent"), amount: 0, currency: "local", includeInCustomsBase: false },
    { id: "fines", name: t("quick.fines"), amount: 0, currency: "local", includeInCustomsBase: false },
    { id: "clearance-office", name: t("quick.clearanceOffice"), amount: 0, currency: "local", includeInCustomsBase: false },
    { id: "internal-transport", name: t("quick.internalTransport"), amount: 0, currency: "local", includeInCustomsBase: false },
    { id: "handling", name: t("quick.handling"), amount: 0, currency: "local", includeInCustomsBase: false },
    { id: "internal-other", name: t("quick.internalOther"), amount: 0, currency: "local", includeInCustomsBase: false },
  ];
}

export default function CalculatorTemplates() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<CalculatorTemplateRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<CalculatorTemplateRow["scope"]>("both");
  const [origin, setOrigin] = useState("");
  const [unloading, setUnloading] = useState("");
  const [destination, setDestination] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState("3.75");
  const [customsRate, setCustomsRate] = useState("12");
  const [marginRate, setMarginRate] = useState("20");
  const [allocationBasis, setAllocationBasis] = useState<"value" | "quantity">("value");
  const [notes, setNotes] = useState("");
  const [externalExpenses, setExternalExpenses] = useState<QuickExpense[]>(() => makeExternal(t));
  const [internalExpenses, setInternalExpenses] = useState<QuickExpense[]>(() => makeInternal(t));

  const load = async () => setRows(await db.listCalculatorTemplates());

  useEffect(() => {
    void Promise.all([db.listCalculatorTemplates(), db.getSettings()]).then(([templates, settings]) => {
      setRows(templates);
      setCurrency(settings.foreignCurrency || "USD");
      setExchangeRate(String(settings.defaultExchangeRate || 1));
      setCustomsRate(String((settings.defaultCustomsRate || 0) * 100));
      setMarginRate(String((settings.defaultMarginRate || 0) * 100));
    });
  }, []);

  const reset = () => {
    setEditingId(null);
    setName("");
    setScope("both");
    setOrigin("");
    setUnloading("");
    setDestination("");
    setAllocationBasis("value");
    setNotes("");
    setExternalExpenses(makeExternal(t));
    setInternalExpenses(makeInternal(t));
  };

  const updateExpense = (group: "external" | "internal", id: string, patch: Partial<QuickExpense>) => {
    const setter = group === "external" ? setExternalExpenses : setInternalExpenses;
    setter(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error(t("calcTemplates.nameRequired"));
      return;
    }
    const now = nowIso();
    const existing = editingId ? rows.find(row => row.id === editingId) : null;
    const row: CalculatorTemplateRow = {
      id: editingId ?? newId("calc-template"),
      name: name.trim(),
      scope,
      origin: origin.trim(),
      unloading: unloading.trim(),
      destination: destination.trim(),
      currency: currency.trim().toUpperCase() || "USD",
      exchangeRate: Math.max(0, parseNumber(exchangeRate)),
      customsRate: Math.max(0, parseNumber(customsRate) / 100),
      marginRate: Math.max(0, parseNumber(marginRate) / 100),
      allocationBasis,
      externalExpensesJson: JSON.stringify(externalExpenses),
      internalExpensesJson: JSON.stringify(internalExpenses),
      notes: notes.trim(),
      active: 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.saveCalculatorTemplate(row);
    await load();
    setEditingId(row.id);
    toast.success(t("calcTemplates.saved"));
  };

  const open = (row: CalculatorTemplateRow) => {
    setEditingId(row.id);
    setName(row.name);
    setScope(row.scope || "both");
    setOrigin(row.origin || "");
    setUnloading(row.unloading || "");
    setDestination(row.destination || "");
    setCurrency(row.currency || "USD");
    setExchangeRate(String(row.exchangeRate || 1));
    setCustomsRate(String((row.customsRate || 0) * 100));
    setMarginRate(String((row.marginRate || 0) * 100));
    setAllocationBasis(row.allocationBasis || "value");
    setNotes(row.notes || "");
    try {
      setExternalExpenses(JSON.parse(row.externalExpensesJson || "[]") as QuickExpense[]);
      setInternalExpenses(JSON.parse(row.internalExpensesJson || "[]") as QuickExpense[]);
    } catch {
      setExternalExpenses(makeExternal(t));
      setInternalExpenses(makeInternal(t));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const duplicate = async (row: CalculatorTemplateRow) => {
    const now = nowIso();
    await db.saveCalculatorTemplate({
      ...row,
      id: newId("calc-template"),
      name: `${row.name} - ${t("calcTemplates.copySuffix")}`,
      createdAt: now,
      updatedAt: now,
    });
    await load();
    toast.success(t("calcTemplates.copied"));
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("calcTemplates.deleteConfirm"))) return;
    await db.deleteCalculatorTemplate(id);
    if (editingId === id) reset();
    await load();
    toast.success(t("calcTemplates.deleted"));
  };

  const summary = useMemo(() => ({
    external: externalExpenses.reduce((sum, row) => sum + row.amount, 0),
    internal: internalExpenses.reduce((sum, row) => sum + row.amount, 0),
  }), [externalExpenses, internalExpenses]);

  return (
    <AppLayout title={t("calcTemplates.title")} subtitle={t("calcTemplates.subtitle")}>
      <PageShell
        title={t("calcTemplates.title")}
        description={t("calcTemplates.description")}
        crumbs={[{ label: t("nav.settings"), href: "/settings" }, { label: t("calcTemplates.title") }]}
        actions={<div className="flex gap-2"><Button variant="outline" onClick={reset}><Plus className="h-4 w-4" />{t("calcTemplates.new")}</Button><Button onClick={() => void save()}><Save className="h-4 w-4" />{editingId ? t("calcTemplates.saveChanges") : t("calcTemplates.save")}</Button></div>}
      >
        <div className="space-y-5">
          <SectionCard title={t("calcTemplates.basic")} tone="input">
            <FormGrid cols={3}>
              <Field label={t("calcTemplates.name")} required control={<Input className="field-input" value={name} onChange={e => setName(e.target.value)} />} />
              <Field label={t("calcTemplates.scope")} control={<select className="field-input" value={scope} onChange={e => setScope(e.target.value as CalculatorTemplateRow["scope"])}><option value="both">{t("calcTemplates.scopeBoth")}</option><option value="single">{t("calcTemplates.scopeSingle")}</option><option value="multi">{t("calcTemplates.scopeMulti")}</option></select>} />
              <Field label={t("calcTemplates.currency")} control={<Input className="field-input" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} />} />
              <Field label={t("calcTemplates.origin")} control={<Input className="field-input" value={origin} onChange={e => setOrigin(e.target.value)} />} />
              <Field label={t("calcTemplates.unloading")} control={<Input className="field-input" value={unloading} onChange={e => setUnloading(e.target.value)} />} />
              <Field label={t("calcTemplates.destination")} control={<Input className="field-input" value={destination} onChange={e => setDestination(e.target.value)} />} />
              <Field label={t("quick.exchangeRate")} control={<NumberField value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} />} />
              <Field label={t("quick.customsRate")} control={<NumberField value={customsRate} onChange={e => setCustomsRate(e.target.value)} />} />
              <Field label={t("quick.markup")} control={<NumberField value={marginRate} onChange={e => setMarginRate(e.target.value)} />} />
            </FormGrid>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="text-xs font-semibold">{t("calcTemplates.allocation")}</span>
              <label className="flex items-center gap-1.5 text-xs"><input type="radio" checked={allocationBasis === "value"} onChange={() => setAllocationBasis("value")} />{t("multiQuick.byValue")}</label>
              <label className="flex items-center gap-1.5 text-xs"><input type="radio" checked={allocationBasis === "quantity"} onChange={() => setAllocationBasis("quantity")} />{t("multiQuick.byQuantity")}</label>
            </div>
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard title={t("quick.external")} description={t("calcTemplates.externalTotal").replace("{value}", String(summary.external))}>
              <div className="space-y-2">{externalExpenses.map(expense => <ExpenseEditor key={expense.id} expense={expense} onChange={patch => updateExpense("external", expense.id, patch)} t={t} />)}</div>
            </SectionCard>
            <SectionCard title={t("quick.internal")} description={t("calcTemplates.internalTotal").replace("{value}", String(summary.internal))}>
              <div className="space-y-2">{internalExpenses.map(expense => <ExpenseEditor key={expense.id} expense={expense} onChange={patch => updateExpense("internal", expense.id, patch)} t={t} />)}</div>
            </SectionCard>
          </div>

          <SectionCard title={t("calcTemplates.notes")}>
            <Input className="field-input" value={notes} onChange={e => setNotes(e.target.value)} />
          </SectionCard>

          <SectionCard title={t("calcTemplates.savedList")} description={t("calcTemplates.savedListHint")}>
            {rows.length ? <div className="grid gap-3 md:grid-cols-2">{rows.map(row => <article key={row.id} className="rounded border border-border bg-card p-3"><button type="button" className="w-full text-start" onClick={() => open(row)}><p className="text-sm font-bold">{row.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{[row.origin, row.unloading, row.destination].filter(Boolean).join(" → ") || t("calcTemplates.noRoute")}</p></button><div className="mt-3 flex gap-1"><Button size="sm" variant="outline" onClick={() => open(row)}>{t("calcTemplates.edit")}</Button><Button size="sm" variant="outline" onClick={() => void duplicate(row)}><Copy className="h-3.5 w-3.5" />{t("calcTemplates.copy")}</Button><Button size="sm" variant="ghost" onClick={() => void remove(row.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" />{t("calcTemplates.delete")}</Button></div></article>)}</div> : <p className="text-xs text-muted-foreground">{t("calcTemplates.empty")}</p>}
          </SectionCard>
        </div>
      </PageShell>
    </AppLayout>
  );
}

function ExpenseEditor({ expense, onChange, t }: { expense: QuickExpense; onChange: (patch: Partial<QuickExpense>) => void; t: (key: string) => string }) {
  return <div className="grid gap-2 rounded border border-border bg-card p-2 sm:grid-cols-[minmax(0,1fr)_120px_105px_auto] sm:items-center"><Input className="field-input" value={expense.name} onChange={e => onChange({ name: e.target.value })} /><NumberField value={String(expense.amount)} onChange={e => onChange({ amount: parseNumber(e.target.value) })} /><select className="field-input" value={expense.currency} onChange={e => onChange({ currency: e.target.value as QuickExpense["currency"] })}><option value="foreign">{t("quick.foreign")}</option><option value="local">{t("quick.local")}</option></select><label className="flex items-center gap-1.5 text-[10px]"><input type="checkbox" checked={expense.includeInCustomsBase} onChange={e => onChange({ includeInCustomsBase: e.target.checked })} />{t("quick.taxable")}</label></div>;
}
