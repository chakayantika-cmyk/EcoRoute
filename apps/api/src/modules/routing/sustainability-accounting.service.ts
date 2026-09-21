// ============================================================================
// Sustainability Accounting Service
// 4-Column Accounting: Direct Baseline | Routing Overhead | EcoRoute Total | Net Impact
// Strict Scientific Honesty: Preserves negative savings, never converts null to 0
// ============================================================================

import { SustainabilityComparison, ResourceMetricRecord, NetSavingsRecord } from '@ecoroute/shared-types';
import { BaselineEstimate } from './baseline.service';
import { RouterOverheadMetrics } from './routing-overhead.service';

export interface SelectedModelMetrics {
  modelId: string;
  costUsd: number | null;
  energyWh: number | null;
  waterLiters: number | null;
  carbonGramsCo2e: number | null;
  latencyMs: number | null;
}

export class SustainabilityAccountingService {
  /**
   * Compiles the complete 4-column Sustainability Accounting structure
   */
  static computeAccounting(
    baseline: BaselineEstimate,
    overhead: RouterOverheadMetrics,
    selected: SelectedModelMetrics,
    routingPerformed: boolean = true,
    bypassReason?: string | null,
  ): SustainabilityComparison {
    // 1. Direct Baseline
    const baselineRecord: ResourceMetricRecord = {
      modelId: baseline.modelId,
      costUsd: baseline.costUsd != null ? Math.round(baseline.costUsd * 1000000) / 1000000 : null,
      energyWh: baseline.energyWh != null ? Math.round(baseline.energyWh * 10000) / 10000 : null,
      waterLiters: baseline.waterLiters != null ? Math.round(baseline.waterLiters * 10000) / 10000 : null,
      carbonGramsCo2e: baseline.carbonGramsCo2e != null ? Math.round(baseline.carbonGramsCo2e * 10000) / 10000 : null,
      latencyMs: baseline.latencyMs,
    };

    // 2. Routing Overhead
    const routerRecord: ResourceMetricRecord = {
      costUsd: overhead.routerCostUsd != null ? Math.round(overhead.routerCostUsd * 1000000) / 1000000 : null,
      energyWh: overhead.routerEnergyWh != null ? Math.round(overhead.routerEnergyWh * 100000) / 100000 : null,
      waterLiters: overhead.routerWaterLiters != null ? Math.round(overhead.routerWaterLiters * 100000) / 100000 : null,
      carbonGramsCo2e: overhead.routerCarbonGramsCo2e != null ? Math.round(overhead.routerCarbonGramsCo2e * 100000) / 100000 : null,
      latencyMs: overhead.routerLatencyMs,
    };

    // 3. Selected Model Record
    const selectedRecord: ResourceMetricRecord = {
      modelId: selected.modelId,
      costUsd: selected.costUsd != null ? Math.round(selected.costUsd * 1000000) / 1000000 : null,
      energyWh: selected.energyWh != null ? Math.round(selected.energyWh * 10000) / 10000 : null,
      waterLiters: selected.waterLiters != null ? Math.round(selected.waterLiters * 10000) / 10000 : null,
      carbonGramsCo2e: selected.carbonGramsCo2e != null ? Math.round(selected.carbonGramsCo2e * 10000) / 10000 : null,
      latencyMs: selected.latencyMs,
    };

    // 4. EcoRoute Total = Router Overhead + Selected Model
    // (If router cost is null, total cost is selected model cost)
    const totalCost = selectedRecord.costUsd != null
      ? (routerRecord.costUsd ?? 0) + selectedRecord.costUsd
      : null;

    const totalEnergy = (routerRecord.energyWh != null || selectedRecord.energyWh != null)
      ? (routerRecord.energyWh ?? 0) + (selectedRecord.energyWh ?? 0)
      : null;

    // Strict null water handling: if selected model water is null, total is null (never 0)
    const totalWater = (selectedRecord.waterLiters != null && routerRecord.waterLiters != null)
      ? routerRecord.waterLiters + selectedRecord.waterLiters
      : (selectedRecord.waterLiters ?? null);

    const totalCarbon = (selectedRecord.carbonGramsCo2e != null || routerRecord.carbonGramsCo2e != null)
      ? (routerRecord.carbonGramsCo2e ?? 0) + (selectedRecord.carbonGramsCo2e ?? 0)
      : null;

    const totalLatency = (routerRecord.latencyMs ?? 0) + (selectedRecord.latencyMs ?? 0);

    const ecoRouteTotal: ResourceMetricRecord = {
      costUsd: totalCost != null ? Math.round(totalCost * 1000000) / 1000000 : null,
      energyWh: totalEnergy != null ? Math.round(totalEnergy * 10000) / 10000 : null,
      waterLiters: totalWater != null ? Math.round(totalWater * 10000) / 10000 : null,
      carbonGramsCo2e: totalCarbon != null ? Math.round(totalCarbon * 10000) / 10000 : null,
      latencyMs: totalLatency,
    };

    // 5. Net Savings = Baseline - EcoRouteTotal (Preserve negative values!)
    const netCost = (baselineRecord.costUsd != null && ecoRouteTotal.costUsd != null)
      ? baselineRecord.costUsd - ecoRouteTotal.costUsd
      : null;

    const netEnergy = (baselineRecord.energyWh != null && ecoRouteTotal.energyWh != null)
      ? baselineRecord.energyWh - ecoRouteTotal.energyWh
      : null;

    const netWater = (baselineRecord.waterLiters != null && ecoRouteTotal.waterLiters != null)
      ? baselineRecord.waterLiters - ecoRouteTotal.waterLiters
      : null;

    const netCarbon = (baselineRecord.carbonGramsCo2e != null && ecoRouteTotal.carbonGramsCo2e != null)
      ? baselineRecord.carbonGramsCo2e - ecoRouteTotal.carbonGramsCo2e
      : null;

    const netLatency = (baselineRecord.latencyMs != null && ecoRouteTotal.latencyMs != null)
      ? baselineRecord.latencyMs - ecoRouteTotal.latencyMs
      : null;

    const costPercent = (baselineRecord.costUsd != null && baselineRecord.costUsd > 0 && netCost != null)
      ? Math.round((netCost / baselineRecord.costUsd) * 1000) / 10
      : null;

    const energyPercent = (baselineRecord.energyWh != null && baselineRecord.energyWh > 0 && netEnergy != null)
      ? Math.round((netEnergy / baselineRecord.energyWh) * 1000) / 10
      : null;

    const waterPercent = (baselineRecord.waterLiters != null && baselineRecord.waterLiters > 0 && netWater != null)
      ? Math.round((netWater / baselineRecord.waterLiters) * 1000) / 10
      : null;

    const carbonPercent = (baselineRecord.carbonGramsCo2e != null && baselineRecord.carbonGramsCo2e > 0 && netCarbon != null)
      ? Math.round((netCarbon / baselineRecord.carbonGramsCo2e) * 1000) / 10
      : null;

    const netSavings: NetSavingsRecord = {
      costUsd: netCost != null ? Math.round(netCost * 1000000) / 1000000 : null,
      energyWh: netEnergy != null ? Math.round(netEnergy * 10000) / 10000 : null,
      waterLiters: netWater != null ? Math.round(netWater * 10000) / 10000 : null,
      carbonGramsCo2e: netCarbon != null ? Math.round(netCarbon * 10000) / 10000 : null,
      latencyMs: netLatency,
      costPercent,
      energyPercent,
      waterPercent,
      carbonPercent,
    };

    // 6. Router Overhead Ratio
    const energyDenominator = (routerRecord.energyWh ?? 0) + (selectedRecord.energyWh ?? 0);
    const routerEnergyPct = energyDenominator > 0
      ? Math.round(((routerRecord.energyWh ?? 0) / energyDenominator) * 100)
      : 1;

    const latencyDenominator = (routerRecord.latencyMs ?? 0) + (selectedRecord.latencyMs ?? 0);
    const routerLatencyPct = latencyDenominator > 0
      ? Math.round(((routerRecord.latencyMs ?? 0) / latencyDenominator) * 100)
      : 5;

    // 7. Dynamic Outcome Decision
    let outcomeStatus: SustainabilityComparison['outcomeStatus'] = 'net_saving';
    let outcomeMessage = 'EcoRoute produced a net estimated saving.';

    if (totalEnergy == null && totalCost == null) {
      outcomeStatus = 'unreliable_estimate';
      outcomeMessage = 'Environmental impact could not be reliably estimated.';
    } else if ((netEnergy != null && netEnergy < -0.0001) || (netCost != null && netCost < -0.00001)) {
      outcomeStatus = 'overhead_exceeded';
      outcomeMessage = 'Routing overhead exceeded the estimated benefit.';
    } else if (
      (netEnergy != null && Math.abs(netEnergy) <= 0.005) &&
      (netCost != null && Math.abs(netCost) <= 0.00005)
    ) {
      outcomeStatus = 'no_measurable_saving';
      outcomeMessage = 'EcoRoute produced approximately no measurable net saving.';
    } else {
      outcomeStatus = 'net_saving';
      outcomeMessage = 'EcoRoute produced a net estimated saving.';
    }

    return {
      baseline: baselineRecord,
      router: routerRecord,
      selectedModel: selectedRecord,
      ecoRouteTotal,
      netSavings,
      routingPerformed,
      bypassReason: bypassReason || null,
      methodologyVersion: 'v2-pareto-overhead',
      outcomeStatus,
      outcomeMessage,
      routerOverheadRatio: {
        routerEnergyPct,
        selectedEnergyPct: Math.max(0, 100 - routerEnergyPct),
        routerLatencyPct,
        selectedLatencyPct: Math.max(0, 100 - routerLatencyPct),
      },
    };
  }
}
