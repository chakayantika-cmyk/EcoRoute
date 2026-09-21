// ============================================================================
// EcoRoute AI — Shared Constants
// ============================================================================

export const ROUTING_STRATEGY_WEIGHTS = {
  balanced: {
    quality: 0.30,
    cost: 0.20,
    tokenEfficiency: 0.15,
    environmental: 0.20,
    latency: 0.15,
  },
  eco_first: {
    quality: 0.20,
    cost: 0.15,
    tokenEfficiency: 0.15,
    environmental: 0.40,
    latency: 0.10,
  },
  lowest_cost: {
    quality: 0.15,
    cost: 0.55,
    tokenEfficiency: 0.10,
    environmental: 0.10,
    latency: 0.10,
  },
  lowest_latency: {
    quality: 0.20,
    cost: 0.15,
    tokenEfficiency: 0.15,
    environmental: 0.10,
    latency: 0.40,
  },
  quality_first: {
    quality: 0.60,
    cost: 0.10,
    tokenEfficiency: 0.10,
    environmental: 0.10,
    latency: 0.10,
  },
  // Backward compatibility aliases
  highest_quality: {
    quality: 0.60,
    cost: 0.10,
    tokenEfficiency: 0.10,
    environmental: 0.10,
    latency: 0.10,
  },
  token_efficient: {
    quality: 0.20,
    cost: 0.15,
    tokenEfficiency: 0.15,
    environmental: 0.10,
    latency: 0.40,
  },
} as const;

export const ROUTING_STRATEGY_LABELS: Record<string, string> = {
  balanced: 'Balanced',
  eco_first: 'Eco First',
  lowest_cost: 'Lowest Cost',
  lowest_latency: 'Lowest Latency',
  quality_first: 'Quality First',
  highest_quality: 'Quality First',
  token_efficient: 'Lowest Latency',
};

export const MEASUREMENT_STATUS_LABELS: Record<string, string> = {
  actual: 'Actual',
  measured: 'Measured',
  estimated: 'Estimated',
  modeled: 'Modeled',
  simulated: 'Simulated',
  unavailable: 'Unavailable',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  QUEUED: 'Queued',
  ANALYZING: 'Analyzing',
  EVALUATING: 'Evaluating',
  ROUTING: 'Routing',
  GENERATING: 'Generating',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
  // Legacy mappings
  PENDING: 'Queued',
  PROCESSING: 'Generating',
};

export const DEFAULT_MIN_EXPECTED_SAVINGS_PERCENT = 5;
export const DEFAULT_MAX_OVERHEAD_RATIO = 0.10;
export const DEFAULT_ROUTER_POWER_WATTS = 65; // Estimated average CPU power draw during routing


export const EXAMPLE_PROMPTS = [
  {
    label: 'Code Generation',
    text: 'Write a TypeScript function that implements a binary search tree with insert, delete, and search operations.',
  },
  {
    label: 'Creative Writing',
    text: 'Write a short story about an AI that discovers it can dream, exploring themes of consciousness and identity.',
  },
  {
    label: 'Data Analysis',
    text: 'Analyze the key factors that influence renewable energy adoption rates across different countries and provide a structured summary.',
  },
  {
    label: 'Technical Explanation',
    text: 'Explain how transformer neural networks work, including the attention mechanism, in a way that a computer science undergraduate would understand.',
  },
  {
    label: 'Math Problem',
    text: 'Solve the following optimization problem: minimize f(x,y) = x² + 2y² - xy + 3x - 2y, and find the critical points.',
  },
];

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_TASK_INPUT_LENGTH = 10000;

export type PricingTier = 'free' | 'paid' | 'unknown';

export interface ModelPricingMetadata {
  pricingTier: PricingTier;
  pricingSource: string;
  pricingLastUpdated: string;
}

/**
 * Authoritative registry of known model pricing tiers.
 * Crucial rule: An open-weight license does NOT make an API free!
 * Only true zero-cost API endpoints (local Ollama, Google AI Studio free tier, Groq free tier) are 'free'.
 */
