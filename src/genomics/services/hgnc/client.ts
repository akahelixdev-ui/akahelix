// ============================================================================
// AKAHELIX HGNC REST API Client
// Standardized Human Gene Nomenclature Committee Integration
// Provides authoritative gene symbols, HGNC IDs, chromosomal coordinates, and cross-refs.
// ============================================================================

export interface HgncGeneRecord {
  hgncId: string;
  symbol: string;
  name: string;
  status: string;
  locusType: string;
  locusGroup: string;
  chromosome: string;
  entrezGeneId?: string | undefined;
  ensemblGeneId?: string | undefined;
  uniprotId?: string | undefined;
  omimId?: string | undefined;
  raw: any;
}

export class HgncClient {
  private baseUrl = "https://rest.genenames.org";
  private cache = new Map<string, { data: HgncGeneRecord | null; expiresAt: number }>();
  private cacheTtlMs = 60 * 60 * 1000; // 1 hour

  /**
   * Fetch approved HGNC gene record by official or previous symbol.
   */
  public async getGeneBySymbol(symbol: string): Promise<HgncGeneRecord | null> {
    const cleanSym = symbol.trim().toUpperCase();
    const cacheKey = `symbol:${cleanSym}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const url = `${this.baseUrl}/fetch/symbol/${cleanSym}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        if (res.status === 404) {
          this.cache.set(cacheKey, { data: null, expiresAt: Date.now() + this.cacheTtlMs });
          return null;
        }
        throw new Error(`HGNC fetch error (${res.status} ${res.statusText})`);
      }

      const json = await res.json();
      const docs = json?.response?.docs || [];
      if (docs.length === 0) {
        // Fallback: search aliases or prev symbols
        return await this.searchGene(cleanSym);
      }

      const doc = docs[0];
      const record = this.formatDoc(doc);
      this.cache.set(cacheKey, { data: record, expiresAt: Date.now() + this.cacheTtlMs });
      return record;
    } catch (err: any) {
      console.warn(`[HGNC Warn] Failed to fetch symbol ${cleanSym}:`, err.message);
      return null;
    }
  }

  /**
   * Search HGNC by query keyword, alias, or accession.
   */
  public async searchGene(query: string): Promise<HgncGeneRecord | null> {
    const cleanQ = query.trim();
    try {
      const url = `${this.baseUrl}/search/${encodeURIComponent(cleanQ)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) return null;
      const json = await res.json();
      const docs = json?.response?.docs || [];
      if (docs.length === 0) return null;

      // Prefer exact symbol match or first approved entry
      const match = docs.find((d: any) => d.symbol?.toUpperCase() === cleanQ.toUpperCase()) || docs[0];
      return this.formatDoc(match);
    } catch {
      return null;
    }
  }

  private formatDoc(doc: any): HgncGeneRecord {
    const uniprot = Array.isArray(doc.uniprot_ids) ? doc.uniprot_ids[0] : doc.uniprot_ids;
    const omim = Array.isArray(doc.omim_id) ? doc.omim_id[0] : doc.omim_id;

    return {
      hgncId: doc.hgnc_id,
      symbol: doc.symbol,
      name: doc.name,
      status: doc.status || "Approved",
      locusType: doc.locus_type || "gene with protein product",
      locusGroup: doc.locus_group || "protein-coding gene",
      chromosome: doc.location || doc.chromosome || "unknown",
      entrezGeneId: doc.entrez_id ? String(doc.entrez_id) : undefined,
      ensemblGeneId: doc.ensembl_gene_id || undefined,
      uniprotId: uniprot ? String(uniprot) : undefined,
      omimId: omim ? String(omim) : undefined,
      raw: doc,
    };
  }
}

export const hgnc = new HgncClient();
