/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AccessProvider } from "@/contexts/AccessContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { WorkspacePreferencesProvider } from "@/contexts/WorkspacePreferencesContext";
import AppLayout from "./AppLayout";

function renderAppLayout() {
  return render(
    <LanguageProvider>
      <WorkspacePreferencesProvider>
        <AccessProvider>
          <AppLayout title="اختبار">
            <div />
          </AppLayout>
        </AccessProvider>
      </WorkspacePreferencesProvider>
    </LanguageProvider>
  );
}

describe("بصمة المصمم في تذييل التطبيق", () => {
  afterEach(() => cleanup());

  it("يربط عبارة التصميم بصفحة المصمم ويفتحها في تبويب مستقل", () => {
    renderAppLayout();

    const link = screen.getByRole("link", {
      name: /تصميم Abdullah Almkhlafi/,
    });

    expect(link.getAttribute("href")).toBe(
      "https://almkhlafi.carpetbazar.org/"
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("يعرض النقطة الخضراء بعلامة الوميض", () => {
    const { container } = renderAppLayout();
    const dot = container.querySelector(".designer-credit__dot");

    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
    expect(dot?.classList.contains("designer-credit__dot--pulse")).toBe(true);
  });
});
