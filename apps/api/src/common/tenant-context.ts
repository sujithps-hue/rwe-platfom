import { AsyncLocalStorage } from 'async_hooks';
import { ComplianceEngine } from '@rwe/compliance-engine';
import { Tenant } from '@rwe/common-data-model';

export interface TenantContext {
  tenant: Tenant;
  engine: ComplianceEngine;
}

/**
 * Carries the resolved tenant + its compliance engine through a request's async call graph
 * without threading it through every function signature. Populated by
 * `TenantContextMiddleware`, read by `PrismaService.forCurrentTenant()` (to set the
 * `app.tenant_id` session variable RLS policies key off) and by any service that needs the
 * tenant's effective compliance policy.
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const ctx = tenantContextStorage.getStore();
  if (!ctx) {
    throw new Error('No tenant context is active — this code path must run inside TenantContextMiddleware');
  }
  return ctx;
}

export function tryGetTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}
