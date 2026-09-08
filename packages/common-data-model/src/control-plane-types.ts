/**
 * TypeScript mirror of prisma/schema.prisma's control-plane models. `apps/api` uses the generated
 * `@prisma/client` types at runtime once `prisma generate` has been run against a real database;
 * these hand-written equivalents let other packages (and this repo's typecheck step) depend on
 * stable shapes without requiring a Prisma codegen step or DB connection.
 */
import { Jurisdiction } from '@rwe/compliance-engine';

export type IsolationTier = 'shared_schema' | 'dedicated_instance';
export type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'offboarding' | 'purged';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  homeRegion: string;
  jurisdictions: Jurisdiction[];
  isolationTier: IsolationTier;
  schemaName: string;
  status: TenantStatus;
  parentTenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RoleName = 'platform_admin' | 'tenant_admin' | 'clinician' | 'data_analyst' | 'auditor' | 'patient';

export interface AppUser {
  id: string;
  tenantId: string;
  email: string;
  role: RoleName;
  ssoSubjectId: string | null;
  createdAt: Date;
}

export interface ConnectorConfigRecord {
  id: string;
  tenantId: string;
  connectorType: string;
  displayName: string;
  credentialSecretId: string;
  config: Record<string, unknown>;
  lastSyncCursor: string | null;
  lastSyncedAt: Date | null;
  lastSyncStatus: 'ok' | 'error' | 'never_run' | null;
  consecutiveErrors: number;
  createdAt: Date;
}

export interface SubscriptionPlan {
  id: string;
  code: 'starter' | 'growth' | 'enterprise' | 'platform';
  name: string;
  includedAllowances: Record<string, number>;
  overageRates: Record<string, number>;
  monthlyPriceCents: number | null;
  createdAt: Date;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  billingProviderRef: string | null;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export type UsageMeter = 'records_ingested' | 'active_seats' | 'cohort_queries' | 'api_calls' | 'storage_gb_month';

export interface UsageRecord {
  id: string;
  tenantId: string;
  meter: UsageMeter;
  quantity: number;
  periodStart: Date;
  periodEnd: Date;
  reportedAt: Date;
}
