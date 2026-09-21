// ============================================================================
// Dashboard Chart Data Builders & Utility Helpers
// ============================================================================

import { EvaluatedModel } from './dashboard.types';

export function isFiniteNumber(val: any): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

export function buildRoutingScoreChartData(evaluations: EvaluatedModel[]) {
  return evaluations
    .filter((e) => e.eligible && e.routingScore != null)
    .map((e) => ({
      name: e.modelName.replace(' ', '\n'),
      score: e.routingScore as number,
      isSelected: e.isSelected,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function buildCostChartData(evaluations: EvaluatedModel[]) {
  return evaluations
    .filter((e) => e.eligible && isFiniteNumber(e.estimatedCost))
    .map((e) => ({
      name: e.modelName.replace(' ', '\n'),
      cost: isFiniteNumber(e.estimatedCost) ? Number(e.estimatedCost.toFixed(6)) : null,
    }))
    .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))
    .slice(0, 8);
}

export function buildCarbonChartData(evaluations: EvaluatedModel[]) {
  return evaluations
    .filter((e) => e.eligible && isFiniteNumber(e.estimatedCarbon))
    .map((e) => ({
      name: e.modelName.replace(' ', '\n'),
      carbon: isFiniteNumber(e.estimatedCarbon) ? Number(e.estimatedCarbon.toFixed(4)) : null,
    }))
    .sort((a, b) => (a.carbon ?? 0) - (b.carbon ?? 0))
    .slice(0, 8);
}