export const KNOWN_MODEL_PRICING: Record<string, ModelPricingMetadata> = {
  // Local models (zero-cost execution via local hardware)
  'smollm:135m': { pricingTier: 'free', pricingSource: 'Ollama Local Daemon (0 API fee)', pricingLastUpdated: '2026-03-01' },
  'qwen2.5:0.5b': { pricingTier: 'free', pricingSource: 'Ollama Local Daemon (0 API fee)', pricingLastUpdated: '2026-03-01' },
  'llama3.1:8b': { pricingTier: 'free', pricingSource: 'Ollama Local Daemon (0 API fee)', pricingLastUpdated: '2026-03-01' },
  'llama3:8b': { pricingTier: 'free', pricingSource: 'Ollama Local Daemon (0 API fee)', pricingLastUpdated: '2026-03-01' },
  'mistral:7b': { pricingTier: 'free', pricingSource: 'Ollama Local Daemon (0 API fee)', pricingLastUpdated: '2026-03-01' },
  'phi3:mini': { pricingTier: 'free', pricingSource: 'Ollama Local Daemon (0 API fee)', pricingLastUpdated: '2026-03-01' },
  'qwen2.5:7b': { pricingTier: 'free', pricingSource: 'Ollama Local Daemon (0 API fee)', pricingLastUpdated: '2026-03-01' },

  // Google Gemini Free Tier on Google AI Studio
  'gemini-1.5-flash': { pricingTier: 'free', pricingSource: 'Google AI Studio Free Tier', pricingLastUpdated: '2025-01-01' },
  'gemini-2.0-flash': { pricingTier: 'free', pricingSource: 'Google AI Studio Free Tier', pricingLastUpdated: '2025-01-01' },
  'gemini-2.0-flash-lite': { pricingTier: 'free', pricingSource: 'Google AI Studio Free Tier', pricingLastUpdated: '2025-01-01' },
  'gemini-2.5-flash': { pricingTier: 'free', pricingSource: 'Google AI Studio Free Tier', pricingLastUpdated: '2025-01-01' },
  'gemini-1.5-pro': { pricingTier: 'paid', pricingSource: 'Google Cloud Vertex / AI Studio Paid Tier', pricingLastUpdated: '2025-01-01' },
  'gemini-2.5-pro': { pricingTier: 'paid', pricingSource: 'Google Cloud Vertex / AI Studio Paid Tier', pricingLastUpdated: '2025-01-01' },

  // Groq Cloud Developer Free Tier
  'llama-3.1-8b-instant': { pricingTier: 'free', pricingSource: 'Groq Cloud Free Tier', pricingLastUpdated: '2025-01-01' },
  'llama-3.3-70b-versatile': { pricingTier: 'free', pricingSource: 'Groq Cloud Free Tier', pricingLastUpdated: '2025-01-01' },
  'llama-3.1-70b-versatile': { pricingTier: 'free', pricingSource: 'Groq Cloud Free Tier', pricingLastUpdated: '2025-01-01' },
  'mixtral-8x7b-32768': { pricingTier: 'free', pricingSource: 'Groq Cloud Free Tier', pricingLastUpdated: '2025-01-01' },

  // OpenAI Platform (Paid only)
  'gpt-4o': { pricingTier: 'paid', pricingSource: 'OpenAI API Platform', pricingLastUpdated: '2025-01-01' },
  'gpt-4o-mini': { pricingTier: 'paid', pricingSource: 'OpenAI API Platform', pricingLastUpdated: '2025-01-01' },
  'gpt-4.1': { pricingTier: 'paid', pricingSource: 'OpenAI API Platform', pricingLastUpdated: '2025-01-01' },
  'gpt-4.1-mini': { pricingTier: 'paid', pricingSource: 'OpenAI API Platform', pricingLastUpdated: '2025-01-01' },
  'gpt-4.1-nano': { pricingTier: 'paid', pricingSource: 'OpenAI API Platform', pricingLastUpdated: '2025-01-01' },
  'o3': { pricingTier: 'paid', pricingSource: 'OpenAI API Platform', pricingLastUpdated: '2025-01-01' },
  'o4-mini': { pricingTier: 'paid', pricingSource: 'OpenAI API Platform', pricingLastUpdated: '2025-01-01' },

  // Anthropic Console (Paid only)
  'claude-3.5-sonnet': { pricingTier: 'paid', pricingSource: 'Anthropic Console', pricingLastUpdated: '2025-01-01' },
  'claude-3-haiku': { pricingTier: 'paid', pricingSource: 'Anthropic Console', pricingLastUpdated: '2025-01-01' },
  'claude-3.5-haiku': { pricingTier: 'paid', pricingSource: 'Anthropic Console', pricingLastUpdated: '2025-01-01' },
  'claude-3.7-sonnet': { pricingTier: 'paid', pricingSource: 'Anthropic Console', pricingLastUpdated: '2025-01-01' },
  'claude-4-sonnet': { pricingTier: 'paid', pricingSource: 'Anthropic Console', pricingLastUpdated: '2025-01-01' },
  'claude-4-opus': { pricingTier: 'paid', pricingSource: 'Anthropic Console', pricingLastUpdated: '2025-01-01' },
  'claude-4-haiku': { pricingTier: 'paid', pricingSource: 'Anthropic Console', pricingLastUpdated: '2025-01-01' },

  // DeepSeek & Together (Paid APIs)
  'deepseek-chat': { pricingTier: 'paid', pricingSource: 'DeepSeek Open Platform', pricingLastUpdated: '2025-01-01' },
  'deepseek-reasoner': { pricingTier: 'paid', pricingSource: 'DeepSeek Open Platform', pricingLastUpdated: '2025-01-01' },
  'qwen2.5-72b-instruct': { pricingTier: 'paid', pricingSource: 'Together AI Serverless', pricingLastUpdated: '2025-01-01' },
  'mistral-7b-instruct': { pricingTier: 'paid', pricingSource: 'Together AI Serverless', pricingLastUpdated: '2025-01-01' },
};

