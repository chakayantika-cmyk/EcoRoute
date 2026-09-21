// ============================================================================
// Environmental Impact Estimation — Methodology v1
// ============================================================================
//
// DISCLAIMER: All values computed using this methodology are MODELED ESTIMATES,
// not direct measurements. They are based on published research averages and
// should not be cited as exact measurements.
//
// Data Sources:
// - Patterson et al. (2021) "Carbon Emissions and Large Neural Network Training"
// - IEA (2023) Global average electricity carbon intensity
// - Strubell et al. (2019) "Energy and Policy Considerations for Deep Learning"
// - Luccioni et al. (2023) "Power Hungry Processing"
//
// Limitations:
// - Does not account for actual hardware utilization
// - Does not account for regional energy mix variations
// - Does not account for renewable energy procurement by providers
// - Water consumption excluded from v1 due to insufficient per-inference data
// - PUE values are industry averages, not provider-specific
// ============================================================================

export const ENVIRONMENTAL_METHODOLOGY = {
  version: 'v1',
  lastUpdated: '2024-10-01',
  description: 'Modeled environmental impact estimation based on published ML energy research.',
  disclaimer:
    'This is a modeled estimate based on published averages, not a direct measurement. Actual environmental impact may vary significantly based on hardware, data center location, renewable energy usage, and other factors.',
} as const;

/**
 * Energy consumption estimate per token in watt-hours.
 * Derived from published research on transformer model energy consumption.
 * These are rough approximations and vary significantly by model architecture,
 * hardware, and batch size.
 */
export interface ModelEnergyProfile {
  modelKey: string;
  energyPerTokenWh: number;
  prefillEnergyPerTokenWh: number;
  decodeEnergyPerTokenWh: number;
  modelSizeCategory: 'small' | 'medium' | 'large' | 'xlarge';
  architecture: 'dense' | 'moe';
  confidence: 'low' | 'medium' | 'high';
  notes: string;
}

/**
 * Energy profiles based on empirical measurements from:
 * - "Trends in AI inference energy consumption: Beyond the performance-vs-parameter laws of deep learning" (2023)
 * - "Sprout: Green Generative AI with Carbon-Efficient LLM Inference" (EMNLP 2024)
 * Prefill phase is compute-bound matrix operations.
 * Decode phase is memory-bandwidth bound autoregressive generation (3x - 4.5x higher energy per token).
 */
export const MODEL_ENERGY_PROFILES: ModelEnergyProfile[] = [
  {
    modelKey: 'gpt-4o',
    energyPerTokenWh: 0.0004,
    prefillEnergyPerTokenWh: 0.00012,
    decodeEnergyPerTokenWh: 0.00048,
    modelSizeCategory: 'large',
    architecture: 'moe',
    confidence: 'medium',
    notes: 'Estimated for GPT-4o MoE class inference (EMNLP 2024 / Sustainable Computing 2023)',
  },
  {
    modelKey: 'gpt-4o-mini',
    energyPerTokenWh: 0.00015,
    prefillEnergyPerTokenWh: 0.00004,
    decodeEnergyPerTokenWh: 0.00018,
    modelSizeCategory: 'medium',
    architecture: 'dense',
    confidence: 'medium',
    notes: 'Estimated for small optimized dense model',
  },
  {
    modelKey: 'gemini-1.5-pro',
    energyPerTokenWh: 0.00035,
    prefillEnergyPerTokenWh: 0.00010,
    decodeEnergyPerTokenWh: 0.00042,
    modelSizeCategory: 'large',
    architecture: 'moe',
    confidence: 'medium',
    notes: 'Estimated for Gemini 1.5 Pro MoE architecture with long-context KV caching',
  },
  {
    modelKey: 'gemini-1.5-flash',
    energyPerTokenWh: 0.00012,
    prefillEnergyPerTokenWh: 0.00003,
    decodeEnergyPerTokenWh: 0.00014,
    modelSizeCategory: 'small',
    architecture: 'moe',
    confidence: 'medium',
    notes: 'Highly distilled lightweight multimodal model with low prefill overhead',
  },
  {
    modelKey: 'claude-3.5-sonnet',
    energyPerTokenWh: 0.00038,
    prefillEnergyPerTokenWh: 0.00011,
    decodeEnergyPerTokenWh: 0.00045,
    modelSizeCategory: 'large',
    architecture: 'moe',
    confidence: 'medium',
    notes: 'Frontier reasoning model with deep self-attention decode overhead',
  },
  {
    modelKey: 'claude-3-haiku',
    energyPerTokenWh: 0.00010,
    prefillEnergyPerTokenWh: 0.000025,
    decodeEnergyPerTokenWh: 0.00012,
    modelSizeCategory: 'small',
    architecture: 'dense',
    confidence: 'medium',
    notes: 'Ultra-fast compact model optimized for low-latency, low-energy throughput',
  },
];

/**
 * Power Usage Effectiveness — ratio of total facility energy to IT equipment energy.
 * Industry average for modern cloud data centers is ~1.1-1.3.
 * Source: Uptime Institute 2023 Global Data Center Survey
 */
export const DEFAULT_PUE = 1.2;

/**
 * Global average carbon intensity of electricity in kg CO2 per kWh.
 * Source: IEA (2023) — varies significantly by region.
 */
export const GRID_CARBON_INTENSITY_KG_PER_KWH = 0.4;

export function getCarbonIntensityKgPerKWh(): { value: number; source: string } {
  const envVal = process.env.CARBON_INTENSITY_KG_PER_KWH;
  if (envVal && !isNaN(Number(envVal))) {
    return {
      value: Number(envVal),
      source: process.env.CARBON_INTENSITY_SOURCE || 'Custom Environment Configuration',
    };
  }
  return {
    value: GRID_CARBON_INTENSITY_KG_PER_KWH,
    source: 'IEA (2023) Global Grid Average',
  };
}

