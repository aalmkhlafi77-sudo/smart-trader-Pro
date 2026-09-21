import { useEffect, useMemo, useState } from "react";
import { Download, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FormGrid,
  NumberField,
  PageShell,
  SectionCard,
} from "@/components/patterns";
import {
  db,
  type EntityRow,
  type ItemRow,
  type QuickCalculationRow,
} from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { formatMoney, parseNumber } from "@/lib/pricing";
import {
  calculateQuickCalculator,
  type QuickCalculatorInput,
  type QuickExpense,
} from "@/lib/quickCalculator";
import { exportQuickCalculator } from "@/lib/quickCalculatorExport";

const defaultExternal: QuickExpense[] = [
  { id: "insurance", name: "تأمين", amount: 0, currency: "foreign", includeInCustomsBase: true },
  { id: "external-shipping", name: "شحن خارجي", amount: 0, currency: "foreign", includeInCustomsBase: false },
  { id: "external-other", name: "مصروف خارجي آخر", amount: 0, currency: "foreign", includeInCustomsBase: true },
];

const defaultInternal: QuickExpense[] = [
  { id: "clearance", name: "تخليص", amount: 0, currency: "local", includeInCustomsBase: false },
  { id: "shipping-agent", name: "وكيل شحن", amount: 0, currency: "local", includeInCustomsBase: false },
  { id: "fines", name: "غرامات", amount: 0, currency: "local", includeInCustomsBase: false },
  { id: "clearance-office", name: "أتعاب مكتب التخليص", amount: 0, currency: "local", includeInCustomsBase: false },
  { id: "internal-transport", name: "نقل داخلي", amount: 0, currency: "local", includeInCustomsBase: false },
  { id: "handling", name: "تحميل وتفريغ", amount: 0, currency: "local", includeInCustomsBase: false },
  { id: "internal-other", name: "مصروف داخلي آخر", amount: 0, currency: "local", includeInCustomsBase: false },
];

const cloneExpenses = (rows: QuickExpense[]) => rows.map(row => ({ ...row }));

