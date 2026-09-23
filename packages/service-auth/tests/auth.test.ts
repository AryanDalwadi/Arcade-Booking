import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { readAuthContext, requireAnyRole } from '../src';

function request(headers: Record<string, string>): Request {
  return {
    header: (name: string) => headers[name.toLowerCase()],
  } as Request;
}

describe('service authorization', () => {
  it('keeps only supported roles from trusted headers', () => {
    const context = readAuthContext(request({
      'x-auth-subject': 'user-1',
      'x-auth-roles': 'CUSTOMER,unknown,ADMIN',
    }));
    expect(context?.subject).toBe('user-1');
    expect(context?.email).toBeUndefined();
    expect([...context!.roles]).toEqual(['CUSTOMER', 'ADMIN']);
  });

  it('forwards a verified email claim', () => {
    const context = readAuthContext(request({
      'x-auth-subject': 'user-1',
      'x-auth-roles': 'CUSTOMER',
      'x-auth-email': 'player@example.com',
    }));
    expect(context?.email).toBe('player@example.com');
  });

  it('denies a role mismatch with 403', () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const response = { status, json } as unknown as Response;
    const next = vi.fn() as NextFunction;
    requireAnyRole('ADMIN')(
      request({ 'x-auth-subject': 'user-1', 'x-auth-roles': 'CUSTOMER' }),
      response,
      next,
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROLE_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });
});
