/** تخصيص لوحة العمل محلياً: تخطيطات محفوظة، ترتيب الوحدات وإظهارها، بلا أثر على سجلات العمل أو النسخ الاحتياطية. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DASHBOARD_WIDGETS,
  defaultPrefs,
  normalizeStored,
  readStoredPrefs,
  writeStoredPrefs,
  type DashboardWidgetId,
  type StoredWorkspacePreferences,
  type WorkspaceLayout,
} from "@/lib/uiPreferencesStore";
import { useLanguage } from "./LanguageContext";

export { DASHBOARD_WIDGETS };
export type { DashboardWidgetId, WorkspaceLayout };

type WorkspacePreferencesValue = {
  ready: boolean;
  layouts: WorkspaceLayout[];
  activeLayout: WorkspaceLayout;
  visibleWidgets: DashboardWidgetId[];
  toggleWidget: (widget: DashboardWidgetId) => void;
  moveWidget: (widget: DashboardWidgetId, direction: -1 | 1) => void;
  resetDashboard: () => void;
  selectLayout: (id: string) => void;
  saveLayout: (name: string) => boolean;
  duplicateLayout: () => void;
  deleteLayout: (id: string) => boolean;
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
};

const SIDEBAR_COLLAPSED_KEY = "smart-trader:sidebar-collapsed";
const WorkspacePreferencesContext =
  createContext<WorkspacePreferencesValue | null>(null);

export function WorkspacePreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preferences, setPreferences] =
    useState<StoredWorkspacePreferences>(defaultPrefs);
  const [ready, setReady] = useState(false);
  const { t } = useLanguage();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  });
  const toggleSidebarCollapsed = useCallback(
    () =>
      setSidebarCollapsed(prev => {
        const next = !prev;
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
        return next;
      }),
    []
  );

  useEffect(() => {
    void readStoredPrefs()
      .then(saved => setPreferences(normalizeStored(saved)))
      .catch(() => setPreferences(defaultPrefs()))
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: StoredWorkspacePreferences) => {
    setPreferences(next);
    void writeStoredPrefs(next);
  }, []);

  const activeLayout =
    preferences.layouts.find(item => item.id === preferences.activeLayoutId) ??
    preferences.layouts[0];

  const updateActive = useCallback(
    (update: (layout: WorkspaceLayout) => WorkspaceLayout) => {
      persist({
        ...preferences,
        layouts: preferences.layouts.map(item =>
          item.id === activeLayout.id ? update(item) : item
        ),
      });
    },
    [activeLayout.id, persist, preferences]
  );

  const toggleWidget = useCallback(
    (widget: DashboardWidgetId) => {
      const visible = activeLayout.layout.filter(
        item => !activeLayout.hidden.includes(item)
      );
      if (!activeLayout.hidden.includes(widget) && visible.length === 1) return;
      updateActive(layout => ({
        ...layout,
        hidden: layout.hidden.includes(widget)
          ? layout.hidden.filter(item => item !== widget)
          : [...layout.hidden, widget],
      }));
    },
    [activeLayout, updateActive]
  );

  const moveWidget = useCallback(
    (widget: DashboardWidgetId, direction: -1 | 1) => {
      const from = activeLayout.layout.indexOf(widget);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= activeLayout.layout.length) return;
      updateActive(item => {
        const layout = [...item.layout];
        [layout[from], layout[to]] = [layout[to], layout[from]];
        return { ...item, layout };
      });
    },
    [activeLayout.layout, updateActive]
  );

  const resetDashboard = useCallback(
    () =>
      updateActive(layout => ({
        ...layout,
        layout: [...DASHBOARD_WIDGETS],
        hidden: [],
      })),
    [updateActive]
  );

  const selectLayout = useCallback(
    (id: string) => {
      if (preferences.layouts.some(item => item.id === id)) {
        persist({ ...preferences, activeLayoutId: id });
      }
    },
    [persist, preferences]
  );

  const saveLayout = useCallback(
    (name: string) => {
      const label = name.trim();
      if (!label || preferences.layouts.some(item => item.name === label))
        return false;
      const id = `layout-${Date.now()}`;
      persist({
        ...preferences,
        activeLayoutId: id,
        layouts: [...preferences.layouts, { ...activeLayout, id, name: label }],
      });
      return true;
    },
    [activeLayout, persist, preferences]
  );

  const duplicateLayout = useCallback(() => {
    const id = `layout-${Date.now()}`;
    persist({
      ...preferences,
      activeLayoutId: id,
      layouts: [
        ...preferences.layouts,
        {
          ...activeLayout,
          id,
          name: `${activeLayout.name} · ${t("common.duplicateWord")}`,
        },
      ],
    });
  }, [activeLayout, persist, preferences, t]);

  const deleteLayout = useCallback(
    (id: string) => {
      if (preferences.layouts.length === 1) return false;
      const layouts = preferences.layouts.filter(item => item.id !== id);
      persist({
        ...preferences,
        layouts,
        activeLayoutId:
          preferences.activeLayoutId === id
            ? layouts[0].id
            : preferences.activeLayoutId,
      });
      return true;
    },
    [persist, preferences]
  );

  const visibleWidgets = useMemo(
    () =>
      activeLayout.layout.filter(item => !activeLayout.hidden.includes(item)),
    [activeLayout]
  );

  const value = useMemo(
    () => ({
      ready,
      layouts: preferences.layouts,
      activeLayout,
      visibleWidgets,
      toggleWidget,
      moveWidget,
      resetDashboard,
      selectLayout,
      saveLayout,
      duplicateLayout,
      deleteLayout,
      sidebarCollapsed,
      toggleSidebarCollapsed,
    }),
    [
      activeLayout,
      deleteLayout,
      duplicateLayout,
      moveWidget,
      preferences.layouts,
      ready,
      resetDashboard,
      saveLayout,
      selectLayout,
      sidebarCollapsed,
      toggleSidebarCollapsed,
      toggleWidget,
      visibleWidgets,
    ]
  );

  return (
    <WorkspacePreferencesContext.Provider value={value}>
      {children}
    </WorkspacePreferencesContext.Provider>
  );
}

export function useWorkspacePreferences() {
  const context = useContext(WorkspacePreferencesContext);
  if (!context) {
    throw new Error(
      "useWorkspacePreferences must be used inside WorkspacePreferencesProvider"
    );
  }
  return context;
}
