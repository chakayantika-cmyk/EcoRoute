// ============================================================================
// Models & Providers Routes — Configurable Catalog Management
// ============================================================================

import { FastifyInstance } from 'fastify';
import { authMiddleware, adminMiddleware } from '../../middleware/auth.middleware';
import { AdapterFactory } from '../../lib/adapters/adapter-factory';
import { ModelRegistryCache } from './model-registry.service';

export async function modelsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/v1/models — List active / enabled models with filter support
  fastify.get('/', async (request, reply) => {
    const query = request.query as {
      provider?: string;
      capability?: string;
      availableOnly?: string;
      includeMock?: string;
      search?: string;
    };

    const where: Record<string, any> = {
      status: 'ACTIVE',
      enabled: true,
    };

    if (query.provider) {
      where.provider = { providerKey: query.provider };
    }

    if (query.availableOnly === 'true') {
      where.available = true;
    }

    if (query.includeMock !== 'true' && process.env.AI_MOCK_MODE !== 'true') {
      where.isMockModel = false;
    }

    if (query.search) {
      where.OR = [
        { displayName: { contains: query.search } },
        { modelKey: { contains: query.search } },
        { family: { contains: query.search } },
      ];
    }

    const models = await fastify.prisma.aIModel.findMany({
      where,
      include: { provider: true },
      orderBy: [{ provider: { name: 'asc' } }, { displayName: 'asc' }],
    });

    let filtered = models;
    if (query.capability) {
      filtered = models.filter((m) => {
        try {
          const caps = JSON.parse(m.capabilitiesJson || '[]');
          return Array.isArray(caps) && caps.includes(query.capability);
        } catch {
          return false;
        }
      });
    }

    return reply.send({
      data: filtered.map((m) => formatModel(m)),
      meta: { requestId: request.id, count: filtered.length },
    });
  });

  // GET /api/v1/models/admin/all — Complete model catalog for admin dashboard
  fastify.get('/admin/all', { preHandler: [adminMiddleware] }, async (request, reply) => {
    const models = await fastify.prisma.aIModel.findMany({
      include: {
        provider: true,
        healthChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ provider: { name: 'asc' } }, { displayName: 'asc' }],
    });

    return reply.send({
      data: models.map((m) => ({
        ...formatModel(m),
        lastHealthCheck: m.healthChecks[0]
          ? {
              status: m.healthChecks[0].status,
              latencyMs: m.healthChecks[0].latencyMs,
              checkedAt: m.healthChecks[0].checkedAt.toISOString(),
            }
          : null,
      })),
      meta: { requestId: request.id, totalCount: models.length },
    });
  });

  // GET /api/v1/models/:modelId — Specific model details
  fastify.get('/:modelId', async (request, reply) => {
    const { modelId } = request.params as { modelId: string };
    const model = await fastify.prisma.aIModel.findFirst({
      where: {
        OR: [{ id: modelId }, { modelKey: modelId }],
      },
      include: { provider: true },
    });

    if (!model) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Model not found', requestId: request.id },
      });
    }

    return reply.send({
      data: formatModel(model),
      meta: { requestId: request.id },
    });
  });

  // --------------------------------------------------------------------------
  // ADMIN MODEL MANAGEMENT ENDPOINTS
  // --------------------------------------------------------------------------

  // POST /api/v1/models — Register custom or newly added model
  fastify.post('/', { preHandler: [adminMiddleware] }, async (request, reply) => {
    const body = request.body as {
      providerId: string;
      modelKey: string;
      displayName: string;
      providerModelId?: string;
      family?: string;
      version?: string;
      description?: string;
      capabilities: string[];
      contextWindow: number;
      maxOutputTokens?: number;
      pricing: {
        inputPricePerMillionTokens?: number;
        outputPricePerMillionTokens?: number;
      };
      performance?: Record<string, any>;
      environmentalMetrics?: Record<string, any>;
      tags?: string[];
      enabled?: boolean;
      available?: boolean;
      isDefault?: boolean;
      isMockModel?: boolean;
    };

    if (!body.providerId || !body.modelKey || !body.displayName || !body.contextWindow) {
      return reply.status(400).send({
        error: { code: 'BAD_REQUEST', message: 'providerId, modelKey, displayName, and contextWindow are required' },
      });
    }

    // Check if modelKey already exists
    const existing = await fastify.prisma.aIModel.findFirst({ where: { modelKey: body.modelKey } });
    if (existing) {
      return reply.status(409).send({
        error: { code: 'CONFLICT', message: `Model with key '${body.modelKey}' already exists` },
      });
    }

    // If marked default, unset previous defaults
    if (body.isDefault) {
      await fastify.prisma.aIModel.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await fastify.prisma.aIModel.create({
      data: {
        providerId: body.providerId,
        modelKey: body.modelKey,
        displayName: body.displayName,
        providerModelId: body.providerModelId || body.modelKey,
        family: body.family || 'custom',
        version: body.version || '1.0',
        description: body.description || null,
        capabilitiesJson: JSON.stringify(body.capabilities || ['text_generation']),
        contextWindow: Number(body.contextWindow),
        maxOutputTokens: body.maxOutputTokens ? Number(body.maxOutputTokens) : 4096,
        pricingJson: JSON.stringify(body.pricing || { inputPricePerMillionTokens: 0.5, outputPricePerMillionTokens: 1.5 }),
        performanceJson: body.performance ? JSON.stringify(body.performance) : JSON.stringify({ benchmarkScore: 80, speedTokensPerSec: 75 }),
        environmentalMetricsJson: body.environmentalMetrics ? JSON.stringify(body.environmentalMetrics) : null,
        tagsJson: body.tags ? JSON.stringify(body.tags) : null,
        enabled: body.enabled ?? true,
        available: body.available ?? true,
        isDefault: body.isDefault ?? false,
        isMockModel: body.isMockModel ?? false,
        status: 'ACTIVE',
      },
      include: { provider: true },
    });

    ModelRegistryCache.invalidate();

    return reply.status(201).send({
      data: formatModel(created),
      meta: { requestId: request.id },
    });
  });

  // PUT /api/v1/models/:modelId — Update model
  fastify.put('/:modelId', { preHandler: [adminMiddleware] }, async (request, reply) => {
    const { modelId } = request.params as { modelId: string };
    const body = request.body as Record<string, any>;

    const existing = await fastify.prisma.aIModel.findUnique({ where: { id: modelId } });
    if (!existing) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Model not found' },
      });
    }

    const updateData: Record<string, any> = {};
    if (body.displayName !== undefined) updateData.displayName = body.displayName;
    if (body.providerModelId !== undefined) updateData.providerModelId = body.providerModelId;
    if (body.family !== undefined) updateData.family = body.family;
    if (body.version !== undefined) updateData.version = body.version;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.capabilities !== undefined) updateData.capabilitiesJson = JSON.stringify(body.capabilities);
    if (body.contextWindow !== undefined) updateData.contextWindow = Number(body.contextWindow);
    if (body.maxOutputTokens !== undefined) updateData.maxOutputTokens = Number(body.maxOutputTokens);
    if (body.pricing !== undefined) updateData.pricingJson = JSON.stringify(body.pricing);
    if (body.performance !== undefined) updateData.performanceJson = JSON.stringify(body.performance);
    if (body.environmentalMetrics !== undefined) updateData.environmentalMetricsJson = JSON.stringify(body.environmentalMetrics);
    if (body.tags !== undefined) updateData.tagsJson = JSON.stringify(body.tags);
    if (body.enabled !== undefined) updateData.enabled = Boolean(body.enabled);
    if (body.available !== undefined) updateData.available = Boolean(body.available);
    if (body.status !== undefined) updateData.status = body.status;

    if (body.isDefault) {
      await fastify.prisma.aIModel.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      updateData.isDefault = true;
    } else if (body.isDefault === false) {
      updateData.isDefault = false;
    }

    const updated = await fastify.prisma.aIModel.update({
      where: { id: modelId },
      data: updateData,
      include: { provider: true },
    });

    ModelRegistryCache.invalidate();

    return reply.send({
      data: formatModel(updated),
      meta: { requestId: request.id },
    });
  });

  // POST /api/v1/models/:modelId/toggle-enabled — Quick toggle enabled status
  fastify.post('/:modelId/toggle-enabled', { preHandler: [adminMiddleware] }, async (request, reply) => {
    const { modelId } = request.params as { modelId: string };
    const model = await fastify.prisma.aIModel.findUnique({ where: { id: modelId } });
    if (!model) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Model not found' } });
    }

    const updated = await fastify.prisma.aIModel.update({
      where: { id: modelId },
      data: { enabled: !model.enabled },
      include: { provider: true },
    });

    ModelRegistryCache.invalidate();

    return reply.send({
      data: formatModel(updated),
      meta: { requestId: request.id },
    });
  });

  // POST /api/v1/models/:modelId/toggle-default — Set model as default
  fastify.post('/:modelId/toggle-default', { preHandler: [adminMiddleware] }, async (request, reply) => {
    const { modelId } = request.params as { modelId: string };
    const model = await fastify.prisma.aIModel.findUnique({ where: { id: modelId } });
    if (!model) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Model not found' } });
    }

    await fastify.prisma.aIModel.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    const updated = await fastify.prisma.aIModel.update({
      where: { id: modelId },
      data: { isDefault: true },
      include: { provider: true },
    });

    ModelRegistryCache.invalidate();

    return reply.send({
      data: formatModel(updated),
      meta: { requestId: request.id },
    });
  });

  // DELETE /api/v1/models/:modelId — Remove or deactivate model
  fastify.delete('/:modelId', { preHandler: [adminMiddleware] }, async (request, reply) => {
    const { modelId } = request.params as { modelId: string };
    
    // Check if used in routing results
    const routingCount = await fastify.prisma.routingResult.count({
      where: { selectedModelId: modelId },
    });

    if (routingCount > 0) {
      // Soft-delete / deactivate to preserve historical foreign keys
      await fastify.prisma.aIModel.update({
        where: { id: modelId },
        data: { enabled: false, status: 'INACTIVE' },
      });
      ModelRegistryCache.invalidate();
      return reply.send({
        data: { success: true, message: 'Model deactivated (preserved for historical routing results)' },
        meta: { requestId: request.id },
      });
    }

    // Otherwise safe to hard delete
    await fastify.prisma.aIModel.delete({ where: { id: modelId } });
    ModelRegistryCache.invalidate();

    return reply.send({
      data: { success: true, message: 'Model deleted successfully' },
      meta: { requestId: request.id },
    });
  });

  // POST /api/v1/models/:modelId/health-check — Test specific model health
  fastify.post('/:modelId/health-check', async (request, reply) => {
    const { modelId } = request.params as { modelId: string };
    const model = await fastify.prisma.aIModel.findUnique({
      where: { id: modelId },
      include: { provider: true },
    });

    if (!model) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Model not found' } });
    }

    let apiKeyOverride: string | undefined;
    if (model.provider.configJson) {
      try {
        const cfg = JSON.parse(model.provider.configJson);
        apiKeyOverride = cfg.apiKey;
      } catch {}
    }

    const adapter = AdapterFactory.getAdapter({
      id: model.provider.id,
      providerKey: model.provider.providerKey,
      name: model.provider.name,
      adapterType: model.provider.adapterType,
      baseUrl: model.provider.baseUrl,
      apiKey: apiKeyOverride,
      enabled: model.provider.enabled,
    });

    const result = await adapter.healthCheck(model.modelKey);

    await fastify.prisma.modelHealthCheck.create({
      data: {
        providerId: model.providerId,
        modelId: model.id,
        status: result.status,
        latencyMs: result.latencyMs,
        errorMessage: result.error || null,
        checkedAt: new Date(result.checkedAt),
      },
    });

    // Update model availability if unhealthy
    if (result.status === 'UNHEALTHY') {
      await fastify.prisma.aIModel.update({
        where: { id: model.id },
        data: { available: false },
      });
    } else {
      await fastify.prisma.aIModel.update({
        where: { id: model.id },
        data: { available: true },
      });
    }

    return reply.send({
      data: result,
      meta: { requestId: request.id },
    });
  });

  // POST /api/v1/models/refresh-catalog — Discover remote models from provider
  fastify.post('/refresh-catalog', { preHandler: [adminMiddleware] }, async (request, reply) => {
    const body = request.body as { providerKey: string };
    if (!body?.providerKey) {
      return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: 'providerKey is required' } });
    }

    const provider = await fastify.prisma.aIProvider.findUnique({
      where: { providerKey: body.providerKey },
    });

    if (!provider) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Provider not found' } });
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

    if (!adapter.listRemoteModels) {
      return reply.status(400).send({
        error: { code: 'UNSUPPORTED', message: 'This provider does not support dynamic remote model discovery' },
      });
    }

    const discovered = await adapter.listRemoteModels();

    return reply.send({
      data: {
        providerKey: provider.providerKey,
        discoveredCount: discovered.length,
        models: discovered,
      },
      meta: { requestId: request.id },
    });
  });
}

