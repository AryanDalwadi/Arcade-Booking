import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { requireAnyRole } from '@arcade/service-auth';
import { verifyJwt } from './auth.js';
import type { GatewayConfig } from './config.js';
import { MemoryRateLimitStore, rateLimit, type RateLimitStore } from './rate-limit.js';

type ApiError = { success: false; message: string; code?: string };

const services = [
  ['identity', 'IDENTITY_SERVICE_URL'],
  ['catalog', 'CATALOG_SERVICE_URL'],
  ['booking', 'BOOKING_SERVICE_URL'],
  ['payment', 'PAYMENT_SERVICE_URL'],
  ['analytics', 'ANALYTICS_SERVICE_URL'],
] as const;

export function createApp(
  config: GatewayConfig,
  store: RateLimitStore = new MemoryRateLimitStore(),
  isAccepting: () => boolean = () => true,
) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);
  const correlation: RequestHandler = (request, response, next) => {
    const supplied = request.header('x-correlation-id')?.trim();
    const correlationId = supplied && supplied.length <= 128 ? supplied : randomUUID();
    request.headers['x-correlation-id'] = correlationId;
    response.setHeader('x-correlation-id', correlationId);
    next();
  };
  app.use(correlation);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
    exposedHeaders: ['x-correlation-id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  }));
  app.get('/health/live', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    });
  });
  app.get('/health', (_request, response) => {
    if (!isAccepting()) {
      response.status(503).json({
        status: 'draining',
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    response.json({
      status: 'ok',
      service: 'api-gateway',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });
  app.use(rateLimit({ store, windowMs: config.RATE_LIMIT_WINDOW_MS, max: config.RATE_LIMIT_MAX }));

  app.use(verifyJwt(config));
  const staffOrAdmin = requireAnyRole('ADMIN', 'STAFF');
  const adminOnly = requireAnyRole('ADMIN');
  app.use('/api/identity/users', staffOrAdmin);
  app.use('/api/identity/user-groups', (request, response, next) =>
    request.method === 'GET'
      ? staffOrAdmin(request, response, next)
      : adminOnly(request, response, next));
  app.use('/api/catalog', (request, response, next) =>
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
      ? staffOrAdmin(request, response, next)
      : next());
  app.use('/api/payment', staffOrAdmin);
  app.use('/api/analytics', staffOrAdmin);

  for (const [name, configKey] of services) {
    const prefix = `/api/${name}`;
    app.use(prefix, createProxyMiddleware({
      target: config[configKey],
      changeOrigin: true,
      proxyTimeout: 15_000,
      timeout: 15_000,
      pathRewrite: (path) => {
        const servicePath = path.replace(new RegExp(`^${prefix}`), '') || '/';
        return `/v1${servicePath}`;
      },
      on: {
        error(error, _request, response) {
          if ('headersSent' in response && !response.headersSent) {
            response.writeHead(502, { 'Content-Type': 'application/json' });
          }
          if ('end' in response) {
            response.end(JSON.stringify({
              success: false,
              message: `${name} service is unavailable`,
              code: 'UPSTREAM_UNAVAILABLE',
            } satisfies ApiError));
          }
          console.error(`[proxy:${name}]`, error.message);
        },
      },
    }));
  }

  app.use((_request, response) => {
    response.status(404).json({ success: false, message: 'Route not found', code: 'NOT_FOUND' } satisfies ApiError);
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    console.error('[gateway]', error);
    if (!response.headersSent) {
      response.status(500).json({
        success: false,
        message: 'Internal gateway error',
        code: 'INTERNAL_ERROR',
      } satisfies ApiError);
    }
  };
  app.use(errorHandler);
  return app;
}
