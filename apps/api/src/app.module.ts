import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { TenantContextMiddleware } from './tenants/tenant-context.middleware';
import { ConnectorsModule } from './connectors/connectors.module';
import { ComplianceModule } from './compliance/compliance.module';
import { BillingModule } from './billing/billing.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CareManagementModule } from './care-management/care-management.module';
import { EnrichmentModule } from './enrichment/enrichment.module';
import { AuditInterceptor } from './common/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    AuthModule,
    TenantsModule,
    ConnectorsModule,
    ComplianceModule,
    BillingModule,
    AnalyticsModule,
    CareManagementModule,
    EnrichmentModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Applied to every route except auth/tenant-provisioning, which by definition run before a
    // tenant can be resolved (see docs/ARCHITECTURE.md#request-lifecycle).
    consumer
      .apply(TenantContextMiddleware)
      .exclude('auth/(.*)', 'tenants', 'tenants/(.*)')
      .forRoutes('*');
  }
}
