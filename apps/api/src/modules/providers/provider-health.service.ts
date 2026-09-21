import { decryptSecret } from '../../lib/crypto';
import { isFreeModelsOnly } from '../../config/env';
import { ModelAvailabilityStatus } from '@ecoroute/shared-types';

export interface ProviderHealthState {
  providerKey: string;
  configured: boolean;
  reachable: boolean;
  authenticated: boolean;
  status: 'HEALTHY' | 'UNREACHABLE' | 'UNCONFIGURED' | 'DEGRADED';
  errorMessage?: string;
  availableModels: Set<string>;
  lastCheckedAt: number;
  quotaStatus?: 'available' | 'exhausted' | 'limited' | 'unknown';
}

export interface ModelAvailabilityCheck {
  isAvailable: boolean;
  providerHealth: 'HEALTHY' | 'UNREACHABLE' | 'UNCONFIGURED' | 'DEGRADED';
  modelAvailability: 'AVAILABLE' | 'NOT_INSTALLED' | 'UNKNOWN' | 'INSUFFICIENT_DATA';
  availabilityStatus: ModelAvailabilityStatus;
  accountAccessStatus: 'eligible' | 'unavailable' | 'unknown';
  quotaStatus: 'available' | 'exhausted' | 'limited' | 'unknown';
  reason?: string;
}

export class ProviderHealthService {
  private static cache: Map<string, ProviderHealthState> = new Map();
  private static TTL_MS = (Number(process.env.PROVIDER_HEALTH_CACHE_TTL_SECONDS) || 60) * 1000;

  /**
   * Clears the cached health state, e.g. when provider settings change or 404 is encountered.
   */
  static invalidate(providerKey?: string) {
    if (providerKey) {
      this.cache.delete(providerKey.toLowerCase());
    } else {
      this.cache.clear();
    }
  }

  /**
   * Sets custom TTL in milliseconds (useful for testing)
   */
  static setTtlMs(ms: number) {
    this.TTL_MS = ms;
  }

  /**
   * Directly inspects cache without refreshing (useful for debugging and tests)
   */
  static getCachedHealth(providerKey: string): ProviderHealthState | null {
    return this.cache.get(providerKey.toLowerCase()) || null;
  }

  /**
   * Gets or refreshes the health state and discovered models for a given provider
   */
  static async getProviderHealth(
    providerKey: string,
    baseUrl?: string | null,
    apiKey?: string | null,
    forceRefresh: boolean = false,
  ): Promise<ProviderHealthState> {
    const key = providerKey.toLowerCase();
    const now = Date.now();
    const cached = this.cache.get(key);

    if (!forceRefresh && cached && now - cached.lastCheckedAt < this.TTL_MS) {
      return cached;
    }

    const state = await this.probeProvider(key, baseUrl, apiKey);
    this.cache.set(key, state);
    return state;
  }

