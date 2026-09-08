const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ApiClientOptions {
  tenantId?: string;
  accessToken?: string;
}

/**
 * Thin fetch wrapper for apps/api. `tenantId` maps to the `X-Tenant-Id` header
 * `TenantContextMiddleware` reads (see apps/api/src/tenants/tenant-context.middleware.ts);
 * `accessToken` is the JWT from `/auth/dev-login` in local dev, or a real SSO-issued token in
 * production.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiClientOptions & { method?: string; body?: unknown } = {},
): Promise<T> {
  const { tenantId, accessToken, method = 'GET', body } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${method} ${path} failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}
