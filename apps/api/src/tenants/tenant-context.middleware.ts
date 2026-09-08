import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ComplianceEngine } from '@rwe/compliance-engine';
import { TenantsService } from './tenants.service';
import { tenantContextStorage } from '../common/tenant-context';

/**
 * Resolves the active tenant for every request — from `X-Tenant-Id` (service-to-service calls),
 * a subdomain (`acme.rweplatform.com`), or (once JwtAuthGuard has run and set `req.user`) the
 * JWT's `tenantId` claim — and runs the rest of the request inside `tenantContextStorage` with
 * that tenant's resolved `ComplianceEngine` attached. See docs/ARCHITECTURE.md#request-lifecycle.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantsService: TenantsService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const headerTenantId = req.header('x-tenant-id');
    const hostTenantSlug = req.hostname.split('.')[0];

    const tenant = headerTenantId
      ? await this.tenantsService.findById(headerTenantId)
      : await this.tenantsService.findBySlugOrHost(hostTenantSlug);

    if (!tenant) {
      throw new NotFoundException('No tenant could be resolved for this request');
    }

    const engine = new ComplianceEngine(tenant.jurisdictions);

    tenantContextStorage.run({ tenant, engine }, () => next());
  }
}
