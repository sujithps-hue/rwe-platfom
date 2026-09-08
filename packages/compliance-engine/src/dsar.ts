import { randomUUID } from 'crypto';
import { DsarRequest, DsarRequestType } from './types';
import { ComplianceEngine } from './engine';

export interface DsarStore {
  create(request: DsarRequest): Promise<DsarRequest>;
  update(id: string, patch: Partial<DsarRequest>): Promise<DsarRequest>;
  listByTenant(tenantId: string): Promise<DsarRequest[]>;
}

export class InMemoryDsarStore implements DsarStore {
  private requests = new Map<string, DsarRequest>();

  async create(request: DsarRequest): Promise<DsarRequest> {
    this.requests.set(request.id, request);
    return request;
  }

  async update(id: string, patch: Partial<DsarRequest>): Promise<DsarRequest> {
    const existing = this.requests.get(id);
    if (!existing) throw new Error(`DSAR request ${id} not found`);
    const updated = { ...existing, ...patch };
    this.requests.set(id, updated);
    return updated;
  }

  async listByTenant(tenantId: string): Promise<DsarRequest[]> {
    return Array.from(this.requests.values()).filter((r) => r.tenantId === tenantId);
  }
}

/**
 * Data-subject-rights workflow: intake, SLA deadline computation (per the tenant's effective
 * compliance policy), and fulfillment status tracking. `type` must be checked against
 * `policy.dataSubjectRights` before intake is accepted — e.g. HIPAA does not grant a general
 * erasure right, so an `erasure` request against a US-only tenant should be rejected up front
 * with an explanation, not silently accepted and never fulfilled.
 */
export class DsarService {
  constructor(
    private readonly store: DsarStore,
    private readonly engine: ComplianceEngine,
  ) {}

  async intake(tenantId: string, dataSubjectId: string, type: DsarRequestType): Promise<DsarRequest> {
    const rights = this.engine.getPolicy().dataSubjectRights;
    const supported: Record<DsarRequestType, boolean> = {
      access: rights.access,
      rectification: rights.rectification,
      erasure: rights.erasure,
      portability: rights.portability,
      restriction: rights.restriction,
    };
    if (!supported[type]) {
      throw new Error(
        `Request type "${type}" is not supported under this tenant's applicable compliance framework(s)`,
      );
    }
    const now = new Date();
    const request: DsarRequest = {
      id: randomUUID(),
      tenantId,
      dataSubjectId,
      type,
      requestedAt: now,
      dueBy: this.engine.dsarDueDate(now),
      fulfilledAt: null,
      status: 'received',
    };
    return this.store.create(request);
  }

  async markFulfilled(id: string): Promise<DsarRequest> {
    return this.store.update(id, { status: 'fulfilled', fulfilledAt: new Date() });
  }

  async markInProgress(id: string): Promise<DsarRequest> {
    return this.store.update(id, { status: 'in_progress' });
  }

  async reject(id: string): Promise<DsarRequest> {
    return this.store.update(id, { status: 'rejected' });
  }
}
