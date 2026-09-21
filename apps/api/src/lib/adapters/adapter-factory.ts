// ============================================================================
// AI Provider Adapter Factory
// Instantiates and manages provider adapters based on adapterType and configuration
// ============================================================================

import { AIProviderAdapter, ProviderConfig } from './provider-adapter.interface';
import { OpenAICompatibleAdapter } from './openai-compatible.adapter';
import { AnthropicAdapter } from './anthropic.adapter';
import { GoogleGeminiAdapter } from './google-gemini.adapter';
import { MockProviderAdapter } from './mock-provider.adapter';

export class AdapterFactory {
  private static adapterCache: Map<string, AIProviderAdapter> = new Map();

  /**
   * Get or create an adapter for a provider configuration
   */
  static getAdapter(provider: ProviderConfig): AIProviderAdapter {
    const cacheKey = `${provider.providerKey}_${provider.adapterType}_${provider.baseUrl || 'default'}_${provider.apiKey ? 'key-' + provider.apiKey.slice(-4) : 'env'}`;
    
    const existing = this.adapterCache.get(cacheKey);
    if (existing) {
      return existing;
    }

    let adapter: AIProviderAdapter;

    switch (provider.adapterType?.toLowerCase()) {
      case 'anthropic':
        adapter = new AnthropicAdapter(provider);
        break;

      case 'gemini':
      case 'google_gemini':
        adapter = new GoogleGeminiAdapter(provider);
        break;

      case 'mock':
        adapter = new MockProviderAdapter(provider);
        break;

      case 'openai_compatible':
      case 'openai':
      default:
        adapter = new OpenAICompatibleAdapter(provider);
        break;
    }

    this.adapterCache.set(cacheKey, adapter);
    return adapter;
  }

  /**
   * Clears cached adapter instances (e.g. after provider settings are updated)
   */
  static clearCache(providerKey?: string) {
    if (providerKey) {
      for (const key of this.adapterCache.keys()) {
        if (key.startsWith(`${providerKey}_`)) {
          this.adapterCache.delete(key);
        }
      }
    } else {
      this.adapterCache.clear();
    }
  }
}
