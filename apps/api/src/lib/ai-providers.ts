// ============================================================================
// AI Providers — Live API Integrations & Explicit Execution Engine
// Strict Production Rule: Never silently fall back to hardcoded/fake answers.
// Mock mode is ONLY used when AI_MOCK_MODE=true or for explicit mock models.
// ============================================================================

import { AdapterFactory } from './adapters/adapter-factory';
import { ModelSpec, NormalizedGenerationRequest, NormalizedGenerationResponse } from './adapters/provider-adapter.interface';
import { ProviderNotConfiguredError, ProviderError } from './errors';

export interface ProviderCallResult {
  answer: string;
  actualTokens: number;
  inputTokens: number;
  outputTokens: number;
  actualCost: number | null;
  providerRequestId: string;
  isLive: boolean;
  latencyMs: number;
}

export interface ModelContext {
  modelKey: string;
  displayName: string;
  providerKey: string;
  providerName: string;
  providerModelId?: string | null;
  adapterType?: string | null;
  baseUrl?: string | null;
  capabilities?: string[];
  contextWindow?: number;
  pricing: {
    inputPricePerMillionTokens: number | null;
    outputPricePerMillionTokens: number | null;
  };
}

/**
 * Validates whether credentials exist for a given provider
 */
export function isProviderConfigured(providerKey: string, apiKeyOverride?: string): boolean {
  if (apiKeyOverride && apiKeyOverride.trim().length > 0) return true;
  if (providerKey === 'ollama' || providerKey === 'mock') return true;

  switch (providerKey) {
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);
    case 'anthropic':
      return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 0);
    case 'google_gemini':
      return Boolean(process.env.GOOGLE_GEMINI_API_KEY && process.env.GOOGLE_GEMINI_API_KEY.trim().length > 0);
    case 'groq':
      return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0);
    case 'deepseek':
      return Boolean(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.trim().length > 0);
    case 'together':
      return Boolean(process.env.TOGETHER_API_KEY && process.env.TOGETHER_API_KEY.trim().length > 0);
    default:
      return false;
  }
}

/**
 * Executes a call to the specified model provider using the AdapterFactory.
 * In production (AI_MOCK_MODE=false), if the provider is not configured or fails,
 * throws a structured error. Never silently falls back to a fake answer.
 */
export async function executeModelCall(
  prompt: string,
  model: ModelContext,
  apiKeyOverride?: string,
  abortSignal?: AbortSignal,
): Promise<ProviderCallResult> {
  const isMockModeExplicit = process.env.AI_MOCK_MODE === 'true';
  const isMockModel = model.providerKey === 'mock';

  // Explicit Mock Mode Handling
  if (isMockModeExplicit || isMockModel) {
    const mockAdapter = AdapterFactory.getAdapter({
      id: 'mock-provider',
      providerKey: 'mock',
      name: 'Mock Simulation Engine',
      adapterType: 'mock',
      enabled: true,
    });

    const modelSpec: ModelSpec = {
      modelKey: model.modelKey,
      displayName: model.displayName,
      providerModelId: model.providerModelId,
      contextWindow: model.contextWindow || 32768,
      capabilities: model.capabilities || [],
      pricing: model.pricing,
    };

    const res = await mockAdapter.generate({
      prompt,
      model: model.modelKey,
      modelSpec,
      abortSignal,
    });

    return {
      answer: res.text,
      actualTokens: res.usage?.totalTokens ?? 0,
      inputTokens: res.usage?.inputTokens ?? 0,
      outputTokens: res.usage?.outputTokens ?? 0,
      actualCost: res.estimatedCostUsd ?? null,
      providerRequestId: res.providerRequestId || `mock-${Date.now()}`,
      isLive: false,
      latencyMs: res.latencyMs,
    };
  }

  // Production: Verify Provider Configuration
  const configured = isProviderConfigured(model.providerKey, apiKeyOverride);
  if (!configured) {
    throw new ProviderNotConfiguredError(
      model.providerName,
      `AI provider "${model.providerName}" is not configured with an API key. Please configure the key in Settings or enable AI_MOCK_MODE=true in your environment for testing.`,
    );
  }

  // Execute with the real provider adapter
  try {
    const adapterType =
      model.adapterType ||
      (model.providerKey === 'anthropic'
        ? 'anthropic'
        : model.providerKey === 'google_gemini'
        ? 'gemini'
        : 'openai_compatible');

    const adapter = AdapterFactory.getAdapter({
      id: model.providerKey,
      providerKey: model.providerKey,
      name: model.providerName,
      adapterType,
      baseUrl: model.baseUrl,
      apiKey: apiKeyOverride,
      enabled: true,
    });

    const modelSpec: ModelSpec = {
      modelKey: model.modelKey,
      displayName: model.displayName,
      providerModelId: model.providerModelId || model.modelKey,
      contextWindow: model.contextWindow || 32768,
      capabilities: model.capabilities || [],
      pricing: model.pricing,
    };

    const res: NormalizedGenerationResponse = await adapter.generate({
      prompt,
      model: model.providerModelId || model.modelKey,
      modelSpec,
      abortSignal,
    });

    return {
      answer: res.text,
      actualTokens: res.usage?.totalTokens ?? 0,
      inputTokens: res.usage?.inputTokens ?? 0,
      outputTokens: res.usage?.outputTokens ?? 0,
      actualCost: res.estimatedCostUsd ?? null,
      providerRequestId: res.providerRequestId || `${model.providerKey}-${Date.now()}`,
      isLive: true,
      latencyMs: res.latencyMs,
    };
  } catch (err: any) {
    if (err instanceof ProviderNotConfiguredError) throw err;
    throw new ProviderError(model.providerName, err.message || 'Execution failed against provider API');
  }
}

