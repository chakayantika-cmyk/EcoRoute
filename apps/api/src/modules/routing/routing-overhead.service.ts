// ============================================================================
// Routing Overhead Service — Router Resource Accounting
// Routing is NOT free. Accurately tracks latency, CPU compute energy, water,
// carbon, and infrastructure cost of the routing pipeline itself.
// ============================================================================

import { calculateRouterOverhead, DEFAULT_ROUTER_POWER_WATTS } from '@ecoroute/config';

export interface RouterOverheadMetrics {
  routerLatencyMs: number;
  routerCostUsd: number | null;
  routerEnergyWh: number | null;
  routerWaterLiters: number | null;
  routerCarbonGramsCo2e: number | null;
  powerWatts: number;
  measurementType: 'modeled' | 'measured';
  carbonSource: string;
  waterSource: string;
  llmRouterUsed: boolean;
}

export class RoutingOverheadService {
  /**
   * Starts a high-resolution timer for measuring routing pipeline overhead
   */
  static startTimer(): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      return Math.max(1, Math.round(duration));
    };
  }

  /**
   * Calculates the full overhead of the routing pipeline
   */
  static calculateOverhead(
    routerLatencyMs: number,
    powerWatts: number = DEFAULT_ROUTER_POWER_WATTS,
  ): RouterOverheadMetrics {
    const overhead = calculateRouterOverhead(routerLatencyMs, powerWatts);

    // Optional LLM Router handling if enabled in future
    const llmRouterUsed = process.env.LLM_ROUTER_ENABLED === 'true';

    return {
      routerLatencyMs: overhead.routerLatencyMs,
      routerCostUsd: overhead.routerCostUsd, // Local compute has null external API cost
      routerEnergyWh: overhead.routerEnergyWh,
      routerWaterLiters: overhead.routerWaterLiters,
      routerCarbonGramsCo2e: overhead.routerCarbonGrams,
      powerWatts,
      measurementType: 'modeled',
      carbonSource: overhead.carbonSource,
      waterSource: overhead.waterSource,
      llmRouterUsed,
    };
  }
}
