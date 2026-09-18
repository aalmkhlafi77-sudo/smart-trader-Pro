/**
 * خريطة عرض العملات — رموز ISO المخزَّنة (منذ v11) إلى مفاتيح الترجمة.
 * القيم غير المعروفة (عملات حرة قديمة) تُعرض كما هي دون فقد.
 */

/** مفاتيح الترجمة لرموز ISO المعروفة. */
export const ISO_CURRENCY_LABEL_KEY: Record<string, string> = {
  USD: "currency.usd",
  SAR: "currency.sar",
  EUR: "currency.eur",
  CNY: "currency.cny",
  TRY: "currency.try",
  AED: "currency.aed",
  EGP: "currency.egp",
  INR: "currency.inr",
};

export function currencyLabel(
  code: string | null | undefined,
  t: (key: string) => string
): string {
  const key = ISO_CURRENCY_LABEL_KEY[(code ?? "").trim()];
  return key ? t(key) : (code ?? "");
}
