// ============================================================================
// Model Registry Service — High-Performance In-Memory Catalog Caching
// Single database query with TTL caching (5-15 mins) to prevent loop queries
// ============================================================================

import { PrismaClient } from '@prisma/client';

export interface CandidateModelRecord {
  id: string;
  modelKey: string;
  displayName: string;
  providerId: string;
  providerName: string;
  providerKey: string;
  adapterType: string;
  baseUrl: string | null;
  providerModelId: string;
  family: string;
  version: string;
  capabilities: string[];
  contextWindow: number;
  maxOutputTokens: number | null;
  enabled: boolean;
  available: boolean;
  providerEnabled: boolean;
  isMockModel: boolean;
  pricing: {
    inputPricePerMillionTokens: number | null;
    outputPricePerMillionTokens: number | null;
  };
  performance: {
    qualityScore?: number;
    benchmarkScore?: number;
    speedTokensPerSec?: number;
    reasoningScore?: number;
    codingScore?: number;
    mathScore?: number;
    contextRetention?: number;
  };
  environmentalMetrics?: {
    energyPerTokenWh?: number;
    carbonGramsPerKwh?: number;
    prefillEnergyWh?: number;
    decodeEnergyWh?: number;
  };
}

export class ModelRegistryCache {
  private static cachedModels: CandidateModelRecord[] | null = null;
  private static lastFetchedAt: number = 0;
  private static TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

  /**
   * Retrieves all enabled active models in a single query, cached in memory.
   */
  static async getActiveModels(
    prisma: PrismaClient,
    forceRefresh: boolean = false,
  ): Promise<CandidateModelRecord[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedModels && now - this.lastFetchedAt < this.TTL_MS) {
      return this.cachedModels;
    }

    const models = await prisma.aIModel.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: { provider: true },
      orderBy: [{ provider: { name: 'asc' } }, { displayName: 'asc' }],
    });

    const parsed: CandidateModelRecord[] = models.map((m) => {
      let capabilities: string[] = [];
      try {
        capabilities = JSON.parse(m.capabilitiesJson);
      } catch {}

      let pricing: any = {};
      try {
        pricing = JSON.parse(m.pricingJson);
      } catch {}

      let performance: any = {};
      try {
        performance = JSON.parse(m.performanceJson || '{}');
      } catch {}

      let environmentalMetrics: any = {};
      try {
        environmentalMetrics = JSON.parse(m.environmentalMetricsJson || '{}');
      } catch {}

      return {
        id: m.id,
        modelKey: m.modelKey,
        displayName: m.displayName,
        providerId: m.providerId,
        providerName: m.provider.name,
        providerKey: m.provider.providerKey,
        adapterType: m.provider.adapterType,
        baseUrl: m.provider.baseUrl,
        providerModelId: m.providerModelId || m.modelKey,
        family: m.family || 'general',
        version: m.version || '1.0',
        capabilities,
        contextWindow: m.contextWindow,
        maxOutputTokens: m.maxOutputTokens,
        enabled: m.enabled,
        available: m.available,
        providerEnabled: m.provider.enabled,
        isMockModel: m.isMockModel,
        pricing: {
          inputPricePerMillionTokens: pricing.inputPricePerMillionTokens ?? 0.15,
          outputPricePerMillionTokens: pricing.outputPricePerMillionTokens ?? 0.6,
        },
        performance,
        environmentalMetrics,
      };
    });

    this.cachedModels = parsed;
    this.lastFetchedAt = now;
    return parsed;
  }

  /**
   * Invalidate the cache (e.g. after an admin updates or toggles a model)
   */
  static invalidate() {
    this.cachedModels = null;
    this.lastFetchedAt = 0;
  }
}
