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
      message || `No configured AI provider is available for this task (${provider}). Please configure an API key in Settings or enable AI_MOCK_MODE=true for testing.`,
      503,
      { provider },
    );
    this.name = 'ProviderNotConfiguredError';
  }
}

export class ProviderAuthenticationFailedError extends AppError {
  constructor(provider: string, message?: string) {
    super(
      'PROVIDER_AUTHENTICATION_FAILED',
      message || `Authentication failed for provider ${provider}. Please verify API key.`,
      401,
      { provider },
    );
    this.name = 'ProviderAuthenticationFailedError';
  }
}

export class ProviderRateLimitedError extends AppError {
  constructor(provider: string, message?: string) {
    super(
      'PROVIDER_RATE_LIMITED',
      message || `Rate limit exceeded for provider ${provider}.`,
      429,
      { provider },
    );
    this.name = 'ProviderRateLimitedError';
  }
}

export class ProviderTimeoutError extends AppError {
  constructor(provider: string, message?: string) {
    super(
      'PROVIDER_TIMEOUT',
      message || `Timeout waiting for response from provider ${provider}.`,
      504,
      { provider },
    );
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderUnavailableError extends AppError {
  constructor(provider: string, message?: string) {
    super(
      'PROVIDER_UNAVAILABLE',
      message || `Provider ${provider} is currently unavailable or experiencing an outage.`,
      503,
      { provider },
    );
    this.name = 'ProviderUnavailableError';
  }
}

export class ModelNotEligibleError extends AppError {
  constructor(modelKey: string, reason: string) {
    super(
      'MODEL_NOT_ELIGIBLE',
      `Model ${modelKey} is not eligible: ${reason}`,
      400,
      { modelKey, reason },
    );
    this.name = 'ModelNotEligibleError';
  }
}

export class RoutingFailedError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('ROUTING_FAILED', message, 500, details);
    this.name = 'RoutingFailedError';
  }
}

export class AllProvidersFailedError extends AppError {
  constructor(message?: string, details?: Record<string, unknown>) {
    super(
      'ALL_PROVIDERS_FAILED',
      message || 'No available AI provider could complete this request. Please configure valid API credentials or pull required local models.',
      502,
      details,
    );
    this.name = 'AllProvidersFailedError';
  }
}

export class NoEligibleFreeModelError extends AppError {
  constructor(message?: string, details?: Record<string, unknown>) {
    super(
      'NO_ELIGIBLE_FREE_MODEL',
      message || 'No eligible free-tier AI models are currently available to execute this task.',
      502,
      details,
    );
    this.name = 'NoEligibleFreeModelError';
  }
}

export class ProviderModelUnavailableError extends AppError {
  constructor(provider: string, model: string, message?: string) {
    super(
      'PROVIDER_MODEL_UNAVAILABLE',
      message || `Model '${model}' is not installed or unavailable on provider '${provider}'.`,
      404,
      { provider, model },
    );
    this.name = 'ProviderModelUnavailableError';
  }
}

export class ProviderUnreachableError extends AppError {
  constructor(provider: string, message?: string) {
    super(
      'PROVIDER_UNREACHABLE',
      message || `Provider '${provider}' is unreachable or daemon is not running.`,
      503,
      { provider },
    );
    this.name = 'ProviderUnreachableError';
  }
}

