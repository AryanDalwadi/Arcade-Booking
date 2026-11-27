import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload, type VerifyOptions } from 'jsonwebtoken';
import type { GatewayConfig } from './config.js';

const publicPaths = new Set([
  '/api/identity/auth/login',
  '/api/identity/auth/register',
  '/api/payment/webhooks/razorpay',
]);

const publicCatalogRead = /^\/api\/catalog\/(?:venues(?:\/slug\/[^/]+|\/[^/]+(?:\/(?:hours|rooms|packages|blackouts))?|)|party-types|inclusions|package-templates|booking-rules|machines(?:\/[^/]+\/quote)?)$/;
const publicPartySlots = /^\/api\/booking\/party-slots$/;
const publicPartyHold = /^\/api\/booking\/party-holds(?:\/[^/]+\/release)?$/;

function isPublicPartyAccess(method: string, path: string): boolean {
  if (method === 'GET' && publicPartySlots.test(path)) return true;
  return method === 'POST' && publicPartyHold.test(path);
}

export function isPublicCatalogRead(method: string, path: string): boolean {
  return method === 'GET' && publicCatalogRead.test(path);
}

export function verifyJwt(config: GatewayConfig) {
  const options: VerifyOptions = {};
  if (config.JWT_ISSUER) options.issuer = config.JWT_ISSUER;
  if (config.JWT_AUDIENCE) options.audience = config.JWT_AUDIENCE;

  return (request: Request, response: Response, next: NextFunction) => {
    delete request.headers['x-auth-subject'];
    delete request.headers['x-auth-role'];
    delete request.headers['x-auth-roles'];
    delete request.headers['x-auth-email'];

    if (!request.path.startsWith('/api/') || publicPaths.has(request.path)) {
      next();
      return;
    }
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      if (isPublicCatalogRead(request.method, request.path) || isPublicPartyAccess(request.method, request.path)) {
        next();
        return;
      }
      response.status(401).json({ success: false, message: 'Bearer token required', code: 'UNAUTHORIZED' });
      return;
    }
    try {
      const claims = jwt.verify(token, config.JWT_SECRET, options) as JwtPayload;
      response.locals.auth = claims;
      request.headers['x-auth-subject'] = String(claims.sub ?? '');
      if (claims.role) request.headers['x-auth-role'] = String(claims.role);
      if (Array.isArray(claims.roles)) request.headers['x-auth-roles'] = claims.roles.join(',');
      if (typeof claims.email === 'string' && claims.email) request.headers['x-auth-email'] = claims.email;
      next();
    } catch {
      response.status(401).json({ success: false, message: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    }
  };
}
