/** الشريط الجانبي (سطح المكتب): 5 مجموعات تنقّل مع طي محفوظ محليًا. */
import { STORAGE_ENGINE } from "@/lib/db";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAccess } from "@/contexts/AccessContext";
import { useWorkspacePreferences } from "@/contexts/WorkspacePreferencesContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  HardDrive,
  LockKeyhole,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { NAV_GROUPS } from "./navGroups";

export default function SidebarNav() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { lock } = useAccess();
  const { sidebarCollapsed, toggleSidebarCollapsed } =
    useWorkspacePreferences();
  const collapseLabel = t(
    sidebarCollapsed ? "app.expandSidebar" : "app.collapseSidebar"
  );

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
        sidebarCollapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 border-b border-sidebar-border px-4 py-5",
          sidebarCollapsed && "flex-col gap-2 px-2"
        )}
      >
        <img
          src="/assets/port-ledger-mark.webp"
          alt={t("app.name")}
          className="brand-seal h-10 w-10 shrink-0 bg-[#f7f2e8] p-1.5"
        />
        {sidebarCollapsed ? null : (
          <div className="min-w-0">
            <p className="font-display truncate text-base leading-tight font-extrabold tracking-tight">
              {t("app.name")}
            </p>
            <p className="truncate text-[10px] text-sidebar-foreground/65">
              {t("app.tagline")}
            </p>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleSidebarCollapsed}
          aria-label={collapseLabel}
          title={collapseLabel}
          className={cn(
            "h-8 w-8 shrink-0 text-sidebar-foreground/70 hover:bg-white/10 hover:text-white",
            sidebarCollapsed ? "order-last" : "ms-auto"
          )}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto px-2.5 py-4">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.groupKey}>
            {sidebarCollapsed ? (
              groupIndex > 0 ? (
                <div className="mx-2 mb-3 border-t border-sidebar-border/70" />
              ) : null
            ) : (
              <p className="mb-1.5 mt-1 px-2 text-[9px] font-semibold tracking-wider text-[#7DB7D9] uppercase">
                {t(group.groupKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, labelKey, icon: Icon }) => {
                const active = location === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    title={t(labelKey)}
                    className={cn(
                      "group flex items-center gap-3 rounded px-3 py-2 text-sm transition-all duration-200",
                      sidebarCollapsed && "justify-center px-0",
                      active
                        ? "border-e-2 border-e-[#2E9FE6] bg-[rgba(79,139,181,0.32)] font-bold text-white shadow-[inset_-10px_0_20px_-18px_rgba(98,197,255,0.95)]"
                        : "text-[#EAF1F6] hover:bg-[rgba(79,139,181,0.18)] hover:text-white"
                    )}
                  >
                    <Icon
                      strokeWidth={active ? 2.35 : 2}
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors duration-200",
                        active
                          ? "text-[#62C5FF] drop-shadow-[0_0_6px_rgba(98,197,255,0.45)]"
                          : "text-[#9ED8F4] group-hover:text-[#D6F1FF]"
                      )}
                    />
                    {sidebarCollapsed ? null : t(labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div
        className={cn(
          "border-t border-sidebar-border px-3 py-3",
          sidebarCollapsed && "px-2"
        )}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={lock}
          title={t("access.lockNow")}
          className={cn(
            "mb-2 h-9 w-full border border-white/15 bg-white/5 text-xs text-sidebar-foreground hover:bg-white/12 hover:text-white",
            sidebarCollapsed ? "justify-center px-0" : "justify-start gap-2"
          )}
        >
          <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
          {sidebarCollapsed ? null : t("access.lockNow")}
        </Button>
        {sidebarCollapsed ? (
          <HardDrive
            className="mx-auto h-4 w-4 text-sidebar-foreground/60"
            aria-label={t("app.localSaved")}
          />
        ) : (
          <div className="local-ledger-seal flex items-start gap-2 text-[10px] leading-relaxed text-sidebar-foreground/80">
            <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>{t("app.localSaved")}</strong> ({STORAGE_ENGINE}).{" "}
              {t("app.localNote")}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
