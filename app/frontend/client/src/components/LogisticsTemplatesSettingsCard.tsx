/**
 * بطاقة قوالب المسارات — دفتر الميناء.
 * تحفظ المواقع والأسعار والقوالب محلياً؛ اختيار القالب في الحاسبة لا يطبق أي مبلغ قبل المعاينة والتأكيد.
 */
import {
  db,
  type CargoCostMethod,
  type LogisticsLocationKind,
  type LogisticsRateKind,
} from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SectionCard from "@/components/SectionCard";
import SettingsFold from "@/components/SettingsFold";
import {
  Landmark,
  MapPin,
  Plus,
  Route,
  Trash2,
  Truck,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

const today = () => new Date().toISOString().slice(0, 10);
const optionValue = (value: string) => value || "__none__";
const fromOption = (value: string) => (value === "__none__" ? "" : value);

export default function LogisticsTemplatesSettingsCard() {
  const { t } = useLanguage();
  const [locations, setLocations] = useState<
    Awaited<ReturnType<typeof db.listLogisticsLocations>>
  >([]);
  const [rates, setRates] = useState<
    Awaited<ReturnType<typeof db.listLogisticsRates>>
  >([]);
  const [templates, setTemplates] = useState<
    Awaited<ReturnType<typeof db.listLogisticsRouteTemplates>>
  >([]);
  const [locationName, setLocationName] = useState("");
  const [locationKind, setLocationKind] =
    useState<LogisticsLocationKind>("other");
  const [locationCountry, setLocationCountry] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [rateName, setRateName] = useState("");
  const [rateKind, setRateKind] = useState<LogisticsRateKind>("freight");
  const [rateAmount, setRateAmount] = useState("");
  const [rateCurrency, setRateCurrency] = useState(t("currency.usd"));
  const [rateMethod, setRateMethod] = useState<CargoCostMethod>("fixed");
  const [rateOriginId, setRateOriginId] = useState("");
  const [rateDestinationId, setRateDestinationId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateOriginId, setTemplateOriginId] = useState("");
  const [templateUnloadingId, setTemplateUnloadingId] = useState("");
  const [templateDeliveryId, setTemplateDeliveryId] = useState("");
  const [templateIncoterm, setTemplateIncoterm] = useState("FOB");
  const [templateTransport, setTemplateTransport] = useState(t("common.sea"));
  const [templateFreightRateId, setTemplateFreightRateId] = useState("");
  const [templateClearanceRateId, setTemplateClearanceRateId] = useState("");
  const [templateTransportRateId, setTemplateTransportRateId] = useState("");

  const refresh = async () => {
    await db.init();
    const [nextLocations, nextRates, nextTemplates] = await Promise.all([
      db.listLogisticsLocations(),
      db.listLogisticsRates(),
      db.listLogisticsRouteTemplates(),
    ]);
    setLocations(nextLocations);
    setRates(nextRates);
    setTemplates(nextTemplates);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const freightRates = useMemo(
    () => rates.filter(row => row.kind === "freight" && row.active === 1),
    [rates]
  );
  const clearanceRates = useMemo(
    () =>
      rates
        .filter(
          row => row.kind === "clearance-fee" || row.kind === "clearance-office"
        )
        .filter(row => row.active === 1),
    [rates]
  );
  const transportRates = useMemo(
    () => rates.filter(row => row.kind === "transport" && row.active === 1),
    [rates]
  );

  const saveLocation = async () => {
    const name = locationName.trim();
    if (!name) return toast.error(t("settings.enterLocationNameFirst"));
    const timestamp = nowIso();
    await db.saveLogisticsLocation({
      id: newId("loc"),
      name,
      kind: locationKind,
      country: locationCountry.trim(),
      city: locationCity.trim(),
      entityId: null,
      active: 1,
      notes: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    setLocationName("");
    setLocationCountry("");
    setLocationCity("");
    await refresh();
    toast.success(t("settings.locationSaved"));
  };

  const saveRate = async () => {
    const name = rateName.trim();
    const amount = Number(rateAmount);
    if (!name || !Number.isFinite(amount) || amount < 0)
      return toast.error(t("settings.enterServicePriceValid"));
    const timestamp = nowIso();
    await db.saveLogisticsRate({
      id: newId("rate"),
      name,
      kind: rateKind,
      originLocationId: rateOriginId,
      destinationLocationId: rateDestinationId,
      incoterm: "",
      transportMode: "",
      clearanceOffice: "",
      shipmentDescriptor: "",
      currency: rateCurrency.trim() || "دولار",
      amount,
      method: rateMethod,
      referenceUnit: rateMethod === "per-unit" ? t("cargo.unitWord") : "",
      effectiveDate: today(),
      active: 1,
      notes: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    setRateName("");
    setRateAmount("");
    setRateOriginId("");
    setRateDestinationId("");
    await refresh();
    toast.success(t("settings.servicePriceSaved"));
  };

  const saveTemplate = async () => {
    const name = templateName.trim();
    if (!name) return toast.error(t("settings.enterRouteTemplateName"));
    const timestamp = nowIso();
    await db.saveLogisticsRouteTemplate({
      id: newId("route"),
      name,
      operationType: "import",
      originLocationId: templateOriginId,
      unloadingLocationId: templateUnloadingId,
      deliveryLocationId: templateDeliveryId,
      incoterm: templateIncoterm,
      transportMode: templateTransport,
      clearanceOffice: "",
      customsCategory: "",
      fixedRates: 0,
      freightRateId: templateFreightRateId,
      clearanceFeeRateId: templateClearanceRateId,
      clearanceOfficeRateId: "",
      transportRateId: templateTransportRateId,
      active: 1,
      notes: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    setTemplateName("");
    setTemplateOriginId("");
    setTemplateUnloadingId("");
    setTemplateDeliveryId("");
    setTemplateFreightRateId("");
    setTemplateClearanceRateId("");
    setTemplateTransportRateId("");
    await refresh();
    toast.success(t("settings.routeTemplateSaved"));
  };

  const locationLabel = (id: string) =>
    locations.find(row => row.id === id)?.name || "—";
  const rateLabel = (id: string) =>
    rates.find(row => row.id === id)?.name || "—";
  const deleteRow = async (
    kind: "location" | "rate" | "template",
    id: string
  ) => {
    if (!window.confirm(t("settings.deleteLogisticsRecordConfirm"))) return;
    if (kind === "location") await db.deleteLogisticsLocation(id);
    if (kind === "rate") await db.deleteLogisticsRate(id);
    if (kind === "template") await db.deleteLogisticsRouteTemplate(id);
    await refresh();
  };

  return (
    <SectionCard
      title={t("settings.logisticsTemplates")}
      hint={t("settings.logisticsTemplatesHint")}
      stamp={t("settings.routeLibrary")}
    >
      <div className="space-y-3">
        <SettingsFold
          level="detail"
          title={t("settings.openLocations")}
          hint={t("settings.locationsAddHint")}
          stamp={`${locations.length} ${t("settings.locationWord")}`}
          defaultOpen
        >
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              className="field-input sm:col-span-2"
              value={locationName}
              onChange={event => setLocationName(event.target.value)}
              placeholder={t("settings.locationName")}
            />
            <select
              className="field-input"
              value={locationKind}
              onChange={event =>
                setLocationKind(event.target.value as LogisticsLocationKind)
              }
            >
              <option value="origin">{t("settings.originExport")}</option>
              <option value="unloading">{t("settings.discharge")}</option>
              <option value="delivery">{t("settings.delivery")}</option>
              <option value="other">{t("settings.otherLocation")}</option>
            </select>
            <Button type="button" onClick={() => void saveLocation()}>
              <Plus className="h-4 w-4" />
              {t("settings.saveLocation")}
            </Button>
            <Input
              className="field-input"
              value={locationCountry}
              onChange={event => setLocationCountry(event.target.value)}
              placeholder={t("settings.countryOptional")}
            />
            <Input
              className="field-input"
              value={locationCity}
              onChange={event => setLocationCity(event.target.value)}
              placeholder={t("settings.cityOptional")}
            />
          </div>
          {locations.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {locations.map(row => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2.5 py-2 text-xs"
                >
                  <span className="min-w-0 truncate">
                    <MapPin className="me-1 inline h-3.5 w-3.5 text-[var(--ink)]/65" />
                    {row.name}
                    {row.city ? ` · ${row.city}` : ""}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => void deleteRow("location", row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </SettingsFold>

        <SettingsFold
          level="detail"
          title={t("settings.servicePrices")}
          hint={t("settings.ratesAddHint")}
          stamp={`${rates.length} ${t("cargo.priceWord")}`}
        >
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              className="field-input sm:col-span-2"
              value={rateName}
              onChange={event => setRateName(event.target.value)}
              placeholder={t("settings.servicePriceName")}
            />
            <select
              className="field-input"
              value={rateKind}
              onChange={event =>
                setRateKind(event.target.value as LogisticsRateKind)
              }
            >
              <option value="freight">
                {t("settings.internationalShipping")}
              </option>
              <option value="clearance-fee">
                {t("settings.clearanceFee")}
              </option>
              <option value="clearance-office">
                {t("settings.clearanceOfficeFee")}
              </option>
              <option value="transport">{t("settings.inlandTransfer")}</option>
              <option value="handling">{t("settings.loadingUnloading")}</option>
              <option value="other">{t("settings.otherExpense")}</option>
            </select>
            <Input
              className="field-input"
              dir="ltr"
              inputMode="decimal"
              value={rateAmount}
              onChange={event => setRateAmount(event.target.value)}
              placeholder={t("cargo.amount")}
            />
            <Input
              className="field-input"
              value={rateCurrency}
              onChange={event => setRateCurrency(event.target.value)}
              placeholder={t("common.currency")}
            />
            <select
              className="field-input"
              value={rateMethod}
              onChange={event =>
                setRateMethod(event.target.value as CargoCostMethod)
              }
            >
              <option value="fixed">{t("cargo.fixedAmount")}</option>
              <option value="per-unit">{t("cargo.perUnit")}</option>
              <option value="manual">{t("settings.manualValue")}</option>
            </select>
            <select
              className="field-input"
              value={optionValue(rateOriginId)}
              onChange={event =>
                setRateOriginId(fromOption(event.target.value))
              }
            >
              <option value="__none__">{t("settings.optionalOrigin")}</option>
              {locations.map(row => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              className="field-input"
              value={optionValue(rateDestinationId)}
              onChange={event =>
                setRateDestinationId(fromOption(event.target.value))
              }
            >
              <option value="__none__">
                {t("settings.optionalDestination")}
              </option>
              {locations.map(row => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <Button type="button" onClick={() => void saveRate()}>
              <WalletCards className="h-4 w-4" />
              {t("settings.savePrice")}
            </Button>
          </div>
          {rates.length ? (
            <div className="mt-3 space-y-1.5">
              {rates.map(row => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2.5 py-2 text-xs"
                >
                  <span className="min-w-0 truncate">
                    <Truck className="me-1 inline h-3.5 w-3.5 text-[var(--ink)]/65" />
                    {row.name} · {row.amount.toLocaleString("en-US")}{" "}
                    {row.currency} · {row.effectiveDate || "—"}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => void deleteRow("rate", row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </SettingsFold>

        <SettingsFold
          level="detail"
          title={t("settings.routeTemplates")}
          hint={t("settings.routeTemplatesSaveHint")}
          stamp={`${templates.length} ${t("settings.templateCountWord")}`}
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              className="field-input sm:col-span-2"
              value={templateName}
              onChange={event => setTemplateName(event.target.value)}
              placeholder={t("settings.routeTemplateNameExample")}
            />
            <select
              className="field-input"
              value={templateIncoterm}
              onChange={event => setTemplateIncoterm(event.target.value)}
            >
              <option value="EXW">EXW</option>
              <option value="FOB">FOB</option>
              <option value="CFR">CFR</option>
              <option value="CIF">CIF</option>
              <option value="other">{t("settings.otherCondition")}</option>
            </select>
            <select
              className="field-input"
              value={optionValue(templateOriginId)}
              onChange={event =>
                setTemplateOriginId(fromOption(event.target.value))
              }
            >
              <option value="__none__">{t("cargo.originLocation")}</option>
              {locations.map(row => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              className="field-input"
              value={optionValue(templateUnloadingId)}
              onChange={event =>
                setTemplateUnloadingId(fromOption(event.target.value))
              }
            >
              <option value="__none__">{t("cargo.dischargePort")}</option>
              {locations.map(row => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              className="field-input"
              value={optionValue(templateDeliveryId)}
              onChange={event =>
                setTemplateDeliveryId(fromOption(event.target.value))
              }
            >
              <option value="__none__">{t("settings.deliverySite")}</option>
              {locations.map(row => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              className="field-input"
              value={templateTransport}
              onChange={event => setTemplateTransport(event.target.value)}
            >
              <option value="بحري">{t("common.sea")}</option>
              <option value="بري">{t("common.land")}</option>
              <option value="جوي">{t("common.air")}</option>
              <option value="محلي">{t("multiCalc.local")}</option>
            </select>
            <select
              className="field-input"
              value={optionValue(templateFreightRateId)}
              onChange={event =>
                setTemplateFreightRateId(fromOption(event.target.value))
              }
            >
              <option value="__none__">
                {t("settings.referenceShippingPrice")}
              </option>
              {freightRates.map(row => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              className="field-input"
              value={optionValue(templateClearanceRateId)}
              onChange={event =>
                setTemplateClearanceRateId(fromOption(event.target.value))
              }
            >
              <option value="__none__">
                {t("settings.referenceClearancePrice")}
              </option>
              {clearanceRates.map(row => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              className="field-input"
              value={optionValue(templateTransportRateId)}
              onChange={event =>
                setTemplateTransportRateId(fromOption(event.target.value))
              }
            >
              <option value="__none__">
                {t("settings.referenceTransportPrice")}
              </option>
              {transportRates.map(row => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              className="sm:col-span-3"
              onClick={() => void saveTemplate()}
            >
              <Route className="h-4 w-4" />
              {t("settings.saveRouteTemplate")}
            </Button>
          </div>
          {templates.length ? (
            <div className="mt-3 space-y-1.5">
              {templates.map(row => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2.5 py-2 text-xs"
                >
                  <span className="min-w-0 truncate">
                    <Landmark className="me-1 inline h-3.5 w-3.5 text-[var(--ink)]/65" />
                    {row.name} · {locationLabel(row.originLocationId)} ←{" "}
                    {locationLabel(row.unloadingLocationId)} ←{" "}
                    {locationLabel(row.deliveryLocationId)}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => void deleteRow("template", row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </SettingsFold>
      </div>
    </SectionCard>
  );
}
