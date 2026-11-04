import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Search, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormGrid, NumberField, PageShell, SectionCard } from "@/components/patterns";
import { db, type CargoCostItemRow, type CargoCostLineRow, type EntityRow, type ItemRow, type QuickCalculationRow } from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { formatMoney, parseNumber } from "@/lib/pricing";
import { calculateCargoPricing } from "@/lib/cargoPricing";
import type { QuickExpense } from "@/lib/quickCalculator";
import { useLanguage } from "@/contexts/LanguageContext";

type AllocationBasis = "value" | "quantity";

type MultiItemDraft = {
  rowId: string;
  itemId: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
  currency: string;
  exchangeRate: string;
  customsRate: string;
};

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
const makeDraft = (currency = "USD", exchangeRate = "3.75", customsRate = "12"): MultiItemDraft => ({
  rowId: newId("multi-item"),
  itemId: "",
  itemName: "",
  quantity: "1",
  unitPrice: "0",
  currency,
  exchangeRate,
  customsRate,
});

function localExpenseAmount(expense: QuickExpense, exchangeRate: number) {
  return expense.amount * (expense.currency === "foreign" ? exchangeRate : 1);
}

export default function MultiQuickCalculator() {
  const { t } = useLanguage();
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [catalogItems, setCatalogItems] = useState<ItemRow[]>([]);
  const [localCurrency, setLocalCurrency] = useState("SAR");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [defaultExchangeRate, setDefaultExchangeRate] = useState("3.75");
  const [defaultCustomsRate, setDefaultCustomsRate] = useState("12");
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [marginRate, setMarginRate] = useState("20");
  const [allocationBasis, setAllocationBasis] = useState<AllocationBasis>("value");
  const [items, setItems] = useState<MultiItemDraft[]>([makeDraft()]);
  const [externalExpenses, setExternalExpenses] = useState(() => cloneExpenses(defaultExternal));
  const [internalExpenses, setInternalExpenses] = useState(() => cloneExpenses(defaultInternal));
  const [savedRows, setSavedRows] = useState<QuickCalculationRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadSaved = async () => {
    const rows = await db.listQuickCalculations();
    setSavedRows(rows.filter(row => row.mode === "multi"));
  };

  useEffect(() => {
    void Promise.all([db.listEntities(), db.listItems(), db.getSettings(), db.listQuickCalculations()])
      .then(([nextEntities, nextItems, settings, rows]) => {
        setEntities(nextEntities);
        setCatalogItems(nextItems);
        const local = settings.localCurrency || "SAR";
        const foreign = settings.foreignCurrency || "USD";
        const rate = String(settings.defaultExchangeRate || 1);
        const customs = String((settings.defaultCustomsRate || 0) * 100);
        setLocalCurrency(local);
        setDefaultCurrency(foreign);
        setDefaultExchangeRate(rate);
        setDefaultCustomsRate(customs);
        setMarginRate(String((settings.defaultMarginRate || 0) * 100));
        setItems([makeDraft(foreign, rate, customs)]);
        setSavedRows(rows.filter(row => row.mode === "multi"));
      });
  }, []);

  const calculation = useMemo(() => {
    try {
      const normalized = items.map(item => ({
        ...item,
        quantityValue: parseNumber(item.quantity),
        unitPriceValue: parseNumber(item.unitPrice),
        exchangeRateValue: parseNumber(item.exchangeRate),
        customsRateValue: parseNumber(item.customsRate) / 100,
      }));
      if (normalized.some(item => item.quantityValue <= 0)) throw new Error(t("multiQuick.invalidQuantity"));
      if (normalized.some(item => item.unitPriceValue < 0 || item.exchangeRateValue <= 0 || item.customsRateValue < 0)) throw new Error(t("multiQuick.invalidInputs"));

      const cargoItems: CargoCostItemRow[] = normalized.map(item => ({
        id: item.rowId,
        runId: "multi-quick-preview",
        itemId: item.rowId,
        itemName: item.itemName.trim() || t("quick.manualItem"),
        priceLevel: 1,
        priceSource: "manual",
        priceEffectiveDate: "",
        unitPrice: item.unitPriceValue,
        currency: item.currency,
        exchangeRate: item.exchangeRateValue,
        quantity: item.quantityValue,
        unit: "",
        customsCategory: "",
        customsRate: item.customsRateValue,
        goodsValue: 0,
        allocatedCost: 0,
        finalUnitCost: 0,
        suggestedPrice: 0,
        createdAt: "",
        updatedAt: "",
      }));

      const allExpenses = [
        ...externalExpenses.map((expense, index) => ({ expense, index, group: "external" as const })),
        ...internalExpenses.map((expense, index) => ({ expense, index: index + externalExpenses.length, group: "internal" as const })),
      ];
      const representativeRate = normalized.find(row => row.exchangeRateValue > 0)?.exchangeRateValue ?? 1;
      const customsBaseExtra = externalExpenses
        .filter(expense => expense.includeInCustomsBase)
        .reduce((sum, expense) => sum + localExpenseAmount(expense, representativeRate), 0);

      const costLines: CargoCostLineRow[] = allExpenses.map(({ expense, index }) => ({
        id: `multi-expense-${expense.id}-${index}`,
        runId: "multi-quick-preview",
        name: expense.name.trim() || t("multiQuick.expense"),
        stage: "other",
        status: "entered",
        method: "fixed",
        allocationBasis,
        currency: "local",
        exchangeRate: 1,
        amount: localExpenseAmount(expense, representativeRate),
        referenceQuantity: 0,
        referenceUnit: "",
        percentageBase: 0,
        itemIds: "",
        sourceLabel: t("multiQuick.title"),
        rateId: "",
        templateId: "",
        effectiveDate: "",
        reason: "",
        sortOrder: (index + 1) * 10,
        createdAt: "",
        updatedAt: "",
      }));
      costLines.push({
        id: "multi-customs",
        runId: "multi-quick-preview",
        name: "الجمارك",
        stage: "customs",
        status: "entered",
        method: "fixed",
        allocationBasis: "value",
        currency: "local",
        exchangeRate: 1,
        amount: 0,
        referenceQuantity: 0,
        referenceUnit: "",
        percentageBase: 0,
        itemIds: "",
        sourceLabel: t("multiQuick.title"),
        rateId: "",
        templateId: "",
        effectiveDate: "",
        reason: "",
        sortOrder: 999,
        createdAt: "",
        updatedAt: "",
      });

      return {
        error: "",
        result: calculateCargoPricing({
          items: cargoItems,
          costLines,
          customsBaseExtra,
          marginRate: parseNumber(marginRate) / 100,
        }),
      };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : t("multiQuick.invalidInputs") };
    }
  }, [items, externalExpenses, internalExpenses, allocationBasis, marginRate, t]);

  const updateItem = (rowId: string, patch: Partial<MultiItemDraft>) =>
    setItems(rows => rows.map(row => row.rowId === rowId ? { ...row, ...patch } : row));

  const selectCatalogItem = (rowId: string, id: string) => {
    const selected = catalogItems.find(row => row.id === id);
    if (!selected) {
      updateItem(rowId, { itemId: "", itemName: "" });
      return;
    }
    updateItem(rowId, {
      itemId: selected.id,
      itemName: selected.name,
      currency: selected.currency || defaultCurrency,
      exchangeRate: String(selected.defaultExchangeRate || defaultExchangeRate),
      customsRate: String((selected.customsRate ?? parseNumber(defaultCustomsRate) / 100) * 100),
    });
  };

  const updateExpense = (group: "external" | "internal", id: string, patch: Partial<QuickExpense>) => {
    const setter = group === "external" ? setExternalExpenses : setInternalExpenses;
    setter(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setReference("");
    setSupplierName("");
    setAllocationBasis("value");
    setItems([makeDraft(defaultCurrency, defaultExchangeRate, defaultCustomsRate)]);
    setExternalExpenses(cloneExpenses(defaultExternal));
    setInternalExpenses(cloneExpenses(defaultInternal));
  };

  const save = async () => {
    if (!calculation.result) {
      toast.error(calculation.error || t("multiQuick.invalidInputs"));
      return;
    }
    if (items.length < 2) {
      toast.error(t("multiQuick.minimumItems"));
      return;
    }
    const now = nowIso();
    const existing = editingId ? savedRows.find(row => row.id === editingId) : null;
    const representativeRate = parseNumber(items[0]?.exchangeRate || defaultExchangeRate);
    const externalTotal = externalExpenses.reduce((sum, e) => sum + localExpenseAmount(e, representativeRate), 0);
    const internalTotal = internalExpenses.reduce((sum, e) => sum + localExpenseAmount(e, representativeRate), 0);
    const row: QuickCalculationRow = {
      id: editingId ?? newId("multi-quick"),
      mode: "multi",
      title: title.trim(),
      reference: reference.trim(),
      allocationBasis,
      itemsJson: JSON.stringify(items),
      supplierName: supplierName.trim(),
      itemId: null,
      itemName: items.map(item => item.itemName.trim()).filter(Boolean).join(" | "),
      quantity: items.reduce((sum, item) => sum + parseNumber(item.quantity), 0),
      unitPrice: 0,
      currency: localCurrency,
      exchangeRate: representativeRate,
      customsRate: 0,
      marginRate: parseNumber(marginRate) / 100,
      externalExpensesJson: JSON.stringify(externalExpenses),
      internalExpensesJson: JSON.stringify(internalExpenses),
      goodsValue: calculation.result.invoiceValue,
      externalExpenses: externalTotal,
      internalExpenses: internalTotal,
      customsBaseExtra: calculation.result.customsBase - calculation.result.invoiceValue,
      customsBase: calculation.result.customsBase,
      customsAmount: calculation.result.customsAmount,
      totalCost: calculation.result.totalCost,
      unitCost: 0,
      suggestedPrice: calculation.result.totalSuggestedRevenue,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.saveQuickCalculation(row);
    await loadSaved();
    setEditingId(row.id);
    toast.success(t("multiQuick.saved"));
  };

  const openSaved = (row: QuickCalculationRow) => {
    try {
      const restoredItems = JSON.parse(row.itemsJson || "[]") as MultiItemDraft[];
      const restoredExternal = JSON.parse(row.externalExpensesJson || "[]") as QuickExpense[];
      const restoredInternal = JSON.parse(row.internalExpensesJson || "[]") as QuickExpense[];
      setEditingId(row.id);
      setTitle(row.title || "");
      setReference(row.reference || "");
      setSupplierName(row.supplierName || "");
      setAllocationBasis(row.allocationBasis || "value");
      setMarginRate(String((row.marginRate || 0) * 100));
      setItems(restoredItems.length ? restoredItems : [makeDraft(defaultCurrency, defaultExchangeRate, defaultCustomsRate)]);
      setExternalExpenses(restoredExternal.length ? restoredExternal : cloneExpenses(defaultExternal));
      setInternalExpenses(restoredInternal.length ? restoredInternal : cloneExpenses(defaultInternal));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast.error(t("multiQuick.openFailed"));
    }
  };

  const removeSaved = async (id: string) => {
    if (!window.confirm(t("multiQuick.deleteConfirm"))) return;
    await db.deleteQuickCalculation(id);
    if (editingId === id) resetForm();
    await loadSaved();
    toast.success(t("multiQuick.deleted"));
  };

  const expenseTotals = useMemo(() => {
    const representativeRate = parseNumber(items[0]?.exchangeRate || defaultExchangeRate);
    return {
      external: externalExpenses.reduce(
        (sum, expense) => sum + localExpenseAmount(expense, representativeRate),
        0
      ),
      internal: internalExpenses.reduce(
        (sum, expense) => sum + localExpenseAmount(expense, representativeRate),
        0
      ),
    };
  }, [items, defaultExchangeRate, externalExpenses, internalExpenses]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    if (!q) return savedRows;
    return savedRows.filter(row => {
      const haystack = [row.title, row.reference, row.supplierName, row.itemName].filter(Boolean).join(" ").toLocaleLowerCase();
      return haystack.includes(q);
    });
  }, [savedRows, search]);

  return (
    <AppLayout title={t("multiQuick.title")} subtitle={t("multiQuick.subtitle")}>
      <PageShell
        title={t("multiQuick.title")}
        description={t("multiQuick.description")}
        crumbs={[{ label: t("quick.home"), href: "/" }, { label: t("multiQuick.title") }]}
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={resetForm}><Plus className="h-4 w-4" />{t("multiQuick.new")}</Button>
          <Button onClick={() => void save()} disabled={!calculation.result}><Save className="h-4 w-4" />{editingId ? t("multiQuick.saveChanges") : t("multiQuick.save")}</Button>
        </div>}
      >
        <div className="space-y-5">
          <SectionCard title={t("multiQuick.operationData")} tone="input">
            <FormGrid cols={2}>
              <Field label={t("multiQuick.operationName")} control={<Input className="field-input" value={title} onChange={e => setTitle(e.target.value)} />} />
              <Field label={t("multiQuick.reference")} control={<Input className="field-input" value={reference} onChange={e => setReference(e.target.value)} />} />
              <Field label={t("quick.supplier")} control={<select className="field-input" value={supplierName} onChange={e => setSupplierName(e.target.value)}><option value="">{t("quick.manualEntry")}</option>{entities.filter(e => e.kind === "supplier" || e.kind === "factory").map(entity => <option key={entity.id} value={entity.name}>{entity.name}</option>)}</select>} />
              <Field label={t("quick.markup")} control={<NumberField value={marginRate} onChange={e => setMarginRate(e.target.value)} />} />
            </FormGrid>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs font-semibold">{t("multiQuick.allocation")}</span>
              <label className="flex items-center gap-1.5 text-xs"><input type="radio" checked={allocationBasis === "value"} onChange={() => setAllocationBasis("value")} />{t("multiQuick.byValue")}</label>
              <label className="flex items-center gap-1.5 text-xs"><input type="radio" checked={allocationBasis === "quantity"} onChange={() => setAllocationBasis("quantity")} />{t("multiQuick.byQuantity")}</label>
            </div>
          </SectionCard>

          <SectionCard title={t("multiQuick.items")} description={t("multiQuick.itemsHint")}>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.rowId} className="rounded border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <strong className="text-xs">{t("multiQuick.item")} {index + 1}</strong>
                    {items.length > 1 ? <Button variant="ghost" size="icon-sm" onClick={() => setItems(rows => rows.filter(row => row.rowId !== item.rowId))}><X className="h-4 w-4 text-destructive" /></Button> : null}
                  </div>
                  <FormGrid cols={3}>
                    <Field label={t("quick.item")} control={<select className="field-input" value={item.itemId} onChange={e => selectCatalogItem(item.rowId, e.target.value)}><option value="">{t("quick.manualEntry")}</option>{catalogItems.map(row => <option key={row.id} value={row.id}>{row.name}{row.code ? ` · ${row.code}` : ""}</option>)}</select>} />
                    <Field label={t("quick.itemName")} required control={<Input className="field-input" value={item.itemName} onChange={e => updateItem(item.rowId, { itemName: e.target.value })} />} />
                    <Field label={t("quick.quantity")} required control={<NumberField value={item.quantity} onChange={e => updateItem(item.rowId, { quantity: e.target.value })} />} />
                    <Field label={t("quick.unitPrice")} required control={<NumberField value={item.unitPrice} onChange={e => updateItem(item.rowId, { unitPrice: e.target.value })} />} />
                    <Field label={t("quick.currency")} control={<Input className="field-input" value={item.currency} onChange={e => updateItem(item.rowId, { currency: e.target.value.toUpperCase() })} />} />
                    <Field label={t("quick.exchangeRate")} required control={<NumberField value={item.exchangeRate} onChange={e => updateItem(item.rowId, { exchangeRate: e.target.value })} />} />
                    <Field label={t("quick.customsRate")} control={<NumberField value={item.customsRate} onChange={e => updateItem(item.rowId, { customsRate: e.target.value })} />} />
                  </FormGrid>
                </div>
              ))}
            </div>
            <Button className="mt-3" variant="outline" onClick={() => setItems(rows => [...rows, makeDraft(defaultCurrency, defaultExchangeRate, defaultCustomsRate)])}><Plus className="h-4 w-4" />{t("multiQuick.addItem")}</Button>
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard title={t("quick.external")}>
              <div className="space-y-2">{externalExpenses.map(expense => <ExpenseEditor key={expense.id} expense={expense} onChange={patch => updateExpense("external", expense.id, patch)} t={t} />)}</div>
            </SectionCard>
            <SectionCard title={t("quick.internal")}>
              <div className="space-y-2">{internalExpenses.map(expense => <ExpenseEditor key={expense.id} expense={expense} onChange={patch => updateExpense("internal", expense.id, patch)} t={t} />)}</div>
            </SectionCard>
          </div>

          <SectionCard title={t("multiQuick.results")} tone="result">
            {calculation.result ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  <Result label={t("quick.goodsValue")} value={calculation.result.invoiceValue} currency={localCurrency} />
                  <Result label={t("quick.externalTotal")} value={expenseTotals.external} currency={localCurrency} />
                  <Result label={t("quick.customsAmount")} value={calculation.result.customsAmount} currency={localCurrency} />
                  <Result label={t("quick.internalTotal")} value={expenseTotals.internal} currency={localCurrency} />
                  <Result label={t("multiQuick.goodsCost")} value={calculation.result.totalCost} currency={localCurrency} />
                </div>
                <div className="overflow-x-auto rounded border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/60"><tr><th className="p-2 text-start">{t("quick.item")}</th><th className="p-2">{t("multiQuick.allocatedCost")}</th><th className="p-2">{t("quick.unitCost")}</th><th className="p-2">{t("quick.suggestedPrice")}</th></tr></thead>
                    <tbody>{calculation.result.items.map((row, index) => <tr key={row.itemId} className="border-t border-border"><td className="p-2 font-semibold">{items[index]?.itemName || t("quick.manualItem")}</td><td className="p-2 text-center">{formatMoney(row.allocatedCost, localCurrency)}</td><td className="p-2 text-center">{formatMoney(row.unitCost, localCurrency)}</td><td className="p-2 text-center font-bold">{formatMoney(row.suggestedPrice, localCurrency)}</td></tr>)}</tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-secondary/40 font-semibold">
                        <td className="p-2 text-start">{t("multiQuick.totalAllocatedCost")}</td>
                        <td className="p-2 text-center">{formatMoney(calculation.result.items.reduce((sum, row) => sum + row.allocatedCost, 0), localCurrency)}</td>
                        <td className="p-2" />
                        <td className="p-2" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : <p className="text-xs text-destructive">{calculation.error}</p>}
          </SectionCard>

          <SectionCard title={t("multiQuick.savedOperations")} description={t("multiQuick.savedHint")}>
            <div className="mb-3 flex items-center gap-2 rounded border border-border bg-card px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input className="border-0 bg-transparent shadow-none" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("multiQuick.searchPlaceholder")} />
            </div>
            {filteredRows.length ? <div className="space-y-2">{filteredRows.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-card p-2.5"><button type="button" className="min-w-0 flex-1 text-start" onClick={() => openSaved(row)}><div className="truncate text-xs font-semibold">{row.title || row.reference || t("multiQuick.untitled")}</div><div className="mt-1 truncate text-[11px] text-muted-foreground">{[row.supplierName, row.itemName].filter(Boolean).join(" · ")}</div></button><div className="flex gap-1"><Button variant="ghost" size="icon-sm" title={t("multiQuick.openEdit")} onClick={() => openSaved(row)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon-sm" title={t("multiQuick.delete")} onClick={() => void removeSaved(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div> : <p className="text-xs text-muted-foreground">{t("multiQuick.noSaved")}</p>}
          </SectionCard>
        </div>
      </PageShell>
    </AppLayout>
  );
}

function Result({ label, value, currency }: { label: string; value: number; currency: string }) {
  return <div className="rounded border border-border bg-[var(--computed-surface)] p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="ledger-figure mt-1 font-bold">{formatMoney(value, currency)}</div></div>;
}

function ExpenseEditor({ expense, onChange, t }: { expense: QuickExpense; onChange: (patch: Partial<QuickExpense>) => void; t: (key: string) => string }) {
  return <div className="grid gap-2 rounded border border-border bg-card p-2 sm:grid-cols-[minmax(0,1fr)_120px_105px_auto] sm:items-center"><Input className="field-input" value={expense.name} onChange={e => onChange({ name: e.target.value })} /><NumberField value={String(expense.amount)} onChange={e => onChange({ amount: parseNumber(e.target.value) })} /><select className="field-input" value={expense.currency} onChange={e => onChange({ currency: e.target.value as QuickExpense["currency"] })}><option value="foreign">{t("quick.foreign")}</option><option value="local">{t("quick.local")}</option></select><label className="flex items-center gap-1.5 text-[10px]"><input type="checkbox" checked={expense.includeInCustomsBase} onChange={e => onChange({ includeInCustomsBase: e.target.checked })} />{t("quick.taxable")}</label></div>;
}
