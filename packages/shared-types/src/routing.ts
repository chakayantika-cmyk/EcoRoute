// ============================================================================
// Routing Types
// ============================================================================

export enum RoutingStrategy {
  BALANCED = 'balanced',
  LOWEST_COST = 'lowest_cost',
  HIGHEST_QUALITY = 'highest_quality',
  ECO_FIRST = 'eco_first',
  TOKEN_EFFICIENT = 'token_efficient',
}

export interface RoutingPreferences {
  id: string;
  userId: string;
  tokenEfficiencyWeight: number;
  costWeight: number;
  qualityWeight: number;
  environmentalWeight: number;
  defaultStrategy: RoutingStrategy;
  updatedAt: string;
}

export interface RoutingPreferencesUpdate {
  tokenEfficiencyWeight?: number;
  costWeight?: number;
  qualityWeight?: number;
  environmentalWeight?: number;
  defaultStrategy?: RoutingStrategy;
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
  createdAt: string;
}

export interface CandidateScore {
  modelId: string;
  modelName: string;
  providerName: string;
  totalScore: number;
  breakdown: ScoreBreakdown;
  eligible: boolean;
  disqualifyReason?: string;
}

export interface ScoreBreakdown {
  tokenEfficiency: number;
  cost: number;
  quality: number;
  environmental: number;
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
  methodologyVersion: string;
  confidence: 'low' | 'medium' | 'high';
  dataSource: string;
  disclaimer: string;
}

export enum MeasurementStatus {
  ACTUAL = 'actual',
  ESTIMATED = 'estimated',
  SIMULATED = 'simulated',
  UNAVAILABLE = 'unavailable',
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
