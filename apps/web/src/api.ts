const gatewayUrl = (import.meta.env.VITE_API_GATEWAY_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:8080';
const tokenKey = 'arcade.auth.token';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(tokenKey);
  const response = await fetch(`${gatewayUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => null) as { message?: string; details?: unknown } | null;
  if (!response.ok) throw new ApiError(body?.message ?? `Request failed (${response.status})`, response.status);
  return body as T;
}

export { gatewayUrl };
