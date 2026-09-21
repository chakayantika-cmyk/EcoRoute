// ============================================================================
// Routing Types
// ============================================================================

export enum RoutingStrategy {
  BALANCED = 'balanced',
  LOWEST_COST = 'lowest_cost',
  HIGHEST_QUALITY = 'highest_quality',
  ECO_FIRST = 'eco_first',
  TOKEN_EFFICIENT = 'token_efficient',
  LOWEST_LATENCY = 'lowest_latency',
  QUALITY_FIRST = 'quality_first',
}

export interface RoutingPreferences {
  id: string;
  userId: string;
  tokenEfficiencyWeight: number;
  costWeight: number;
  qualityWeight: number;
  environmentalWeight: number;
  latencyWeight?: number;
  defaultStrategy: RoutingStrategy;
  baselineModelId?: string | null;
  updatedAt: string;
}

export interface RoutingPreferencesUpdate {
  tokenEfficiencyWeight?: number;
  costWeight?: number;
  qualityWeight?: number;
  environmentalWeight?: number;
  latencyWeight?: number;
  defaultStrategy?: RoutingStrategy;
  baselineModelId?: string | null;
}

export interface ScoreBreakdown {
  quality: number;
  cost: number;
  tokenEfficiency: number;
  environmental: number;
  latency: number;
}

export interface CandidateScore {
  modelId: string;
  modelName: string;
  providerName: string;
  totalScore: number | null;
  breakdown: ScoreBreakdown;
  eligible: boolean;
  status: 'evaluated' | 'eligible' | 'excluded' | 'insufficient_data' | 'provider_unavailable' | 'model_not_installed';
  disqualifyReason?: string;
  providerHealth?: 'HEALTHY' | 'UNREACHABLE' | 'UNCONFIGURED' | 'DEGRADED';
  modelAvailability?: 'AVAILABLE' | 'NOT_INSTALLED' | 'UNKNOWN' | 'INSUFFICIENT_DATA';
  wasCalled?: boolean;
  // Provenance fields
  provenance?: {
    qualitySource?: string;
    qualityBenchmark?: string;
    latencySource?: string;
    energySource?: string;
    pricingSource?: string;
  };
}

export interface CostEstimate {
  value: number | null;
  currency: string;
  status: MeasurementStatus;
}

export interface QualityScore {
  value: number;
  scoreType: MeasurementStatus;
  methodology: string;
}

export interface EnvironmentalImpact {
  status: MeasurementStatus;
  energyWh: number | null;
  carbonGrams: number | null;
  waterLiters?: number | null;
  methodologyVersion: string;
  confidence: 'low' | 'medium' | 'high';
  dataSource: string;
  disclaimer: string;
  uncertainty?: {
    uncertaintyPercent: number;
    lowerBound: number;
    upperBound: number;
  };
}

export enum MeasurementStatus {
  ACTUAL = 'actual',
  MEASURED = 'measured',
  ESTIMATED = 'estimated',
  MODELED = 'modeled',
  SIMULATED = 'simulated',
  UNAVAILABLE = 'unavailable',
}

export interface ResourceMetricRecord {
  costUsd: number | null;
  energyWh: number | null;
  waterLiters: number | null;
  carbonGramsCo2e: number | null;
  latencyMs: number | null;
  modelId?: string;
}

export interface NetSavingsRecord {
  costUsd: number | null;
  energyWh: number | null;
  waterLiters: number | null;
  carbonGramsCo2e: number | null;
  latencyMs: number | null;
  costPercent: number | null;
  energyPercent: number | null;
  waterPercent: number | null;
  carbonPercent: number | null;
  latencyPercent?: number | null;
}

export interface SustainabilityComparison {
  baseline: ResourceMetricRecord;
  router: ResourceMetricRecord;
  selectedModel: ResourceMetricRecord;
  ecoRouteTotal: ResourceMetricRecord;
  netSavings: NetSavingsRecord;
  routingPerformed: boolean;
  bypassReason?: string | null;
  methodologyVersion: string;
  outcomeStatus:
    | 'net_saving'
    | 'no_measurable_saving'
    | 'overhead_exceeded'
    | 'unreliable_estimate';
  outcomeMessage: string;
  routerOverheadRatio: {
    routerEnergyPct: number;
    selectedEnergyPct: number;
    routerLatencyPct: number;
    selectedLatencyPct: number;
  };
}

export interface RoutingResult {
  id: string;
  taskId: string;
  selectedModel: {
    id: string;
    provider: string;
    providerKey: string;
    name: string;
    modelKey: string;
  };
  strategy: RoutingStrategy;
  estimatedTokens: number;
  actualTokens: number | null;
  estimatedCost: CostEstimate;
  actualCost: CostEstimate | null;
  environmentalImpact: EnvironmentalImpact;
  qualityScore: QualityScore;
  explanation: string;
  candidateScores: CandidateScore[];
  sustainability?: SustainabilityComparison;
  createdAt: string;
}

export interface RoutingRequest {
  taskId: string;
  strategy?: RoutingStrategy;
}

export interface GeneratedAnswer {
  id: string;
  taskId: string;
  answerText: string;
  providerRequestId: string | null;
  createdAt: string;
}

