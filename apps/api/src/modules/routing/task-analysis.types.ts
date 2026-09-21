// ============================================================================
// Task Analysis Types & Heuristic Interfaces
// Deterministic and explainable task classification without calling an LLM
// ============================================================================

export interface TaskAnalysisProfile {
  domain: string;
  domainLabel: string;
  complexityIndex: number; // 0.05 to 0.99
  complexityTier: 'Low' | 'Moderate' | 'High' | 'Very High';
  reasoningDepth: number; // 0.0 to 1.0
  constraintDensity: number; // 0.0 to 1.0
  lexicalDiversity: number; // Type-Token Ratio 0.0 to 1.0
  wordCount: number;
  inputTokens: number;
  predictedOutputTokens: number;
  expansionRatio: number;
  totalEstimatedTokens: number;
  detectedFeatures: string[];
  classificationMethod: string;
  methodologyVersion: string;
  confidence: 'high' | 'medium' | 'low';
}