export function getWaterIntensityLitersPerKWh(): { value: number | null; source: string } {
  const envVal = process.env.WATER_INTENSITY_L_PER_KWH;
  if (envVal && !isNaN(Number(envVal)) && Number(envVal) > 0) {
    return {
      value: Number(envVal),
      source: process.env.WATER_INTENSITY_SOURCE || 'Regional Utility Water Footprint',
    };
  }
  return {
    value: null,
    source: 'Unavailable (no defensible regional water intensity configured)',
  };
}

export interface MetricUncertainty {
  value: number;
  uncertaintyPercent: number;
  lowerBound: number;
  upperBound: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export function calculateUncertainty(
  value: number,
  confidenceLevel: 'high' | 'medium' | 'low' = 'medium',
): MetricUncertainty {
  const pctMap = { high: 0.05, medium: 0.15, low: 0.30 };
  const pct = pctMap[confidenceLevel];
  const delta = value * pct;
  return {
    value,
    uncertaintyPercent: Math.round(pct * 100),
    lowerBound: Math.round(Math.max(0, value - delta) * 10000) / 10000,
    upperBound: Math.round((value + delta) * 10000) / 10000,
    confidenceLevel,
  };
}

/**
 * Calculate estimated environmental impact for a given number of tokens (Methodology v1 legacy).
 */
export function calculateEnvironmentalEstimate(
  totalTokens: number,
  energyPerTokenWh: number,
  pue: number = DEFAULT_PUE,
  carbonIntensity: number = GRID_CARBON_INTENSITY_KG_PER_KWH,
) {
  const rawEnergyWh = totalTokens * energyPerTokenWh;
  const totalEnergyWh = rawEnergyWh * pue;
  const carbonKg = (totalEnergyWh / 1000) * carbonIntensity;
  const carbonGrams = carbonKg * 1000;

  const waterCfg = getWaterIntensityLitersPerKWh();
  const waterLiters = waterCfg.value != null ? (totalEnergyWh / 1000) * waterCfg.value : null;

  return {
    energyWh: Math.round(totalEnergyWh * 10000) / 10000,
    carbonGrams: Math.round(carbonGrams * 10000) / 10000,
    waterLiters: waterLiters != null ? Math.round(waterLiters * 10000) / 10000 : null,
  };
}

/**
 * Dual-Phase Sequence-Length Energy, Carbon & Water Model
 * Directly implements the empirical formulation from:
 * "Trends in AI inference energy consumption: Beyond the performance-vs-parameter laws of deep learning" (2023)
 * E_total = (L_in * e_prefill + L_out * e_decode) * PUE
 */
export function calculateDualPhaseEnvironmentalEstimate(
  inputTokens: number,
  outputTokens: number,
  profile: ModelEnergyProfile,
  pue: number = DEFAULT_PUE,
  carbonIntensityOverride?: number,
) {
  const carbonCfg = getCarbonIntensityKgPerKWh();
  const carbonIntensity = carbonIntensityOverride ?? carbonCfg.value;

  const prefillEnergyWh = inputTokens * profile.prefillEnergyPerTokenWh;
  const decodeEnergyWh = outputTokens * profile.decodeEnergyPerTokenWh;
  const inferenceEnergyWh = prefillEnergyWh + decodeEnergyWh;
  const totalEnergyWh = inferenceEnergyWh * pue;
  const carbonKg = (totalEnergyWh / 1000) * carbonIntensity;
  const carbonGrams = carbonKg * 1000;

  const waterCfg = getWaterIntensityLitersPerKWh();
  const waterLiters = waterCfg.value != null ? (totalEnergyWh / 1000) * waterCfg.value : null;

  return {
    prefillEnergyWh: Math.round(prefillEnergyWh * 100000) / 100000,
    decodeEnergyWh: Math.round(decodeEnergyWh * 100000) / 100000,
    energyWh: Math.round(totalEnergyWh * 10000) / 10000,
    carbonGrams: Math.round(carbonGrams * 10000) / 10000,
    waterLiters: waterLiters != null ? Math.round(waterLiters * 10000) / 10000 : null,
    carbonSource: carbonCfg.source,
    waterSource: waterCfg.source,
    confidence: profile.confidence,
  };
}

/**
 * Calculate Router Overhead from measured CPU/compute duration and power model
 */
export function calculateRouterOverhead(
  latencyMs: number,
  powerWatts: number = 65,
  carbonIntensityOverride?: number,
) {
  const carbonCfg = getCarbonIntensityKgPerKWh();
  const carbonIntensity = carbonIntensityOverride ?? carbonCfg.value;
  const computeSeconds = latencyMs / 1000;
  const routerEnergyWh = (computeSeconds * powerWatts) / 3600;
  const carbonKg = (routerEnergyWh / 1000) * carbonIntensity;
  const routerCarbonGrams = carbonKg * 1000;

  const waterCfg = getWaterIntensityLitersPerKWh();
  const routerWaterLiters = waterCfg.value != null ? (routerEnergyWh / 1000) * waterCfg.value : null;

  return {
    routerLatencyMs: Math.max(1, Math.round(latencyMs)),
    routerCostUsd: null as number | null, // Deterministic local CPU has no external API cost
    routerEnergyWh: Math.round(routerEnergyWh * 100000) / 100000,
    routerWaterLiters: routerWaterLiters != null ? Math.round(routerWaterLiters * 100000) / 100000 : null,
    routerCarbonGrams: Math.round(routerCarbonGrams * 100000) / 100000,
    carbonSource: carbonCfg.source,
    waterSource: waterCfg.source,
    measurementType: 'modeled' as const,
  };
}