  /**
   * Validates whether a specific model is actually available to execute on its provider.
   * Exact canonical providerModelId matching against discovered models is authoritative.
   */
  static async checkModelAvailability(
    providerKey: string,
    providerModelId: string,
    modelKey: string,
    baseUrl?: string | null,
    apiKey?: string | null,
    pricingTier?: string,
  ): Promise<ModelAvailabilityCheck> {
    // Explicit Mock Mode Handling — Mock provider is ONLY valid when AI_MOCK_MODE=true
    if (providerKey === 'mock') {
      if (process.env.AI_MOCK_MODE === 'true') {
        return {
          isAvailable: true,
          providerHealth: 'HEALTHY',
          modelAvailability: 'AVAILABLE',
          availabilityStatus: ModelAvailabilityStatus.READY,
          accountAccessStatus: 'eligible',
          quotaStatus: 'available',
        };
      }
      return {
        isAvailable: false,
        providerHealth: 'UNCONFIGURED',
        modelAvailability: 'UNKNOWN',
        availabilityStatus: ModelAvailabilityStatus.PROVIDER_DISABLED,
        accountAccessStatus: 'unavailable',
        quotaStatus: 'unknown',
        reason: 'PROVIDER_DISABLED: Mock simulation models are disabled in production mode (AI_MOCK_MODE=false).',
      };
    }

    // Free Model Policy Enforcement
    if (isFreeModelsOnly()) {
      if (pricingTier === 'paid') {
        return {
          isAvailable: false,
          providerHealth: 'HEALTHY',
          modelAvailability: 'AVAILABLE',
          availabilityStatus: ModelAvailabilityStatus.PAID_MODEL_EXCLUDED,
          accountAccessStatus: 'unavailable',
          quotaStatus: 'unknown',
          reason: 'PAID_MODEL_EXCLUDED: Model belongs to a paid tier and is excluded under the active Free Models Only policy.',
        };
      }
      if (pricingTier === 'unknown') {
        return {
          isAvailable: false,
          providerHealth: 'HEALTHY',
          modelAvailability: 'INSUFFICIENT_DATA',
          availabilityStatus: ModelAvailabilityStatus.PRICING_DATA_UNAVAILABLE,
          accountAccessStatus: 'unknown',
          quotaStatus: 'unknown',
          reason: 'PRICING_DATA_UNAVAILABLE: Model pricing is unverified and cannot participate in the Free Models Only pool.',
        };
      }
    }

    const health = await this.getProviderHealth(providerKey, baseUrl, apiKey);

    // 1. Provider Unconfigured
    if (!health.configured) {
      return {
        isAvailable: false,
        providerHealth: 'UNCONFIGURED',
        modelAvailability: 'UNKNOWN',
        availabilityStatus: ModelAvailabilityStatus.MISSING_API_KEY,
        accountAccessStatus: 'unavailable',
        quotaStatus: 'unknown',
        reason: health.errorMessage || `MISSING_API_KEY: API key for provider '${providerKey}' is not configured.`,
      };
    }

    // 2. Provider Unreachable (e.g. Ollama daemon not running)
    if (!health.reachable) {
      const availabilityStatus = providerKey === 'ollama' 
        ? ModelAvailabilityStatus.OLLAMA_UNREACHABLE 
        : ModelAvailabilityStatus.PROVIDER_UNREACHABLE;
      return {
        isAvailable: false,
        providerHealth: 'UNREACHABLE',
        modelAvailability: 'UNKNOWN',
        availabilityStatus,
        accountAccessStatus: 'unavailable',
        quotaStatus: 'unknown',
        reason: health.errorMessage || `${availabilityStatus}: Provider '${providerKey}' is currently unreachable.`,
      };
    }

    // 3. Provider Authentication Failure
    if (!health.authenticated) {
      return {
        isAvailable: false,
        providerHealth: 'DEGRADED',
        modelAvailability: 'UNKNOWN',
        availabilityStatus: ModelAvailabilityStatus.AUTHENTICATION_FAILED,
        accountAccessStatus: 'unavailable',
        quotaStatus: 'unknown',
        reason: health.errorMessage || `AUTHENTICATION_FAILED: Authentication failed for provider '${providerKey}'.`,
      };
    }

    // 4. Free-tier Quota Exhausted Check
    if (health.quotaStatus === 'exhausted' || health.errorMessage?.includes('FREE_TIER_QUOTA_EXHAUSTED')) {
      return {
        isAvailable: false,
        providerHealth: 'DEGRADED',
        modelAvailability: 'AVAILABLE',
        availabilityStatus: ModelAvailabilityStatus.FREE_TIER_QUOTA_EXHAUSTED,
        accountAccessStatus: 'unavailable',
        quotaStatus: 'exhausted',
        reason: 'FREE_TIER_QUOTA_EXHAUSTED: Provider free tier quota has been exhausted.',
      };
    }

    // 5. Model-level installation check (Critical for Ollama & custom local endpoints)
    if (providerKey === 'ollama') {
      const canonicalId = (providerModelId || modelKey).trim().toLowerCase();
      // Exact tag matching
      const hasExactTag = health.availableModels.has(canonicalId);
      
      let isInstalled = hasExactTag;
      if (!isInstalled) {
        for (const installed of health.availableModels) {
          if (installed.toLowerCase() === canonicalId || installed.toLowerCase().startsWith(`${canonicalId}:`)) {
            isInstalled = true;
            break;
          }
        }
      }

      if (!isInstalled) {
        return {
          isAvailable: false,
          providerHealth: 'HEALTHY',
          modelAvailability: 'NOT_INSTALLED',
          availabilityStatus: ModelAvailabilityStatus.LOCAL_MODEL_NOT_INSTALLED,
          accountAccessStatus: 'eligible',
          quotaStatus: 'available',
          reason: `LOCAL_MODEL_NOT_INSTALLED: Model '${providerModelId || modelKey}' is not installed in local Ollama daemon. Run 'ollama pull ${providerModelId || modelKey}' to install it.`,
        };
      }
    }

    return {
      isAvailable: true,
      providerHealth: 'HEALTHY',
      modelAvailability: 'AVAILABLE',
      availabilityStatus: ModelAvailabilityStatus.READY,
      accountAccessStatus: 'eligible',
      quotaStatus: 'available',
    };
  }

