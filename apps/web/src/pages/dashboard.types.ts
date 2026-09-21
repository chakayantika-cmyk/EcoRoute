// ============================================================================
// Dashboard Types
// ============================================================================

export type TaskStatus =
  | 'idle'
  | 'analyzing'
  | 'evaluating'
  | 'routing'
  | 'generating'
  | 'completed'
  | 'error';

export interface EvaluatedModel {
  modelId: string;
  modelKey: string;
  modelName: string;
  providerKey: string;
  providerName: string;
  family: string;
  capabilities: string[];
  contextWindow: number;
  eligible: boolean;
  disqualifyReason?: string;
  pricingTier?: 'free' | 'paid' | 'unknown';
  pricingSource?: string;
  providerHealth?: 'HEALTHY' | 'UNREACHABLE' | 'UNCONFIGURED' | 'DEGRADED';
  modelAvailability?: 'AVAILABLE' | 'NOT_INSTALLED' | 'UNKNOWN' | 'INSUFFICIENT_DATA';
  wasCalled?: boolean;
  inputTokens?: number;
  predictedOutputTokens?: number;
  estimatedTokens: number;
  estimatedCost: number | null;
  estimatedEnergy?: number | null;
  estimatedWater?: number | null;
  estimatedCarbon: number | null;
  qualityScore: number;
  qualitySource?: string;
  latencyMs: number | null;
  routingScore: number | null;
  breakdown: {
    quality: number;
    cost: number;
    tokenEfficiency: number;
    environmental: number;
    latency: number;
  };
  status: 'evaluated' | 'eligible' | 'excluded' | 'insufficient_data' | 'provider_unavailable' | 'model_not_installed';
  isSelected?: boolean;
  provenance?: {
    qualitySource?: string;
    qualityBenchmark?: string;
    pricingSource?: string;
    environmentalMethodology?: string;
  };
}

export interface TaskAnalysisData {
  domain: string;
  domainLabel: string;
  complexityIndex: number;
  complexityTier: string;
  reasoningDepth: number;
  constraintDensity: number;
  lexicalDiversity: number;
  wordCount: number;
  inputTokens: number;
  predictedOutputTokens: number;
  expansionRatio: number;
  totalEstimatedTokens: number;
  detectedFeatures: string[];
}

import { SustainabilityComparison } from '@ecoroute/shared-types';

export type SustainabilityAccounting = SustainabilityComparison;

export interface StreamedResult {
  taskId: string;
  inputText: string;
  taskAnalysis?: TaskAnalysisData;
  evaluations: EvaluatedModel[];
  baseline?: {
    modelId: string;
    modelKey: string;
    displayName: string;
    provider: string;
    estimatedTokens: number;
    estimatedCost: number;
    estimatedEnergyKWh: number;
    estimatedWaterLiters: number | null;
    estimatedCarbonGrams: number;
    isCounterfactual: boolean;
  };
  selectedModel?: {
    modelId: string;
    modelKey: string;
    displayName: string;
    provider: string;
    routingScore: number | null;
    breakdown: {
      quality: number;
      cost: number;
      tokenEfficiency: number;
      environmental: number;
      latency: number;
    };
    estimatedCost: number | null;
    estimatedCarbon: number | null;
    estimatedEnergy?: number | null;
    estimatedWater?: number | null;
    estimatedTokens: number;
    qualityScore: number;
    estimatedLatencyMs?: number | null;
  };
  sustainability?: SustainabilityAccounting;
  routingPerformed?: boolean;
  bypassReason?: string;
  streamedAnswer: string;
  explanation?: string;
  actualUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
    actualCost?: number | null;
  };
  errorInfo?: {
    code: string;
    message: string;
    provider?: string;
    providerSummaries?: Array<{
      providerKey: string;
      providerName: string;
      statusSummary: string;
      availableCount: number;
      totalCount: number;
    }>;
  };
}
