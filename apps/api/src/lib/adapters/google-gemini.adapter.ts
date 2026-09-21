// ============================================================================
// Google Gemini Provider Adapter
// Supports Gemini 1.5, 2.0, 2.5 series via Google Generative Language API
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
import { ProviderNotConfiguredError } from '../errors';

const PROVIDER_TIMEOUT_MS = 30000;

export class GoogleGeminiAdapter implements AIProviderAdapter {
  readonly providerKey: string = 'google_gemini';
  readonly adapterType: string = 'gemini';
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    this.baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    this.apiKey = config.apiKey || process.env.GOOGLE_GEMINI_API_KEY || '';
  }

  get provider(): string {
    return this.providerKey;
  }

  async healthCheck(testModelKey?: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    if (!this.apiKey) {
      return {
        providerKey: this.providerKey,
        status: 'DEGRADED',
        latencyMs: 0,
        message: 'No Google Gemini API key configured',
        testedModel: testModelKey,
        checkedAt: new Date().toISOString(),
        error: 'Missing API key',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const res = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`, {
        method: 'GET',
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        return {
          providerKey: this.providerKey,
          status: latencyMs > 2500 ? 'DEGRADED' : 'HEALTHY',
          latencyMs,
          message: `Google Gemini API reachable (${latencyMs}ms)`,
          testedModel: testModelKey,
          checkedAt: new Date().toISOString(),
          error: null,
        };
      } else if (res.status === 400 || res.status === 403) {
        return {
          providerKey: this.providerKey,
          status: 'DEGRADED',
          latencyMs,
          message: 'Invalid or restricted Gemini API key',
          testedModel: testModelKey,
          checkedAt: new Date().toISOString(),
          error: `HTTP ${res.status}`,
        };
      } else {
        return {
          providerKey: this.providerKey,
          status: 'UNHEALTHY',
          latencyMs,
          message: `Gemini API error: ${res.status} ${res.statusText}`,
          testedModel: testModelKey,
          checkedAt: new Date().toISOString(),
          error: `HTTP ${res.status}`,
        };
      }
    } catch (err: any) {
      return {
        providerKey: this.providerKey,
        status: 'UNHEALTHY',
        latencyMs: Date.now() - startTime,
        message: err.name === 'AbortError' ? 'Gemini API timed out' : (err.message || 'Connection failed'),
        testedModel: testModelKey,
        checkedAt: new Date().toISOString(),
        error: err.message,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generate(request: NormalizedGenerationRequest): Promise<NormalizedGenerationResponse> {
    if (!this.apiKey) {
      throw new ProviderNotConfiguredError(this.providerKey);
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    if (request.abortSignal) {
      request.abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      let modelTarget = request.model;
      if (modelTarget.startsWith('models/')) {
        modelTarget = modelTarget.replace('models/', '');
      }

      const url = `${this.baseUrl}/models/${modelTarget}:generateContent?key=${this.apiKey}`;

      const body: Record<string, any> = {
        contents: [{ parts: [{ text: request.prompt }] }],
        generationConfig: {
          maxOutputTokens: request.maxOutputTokens ?? 2048,
          temperature: request.temperature ?? 0.7,
        },
      };

      if (request.systemPrompt) {
        body.systemInstruction = {
          parts: [{ text: request.systemPrompt }],
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Google Gemini error (${res.status}): ${errBody || res.statusText}`);
      }

      const data: any = await res.json();
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((p: any) => p.text).join('') || '';
      const finishReason = candidate?.finishReason || 'STOP';

      const inputTokens = data.usageMetadata?.promptTokenCount ?? Math.ceil(request.prompt.length / 4);
      const outputTokens = data.usageMetadata?.candidatesTokenCount ?? Math.ceil(text.length / 4);
      const totalTokens = data.usageMetadata?.totalTokenCount ?? (inputTokens + outputTokens);

      let estimatedCostUsd: number | undefined;
      if (request.modelSpec?.pricing) {
        const inPrice = request.modelSpec.pricing.inputPricePerMillionTokens ?? 0;
        const outPrice = request.modelSpec.pricing.outputPricePerMillionTokens ?? 0;
        estimatedCostUsd = (inputTokens * inPrice + outputTokens * outPrice) / 1_000_000;
      }

      return {
        text,
        model: request.model,
        provider: this.providerKey,
        usage: { inputTokens, outputTokens, totalTokens },
        latencyMs,
        providerRequestId: `gemini-${Date.now()}`,
        finishReason,
        estimatedCostUsd,
        isLive: true,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateStream(
    request: NormalizedGenerationRequest,
    onChunk: (chunk: string) => void,
  ): Promise<NormalizedGenerationResponse> {
    if (!this.apiKey) {
      throw new ProviderNotConfiguredError(this.providerKey);
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    if (request.abortSignal) {
      request.abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      let modelTarget = request.model;
      if (modelTarget.startsWith('models/')) {
        modelTarget = modelTarget.replace('models/', '');
      }

      // Gemini supports server-sent events via alt=sse
      const url = `${this.baseUrl}/models/${modelTarget}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

      const body: Record<string, any> = {
        contents: [{ parts: [{ text: request.prompt }] }],
        generationConfig: {
          maxOutputTokens: request.maxOutputTokens ?? 2048,
          temperature: request.temperature ?? 0.7,
        },
      };

      if (request.systemPrompt) {
        body.systemInstruction = {
          parts: [{ text: request.systemPrompt }],
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Google Gemini stream error (${res.status}): ${errBody || res.statusText}`);
      }

      if (!res.body) {
        throw new Error('Google Gemini returned empty body');
      }

      let fullText = '';
      let finishReason = 'STOP';
      let inputTokens = Math.ceil(request.prompt.length / 4);
      let outputTokens = 0;

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const candidate = parsed.candidates?.[0];
            const chunkText = candidate?.content?.parts?.map((p: any) => p.text).join('') || '';

            if (chunkText) {
              fullText += chunkText;
              onChunk(chunkText);
            }

            if (candidate?.finishReason) {
              finishReason = candidate.finishReason;
            }

            if (parsed.usageMetadata) {
              if (parsed.usageMetadata.promptTokenCount) inputTokens = parsed.usageMetadata.promptTokenCount;
              if (parsed.usageMetadata.candidatesTokenCount) outputTokens = parsed.usageMetadata.candidatesTokenCount;
            }
          } catch {
            // Ignore partial SSE parsing issues
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      if (outputTokens === 0) outputTokens = Math.ceil(fullText.length / 4);
      const totalTokens = inputTokens + outputTokens;

      let estimatedCostUsd: number | undefined;
      if (request.modelSpec?.pricing) {
        const inPrice = request.modelSpec.pricing.inputPricePerMillionTokens ?? 0;
        const outPrice = request.modelSpec.pricing.outputPricePerMillionTokens ?? 0;
        estimatedCostUsd = (inputTokens * inPrice + outputTokens * outPrice) / 1_000_000;
      }

      return {
        text: fullText,
        model: request.model,
        provider: this.providerKey,
        usage: { inputTokens, outputTokens, totalTokens },
        latencyMs,
        providerRequestId: `gemini-${Date.now()}`,
        finishReason,
        estimatedCostUsd,
        isLive: true,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateText(request: ExecutionRequest): Promise<ExecutionResponse> {
    const res = await this.generate({
      prompt: request.prompt,
      systemPrompt: request.systemPrompt,
      model: request.model.providerModelId || request.model.modelKey,
      modelSpec: request.model,
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      abortSignal: request.abortSignal,
    });

    return {
      answer: res.text,
      actualTokens: res.usage?.totalTokens ?? 0,
      inputTokens: res.usage?.inputTokens ?? 0,
      outputTokens: res.usage?.outputTokens ?? 0,
      actualCost: res.estimatedCostUsd ?? null,
      providerRequestId: res.providerRequestId || `gemini-${Date.now()}`,
      isLive: res.isLive,
      latencyMs: res.latencyMs,
      modelKey: request.model.modelKey,
      finishReason: res.finishReason,
    };
  }

  async listRemoteModels(): Promise<DiscoveredModel[]> {
    if (!this.apiKey) return [];

    const res = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);
    if (!res.ok) return [];

    const data: any = await res.json();
    const list = data.models || [];
    return list.map((m: any) => ({
      providerModelId: m.name?.replace('models/', '') || m.name,
      displayName: m.displayName || m.name,
      contextWindow: m.inputTokenLimit,
    }));
  }
}
