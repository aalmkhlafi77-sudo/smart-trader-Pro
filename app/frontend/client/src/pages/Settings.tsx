/**
 * شاشة الإعدادات — اتجاه التصميم: "دفتر الميناء"
 * الحقول الكهرمانية يدخلها المستخدم، والقيم المحفوظة تُستخدم كقيم افتراضية في الحاسبة.
 * التخزين محلي بالكامل ضمن جدول settings المتوافق مع SQLite.
 */

import AppLayout from "@/components/AppLayout";
import AccessSettingsCard from "@/components/AccessSettingsCard";
import FloatingCalculatorSettingsCard from "@/components/FloatingCalculatorSettingsCard";
import LoginBackgroundSettingsCard from "@/components/LoginBackgroundSettingsCard";
import LogisticsTemplatesSettingsCard from "@/components/LogisticsTemplatesSettingsCard";
import SettingsFold from "@/components/SettingsFold";
import WorkspaceCustomizationCard from "@/components/WorkspaceCustomizationCard";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionCard from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  db,
  type CategoryRow,
  type SettingsRow,
  type SpecTemplateRow,
} from "@/lib/db";
import { newId, nowIso } from "@/lib/id";
import { formatMoney, parseNumber } from "@/lib/pricing";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FileSpreadsheet,
  Info,
  LayoutList,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Star,
  Tags,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const BASE_LOCAL = ["ريال", "درهم", "دينار", "جنيه"];
