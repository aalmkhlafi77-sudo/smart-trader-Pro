/**
 * مخزن تفضيلات الواجهة — قاعدة IndexedDB مستقلة عن بيانات العمل (لا تدخل النسخ الاحتياطية).
 * يوفّر الأنواع، الوضع الافتراضي، التطبيع، وقراءة/كتابة سجل التفضيلات.
 */
export const DASHBOARD_WIDGETS = [
  "hero",
  "summary",
  "kpis",
  "entries",
  "recent",
  "calendar",
] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number];
export type WorkspaceLayout = {
  id: string;
  name: string;
  layout: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
};
export type StoredWorkspacePreferences = {
  id: "workspace-dashboard";
  activeLayoutId: string;
  layouts: WorkspaceLayout[];
};

const DB_NAME = "smart-trader-ui-preferences";
const STORE_NAME = "preferences";
const KEY = "workspace-dashboard";

export const baseLayout = (): WorkspaceLayout => ({
  id: "default",
  name: "الدفتر الأساسي",
  layout: [...DASHBOARD_WIDGETS],
  hidden: [],
});

export const defaultPrefs = (): StoredWorkspacePreferences => ({
  id: KEY,
  activeLayoutId: "default",
  layouts: [baseLayout()],
});

function normalizeLayout(
  value: Partial<WorkspaceLayout> | undefined,
  fallbackName: string
): WorkspaceLayout {
  const raw = Array.isArray(value?.layout)
    ? value.layout.filter((item): item is DashboardWidgetId =>
        DASHBOARD_WIDGETS.includes(item as DashboardWidgetId)
      )
    : [];
  return {
    id:
      typeof value?.id === "string" && value.id
        ? value.id
        : `layout-${Date.now()}`,
    name:
      typeof value?.name === "string" && value.name.trim()
        ? value.name.trim()
        : fallbackName,
    layout: [...raw, ...DASHBOARD_WIDGETS.filter(item => !raw.includes(item))],
    hidden: Array.isArray(value?.hidden)
      ? value.hidden.filter((item): item is DashboardWidgetId =>
          DASHBOARD_WIDGETS.includes(item as DashboardWidgetId)
        )
      : [],
  };
}

export function normalizeStored(
  value: Partial<StoredWorkspacePreferences> | null
): StoredWorkspacePreferences {
  const legacy = value
    ? (value as unknown as Partial<WorkspaceLayout>)
    : undefined;
  const layouts =
    Array.isArray(value?.layouts) && value.layouts.length
      ? value.layouts.map((item, index) =>
          normalizeLayout(item, `تخطيط ${index + 1}`)
        )
      : [normalizeLayout(legacy, "الدفتر الأساسي")];
  const activeLayoutId = layouts.some(item => item.id === value?.activeLayoutId)
    ? String(value?.activeLayoutId)
    : layouts[0].id;
  return { id: KEY, activeLayoutId, layouts };
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readStoredPrefs(): Promise<StoredWorkspacePreferences | null> {
  const db = await openDb();
  return new Promise<StoredWorkspacePreferences | null>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(KEY);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function writeStoredPrefs(
  value: StoredWorkspacePreferences
): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
