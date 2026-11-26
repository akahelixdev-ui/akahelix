// ============================================================================
// AKAHELIX Human Phenotype Ontology (HPO) Client
// Integration with Jackson Laboratory / Monarch Initiative HPO REST API
// Provides standardized phenotypic definitions, synonyms, and cross-references.
// ============================================================================

export interface HpoTermRecord {
  hpoId: string;
  name: string;
  definition?: string | undefined;
  synonyms: string[];
  comment?: string | undefined;
  raw: any;
}

export class HpoClient {
  private baseUrl = "https://ontology.jax.org/api/hp/terms";
  private cache = new Map<string, { data: HpoTermRecord | null; expiresAt: number }>();
  private cacheTtlMs = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Fetch standardized HPO term by HPO ID (e.g. 'HP:0001903').
   */
  public async getTerm(hpoId: string): Promise<HpoTermRecord | null> {
    const cleanId = hpoId.trim().toUpperCase();
    if (!cleanId.startsWith("HP:")) {
      console.warn(`[HPO Warn] Invalid HPO ID format: ${hpoId}`);
      return null;
    }

    const cacheKey = `term:${cleanId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const url = `${this.baseUrl}/${cleanId}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        if (res.status === 404) {
          this.cache.set(cacheKey, { data: null, expiresAt: Date.now() + this.cacheTtlMs });
          return null;
        }
        throw new Error(`HPO API HTTP error ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      if (!json || !json.id) return null;

      const record: HpoTermRecord = {
        hpoId: json.id,
        name: json.name || "Unknown Phenotype",
        definition: json.definition || undefined,
        synonyms: Array.isArray(json.synonyms) ? json.synonyms : [],
        comment: json.comment || undefined,
        raw: json,
      };

      this.cache.set(cacheKey, { data: record, expiresAt: Date.now() + this.cacheTtlMs });
      return record;
    } catch (err: any) {
      console.warn(`[HPO Warn] Could not fetch term ${cleanId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Batch resolve multiple HPO IDs.
   */
  public async getTerms(hpoIds: string[]): Promise<Record<string, HpoTermRecord>> {
    const results: Record<string, HpoTermRecord> = {};
    for (const id of hpoIds) {
      const term = await this.getTerm(id);
      if (term) {
        results[term.hpoId] = term;
      }
    }
    return results;
  }
}

export const hpo = new HpoClient();
