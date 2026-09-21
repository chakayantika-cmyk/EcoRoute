// ============================================================================
// EcoRoute AI — API Server
// ============================================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { getConfig, isMockMode } from './config/env';
import { createLogger } from './lib/logger';
import prismaPlugin from './plugins/prisma.plugin';
import { errorHandler } from './middleware/error-handler';
import { authRoutes } from './modules/auth/auth.routes';
import { tasksRoutes } from './modules/tasks/tasks.routes';
import { preferencesRoutes } from './modules/preferences/preferences.routes';
import { modelsRoutes } from './modules/models/models.routes';
import { providersRoutes } from './modules/providers/providers.routes';
import { adminRoutes } from './modules/admin/admin.routes';

async function buildServer() {
  const config = getConfig();
  const logger = createLogger(config.LOG_LEVEL);

  const fastify = Fastify({
    logger: logger as any,
    genReqId: () => crypto.randomUUID(),
    requestTimeout: 60000,
  });

  // Allow empty body for application/json requests (e.g. DELETE requests)
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      done(null, undefined);
      return;
    }
    try {
      const json = JSON.parse(body as string);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // ---- Global Plugins ----
  await fastify.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Handled by frontend
  });

  await fastify.register(cookie);

  await fastify.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
  });

  // ---- Database ----
  await fastify.register(prismaPlugin);

  // ---- Error Handler ----
  fastify.setErrorHandler(errorHandler as any);

  // ---- Health Check ----
  fastify.get('/health', async (_request, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      return reply.send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        mockMode: isMockMode(),
        version: '1.0.0',
      });
    } catch {
      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
      });
    }
  });

  // ---- API Routes ----
  const prefix = '/api/v1';

  await fastify.register(authRoutes, { prefix: `${prefix}/auth` });
  await fastify.register(tasksRoutes, { prefix: `${prefix}/tasks` });
  await fastify.register(preferencesRoutes, { prefix: `${prefix}/preferences` });
  await fastify.register(modelsRoutes, { prefix: `${prefix}/models` });
  await fastify.register(providersRoutes, { prefix: `${prefix}/providers` });
  await fastify.register(adminRoutes, { prefix: `${prefix}/admin` });

  return fastify;
}

async function start() {
  try {
    const config = getConfig();
    const server = await buildServer();

    await server.listen({ port: config.API_PORT, host: config.API_HOST });

    server.log.info(`🚀 EcoRoute AI API running on http://${config.API_HOST}:${config.API_PORT}`);
    server.log.info(`📋 Mock mode: ${isMockMode() ? 'ENABLED (no API keys configured)' : 'DISABLED (using live providers)'}`);
    server.log.info(`🏥 Health check: http://${config.API_HOST}:${config.API_PORT}/health`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
