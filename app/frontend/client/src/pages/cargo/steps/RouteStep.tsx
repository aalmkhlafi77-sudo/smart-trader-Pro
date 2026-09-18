import { Check, ClipboardCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Field, FormGrid, SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import type {
  LogisticsLocationRow,
  LogisticsRateRow,
  LogisticsRouteTemplateRow,
} from "@/lib/db";
import type { CargoDraft } from "../shared";
import { fromOption, optionValue } from "../shared";

/** أوضاع النقل المخزَّنة (نصوص عربية) — الترحيل إلى رموز ISO مؤجَّل إلى S5. محمية عبر ALLOW_DEC. */
const TRANSPORT_MODES = [
  { value: "بحري", labelKey: "common.sea" },
  { value: "بري", labelKey: "common.land" },
  { value: "جوي", labelKey: "common.air" },
  { value: "محلي", labelKey: "multiCalc.local" },
];

export function RouteStep({
  draft,
  templates,
  locations,
  rates,
  selectedTemplate,
  showPreview,
  onUpdateDraft,
  onShowPreview,
  onApplyTemplate,
}: {
  draft: CargoDraft;
  templates: LogisticsRouteTemplateRow[];
  locations: LogisticsLocationRow[];
  rates: LogisticsRateRow[];
  selectedTemplate: LogisticsRouteTemplateRow | null;
  showPreview: boolean;
  onUpdateDraft: (patch: Partial<CargoDraft>) => void;
  onShowPreview: (v: boolean) => void;
  onApplyTemplate: () => void;
}) {
  const { t } = useLanguage();

  const locationName = (id: string) =>
    locations.find(row => row.id === id)?.name || "—";
  const templateRateName = (id: string) =>
    rates.find(row => row.id === id)?.name || t("common.none");
  const templateRateAmount = (id: string) => {
    const row = rates.find(r => r.id === id);
    return row ? `${row.amount.toLocaleString("en-US")} ${row.currency}` : null;
  };

  return (
    <SectionCard
      title={t("cargo.stepRouteTemplate")}
      description={t("cargo.stepRouteHint")}
      stamp={t("cargo.stepStampRoute")}
    >
      <FormGrid cols={2}>
        <Field
          label={t("cargo.routeTemplate")}
          control={
            <select
              className="field-input"
              value={optionValue(draft.routeTemplateId)}
              onChange={event => {
                onUpdateDraft({ routeTemplateId: fromOption(event.target.value) });
                onShowPreview(false);
              }}
            >
              <option value="__none__">{t("cargo.startWithoutTemplate")}</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          }
        />
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 bg-card"
            disabled={!selectedTemplate}
            onClick={() => onShowPreview(true)}
          >
            <ClipboardCheck className="h-4 w-4" />
            {t("cargo.previewTemplate")}
          </Button>
          <Button
            type="button"
            className="min-h-11 flex-1"
            disabled={!selectedTemplate}
            onClick={onApplyTemplate}
          >
            <Check className="h-4 w-4" />
            {t("cargo.applyTemplate")}
          </Button>
        </div>
        <Field
          label={t("cargo.originLocation")}
          control={
            <select
              className="field-input"
              value={optionValue(draft.originLocationId)}
              onChange={event =>
                onUpdateDraft({ originLocationId: fromOption(event.target.value) })
              }
            >
              <option value="__none__">{t("cargo.selectLocationIfNeeded")}</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          }
        />
        <Field
          label={t("cargo.dischargePort")}
          control={
            <select
              className="field-input"
              value={optionValue(draft.unloadingLocationId)}
              onChange={event =>
                onUpdateDraft({ unloadingLocationId: fromOption(event.target.value) })
              }
            >
              <option value="__none__">{t("cargo.selectLocationIfNeeded")}</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          }
        />
        <Field
          label={t("cargo.deliveryLocation")}
          control={
            <select
              className="field-input"
              value={optionValue(draft.deliveryLocationId)}
              onChange={event =>
                onUpdateDraft({ deliveryLocationId: fromOption(event.target.value) })
              }
            >
              <option value="__none__">{t("cargo.selectLocationIfNeeded")}</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <Field
            label={t("cargo.supplyCondition")}
            control={
              <select
                className="field-input"
                disabled={draft.operationType === "local"}
                value={draft.incoterm}
                onChange={event => onUpdateDraft({ incoterm: event.target.value })}
              >
                <option value="EXW">EXW</option>
                <option value="FOB">FOB</option>
                <option value="CFR">CFR</option>
                <option value="CIF">CIF</option>
                <option value="other">{t("common.other")}</option>
              </select>
            }
          />
          <Field
            label={t("cargo.transportType")}
            control={
              <select
                className="field-input"
                value={draft.transportMode}
                onChange={event => onUpdateDraft({ transportMode: event.target.value })}
              >
                {TRANSPORT_MODES.map(m => (
                  <option key={m.value} value={m.value}>
                    {t(m.labelKey)}
                  </option>
                ))}
              </select>
            }
          />
        </div>
      </FormGrid>
      {showPreview && selectedTemplate ? (
        <div className="mt-4 rounded border border-[var(--port-green)]/25 bg-[var(--port-green-soft)] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">
                {t("common.preview")}: {selectedTemplate.name}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {locationName(selectedTemplate.originLocationId)} ←{" "}
                {locationName(selectedTemplate.unloadingLocationId)} ←{" "}
                {locationName(selectedTemplate.deliveryLocationId)} ·{" "}
                {selectedTemplate.incoterm} · {selectedTemplate.transportMode}
              </p>
            </div>
            <Button type="button" size="sm" onClick={onApplyTemplate}>
              {t("cargo.applyAfterReview")}
            </Button>
          </div>
          <ul className="mt-3 grid gap-1 text-[11px] text-[var(--ink)]">
            <li>
              {t("common.freight")}:{" "}
              {selectedTemplate.incoterm === "CIF"
                ? t("cargo.includedInSupplyCondition")
                : `${templateRateName(selectedTemplate.freightRateId)}${templateRateAmount(selectedTemplate.freightRateId) ? ` · ${templateRateAmount(selectedTemplate.freightRateId)}` : ""}`}
            </li>
            <li>
              {t("cargo.clearanceFees")}:{" "}
              {templateRateName(selectedTemplate.clearanceFeeRateId)}
              {templateRateAmount(selectedTemplate.clearanceFeeRateId)
                ? ` · ${templateRateAmount(selectedTemplate.clearanceFeeRateId)}`
                : ""}
            </li>
            <li>
              {t("cargo.inlandTransport")}:{" "}
              {templateRateName(selectedTemplate.transportRateId)}
              {templateRateAmount(selectedTemplate.transportRateId)
                ? ` · ${templateRateAmount(selectedTemplate.transportRateId)}`
                : ""}
            </li>
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
}

