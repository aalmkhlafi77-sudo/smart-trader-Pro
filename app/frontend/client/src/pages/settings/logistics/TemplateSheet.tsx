import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/patterns";
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
import { routeTemplateSchema } from "@/lib/validation/schemas";
import {
  db,
  type LogisticsLocationRow,
  type LogisticsRateRow,
  type LogisticsRouteTemplateRow,
} from "@/lib/db";
import { newId, nowIso } from "@/lib/id";

const INCOTERMS = ["EXW", "FOB", "CFR", "CIF", "other"];

/** أوضاع النقل المخزَّنة (نصوص عربية) — الترحيل إلى رموز ISO مؤجَّل إلى S5. محمية عبر ALLOW_DEC. */
const TRANSPORT_MODES = [
  { value: "بحري", labelKey: "common.sea" },
  { value: "بري", labelKey: "common.land" },
  { value: "جوي", labelKey: "common.air" },
  { value: "محلي", labelKey: "multiCalc.local" },
];

export function TemplateSheet({
  open,
  onClose,
  editing,
  locations,
  rates,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: LogisticsRouteTemplateRow | null;
  locations: LogisticsLocationRow[];
  rates: LogisticsRateRow[];
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [incoterm, setIncoterm] = useState("FOB");
  const [transport, setTransport] = useState(TRANSPORT_MODES[0].value);
  const [originId, setOriginId] = useState("");
  const [unloadingId, setUnloadingId] = useState("");
  const [deliveryId, setDeliveryId] = useState("");
  const [freightRateId, setFreightRateId] = useState("");
  const [clearanceRateId, setClearanceRateId] = useState("");
  const [transportRateId, setTransportRateId] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setIncoterm(editing?.incoterm || "FOB");
    setTransport(editing?.transportMode || TRANSPORT_MODES[0].value);
    setOriginId(editing?.originLocationId ?? "");
    setUnloadingId(editing?.unloadingLocationId ?? "");
    setDeliveryId(editing?.deliveryLocationId ?? "");
    setFreightRateId(editing?.freightRateId ?? "");
    setClearanceRateId(editing?.clearanceFeeRateId ?? "");
    setTransportRateId(editing?.transportRateId ?? "");
    setNameError(undefined);
  }, [open, editing]);

  const freightRates = useMemo(
    () => rates.filter(r => r.kind === "freight" && r.active === 1),
    [rates]
  );
  const clearanceRates = useMemo(
    () =>
      rates
        .filter(r => r.kind === "clearance-fee" || r.kind === "clearance-office")
        .filter(r => r.active === 1),
    [rates]
  );
  const transportRates = useMemo(
    () => rates.filter(r => r.kind === "transport" && r.active === 1),
    [rates]
  );

  const save = async () => {
    const parsed = routeTemplateSchema(t).safeParse({ name });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message);
      return;
    }
    setNameError(undefined);
    const timestamp = nowIso();
    await db.saveLogisticsRouteTemplate({
      id: editing?.id ?? newId("route"),
      name: name.trim(),
      operationType: editing?.operationType ?? "import",
      originLocationId: originId,
      unloadingLocationId: unloadingId,
      deliveryLocationId: deliveryId,
      incoterm,
      transportMode: transport,
      clearanceOffice: editing?.clearanceOffice ?? "",
      customsCategory: editing?.customsCategory ?? "",
      fixedRates: editing?.fixedRates ?? 0,
      freightRateId,
      clearanceFeeRateId: clearanceRateId,
      clearanceOfficeRateId: editing?.clearanceOfficeRateId ?? "",
      transportRateId,
      active: editing?.active ?? 1,
      notes: editing?.notes ?? "",
      createdAt: editing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    onClose();
    onSaved();
    toast.success(t("settings.routeTemplateSaved"));
  };

  const placeSelect = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    options: { id: string; name: string }[]
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
        {options.map(o => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
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
            {editing ? t("settings.editRouteTemplate") : t("settings.saveRouteTemplate")}
          </SheetTitle>
          <SheetDescription>{t("settings.routeTemplatesSaveHint")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4">
            <Field
              label={t("settings.routeTemplates")}
              required
              error={nameError}
            control={
              <Input
                className="field-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t("settings.routeTemplateNameExample")}
              />
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t("settings.otherCondition")}
              control={
                <Select value={incoterm} onValueChange={setIncoterm}>
                  <SelectTrigger className="field-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOTERMS.map(code => (
                      <SelectItem key={code} value={code}>
                        {code === "other" ? t("settings.otherCondition") : code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <Field
              label={t("cargo.transportType")}
              control={
                <Select value={transport} onValueChange={setTransport}>
                  <SelectTrigger className="field-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSPORT_MODES.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        {t(m.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          </div>
          <Field
            label={t("cargo.originLocation")}
            control={placeSelect(originId, setOriginId, t("cargo.originLocation"), locations)}
          />
          <Field
            label={t("cargo.dischargePort")}
            control={placeSelect(unloadingId, setUnloadingId, t("cargo.dischargePort"), locations)}
          />
          <Field
            label={t("settings.deliverySite")}
            control={placeSelect(deliveryId, setDeliveryId, t("settings.deliverySite"), locations)}
          />
          <Field
            label={t("settings.referenceShippingPrice")}
            control={placeSelect(freightRateId, setFreightRateId, t("settings.referenceShippingPrice"), freightRates)}
          />
          <Field
            label={t("settings.referenceClearancePrice")}
            control={placeSelect(clearanceRateId, setClearanceRateId, t("settings.referenceClearancePrice"), clearanceRates)}
          />
          <Field
            label={t("settings.referenceTransportPrice")}
            control={placeSelect(transportRateId, setTransportRateId, t("settings.referenceTransportPrice"), transportRates)}
          />
        </div>
        <SheetFooter>
          <Button onClick={() => void save()}>
            {editing ? t("common.save") : t("settings.saveRouteTemplate")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
