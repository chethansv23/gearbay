import { randomUUID } from 'node:crypto';
import express from 'express';
import { ZodError, ZodObject } from 'zod';
import { ApiHeaders, ErrorCodes } from './constants/index.js';

/** Business error that becomes an RFC 9457 problem response with a stable machine-readable code. */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  static notFound(what, id) {
    return new ApiError(404, ErrorCodes.NOT_FOUND, `${what} ${id} not found`);
  }

  static badRequest(code, message) {
    return new ApiError(400, code, message);
  }

  static conflict(code, message) {
    return new ApiError(409, code, message);
  }
}

const TITLES = { 400: 'Bad Request', 404: 'Not Found', 409: 'Conflict', 500: 'Internal Server Error' };

function problem(res, req, status, code, detail, extra = {}) {
  res.status(status).type('application/problem+json')
    .json({ status, title: TITLES[status], code, detail, instance: req.originalUrl, ...extra });
}

/**
 * Parses `data` with a zod schema; failures become a 400 VALIDATION_FAILED listing each field.
 * A missing body counts as an empty object, but a missing header stays undefined.
 */
export function parse(schema, data) {
  return schema.parse(data === undefined && schema instanceof ZodObject ? {} : data);
}

/** Express app with JSON parsing, request ids, a health check and the shared error handler. */
export function createApp({ logger, routes, health }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use((req, res, next) => {
    req.id = req.get(ApiHeaders.REQUEST_ID) ?? randomUUID();
    res.set(ApiHeaders.REQUEST_ID, req.id);
    next();
  });
  app.get('/health', async (_req, res) => {
    try {
      await health?.();
      res.json({ status: 'UP' });
    } catch (error) {
      res.status(503).json({ status: 'DOWN', error: error.message });
    }
  });
  routes(app);
  app.use((req, res) => problem(res, req, 404, ErrorCodes.NOT_FOUND, `No route for ${req.method} ${req.path}`));
  // Express 5 forwards rejected promises from async handlers here.
  app.use((error, req, res, _next) => {
    if (error instanceof ApiError) return problem(res, req, error.status, error.code, error.message);
    if (error instanceof ZodError) {
      const errors = {};
      for (const issue of error.issues) errors[issue.path.join('.') || 'body'] ??= issue.message;
      return problem(res, req, 400, ErrorCodes.VALIDATION_FAILED, 'Request validation failed', { errors });
    }
    if (error.type === 'entity.parse.failed') {
      return problem(res, req, 400, ErrorCodes.VALIDATION_FAILED, 'Malformed JSON body');
    }
    logger.error({ err: error, requestId: req.id }, 'Unhandled error');
    return problem(res, req, 500, ErrorCodes.INTERNAL_ERROR, 'Unexpected error');
  });
  return app;
}
