/** قيم العملات المخزَّنة (نصوص عربية) — الترحيل إلى رموز ISO مؤجَّل إلى S5. محمية عبر ALLOW_DEC. */
export const CURRENCY_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "دولار", labelKey: "currency.usd" },
  { value: "ريال", labelKey: "currency.sar" },
  { value: "يورو", labelKey: "currency.eur" },
  { value: "يوان", labelKey: "currency.cny" },
];
