import { useCallback, useState } from "react";

export const REPORT_COLUMN_STORAGE_KEY =
  "smart-trader:reports:item-analysis-columns";

export const REPORT_COLUMN_KEYS = [
  "item",
  "entity",
  "category",
  "weight",
  "material",
  "type",
  "supplierPrice",
  "unitCost",
  "suggestedPrice",
  "margin",
  "createdAt",
] as const;

export type ReportColumnKey = (typeof REPORT_COLUMN_KEYS)[number];
export type ReportColumnVisibility = Record<ReportColumnKey, boolean>;

export const DEFAULT_REPORT_COLUMN_VISIBILITY: ReportColumnVisibility =
  Object.fromEntries(
    REPORT_COLUMN_KEYS.map(key => [key, true])
  ) as ReportColumnVisibility;

export const OPTIONAL_REPORT_COLUMN_KEYS = REPORT_COLUMN_KEYS.filter(
  key => key !== "item"
);

export function readReportColumnVisibility(): ReportColumnVisibility {
  if (typeof window === "undefined") return DEFAULT_REPORT_COLUMN_VISIBILITY;
  try {
    const raw = window.localStorage.getItem(REPORT_COLUMN_STORAGE_KEY);
    if (!raw) return DEFAULT_REPORT_COLUMN_VISIBILITY;
    const stored = JSON.parse(raw) as Partial<Record<ReportColumnKey, unknown>>;
    return Object.fromEntries(
      REPORT_COLUMN_KEYS.map(key => [
        key,
        key === "item" ? true : stored[key] !== false,
      ])
    ) as ReportColumnVisibility;
  } catch {
    return DEFAULT_REPORT_COLUMN_VISIBILITY;
  }
}

export function useReportColumnVisibility() {
  const [visibility, setVisibility] = useState<ReportColumnVisibility>(
    readReportColumnVisibility
  );

  const setColumnVisible = useCallback(
    (key: ReportColumnKey, visible: boolean) => {
      if (key === "item") return;
      setVisibility(current => {
        const next = { ...current, item: true, [key]: visible };
        window.localStorage.setItem(
          REPORT_COLUMN_STORAGE_KEY,
          JSON.stringify(next)
        );
        return next;
      });
    },
    []
  );

  return { visibility, setColumnVisible };
}
