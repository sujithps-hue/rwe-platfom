import { Injectable } from '@nestjs/common';
import { UsageMeter } from '@rwe/common-data-model';
import { PrismaService } from '../common/prisma.service';
import { getTenantContext } from '../common/tenant-context';

/**
 * Records metered usage events (docs/MONETIZATION.md#2-usage-based-metering) and rolls them up
 * for billing. `record()` is called by the modules that produce billable activity —
 * ConnectorsService after a sync (records_ingested), AnalyticsService per cohort query
 * (cohort_queries), and an auth interceptor for active_seats — rather than centralizing
 * instrumentation in one place that would need to know about every other module.
 */
@Injectable()
export class UsageMeterService {
  constructor(private readonly prisma: PrismaService) {}

  async record(meter: UsageMeter, quantity: number): Promise<void> {
    const { tenant } = getTenantContext();
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    await this.prisma.usageRecord.create({
      data: { tenantId: tenant.id, meter, quantity, periodStart, periodEnd },
    });
  }

  async rollupForCurrentPeriod(): Promise<Record<UsageMeter, number>> {
    const { tenant } = getTenantContext();
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const rows = await this.prisma.usageRecord.groupBy({
      by: ['meter'],
      where: { tenantId: tenant.id, periodStart: { gte: periodStart } },
      _sum: { quantity: true },
    });

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.meter] = row._sum.quantity ?? 0;
    }
    return result as Record<UsageMeter, number>;
  }
}
