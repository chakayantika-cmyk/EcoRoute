// ============================================================================
// Model Pricing Metadata
// ============================================================================
// Source: Official provider pricing pages (as of 2024-Q4)
// These are configurable estimates; actual pricing may differ.
// All prices in USD per million tokens.
// ============================================================================

export interface PricingEntry {
  modelKey: string;
  providerKey: string;
  inputPricePerMillionTokens: number;
  outputPricePerMillionTokens: number;
  currency: string;
  pricingVersion: string;
  lastUpdated: string;
  source: string;
}

export const MODEL_PRICING: PricingEntry[] = [
  // OpenAI
  {
    modelKey: 'gpt-4o',
    providerKey: 'openai',
    inputPricePerMillionTokens: 2.50,
    outputPricePerMillionTokens: 10.00,
    currency: 'USD',
    pricingVersion: '2024-Q4',
    lastUpdated: '2024-10-01',
    source: 'https://openai.com/pricing',
  },
  {
    modelKey: 'gpt-4o-mini',
    providerKey: 'openai',
    inputPricePerMillionTokens: 0.15,
    outputPricePerMillionTokens: 0.60,
    currency: 'USD',
    pricingVersion: '2024-Q4',
    lastUpdated: '2024-10-01',
    source: 'https://openai.com/pricing',
  },
  // Google Gemini
  {
    modelKey: 'gemini-1.5-pro',
    providerKey: 'google_gemini',
    inputPricePerMillionTokens: 1.25,
    outputPricePerMillionTokens: 5.00,
    currency: 'USD',
    pricingVersion: '2024-Q4',
    lastUpdated: '2024-10-01',
    source: 'https://ai.google.dev/pricing',
  },
  {
    modelKey: 'gemini-1.5-flash',
    providerKey: 'google_gemini',
    inputPricePerMillionTokens: 0.075,
    outputPricePerMillionTokens: 0.30,
    currency: 'USD',
    pricingVersion: '2024-Q4',
    lastUpdated: '2024-10-01',
    source: 'https://ai.google.dev/pricing',
  },
  // Anthropic
  {
    modelKey: 'claude-3.5-sonnet',
    providerKey: 'anthropic',
    inputPricePerMillionTokens: 3.00,
    outputPricePerMillionTokens: 15.00,
    currency: 'USD',
    pricingVersion: '2024-Q4',
    lastUpdated: '2024-10-01',
    source: 'https://www.anthropic.com/pricing',
  },
  {
    modelKey: 'claude-3-haiku',
    providerKey: 'anthropic',
    inputPricePerMillionTokens: 0.25,
    outputPricePerMillionTokens: 1.25,
    currency: 'USD',
    pricingVersion: '2024-Q4',
    lastUpdated: '2024-10-01',
    source: 'https://www.anthropic.com/pricing',
  },
];
