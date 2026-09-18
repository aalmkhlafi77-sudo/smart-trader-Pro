/**
 * نظام الأنماط — الجداول: DataTable generique فوق طبقة لمس أفقية، وStatusPill بحالات دلالية.
 * لا نص داخل الملفات؛ الترويسة والخلية تصلان عبر props.
 */
import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headClassName?: string;
};

export function DataTable<T>({
  columns,
  rows,
  keyOf,
  onRowClick,
  dense,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "touch-scroll-x rounded-md border border-border bg-card",
        className
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="bg-[var(--secondary)] hover:bg-[var(--secondary)]">
            {columns.map(column => (
              <TableHead
                key={column.key}
                className={cn(
                  "text-[11px] font-bold whitespace-nowrap text-[var(--ink)]",
                  column.headClassName
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow
              key={keyOf(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer")}
            >
              {columns.map(column => (
                <TableCell
                  key={column.key}
                  className={cn(
                    dense ? "py-1.5 text-[11px]" : "text-xs",
                    column.className
                  )}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export type PillTone = "neutral" | "success" | "warning" | "danger" | "info";

const PILL_TONES: Record<PillTone, string> = {
  neutral:
    "border-[var(--field-border)] bg-[var(--field-surface)] text-[var(--guidance)]",
  success:
    "border-[color-mix(in_oklab,var(--port-green)_42%,transparent)] bg-[var(--port-green-soft)] text-[var(--port-green)]",
  warning:
    "border-[color-mix(in_oklab,var(--warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--warning)_14%,white)] text-[color-mix(in_oklab,var(--warning)_72%,var(--ink))]",
  danger:
    "border-[color-mix(in_oklab,var(--danger)_45%,transparent)] bg-[color-mix(in_oklab,var(--danger)_12%,white)] text-[var(--danger)]",
  info: "border-[color-mix(in_oklab,var(--field-focus-border)_45%,transparent)] bg-[var(--field-focus)] text-[var(--field-focus-border)]",
};

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap",
        PILL_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
