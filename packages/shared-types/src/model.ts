// ============================================================================
// AI Model & Provider Types
// ============================================================================

export enum ProviderKey {
  OPENAI = 'openai',
  GOOGLE_GEMINI = 'google_gemini',
  ANTHROPIC = 'anthropic',
  MOCK = 'mock',
}

export enum ProviderStatus {
  ACTIVE = 'active',
  DEGRADED = 'degraded',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
}

export enum ModelStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  DISABLED = 'disabled',
}

export enum ModelCapability {
  TEXT_GENERATION = 'text_generation',
  CODE_GENERATION = 'code_generation',
  ANALYSIS = 'analysis',
  CREATIVE_WRITING = 'creative_writing',
  SUMMARIZATION = 'summarization',
  TRANSLATION = 'translation',
  MATH = 'math',
  REASONING = 'reasoning',
}

export interface AIProvider {
  id: string;
  name: string;
  providerKey: ProviderKey;
  status: ProviderStatus;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AIModel {
  id: string;
  providerId: string;
  modelKey: string;
  displayName: string;
  capabilities: ModelCapability[];
  contextWindow: number;
  pricing: ModelPricing;
  status: ModelStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ModelPricing {
  inputPricePerMillionTokens: number | null;
  outputPricePerMillionTokens: number | null;
  currency: string;
  pricingVersion: string;
  lastUpdated: string;
}

export interface ModelInfo {
  id: string;
  providerKey: ProviderKey;
  providerName: string;
  modelKey: string;
  displayName: string;
  capabilities: ModelCapability[];
  contextWindow: number;
  pricing: ModelPricing;
  status: ModelStatus;
}

export interface ProviderHealth {
  providerKey: ProviderKey;
  status: ProviderStatus;
  latencyMs: number | null;
  lastChecked: string;
  error: string | null;
}
