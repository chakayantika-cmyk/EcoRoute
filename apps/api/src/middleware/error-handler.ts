// ============================================================================
// Centralized Error Handler
// ============================================================================

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../lib/errors';
import { ZodError } from 'zod';

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const requestId = request.id;

  // Zod validation error
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { issues: error.errors },
        requestId,
      },
    });
  }

  // Syntax error (e.g. malformed JSON body)
  if (error instanceof SyntaxError) {
    return reply.status(400).send({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid JSON in request body',
        requestId,
      },
    });
  }

  // Application error
  if (error instanceof AppError) {
    request.log.warn({ err: error, requestId }, error.message);
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
      },
    });
  }

  // Fastify validation error
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        requestId,
      },
    });
  }

  // Fastify standard errors with status code (e.g. 400, 404, 429)
  if ('statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      error: {
        code: (error as any).code || 'CLIENT_ERROR',
        message: error.message,
        requestId,
      },
    });
  }

  // Unknown error — log full details, but return safe message
  request.log.error({ err: error, requestId }, 'Unhandled error');
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      requestId,
    },
  });
}
