/**
 * نظام الأنماط — الحقول: تسمية+رسالة (Field)، رقمي (NumberField)، عملة (CurrencyField)،
 * نسبة (RateField)، تاريخ (DateField عبر EnglishDatePicker)، وقيمة موروثة/محسوبة (InheritedValue).
 * قاعدة «دفتر الميناء»: حقل إدخال بسطح كهرماني-رمادي، نتيجة محسوبة بسطح أخضر — لا يجوز الخلط.
 */
import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import EnglishDatePicker from "@/components/EnglishDatePicker";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  error,
  required,
  control,
  htmlFor,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  control: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      className={cn("flex min-w-0 flex-col gap-1", className)}
      htmlFor={htmlFor}
    >
      <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ink)]">
        {label}
        {required ? (
          <span className="text-[var(--danger)]" aria-hidden>
            *
          </span>
        ) : null}
      </span>
      {control}
      {error ? (
        <span className="text-[10px] font-medium text-[var(--danger)]">
          {error}
        </span>
      ) : hint ? (
        <span className="text-[10px] leading-relaxed text-[var(--guidance)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function NumberField({
  className,
  ...rest
}: ComponentProps<typeof Input>) {
  return (
    <Input
      dir="ltr"
      inputMode="decimal"
      {...rest}
      className={cn("field-input font-medium tabular-nums", className)}
    />
  );
}

export function CurrencyField({
  className,
  suffix,
  ...rest
}: ComponentProps<typeof Input> & { suffix?: string }) {
  return (
    <div className={cn("flex items-stretch gap-1.5", className)}>
      <NumberField {...rest} className="min-w-0 flex-1" />
      {suffix ? (
        <span className="ledger-register-code flex items-center self-center px-1.5 py-1">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function RateField({
  className,
  ...rest
}: ComponentProps<typeof Input>) {
  return <CurrencyField suffix="%" {...rest} className={className} />;
}

export function DateField({
  value,
  onChange,
  withTime,
  disabled,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <EnglishDatePicker
      value={value}
      onChange={onChange}
      withTime={withTime}
      disabled={disabled}
      ariaLabel={ariaLabel}
      className={className}
    />
  );
}

export function InheritedValue({
  label,
  value,
  source,
  tone = "computed",
  className,
}: {
  label: string;
  value: ReactNode;
  source?: string;
  tone?: "computed" | "inherited";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border px-3 py-2",
        tone === "computed"
          ? "border-[color-mix(in_oklab,var(--port-green)_38%,transparent)] bg-[var(--computed-surface)]"
          : "border-dashed border-[var(--field-border)] bg-[var(--input-surface)]",
        className
      )}
    >
      <span className="min-w-0 text-[11px] font-semibold text-[var(--ink)]">
        {label}
      </span>
      <span className="flex min-w-0 shrink-0 flex-col items-end">
        <span className="ledger-figure text-sm">{value}</span>
        {source ? (
          <span className="text-[9px] text-[var(--guidance)]">{source}</span>
        ) : null}
      </span>
    </div>
  );
}
