/**
 * مخططات التحقق S6 — zod v4 + react-hook-form (zodResolver).
 * كل مخطط مصنع يستقبل t ليخرج رسائل i18n محلية لحظة التحقق،
 * وتُعرض عبر خاصية error الموجودة في مكوّن Field.
 */
import { z } from "zod";

export type TFunction = (key: string) => string;

const requiredText = (t: TFunction) =>
  z.string().trim().min(1, { error: t("validation.required") });

const freeText = z.string();

const optionalEmail = (t: TFunction) =>
  z
    .string()
    .refine(v => v.trim() === "" || /.+@.+\..+/.test(v.trim()), {
      error: t("validation.invalidEmail"),
    });

const numericText = (t: TFunction) =>
  z
    .string()
    .refine(v => v.trim() === "" || Number.isFinite(Number(v)), {
      error: t("validation.invalidNumber"),
    });

const requiredPositiveText = (t: TFunction) =>
  z
    .string()
    .trim()
    .min(1, { error: t("validation.required") })
    .refine(v => Number.isFinite(Number(v)), {
      error: t("validation.invalidNumber"),
    })
    .refine(v => Number(v) > 0, { error: t("validation.notPositive") });

export const optionalNonNegativeText = (t: TFunction) =>
  z
    .string()
    .refine(v => v.trim() === "" || Number.isFinite(Number(v)), {
      error: t("validation.invalidNumber"),
    })
    .refine(v => v.trim() === "" || Number(v) >= 0, {
      error: t("validation.negative"),
    });

const isoDateText = (t: TFunction) =>
  z
    .string()
    .trim()
    .min(1, { error: t("validation.required") })
    .refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), {
      error: t("validation.invalidDate"),
    });

export const entitySchema = (t: TFunction) =>
  z.object({
    name: requiredText(t),
    kind: z.enum(["supplier", "customer", "factory", "other"]),
    country: freeText,
    city: freeText,
    phone: freeText,
    email: optionalEmail(t),
    contactPerson: freeText,
    notes: freeText,
    defaultCurrency: requiredText(t),
    defaultExchangeRate: requiredPositiveText(t),
  });

export const itemSchema = (t: TFunction) =>
  z.object({
    name: requiredText(t),
    code: freeText,
    category: freeText,
    entityId: freeText,
    unit: freeText,
    currency: requiredText(t),
    defaultExchangeRate: requiredPositiveText(t),
    customsRate: optionalNonNegativeText(t),
    notes: freeText,
  });

export const priceLevelSchema = (t: TFunction) =>
  z.object({
    price: optionalNonNegativeText(t),
    date: isoDateText(t),
    source: freeText,
  });

export const financialDefaultsSchema = (t: TFunction) =>
  z.object({
    rate: requiredPositiveText(t),
    customs: optionalNonNegativeText(t),
    margin: optionalNonNegativeText(t),
  });

export const businessSchema = () =>
  z.object({
    companyName: freeText,
    mainActivity: freeText,
    customActivity: freeText,
  });

export const categorySchema = (t: TFunction) =>
  z.object({ name: requiredText(t) });

export const specTemplateSchema = (t: TFunction) =>
  z.object({
    category: freeText,
    label: requiredText(t),
    defaultUnit: freeText,
    unitOptions: freeText,
    placeholder: freeText,
  });

export const locationSchema = (t: TFunction) =>
  z.object({
    name: requiredText(t),
    country: freeText,
    city: freeText,
  });

export const rateSchema = (t: TFunction) =>
  z.object({
    name: requiredText(t),
    amount: z
      .string()
      .trim()
      .min(1, { error: t("validation.required") })
      .refine(v => Number.isFinite(Number(v)), {
        error: t("validation.invalidNumber"),
      })
      .refine(v => Number(v) >= 0, { error: t("validation.negative") }),
    currency: freeText,
    effectiveDate: isoDateText(t),
  });

export const routeTemplateSchema = (t: TFunction) =>
  z.object({ name: requiredText(t) });

const sixDigits = (t: TFunction) =>
  z
    .string()
    .refine(v => /^\d{6}$/.test(v), { error: t("validation.mismatch") });

export const pinSchema = (t: TFunction) =>
  z
    .object({
      currentPin: sixDigits(t),
      nextPin: sixDigits(t),
      confirmation: sixDigits(t),
    })
    .refine(data => data.nextPin === data.confirmation, {
      error: t("validation.mismatch"),
      path: ["confirmation"],
    });

export type EntityFormValues = z.infer<ReturnType<typeof entitySchema>>;
export type ItemFormValues = z.infer<ReturnType<typeof itemSchema>>;
