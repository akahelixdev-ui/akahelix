import React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { MagnifyingGlass, ArrowUpRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function GenomicsHeader() {
  const router = useRouterState();
  const pathname = router.location.pathname;

  const navLinks = [
    { href: "/genomics", label: "Overview", index: "01", exact: true },
    { href: "/genomics/diseases", label: "Diseases", index: "02" },
    { href: "/genomics/genes", label: "Genes", index: "03" },
    { href: "/genomics/variants", label: "Variants", index: "04" },
    { href: "/genomics/search", label: "Query", index: "05" },
    { href: "/genomics/research", label: "Evidence", index: "06" },
  ];

  return (
    <div className="sticky top-14 md:top-16 z-30 border-b border-border bg-background/95 backdrop-blur-xs transition-colors">
      <div className="container-x">
        <div className="flex h-11 items-center justify-between gap-4 overflow-x-auto scrollbar-none">
          {/* Sub-navigation tabs */}
          <nav className="flex items-center space-x-6 shrink-0 h-full">
            {navLinks.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "label-mono relative flex h-full items-center gap-1.5 transition-colors duration-200",
                    isActive
                      ? "text-blue font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-[10px] opacity-60">{item.index}</span>
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Quick info / query shortcut */}
          <div className="hidden sm:flex items-center gap-4 text-muted-foreground text-xs font-mono shrink-0">
            <span className="label-mono text-muted-foreground hidden md:inline">
              REF: GRCh38.p14 · NCBI / ClinVar
            </span>
            <Link
              to="/genomics/search"
              className="inline-flex items-center gap-1.5 label-mono border border-border px-2.5 py-1 rounded-[2px] hover:border-foreground/40 hover:text-foreground transition-colors"
            >
              <MagnifyingGlass size={12} />
              <span>Query [ / ]</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
