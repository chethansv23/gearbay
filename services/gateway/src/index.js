import { randomUUID } from 'node:crypto';
import { ApiHeaders, createLogger } from '@gearbay/common';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { DEFAULT_PORT, ROUTES, SERVICE_NAME } from './constants/index.js';

const logger = createLogger(SERVICE_NAME);
const app = express();
app.disable('x-powered-by');

// Stamp every request with an X-Request-Id (reusing the caller's) so logs can be correlated across services.
app.use((req, res, next) => {
  const id = req.get(ApiHeaders.REQUEST_ID) ?? randomUUID();
  req.headers[ApiHeaders.REQUEST_ID] = id;
  res.set(ApiHeaders.REQUEST_ID, id);
  next();
});
app.get('/health', (_req, res) => res.json({ status: 'UP' }));

for (const { paths, target } of ROUTES) {
  app.use(createProxyMiddleware({ target, changeOrigin: true, pathFilter: paths }));
}

const port = Number(process.env.PORT ?? DEFAULT_PORT);
app.listen(port, () => logger.info({ port, routes: ROUTES }, `${SERVICE_NAME} listening`));
