/** @vitest-environment jsdom */

import "fake-indexeddb/auto";

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AccessProvider } from "@/contexts/AccessContext";
import { ActivityThemeProvider } from "@/contexts/ActivityThemeContext";
import { LoginBackgroundProvider } from "@/contexts/LoginBackgroundContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WorkspacePreferencesProvider } from "@/contexts/WorkspacePreferencesContext";
import { db, type CargoCostRunRow } from "@/lib/db";
import { closeIndexedDbConnection } from "@/lib/db/indexedDbRepository";
import { DB_NAME } from "@/lib/db/schema";
import Runs from "./Runs";

const runRow = (patch: Partial<CargoCostRunRow> = {}): CargoCostRunRow => ({
  id: "run-live",
  name: "حمولة حية",
  reference: "",
  operationType: "import",
  entityId: null,
  status: "draft",
  parentRunId: "",
  version: 1,
  currency: "SAR",
  marginRate: 0.2,
  customsBaseExtra: 0,
  routeTemplateId: "",
  originLocationId: "",
  unloadingLocationId: "",
  deliveryLocationId: "",
  incoterm: "FOB",
  transportMode: "بحري",
  clearanceOffice: "",
  invoiceValue: 0,
  customsBase: 0,
  customsAmount: 0,
  totalCost: 0,
  totalSuggestedRevenue: 0,
  notes: "",
  approvedAt: "",
  createdAt: "2026-09-20",
  updatedAt: "2026-09-20",
  ...patch,
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function renderRuns() {
  return render(
    <ThemeProvider defaultTheme="light">
      <LanguageProvider>
        <ActivityThemeProvider>
          <WorkspacePreferencesProvider>
            <LoginBackgroundProvider>
              <AccessProvider>
                <Runs />
              </AccessProvider>
            </LoginBackgroundProvider>
          </WorkspacePreferencesProvider>
        </ActivityThemeProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

describe("mounted cargo invalidation", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal(
      "ResizeObserver",
      MockResizeObserver as unknown as typeof ResizeObserver
    );
    await db.init();
    await db.saveCargoCostRun(
      runRow({ id: "run-delete", name: "حمولة محذوفة" })
    );
    await db.saveCargoCostRun(runRow({ id: "run-keep", name: "حمولة باقية" }));
  });

  afterEach(async () => {
    cleanup();
    closeIndexedDbConnection();
    await deleteDatabase();
  });

  it("removes a deleted run from the mounted list after invalidation", async () => {
    renderRuns();
    await screen.findByText("حمولة محذوفة");

    await act(async () => {
      await db.deleteCargoCostRun("run-delete");
    });

    await waitFor(() => {
      expect(screen.queryByText("حمولة محذوفة")).toBeNull();
      expect(screen.getByText("حمولة باقية")).toBeTruthy();
    });
  });
});
