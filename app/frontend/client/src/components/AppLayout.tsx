/**
 * التخطيط العام — اتجاه التصميم: "دفتر الميناء"
 * M1: قشرة موحّدة تتركّب من شريط جانبي مجمّع (5 مجموعات) قابل للطي،
 * ترويسة بمسار تنقّل، وشريط سفلي للهاتف. الشاشات القديمة تعمل داخلها دون تغيير.
 */
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import SidebarNav from "./layout/SidebarNav";
import HeaderBar from "./layout/HeaderBar";
import MobileTabBar from "./layout/MobileTabBar";

export default function AppLayout({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const [location] = useLocation();
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar
          title={title}
          subtitle={subtitle}
          action={action}
          location={location}
        />
        <main className="flex-1 px-4 py-5 pb-24 lg:px-8 lg:py-7 lg:pb-10">
          {children}
        </main>
        <footer className="px-4 pt-2 pb-24 lg:px-8 lg:pb-6">
          <div className="flex items-center justify-center gap-2 border-t border-border pt-4">
            <span
              aria-hidden="true"
              className="designer-credit__dot designer-credit__dot--pulse h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--port-green)]"
            />
            <p className="flex max-w-full flex-wrap items-center justify-center gap-x-1 text-center text-[11px] tracking-wide text-muted-foreground">
              <a
                href="https://almkhlafi.carpetbazar.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 max-w-full flex-wrap items-center justify-center gap-x-1 rounded-sm px-1 py-1 font-semibold text-[var(--ink)] transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--port-green)]"
              >
                {t("app.design")}{" "}
                <span dir="ltr">Abdullah Almkhlafi</span>
              </a>{" "}
              <span dir="ltr">2026</span>
            </p>
          </div>
        </footer>
        <MobileTabBar location={location} />
      </div>
    </div>
  );
}
