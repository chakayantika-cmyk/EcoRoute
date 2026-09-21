// ============================================================================
// Application Error Classes
// ============================================================================

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_ERROR', message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super('AUTHORIZATION_ERROR', message, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super('NOT_FOUND', id ? `${resource} with ID ${id} not found` : `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super('RATE_LIMIT_EXCEEDED', message, 429);
    this.name = 'RateLimitError';
  }
}

export class ProviderError extends AppError {
  constructor(provider: string, message: string) {
    super('PROVIDER_ERROR', `Provider ${provider}: ${message}`, 502);
    this.name = 'ProviderError';
  }
}

export class ProviderNotConfiguredError extends AppError {
  constructor(provider: string, message?: string) {
    super(
      'PROVIDER_NOT_CONFIGURED',
      message || `No configured AI provider is available for this task (${provider}). Please set an API key in Settings or enable AI_MOCK_MODE=true.`,
      503,
      { provider },
    );
    this.name = 'ProviderNotConfiguredError';
  }
}

export class AllProvidersFailedError extends AppError {
  constructor(message?: string) {
    super(
      'ALL_PROVIDERS_FAILED',
      message || 'No available AI provider could complete this request.',
      502,
    );
    this.name = 'AllProvidersFailedError';
  }
}
