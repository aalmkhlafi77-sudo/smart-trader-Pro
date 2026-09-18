/** ترويسة الصفحة: مسار تنقّل المجموعة النشطة + عنوان/وصف/إجراءات + مبدّل اللغة. */
import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { findActiveGroup } from "./navGroups";

export default function HeaderBar({
  title,
  subtitle,
  action,
  location,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  location: string;
}) {
  const { t } = useLanguage();
  const activeGroup = findActiveGroup(location);
  const activeItem = activeGroup?.items.find(item => item.href === location);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-[var(--ink)] text-white/95 lg:bg-card lg:text-foreground">
      <div className="flex items-center gap-3 px-4 py-3.5 lg:px-8">
        <img
          src="/assets/port-ledger-mark.webp"
          alt=""
          className="brand-seal h-9 w-9 bg-[#f7f2e8] p-1 lg:hidden"
        />
        <div className="min-w-0 flex-1">
          {activeGroup && activeItem ? (
            <p className="flex items-center gap-1 text-[10px] tracking-wide text-white/60 lg:text-muted-foreground">
              <span>{t(activeGroup.groupKey)}</span>
              <span aria-hidden>›</span>
              <span className="font-semibold">{t(activeItem.labelKey)}</span>
            </p>
          ) : null}
          <h1 className="font-display truncate text-base font-bold sm:text-lg lg:text-xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="truncate text-[11px] text-white/70 sm:text-xs lg:text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
        <LanguageSwitcher tone="dark" className="lg:hidden" />
        <LanguageSwitcher tone="light" className="hidden lg:flex" />
      </div>
    </header>
  );
}
