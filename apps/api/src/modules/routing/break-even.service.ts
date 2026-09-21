// ============================================================================
// Break-Even Service — Routing Bypass & Efficiency Guard
// Two-Phase Break-Even Evaluation:
// Phase 1: Cheap pre-screening to avoid circular dependencies
// Phase 2: Final verification against calculated candidate savings
// ============================================================================

import {
  DEFAULT_MIN_EXPECTED_SAVINGS_PERCENT,
  DEFAULT_MAX_OVERHEAD_RATIO,
} from '@ecoroute/config';
import { TaskAnalysisProfile } from './task-analysis.types';
import { BaselineEstimate } from './baseline.service';
import { RouterOverheadMetrics } from './routing-overhead.service';

export interface PreScreenDecision {
  shouldProceed: boolean;
  bypassReason?: string;
}

export interface FinalBreakEvenDecision {
  shouldRoute: boolean;
  routingPerformed: boolean;
  bypassReason?: string;
  expectedCostSavingsPercent?: number;
  expectedEnergySavingsPercent?: number;
  routerOverheadCostRatio?: number;
  routerOverheadEnergyRatio?: number;
}

export class BreakEvenService {
  /**
   * Phase 1: Cheap Pre-Screen before candidate evaluation.
   * Prevents circular logic: Evaluates if routing could plausibly beat the baseline.
   */
  static preScreen(
    task: TaskAnalysisProfile,
    baseline: BaselineEstimate,
  ): PreScreenDecision {
    // If task is ultra-casual/trivial (word count < 3) and baseline model is already fast/cheap
    if (task.wordCount < 3 && task.domain === 'casual_conversational' && (baseline.costUsd ?? 0) < 0.00005) {
      return {
        shouldProceed: false,
        bypassReason: 'Prompt is trivial; router overhead exceeds maximum plausible benefit.',
      };
    }

    return {
      shouldProceed: true,
    };
  }

  /**
   * Phase 2: Final Break-Even check comparing selected candidate against counterfactual baseline
   * and router overhead.
   */
  static evaluateFinalBreakEven(
    baseline: BaselineEstimate,
    candidateCost: number | null,
    candidateEnergyWh: number | null,
    overhead: RouterOverheadMetrics,
    minSavingsPercent: number = Number(process.env.ROUTING_MIN_EXPECTED_SAVINGS_PERCENT ?? DEFAULT_MIN_EXPECTED_SAVINGS_PERCENT),
    maxOverheadRatio: number = Number(process.env.ROUTING_MAX_OVERHEAD_RATIO ?? DEFAULT_MAX_OVERHEAD_RATIO),
  ): FinalBreakEvenDecision {
    const baselineCost = baseline.costUsd ?? 0;
    const baselineEnergy = baseline.energyWh ?? 0;
    const routerCost = overhead.routerCostUsd ?? 0;
    const routerEnergy = overhead.routerEnergyWh ?? 0;

    const totalEcoRouteCost = (candidateCost ?? 0) + routerCost;
    const totalEcoRouteEnergy = (candidateEnergyWh ?? 0) + routerEnergy;

    // Check Energy Break-even
    const energySavings = baselineEnergy - totalEcoRouteEnergy;
    const energySavingsPct = baselineEnergy > 0 ? (energySavings / baselineEnergy) * 100 : 0;
    const energyOverheadRatio = (candidateEnergyWh ?? 0) > 0 ? routerEnergy / (candidateEnergyWh ?? 1) : 0;

    // Check Cost Break-even
    const costSavings = baselineCost - totalEcoRouteCost;
    const costSavingsPct = baselineCost > 0 ? (costSavings / baselineCost) * 100 : 0;
    const costOverheadRatio = (candidateCost ?? 0) > 0 ? routerCost / (candidateCost ?? 1) : 0;

    // If router overhead itself exceeds expected savings (e.g. net energy or net cost is negative or negligible)
    if (energySavings < 0 && costSavings < 0) {
      return {
        shouldRoute: false,
        routingPerformed: false,
        bypassReason: 'Routing overhead exceeds expected benefit.',
        expectedCostSavingsPercent: Math.round(costSavingsPct * 10) / 10,
        expectedEnergySavingsPercent: Math.round(energySavingsPct * 10) / 10,
        routerOverheadCostRatio: Math.round(costOverheadRatio * 1000) / 1000,
        routerOverheadEnergyRatio: Math.round(energyOverheadRatio * 1000) / 1000,
      };
    }

    // Check if router overhead ratio exceeds the allowed maximum overhead threshold
    if (energyOverheadRatio > maxOverheadRatio && energySavingsPct < minSavingsPercent) {
      return {
        shouldRoute: false,
        routingPerformed: false,
        bypassReason: `Router overhead ratio (${(energyOverheadRatio * 100).toFixed(1)}%) exceeds maximum threshold (${(maxOverheadRatio * 100).toFixed(1)}%).`,
        expectedCostSavingsPercent: Math.round(costSavingsPct * 10) / 10,
        expectedEnergySavingsPercent: Math.round(energySavingsPct * 10) / 10,
        routerOverheadCostRatio: Math.round(costOverheadRatio * 1000) / 1000,
        routerOverheadEnergyRatio: Math.round(energyOverheadRatio * 1000) / 1000,
      };
    }


    // If savings are less than minimum expected savings percent (e.g. 5%)
    const bestSavingsPct = Math.max(energySavingsPct, costSavingsPct);
    if (bestSavingsPct < minSavingsPercent && (candidateCost ?? 0) >= baselineCost && (candidateEnergyWh ?? 0) >= baselineEnergy) {
      return {
        shouldRoute: false,
        routingPerformed: false,
        bypassReason: `Expected resource savings (${bestSavingsPct.toFixed(1)}%) below minimum threshold (${minSavingsPercent}%).`,
        expectedCostSavingsPercent: Math.round(costSavingsPct * 10) / 10,
        expectedEnergySavingsPercent: Math.round(energySavingsPct * 10) / 10,
      };
    }

    return {
      shouldRoute: true,
      routingPerformed: true,
      expectedCostSavingsPercent: Math.round(costSavingsPct * 10) / 10,
      expectedEnergySavingsPercent: Math.round(energySavingsPct * 10) / 10,
      routerOverheadCostRatio: Math.round(costOverheadRatio * 1000) / 1000,
      routerOverheadEnergyRatio: Math.round(energyOverheadRatio * 1000) / 1000,
    };
  }
}