// ----------------------------------------------------------------------------
// Helper: Format Model Response
// ----------------------------------------------------------------------------

function formatModel(m: any) {
  let capabilities: string[] = [];
  try { capabilities = JSON.parse(m.capabilitiesJson || '[]'); } catch {}

  let pricing: any = {};
  try { pricing = JSON.parse(m.pricingJson || '{}'); } catch {}

  let performance: any = {};
  try { performance = JSON.parse(m.performanceJson || '{}'); } catch {}

  let environmentalMetrics: any = {};
  try { environmentalMetrics = JSON.parse(m.environmentalMetricsJson || '{}'); } catch {}

  let tags: string[] = [];
  try { tags = JSON.parse(m.tagsJson || '[]'); } catch {}

  return {
    id: m.id,
    modelKey: m.modelKey,
    displayName: m.displayName,
    providerId: m.providerId,
    providerKey: m.provider.providerKey,
    providerName: m.provider.name,
    adapterType: m.provider.adapterType,
    baseUrl: m.provider.baseUrl,
    providerModelId: m.providerModelId || m.modelKey,
    family: m.family || 'general',
    version: m.version || '1.0',
    description: m.description,
    capabilities,
    contextWindow: m.contextWindow,
    maxOutputTokens: m.maxOutputTokens,
    pricing,
    performance,
    environmentalMetrics,
    tags,
    enabled: m.enabled,
    available: m.available,
    isDefault: m.isDefault,
    isMockModel: m.isMockModel,
    status: m.status,
  };
}
