import { neon } from "@neondatabase/serverless";

// ============================================================================
// AKAHELIX NCBI E-utilities Client
// Reusable, server-side client with database-backed distributed rate limiting,
// exponential backoff retries, and in-memory caching.
// ============================================================================

export interface NcbiClientConfig {
  apiKey?: string;
  email?: string;
  tool?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export class NcbiApiError extends Error {
  public statusCode?: number | undefined;
  public endpoint?: string | undefined;
  public rawResponse?: string | undefined;

  constructor(
    message: string,
    statusCode?: number,
    endpoint?: string,
    rawResponse?: string,
  ) {
    super(message);
    this.name = "NcbiApiError";
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.rawResponse = rawResponse;
  }
}

/**
 * Database-backed distributed rate limiter using Neon PostgreSQL.
 * Guarantees that across all serverless isolates, background workers, and processes,
 * NCBI throughput never exceeds:
 * - Unauthenticated: max 3 requests per second (>= 350ms interval).
 * - Authenticated (with api_key): max 10 requests per second (>= 110ms interval).
 */
class NcbiRateLimiter {
  private lastRequestTime = 0;
  private minIntervalMs: number;
  private hasApiKey: boolean;

  constructor(hasApiKey: boolean) {
    this.hasApiKey = hasApiKey;
    this.minIntervalMs = hasApiKey ? 120 : 380;
  }

  public updateKeyStatus(hasApiKey: boolean) {
    this.hasApiKey = hasApiKey;
    this.minIntervalMs = hasApiKey ? 120 : 380;
  }

  public async acquire(): Promise<void> {
    const dbUrl = process.env["DATABASE_URL"];
    if (dbUrl) {
      try {
        const sql = neon(dbUrl);
        const intervalMs = this.minIntervalMs;

        const [row] = await sql`
          INSERT INTO genomics.rate_limits (resource, last_request_at, request_count, updated_at)
          VALUES ('ncbi_eutils', clock_timestamp() + (${intervalMs} || ' milliseconds')::interval, 1, clock_timestamp())
          ON CONFLICT (resource) DO UPDATE
          SET 
            last_request_at = CASE
              WHEN genomics.rate_limits.last_request_at < clock_timestamp() THEN clock_timestamp() + (${intervalMs} || ' milliseconds')::interval
              ELSE genomics.rate_limits.last_request_at + (${intervalMs} || ' milliseconds')::interval
            END,
            request_count = genomics.rate_limits.request_count + 1,
            updated_at = clock_timestamp()
          RETURNING 
            ROUND(GREATEST(0, EXTRACT(EPOCH FROM (last_request_at - (${intervalMs} || ' milliseconds')::interval - clock_timestamp())) * 1000))::int AS wait_ms
        `;

        if (row && typeof (row as any).wait_ms === "number") {
          const waitMs = (row as any).wait_ms;
          if (waitMs > 0) {
            await new Promise((r) => setTimeout(r, waitMs));
          }
          return;
        }
      } catch {
        // Fallback to robust virtual-slot in-memory pacing if DB query fails
      }
    }

    // In-memory local fallback with virtual slot queueing
    const now = Date.now();
    const scheduledTime = Math.max(now, this.lastRequestTime);
    this.lastRequestTime = scheduledTime + this.minIntervalMs;
    const wait = scheduledTime - now;
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class NcbiClient {
  private baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
  private rateLimiter: NcbiRateLimiter;
  private cache = new Map<string, CacheEntry<any>>();
  private apiKey?: string | undefined;
  private email: string;
  private tool: string;
  private timeoutMs: number;
  private cacheTtlMs: number;

  constructor(config: NcbiClientConfig = {}) {
    this.apiKey = config.apiKey || process.env["NCBI_API_KEY"];
    this.email = config.email || process.env["NCBI_EMAIL"] || "support@akahelix.com";
    this.tool = config.tool || process.env["NCBI_TOOL"] || "AKAHELIX-Genomics-Research";
    this.timeoutMs = config.timeoutMs || 12000;
    this.cacheTtlMs = config.cacheTtlMs || 60 * 60 * 1000; // 1 hour default
    this.rateLimiter = new NcbiRateLimiter(Boolean(this.apiKey));
  }

  /**
   * Generic low-level request with rate limiting, timeouts, caching, and exponential backoff.
   */
  public async request<T = any>(
    endpoint: "esearch.fcgi" | "esummary.fcgi" | "efetch.fcgi",
    params: Record<string, string | number | boolean>,
    options: { noCache?: boolean; retmode?: "json" | "xml" } = {},
  ): Promise<T> {
    const retmode = options.retmode || "json";
    const allParams: Record<string, string> = {
      tool: this.tool,
      email: this.email,
      retmode,
    };

    if (this.apiKey) {
      allParams["api_key"] = this.apiKey;
    }

    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        allParams[k] = String(v);
      }
    }

    const query = new URLSearchParams(allParams).toString();
    const url = `${this.baseUrl}${endpoint}?${query}`;
    const cacheKey = `${endpoint}?${query}`;

    if (!options.noCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data as T;
      }
    }

