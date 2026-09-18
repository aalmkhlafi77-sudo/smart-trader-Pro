/**
 * نظام الأنماط — البطاقات: بطاقة سجل (SectionCard)، مجموعة إدخال (FormSection)، شبكة حقول (FormGrid).
 * تعتمد طبقات index.css (ledger-sheet / ledger-head / form-cluster) ولا تكرّر تنسيقاتها.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  stamp,
  actions,
  footer,
  children,
  className,
  tone = "default",
}: {
  title?: string;
  description?: string;
  stamp?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  tone?: "default" | "result" | "input";
}) {
  return (
    <section
      className={cn(
        "ledger-sheet rounded-md",
        tone === "result" && "result-card",
        tone === "input" && "bg-[var(--input-surface)]",
        className
      )}
    >
      {title ? (
        <header className="ledger-head flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h3 className="font-display text-sm font-extrabold text-[var(--ink)]">
              {title}
            </h3>
            {description ? (
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {stamp ? <span className="ledger-stamp">{stamp}</span> : null}
          </div>
        </header>
      ) : null}
      {children ? <div className="px-4 py-3.5">{children}</div> : null}
      {footer ? (
        <footer className="border-t border-border px-4 py-2.5">{footer}</footer>
      ) : null}
    </section>
  );
}

export function FormSection({
  title,
  note,
  children,
  className,
}: {
  title?: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("form-cluster", className)}>
      {title ? (
        <div className="form-cluster-heading">
          <span className="form-cluster-title">{title}</span>
          {note ? <span className="form-cluster-note">{note}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FormGrid({
  children,
  cols = 2,
  className,
}: {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const colClass = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[cols];
  return (
    <div className={cn("grid grid-cols-1 gap-3", colClass, className)}>
      {children}
    </div>
  );
}