/**
 * Streams answer chunks from the selected model provider to a callback.
 */
export async function streamModelCall(
  prompt: string,
  model: ModelContext,
  onChunk: (chunk: string) => void,
  apiKeyOverride?: string,
  abortSignal?: AbortSignal,
): Promise<ProviderCallResult> {
  const isMockModeExplicit = process.env.AI_MOCK_MODE === 'true';
  const isMockModel = model.providerKey === 'mock';

  if (isMockModeExplicit || isMockModel) {
    const mockAdapter = AdapterFactory.getAdapter({
      id: 'mock-provider',
      providerKey: 'mock',
      name: 'Mock Simulation Engine',
      adapterType: 'mock',
      enabled: true,
    });

    const modelSpec: ModelSpec = {
      modelKey: model.modelKey,
      displayName: model.displayName,
      providerModelId: model.providerModelId,
      contextWindow: model.contextWindow || 32768,
      capabilities: model.capabilities || [],
      pricing: model.pricing,
    };

    const res = await mockAdapter.generateStream!(
      {
        prompt,
        model: model.modelKey,
        modelSpec,
        abortSignal,
      },
      onChunk,
    );

    return {
      answer: res.text,
      actualTokens: res.usage?.totalTokens ?? 0,
      inputTokens: res.usage?.inputTokens ?? 0,
      outputTokens: res.usage?.outputTokens ?? 0,
      actualCost: res.estimatedCostUsd ?? null,
      providerRequestId: res.providerRequestId || `mock-${Date.now()}`,
      isLive: false,
      latencyMs: res.latencyMs,
    };
  }

  // Production: Check configuration
  const configured = isProviderConfigured(model.providerKey, apiKeyOverride);
  if (!configured) {
    throw new ProviderNotConfiguredError(
      model.providerName,
      `AI provider "${model.providerName}" is not configured with an API key. Please configure the key in Settings or enable AI_MOCK_MODE=true in your environment for testing.`,
    );
  }

  const adapterType =
    model.adapterType ||
    (model.providerKey === 'anthropic'
      ? 'anthropic'
      : model.providerKey === 'google_gemini'
      ? 'gemini'
      : 'openai_compatible');

  const adapter = AdapterFactory.getAdapter({
    id: model.providerKey,
    providerKey: model.providerKey,
    name: model.providerName,
    adapterType,
    baseUrl: model.baseUrl,
    apiKey: apiKeyOverride,
    enabled: true,
  });

  const modelSpec: ModelSpec = {
    modelKey: model.modelKey,
    displayName: model.displayName,
    providerModelId: model.providerModelId || model.modelKey,
    contextWindow: model.contextWindow || 32768,
    capabilities: model.capabilities || [],
    pricing: model.pricing,
  };

  const req: NormalizedGenerationRequest = {
    prompt,
    model: model.providerModelId || model.modelKey,
    modelSpec,
    abortSignal,
  };

  try {
    if (adapter.generateStream) {
      const res = await adapter.generateStream(req, onChunk);
      return {
        answer: res.text,
        actualTokens: res.usage?.totalTokens ?? 0,
        inputTokens: res.usage?.inputTokens ?? 0,
        outputTokens: res.usage?.outputTokens ?? 0,
        actualCost: res.estimatedCostUsd ?? null,
        providerRequestId: res.providerRequestId || `${model.providerKey}-${Date.now()}`,
        isLive: true,
        latencyMs: res.latencyMs,
      };
    } else {
      const res = await adapter.generate(req);
      onChunk(res.text);
      return {
        answer: res.text,
        actualTokens: res.usage?.totalTokens ?? 0,
        inputTokens: res.usage?.inputTokens ?? 0,
        outputTokens: res.usage?.outputTokens ?? 0,
        actualCost: res.estimatedCostUsd ?? null,
        providerRequestId: res.providerRequestId || `${model.providerKey}-${Date.now()}`,
        isLive: true,
        latencyMs: res.latencyMs,
      };
    }
  } catch (err: any) {
    if (err instanceof ProviderNotConfiguredError) throw err;
    throw new ProviderError(model.providerName, err.message || 'Stream generation failed');
  }
}
