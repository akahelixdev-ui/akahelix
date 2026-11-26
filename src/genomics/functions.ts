import { createServerFn } from "@tanstack/react-start";
import {
  getGenomicsOverviewStats,
  getGenomicsAnalytics,
  getDiseases,
  getDiseaseByIdOrSlug,
  getGenes,
  getGeneByIdOrSymbol,
  getVariants,
  getVariantByIdOrVcv,
  searchGenomics,
  getResearchPublications,
  type SearchCategory,
} from "./db/client";

export const getGenomicsOverviewFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return await getGenomicsOverviewStats();
  }
);

export const getGenomicsAnalyticsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return await getGenomicsAnalytics();
  }
);

export const getDiseasesFn = createServerFn({ method: "GET" })
  .validator((d: { page?: number | undefined; limit?: number | undefined; search?: string | undefined; inheritance?: string | undefined } | undefined) => d || {})
  .handler(async ({ data }) => {
    return await getDiseases(data);
  });

export const getDiseaseDetailFn = createServerFn({ method: "GET" })
  .validator((idOrSlug: string) => idOrSlug)
  .handler(async ({ data }) => {
    const disease = await getDiseaseByIdOrSlug(data);
    if (!disease) {
      throw new Response("Disease record not found", { status: 404 });
    }
    return disease;
  });

export const getGenesFn = createServerFn({ method: "GET" })
  .validator((d: { page?: number | undefined; limit?: number | undefined; search?: string | undefined; chromosome?: string | undefined } | undefined) => d || {})
  .handler(async ({ data }) => {
    return await getGenes(data);
  });

export const getGeneDetailFn = createServerFn({ method: "GET" })
  .validator((idOrSymbol: string) => idOrSymbol)
  .handler(async ({ data }) => {
    const gene = await getGeneByIdOrSymbol(data);
    if (!gene) {
      throw new Response("Gene record not found", { status: 404 });
    }
    return gene;
  });

export const getVariantsFn = createServerFn({ method: "GET" })
  .validator(
    (d: {
      page?: number | undefined;
      limit?: number | undefined;
      search?: string | undefined;
      significance?: string | undefined;
      chromosome?: string | undefined;
      geneSymbol?: string | undefined;
    } | undefined) => d || {}
  )
  .handler(async ({ data }) => {
    return await getVariants(data);
  });

export const getVariantDetailFn = createServerFn({ method: "GET" })
  .validator((idOrVcv: string) => idOrVcv)
  .handler(async ({ data }) => {
    const variant = await getVariantByIdOrVcv(data);
    if (!variant) {
      throw new Response("Variant record not found", { status: 404 });
    }
    return variant;
  });

export const searchGenomicsFn = createServerFn({ method: "GET" })
  .validator(
    (d: {
      q: string;
      category?: SearchCategory | undefined;
      significance?: string | undefined;
      chromosome?: string | undefined;
      inheritance?: string | undefined;
      evidenceLevel?: string | undefined;
      reviewStatus?: string | undefined;
      limit?: number | undefined;
    }) => d
  )
  .handler(async ({ data }) => {
    return await searchGenomics(data.q, {
      category: data.category,
      significance: data.significance,
      chromosome: data.chromosome,
      inheritance: data.inheritance,
      evidenceLevel: data.evidenceLevel,
      reviewStatus: data.reviewStatus,
      limit: data.limit,
    });
  });

export const getResearchPublicationsFn = createServerFn({ method: "GET" })
  .validator((d: { page?: number | undefined; limit?: number | undefined; search?: string | undefined } | undefined) => d || {})
  .handler(async ({ data }) => {
    return await getResearchPublications(data);
  });
