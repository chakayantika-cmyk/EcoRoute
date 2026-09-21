// ============================================================================
// EcoRoute AI — Environment Configuration
// ============================================================================

import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(5),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  TOGETHER_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  AI_MOCK_MODE: z.string().default('false'),
  FREE_MODELS_ONLY: z.string().default('true'),
  PROVIDER_HEALTH_CACHE_TTL_SECONDS: z.coerce.number().default(60),
  PROVIDER_ENCRYPTION_KEY: z.string().default('ecoroute-production-encryption-secret-key-32chars'),
  PROVIDER_TIMEOUT_MS: z.coerce.number().default(30000),
  PROVIDER_MAX_RETRIES: z.coerce.number().default(3),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (cachedConfig) return cachedConfig;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const missing = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${(msgs ?? []).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${missing}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

/**
 * Mock mode is ONLY active when explicitly requested via AI_MOCK_MODE=true.
 * It NEVER activates silently due to missing keys in production.
 */
export function isMockMode(): boolean {
  return process.env.AI_MOCK_MODE === 'true';
}

export function isFreeModelsOnly(): boolean {
  return process.env.FREE_MODELS_ONLY !== 'false';
}

