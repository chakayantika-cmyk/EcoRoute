// ============================================================================
// Model Registry Service — High-Performance In-Memory Catalog Caching
// Single database query with TTL caching (5-15 mins) to prevent loop queries
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { KNOWN_MODEL_PRICING, PricingTier } from '@ecoroute/config';

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
  pricingTier: PricingTier;
  pricingSource: string;
  pricingLastUpdated: string;
  pricingLastVerified?: Date | null;
  executionMode: 'cloud' | 'local';
  availabilityStatus: string;
  accountAccessStatus: string;
  quotaStatus: string;
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
   * In normal production execution (AI_MOCK_MODE=false), mock simulation models
   * are strictly filtered out of the catalog.
   */
  static async getActiveModels(
    prisma: PrismaClient,
    forceRefresh: boolean = false,
  ): Promise<CandidateModelRecord[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedModels && now - this.lastFetchedAt < this.TTL_MS) {
      return this.cachedModels;
    }

    const isMockModeExplicit = process.env.AI_MOCK_MODE === 'true';

    const whereClause: any = {
      status: 'ACTIVE',
    };

    // In production, NEVER load mock simulation models into the active routing catalog
    if (!isMockModeExplicit) {
      whereClause.isMockModel = false;
      whereClause.provider = {
        providerKey: { not: 'mock' },
      };
    }

    const models = await prisma.aIModel.findMany({
      where: whereClause,
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

      // Resolve pricing metadata
      const known = KNOWN_MODEL_PRICING[m.modelKey] || KNOWN_MODEL_PRICING[m.providerModelId || ''];
      let pricingTier: PricingTier = (m.pricingTier as PricingTier) || 'unknown';
      let pricingSource = m.pricingSource || 'Unverified Pricing';
      let pricingLastUpdated = m.pricingLastVerified ? m.pricingLastVerified.toISOString().split('T')[0]! : '2026-03-01';

      if (known) {
        pricingTier = known.pricingTier;
        pricingSource = known.pricingSource;
        pricingLastUpdated = known.pricingLastUpdated;
      } else if (m.provider.providerKey === 'ollama') {
        pricingTier = 'free';
        pricingSource = m.pricingSource || 'Ollama Local Daemon (0 API fee)';
      } else if (m.isMockModel) {
        pricingTier = isMockModeExplicit ? 'free' : 'unknown';
        pricingSource = 'Deterministic Simulation Engine';
      }

      const executionMode = (m.executionMode as 'cloud' | 'local') || (m.provider.providerKey === 'ollama' ? 'local' : 'cloud');

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
        pricingTier,
        pricingSource,
        pricingLastUpdated,
        pricingLastVerified: m.pricingLastVerified,
        executionMode,
        availabilityStatus: m.availabilityStatus || 'READY',
        accountAccessStatus: m.accountAccessStatus || 'eligible',
        quotaStatus: m.quotaStatus || 'available',
        pricing: {
          inputPricePerMillionTokens: pricing.inputPricePerMillionTokens ?? (pricingTier === 'free' ? 0 : 0.15),
          outputPricePerMillionTokens: pricing.outputPricePerMillionTokens ?? (pricingTier === 'free' ? 0 : 0.60),
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
