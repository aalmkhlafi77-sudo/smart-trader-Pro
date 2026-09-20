import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CurrencyField,
  Field,
  NumberField,
} from "@/components/patterns/Fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  CargoAllocationBasis,
  CargoCostMethod,
  CargoCostStage,
  CargoCostStatus,
} from "@/lib/db";
import { newId } from "@/lib/id";
import type { CargoCostDraft } from "../shared";

const STAGES: { value: CargoCostStage; labelKey: string }[] = [
  { value: "factory", labelKey: "cargo.stageFactory" },
  { value: "port", labelKey: "cargo.stagePort" },
  { value: "customs", labelKey: "cargo.stageCustoms" },
  { value: "warehouse", labelKey: "cargo.stageWarehouse" },
  { value: "other", labelKey: "cargo.stageOther" },
];

/**
 * مسار يدوي مختصر: بند تكلفة من الصفر دون قوالب ولا إعداد مسبق.
 * ينتج نفس شكل البند القادم من القوالب فيُحسب ويُحفظ معها دون تمييز.
 */
export function ExpenseLineSheet({
  open,
  onClose,
  localCurrency,
  foreignCurrency,
  defaultExchangeRate,
  itemNames,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  localCurrency: string;
  foreignCurrency: string;
  defaultExchangeRate: number;
  itemNames: { id: string; itemId: string; name: string }[];
  onAdd: (line: CargoCostDraft) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [stage, setStage] = useState<CargoCostStage>("other");
  const [status, setStatus] =
    useState<Extract<CargoCostStatus, "entered" | "included" | "third-party" | "missing">>("entered");
  const [method, setMethod] = useState<CargoCostMethod>("fixed");
  const [basis, setBasis] = useState<CargoAllocationBasis>("value");
  const [currency, setCurrency] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [amount, setAmount] = useState("");
  const [itemId, setItemId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setStage("other");
    setStatus("entered");
    setMethod("fixed");
    setBasis("value");
    setCurrency(localCurrency);
    setExchangeRate("1");
    setAmount("");
    setItemId("");
    setReason("");
  }, [open, localCurrency]);

  const save = () => {
    if (!name.trim()) {
      toast.error(t("cargo.enterLineName"));
      return;
    }
    const effectiveCurrency = currency || localCurrency;
    onAdd({
      id: newId("cost"),
      name: name.trim(),
      stage,
      status,
      method,
      allocationBasis: basis,
      currency: effectiveCurrency,
      exchangeRate:
        effectiveCurrency === localCurrency
          ? "1"
          : exchangeRate || String(defaultExchangeRate),
      amount,
      itemIds: itemId ? [itemId] : [],
      sourceLabel: "",
      rateId: "",
      reason: reason.trim(),
    });
    onClose();
    toast.success(t("cargo.lineAdded"));
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="left" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("cargo.customLineTitle")}</SheetTitle>
          <SheetDescription>{t("cargo.stepExpensesHint")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4">
          <Field
            label={t("cargo.lineItemWord")}
            required
            htmlFor="custom-line-name"
            control={
              <Input
                id="custom-line-name"
                className="field-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t("cargo.lineItemWord")}
              />
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t("cargo.stageWord")}
              control={
                <Select value={stage} onValueChange={v => setStage(v as CargoCostStage)}>
                  <SelectTrigger className="field-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {t(s.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <Field
              label={t("common.status")}
              control={
                <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
                  <SelectTrigger className="field-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entered">{t("cargo.enteredAmount")}</SelectItem>
                    <SelectItem value="included">{t("cargo.includedInSupplierPrice")}</SelectItem>
                    <SelectItem value="third-party">{t("cargo.borneByOtherParty")}</SelectItem>
                    <SelectItem value="missing">{t("cargo.enterAmountNeeded")}</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t("cargo.lineMethod")}
              control={
                <Select value={method} onValueChange={v => setMethod(v as CargoCostMethod)}>
                  <SelectTrigger className="field-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{t("cargo.fixedAmount")}</SelectItem>
                    <SelectItem value="per-unit">{t("cargo.perUnit")}</SelectItem>
                    <SelectItem value="percentage">{t("common.percentage")}</SelectItem>
                    <SelectItem value="manual">{t("cargo.manual")}</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
            <Field
              label={t("cargo.lineBasis")}
              control={
                <Select value={basis} onValueChange={v => setBasis(v as CargoAllocationBasis)}>
                  <SelectTrigger className="field-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="value">{t("cargo.byValue")}</SelectItem>
                    <SelectItem value="quantity">{t("cargo.byQuantity")}</SelectItem>
                    <SelectItem value="weight">{t("cargo.byWeight")}</SelectItem>
                    <SelectItem value="area">{t("cargo.byArea")}</SelectItem>
                    <SelectItem value="manual">{t("cargo.manual")}</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t("cargo.amount")}
              control={
                <CurrencyField
                  value={amount}
                  suffix={currency || localCurrency}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              }
            />
            <Field
              label={t("common.currency")}
              control={
                <Select
                  value={currency || localCurrency}
                  onValueChange={v => {
                    setCurrency(v);
                    if (v === localCurrency) setExchangeRate("1");
                  }}
                >
                  <SelectTrigger className="field-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={localCurrency}>{localCurrency}</SelectItem>
                    <SelectItem value={foreignCurrency}>{foreignCurrency}</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t("common.exchangerate")}
              control={
                <NumberField
                  disabled={(currency || localCurrency) === localCurrency}
                  value={(currency || localCurrency) === localCurrency ? "1" : exchangeRate}
                  onChange={e => setExchangeRate(e.target.value)}
                />
              }
            />
            <Field
              label={t("cargo.targetItem")}
              control={
                <Select
                  value={itemId || "__none__"}
                  onValueChange={v => setItemId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="field-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t("cargo.allCompatibleItems")}
                    </SelectItem>
                    {itemNames.map(item => (
                      <SelectItem key={item.id} value={item.itemId}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          </div>
          <Field
            label={t("cargo.stateReason")}
            control={
              <Input
                className="field-input"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={t("cargo.stateReason")}
              />
            }
          />
        </div>
        <SheetFooter>
          <Button onClick={save}>{t("cargo.addCustomLine")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
