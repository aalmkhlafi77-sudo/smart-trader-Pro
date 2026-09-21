import { useEffect, useMemo, useState } from "react";
import { Download, Save } from "lucide-react";
import { toast } from "sonner";
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
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
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
      return { result: null, error: error instanceof Error ? error.message : "تحقق من المدخلات" };
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
      toast.error(calculation.error || "تحقق من المدخلات");
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
    toast.success("تم حفظ مسودة الحاسبة");
  };

  const resultRows = calculation.result
    ? [
        ["إجمالي التكلفة", calculation.result.totalCost],
        ["تكلفة الوحدة", calculation.result.unitCost],
        ["سعر البيع التقريبي", calculation.result.suggestedPrice],
        ["قيمة البضاعة", calculation.result.goodsValue],
        ["المصاريف الخارجية", calculation.result.externalExpenses],
        ["الوعاء الجمركي", calculation.result.customsBase],
        ["الجمارك", calculation.result.customsAmount],
        ["المصاريف الداخلية", calculation.result.internalExpenses],
      ]
    : [];

  return (
    <AppLayout title="الحاسبة السريعة" subtitle="حساب تكلفة الوحدة وسعر البيع التقريبي">
      <PageShell
        title="الحاسبة السريعة"
        description="نموذج مستقل للحساب السريع؛ لا يغيّر أسعار المورد أو قوائم أسعار البيع تلقائياً."
        crumbs={[{ label: "لوحة العمل", href: "/" }, { label: "الحاسبة السريعة" }]}
        actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => calculation.result && exportQuickCalculator(input, calculation.result)} disabled={!calculation.result}><Download className="h-4 w-4" /> تصدير Excel</Button><Button onClick={() => void save()} disabled={!calculation.result}><Save className="h-4 w-4" /> حفظ مسودة</Button></div>}
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
          <div className="space-y-5">
            <SectionCard title="بيانات الشراء" description="اختر السجلات الموجودة أو أدخل بيانات يدوية." tone="input">
              <FormGrid cols={2}>
                <Field label="المورد" control={<select className="field-input" value={supplierName} onChange={e => setSupplierName(e.target.value)}><option value="">إدخال يدوي</option>{entities.filter(e => e.kind === "supplier" || e.kind === "factory").map(entity => <option key={entity.id} value={entity.name}>{entity.name}</option>)}</select>} />
                <Field label="الصنف" control={<select className="field-input" value={itemId} onChange={e => selectItem(e.target.value)}><option value="">إدخال يدوي</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}{item.code ? ` · ${item.code}` : ""}</option>)}</select>} />
                <Field label="اسم الصنف" required control={<Input className="field-input" value={itemName} onChange={e => setItemName(e.target.value)} />} />
                <Field label="العملة" control={<Input className="field-input" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} />} />
                <Field label="الكمية" required control={<NumberField value={quantity} onChange={e => setQuantity(e.target.value)} />} />
                <Field label="سعر الوحدة" required control={<NumberField value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />} />
                <Field label="سعر الصرف" required hint="سعر العملة الأجنبية مقابل العملة المحلية" control={<NumberField value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} />} />
                <Field label="نسبة الجمارك" control={<NumberField value={customsRate} onChange={e => setCustomsRate(e.target.value)} />} />
                <Field label="نسبة الزيادة على التكلفة" hint="ليست هامشاً من سعر البيع النهائي" control={<NumberField value={marginRate} onChange={e => setMarginRate(e.target.value)} />} />
              </FormGrid>
            </SectionCard>
            <SectionCard title="المصاريف الخارجية" description="حدد المصاريف التي تدخل في الوعاء الجمركي بشكل صريح."><div className="space-y-2">{externalExpenses.map(expense => <ExpenseEditor key={expense.id} expense={expense} onChange={patch => updateExpense("external", expense.id, patch)} />)}</div></SectionCard>
            <SectionCard title="المصاريف الداخلية"><div className="space-y-2">{internalExpenses.map(expense => <ExpenseEditor key={expense.id} expense={expense} onChange={patch => updateExpense("internal", expense.id, patch)} />)}</div></SectionCard>
          </div>
          <div className="space-y-5">
            <SectionCard title="النتائج" stamp="محسوبة" tone="result">
              {calculation.result ? <dl className="grid gap-2">{resultRows.map(([label, value], index) => <div key={String(label)} className={`flex items-center justify-between gap-3 rounded px-2 py-2 ${index === 0 || index === 2 ? "bg-[var(--computed-surface)]" : ""}`}><dt className="text-xs text-[var(--ink)]">{label}</dt><dd className="ledger-figure text-sm font-bold">{formatMoney(Number(value), "SAR")}</dd></div>)}</dl> : <p className="text-xs text-destructive">{calculation.error || "أدخل البيانات لعرض النتائج"}</p>}
            </SectionCard>
            <SectionCard title="المسودات المحفوظة" description="هذه المسودات لا تنشئ سعراً للبيع ولا تعدّل سعر المورد.">
              {savedRows.length ? <div className="space-y-2">{savedRows.slice(0, 6).map(row => <button type="button" key={row.id} className="flex w-full items-center justify-between rounded border border-border px-3 py-2 text-right hover:bg-secondary" onClick={() => { setSupplierName(row.supplierName); setItemId(row.itemId || ""); setItemName(row.itemName); setQuantity(String(row.quantity)); setUnitPrice(String(row.unitPrice)); setCurrency(row.currency); setExchangeRate(String(row.exchangeRate)); setCustomsRate(String(row.customsRate * 100)); setMarginRate(String(row.marginRate * 100)); }}><span className="text-xs font-semibold">{row.itemName || "صنف يدوي"}</span><span className="text-[11px] text-muted-foreground">{formatMoney(row.unitCost, row.currency)} / وحدة</span></button>)}</div> : <p className="text-xs text-muted-foreground">لا توجد مسودات بعد.</p>}
            </SectionCard>
          </div>
        </div>
      </PageShell>
    </AppLayout>
  );
}

function ExpenseEditor({ expense, onChange }: { expense: QuickExpense; onChange: (patch: Partial<QuickExpense>) => void }) {
  return <div className="grid gap-2 rounded border border-border bg-card p-2 sm:grid-cols-[minmax(0,1fr)_120px_105px_auto] sm:items-center"><Input className="field-input" value={expense.name} onChange={e => onChange({ name: e.target.value })} /><NumberField value={String(expense.amount)} onChange={e => onChange({ amount: parseNumber(e.target.value) })} /><select className="field-input" value={expense.currency} onChange={e => onChange({ currency: e.target.value as QuickExpense["currency"] })}><option value="foreign">أجنبية</option><option value="local">محلية</option></select><label className="flex items-center gap-1.5 text-[10px] text-[var(--ink)]"><input type="checkbox" checked={expense.includeInCustomsBase} onChange={e => onChange({ includeInCustomsBase: e.target.checked })} /> وعاء جمركي</label></div>;
}
