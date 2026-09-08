import { Injectable } from '@nestjs/common';
import { AuditEntry, AuditSink } from '@rwe/compliance-engine';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaAuditSink implements AuditSink {
  constructor(private readonly prisma: PrismaService) {}

  async append(entry: Omit<AuditEntry, 'id' | 'occurredAt'>): Promise<AuditEntry> {
    const row = await this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        action: entry.action,
        jurisdiction: entry.jurisdiction,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata as object,
      },
    });
    return { ...entry, id: row.id, occurredAt: row.occurredAt };
  }

  async query(
    tenantId: string,
    filters?: Partial<Pick<AuditEntry, 'action' | 'actorId' | 'resourceType'>>,
  ): Promise<AuditEntry[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId, ...filters },
      orderBy: { occurredAt: 'desc' },
      take: 500,
    });
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      actorId: row.actorId,
      actorRole: row.actorRole,
      action: row.action as AuditEntry['action'],
      jurisdiction: row.jurisdiction as AuditEntry['jurisdiction'],
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      occurredAt: row.occurredAt,
      metadata: row.metadata as Record<string, unknown>,
    }));
  }
}
