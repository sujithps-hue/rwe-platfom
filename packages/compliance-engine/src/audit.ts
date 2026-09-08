import { AuditAction, AuditEntry, Jurisdiction } from './types';

/**
 * Append-only audit sink. The API implementation writes to a Postgres table owned by a DB role
 * that only has INSERT (no UPDATE/DELETE) so the log stays tamper-evident even to a compromised
 * application identity — see the `audit_log` table + grants in `packages/common-data-model`.
 */
export interface AuditSink {
  append(entry: Omit<AuditEntry, 'id' | 'occurredAt'>): Promise<AuditEntry>;
  query(tenantId: string, filters?: Partial<Pick<AuditEntry, 'action' | 'actorId' | 'resourceType'>>): Promise<AuditEntry[]>;
}

export class InMemoryAuditSink implements AuditSink {
  private entries: AuditEntry[] = [];

  async append(entry: Omit<AuditEntry, 'id' | 'occurredAt'>): Promise<AuditEntry> {
    const full: AuditEntry = {
      ...entry,
      id: `audit-${this.entries.length + 1}-${Date.now()}`,
      occurredAt: new Date(),
    };
    this.entries.push(full);
    return full;
  }

  async query(
    tenantId: string,
    filters?: Partial<Pick<AuditEntry, 'action' | 'actorId' | 'resourceType'>>,
  ): Promise<AuditEntry[]> {
    return this.entries.filter((e) => {
      if (e.tenantId !== tenantId) return false;
      if (filters?.action && e.action !== filters.action) return false;
      if (filters?.actorId && e.actorId !== filters.actorId) return false;
      if (filters?.resourceType && e.resourceType !== filters.resourceType) return false;
      return true;
    });
  }
}

export class AuditLogger {
  constructor(private readonly sink: AuditSink) {}

  async log(params: {
    tenantId: string;
    actorId: string;
    actorRole: string;
    action: AuditAction;
    jurisdiction: Jurisdiction;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditEntry> {
    return this.sink.append({
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      jurisdiction: params.jurisdiction,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      metadata: params.metadata ?? {},
    });
  }
}

/**
 * Tracks a breach-notification clock once an incident is declared, per the effective policy's
 * `breachNotificationHours`. Surfaced on the tenant's compliance dashboard so the operator never
 * misses a statutory deadline (60 days HIPAA, 72 hours GDPR/PDPL/PDPA, 24 hours PIPL, etc.).
 */
export class BreachClock {
  static deadline(discoveredAt: Date, breachNotificationHours: number): Date {
    return new Date(discoveredAt.getTime() + breachNotificationHours * 60 * 60 * 1000);
  }

  static hoursRemaining(discoveredAt: Date, breachNotificationHours: number, now: Date = new Date()): number {
    const deadline = this.deadline(discoveredAt, breachNotificationHours);
    return (deadline.getTime() - now.getTime()) / (60 * 60 * 1000);
  }
}
