/**
 * نظام الأنماط — قشرة الصفحة الموحّدة: مسار تنقّل (breadcrumb)، عنوان، إجراءات، ومحتوى.
 * كل النصوص تصل عبر props؛ لا نصوص داخلية هنا (معيار i18n).
 */
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export type Crumb = { label: string; href?: string };

export function PageShell({
  crumbs,
  title,
  description,
  actions,
  children,
  className,
}: {
  crumbs?: Crumb[];
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { direction } = useLanguage();
  const Chevron = direction === "rtl" ? ChevronLeft : ChevronRight;
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {crumbs?.length ? (
            <nav
              aria-label="breadcrumb"
              className="mb-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground"
            >
              {crumbs.map((crumb, index) => (
                <span
                  key={`${crumb.label}-${index}`}
                  className="flex items-center gap-1"
                >
                  {index > 0 ? (
                    <Chevron className="h-3 w-3 shrink-0" aria-hidden />
                  ) : null}
                  {crumb.href && index < crumbs.length - 1 ? (
                    <Link
                      href={crumb.href}
                      className="transition-colors hover:text-[var(--ink)]"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={
                        index === crumbs.length - 1
                          ? "font-semibold text-[var(--ink)]"
                          : undefined
                      }
                    >
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          ) : null}
          <h2 className="font-display text-lg leading-tight font-extrabold text-[var(--ink)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
