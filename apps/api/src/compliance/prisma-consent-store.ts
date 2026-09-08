import { Injectable } from '@nestjs/common';
import { ConsentRecord, ConsentStore } from '@rwe/compliance-engine';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PrismaConsentStore implements ConsentStore {
  constructor(private readonly prisma: PrismaService) {}

  async find(tenantId: string, dataSubjectId: string, purpose: string): Promise<ConsentRecord | null> {
    const row = await this.prisma.consentRecord.findFirst({
      where: { tenantId, dataSubjectId, purpose },
      orderBy: { grantedAt: 'desc' },
    });
    return row ? toConsentRecord(row) : null;
  }

  async upsert(record: ConsentRecord): Promise<void> {
    await this.prisma.consentRecord.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        tenantId: record.tenantId,
        dataSubjectId: record.dataSubjectId,
        purpose: record.purpose,
        type: record.type,
        granted: record.granted,
        grantedAt: record.grantedAt,
        revokedAt: record.revokedAt,
        method: record.method,
      },
      update: {
        granted: record.granted,
        revokedAt: record.revokedAt,
      },
    });
  }

  async revoke(tenantId: string, dataSubjectId: string, purpose: string, revokedAt: Date): Promise<void> {
    await this.prisma.consentRecord.updateMany({
      where: { tenantId, dataSubjectId, purpose, revokedAt: null },
      data: { revokedAt, granted: false },
    });
  }
}

function toConsentRecord(row: {
  id: string;
  tenantId: string;
  dataSubjectId: string;
  purpose: string;
  type: string;
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
  method: string;
}): ConsentRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    dataSubjectId: row.dataSubjectId,
    purpose: row.purpose,
    type: row.type as ConsentRecord['type'],
    granted: row.granted,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
    method: row.method,
  };
}
