import { useState } from "react";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Field,
  NumberField,
  FormGrid,
  FormSection,
} from "@/components/patterns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import type { EntityKind } from "@/lib/db";

export interface EntityFormData {
  name: string;
  kind: EntityKind;
  country: string;
  city: string;
  phone: string;
  email: string;
  contactPerson: string;
  notes: string;
  defaultCurrency: string;
  defaultExchangeRate: string;
}

const KINDS: { value: EntityKind; labelKey: string }[] = [
  { value: "supplier", labelKey: "entities.kind.supplier" },
  { value: "customer", labelKey: "entities.kind.customer" },
  { value: "factory", labelKey: "entities.kind.factory" },
  { value: "other", labelKey: "entities.kind.other" },
];

export function EntityForm({
  form,
  setForm,
  editingId,
  onSave,
  onReset,
  onAttachmentsChanged,
}: {
  form: EntityFormData;
  setForm: (f: EntityFormData) => void;
  editingId: string | null;
  onSave: () => void;
  onReset: () => void;
  onAttachmentsChanged?: () => void;
}) {
  const { t } = useLanguage();
  const [showExtra, setShowExtra] = useState(false);

  return (
    <div className="space-y-4">
      {/* 1. الاسم* · نوع العلاقة* */}
      <FormSection
        title={t("common.partneridentity")}
        note={t("common.nametypeandlocation")}
      >
        <FormGrid cols={2}>
          <Field
            label={t("entities.name")}
            required
            control={
              <Input
                className="field-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={t("common.examplealnokhbacompany")}
              />
            }
          />
          <Field
            label={t("entities.type")}
            required
            control={
              <Select
                value={form.kind}
                onValueChange={v => setForm({ ...form, kind: v as EntityKind })}
              >
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
        </FormGrid>

        {/* 2. الدولة · المدينة */}
        <FormGrid cols={2} className="mt-3">
          <Field
            label={t("entities.country")}
            control={
              <Input
                className="field-input"
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
              />
            }
          />
          <Field
            label={t("entities.city")}
            control={
              <Input
                className="field-input"
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
              />
            }
          />
        </FormGrid>
      </FormSection>

      {/* 3. العملة الافتراضية* · سعر الصرف المرجعي* (تلميح: تورث لكل صنف جديد) */}
      <FormSection
        title={t("entities.defaultPurchase")}
        note={t("common.copiedautomaticallytoani")}
      >
        <FormGrid cols={2}>
          <Field
            label={t("entities.defaultCurrency")}
            required
            hint={t("common.copiedautomaticallytoani")}
            control={
              <Select
                value={form.defaultCurrency || "دولار"}
                onValueChange={v => setForm({ ...form, defaultCurrency: v })}
              >
                <SelectTrigger className="field-input w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="دولار">{t("currency.usd")}</SelectItem>
                  <SelectItem value="ريال">{t("currency.sar")}</SelectItem>
                  <SelectItem value="يورو">{t("currency.eur")}</SelectItem>
                  <SelectItem value="يوان">{t("currency.cny")}</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <Field
            label={t("entities.defaultRate")}
            required
            hint={t("common.copiedautomaticallytoani")}
            control={
              <NumberField
                value={form.defaultExchangeRate ?? "3.75"}
                onChange={e =>
                  setForm({ ...form, defaultExchangeRate: e.target.value })
                }
                placeholder={t("common.example375")}
              />
            }
          />
        </FormGrid>
      </FormSection>

      {/* 4. الشخص المسؤول · الهاتف · البريد */}
      <FormSection
        title={t("common.contactdetails")}
        note={t("common.adddetailsthathelpyouret")}
      >
        <Field
          label={t("entities.contact")}
          control={
            <Input
              className="field-input"
              value={form.contactPerson}
              onChange={e =>
                setForm({ ...form, contactPerson: e.target.value })
              }
            />
          }
        />
        <FormGrid cols={2} className="mt-3">
          <Field
            label={t("entities.phone")}
            control={
              <Input
                className="field-input"
                dir="ltr"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            }
          />
          <Field
            label={t("entities.email")}
            control={
              <Input
                className="field-input"
                dir="ltr"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            }
          />
        </FormGrid>
      </FormSection>

      {/* 5. (قسم قابل للطي) ملاحظات · مرفقات */}
      <div className="rounded-md border border-border/80 bg-secondary/20 p-3">
        <button
          type="button"
          onClick={() => setShowExtra(v => !v)}
          className="flex w-full items-center justify-between text-xs font-semibold text-[var(--ink)]"
        >
          <span>{t("common.extraDetails")}</span>
          {showExtra ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showExtra && (
          <div className="mt-3 space-y-3 pt-2 border-t border-border/60">
            <Field
              label={t("common.notes")}
              control={
                <Textarea
                  className="field-input min-h-20"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              }
            />
            {editingId && (
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-[var(--ink)]">
                  {t("common.attachments")}
                </span>
                <AttachmentsPanel
                  entityId={editingId}
                  compact
                  onChanged={onAttachmentsChanged}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* شريط الإجراءات */}
      <div className="flex gap-2 pt-2">
        <Button onClick={onSave} className="form-action-bar flex-1">
          <Plus className="h-4 w-4" />
          {editingId ? t("entities.update") : t("entities.save")}
        </Button>
        {editingId && (
          <Button variant="outline" onClick={onReset} className="bg-card">
            <X className="h-4 w-4" />
            {t("entities.discardDraft")}
          </Button>
        )}
      </div>
    </div>
  );
}
