import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsentService, ConsentType, DsarRequestType, DsarService } from '@rwe/compliance-engine';
import { PrismaConsentStore } from './prisma-consent-store';
import { PrismaDsarStore } from './prisma-dsar-store';
import { PrismaAuditSink } from '../common/prisma-audit-sink';
import { getTenantContext } from '../common/tenant-context';

@Injectable()
export class ComplianceService {
  private readonly consentService: ConsentService;

  constructor(
    consentStore: PrismaConsentStore,
    private readonly dsarStore: PrismaDsarStore,
    private readonly auditSink: PrismaAuditSink,
  ) {
    this.consentService = new ConsentService(consentStore);
  }

  async grantConsent(dataSubjectId: string, purpose: string, type: ConsentType, method: string) {
    const { tenant } = getTenantContext();
    return this.consentService.grant(tenant.id, dataSubjectId, purpose, type, method);
  }

  async revokeConsent(dataSubjectId: string, purpose: string) {
    const { tenant } = getTenantContext();
    return this.consentService.revoke(tenant.id, dataSubjectId, purpose);
  }

  async getConsent(dataSubjectId: string, purpose: string) {
    const { tenant } = getTenantContext();
    return this.consentService.get(tenant.id, dataSubjectId, purpose);
  }

  async submitDsar(dataSubjectId: string, type: DsarRequestType) {
    const { tenant, engine } = getTenantContext();
    const dsarService = new DsarService(this.dsarStore, engine);
    try {
      return await dsarService.intake(tenant.id, dataSubjectId, type);
    } catch (err) {
      // DsarService.intake() throws a plain Error when the request type isn't supported under
      // the tenant's applicable framework (e.g. "erasure" under HIPAA-only) — that's a client
      // input problem, not a server fault, so it must surface as 400 with the real reason rather
      // than falling through to Nest's default 500 "Internal server error".
      throw new BadRequestException(err instanceof Error ? err.message : String(err));
    }
  }

  async listDsarRequests() {
    const { tenant } = getTenantContext();
    return this.dsarStore.listByTenant(tenant.id);
  }

  async fulfillDsar(id: string) {
    const { engine } = getTenantContext();
    const dsarService = new DsarService(this.dsarStore, engine);
    return dsarService.markFulfilled(id);
  }

  async queryAuditLog(filters?: { action?: string; actorId?: string; resourceType?: string }) {
    const { tenant } = getTenantContext();
    return this.auditSink.query(tenant.id, filters as never);
  }

  /** Surfaces the tenant's effective compliance policy — the "which regulations apply, and what does each require" view for the tenant's compliance dashboard. */
  getEffectivePolicy() {
    const { engine } = getTenantContext();
    return engine.getPolicy();
  }

  breachNotificationDeadline(discoveredAt: Date) {
    const { engine } = getTenantContext();
    return engine.breachNotificationDeadline(discoveredAt);
  }
}
