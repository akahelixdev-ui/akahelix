import { List, X } from "@phosphor-icons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useState } from "react";

import { company } from "@/content/site";
import { cn } from "@/lib/utils";

import { Cta } from "./Cta";
import { GeneNav, GeneNavMobile } from "./GeneNav";
import { EASE } from "./motion";
import { Wordmark } from "./Wordmark";

const linkClass =
  "text-[0.8125rem] text-foreground/75 transition-colors duration-300 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring data-[status=active]:text-blue";

export function Header() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useMotionValueEvent(scrollY, "change", (v) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(v > 24);
    setHidden(v > 320 && v > prev && !open);
  });

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <motion.header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b bg-background transition-colors duration-500",
          scrolled && !open ? "border-border" : "border-transparent",
        )}
        animate={{ y: hidden ? "-100%" : "0%" }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="container-x relative flex h-14 items-center md:h-16">
          <a
            href="https://akahelix.com"
            className="relative z-10 shrink-0 text-foreground transition-opacity hover:opacity-85"
            aria-label="AKAHELIX home"
          >
            <Wordmark />
          </a>

          <div className="hidden min-w-0 flex-1 justify-center lg:flex">
            <GeneNav />
          </div>

          <div className="relative z-10 ml-auto hidden items-center gap-6 lg:flex">
            <Link to="/sign-in" className={linkClass}>
              Sign in
            </Link>
            <Cta
              to="/contact"
              variant="outline"
              size="md"
              magnetic={false}
              className="h-10 pl-5 pr-1 text-[0.8125rem] [&>span:last-child]:size-8"
            >
              Contact us
            </Cta>
          </div>

          <button
            type="button"
            className="relative z-10 ml-auto flex size-10 items-center justify-center rounded-full border border-foreground/15 text-foreground transition-colors lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-4" /> : <List className="size-4" />}
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-background px-5 pb-8 pt-24 lg:hidden"
            initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          >
            <GeneNavMobile />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mt-10 flex flex-col gap-6"
            >
              <Link to="/sign-in" className={cn(linkClass, "w-fit")}>
                Sign in
              </Link>
              <Cta to="/contact" variant="outline" size="md" magnetic={false} className="h-10 w-fit pl-5 pr-1 text-[0.8125rem] [&>span:last-child]:size-8">
                Contact us
              </Cta>
              <div className="label-mono flex justify-between gap-4 text-muted-foreground">
                <span>{company.city}</span>
                <a href={`mailto:${company.email}`}>{company.email}</a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
