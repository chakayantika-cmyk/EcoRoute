// ============================================================================
// OpenAI-Compatible Provider Adapter
// Supports OpenAI, Groq, DeepSeek, Together AI, Ollama, vLLM, and any OpenAI-compatible endpoint
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
import { ProviderModelUnavailableError } from '../errors';
import { ProviderHealthService } from '../../modules/providers/provider-health.service';

const PROVIDER_TIMEOUT_MS = 30000;

export class OpenAICompatibleAdapter implements AIProviderAdapter {
  readonly providerKey: string;
  readonly adapterType: string = 'openai_compatible';
  private baseUrl: string;
  private apiKey: string;
  private organizationId?: string;

  constructor(config: ProviderConfig) {
    this.providerKey = config.providerKey;

    // Resolve base URL
    if (config.baseUrl && config.baseUrl.trim()) {
      this.baseUrl = config.baseUrl.replace(/\/+$/, '');
      if (config.providerKey === 'ollama' && !this.baseUrl.endsWith('/v1')) {
        this.baseUrl = `${this.baseUrl}/v1`;
      }
    } else {
      switch (config.providerKey) {
        case 'groq':
          this.baseUrl = 'https://api.groq.com/openai/v1';
          break;
        case 'deepseek':
          this.baseUrl = 'https://api.deepseek.com/v1';
          break;
        case 'together':
          this.baseUrl = 'https://api.together.xyz/v1';
          break;
        case 'ollama':
          this.baseUrl = 'http://localhost:11434/v1';
          break;
        default:
          this.baseUrl = 'https://api.openai.com/v1';
          break;
      }
    }

    // Resolve API key
    this.apiKey = config.apiKey || '';
    if (!this.apiKey) {
      if (config.providerKey === 'openai') {
        this.apiKey = process.env.OPENAI_API_KEY || '';
      } else if (config.providerKey === 'groq') {
        this.apiKey = process.env.GROQ_API_KEY || '';
      } else if (config.providerKey === 'deepseek') {
        this.apiKey = process.env.DEEPSEEK_API_KEY || '';
      } else if (config.providerKey === 'together') {
        this.apiKey = process.env.TOGETHER_API_KEY || '';
      }
    }

    this.organizationId = config.organizationId || undefined;
  }

  get provider(): string {
    return this.providerKey;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    if (this.organizationId) {
      headers['OpenAI-Organization'] = this.organizationId;
    }
    return headers;
  }

  async healthCheck(testModelKey?: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        return {
          providerKey: this.providerKey,
          status: latencyMs > 2500 ? 'DEGRADED' : 'HEALTHY',
          latencyMs,
          message: `Endpoint reachable (${res.status} OK)`,
          testedModel: testModelKey,
          checkedAt: new Date().toISOString(),
          error: null,
        };
      } else if (res.status === 401 || res.status === 403) {
        return {
          providerKey: this.providerKey,
          status: 'DEGRADED',
          latencyMs,
          message: `Authentication failed (${res.status}): Missing or invalid API key`,
          testedModel: testModelKey,
          checkedAt: new Date().toISOString(),
          error: `HTTP ${res.status}`,
        };
      } else {
        return {
          providerKey: this.providerKey,
          status: 'UNHEALTHY',
          latencyMs,
          message: `Endpoint error: ${res.status} ${res.statusText}`,
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
        message: err.name === 'AbortError' ? 'Health check timed out' : (err.message || 'Connection failed'),
        testedModel: testModelKey,
        checkedAt: new Date().toISOString(),
        error: err.message,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generate(request: NormalizedGenerationRequest): Promise<NormalizedGenerationResponse> {
    if (!this.apiKey && this.providerKey !== 'ollama') {
      throw new Error(`PROVIDER_NOT_CONFIGURED: API key missing for provider ${this.providerKey}`);
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    if (request.abortSignal) {
      request.abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      const messages: Array<{ role: string; content: string }> = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const payload: Record<string, any> = {
        model: request.model,
        messages,
        max_tokens: request.maxOutputTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
      };

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        if (res.status === 404 || errBody.toLowerCase().includes('not found')) {
          ProviderHealthService.invalidate(this.providerKey);
          throw new ProviderModelUnavailableError(
            this.providerKey,
            request.model,
            `Provider ${this.providerKey} error (404): ${errBody || res.statusText}`,
          );
        }
        throw new Error(`Provider ${this.providerKey} error (${res.status}): ${errBody || res.statusText}`);
      }

      const data: any = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      const finishReason = data.choices?.[0]?.finish_reason || 'stop';
      const usage = data.usage || {};
      const inputTokens = usage.prompt_tokens ?? Math.ceil(request.prompt.length / 4);
      const outputTokens = usage.completion_tokens ?? Math.ceil(text.length / 4);
      const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);

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
        providerRequestId: data.id || `${this.providerKey}-${Date.now()}`,
        finishReason,
        estimatedCostUsd,
        isLive: true,
        rawMetadata: { systemFingerprint: data.system_fingerprint },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateStream(
    request: NormalizedGenerationRequest,
    onChunk: (chunk: string) => void,
  ): Promise<NormalizedGenerationResponse> {
    if (!this.apiKey && this.providerKey !== 'ollama') {
      throw new Error(`PROVIDER_NOT_CONFIGURED: API key missing for provider ${this.providerKey}`);
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    if (request.abortSignal) {
      request.abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      const messages: Array<{ role: string; content: string }> = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const payload: Record<string, any> = {
        model: request.model,
        messages,
        max_tokens: request.maxOutputTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
        stream: true,
      };

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        if (res.status === 404 || errBody.toLowerCase().includes('not found')) {
          ProviderHealthService.invalidate(this.providerKey);
          throw new ProviderModelUnavailableError(
            this.providerKey,
            request.model,
            `Provider ${this.providerKey} stream error (404): ${errBody || res.statusText}`,
          );
        }
        throw new Error(`Provider ${this.providerKey} stream error (${res.status}): ${errBody || res.statusText}`);
      }

      if (!res.body) {
        throw new Error(`Provider ${this.providerKey} returned empty body`);
      }

      let fullText = '';
      let finishReason = 'stop';
      let providerRequestId = `${this.providerKey}-${Date.now()}`;
      let usage: any = undefined;

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
            if (parsed.id) providerRequestId = parsed.id;
            if (parsed.usage) usage = parsed.usage;

            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              onChunk(delta);
            }
            if (parsed.choices?.[0]?.finish_reason) {
              finishReason = parsed.choices[0].finish_reason;
            }
          } catch {
            // Ignore partial SSE JSON parse errors
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      const inputTokens = usage?.prompt_tokens ?? Math.ceil(request.prompt.length / 4);
      const outputTokens = usage?.completion_tokens ?? Math.ceil(fullText.length / 4);
      const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens);

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
        providerRequestId,
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
      providerRequestId: res.providerRequestId || `${this.providerKey}-${Date.now()}`,
      isLive: res.isLive,
      latencyMs: res.latencyMs,
      modelKey: request.model.modelKey,
      finishReason: res.finishReason,
    };
  }

  async listRemoteModels(): Promise<DiscoveredModel[]> {
    const res = await fetch(`${this.baseUrl}/models`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to list remote models (${res.status})`);
    }

    const data: any = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];
    return list.map((item: any) => ({
      providerModelId: item.id,
      displayName: item.id,
      created: item.created,
      ownedBy: item.owned_by,
    }));
  }
}
