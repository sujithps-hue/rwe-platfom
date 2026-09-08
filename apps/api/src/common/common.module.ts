import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaAuditSink } from './prisma-audit-sink';
import { AbilityFactory } from './ability.factory';
import { TenantCdmWriter } from './tenant-cdm-writer';
import { ConceptMapper } from './concept-mapper';

/**
 * Infrastructure providers shared by every feature module: the Prisma client, the audit sink, the
 * CASL ability factory, and the OMOP concept mapper. Marked `@Global()` so feature modules don't
 * each need to re-import it.
 */
@Global()
@Module({
  providers: [PrismaService, PrismaAuditSink, AbilityFactory, TenantCdmWriter, ConceptMapper],
  exports: [PrismaService, PrismaAuditSink, AbilityFactory, TenantCdmWriter, ConceptMapper],
})
export class CommonModule {}
