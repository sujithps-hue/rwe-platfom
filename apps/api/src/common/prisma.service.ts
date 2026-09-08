import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Wraps the generated Prisma client for the control-plane database. `forTenant` runs a callback
 * inside a transaction with `app.tenant_id` set via `SET LOCAL`, which the Row-Level-Security
 * policies in `packages/common-data-model/prisma/rls_policies.sql` key off — so every query
 * inside the callback is scoped to that tenant at the database level, not just by an
 * application-level `WHERE tenant_id = ...` clause that a bug could omit.
 *
 * PostgreSQL's `SET LOCAL` does not accept bind parameters, so `tenantId` is validated against a
 * strict UUID pattern before being interpolated into the SQL text — this is safe specifically
 * because the value is rejected outright unless it matches `UUID_RE`, not because raw-string
 * interpolation is fine in general.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async forTenant<T>(tenantId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    if (!UUID_RE.test(tenantId)) {
      throw new Error(`Refusing to set tenant context: "${tenantId}" is not a valid UUID`);
    }
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      return fn(tx as unknown as PrismaClient);
    });
  }
}
