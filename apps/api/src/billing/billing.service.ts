import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { getTenantContext } from '../common/tenant-context';
import { StripeBillingProvider } from './stripe-billing.provider';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingProvider: StripeBillingProvider,
  ) {}

  async listPlans() {
    return this.prisma.subscriptionPlan.findMany();
  }

  async subscribe(planCode: string, billingEmail: string) {
    const { tenant } = getTenantContext();
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { code: planCode } });
    if (!plan) throw new NotFoundException(`Unknown plan code "${planCode}"`);

    const customerId = await this.billingProvider.createCustomer(tenant.id, tenant.name, billingEmail);
    const billingProviderRef = await this.billingProvider.createSubscription(tenant.id, customerId, planCode);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        billingProviderRef,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
  }

  async currentSubscription() {
    const { tenant } = getTenantContext();
    return this.prisma.subscription.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { currentPeriodStart: 'desc' },
      include: { plan: true },
    });
  }
}
