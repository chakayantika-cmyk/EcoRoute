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

export type PricingTier = 'free' | 'paid' | 'unknown';
export type ExecutionMode = 'cloud' | 'local';

export enum ModelAvailabilityStatus {
  READY = 'READY',
  MISSING_API_KEY = 'MISSING_API_KEY',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  LOCAL_MODEL_NOT_INSTALLED = 'LOCAL_MODEL_NOT_INSTALLED',
  OLLAMA_UNREACHABLE = 'OLLAMA_UNREACHABLE',
  PROVIDER_UNREACHABLE = 'PROVIDER_UNREACHABLE',
  FREE_TIER_QUOTA_EXHAUSTED = 'FREE_TIER_QUOTA_EXHAUSTED',
  RATE_LIMITED = 'RATE_LIMITED',
  PROVIDER_CAPACITY_LIMIT = 'PROVIDER_CAPACITY_LIMIT',
  PAID_MODEL_EXCLUDED = 'PAID_MODEL_EXCLUDED',
  PRICING_DATA_UNAVAILABLE = 'PRICING_DATA_UNAVAILABLE',
  PROVIDER_DISABLED = 'PROVIDER_DISABLED',
  CAPABILITY_MISMATCH = 'CAPABILITY_MISMATCH',
  CONTEXT_LIMIT_EXCEEDED = 'CONTEXT_LIMIT_EXCEEDED',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
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
