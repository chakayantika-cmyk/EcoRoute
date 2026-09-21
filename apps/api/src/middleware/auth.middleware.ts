// ============================================================================
// Authentication Middleware
// ============================================================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../lib/tokens';
import { AuthenticationError, AuthorizationError } from '../lib/errors';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
    userRole?: string;
  }
}

export async function authMiddleware(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    request.userId = payload.userId;
    request.userEmail = payload.email;
    request.userRole = payload.role;
  } catch {
    throw new AuthenticationError('Invalid or expired access token');
  }
}

export async function adminMiddleware(request: FastifyRequest, _reply: FastifyReply) {
  await authMiddleware(request, _reply);
  if (request.userRole !== 'ADMIN') {
    throw new AuthorizationError('Administrator access required');
  }
}
