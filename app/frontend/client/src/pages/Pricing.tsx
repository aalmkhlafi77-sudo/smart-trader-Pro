import AppLayout from "@/components/AppLayout";
import { StepWizard } from "@/components/patterns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { PriceLevel } from "@/lib/db";
import { CargoStep } from "./cargo/steps/CargoStep";
import { RouteStep } from "./cargo/steps/RouteStep";
import { ExpensesStep } from "./cargo/steps/ExpensesStep";
import { ReviewStep } from "./cargo/steps/ReviewStep";
import { ResultsStep } from "./cargo/steps/ResultsStep";
import { SummaryPanel } from "./cargo/SummaryPanel";
import { FileHeader } from "./cargo/FileHeader";
import { WizardNav } from "./cargo/WizardNav";
import { useCargoData } from "./cargo/useCargoData";
import { useCargoDraft } from "./cargo/useCargoDraft";
import {
  fetchCargoDraft,
  persistRun,
  persistSalePrices,
} from "./cargo/cargoPersistence";
import { firstEmptyLevel, convertToItemCurrency } from "./cargo/shared";

const STEPS = [
  { id: "load", labelKey: "cargo.stepTitleLoad" },
  { id: "route", labelKey: "cargo.stepTitleRoute" },
  { id: "expenses", labelKey: "cargo.stepTitleExpenses" },
  { id: "review", labelKey: "cargo.stepTitleReview" },
  { id: "results", labelKey: "cargo.stepTitleResults" },
];

