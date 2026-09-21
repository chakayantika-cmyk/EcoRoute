// ============================================================================
// Structured Logger
// ============================================================================

import pino from 'pino';

export function createLogger(level: string = 'info') {
  return pino({
    level,
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'passwordHash', 'token', 'refreshToken'],
      censor: '[REDACTED]',
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        requestId: req.id,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  });
}
