import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DateField, Field, NumberField } from "@/components/patterns/Fields";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { rateSchema } from "@/lib/validation/schemas";
import {
  db,
  type CargoCostMethod,
  type LogisticsLocationRow,
  type LogisticsRateKind,
  type LogisticsRateRow,
} from "@/lib/db";
import { newId, nowIso } from "@/lib/id";

const today = () => new Date().toISOString().slice(0, 10);

/** العملة المخزَّنة الافتراضية (رمز ISO منذ S5). */
const RATE_DATA_DEFAULTS = { currency: "USD" };

const KINDS: { value: LogisticsRateKind; labelKey: string }[] = [
  { value: "freight", labelKey: "settings.internationalShipping" },
  { value: "clearance-fee", labelKey: "settings.clearanceFee" },
  { value: "clearance-office", labelKey: "settings.clearanceOfficeFee" },
  { value: "transport", labelKey: "settings.inlandTransfer" },
  { value: "handling", labelKey: "settings.loadingUnloading" },
  { value: "other", labelKey: "settings.otherExpense" },
];

export function RateSheet({
  open,
  onClose,
  editing,
  locations,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: LogisticsRateRow | null;
  locations: LogisticsLocationRow[];
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<LogisticsRateKind>("freight");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(RATE_DATA_DEFAULTS.currency);
  const [method, setMethod] = useState<CargoCostMethod>("fixed");
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setKind(editing?.kind ?? "freight");
    setAmount(editing?.amount != null ? String(editing.amount) : "");
    setCurrency(editing?.currency || RATE_DATA_DEFAULTS.currency);
    setMethod(editing?.method ?? "fixed");
    setOriginId(editing?.originLocationId ?? "");
    setDestinationId(editing?.destinationLocationId ?? "");
    setEffectiveDate(editing?.effectiveDate || today());
    setErrors({});
  }, [open, editing]);

  const save = async () => {
    const parsed = rateSchema(t).safeParse({ name, amount, currency, effectiveDate });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    const value = Number(amount);
    const timestamp = nowIso();
    await db.saveLogisticsRate({
      id: editing?.id ?? newId("rate"),
      name: name.trim(),
      kind,
      originLocationId: originId,
      destinationLocationId: destinationId,
      incoterm: editing?.incoterm ?? "",
      transportMode: editing?.transportMode ?? "",
      clearanceOffice: editing?.clearanceOffice ?? "",
      shipmentDescriptor: editing?.shipmentDescriptor ?? "",
      currency: currency.trim() || RATE_DATA_DEFAULTS.currency,
      amount: value,
      method,
      referenceUnit: method === "per-unit" ? t("cargo.unitWord") : "",
      effectiveDate: effectiveDate || today(),
      active: editing?.active ?? 1,
      notes: editing?.notes ?? "",
      createdAt: editing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    onClose();
    onSaved();
    toast.success(t("settings.servicePriceSaved"));
  };

  const placeSelect = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string
  ) => (
    <Select
      value={value || "__none__"}
      onValueChange={v => onChange(v === "__none__" ? "" : v)}
    >
      <SelectTrigger className="field-input w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{placeholder}</SelectItem>
        {locations.map(l => (
          <SelectItem key={l.id} value={l.id}>
            {l.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="left" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {editing ? t("settings.editRate") : t("settings.savePrice")}
          </SheetTitle>
          <SheetDescription>{t("settings.ratesAddHint")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4">
            <Field
              label={t("settings.servicePriceName")}
              required
              error={errors.name}
            control={
              <Input
                className="field-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t("settings.servicePriceName")}
              />
            }
          />
          <Field
            label={t("entities.type")}
            control={
              <Select value={kind} onValueChange={v => setKind(v as LogisticsRateKind)}>
                <SelectTrigger className="field-input w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map(k => (
                    <SelectItem key={k.value} value={k.value}>
                      {t(k.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t("cargo.amount")}
              error={errors.amount}
              control={
                <NumberField
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              }
            />
            <Field
              label={t("common.currency")}
              control={
                <Input
                  className="field-input"
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                />
              }
            />
          </div>
            <Field
              label={t("prices.date")}
              error={errors.effectiveDate}
            control={
              <DateField value={effectiveDate} onChange={setEffectiveDate} />
            }
          />
          <Field
            label={t("cargo.fixedAmount")}
            control={
              <Select value={method} onValueChange={v => setMethod(v as CargoCostMethod)}>
                <SelectTrigger className="field-input w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">{t("cargo.fixedAmount")}</SelectItem>
                  <SelectItem value="per-unit">{t("cargo.perUnit")}</SelectItem>
                  <SelectItem value="manual">{t("settings.manualValue")}</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <Field
            label={t("settings.optionalOrigin")}
            control={placeSelect(originId, setOriginId, t("settings.optionalOrigin"))}
          />
          <Field
            label={t("settings.optionalDestination")}
            control={placeSelect(destinationId, setDestinationId, t("settings.optionalDestination"))}
          />
        </div>
        <SheetFooter>
          <Button onClick={() => void save()}>
            {editing ? t("common.save") : t("settings.savePrice")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
