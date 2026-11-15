import { Link } from "@tanstack/react-router";

import { nav } from "@/content/site";
import { cn } from "@/lib/utils";

const exonClass =
  "relative z-10 flex h-8 items-center justify-center whitespace-nowrap rounded-[7px] border border-foreground/20 bg-background px-3 text-[0.8125rem] font-medium text-foreground/80 transition-colors duration-300 hover:border-foreground/40 hover:bg-mist hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[status=active]:border-blue/35 data-[status=active]:bg-blue-soft data-[status=active]:text-foreground xl:px-3.5";

/** Narrow splice-site joint: a short backbone, a vertical tick, and a small exon cap. */
export function Splice() {
  return (
    <span className="flex items-center" aria-hidden>
      <span className="h-px w-1.5 bg-foreground/35 xl:w-2" />
      <span className="relative h-8 w-2.5">
        <span className="absolute left-1/2 top-1/2 h-[1.7rem] w-px -translate-x-1/2 -translate-y-1/2 bg-foreground/30" />
        <span className="absolute left-1/2 top-1/2 h-[1.35rem] w-2 -translate-x-1/2 -translate-y-1/2 rounded-[3px] border border-foreground/25 bg-background" />
      </span>
      <span className="h-px w-1.5 bg-foreground/35 xl:w-2" />
    </span>
  );
}

function Utr({ prime, dashed }: { prime: "5'" | "3'"; dashed?: boolean }) {
  return (
    <span className="relative flex items-center" aria-hidden>
      <span className="absolute bottom-[calc(50%+0.55rem)] left-0 whitespace-nowrap text-[0.625rem] leading-none tracking-[0.12em] text-muted-foreground">
        {prime} UTR
      </span>
      {dashed ? (
        <span className="w-6 border-t border-dashed border-foreground/35 xl:w-9" />
      ) : (
        <span className="h-px w-4 bg-foreground/35 xl:w-6" />
      )}
    </span>
  );
}

export function Exon({
  to,
  label,
  className,
}: {
  to: (typeof nav)[number]["to"];
  label: string;
  className?: string;
}) {
  return (
    <Link to={to} className={cn(exonClass, className)}>
      {label}
    </Link>
  );
}

/** Desktop gene map. Each exon is a page link; UTRs and splices are diagram chrome. */
export function GeneNav() {
  return (
    <nav className="flex items-center" aria-label="Main">
      <Utr prime="5'" />
      <ol className="flex items-center">
        {nav.map((item) => (
          <li key={item.to} className="flex items-center">
            <Splice />
            <Exon to={item.to} label={item.label} />
          </li>
        ))}
      </ol>
      <Splice />
      <Utr prime="3'" dashed />
    </nav>
  );
}

/** Same strand, turned vertical so the exons stay readable on a phone. */
export function GeneNavMobile() {
  return (
    <nav className="flex max-w-sm flex-col" aria-label="Mobile">
      <p className="text-[0.6875rem] tracking-[0.14em] text-muted-foreground">5' UTR</p>
      <span className="block h-4 w-px bg-foreground/30" aria-hidden />
      <ol className="relative border-l border-foreground/25">
        {nav.map((item) => (
          <li key={item.to} className="relative py-1.5 pl-5">
            <span className="absolute top-1/2 left-0 h-px w-5 bg-foreground/30" aria-hidden />
            <Exon to={item.to} label={item.label} className="h-11 w-full px-4" />
          </li>
        ))}
      </ol>
      <span className="block h-6 w-px border-l border-dashed border-foreground/35" aria-hidden />
      <p className="mt-2 text-[0.6875rem] tracking-[0.14em] text-muted-foreground">3' UTR</p>
    </nav>
  );
}
