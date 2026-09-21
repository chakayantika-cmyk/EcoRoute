// ============================================================================
// Baseline Service — Counterfactual Baseline Estimation Engine
// Critical Product Principle: Baseline is a counterfactual estimate by default.
// Does NOT make an unnecessary second AI generation call.
// ============================================================================

import {
  calculateDualPhaseEnvironmentalEstimate,
  calculateUncertainty,
  ModelEnergyProfile,
  MetricUncertainty,
} from '@ecoroute/config';
import { CandidateModelRecord } from '../models/model-registry.service';
import { TaskAnalysisProfile } from './task-analysis.types';

export interface BaselineEstimate {
  modelId: string;
  modelKey: string;
  displayName: string;
  providerName: string;
  providerKey: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number | null;
  energyWh: number | null;
  waterLiters: number | null;
  carbonGramsCo2e: number | null;
  latencyMs: number | null;
  isCounterfactual: boolean;
  uncertainty: {
    energy: MetricUncertainty | null;
    carbon: MetricUncertainty | null;
  };
  provenance: {
    pricingSource: string;
    energyMethodology: string;
    carbonSource: string;
    waterSource: string;
    methodologyVersion: string;
    measurementType: 'modeled' | 'estimated';
  };
}

export class BaselineService {
  /**
   * Resolves the configured baseline model from candidate models.
   * Priority:
   * 1. User specified baselineModelId
   * 2. Process env DEFAULT_BASELINE_MODEL_ID
   * 3. Catalog marked default (or gpt-4o fallback)
   */
  static resolveBaselineModel(
    candidates: CandidateModelRecord[],
    userBaselineModelId?: string | null,
  ): CandidateModelRecord {
    if (userBaselineModelId) {
      const found = candidates.find(
        (c) => c.id === userBaselineModelId || c.modelKey === userBaselineModelId,
      );
      if (found) return found;
    }

    const envDefault = process.env.DEFAULT_BASELINE_MODEL_ID;
    if (envDefault) {
      const found = candidates.find(
        (c) => c.id === envDefault || c.modelKey === envDefault,
      );
      if (found) return found;
    }

    // Default to gpt-4o or first active model
    const gpt4o = candidates.find((c) => c.modelKey.includes('gpt-4o') && !c.modelKey.includes('mini'));
    if (gpt4o) return gpt4o;

    return candidates[0]!;
  }

  /**
   * Generates a counterfactual estimation for the baseline model without calling provider API.
   */
  static estimateBaseline(
    baselineModel: CandidateModelRecord,
    task: TaskAnalysisProfile,
  ): BaselineEstimate {
    const inputTokens = task.inputTokens;
    const outputTokens = task.predictedOutputTokens;
    const totalTokens = inputTokens + outputTokens;

    // Cost estimation
    let costUsd: number | null = null;
    if (baselineModel.pricing) {
      const inPrice = baselineModel.pricing.inputPricePerMillionTokens ?? 2.50;
      const outPrice = baselineModel.pricing.outputPricePerMillionTokens ?? 10.00;
      costUsd = (inputTokens * inPrice + outputTokens * outPrice) / 1_000_000;
      costUsd = Math.round(costUsd * 1000000) / 1000000;
    }

    // Energy Profile
    const key = baselineModel.modelKey.toLowerCase();
    let energyPerTokenWh = 0.00040;
    let prefillEnergyPerTokenWh = 0.00012;
    let decodeEnergyPerTokenWh = 0.00048;

    if (key.includes('o3') || key.includes('r1') || key.includes('opus')) {
      energyPerTokenWh = 0.00055;
      prefillEnergyPerTokenWh = 0.00015;
      decodeEnergyPerTokenWh = 0.00065;
    } else if (key.includes('mini') || key.includes('flash') || key.includes('haiku')) {
      energyPerTokenWh = 0.00014;
      prefillEnergyPerTokenWh = 0.00003;
      decodeEnergyPerTokenWh = 0.00016;
    }

    const energyProfile: ModelEnergyProfile = {
      modelKey: baselineModel.modelKey,
      energyPerTokenWh,
      prefillEnergyPerTokenWh,
      decodeEnergyPerTokenWh,
      modelSizeCategory: 'large',
      architecture: 'moe',
      confidence: 'medium',
      notes: 'Counterfactual baseline profile',
    };

    const envData = calculateDualPhaseEnvironmentalEstimate(
      inputTokens,
      outputTokens,
      energyProfile,
    );

    // Latency estimation
    const speed = 75; // Tokens/sec for baseline class
    const latencyMs = Math.round(150 + (outputTokens / speed) * 1000);

    const energyUncertainty = envData.energyWh != null ? calculateUncertainty(envData.energyWh, 'medium') : null;
    const carbonUncertainty = envData.carbonGrams != null ? calculateUncertainty(envData.carbonGrams, 'medium') : null;

    return {
      modelId: baselineModel.id,
      modelKey: baselineModel.modelKey,
      displayName: baselineModel.displayName,
      providerName: baselineModel.providerName,
      providerKey: baselineModel.providerKey,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd,
      energyWh: envData.energyWh,
      waterLiters: envData.waterLiters,
      carbonGramsCo2e: envData.carbonGrams,
      latencyMs,
      isCounterfactual: true,
      uncertainty: {
        energy: energyUncertainty,
        carbon: carbonUncertainty,
      },
      provenance: {
        pricingSource: 'Model catalog pricing metadata',
        energyMethodology: 'Dual-Phase Sequence-Length (EMNLP 2024)',
        carbonSource: envData.carbonSource,
        waterSource: envData.waterSource,
        methodologyVersion: 'v2-counterfactual',
        measurementType: 'modeled',
      },
    };
  }
}
