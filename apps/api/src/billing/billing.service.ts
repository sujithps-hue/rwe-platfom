import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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

    let customerId: string;
    let billingProviderRef: string;
    try {
      customerId = await this.billingProvider.createCustomer(tenant.id, tenant.name, billingEmail);
      billingProviderRef = await this.billingProvider.createSubscription(tenant.id, customerId, planCode);
    } catch (err) {
      // StripeBillingProvider is an intentionally unconfigured reference implementation until a
      // deployment sets STRIPE_SECRET_KEY (see stripe-billing.provider.ts) — surface that as a
      // clear 503 rather than an opaque 500 "Internal server error".
      throw new ServiceUnavailableException(err instanceof Error ? err.message : String(err));
    }

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
