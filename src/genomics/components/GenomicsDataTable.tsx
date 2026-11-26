import React from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right" | undefined;
  className?: string | undefined;
  render: (item: T, index: number) => React.ReactNode;
}

interface GenomicsDataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange?: ((newPage: number) => void) | undefined;
  isLoading?: boolean | undefined;
  emptyMessage?: string | undefined;
  keyExtractor: (item: T) => string;
}

export function GenomicsDataTable<T>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading = false,
  emptyMessage = "No clinical or genomic records found matching the specified parameters.",
  keyExtractor,
}: GenomicsDataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(total, page * pageSize);

  return (
    <div className="w-full bg-paper border border-border rounded-[3px] overflow-hidden">
      {/* Table responsive container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono border-collapse text-xs">
          <thead>
            <tr className="bg-mist/70 border-b border-border text-muted-foreground label-mono text-[10px]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "py-3.5 px-4 font-normal",
                    col.align === "center"
                      ? "text-center"
                      : col.align === "right"
                      ? "text-right"
                      : "text-left",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className="py-4 px-4">
                      <div className="h-3 bg-mist rounded-[2px] w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-16 px-4 text-center text-muted-foreground"
                >
                  <p className="label-mono text-muted-foreground mb-1">0 RECORDS FOUND</p>
                  <p className="text-xs font-sans max-w-md mx-auto">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr
                  key={keyExtractor(item)}
                  className="hover:bg-mist/40 transition-colors group"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "py-3.5 px-4 align-top text-foreground",
                        col.align === "center"
                          ? "text-center"
                          : col.align === "right"
                          ? "text-right"
                          : "text-left",
                        col.className
                      )}
                    >
                      {col.render(item, idx)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Status Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-mist/30 border-t border-border label-mono text-muted-foreground gap-2">
        <div>
          Showing <span className="text-foreground font-medium">{startItem}</span> -{" "}
          <span className="text-foreground font-medium">{endItem}</span> of{" "}
          <span className="text-foreground font-medium">{total}</span> records
        </div>

        {totalPages > 1 && onPageChange && (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] border border-border bg-paper hover:border-foreground/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-foreground cursor-pointer"
            >
              <CaretLeft size={11} />
              <span>PREV</span>
            </button>
            <span className="text-muted-foreground px-1">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] border border-border bg-paper hover:border-foreground/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-foreground cursor-pointer"
            >
              <span>NEXT</span>
              <CaretRight size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
