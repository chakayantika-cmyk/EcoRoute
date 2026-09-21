// ============================================================================
// Providers Routes & Health Check Controller
// ============================================================================

import { FastifyInstance } from 'fastify';
import { authMiddleware, adminMiddleware } from '../../middleware/auth.middleware';
import { AdapterFactory } from '../../lib/adapters/adapter-factory';
import { ProviderHealthService } from './provider-health.service';
import { KNOWN_MODEL_PRICING } from '@ecoroute/config';

export async function providersRoutes(fastify: FastifyInstance) {
  // Public or Auth-Protected Provider Routes
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/v1/providers — List all providers with health and model stats
  fastify.get('/', async (request, reply) => {
    const providers = await fastify.prisma.aIProvider.findMany({
      include: {
        models: {
          select: {
            id: true,
            enabled: true,
            status: true,
            capabilitiesJson: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = providers.map((p) => {
      const activeCount = p.models.filter((m) => m.enabled && m.status === 'ACTIVE').length;
      const allCaps = new Set<string>();
      p.models.forEach((m) => {
        try {
          const caps = JSON.parse(m.capabilitiesJson);
          if (Array.isArray(caps)) caps.forEach((c) => allCaps.add(c));
        } catch {}
      });

      return {
        id: p.id,
        name: p.name,
        slug: p.slug || p.providerKey,
        providerKey: p.providerKey,
        adapterType: p.adapterType,
        baseUrl: p.baseUrl,
        enabled: p.enabled,
        status: p.status,
        healthStatus: p.healthStatus,
        lastHealthCheckAt: p.lastHealthCheckAt?.toISOString() ?? null,
        configurationStatus: p.configurationStatus,
        modelCount: p.models.length,
        activeModelCount: activeCount,
        supportedCapabilities: Array.from(allCaps),
      };
    });

    return reply.send({ data, meta: { requestId: request.id } });
  });

  // GET /api/v1/providers/health — Status summary of all providers
  fastify.get('/health', async (request, reply) => {
    const providers = await fastify.prisma.aIProvider.findMany({
      select: {
        id: true,
        name: true,
        providerKey: true,
        adapterType: true,
        enabled: true,
        healthStatus: true,
        lastHealthCheckAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return reply.send({
      data: providers.map((p) => ({
        id: p.id,
        name: p.name,
        providerKey: p.providerKey,
        adapterType: p.adapterType,
        enabled: p.enabled,
        healthStatus: p.healthStatus,
        lastHealthCheckAt: p.lastHealthCheckAt?.toISOString() ?? null,
      })),
      meta: { requestId: request.id },
    });
  });

  // GET /api/v1/providers/:providerId — Detail with models
  fastify.get('/:providerId', async (request, reply) => {
    const { providerId } = request.params as { providerId: string };
    const provider = await fastify.prisma.aIProvider.findFirst({
      where: {
        OR: [{ id: providerId }, { providerKey: providerId }],
      },
      include: {
        models: true,
        healthChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!provider) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Provider not found', requestId: request.id },
      });
    }

    return reply.send({
      data: {
        id: provider.id,
        name: provider.name,
        slug: provider.slug,
        providerKey: provider.providerKey,
        adapterType: provider.adapterType,
        baseUrl: provider.baseUrl,
        enabled: provider.enabled,
        status: provider.status,
        healthStatus: provider.healthStatus,
        lastHealthCheckAt: provider.lastHealthCheckAt?.toISOString() ?? null,
        configurationStatus: provider.configurationStatus,
        models: provider.models.map((m) => ({
          id: m.id,
          modelKey: m.modelKey,
          displayName: m.displayName,
          family: m.family,
          version: m.version,
          contextWindow: m.contextWindow,
          enabled: m.enabled,
          available: m.available,
          isDefault: m.isDefault,
          capabilities: JSON.parse(m.capabilitiesJson || '[]'),
          pricing: JSON.parse(m.pricingJson || '{}'),
        })),
        recentHealthChecks: provider.healthChecks,
      },
      meta: { requestId: request.id },
    });
  });

  // POST /api/v1/providers/:providerId/health-check — Trigger live health check
  fastify.post('/:providerId/health-check', async (request, reply) => {
    const { providerId } = request.params as { providerId: string };
    const provider = await fastify.prisma.aIProvider.findFirst({
      where: {
        OR: [{ id: providerId }, { providerKey: providerId }],
      },
      include: { models: { take: 1 } },
    });

    if (!provider) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Provider not found', requestId: request.id },
      });
    }

    let apiKeyOverride: string | undefined;
    if (provider.configJson) {
      try {
        const cfg = JSON.parse(provider.configJson);
        apiKeyOverride = cfg.apiKey;
      } catch {}
    }

    const adapter = AdapterFactory.getAdapter({
      id: provider.id,
      providerKey: provider.providerKey,
      name: provider.name,
      adapterType: provider.adapterType,
      baseUrl: provider.baseUrl,
      apiKey: apiKeyOverride,
      enabled: provider.enabled,
    });

    const testModelKey = provider.models[0]?.modelKey || 'default';
    const result = await adapter.healthCheck(testModelKey);

    // Persist health check
    await fastify.prisma.modelHealthCheck.create({
      data: {
        providerId: provider.id,
        modelId: provider.models[0]?.id,
        status: result.status,
        latencyMs: result.latencyMs,
        errorMessage: result.error || null,
        checkedAt: new Date(result.checkedAt),
      },
    });

    // Update provider status
    await fastify.prisma.aIProvider.update({
      where: { id: provider.id },
      data: {
        healthStatus: result.status,
        lastHealthCheckAt: new Date(result.checkedAt),
      },
    });

    return reply.send({
      data: result,
      meta: { requestId: request.id },
    });
  });

  // POST /api/v1/providers/:providerKey/test — Probe provider health and discover available models
  fastify.post('/:providerKey/test', async (request, reply) => {
    const { providerKey } = request.params as { providerKey: string };
    const provider = await fastify.prisma.aIProvider.findFirst({
      where: {
        OR: [{ providerKey }, { id: providerKey }],
      },
      include: {
        models: true,
      },
    });

    if (!provider) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Provider '${providerKey}' not found`, requestId: request.id },
      });
    }

    let apiKey: string | undefined;
    if (provider.configJson) {
      try {
        const cfg = JSON.parse(provider.configJson);
        apiKey = cfg.apiKey;
      } catch {}
    }

    const health = await ProviderHealthService.getProviderHealth(
      provider.providerKey,
      provider.baseUrl,
      apiKey,
      true // force fresh probe
    );

    // Count catalog free models vs total models
    let freeModelsCount = 0;
    for (const m of provider.models) {
      const known = KNOWN_MODEL_PRICING[m.modelKey] || KNOWN_MODEL_PRICING[m.providerModelId || ''];
      if (known?.pricingTier === 'free' || provider.providerKey === 'ollama') {
        freeModelsCount++;
      }
    }

    return reply.send({
      data: {
        providerKey: provider.providerKey,
        name: provider.name,
        configured: health.configured,
        reachable: health.reachable,
        authenticated: health.authenticated,
        status: health.status,
        errorMessage: health.errorMessage || null,
        discoveredModelsCount: health.availableModels.size,
        catalogModelsCount: provider.models.length,
        freeModelsCount,
        lastCheckedAt: new Date(health.lastCheckedAt).toISOString(),
      },
      meta: { requestId: request.id },
    });
  });

  // --------------------------------------------------------------------------
  // ADMIN ONLY ENDPOINTS
  // --------------------------------------------------------------------------

  // POST /api/v1/providers — Create a new provider
  fastify.post('/', { preHandler: [adminMiddleware] }, async (request, reply) => {
    const body = request.body as {
      name: string;
      slug?: string;
      providerKey: string;
      adapterType: string;
      baseUrl?: string;
      apiKey?: string;
      enabled?: boolean;
    };

    if (!body.name || !body.providerKey || !body.adapterType) {
      return reply.status(400).send({
        error: { code: 'BAD_REQUEST', message: 'Name, providerKey, and adapterType are required' },
      });
    }

    const configData: Record<string, unknown> = {};
    if (body.apiKey) configData.apiKey = body.apiKey;

    const provider = await fastify.prisma.aIProvider.create({
      data: {
        name: body.name,
        slug: body.slug || body.providerKey,
        providerKey: body.providerKey,
        adapterType: body.adapterType,
        baseUrl: body.baseUrl || null,
        enabled: body.enabled ?? true,
        status: 'ACTIVE',
        healthStatus: 'HEALTHY',
        configurationStatus: body.apiKey ? 'CONFIGURED' : 'UNCONFIGURED',
        configJson: Object.keys(configData).length ? JSON.stringify(configData) : null,
      },
    });

    AdapterFactory.clearCache(body.providerKey);

    return reply.status(201).send({
      data: provider,
      meta: { requestId: request.id },
    });
  });

  // PUT /api/v1/providers/:providerId — Update provider
  fastify.put('/:providerId', { preHandler: [adminMiddleware] }, async (request, reply) => {
    const { providerId } = request.params as { providerId: string };
    const body = request.body as {
      name?: string;
      slug?: string;
      adapterType?: string;
      baseUrl?: string | null;
      apiKey?: string;
      enabled?: boolean;
      status?: 'ACTIVE' | 'INACTIVE';
    };

    const existing = await fastify.prisma.aIProvider.findUnique({ where: { id: providerId } });
    if (!existing) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Provider not found' },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.adapterType !== undefined) updateData.adapterType = body.adapterType;
    if (body.baseUrl !== undefined) updateData.baseUrl = body.baseUrl;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.status !== undefined) updateData.status = body.status;

    if (body.apiKey !== undefined) {
      let existingCfg: Record<string, unknown> = {};
      if (existing.configJson) {
        try { existingCfg = JSON.parse(existing.configJson); } catch {}
      }
      if (body.apiKey) {
        existingCfg.apiKey = body.apiKey;
        updateData.configurationStatus = 'CONFIGURED';
      } else {
        delete existingCfg.apiKey;
        updateData.configurationStatus = 'UNCONFIGURED';
      }
      updateData.configJson = JSON.stringify(existingCfg);
    }

    const updated = await fastify.prisma.aIProvider.update({
      where: { id: providerId },
      data: updateData,
    });

    AdapterFactory.clearCache(existing.providerKey);

    return reply.send({
      data: updated,
      meta: { requestId: request.id },
    });
  });
}
