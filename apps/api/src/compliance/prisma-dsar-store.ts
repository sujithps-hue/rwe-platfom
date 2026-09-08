import { Injectable } from '@nestjs/common';
import { DsarRequest, DsarStore } from '@rwe/compliance-engine';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PrismaDsarStore implements DsarStore {
  constructor(private readonly prisma: PrismaService) {}

  async create(request: DsarRequest): Promise<DsarRequest> {
    const row = await this.prisma.dsarRequestRecord.create({
      data: {
        id: request.id,
        tenantId: request.tenantId,
        dataSubjectId: request.dataSubjectId,
        type: request.type,
        requestedAt: request.requestedAt,
        dueBy: request.dueBy,
        fulfilledAt: request.fulfilledAt,
        status: request.status,
      },
    });
    return toDsarRequest(row);
  }

  async update(id: string, patch: Partial<DsarRequest>): Promise<DsarRequest> {
    const row = await this.prisma.dsarRequestRecord.update({
      where: { id },
      data: {
        status: patch.status,
        fulfilledAt: patch.fulfilledAt,
      },
    });
    return toDsarRequest(row);
  }

  async listByTenant(tenantId: string): Promise<DsarRequest[]> {
    const rows = await this.prisma.dsarRequestRecord.findMany({ where: { tenantId }, orderBy: { requestedAt: 'desc' } });
    return rows.map(toDsarRequest);
  }
}

function toDsarRequest(row: {
  id: string;
  tenantId: string;
  dataSubjectId: string;
  type: string;
  requestedAt: Date;
  dueBy: Date;
  fulfilledAt: Date | null;
  status: string;
}): DsarRequest {
  return {
    id: row.id,
    tenantId: row.tenantId,
    dataSubjectId: row.dataSubjectId,
    type: row.type as DsarRequest['type'],
    requestedAt: row.requestedAt,
    dueBy: row.dueBy,
    fulfilledAt: row.fulfilledAt,
    status: row.status as DsarRequest['status'],
  };
}
