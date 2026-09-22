import type { Request, RequestHandler } from 'express';
import { userRoleSchema, type UserRole } from '@arcade/contracts';

export type AuthContext = {
  subject: string;
  roles: ReadonlySet<UserRole>;
};

export function readAuthContext(request: Request): AuthContext | null {
  const subject = request.header('x-auth-subject')?.trim();
  if (!subject) return null;
  const roles = new Set<UserRole>();
  for (const candidate of (request.header('x-auth-roles') ?? '').split(',')) {
    const result = userRoleSchema.safeParse(candidate.trim());
    if (result.success) roles.add(result.data);
  }
  return { subject, roles };
}

export function hasAnyRole(request: Request, allowed: readonly UserRole[]): boolean {
  const context = readAuthContext(request);
  return Boolean(context && allowed.some((role) => context.roles.has(role)));
}

export const requireAuth: RequestHandler = (request, response, next) => {
  if (readAuthContext(request)) return next();
  return response.status(401).json({
    success: false,
    message: 'Verified user context is required',
    code: 'AUTH_CONTEXT_REQUIRED',
  });
};

export function requireAnyRole(...allowed: UserRole[]): RequestHandler {
  return (request, response, next) => {
    const context = readAuthContext(request);
    if (!context) {
      return response.status(401).json({
        success: false,
        message: 'Verified user context is required',
        code: 'AUTH_CONTEXT_REQUIRED',
      });
    }
    if (allowed.some((role) => context.roles.has(role))) return next();
    return response.status(403).json({
      success: false,
      message: `One of these roles is required: ${allowed.join(', ')}`,
      code: 'ROLE_REQUIRED',
    });
  };
}
