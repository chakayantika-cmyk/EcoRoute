// ============================================================================
// Mock Provider Adapter
// High-fidelity offline simulation for testing, evaluation, and offline development mode
// ONLY usable when explicitly enabled via AI_MOCK_MODE=true
// ============================================================================

import {
  AIProviderAdapter,
  ProviderConfig,
  ExecutionRequest,
  ExecutionResponse,
  HealthCheckResult,
  DiscoveredModel,
  NormalizedGenerationRequest,
  NormalizedGenerationResponse,
} from './provider-adapter.interface';
import { generateDynamicResponse } from '../dynamic-synthesizer';

export class MockProviderAdapter implements AIProviderAdapter {
  readonly providerKey: string = 'mock';
  readonly adapterType: string = 'mock';

  constructor(_config?: ProviderConfig) {}

  get provider(): string {
    return this.providerKey;
  }

  async healthCheck(testModelKey?: string): Promise<HealthCheckResult> {
    return {
      providerKey: this.providerKey,
      status: 'HEALTHY',
      latencyMs: 1,
      message: 'Mock provider offline engine active (Explicit AI_MOCK_MODE enabled)',
      testedModel: testModelKey,
      checkedAt: new Date().toISOString(),
      error: null,
    };
  }

  async generate(request: NormalizedGenerationRequest): Promise<NormalizedGenerationResponse> {
    const startTime = Date.now();
    const result = generateDynamicResponse(request.prompt, {
      modelKey: request.model,
      displayName: request.modelSpec?.displayName || request.model,
      providerName: 'Mock Provider Engine',
      providerKey: this.providerKey,
    });

    const latencyMs = Math.max(1, Date.now() - startTime);
    const inputTokens = result.tokens.inputTokens;
    const outputTokens = result.tokens.outputTokens;
    const totalTokens = result.tokens.totalTokens;

    let estimatedCostUsd: number | undefined;
    if (request.modelSpec?.pricing) {
      const inPrice = request.modelSpec.pricing.inputPricePerMillionTokens ?? 0.1;
      const outPrice = request.modelSpec.pricing.outputPricePerMillionTokens ?? 0.3;
      estimatedCostUsd = (inputTokens * inPrice + outputTokens * outPrice) / 1_000_000;
    }

    return {
      text: result.answer,
      model: request.model,
      provider: this.providerKey,
      usage: { inputTokens, outputTokens, totalTokens },
      latencyMs,
      providerRequestId: `mock-${request.model}-${Date.now()}`,
      finishReason: 'stop',
      estimatedCostUsd,
      isLive: false,
    };
  }

  async generateStream(
    request: NormalizedGenerationRequest,
    onChunk: (chunk: string) => void,
  ): Promise<NormalizedGenerationResponse> {
    const startTime = Date.now();
    const result = generateDynamicResponse(request.prompt, {
      modelKey: request.model,
      displayName: request.modelSpec?.displayName || request.model,
      providerName: 'Mock Provider Engine',
      providerKey: this.providerKey,
    });

    // Stream the generated answer in natural word tokens without artificial delay
    const words = result.answer.split(/(\s+)/);
    for (const word of words) {
      if (word) {
        onChunk(word);
      }
    }

    const latencyMs = Math.max(1, Date.now() - startTime);
    const inputTokens = result.tokens.inputTokens;
    const outputTokens = result.tokens.outputTokens;
    const totalTokens = result.tokens.totalTokens;

    let estimatedCostUsd: number | undefined;
    if (request.modelSpec?.pricing) {
      const inPrice = request.modelSpec.pricing.inputPricePerMillionTokens ?? 0.1;
      const outPrice = request.modelSpec.pricing.outputPricePerMillionTokens ?? 0.3;
      estimatedCostUsd = (inputTokens * inPrice + outputTokens * outPrice) / 1_000_000;
    }

    return {
      text: result.answer,
      model: request.model,
      provider: this.providerKey,
      usage: { inputTokens, outputTokens, totalTokens },
      latencyMs,
      providerRequestId: `mock-${request.model}-${Date.now()}`,
      finishReason: 'stop',
      estimatedCostUsd,
      isLive: false,
    };
  }

  async generateText(request: ExecutionRequest): Promise<ExecutionResponse> {
    const res = await this.generate({
      prompt: request.prompt,
      systemPrompt: request.systemPrompt,
      model: request.model.providerModelId || request.model.modelKey,
      modelSpec: request.model,
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
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
      modelKey: request.model.modelKey,
      finishReason: res.finishReason,
    };
  }

  async listRemoteModels(): Promise<DiscoveredModel[]> {
    return [
      { providerModelId: 'mock-fast-lowcost', displayName: 'Mock Fast & Low-Cost' },
      { providerModelId: 'mock-high-reasoning', displayName: 'Mock High Reasoning' },
      { providerModelId: 'mock-code-architect', displayName: 'Mock Code Architect' },
      { providerModelId: 'mock-long-context', displayName: 'Mock Long-Context Specialist' },
      { providerModelId: 'mock-vision-multimodal', displayName: 'Mock Vision & Multimodal' },
      { providerModelId: 'mock-local-openweight', displayName: 'Mock Local Open-Weight' },
      { providerModelId: 'mock-balanced-general', displayName: 'Mock Balanced General' },
      { providerModelId: 'mock-eco-ultra', displayName: 'Mock Eco Ultra' },
      { providerModelId: 'mock-compact-summarizer', displayName: 'Mock Compact Summarizer' },
      { providerModelId: 'mock-polyglot-translator', displayName: 'Mock Polyglot Translator' },
    ];
  }
}