export default function Pricing() {
  const { t } = useLanguage();
  const data = useCargoData();
  const { items, priceRows, locations, rates, templates, localCurrency, foreignCurrency, reload } = data;
  const file = useCargoDraft({
    items,
    settings: data.settings,
    priceRows,
    rates,
    templates,
    localCurrency,
    t,
  });
  const { draft } = file;

  const [step, setStep] = useState(0);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [showPriceSave, setShowPriceSave] = useState(false);
  const [priceSaveSelection, setPriceSaveSelection] = useState<Record<string, boolean>>({});
  const [priceSaveLevels, setPriceSaveLevels] = useState<Record<string, PriceLevel>>({});

  useEffect(() => {
    const runId = new URLSearchParams(window.location.search).get("runId");
    if (!runId) return;
    (async () => {
      const loaded = await fetchCargoDraft(runId);
      if (!loaded) return;
      file.setDraft(loaded);
      setStep(0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matchingItems = useMemo(
    () =>
      items.filter(item =>
        [item.name, item.code, item.category]
          .join(" ")
          .toLowerCase()
          .includes(draft.itemSearch.trim().toLowerCase())
      ),
    [items, draft.itemSearch]
  );

  const maxStep = file.resultsUnlocked ? STEPS.length - 1 : STEPS.length - 2;
  const goStep = (id: string) => {
    const index = STEPS.findIndex(s => s.id === id);
    if (index >= 0 && index <= maxStep) setStep(index);
  };
  const nextBlocked = step >= maxStep;

  const doSave = async (status: "draft" | "approved") => {
    if (status === "approved") {
      if (draft.items.length === 0)
        return toast.error(t("cargo.addAtLeastOneItem"));
      if (!file.canApprove)
        return toast.error(t("cargo.completeItemBeforeApproval"));
    }
    const runId = await persistRun({
      draft,
      items: file.cargoItems,
      lines: file.cargoLines,
      status,
      localCurrency,
      t,
    });
    if (!runId) return;
    file.updateDraft({ runId, status });
    if (status === "approved") {
      setPriceSaveSelection(
        Object.fromEntries(file.cargoItems.map(item => [item.itemId, false]))
      );
      setPriceSaveLevels(
        Object.fromEntries(
          file.cargoItems.map(item => [
            item.itemId,
            firstEmptyLevel(priceRows[item.itemId], item.priceLevel),
          ])
        )
      );
      setShowPriceSave(true);
    }
  };

  // صفوف الحفظ: المقترح SAR للعرض + المحوَّل لعملة الصنف للتخزين (مصدر واحد).
  const saveRows = file.cargoItems.map(item => {
    const currency = file.itemById[item.itemId]?.currency || localCurrency;
    const rate = Number(item.exchangeRate);
    const suggested =
      file.result.items.find(r => r.itemId === item.itemId)?.suggestedPrice ?? 0;
    return {
      itemId: item.itemId,
      name: file.itemById[item.itemId]?.name ?? "",
      suggested,
      converted: convertToItemCurrency(suggested, rate),
      currency,
    };
  });

  const doSaveSalePrices = async () => {
    const ok = await persistSalePrices({
      items: file.cargoItems,
      saveRows,
      selection: priceSaveSelection,
      levels: priceSaveLevels,
      priceRows,
      fileName: draft.name || draft.runId,
      localCurrency,
      t,
    });
    if (!ok) return;
    setShowPriceSave(false);
    await reload();
  };

  const doNewWork = () => {
    file.newWork();
    setStep(0);
    toast.info(t("cargo.newCargoFileStarted"));
  };

  return (
    <AppLayout
      title={t("cargo.cargoCostFile")}
      subtitle={t("cargo.cargoFileSubtitle")}
    >
      <div className="space-y-4 pb-8">
        <FileHeader
          draft={draft}
          localCurrency={localCurrency}
          onUpdateDraft={file.updateDraft}
          onNewWork={doNewWork}
        />

        <StepWizard
          steps={STEPS.map(s => ({ id: s.id, label: t(s.labelKey) }))}
          currentId={STEPS[step].id}
          onStepSelect={goStep}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="space-y-4">
            {step === 0 ? (
              <CargoStep
                draft={draft}
                matchingItems={matchingItems}
                itemById={file.itemById}
                priceRows={priceRows}
                localCurrency={localCurrency}
                onUpdateDraft={file.updateDraft}
                onUpdateItem={file.updateItem}
                onAddItem={file.addSelectedItem}
                onSelectLevel={file.selectPriceLevel}
                onRemoveItem={file.removeItem}
              />
            ) : null}
            {step === 1 ? (
              <RouteStep
                draft={draft}
                templates={templates}
                locations={locations}
                rates={rates}
                selectedTemplate={file.selectedTemplate}
                showPreview={showTemplatePreview}
                onUpdateDraft={file.updateDraft}
                onShowPreview={setShowTemplatePreview}
                onApplyTemplate={() => {
                  file.applyTemplate();
                  setShowTemplatePreview(false);
                }}
              />
            ) : null}
            {step === 2 ? (
              <ExpensesStep
                draft={draft}
                localCurrency={localCurrency}
                foreignCurrency={foreignCurrency}
                defaultExchangeRate={data.settings?.defaultExchangeRate ?? 1}
                itemNames={draft.items.map(item => ({
                  id: item.id,
                  itemId: item.itemId,
                  name: file.itemById[item.itemId]?.name ?? "",
                }))}
                onUpdateDraft={file.updateDraft}
                onUpdateCost={file.updateCost}
                onToggleCost={file.toggleCost}
              />
            ) : null}
            {step === 3 ? (
              <ReviewStep
                draft={draft}
                checks={file.checks}
                itemCount={draft.items.length}
                missingItemCount={file.missingItems.length}
                missingCostCount={file.missingCosts.length}
                isCif={file.isCif}
                onUpdateDraft={file.updateDraft}
              />
            ) : null}
            {step === 4 ? (
              <ResultsStep
                result={file.result}
                itemById={file.itemById}
                localCurrency={localCurrency}
              />
            ) : null}

            <WizardNav
              step={step}
              lastStep={STEPS.length - 1}
              nextBlocked={nextBlocked}
              canApprove={file.canApprove}
              hasItems={draft.items.length > 0}
              onPrev={() => setStep(current => Math.max(0, current - 1))}
              onNext={() => setStep(current => Math.min(maxStep, current + 1))}
              onSaveDraft={() => void doSave("draft")}
              onApprove={() => void doSave("approved")}
            />
          </div>

          <SummaryPanel
            result={file.result}
            localCurrency={localCurrency}
            marginRate={draft.marginRate}
            onMarginChange={v => file.updateDraft({ marginRate: v })}
            canSavePrices={Boolean(draft.runId) && draft.status === "approved"}
            showPriceSave={showPriceSave}
            onTogglePriceSave={() => setShowPriceSave(v => !v)}
            saveRows={saveRows}
            priceSaveSelection={priceSaveSelection}
            priceSaveLevels={priceSaveLevels}
            onToggleSelect={(itemId, v) =>
              setPriceSaveSelection(current => ({ ...current, [itemId]: v }))
            }
            onLevelChange={(itemId, level) =>
              setPriceSaveLevels(current => ({ ...current, [itemId]: level }))
            }
            onSaveSelected={() => void doSaveSalePrices()}
          />
        </div>
      </div>
    </AppLayout>
  );
}