const BASE_FOREIGN = ["دولار", "يورو", "يوان", "روبية"];
const emptyTemplateDraft = {
  category: "",
  label: "",
  defaultUnit: "",
  unitOptions: "",
  placeholder: "",
  isKeyDefault: true,
  showInItem: true,
  showInPrices: true,
  showInReports: true,
  showInExport: true,
};

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const [deviceLanguage, setDeviceLanguage] = useState(language);
  const [row, setRow] = useState<SettingsRow | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [mainActivity, setMainActivity] = useState("import-export");
  const [customActivity, setCustomActivity] = useState("");
  const [localCurrency, setLocalCurrency] = useState(t("currency.sar"));
  const [foreignCurrency, setForeignCurrency] = useState(t("currency.usd"));
  const [localOptions, setLocalOptions] = useState<string[]>(BASE_LOCAL);
  const [foreignOptions, setForeignOptions] = useState<string[]>(BASE_FOREIGN);
  const [addingLocal, setAddingLocal] = useState(false);
  const [addingForeign, setAddingForeign] = useState(false);
  const [newLocal, setNewLocal] = useState("");
  const [newForeign, setNewForeign] = useState("");
  const [rate, setRate] = useState("3.75");
  const [customs, setCustoms] = useState("12");
  const [margin, setMargin] = useState("20");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [templates, setTemplates] = useState<SpecTemplateRow[]>([]);
  const [templateDraft, setTemplateDraft] = useState(emptyTemplateDraft);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [copySourceCategory, setCopySourceCategory] = useState("__all__");
  const [copyTargetCategory, setCopyTargetCategory] = useState("");

  const apply = (s: SettingsRow) => {
    setRow(s);
    setCompanyName(s.companyName);
    setMainActivity(s.mainActivity ?? "import-export");
    setCustomActivity(s.customActivity ?? "");
    setLocalCurrency(s.localCurrency);
    setForeignCurrency(s.foreignCurrency);
    setLocalOptions(prev => Array.from(new Set([...prev, s.localCurrency])));
    setForeignOptions(prev =>
      Array.from(new Set([...prev, s.foreignCurrency]))
    );
    setRate(String(s.defaultExchangeRate));
    setCustoms(String(Math.round(s.defaultCustomsRate * 100)));
    setMargin(String(Math.round(s.defaultMarginRate * 100)));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.init();
      const s = await db.getSettings();
      const [cats, templateList] = await Promise.all([
        db.listCategories(),
        db.listSpecTemplates(),
      ]);
      if (cancelled) return;
      apply(s);
      setCategories(cats);
      setTemplates(templateList);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDeviceLanguage(language);
  }, [language]);

  const saveDeviceLanguage = () => {
    setLanguage(deviceLanguage);
    toast.success(t("settings.defaultLanguageSaved"));
  };

  const save = async () => {
    if (!row) return;
    const rateVal = parseNumber(rate);
    if (rateVal <= 0) {
      toast.error(t("common.exchangeratemustbegreate"));
      return;
    }
    const next: SettingsRow = {
      ...row,
      companyName: companyName.trim(),
      mainActivity,
      customActivity: customActivity.trim(),
      localCurrency: localCurrency.trim() || "ريال",
      foreignCurrency: foreignCurrency.trim() || "دولار",
      defaultExchangeRate: rateVal,
      defaultCustomsRate: parseNumber(customs) / 100,
      defaultMarginRate: parseNumber(margin) / 100,
      updatedAt: nowIso(),
    };
    await db.saveSettings(next);
    setRow(next);
    window.dispatchEvent(new Event("smart-trader:activity-updated"));
    toast.success(t("common.settingssavedonyourdevic"));
  };

  const restore = () => {
    setLocalCurrency(t("currency.sar"));
    setForeignCurrency(t("currency.usd"));
    setRate("3.75");
    setCustoms("12");
    setMargin("20");
    toast.info(t("common.initialvaluesrestoredsav"));
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) {
      toast.error(t("common.entercategoryname"));
      return;
    }
    if (categories.some(c => c.name === name)) {
      toast.error(t("common.thiscategoryalreadyexist"));
      return;
    }
    const now = nowIso();
    const row: CategoryRow = {
      id: newId("cat"),
      name,
      notes: "",
      sortOrder: categories.length,
      createdAt: now,
      updatedAt: now,
    };
    await db.saveCategory(row);
    setCategories(await db.listCategories());
    setNewCategory("");
    toast.success(t("common.categoryadded"));
  };

  const removeCategory = async (id: string) => {
    await db.deleteCategory(id);
    setCategories(await db.listCategories());
    toast.success(t("common.categorydeleted"));
  };

  const resetTemplateDraft = () => {
    setTemplateDraft(emptyTemplateDraft);
    setEditingTemplateId(null);
  };

  const saveTemplate = async () => {
    const label = templateDraft.label.trim();
    if (!label) {
      toast.error(t("common.entertechnicalspecificat"));
      return;
    }
    const duplicate = templates.some(
      template =>
        template.label === label &&
        template.category === templateDraft.category &&
        template.id !== editingTemplateId
    );
    if (duplicate) {
      toast.error(t("common.thisspecificationalready"));
      return;
    }
    const existing = editingTemplateId
      ? (templates.find(template => template.id === editingTemplateId) ?? null)
      : null;
    const timestamp = nowIso();
    const units = templateDraft.unitOptions
      .split(/[|,،]/)
      .map(unit => unit.trim())
      .filter(Boolean);
    const defaultUnit = templateDraft.defaultUnit.trim() || units[0] || "";
    await db.saveSpecTemplate({
      id: existing?.id ?? newId("tpl"),
      category: templateDraft.category,
      label,
      defaultUnit,
      unitOptions: Array.from(new Set(units)).join("|"),
      placeholder: templateDraft.placeholder.trim(),
      sortOrder: existing?.sortOrder ?? (templates.length + 1) * 10,
      isKeyDefault: templateDraft.isKeyDefault ? 1 : 0,
      showInItem: templateDraft.showInItem ? 1 : 0,
      showInPrices: templateDraft.showInPrices ? 1 : 0,
      showInReports: templateDraft.showInReports ? 1 : 0,
      showInExport: templateDraft.showInExport ? 1 : 0,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    setTemplates(await db.listSpecTemplates());
    resetTemplateDraft();
    toast.success(
      existing
        ? t("settings.specTemplateUpdated")
        : t("settings.specTemplateAdded")
    );
  };

  const editTemplate = (template: SpecTemplateRow) => {
    setEditingTemplateId(template.id);
    setTemplateDraft({
      category: template.category,
      label: template.label,
      defaultUnit: template.defaultUnit,
      unitOptions: template.unitOptions,
      placeholder: template.placeholder,
      isKeyDefault: template.isKeyDefault === 1,
      showInItem: template.showInItem === 1,
      showInPrices: template.showInPrices === 1,
      showInReports: template.showInReports === 1,
      showInExport: template.showInExport === 1,
    });
  };

  const removeTemplate = async (template: SpecTemplateRow) => {
    if (
      !window.confirm(
        `${t("settings.deleteTemplate")} «${template.label}»${t("settings.deleteTemplateNote")}.`
      )
    )
      return;
    await db.deleteSpecTemplate(template.id);
    setTemplates(await db.listSpecTemplates());
    if (editingTemplateId === template.id) resetTemplateDraft();
    toast.success(t("common.templatedeletedfromsetti"));
  };

  const moveTemplate = async (id: string, direction: -1 | 1) => {
    const current = templates.find(template => template.id === id);
    if (!current) return;
    const ordered = templates.filter(
      template => template.category === current.category
    );
    const index = ordered.findIndex(template => template.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const timestamp = nowIso();
    await Promise.all(
      ordered.map((template, sortOrder) =>
        db.saveSpecTemplate({
          ...template,
          sortOrder: (sortOrder + 1) * 10,
          updatedAt: timestamp,
        })
      )
    );
    setTemplates(await db.listSpecTemplates());
  };

  const copyTemplates = async () => {
    if (!copyTargetCategory) {
      toast.error(t("common.selectthecategorytocopyt"));
      return;
    }
    const sourceCategory =
      copySourceCategory === "__all__" ? "" : copySourceCategory;
    if (sourceCategory === copyTargetCategory) {
      toast.error(t("common.selectadifferenttargetca"));
      return;
    }
    const source = templates.filter(
      template => template.category === sourceCategory
    );
    if (source.length === 0) {
      toast.error(t("common.notemplatesintheselected"));
      return;
    }
    const existingNames = new Set(
      templates
        .filter(template => template.category === copyTargetCategory)
        .map(template => template.label)
    );
    const toCopy = source.filter(
      template => !existingNames.has(template.label)
    );
    if (toCopy.length === 0) {
      toast.info(t("common.allsourcetemplatesalread"));
      return;
    }
    const timestamp = nowIso();
    const offset = templates.filter(
      template => template.category === copyTargetCategory
    ).length;
    await Promise.all(
      toCopy.map((template, index) =>
        db.saveSpecTemplate({
          ...template,
          id: newId("tpl"),
          category: copyTargetCategory,
          sortOrder: (offset + index + 1) * 10,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      )
    );
    setTemplates(await db.listSpecTemplates());
    toast.success(
      `${t("settings.templatesCopiedPrefix")} ${toCopy.length} ${t("settings.templatesCopiedSuffix")} ${copyTargetCategory}`
    );
  };

  // مثال حي يوضح أثر الإعدادات: وحدة واحدة بسعر 10 من العملة الأجنبية
  const sampleGoods = 10 * parseNumber(rate);
  const sampleCustoms = sampleGoods * (parseNumber(customs) / 100);
  const sampleCost = sampleGoods + sampleCustoms;
  const samplePrice = sampleCost * (1 + parseNumber(margin) / 100);

  return (
    <AppLayout
      title={t("settings.title")}
      subtitle={t("settings.localSubtitle")}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,460px)_1fr] items-start">
        <div className="space-y-5">
          <SettingsFold
            title={t("settings.groupDevice")}
            hint={t("settings.groupDeviceHint")}
            stamp={t("common.levelGeneral")}
            level="general"
            defaultOpen
          >
            <div className="space-y-3">
              <SettingsFold
                title={t("settings.defaultLanguageTitle")}
                hint={t("settings.defaultLanguageHint")}
                stamp={t("settings.language")}
                defaultOpen
              >
                <SectionCard
                  title={t("settings.defaultLanguageTitle")}
                  hint={t("settings.defaultLanguageHint")}
                  stamp={t("settings.language")}
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ui-language">
                        {t("settings.defaultLanguageLabel")}
                      </Label>
                      <Select
                        value={deviceLanguage}
                        onValueChange={value =>
                          setDeviceLanguage(value as typeof language)
                        }
                      >
                        <SelectTrigger
                          id="ui-language"
                          className="field-input w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ar">
                            {t("settings.langArabic")}
                          </SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="tr">Türkçe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={saveDeviceLanguage}
                    >
                      {t("settings.saveDefaultLanguage")}
                    </Button>
                  </div>
                </SectionCard>
              </SettingsFold>

              <SettingsFold
                title={t("settings.groupLedgerProtection")}
                hint={t("settings.groupAccessHint")}
                stamp={t("common.branch")}
              >
                <AccessSettingsCard />
              </SettingsFold>
              <SettingsFold
                title={t("loginBackground.title")}
                hint={t("settings.groupBackgroundHint")}
                stamp={t("common.branch")}
              >
                <LoginBackgroundSettingsCard />
              </SettingsFold>

              <SettingsFold
                title={t("activity.title")}
                hint={t("activity.hint")}
                stamp={t("activity.stamp")}
                defaultOpen
              >
                <SectionCard
                  title={t("activity.title")}
                  hint={t("activity.hint")}
                  stamp={t("activity.stamp")}
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="main-activity">
                        {t("activity.label")}
                      </Label>
                      <Select
                        value={mainActivity}
                        onValueChange={setMainActivity}
                      >
                        <SelectTrigger
                          id="main-activity"
                          className="field-input w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="import-export">
                            {t("activity.importExport")}
                          </SelectItem>
                          <SelectItem value="wholesale">
                            {t("activity.wholesale")}
                          </SelectItem>
                          <SelectItem value="retail">
                            {t("activity.retail")}
                          </SelectItem>
                          <SelectItem value="manufacturing">
                            {t("activity.manufacturing")}
                          </SelectItem>
                          <SelectItem value="logistics">
                            {t("activity.logistics")}
                          </SelectItem>
                          <SelectItem value="custom">
                            {t("activity.custom")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {mainActivity === "custom" ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="custom-activity">
                          {t("activity.customLabel")}
                        </Label>
                        <Input
                          id="custom-activity"
                          className="field-input"
                          value={customActivity}
                          onChange={event =>
                            setCustomActivity(event.target.value)
                          }
                          placeholder={t("activity.customPlaceholder")}
                        />
                      </div>
                    ) : null}
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {t("activity.note")}
                    </p>
                  </div>
                </SectionCard>
              </SettingsFold>

              <SettingsFold
                title={t("dashboard.title")}
                hint={t("settings.groupDashboardHint")}
                stamp={t("common.branch")}
              >
                <WorkspaceCustomizationCard />
              </SettingsFold>
              <SettingsFold
                title={t("multiCalc.visibilityTitle")}
                hint={t("settings.groupFloatingHint")}
                stamp={t("common.branch")}
              >
                <FloatingCalculatorSettingsCard />
              </SettingsFold>
            </div>
          </SettingsFold>

          <SettingsFold
            title={t("settings.groupBusinessFinance")}
            hint={t("settings.groupBusinessFinanceHint")}
            stamp={t("common.levelGeneral")}
            level="general"
            defaultOpen
          >
            <div className="space-y-3">
              <SettingsFold
                title={t("common.businessdetails")}
                hint={t("settings.businessNameHint")}
                stamp={t("common.branch")}
                defaultOpen
              >
                <SectionCard
                  title={t("common.businessdetails")}
                  hint={t("common.thenameappearsinexported")}
                  stamp={t("common.ledgeridentity")}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="st-company">
                      {t("common.businessname")}
                    </Label>
                    <Input
                      id="st-company"
                      className="field-input"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder={t("settings.businessNamePlaceholder")}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {t("common.leaveemptyifyoudonotwant")}
                    </p>
                  </div>
                </SectionCard>
              </SettingsFold>

              <SettingsFold
                title={t("common.currencies")}
                hint={t("settings.currenciesHint")}
                stamp={t("common.branch")}
              >
                <SectionCard
                  title={t("common.currencies")}
                  hint={t("common.thelocalcurrencyisforcos")}
                  stamp={t("common.conversionbasis")}
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t("common.localcurrency")}</Label>
                      {addingLocal ? (
                        <div className="flex gap-1.5">
                          <Input
                            className="field-input flex-1"
                            autoFocus
                            placeholder={t("settings.currencyName")}
                            value={newLocal}
                            onChange={e => setNewLocal(e.target.value)}
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="bg-card shrink-0"
                            onClick={() => {
                              const v = newLocal.trim();
                              if (!v) return;
                              setLocalOptions(p =>
                                Array.from(new Set([...p, v]))
                              );
                              setLocalCurrency(v);
                              setNewLocal("");
                              setAddingLocal(false);
                            }}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={localCurrency}
                          onValueChange={v =>
                            v === "__new__"
                              ? setAddingLocal(true)
                              : setLocalCurrency(v)
                          }
                        >
                          <SelectTrigger className="field-input w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {localOptions.map(c => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                            <SelectItem value="__new__">
                              + {t("common.addanothercurrency")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("common.foreigncurrency")}</Label>
                      {addingForeign ? (
                        <div className="flex gap-1.5">
                          <Input
                            className="field-input flex-1"
                            autoFocus
                            placeholder={t("settings.currencyName")}
                            value={newForeign}
                            onChange={e => setNewForeign(e.target.value)}
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="bg-card shrink-0"
                            onClick={() => {
                              const v = newForeign.trim();
                              if (!v) return;
                              setForeignOptions(p =>
                                Array.from(new Set([...p, v]))
                              );
                              setForeignCurrency(v);
                              setNewForeign("");
                              setAddingForeign(false);
                            }}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={foreignCurrency}
                          onValueChange={v =>
                            v === "__new__"
                              ? setAddingForeign(true)
                              : setForeignCurrency(v)
                          }
                        >
                          <SelectTrigger className="field-input w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {foreignOptions.map(c => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                            <SelectItem value="__new__">
                              + {t("common.addanothercurrency")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </SectionCard>
              </SettingsFold>

              <SettingsFold
                title={t("common.defaultcalculationvalues")}
                hint={t("settings.defaultsHint")}
                stamp={t("common.branch")}
                defaultOpen
              >
                <SectionCard
                  title={t("common.defaultcalculationvalues")}
                  hint={t("common.loadedautomaticallywheno")}
                  stamp={t("common.calculationconstants")}
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="st-rate">
                        {t("common.exchangeRate")} ({foreignCurrency}{" "}
                        {t("common.to")} {localCurrency})
                      </Label>
                      <Input
                        id="st-rate"
                        className="field-input"
                        dir="ltr"
                        inputMode="decimal"
                        value={rate}
                        onChange={e => setRate(e.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {t("common.enterthenumberitcanbecha")}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="st-customs">
                          {t("settings.customsRate")} %
                        </Label>
                        <Input
                          id="st-customs"
                          className="field-input"
                          dir="ltr"
                          inputMode="decimal"
                          value={customs}
                          onChange={e => setCustoms(e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {t("common.enterthemostfrequentlyus")}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="st-margin">
                          {t("settings.profitMargin")} %
                        </Label>
                        <Input
                          id="st-margin"
                          className="field-input"
                          dir="ltr"
                          inputMode="decimal"
                          value={margin}
                          onChange={e => setMargin(e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {t("common.enteryourtargetmargin")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={save} className="flex-1">
                        <Save className="h-4 w-4" />
                        {t("common.savesettings")}
                      </Button>
                      <Button
                        variant="outline"
                        className="bg-card"
                        onClick={restore}
                      >
                        <RotateCcw className="h-4 w-4" />
                        {t("common.initialvalues")}
                      </Button>
                    </div>
                  </div>
                </SectionCard>
              </SettingsFold>
            </div>
          </SettingsFold>

          <SettingsFold
            title={t("settings.groupLogisticsLibrary")}
            hint={t("settings.groupLogisticsLibraryHint")}
            stamp={t("common.levelGeneral")}
            level="general"
          >
            <LogisticsTemplatesSettingsCard />
          </SettingsFold>

          <SettingsFold
            title={t("settings.groupCatalog")}
            hint={t("settings.groupCatalogHint")}
            stamp={t("common.levelGeneral")}
            level="general"
          >
            <div className="space-y-3">
              <SettingsFold
                title={t("common.maincategories")}
                hint={t("settings.categoriesIndexHint")}
                stamp={t("common.branch")}
                defaultOpen
              >
                <SectionCard
                  title={t("common.maincategories")}
                  hint={t("common.shownasadropdownintheite")}
                  stamp={t("common.categoryindex")}
                >
                  <div className="space-y-3">
                    <div className="flex gap-1.5">
                      <Input
                        className="field-input flex-1"
                        placeholder={t("settings.categoryPlaceholder")}
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") void addCategory();
                        }}
                      />
                      <Button onClick={addCategory} className="shrink-0">
                        <Plus className="h-4 w-4" />
                        {t("common.add")}
                      </Button>
                    </div>
                    {categories.length === 0 ? (
                      <div className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                        {t("settings.noCategories")}.
                      </div>
                    ) : (
                      <ul className="divide-y divide-border rounded border border-border bg-card">
                        {categories.map(c => (
                          <li
                            key={c.id}
                            className="flex items-center justify-between gap-2 px-3 py-2"
                          >
                            <span className="flex items-center gap-2 text-sm">
                              <Tags className="h-3.5 w-3.5 text-[var(--ink)]/60" />
                              {c.name}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeCategory(c.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {t("settings.deleteCategoryNote")}.
                    </p>
                  </div>
                </SectionCard>
              </SettingsFold>

              <SettingsFold
                title={t("common.technicalspecificationte")}
                hint={t("settings.specTemplatesManageHint")}
                stamp={t("common.branch")}
                defaultOpen
              >
                <SectionCard
                  title={t("common.technicalspecificationte")}
                  hint={t("common.controldefaultspecificat")}
                  stamp={t("common.specificationindex")}
                >
                  <div className="space-y-3">
                    <SettingsFold
                      level="detail"
                      title={
                        editingTemplateId
                          ? t("settings.editSpecTemplate")
                          : t("common.addtechnicalspecificatio")
                      }
                      hint={t("settings.specFieldsHint")}
                      stamp={t("common.details")}
                      defaultOpen
                    >
                      <div className="rounded border border-[var(--amber-line)] bg-[var(--amber-field)] p-3">
                        <p className="mb-2 text-xs font-semibold text-[var(--ink)]">
                          {editingTemplateId
                            ? t("settings.editSpecTemplateTitle")
                            : t("common.addtechnicalspecificatio")}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-[11px]">
                              {t("common.linkedcategory")}
                            </Label>
                            <Select
                              value={templateDraft.category || "__all__"}
                              onValueChange={value =>
                                setTemplateDraft({
                                  ...templateDraft,
                                  category: value === "__all__" ? "" : value,
                                })
                              }
                            >
                              <SelectTrigger className="field-input w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">
                                  {t("common.generaltemplateforallcat")}
                                </SelectItem>
                                {categories.map(category => (
                                  <SelectItem
                                    key={category.id}
                                    value={category.name}
                                  >
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">
                              {t("common.specificationname")}
                            </Label>
                            <Input
                              className="field-input"
                              placeholder={t("settings.specNamePlaceholder")}
                              value={templateDraft.label}
                              onChange={e =>
                                setTemplateDraft({
                                  ...templateDraft,
                                  label: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">
                              {t("common.defaultunit")}
                            </Label>
                            <Input
                              className="field-input"
                              placeholder={t("settings.specUnitPlaceholder")}
                              value={templateDraft.defaultUnit}
                              onChange={e =>
                                setTemplateDraft({
                                  ...templateDraft,
                                  defaultUnit: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-[11px]">
                              {t("common.availableunits")}
                            </Label>
                            <Input
                              className="field-input"
                              placeholder={t("settings.specUnitsPlaceholder")}
                              value={templateDraft.unitOptions}
                              onChange={e =>
                                setTemplateDraft({
                                  ...templateDraft,
                                  unitOptions: e.target.value,
                                })
                              }
                            />
                            <p className="text-[10px] text-muted-foreground">
                              {t("settings.specUnitsHint")}.
                            </p>
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-[11px]">
                              {t("common.inputhint")}
                            </Label>
                            <Input
                              className="field-input"
                              placeholder={t(
                                "settings.specPlaceholderPlaceholder"
                              )}
                              value={templateDraft.placeholder}
                              onChange={e =>
                                setTemplateDraft({
                                  ...templateDraft,
                                  placeholder: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {[
                            {
                              key: "isKeyDefault" as const,
                              label: t("common.keyforcomparison"),
                              icon: Star,
                            }, // i18n-deep
                            {
                              key: "showInItem" as const,
                              label: t("common.itemcard"),
                              icon: LayoutList,
                            }, // i18n-deep
                            {
                              key: "showInPrices" as const,
                              label: t("common.pricetable"),
                              icon: Tags,
                            }, // i18n-deep
                            {
                              key: "showInReports" as const,
                              label: t("common.reports"),
                              icon: Eye,
                            }, // i18n-deep
                            {
                              key: "showInExport" as const,
                              label: t("common.excelexport"),
                              icon: FileSpreadsheet,
                            }, // i18n-deep
                          ].map(({ key, label, icon: Icon }) => (
                            <Button
                              key={key}
                              type="button"
                              variant={
                                templateDraft[key] ? "default" : "outline"
                              }
                              className={
                                templateDraft[key]
                                  ? "justify-start"
                                  : "justify-start bg-card"
                              }
                              onClick={() =>
                                setTemplateDraft({
                                  ...templateDraft,
                                  [key]: !templateDraft[key],
                                })
                              }
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span className="text-[11px]">{label}</span>
                            </Button>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            onClick={() => void saveTemplate()}
                            className="flex-1"
                          >
                            <Save className="h-4 w-4" />
                            {editingTemplateId
                              ? t("followup.updateTask")
                              : t("common.addspecification")}
                          </Button>
                          {editingTemplateId ? (
                            <Button
                              variant="outline"
                              className="bg-card"
                              onClick={resetTemplateDraft}
                            >
                              <RotateCcw className="h-4 w-4" />
                              {t("common.cancel")}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </SettingsFold>

                    <SettingsFold
                      level="detail"
                      title={t("common.copytemplatesbetweencate")}
                      hint={t("settings.copyTemplatesHint")}
                      stamp={t("common.details")}
                    >
                      <div className="rounded border border-border bg-secondary/45 p-3">
                        <p className="text-xs font-semibold text-[var(--ink)]">
                          {t("common.copytemplatesbetweencate")}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {t("common.copyunitsorderanddisplay")}.
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">
                              {t("common.source")}
                            </Label>
                            <Select
                              value={copySourceCategory}
                              onValueChange={setCopySourceCategory}
                            >
                              <SelectTrigger className="field-input w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">
                                  {t("common.generaltemplates")}
                                </SelectItem>
                                {categories.map(category => (
                                  <SelectItem
                                    key={category.id}
                                    value={category.name}
                                  >
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">
                              {t("common.targetcategory")}
                            </Label>
                            <Select
                              value={copyTargetCategory}
                              onValueChange={setCopyTargetCategory}
                              disabled={categories.length === 0}
                            >
                              <SelectTrigger className="field-input w-full">
                                <SelectValue
                                  placeholder={t("common.selectcategory")}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(category => (
                                  <SelectItem
                                    key={category.id}
                                    value={category.name}
                                  >
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button
                          className="mt-2 w-full"
                          variant="outline"
                          disabled={categories.length === 0}
                          onClick={() => void copyTemplates()}
                        >
                          <Copy className="h-4 w-4" />
                          {t("common.copytemplates")}
                        </Button>
                      </div>
                    </SettingsFold>

                    <SettingsFold
                      level="detail"
                      title={t("settings.savedTemplatesRegister")}
                      hint={t("settings.templatesRegisterHint")}
                      stamp={`${templates.length} ${t("settings.templateCountWord")}`}
                    >
                      {templates.length === 0 ? (
                        <div className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                          {t("settings.noSpecTemplates")}.
                        </div>
                      ) : (
                        <ul className="overflow-hidden rounded border border-border bg-card">
                          {templates.map((template, index) => (
                            <li
                              key={template.id}
                              className="border-b border-border p-2.5 last:border-b-0"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[var(--ink)]">
                                    {template.label}{" "}
                                    {template.defaultUnit ? (
                                      <span className="text-[11px] font-normal text-muted-foreground">
                                        ({template.defaultUnit})
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                                    {template.category
                                      ? `${t("settings.categoryLabel")}: ${template.category}`
                                      : t("settings.generalTemplate")}
                                    {template.unitOptions
                                      ? ` · ${t("settings.unitsLabel")}: ${template.unitOptions.split("|").join(t("common.listSeparator"))}`
                                      : ""}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {template.isKeyDefault === 1 ? (
                                      <span className="rounded bg-[var(--port-green-soft)] px-1.5 py-0.5 text-[9px] text-[var(--ink)]">
                                        {t("settings.compareLabel")}
                                      </span>
                                    ) : null}
                                    {template.showInItem === 1 ? (
                                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px]">
                                        {t("common.item")}
                                      </span>
                                    ) : null}
                                    {template.showInPrices === 1 ? (
                                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px]">
                                        {t("nav.prices")}
                                      </span>
                                    ) : null}
                                    {template.showInReports === 1 ? (
                                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px]">
                                        {t("common.reports")}
                                      </span>
                                    ) : null}
                                    {template.showInExport === 1 ? (
                                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px]">
                                        {t("settings.exportLabel")}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex shrink-0 gap-0.5">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    disabled={index === 0}
                                    title={t("common.moveup")}
                                    onClick={() =>
                                      void moveTemplate(template.id, -1)
                                    }
                                  >
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    disabled={index === templates.length - 1}
                                    title={t("common.movedown")}
                                    onClick={() =>
                                      void moveTemplate(template.id, 1)
                                    }
                                  >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    title={t("common.edit")}
                                    onClick={() => editTemplate(template)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive"
                                    title={t("common.delete")}
                                    onClick={() =>
                                      void removeTemplate(template)
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {t("settings.hideTemplateNote")}.
                      </p>
                    </SettingsFold>
                  </div>
                </SectionCard>
              </SettingsFold>
            </div>
          </SettingsFold>
        </div>

        <SectionCard
          title={t("common.settingseffect")}
          hint={t("common.illustrationforoneunitpr")}
          stamp={t("common.preview")}
        >
          <div className="calc-line">
            <ul>
              {[
                {
                  k: `${t("common.unitvalue")} (10 × ${parseNumber(rate)})`,
                  v: sampleGoods,
                },
                {
                  k: `${t("common.customs")} ${parseNumber(customs)}%`,
                  v: sampleCustoms,
                },
              ].map(r => (
                <li
                  key={r.k}
                  className="calc-node flex items-center justify-between gap-3 border-b border-border/70 py-2.5"
                >
                  <span className="text-sm text-foreground/85">{r.k}</span>
                  <span
                    className="ledger-figure text-sm text-[var(--ink)]"
                    dir="ltr"
                  >
                    {formatMoney(r.v, localCurrency)}
                  </span>
                </li>
              ))}
              <li className="calc-node pt-3" data-total="true">
                <div className="result-card rounded px-4 py-3.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[var(--ink)]">
                    {t("home.unitCost")}
                  </span>
                  <span
                    className="ledger-figure text-lg text-[var(--ink-deep)]"
                    dir="ltr"
                  >
                    {formatMoney(sampleCost, localCurrency)}
                  </span>
                </div>
              </li>
              <li className="calc-node pt-3" data-total="true">
                <div className="result-card rounded px-4 py-3.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[var(--ink)]">
                    {t("settings.sellingPriceWithMargin")} {parseNumber(margin)}
                    %
                  </span>
                  <span
                    className="ledger-figure text-lg text-[var(--ink-deep)]"
                    dir="ltr"
                  >
                    {formatMoney(samplePrice, localCurrency)}
                  </span>
                </div>
              </li>
            </ul>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded border border-border bg-secondary/40 px-3 py-2.5">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-[var(--ink)]/70" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t("settings.exampleNote")}.
            </p>
          </div>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
