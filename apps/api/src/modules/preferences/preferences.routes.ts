// ============================================================================
// Preferences Routes
// ============================================================================

import { FastifyInstance } from 'fastify';
import { updatePreferencesSchema } from '@ecoroute/validation';
import { authMiddleware } from '../../middleware/auth.middleware';
import { encryptSecret, maskApiKey } from '../../lib/crypto';
import { ProviderHealthService } from '../providers/provider-health.service';

export async function preferencesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/v1/preferences
  fastify.get('/', async (request, reply) => {
    let prefs = await fastify.prisma.routingPreference.findUnique({
      where: { userId: request.userId! },
    });

    if (!prefs) {
      prefs = await fastify.prisma.routingPreference.create({
        data: { userId: request.userId! },
      });
    }

    return reply.send({
      data: {
        id: prefs.id,
        userId: prefs.userId,
        tokenEfficiencyWeight: prefs.tokenEfficiencyWeight,
        costWeight: prefs.costWeight,
        qualityWeight: prefs.qualityWeight,
        environmentalWeight: prefs.environmentalWeight,
        defaultStrategy: prefs.defaultStrategy,
        updatedAt: prefs.updatedAt.toISOString(),
      },
      meta: { requestId: request.id },
    });
  });

  // PUT /api/v1/preferences
  fastify.put('/', async (request, reply) => {
    const body = updatePreferencesSchema.parse(request.body);

    const prefs = await fastify.prisma.routingPreference.upsert({
      where: { userId: request.userId! },
      update: body,
      create: { userId: request.userId!, ...body },
    });

    await fastify.prisma.auditEvent.create({
      data: {
        userId: request.userId!,
        eventType: 'preferences.updated',
        resourceType: 'routing_preference',
        resourceId: prefs.id,
      },
    });

    return reply.send({
      data: {
        id: prefs.id,
        userId: prefs.userId,
        tokenEfficiencyWeight: prefs.tokenEfficiencyWeight,
        costWeight: prefs.costWeight,
        qualityWeight: prefs.qualityWeight,
        environmentalWeight: prefs.environmentalWeight,
        defaultStrategy: prefs.defaultStrategy,
        updatedAt: prefs.updatedAt.toISOString(),
      },
      meta: { requestId: request.id },
    });
  });

  // POST /api/v1/preferences/reset
  fastify.post('/reset', async (request, reply) => {
    const prefs = await fastify.prisma.routingPreference.upsert({
      where: { userId: request.userId! },
      update: {
        tokenEfficiencyWeight: 0.25,
        costWeight: 0.25,
        qualityWeight: 0.25,
        environmentalWeight: 0.25,
        defaultStrategy: 'balanced',
      },
      create: { userId: request.userId! },
    });

    return reply.send({
      data: {
        id: prefs.id,
        tokenEfficiencyWeight: prefs.tokenEfficiencyWeight,
        costWeight: prefs.costWeight,
        qualityWeight: prefs.qualityWeight,
        environmentalWeight: prefs.environmentalWeight,
        defaultStrategy: prefs.defaultStrategy,
        updatedAt: prefs.updatedAt.toISOString(),
      },
      meta: { requestId: request.id },
    });
  });

  // GET /api/v1/preferences/api-keys
  fastify.get('/api-keys', async (request, reply) => {
    const providers = await fastify.prisma.aIProvider.findMany({
      where: { providerKey: { in: ['google_gemini', 'groq', 'openai', 'anthropic', 'ollama'] } },
    });

    const status: Record<string, any> = {
      google_gemini: Boolean(process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      groq: Boolean(process.env.GROQ_API_KEY),
      ollama: true, // Local daemon does not require an API key
      openai: Boolean(process.env.OPENAI_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    };

    const details: Record<string, { configured: boolean; maskedKey?: string }> = {
      google_gemini: { configured: status.google_gemini, maskedKey: maskApiKey(process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY) },
      groq: { configured: status.groq, maskedKey: maskApiKey(process.env.GROQ_API_KEY) },
      ollama: { configured: true, maskedKey: 'Local Daemon (No API Key Required)' },
      openai: { configured: status.openai, maskedKey: maskApiKey(process.env.OPENAI_API_KEY) },
      anthropic: { configured: status.anthropic, maskedKey: maskApiKey(process.env.ANTHROPIC_API_KEY) },
    };

    for (const p of providers) {
      if (p.configJson) {
        try {
          const cfg = JSON.parse(p.configJson);
          if (cfg.apiKey && cfg.apiKey.trim().length > 0) {
            status[p.providerKey] = true;
            details[p.providerKey] = {
              configured: true,
              maskedKey: maskApiKey(cfg.apiKey),
            };
          }
        } catch {}
      }
    }

    return reply.send({
      data: {
        ...status,
        details,
        freeModelsOnly: process.env.FREE_MODELS_ONLY !== 'false',
      },
      meta: { requestId: request.id },
    });
  });

  // PUT /api/v1/preferences/api-keys
  fastify.put('/api-keys', async (request, reply) => {
    const body = (request.body ?? {}) as {
      geminiApiKey?: string;
      groqApiKey?: string;
      openaiApiKey?: string;
      anthropicApiKey?: string;
      freeModelsOnly?: boolean;
    };

    const updates: Promise<any>[] = [];

    const handleKeyUpdate = async (providerKey: string, providerName: string, rawKey?: string, envVarName?: string) => {
      if (rawKey === undefined) return;
      const keyVal = rawKey.trim();

      const p = await fastify.prisma.aIProvider.findUnique({ where: { providerKey } });
      const current = p?.configJson ? JSON.parse(p.configJson) : {};

      if (keyVal.length === 0) {
        // Remove key
        delete current.apiKey;
        if (envVarName) delete process.env[envVarName];
      } else {
        // Encrypt key at rest
        current.apiKey = encryptSecret(keyVal);
        if (envVarName) process.env[envVarName] = keyVal;
      }

      updates.push(
        fastify.prisma.aIProvider.upsert({
          where: { providerKey },
          update: { configJson: JSON.stringify(current), configurationStatus: keyVal.length > 0 ? 'CONFIGURED' : 'UNCONFIGURED' },
          create: { name: providerName, providerKey, configJson: JSON.stringify(current), configurationStatus: keyVal.length > 0 ? 'CONFIGURED' : 'UNCONFIGURED' },
        })
      );

      ProviderHealthService.invalidate(providerKey);
    };

    if (body.geminiApiKey !== undefined) {
      await handleKeyUpdate('google_gemini', 'Google Gemini', body.geminiApiKey, 'GOOGLE_GEMINI_API_KEY');
    }

    if (body.groqApiKey !== undefined) {
      await handleKeyUpdate('groq', 'Groq', body.groqApiKey, 'GROQ_API_KEY');
    }

    if (body.openaiApiKey !== undefined) {
      await handleKeyUpdate('openai', 'OpenAI', body.openaiApiKey, 'OPENAI_API_KEY');
    }

    if (body.anthropicApiKey !== undefined) {
      await handleKeyUpdate('anthropic', 'Anthropic', body.anthropicApiKey, 'ANTHROPIC_API_KEY');
    }

    if (body.freeModelsOnly !== undefined) {
      process.env.FREE_MODELS_ONLY = String(body.freeModelsOnly);
    }

    await Promise.all(updates);

    return reply.send({
      data: {
        message: 'Provider API keys updated successfully',
        freeModelsOnly: process.env.FREE_MODELS_ONLY !== 'false',
      },
      meta: { requestId: request.id },
    });
  });
}
