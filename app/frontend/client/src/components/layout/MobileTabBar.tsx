/** الشريط السفلي للهاتف: 4 وجهات أساسية + «المزيد» مجمّعًا في لوحة سفلية + قفل. */
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAccess } from "@/contexts/AccessContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LockKeyhole, Menu } from "lucide-react";
import { Link } from "wouter";
import { MOBILE_MORE, MOBILE_PRIMARY } from "./navGroups";

export default function MobileTabBar({ location }: { location: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { direction, t } = useLanguage();
  const { lock } = useAccess();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[var(--ink)] lg:hidden">
      <div className="grid grid-cols-5">
        {MOBILE_PRIMARY.map(({ href, labelKey, icon: Icon }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors duration-150",
                active ? "text-white" : "text-white/60"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="truncate px-0.5">{t(labelKey)}</span>
              {active ? (
                <span className="h-0.5 w-6 rounded bg-[var(--port-green)]" />
              ) : null}
            </Link>
          );
        })}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto flex flex-col items-center gap-1 rounded-none py-2.5 text-[10px] text-white/60 hover:bg-transparent hover:text-white"
            >
              <Menu className="h-[18px] w-[18px]" />
              <span>{t("app.more")}</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            dir={direction}
            className="rounded-t-[1.25rem] border-t-[3px] border-t-[var(--port-green)] px-4 pt-3 pb-7"
          >
            <SheetHeader
              className={cn(
                "mb-4",
                direction === "rtl" ? "text-right" : "text-left"
              )}
            >
              <SheetTitle className="font-display text-[var(--ink)]">
                {t("app.moreTools")}
              </SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2">
              {MOBILE_MORE.map(({ href, labelKey, icon: Icon }) => {
                const active = location === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded border px-3 py-3 text-sm transition-colors",
                      active
                        ? "border-[var(--port-green)] bg-[var(--port-green-soft)] font-semibold text-[var(--ink)]"
                        : "border-border bg-card text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 text-[var(--ink)]" />
                    {t(labelKey)}
                  </Link>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMoreOpen(false);
                lock();
              }}
              className="mt-3 w-full border-[var(--ink)]/20 text-[var(--ink)]"
            >
              <LockKeyhole className="h-4 w-4" />
              {t("access.lockNow")}
            </Button>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
