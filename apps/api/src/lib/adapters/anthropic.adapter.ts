// ============================================================================
// Anthropic Provider Adapter
// Supports Claude 3, Claude 3.5, Claude 3.7, Claude 4 models via Messages API
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

const PROVIDER_TIMEOUT_MS = 30000;

export class AnthropicAdapter implements AIProviderAdapter {
  readonly providerKey: string = 'anthropic';
  readonly adapterType: string = 'anthropic';
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    this.baseUrl = (config.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
  }

  get provider(): string {
    return this.providerKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  async healthCheck(testModelKey?: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    if (!this.apiKey) {
      return {
        providerKey: this.providerKey,
        status: 'DEGRADED',
        latencyMs: 0,
        message: 'No Anthropic API key configured',
        testedModel: testModelKey,
        checkedAt: new Date().toISOString(),
        error: 'Missing API key',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        return {
          providerKey: this.providerKey,
          status: latencyMs > 3000 ? 'DEGRADED' : 'HEALTHY',
          latencyMs,
          message: `Anthropic API operational (${latencyMs}ms)`,
          testedModel: testModelKey,
          checkedAt: new Date().toISOString(),
          error: null,
        };
      } else if (res.status === 401) {
        return {
          providerKey: this.providerKey,
          status: 'DEGRADED',
          latencyMs,
          message: 'Invalid Anthropic API key',
          testedModel: testModelKey,
          checkedAt: new Date().toISOString(),
          error: 'HTTP 401 Unauthorized',
        };
      } else {
        const text = await res.text().catch(() => '');
        return {
          providerKey: this.providerKey,
          status: 'UNHEALTHY',
          latencyMs,
          message: `Anthropic API error (${res.status}): ${text.slice(0, 100)}`,
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
        message: err.name === 'AbortError' ? 'Anthropic API timed out' : (err.message || 'Connection failed'),
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
      throw new Error(`PROVIDER_NOT_CONFIGURED: API key missing for provider ${this.providerKey}`);
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    if (request.abortSignal) {
      request.abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      const payload: Record<string, any> = {
        model: request.model,
        max_tokens: request.maxOutputTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
        messages: [{ role: 'user', content: request.prompt }],
      };

      if (request.systemPrompt) {
        payload.system = request.systemPrompt;
      }

      const res = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Anthropic error (${res.status}): ${errBody || res.statusText}`);
      }

      const data: any = await res.json();
      const text = data.content?.[0]?.text || '';
      const finishReason = data.stop_reason || 'end_turn';
      const inputTokens = data.usage?.input_tokens ?? Math.ceil(request.prompt.length / 4);
      const outputTokens = data.usage?.output_tokens ?? Math.ceil(text.length / 4);
      const totalTokens = inputTokens + outputTokens;

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
        providerRequestId: data.id || `anthropic-${Date.now()}`,
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
      throw new Error(`PROVIDER_NOT_CONFIGURED: API key missing for provider ${this.providerKey}`);
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    if (request.abortSignal) {
      request.abortSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      const payload: Record<string, any> = {
        model: request.model,
        max_tokens: request.maxOutputTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
        messages: [{ role: 'user', content: request.prompt }],
        stream: true,
      };

      if (request.systemPrompt) {
        payload.system = request.systemPrompt;
      }

      const res = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Anthropic stream error (${res.status}): ${errBody || res.statusText}`);
      }

      if (!res.body) {
        throw new Error('Anthropic returned empty body');
      }

      let fullText = '';
      let finishReason = 'end_turn';
      let providerRequestId = `anthropic-${Date.now()}`;
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
            if (parsed.message?.id) providerRequestId = parsed.message.id;
            if (parsed.message?.usage?.input_tokens) inputTokens = parsed.message.usage.input_tokens;
            if (parsed.usage?.output_tokens) outputTokens = parsed.usage.output_tokens;

            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              onChunk(parsed.delta.text);
            }
            if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
              finishReason = parsed.delta.stop_reason;
            }
          } catch {
            // Ignore partial SSE JSON parse errors
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
      providerRequestId: res.providerRequestId || `anthropic-${Date.now()}`,
      isLive: res.isLive,
      latencyMs: res.latencyMs,
      modelKey: request.model.modelKey,
      finishReason: res.finishReason,
    };
  }

  async listRemoteModels(): Promise<DiscoveredModel[]> {
    return [
      { providerModelId: 'claude-3-5-sonnet-latest', displayName: 'Claude 3.5 Sonnet' },
      { providerModelId: 'claude-3-5-haiku-latest', displayName: 'Claude 3.5 Haiku' },
      { providerModelId: 'claude-3-7-sonnet-20250219', displayName: 'Claude 3.7 Sonnet' },
      { providerModelId: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus' },
    ];
  }
}
