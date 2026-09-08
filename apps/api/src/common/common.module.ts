import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaAuditSink } from './prisma-audit-sink';
import { AbilityFactory } from './ability.factory';
import { TenantCdmWriter } from './tenant-cdm-writer';

/**
 * Infrastructure providers shared by every feature module: the Prisma client, the audit sink, and
 * the CASL ability factory. Marked `@Global()` so feature modules don't each need to re-import it.
 */
@Global()
@Module({
  providers: [PrismaService, PrismaAuditSink, AbilityFactory, TenantCdmWriter],
  exports: [PrismaService, PrismaAuditSink, AbilityFactory, TenantCdmWriter],
})
export class CommonModule {}