export default function QuickCalculator() {
  const { t } = useLanguage();
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [localCurrency, setLocalCurrency] = useState("SAR");
  const [currency, setCurrency] = useState("USD");
  const [supplierName, setSupplierName] = useState("");
  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [exchangeRate, setExchangeRate] = useState("3.75");
  const [customsRate, setCustomsRate] = useState("12");
  const [marginRate, setMarginRate] = useState("20");
  const [externalExpenses, setExternalExpenses] = useState(() => cloneExpenses(defaultExternal));
  const [internalExpenses, setInternalExpenses] = useState(() => cloneExpenses(defaultInternal));
  const [savedRows, setSavedRows] = useState<QuickCalculationRow[]>([]);

  useEffect(() => {
    void Promise.all([
      db.listEntities(),
      db.listItems(),
      db.getSettings(),
      db.listQuickCalculations(),
    ]).then(([nextEntities, nextItems, settings, nextSaved]) => {
      setEntities(nextEntities);
      setItems(nextItems);
      setLocalCurrency(settings.localCurrency || "SAR");
      setCurrency(settings.foreignCurrency || "USD");
      setExchangeRate(String(settings.defaultExchangeRate || 1));
      setCustomsRate(String((settings.defaultCustomsRate || 0) * 100));
      setMarginRate(String((settings.defaultMarginRate || 0) * 100));
      setSavedRows(nextSaved);
    });
  }, []);

  const input = useMemo<QuickCalculatorInput>(() => ({
    itemId: itemId || null,
    itemName,
    supplierName,
    quantity: parseNumber(quantity),
    unitPrice: parseNumber(unitPrice),
    currency,
    exchangeRate: parseNumber(exchangeRate),
    customsRate: parseNumber(customsRate) / 100,
    marginRate: parseNumber(marginRate) / 100,
    externalExpenses,
    internalExpenses,
  }), [itemId, itemName, supplierName, quantity, unitPrice, currency, exchangeRate, customsRate, marginRate, externalExpenses, internalExpenses]);

  const calculation = useMemo(() => {
    try {
      return { result: calculateQuickCalculator(input), error: "" };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : t("quick.invalid") };
    }
  }, [input]);

  const selectItem = (id: string) => {
    setItemId(id);
    const item = items.find(row => row.id === id);
    if (!item) return;
    setItemName(item.name);
    setCurrency(item.currency || currency);
    setExchangeRate(String(item.defaultExchangeRate || exchangeRate));
    if (item.customsRate != null) setCustomsRate(String(item.customsRate * 100));
  };

  const updateExpense = (
    group: "external" | "internal",
    id: string,
    patch: Partial<QuickExpense>
  ) => {
    const setter = group === "external" ? setExternalExpenses : setInternalExpenses;
    setter(rows => rows.map(row => (row.id === id ? { ...row, ...patch } : row)));
  };

  const save = async () => {
    if (!calculation.result) {
      toast.error(calculation.error || t("quick.invalid"));
      return;
    }
    const timestamp = nowIso();
    const result = calculation.result;
    const row: QuickCalculationRow = {
      id: newId("quick"), supplierName: supplierName.trim(), itemId: itemId || null,
      itemName: itemName.trim(), quantity: input.quantity, unitPrice: input.unitPrice,
      currency, exchangeRate: input.exchangeRate, customsRate: input.customsRate,
      marginRate: input.marginRate, externalExpensesJson: JSON.stringify(externalExpenses),
      internalExpensesJson: JSON.stringify(internalExpenses), goodsValue: result.goodsValue,
      externalExpenses: result.externalExpenses, internalExpenses: result.internalExpenses,
      customsBaseExtra: result.customsBaseExtra, customsBase: result.customsBase,
      customsAmount: result.customsAmount, totalCost: result.totalCost,
      unitCost: result.unitCost, suggestedPrice: result.suggestedPrice,
      createdAt: timestamp, updatedAt: timestamp,
    };
    await db.saveQuickCalculation(row);
    setSavedRows(rows => [row, ...rows]);
    toast.success(t("quick.saved"));
  };

  const deleteDraft = async (id: string) => {
    if (!window.confirm(t("quick.deleteDraftConfirm"))) return;
    try {
      await db.deleteQuickCalculation(id);
      setSavedRows(rows => rows.filter(row => row.id !== id));
      toast.success(t("quick.deleted"));
    } catch {
      toast.error(t("quick.deleteFailed"));
    }
  };

  const resultRows = calculation.result
    ? [
        [t("quick.totalCost"), calculation.result.totalCost],
        [t("quick.unitCost"), calculation.result.unitCost],
        [t("quick.suggestedPrice"), calculation.result.suggestedPrice],
        [t("quick.goodsValue"), calculation.result.goodsValue],
        [t("quick.externalTotal"), calculation.result.externalExpenses],
        [t("quick.customsBase"), calculation.result.customsBase],
        [t("quick.customsAmount"), calculation.result.customsAmount],
        [t("quick.internalTotal"), calculation.result.internalExpenses],
      ]
    : [];

  return (
    <AppLayout title={t("quick.title")} subtitle={t("quick.subtitle")}>
      <PageShell
        title={t("quick.title")}
        description={t("quick.description")}
        crumbs={[{ label: t("quick.home"), href: "/" }, { label: t("quick.title") }]}
        actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => calculation.result && exportQuickCalculator(input, calculation.result)} disabled={!calculation.result}><Download className="h-4 w-4" /> {t("quick.export")}</Button><Button onClick={() => void save()} disabled={!calculation.result}><Save className="h-4 w-4" /> {t("quick.saveDraft")}</Button></div>}
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
          <div className="space-y-5">
            <SectionCard title={t("quick.purchaseData")} description={t("quick.purchaseHint")} tone="input">
              <FormGrid cols={2}>
                <Field label={t("quick.supplier")} control={<select className="field-input" value={supplierName} onChange={e => setSupplierName(e.target.value)}><option value="">{t("quick.manualEntry")}</option>{entities.filter(e => e.kind === "supplier" || e.kind === "factory").map(entity => <option key={entity.id} value={entity.name}>{entity.name}</option>)}</select>} />
                <Field label={t("quick.item")} control={<select className="field-input" value={itemId} onChange={e => selectItem(e.target.value)}><option value="">{t("quick.manualEntry")}</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}{item.code ? ` · ${item.code}` : ""}</option>)}</select>} />
                <Field label={t("quick.itemName")} required control={<Input className="field-input" value={itemName} onChange={e => setItemName(e.target.value)} />} />
                <Field label={t("quick.currency")} control={<Input className="field-input" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} />} />
                <Field label={t("quick.quantity")} required control={<NumberField value={quantity} onChange={e => setQuantity(e.target.value)} />} />
                <Field label={t("quick.unitPrice")} required control={<NumberField value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />} />
                <Field label={t("quick.exchangeRate")} required hint={t("quick.exchangeRateHint")} control={<NumberField value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} />} />
                <Field label={t("quick.customsRate")} control={<NumberField value={customsRate} onChange={e => setCustomsRate(e.target.value)} />} />
                <Field label={t("quick.markup")} hint={t("quick.markupHint")} control={<NumberField value={marginRate} onChange={e => setMarginRate(e.target.value)} />} />
              </FormGrid>
            </SectionCard>
            <SectionCard title={t("quick.external")} description={t("quick.externalHint")}><div className="space-y-2">{externalExpenses.map(expense => <ExpenseEditor key={expense.id} expense={expense} onChange={patch => updateExpense("external", expense.id, patch)} t={t} />)}</div></SectionCard>
            <SectionCard title={t("quick.internal")}><div className="space-y-2">{internalExpenses.map(expense => <ExpenseEditor key={expense.id} expense={expense} onChange={patch => updateExpense("internal", expense.id, patch)} t={t} />)}</div></SectionCard>
          </div>
          <div className="space-y-5">
            <SectionCard title={t("quick.results")} stamp={t("quick.calculated")} tone="result">
              {calculation.result ? <dl className="grid gap-2">{resultRows.map(([label, value], index) => <div key={String(label)} className={`flex items-center justify-between gap-3 rounded px-2 py-2 ${index === 0 || index === 2 ? "bg-[var(--computed-surface)]" : ""}`}><dt className="text-xs text-[var(--ink)]">{label}</dt><dd className="ledger-figure text-sm font-bold">{formatMoney(Number(value), localCurrency)}</dd></div>)}</dl> : <p className="text-xs text-destructive">{calculation.error || t("quick.noResults")}</p>}
            </SectionCard>
            <SectionCard title={t("quick.savedDrafts")} description={t("quick.savedHint")}>
              {savedRows.length ? <div className="space-y-2">{savedRows.slice(0, 6).map(row => <div key={row.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5"><button type="button" className="flex min-w-0 flex-1 items-center justify-between rounded px-1 py-1.5 text-right hover:bg-secondary" onClick={() => { setSupplierName(row.supplierName); setItemId(row.itemId || ""); setItemName(row.itemName); setQuantity(String(row.quantity)); setUnitPrice(String(row.unitPrice)); setCurrency(row.currency); setExchangeRate(String(row.exchangeRate)); setCustomsRate(String(row.customsRate * 100)); setMarginRate(String(row.marginRate * 100)); try { setExternalExpenses(JSON.parse(row.externalExpensesJson) as QuickExpense[]); setInternalExpenses(JSON.parse(row.internalExpensesJson) as QuickExpense[]); } catch { setExternalExpenses(cloneExpenses(defaultExternal)); setInternalExpenses(cloneExpenses(defaultInternal)); } }}><span className="truncate text-xs font-semibold">{row.itemName || t("quick.manualItem")}</span><span className="shrink-0 text-[11px] text-muted-foreground">{formatMoney(row.unitCost, row.currency)} {t("quick.perUnit")}</span></button><Button type="button" variant="ghost" size="icon-sm" aria-label={t("quick.deleteDraft")} title={t("quick.deleteDraft")} onClick={() => void deleteDraft(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div> : <p className="text-xs text-muted-foreground">{t("quick.noDrafts")}</p>}
            </SectionCard>
          </div>
        </div>
      </PageShell>
    </AppLayout>
  );
}

function ExpenseEditor({ expense, onChange, t }: { expense: QuickExpense; onChange: (patch: Partial<QuickExpense>) => void; t: (key: string) => string }) {
  return <div className="grid gap-2 rounded border border-border bg-card p-2 sm:grid-cols-[minmax(0,1fr)_120px_105px_auto] sm:items-center"><Input className="field-input" value={expense.name} onChange={e => onChange({ name: e.target.value })} /><NumberField value={String(expense.amount)} onChange={e => onChange({ amount: parseNumber(e.target.value) })} /><select className="field-input" value={expense.currency} onChange={e => onChange({ currency: e.target.value as QuickExpense["currency"] })}><option value="foreign">{t("quick.foreign")}</option><option value="local">{t("quick.local")}</option></select><label className="flex items-center gap-1.5 text-[10px] text-[var(--ink)]"><input type="checkbox" checked={expense.includeInCustomsBase} onChange={e => onChange({ includeInCustomsBase: e.target.checked })} /> {t("quick.taxable")}</label></div>;
}
