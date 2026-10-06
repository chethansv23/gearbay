/** HTTP header names that are part of the public API. */
export const ApiHeaders = Object.freeze({
  IDEMPOTENCY_KEY: 'idempotency-key',
  REQUEST_ID: 'x-request-id',
});

/** Error codes shared by every service. Service-specific codes live in each service's constants folder. */
export const ErrorCodes = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

/** Postgres SQLSTATE codes the services react to. */
export const SqlStates = Object.freeze({
  UNIQUE_VIOLATION: '23505',
  EXCLUSION_VIOLATION: '23P01',
});
