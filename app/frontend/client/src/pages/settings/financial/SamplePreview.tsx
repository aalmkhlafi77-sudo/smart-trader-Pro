import { useLanguage } from "@/contexts/LanguageContext";
import { FormSection, SectionCard } from "@/components/patterns";
import { formatMoney, parseNumber } from "@/lib/pricing";

export function SamplePreview({
  rate,
  customs,
  margin,
  localCurrency,
}: {
  rate: string;
  customs: string;
  margin: string;
  localCurrency: string;
}) {
  const { t } = useLanguage();

  // مثال حي: وحدة واحدة بسعر 10 من العملة الأجنبية
  const sampleGoods = 10 * parseNumber(rate);
  const sampleCustoms = sampleGoods * (parseNumber(customs) / 100);
  const sampleCost = sampleGoods + sampleCustoms;
  const samplePrice = sampleCost * (1 + parseNumber(margin) / 100);

  return (
    <SectionCard
      title={t("common.settingseffect")}
      description={t("common.illustrationforoneunitpr")}
      stamp={t("common.preview")}
    >
      <FormSection>
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
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {t("settings.exampleNote")}.
        </p>
      </FormSection>
    </SectionCard>
  );
}
