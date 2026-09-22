import express, { NextFunction, Request, Response, Router } from 'express';
import { ZodError } from 'zod';

export interface Dependencies {
  dbReady: () => Promise<boolean>;
  dependencyReady: () => boolean;
  routes: Router;
}

export function createHttpApp(deps: Dependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.get('/health/live', (_req, res) => res.json({ status: 'ok', service: 'booking' }));
  app.get('/health/ready', async (_req, res) => {
    const database = await deps.dbReady();
    const dependencies = deps.dependencyReady();
    res.status(database && dependencies ? 200 : 503).json({ status: database && dependencies ? 'ready' : 'not_ready', checks: { database, dependencies } });
  });
  app.use('/v1', deps.routes);
  app.use((_req, res) => res.status(404).json({ success: false, message: 'Not found', code: 'NOT_FOUND' }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) return res.status(400).json({ success: false, message: 'Invalid request', code: 'VALIDATION_ERROR', details: error.issues });
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal error', code: 'INTERNAL_ERROR' });
  });
  return app;
}

