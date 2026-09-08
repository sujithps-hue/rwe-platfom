import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { PrismaConsentStore } from './prisma-consent-store';
import { PrismaDsarStore } from './prisma-dsar-store';
import { AuditInterceptor } from '../common/audit.interceptor';

@Module({
  providers: [ComplianceService, PrismaConsentStore, PrismaDsarStore, AuditInterceptor],
  controllers: [ComplianceController],
  exports: [ComplianceService, AuditInterceptor],
})
export class ComplianceModule {}
