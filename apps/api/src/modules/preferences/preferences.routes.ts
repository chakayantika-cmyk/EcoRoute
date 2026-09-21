// ============================================================================
// Preferences Routes
// ============================================================================

import { FastifyInstance } from 'fastify';
import { updatePreferencesSchema } from '@ecoroute/validation';
import { authMiddleware } from '../../middleware/auth.middleware';

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
      where: { providerKey: { in: ['google_gemini', 'openai', 'anthropic'] } },
    });

    const status: Record<string, boolean> = {
      google_gemini: Boolean(process.env.GOOGLE_GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    };

    for (const p of providers) {
      if (p.configJson) {
        try {
          const cfg = JSON.parse(p.configJson);
          if (cfg.apiKey && cfg.apiKey.trim().length > 5) {
            status[p.providerKey] = true;
          }
        } catch {}
      }
    }

    return reply.send({ data: status, meta: { requestId: request.id } });
  });

  // PUT /api/v1/preferences/api-keys
  fastify.put('/api-keys', async (request, reply) => {
    const body = (request.body ?? {}) as {
      geminiApiKey?: string;
      openaiApiKey?: string;
      anthropicApiKey?: string;
    };

    const updates: Promise<any>[] = [];

    if (body.geminiApiKey !== undefined) {
      const p = await fastify.prisma.aIProvider.findUnique({ where: { providerKey: 'google_gemini' } });
      const current = p?.configJson ? JSON.parse(p.configJson) : {};
      current.apiKey = body.geminiApiKey.trim();
      updates.push(
        fastify.prisma.aIProvider.upsert({
          where: { providerKey: 'google_gemini' },
          update: { configJson: JSON.stringify(current) },
          create: { name: 'Google Gemini', providerKey: 'google_gemini', configJson: JSON.stringify(current) },
        })
      );
      if (body.geminiApiKey.trim()) {
        process.env.GOOGLE_GEMINI_API_KEY = body.geminiApiKey.trim();
      }
    }

    if (body.openaiApiKey !== undefined) {
      const p = await fastify.prisma.aIProvider.findUnique({ where: { providerKey: 'openai' } });
      const current = p?.configJson ? JSON.parse(p.configJson) : {};
      current.apiKey = body.openaiApiKey.trim();
      updates.push(
        fastify.prisma.aIProvider.upsert({
          where: { providerKey: 'openai' },
          update: { configJson: JSON.stringify(current) },
          create: { name: 'OpenAI', providerKey: 'openai', configJson: JSON.stringify(current) },
        })
      );
      if (body.openaiApiKey.trim()) {
        process.env.OPENAI_API_KEY = body.openaiApiKey.trim();
      }
    }

    if (body.anthropicApiKey !== undefined) {
      const p = await fastify.prisma.aIProvider.findUnique({ where: { providerKey: 'anthropic' } });
      const current = p?.configJson ? JSON.parse(p.configJson) : {};
      current.apiKey = body.anthropicApiKey.trim();
      updates.push(
        fastify.prisma.aIProvider.upsert({
          where: { providerKey: 'anthropic' },
          update: { configJson: JSON.stringify(current) },
          create: { name: 'Anthropic', providerKey: 'anthropic', configJson: JSON.stringify(current) },
        })
      );
      if (body.anthropicApiKey.trim()) {
        process.env.ANTHROPIC_API_KEY = body.anthropicApiKey.trim();
      }
    }

    await Promise.all(updates);

    return reply.send({ data: { message: 'API keys updated successfully' }, meta: { requestId: request.id } });
  });
}
