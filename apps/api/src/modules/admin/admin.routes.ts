// ============================================================================
// Admin Routes
// ============================================================================

import { FastifyInstance } from 'fastify';
import { adminMiddleware } from '../../middleware/auth.middleware';
import { paginationSchema } from '@ecoroute/validation';

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', adminMiddleware);

  // GET /api/v1/admin/overview
  fastify.get('/overview', async (request, reply) => {
    const [totalUsers, totalTasks, completedTasks, _failedTasks, activeProviders] = await Promise.all([
      fastify.prisma.user.count(),
      fastify.prisma.task.count(),
      fastify.prisma.task.count({ where: { status: 'COMPLETED' } }),
      fastify.prisma.task.count({ where: { status: 'FAILED' } }),
      fastify.prisma.aIProvider.count({ where: { status: 'ACTIVE' } }),
    ]);

    const recentTasks = await fastify.prisma.task.count({
      where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
    });

    const recentErrors = await fastify.prisma.task.count({
      where: { status: 'FAILED', createdAt: { gte: new Date(Date.now() - 86400000) } },
    });

    const routingSuccessRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return reply.send({
      data: {
        totalUsers,
        totalTasks,
        routingSuccessRate: Math.round(routingSuccessRate * 10) / 10,
        activeProviders,
        recentTasks,
        recentErrors,
      },
      meta: { requestId: request.id },
    });
  });

  // GET /api/v1/admin/users
  fastify.get('/users', async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    const [users, totalCount] = await Promise.all([
      fastify.prisma.user.findMany({
        select: { id: true, email: true, displayName: true, role: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      fastify.prisma.user.count(),
    ]);

    return reply.send({
      data: users,
      meta: {
        requestId: request.id,
        page: query.page,
        pageSize: query.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / query.pageSize),
        hasMore: query.page < Math.ceil(totalCount / query.pageSize),
      },
    });
  });

  // GET /api/v1/admin/audit-events
  fastify.get('/audit-events', async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    const [events, totalCount] = await Promise.all([
      fastify.prisma.auditEvent.findMany({
        include: { user: { select: { email: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      fastify.prisma.auditEvent.count(),
    ]);

    return reply.send({
      data: events.map((e) => ({
        id: e.id,
        userId: e.userId,
        userEmail: e.user?.email,
        userName: e.user?.displayName,
        eventType: e.eventType,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        metadata: e.metadataJson ? JSON.parse(e.metadataJson) : null,
        createdAt: e.createdAt.toISOString(),
      })),
      meta: {
        requestId: request.id,
        page: query.page,
        pageSize: query.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / query.pageSize),
        hasMore: query.page < Math.ceil(totalCount / query.pageSize),
      },
    });
  });

  // POST /api/v1/admin/models — Create a model
  fastify.post('/models', async (request, reply) => {
    const body = request.body as {
      providerId: string;
      modelKey: string;
      displayName: string;
      capabilities: string[];
      contextWindow: number;
      pricing: Record<string, unknown>;
    };

    const model = await fastify.prisma.aIModel.create({
      data: {
        providerId: body.providerId,
        modelKey: body.modelKey,
        displayName: body.displayName,
        capabilitiesJson: JSON.stringify(body.capabilities),
        contextWindow: body.contextWindow,
        pricingJson: JSON.stringify(body.pricing),
      },
    });

    return reply.status(201).send({ data: model, meta: { requestId: request.id } });
  });

  // PUT /api/v1/admin/models/:modelId — Update a model
  fastify.put('/models/:modelId', async (request, reply) => {
    const { modelId } = request.params as { modelId: string };
    const body = request.body as Record<string, unknown>;

    const updateData: Record<string, unknown> = {};
    if (body.displayName) updateData.displayName = body.displayName;
    if (body.capabilities) updateData.capabilitiesJson = JSON.stringify(body.capabilities);
    if (body.contextWindow) updateData.contextWindow = body.contextWindow;
    if (body.pricing) updateData.pricingJson = JSON.stringify(body.pricing);
    if (body.status) updateData.status = body.status;

    const model = await fastify.prisma.aIModel.update({
      where: { id: modelId },
      data: updateData,
    });

    return reply.send({ data: model, meta: { requestId: request.id } });
  });

  // PUT /api/v1/admin/providers/:providerId — Update a provider
  fastify.put('/providers/:providerId', async (request, reply) => {
    const { providerId } = request.params as { providerId: string };
    const body = request.body as Record<string, unknown>;

    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.config) updateData.configJson = JSON.stringify(body.config);

    const provider = await fastify.prisma.aIProvider.update({
      where: { id: providerId },
      data: updateData,
    });

    return reply.send({ data: provider, meta: { requestId: request.id } });
  });
}
