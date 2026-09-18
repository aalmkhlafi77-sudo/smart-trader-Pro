/**
 * نظام الأنماط — مسارات العمل: معالج خطوات (StepWizard) وسجل ملخّص جانبي (SummaryRail)
 * مبنيان على طبقة «خط الحساب» (calc-line/calc-node) في index.css.
 */
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStep = { id: string; label: string };

export function StepWizard({
  steps,
  currentId,
  onStepSelect,
  className,
}: {
  steps: WizardStep[];
  currentId: string;
  onStepSelect?: (id: string) => void;
  className?: string;
}) {
  const currentIndex = steps.findIndex(step => step.id === currentId);
  return (
    <ol
      aria-label="wizard-steps"
      className={cn("touch-scroll-x flex items-center gap-1", className)}
    >
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = step.id === currentId;
        return (
          <li key={step.id} className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={!onStepSelect || (!active && !done)}
              onClick={() => onStepSelect?.(step.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors",
                active
                  ? "border-[var(--port-green)] bg-[var(--port-green-soft)] text-[var(--ink)]"
                  : done
                    ? "border-[color-mix(in_oklab,var(--port-green)_40%,transparent)] bg-card text-[var(--port-green)]"
                    : "border-[var(--field-border)] bg-card text-[var(--guidance)]"
              )}
            >
              <span
                className={cn(
                  "grid h-4 w-4 place-items-center rounded-full text-[9px]",
                  active || done
                    ? "bg-[var(--port-green)] text-white"
                    : "bg-[var(--field-surface)]"
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : index + 1}
              </span>
              <span className="whitespace-nowrap">{step.label}</span>
            </button>
            {index < steps.length - 1 ? (
              <span className="h-px w-3 bg-[var(--field-border)]" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export type SummaryRow = {
  label: string;
  value: ReactNode;
  tone?: "default" | "total" | "muted";
};

export function SummaryRail({
  title,
  rows,
  actions,
  className,
}: {
  title?: string;
  rows: SummaryRow[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "calc-line rounded-md border border-border bg-card p-3.5",
        className
      )}
    >
      {title ? (
        <p className="calc-node mb-2 font-display text-xs font-extrabold text-[var(--ink)]">
          {title}
        </p>
      ) : null}
      <dl className="grid gap-1.5">
        {rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className={cn(
              "calc-node flex items-center justify-between gap-3 rounded px-1 py-1",
              row.tone === "total" && "bg-[var(--computed-surface)]"
            )}
          >
            <dt
              className={cn(
                "min-w-0 text-[11px]",
                row.tone === "muted"
                  ? "text-[var(--guidance)]"
                  : "text-[var(--ink)]"
              )}
            >
              {row.label}
            </dt>
            <dd
              className={cn(
                "shrink-0 text-xs font-bold tabular-nums",
                row.tone === "total"
                  ? "ledger-figure text-sm text-[var(--port-green)]"
                  : "text-[var(--ink)]"
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {actions ? <div className="mt-3 grid gap-2">{actions}</div> : null}
    </aside>
  );
}