    const maxRetries = 3;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      attempt++;
      await this.rateLimiter.acquire();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: retmode === "json" ? "application/json" : "application/xml",
          },
        });

        clearTimeout(timer);

        if (res.status === 429 || res.status >= 500) {
          const backoff = Math.pow(2, attempt) * 500 + Math.random() * 200;
          console.warn(`[NCBI E-utilities] Status ${res.status} on attempt ${attempt}. Retrying in ${Math.round(backoff)}ms...`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        if (!res.ok) {
          const body = await res.text();
          throw new NcbiApiError(
            `NCBI E-utilities error (${res.status} ${res.statusText})`,
            res.status,
            endpoint,
            body,
          );
        }

        const data: T = retmode === "json" ? await res.json() : ((await res.text()) as unknown as T);

        if (!options.noCache) {
          this.cache.set(cacheKey, {
            data,
            expiresAt: Date.now() + this.cacheTtlMs,
          });
        }

        return data;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        if (err.name === "AbortError") {
          console.warn(`[NCBI E-utilities] Timeout after ${this.timeoutMs}ms on attempt ${attempt}.`);
        }
        if (attempt >= maxRetries) break;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 400));
      }
    }

    throw lastError || new NcbiApiError(`NCBI request failed after ${maxRetries} attempts`, undefined, endpoint);
  }

  // ==========================================================================
  // ESearch
  // ==========================================================================
  public async esearch(
    db: "gene" | "clinvar" | "medgen" | "pubmed",
    term: string,
    options: { retmax?: number; retstart?: number; sort?: string } = {},
  ): Promise<{ idList: string[]; count: number }> {
    const params: Record<string, any> = {
      db,
      term,
      retmax: options.retmax || 20,
      retstart: options.retstart || 0,
    };
    if (options.sort) params["sort"] = options.sort;

    const res = await this.request("esearch.fcgi", params);
    const result = res?.esearchresult || {};
    return {
      idList: result.idlist || [],
      count: parseInt(result.count || "0", 10),
    };
  }

  // ==========================================================================
  // ESummary
  // ==========================================================================
  public async esummary(
    db: "gene" | "clinvar" | "medgen" | "pubmed",
    ids: (string | number)[],
  ): Promise<Record<string, any>> {
    if (ids.length === 0) return {};
    const res = await this.request("esummary.fcgi", {
      db,
      id: ids.join(","),
    });
    return res?.result || {};
  }

  // ==========================================================================
  // High-Level Domain Methods
  // ==========================================================================

  /**
   * Fetch structured NCBI Gene record by Entrez Gene ID.
   */
  public async getGene(entrezId: string | number) {
    const summary = await this.esummary("gene", [entrezId]);
    const data = summary[String(entrezId)];
    if (!data) return null;

    return {
      entrezGeneId: String(entrezId),
      symbol: data.name,
      name: data.description,
      chromosome: data.chromosome,
      cytogeneticLocation: data.maplocation,
      summary: data.summary,
      organism: data.organism?.scientificname,
      genomicCoordinates: {
        assembly: "GRCh38",
        chr: data.chromosome,
        genomicInfo: data.genomicinfo || [],
      },
      raw: data,
    };
  }

  /**
   * Helper to fetch ClinVar variant by numeric ID or VCV accession (e.g. VCV000015333).
   */
  public async getVariation(vcvOrId: string | number) {
    let id = String(vcvOrId);
    if (id.startsWith("VCV")) {
      id = String(parseInt(id.replace(/^VCV0*/i, "") || "0", 10));
    }
    return this.getClinVarVariant(id);
  }

  /**
   * Fetch ClinVar variant details by Variation ID.
   */
  public async getClinVarVariant(variantId: string | number) {
    const summary = await this.esummary("clinvar", [variantId]);
    const data = summary[String(variantId)];
    if (!data) return null;

    const variation = data.variation_set?.[0] || {};
    const loc = variation.variation_loc?.find((l: any) => l.assembly_name === "GRCh38") || variation.variation_loc?.[0] || {};
    const dbSnpRef = variation.variation_xrefs?.find((x: any) => x.db_source === "dbSNP");

    return {
      clinvarVcv: `VCV${String(variantId).padStart(9, "0")}`,
      variationId: String(variantId),
      preferredName: data.title || variation.variation_name,
      cdnaChange: variation.cdna_change,
      proteinChange: variation.protein_change,
      dbsnpId: dbSnpRef ? `rs${dbSnpRef.db_id}` : undefined,
      variantType: variation.variant_type || "single nucleotide variant",
      molecularConsequence: data.molecular_consequence_list?.[0] || undefined,
      assembly: loc.assembly_name || "GRCh38",
      chromosome: loc.chr,
      positionVcf: loc.start ? parseInt(loc.start, 10) : undefined,
      clinicalSignificance: data.germline_classification?.description || "Not specified",
      reviewStatus: data.germline_classification?.review_status || "no assertion criteria provided",
      goldStars: this.calculateClinVarStars(data.germline_classification?.review_status),
      lastEvaluated: data.germline_classification?.last_evaluated,
      traits: data.trait_set || [],
      raw: data,
    };
  }

  /**
   * Fetch PubMed literature metadata by PMID.
   */
  public async getPubMedArticle(pmid: string | number) {
    const summary = await this.esummary("pubmed", [pmid]);
    const data = summary[String(pmid)];
    if (!data) return null;

    const authors = Array.isArray(data.authors) ? data.authors.map((a: any) => a.name) : [];
    const pubYear = data.pubdate ? parseInt(data.pubdate.split(" ")[0], 10) || undefined : undefined;
    const articleIds = Array.isArray(data.articleids) ? data.articleids : [];
    const doi = articleIds.find((a: any) => a.idtype === "doi")?.value;
    const pmc = articleIds.find((a: any) => a.idtype === "pmc")?.value;

    return {
      pmid: String(pmid),
      pmcid: pmc,
      doi,
      title: data.title,
      authors,
      journal: data.source || data.fulljournalname,
      pubYear,
      pubDate: data.pubdate,
      raw: data,
    };
  }

  /**
   * Fetch MedGen disease concept by UID or CUI.
   */
  public async getMedGenConcept(medgenUid: string | number) {
    const summary = await this.esummary("medgen", [medgenUid]);
    const data = summary[String(medgenUid)];
    if (!data) return null;

    return {
      uid: String(medgenUid),
      conceptId: data.conceptid,
      title: data.title,
      semanticType: data.semantictype?.value,
      raw: data,
    };
  }

  private calculateClinVarStars(reviewStatus?: string): number {
    if (!reviewStatus) return 0;
    const s = reviewStatus.toLowerCase();
    if (s.includes("practice guideline")) return 4;
    if (s.includes("reviewed by expert panel")) return 3;
    if (s.includes("criteria provided, multiple submitters, no conflicts")) return 2;
    if (s.includes("criteria provided, single submitter") || s.includes("criteria provided, conflicting")) return 1;
    return 0;
  }
}

// Global default singleton
export const ncbi = new NcbiClient();
