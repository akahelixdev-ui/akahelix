import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MagnifyingGlass, X, ArrowRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface GenomicsSearchInputProps {
  initialQuery?: string | undefined;
  initialCategory?: "all" | "diseases" | "genes" | "variants" | undefined;
  placeholder?: string | undefined;
  autoFocus?: boolean | undefined;
  onSearch?: ((query: string, category: string) => void) | undefined;
  className?: string | undefined;
}

export function GenomicsSearchInput({
  initialQuery = "",
  initialCategory = "all",
  placeholder = "Search by gene symbol (e.g. HBB, CFTR), condition, ClinVar VCV, dbSNP rsID, or cDNA...",
  autoFocus = false,
  onSearch,
  className = "",
}: GenomicsSearchInputProps) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<"all" | "diseases" | "genes" | "variants">(initialCategory);
  const navigate = useNavigate();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = query.trim();
    if (!clean) return;

    if (onSearch) {
      onSearch(clean, category);
    } else {
      navigate({
        to: "/genomics/search",
        search: { q: clean, category } as any,
      });
    }
  };

  const handleQuickChip = (term: string, cat: "all" | "diseases" | "genes" | "variants") => {
    setQuery(term);
    setCategory(cat);
    if (onSearch) {
      onSearch(term, cat);
    } else {
      navigate({
        to: "/genomics/search",
        search: { q: term, category: cat } as any,
      });
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex flex-col sm:flex-row items-stretch border border-border bg-paper rounded-[3px] focus-within:border-foreground transition-colors">
          {/* Category Dropdown */}
          <div className="border-b sm:border-b-0 sm:border-r border-border bg-mist/60 px-3 py-2 flex items-center shrink-0">
            <label htmlFor="genomics-category" className="sr-only">Category</label>
            <select
              id="genomics-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="label-mono bg-transparent text-muted-foreground hover:text-foreground outline-none cursor-pointer text-[11px]"
            >
              <option value="all">ALL ENTITIES</option>
              <option value="genes">GENES</option>
              <option value="diseases">DISEASES</option>
              <option value="variants">VARIANTS</option>
            </select>
          </div>

          {/* Search Input Field */}
          <div className="flex-1 flex items-center px-4 py-3">
            <MagnifyingGlass size={16} className="text-muted-foreground mr-3 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              autoFocus={autoFocus}
              className="w-full font-mono text-[13px] placeholder:text-muted-foreground/60 text-foreground bg-transparent outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground p-1 mr-2"
                title="Clear query"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Minimalist Search Button */}
          <button
            type="submit"
            className="label-mono bg-foreground hover:bg-foreground/90 text-background px-6 py-3 sm:py-2 flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 text-[11px]"
          >
            <span>Query</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </form>

      {/* Recommended Quick Chips */}
      <div className="mt-3 flex items-center flex-wrap gap-2 text-[11px] font-mono text-muted-foreground">
        <span className="label-mono text-muted-foreground text-[10px]">Bench Targets:</span>
        <button
          type="button"
          onClick={() => handleQuickChip("HBB", "genes")}
          className="label-mono border border-border px-2 py-0.5 rounded-[2px] bg-mist/50 hover:border-foreground/40 hover:text-foreground transition-colors text-[10px]"
        >
          Gene: HBB
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip("CFTR", "genes")}
          className="label-mono border border-border px-2 py-0.5 rounded-[2px] bg-mist/50 hover:border-foreground/40 hover:text-foreground transition-colors text-[10px]"
        >
          Gene: CFTR
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip("Beta-thalassemia", "diseases")}
          className="label-mono border border-border px-2 py-0.5 rounded-[2px] bg-mist/50 hover:border-foreground/40 hover:text-foreground transition-colors text-[10px]"
        >
          Beta-thalassemia
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip("Sickle Cell", "diseases")}
          className="label-mono border border-border px-2 py-0.5 rounded-[2px] bg-mist/50 hover:border-foreground/40 hover:text-foreground transition-colors text-[10px]"
        >
          Sickle Cell
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip("c.1521_1523delCTT", "variants")}
          className="label-mono border border-border px-2 py-0.5 rounded-[2px] bg-mist/50 hover:border-foreground/40 hover:text-foreground transition-colors text-[10px]"
        >
          c.1521_1523delCTT
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip("VCV000015408", "variants")}
          className="label-mono border border-border px-2 py-0.5 rounded-[2px] bg-mist/50 hover:border-foreground/40 hover:text-foreground transition-colors text-[10px]"
        >
          VCV000015408
        </button>
      </div>
    </div>
  );
}
