/**
 * Local-dev seed: one demo tenant (US/HIPAA), one admin user, and the four subscription plans
 * from docs/MONETIZATION.md. Run with `npm run prisma:seed --workspace=packages/common-data-model`
 * after `prisma migrate deploy` against a running Postgres instance (see infra/docker).
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-clinic' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'Demo Clinic',
      slug: 'demo-clinic',
      homeRegion: 'us-east',
      jurisdictions: ['US'],
      isolationTier: 'shared_schema',
      schemaName: 'tenant_demo_clinic',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo-clinic.example' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@demo-clinic.example',
      role: 'tenant_admin',
    },
  });

  const plans: Array<{ code: 'starter' | 'growth' | 'enterprise' | 'platform'; name: string; monthlyPriceCents: number | null }> = [
    { code: 'starter', name: 'Starter', monthlyPriceCents: 49900 },
    { code: 'growth', name: 'Growth', monthlyPriceCents: 199900 },
    { code: 'enterprise', name: 'Enterprise', monthlyPriceCents: null },
    { code: 'platform', name: 'Platform (white-label)', monthlyPriceCents: null },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {},
      create: {
        code: plan.code,
        name: plan.name,
        monthlyPriceCents: plan.monthlyPriceCents,
        includedAllowances: {},
        overageRates: {},
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded tenant "${tenant.slug}" (${tenant.id}). Run the tenant schema template SQL manually`);
  // eslint-disable-next-line no-console
  console.log('for this tenant, or provision new tenants through the API (POST /tenants) which does it automatically.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
