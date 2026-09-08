import { ConsentRecord, ConsentType } from './types';

/**
 * Storage-agnostic consent service. The API wires this to Prisma (`consent_record` table); tests
 * and other packages can use the in-memory implementation below.
 */
export interface ConsentStore {
  find(tenantId: string, dataSubjectId: string, purpose: string): Promise<ConsentRecord | null>;
  upsert(record: ConsentRecord): Promise<void>;
  revoke(tenantId: string, dataSubjectId: string, purpose: string, revokedAt: Date): Promise<void>;
}

export class InMemoryConsentStore implements ConsentStore {
  private records = new Map<string, ConsentRecord>();

  private key(tenantId: string, dataSubjectId: string, purpose: string): string {
    return `${tenantId}::${dataSubjectId}::${purpose}`;
  }

  async find(tenantId: string, dataSubjectId: string, purpose: string): Promise<ConsentRecord | null> {
    return this.records.get(this.key(tenantId, dataSubjectId, purpose)) ?? null;
  }

  async upsert(record: ConsentRecord): Promise<void> {
    this.records.set(this.key(record.tenantId, record.dataSubjectId, record.purpose), record);
  }

  async revoke(tenantId: string, dataSubjectId: string, purpose: string, revokedAt: Date): Promise<void> {
    const existing = await this.find(tenantId, dataSubjectId, purpose);
    if (existing) {
      existing.revokedAt = revokedAt;
      existing.granted = false;
      await this.upsert(existing);
    }
  }
}

export class ConsentService {
  constructor(private readonly store: ConsentStore) {}

  async grant(
    tenantId: string,
    dataSubjectId: string,
    purpose: string,
    type: ConsentType,
    method: string,
  ): Promise<ConsentRecord> {
    const record: ConsentRecord = {
      id: `${tenantId}-${dataSubjectId}-${purpose}-${Date.now()}`,
      tenantId,
      dataSubjectId,
      purpose,
      type,
      granted: true,
      grantedAt: new Date(),
      revokedAt: null,
      method,
    };
    await this.store.upsert(record);
    return record;
  }

  async revoke(tenantId: string, dataSubjectId: string, purpose: string): Promise<void> {
    await this.store.revoke(tenantId, dataSubjectId, purpose, new Date());
  }

  async get(tenantId: string, dataSubjectId: string, purpose: string): Promise<ConsentRecord | null> {
    return this.store.find(tenantId, dataSubjectId, purpose);
  }
}