  /**
   * Internal probe performing network discovery with safe short timeouts
   */
  private static async probeProvider(
    providerKey: string,
    baseUrl?: string | null,
    apiKey?: string | null,
  ): Promise<ProviderHealthState> {
    const now = Date.now();
    const rawKey = apiKey || this.resolveEnvKey(providerKey);
    const effectiveKey = rawKey ? decryptSecret(rawKey) : null;

    // --- Provider: Ollama (Local Daemon) ---
    if (providerKey === 'ollama') {
      const effectiveBaseUrl = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s quick timeout

      try {
        // Query Ollama's native tag list
        const res = await fetch(`${effectiveBaseUrl}/api/tags`, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          return {
            providerKey,
            configured: true,
            reachable: false,
            authenticated: true,
            status: 'UNREACHABLE',
            errorMessage: `Ollama returned HTTP ${res.status}: ${res.statusText}`,
            availableModels: new Set(),
            lastCheckedAt: now,
          };
        }

        const data: any = await res.json().catch(() => ({}));
        const modelsList: any[] = Array.isArray(data.models) ? data.models : [];
        const availableModels = new Set<string>();

        for (const m of modelsList) {
          if (m.name) availableModels.add(m.name.toLowerCase());
          if (m.model) availableModels.add(m.model.toLowerCase());
        }

        return {
          providerKey,
          configured: true,
          reachable: true,
          authenticated: true,
          status: 'HEALTHY',
          availableModels,
          lastCheckedAt: now,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        return {
          providerKey,
          configured: true,
          reachable: false,
          authenticated: true,
          status: 'UNREACHABLE',
          errorMessage: `Ollama local daemon is not running or unreachable at ${effectiveBaseUrl} (${err.name === 'AbortError' ? 'timeout' : err.message || 'connection refused'})`,
          availableModels: new Set(),
          lastCheckedAt: now,
        };
      }
    }

    // --- Cloud Providers (OpenAI, Anthropic, Gemini, Groq, DeepSeek, Together) ---
    if (!effectiveKey) {
      return {
        providerKey,
        configured: false,
        reachable: false,
        authenticated: false,
        status: 'UNCONFIGURED',
        errorMessage: `API key missing for provider '${providerKey}'`,
        availableModels: new Set(),
        lastCheckedAt: now,
      };
    }

    // If key exists, verify basic connectivity with short timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      if (providerKey === 'google_gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${effectiveKey}`;
        const res = await fetch(url, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.status === 400 || res.status === 403) {
          return {
            providerKey,
            configured: true,
            reachable: true,
            authenticated: false,
            status: 'DEGRADED',
            errorMessage: `AUTHENTICATION_FAILED: Invalid Gemini API key (HTTP ${res.status})`,
            availableModels: new Set(),
            lastCheckedAt: now,
          };
        }

        if (res.status === 429) {
          return {
            providerKey,
            configured: true,
            reachable: true,
            authenticated: true,
            status: 'DEGRADED',
            quotaStatus: 'exhausted',
            errorMessage: `FREE_TIER_QUOTA_EXHAUSTED: Gemini API quota exceeded (HTTP 429)`,
            availableModels: new Set(),
            lastCheckedAt: now,
          };
        }

        if (res.ok) {
          const data: any = await res.json().catch(() => ({}));
          const models: any[] = Array.isArray(data.models) ? data.models : [];
          const availableModels = new Set<string>();
          for (const m of models) {
            const name = String(m.name || '').replace(/^models\//, '').toLowerCase();
            if (name) availableModels.add(name);
          }
          return {
            providerKey,
            configured: true,
            reachable: true,
            authenticated: true,
            status: 'HEALTHY',
            availableModels,
            lastCheckedAt: now,
          };
        }
      }

      if (providerKey === 'openai' || providerKey === 'groq' || providerKey === 'together' || providerKey === 'deepseek') {
        const defaultBase =
          providerKey === 'groq'
            ? 'https://api.groq.com/openai/v1'
            : providerKey === 'together'
            ? 'https://api.together.xyz/v1'
            : providerKey === 'deepseek'
            ? 'https://api.deepseek.com/v1'
            : 'https://api.openai.com/v1';

        const endpoint = (baseUrl || defaultBase).replace(/\/+$/, '');
        const res = await fetch(`${endpoint}/models`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${effectiveKey}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.status === 401 || res.status === 403) {
          return {
            providerKey,
            configured: true,
            reachable: true,
            authenticated: false,
            status: 'DEGRADED',
            errorMessage: `AUTHENTICATION_FAILED: Invalid API key for ${providerKey} (HTTP ${res.status})`,
            availableModels: new Set(),
            lastCheckedAt: now,
          };
        }

        if (res.status === 429) {
          const bodyText = await res.text().catch(() => '');
          const isQuota = bodyText.toLowerCase().includes('quota') || bodyText.toLowerCase().includes('resource_exhausted');
          return {
            providerKey,
            configured: true,
            reachable: true,
            authenticated: true,
            status: 'DEGRADED',
            quotaStatus: isQuota ? 'exhausted' : 'limited',
            errorMessage: isQuota
              ? `FREE_TIER_QUOTA_EXHAUSTED: Free quota exhausted for ${providerKey} (HTTP 429)`
              : `RATE_LIMITED: Rate limit exceeded for ${providerKey} (HTTP 429)`,
            availableModels: new Set(),
            lastCheckedAt: now,
          };
        }

        if (res.ok) {
          const data: any = await res.json().catch(() => ({}));
          const list: any[] = Array.isArray(data.data) ? data.data : [];
          const availableModels = new Set<string>(list.map((item: any) => String(item.id).toLowerCase()));

          return {
            providerKey,
            configured: true,
            reachable: true,
            authenticated: true,
            status: 'HEALTHY',
            availableModels,
            lastCheckedAt: now,
          };
        }
      }

      clearTimeout(timeoutId);
      return {
        providerKey,
        configured: true,
        reachable: true,
        authenticated: true,
        status: 'HEALTHY',
        availableModels: new Set(),
        lastCheckedAt: now,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return {
        providerKey,
        configured: true,
        reachable: false,
        authenticated: true,
        status: 'UNREACHABLE',
        errorMessage: `Endpoint connection failed for ${providerKey} (${err.name === 'AbortError' ? 'timeout' : err.message})`,
        availableModels: new Set(),
        lastCheckedAt: now,
      };
    }
  }

  private static resolveEnvKey(providerKey: string): string | null {
    switch (providerKey.toLowerCase()) {
      case 'openai':
        return process.env.OPENAI_API_KEY || null;
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY || null;
      case 'google_gemini':
        return process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || null;
      case 'groq':
        return process.env.GROQ_API_KEY || null;
      case 'deepseek':
        return process.env.DEEPSEEK_API_KEY || null;
      case 'together':
        return process.env.TOGETHER_API_KEY || null;
      default:
        return null;
    }
  }
}
