import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantContextMiddleware } from './tenant-context.middleware';

// JwtAuthGuard's JwtService dependency is satisfied by AuthModule's global JwtModule registration
// (see auth.module.ts) — no need to import JwtModule again here.
@Module({
  providers: [TenantsService, TenantContextMiddleware],
  controllers: [TenantsController],
  exports: [TenantsService, TenantContextMiddleware],
})
export class TenantsModule {}
