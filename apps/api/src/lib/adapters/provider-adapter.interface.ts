// ============================================================================
// AI Provider Adapter Interface & Common Normalized Types
// ============================================================================

export interface ProviderConfig {
  id: string;
  providerKey: string;
  name: string;
  slug?: string | null;
  adapterType: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  organizationId?: string | null;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface ModelSpec {
  id?: string;
  modelKey: string;
  displayName: string;
  providerModelId?: string | null;
  family?: string | null;
  version?: string | null;
  contextWindow: number;
  maxOutputTokens?: number | null;
  capabilities: string[];
  pricing: {
    inputPricePerMillionTokens: number | null;
    outputPricePerMillionTokens: number | null;
  };
  performance?: Record<string, unknown>;
  environmentalMetrics?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Normalized Request & Response Interfaces (Strict Standards)
// ----------------------------------------------------------------------------

export interface NormalizedGenerationRequest {
  prompt: string;
  systemPrompt?: string;
  model: string; // modelKey or providerModelId
  modelSpec?: ModelSpec;
  temperature?: number;
  maxOutputTokens?: number;
  stream?: boolean;
  metadata?: {
    taskId: string;
    userId?: string;
  };
  abortSignal?: AbortSignal;
}

export interface NormalizedGenerationResponse {
  text: string;
  model: string;
  provider: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  latencyMs: number;
  providerRequestId?: string;
  finishReason?: string;
  estimatedCostUsd?: number;
  isLive: boolean;
  rawMetadata?: Record<string, unknown>;
}

export interface ExecutionRequest {
  prompt: string;
  model: ModelSpec;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  abortSignal?: AbortSignal;
}

export interface ExecutionResponse {
  answer: string;
  actualTokens: number;
  inputTokens: number;
  outputTokens: number;
  actualCost: number | null;
  providerRequestId: string;
  isLive: boolean;
  latencyMs: number;
  modelKey: string;
  finishReason?: string;
}

export interface HealthCheckResult {
  providerKey: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  latencyMs: number;
  message: string;
  testedModel?: string;
  checkedAt: string;
  error?: string | null;
}

export type ProviderHealthResult = HealthCheckResult;

export interface DiscoveredModel {
  providerModelId: string;
  displayName: string;
  contextWindow?: number;
  created?: number;
  ownedBy?: string;
}

export interface AIProviderAdapter {
  readonly providerKey: string;
  readonly adapterType: string;
  readonly provider?: string;

  /**
   * Performs an active health check or ping against the provider
   */
  healthCheck(testModelKey?: string): Promise<HealthCheckResult>;

  /**
   * Standard Normalized generation method
   */
  generate(request: NormalizedGenerationRequest): Promise<NormalizedGenerationResponse>;

  /**
   * Normalized streaming generation method (SSE chunk callback)
   */
  generateStream?(
    request: NormalizedGenerationRequest,
    onChunk: (chunk: string) => void,
  ): Promise<NormalizedGenerationResponse>;

  /**
   * Backward-compatible execution method
   */
  generateText(request: ExecutionRequest): Promise<ExecutionResponse>;

  /**
   * Lists models available dynamically from provider endpoint (if supported)
   */
  listRemoteModels?(): Promise<DiscoveredModel[]>;
}
