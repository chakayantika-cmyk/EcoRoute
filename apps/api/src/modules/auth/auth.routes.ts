// ============================================================================
// Auth Routes
// ============================================================================

import { FastifyInstance } from 'fastify';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, requestOtpSchema } from '@ecoroute/validation';
import { authMiddleware } from '../../middleware/auth.middleware';

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify.prisma);

  // POST /api/v1/auth/request-otp
  fastify.post('/request-otp', async (request, reply) => {
    const body = requestOtpSchema.parse(request.body);
    const result = await authService.requestOtp(body.email, body.displayName);
    return reply.send({
      data: result,
      meta: { requestId: request.id },
    });
  });

  // POST /api/v1/auth/register
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.register(body.email, body.otp, body.password, body.displayName);
    return reply.status(201).send({
      data: result,
      meta: { requestId: request.id },
    });
  });

  // POST /api/v1/auth/login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(body.email, body.password);
    return reply.send({
      data: result,
      meta: { requestId: request.id },
    });
  });

  // POST /api/v1/auth/logout
  fastify.post('/logout', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    if (!refreshToken) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required', requestId: request.id },
      });
    }
    await authService.logout(request.userId!, refreshToken);
    return reply.send({ data: { message: 'Logged out successfully' }, meta: { requestId: request.id } });
  });

  // POST /api/v1/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    if (!refreshToken) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required', requestId: request.id },
      });
    }
    const result = await authService.refresh(refreshToken);
    return reply.send({ data: result, meta: { requestId: request.id } });
  });

  // GET /api/v1/auth/me
  fastify.get('/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const profile = await authService.getProfile(request.userId!);
    return reply.send({ data: profile, meta: { requestId: request.id } });
  });

  // POST /api/v1/auth/forgot-password
  fastify.post('/forgot-password', async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);
    const result = await authService.forgotPassword(body.email);
    return reply.send({ data: result, meta: { requestId: request.id } });
  });

  // POST /api/v1/auth/reset-password
  fastify.post('/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);
    const result = await authService.resetPassword(body.token, body.password);
    return reply.send({ data: result, meta: { requestId: request.id } });
  });
}
