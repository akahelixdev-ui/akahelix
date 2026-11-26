import React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string | undefined;
}

export function GenomicsBreadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string | undefined;
}) {
  return (
    <nav
      aria-label="Genomics Navigation Breadcrumbs"
      className={cn(
        "flex items-center space-x-2 label-mono text-muted-foreground py-4 overflow-x-auto text-[11px]",
        className
      )}
    >
      <Link
        to="/"
        className="hover:text-foreground transition-colors"
        title="AKAHELIX Home"
      >
        Home
      </Link>
      <span className="text-border">/</span>
      <Link
        to="/genomics"
        className="hover:text-foreground transition-colors"
      >
        Genomics
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <span className="text-border">/</span>
            {isLast || !item.href ? (
              <span className="text-foreground font-medium truncate max-w-[280px]">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="hover:text-foreground transition-colors truncate max-w-[220px]"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
