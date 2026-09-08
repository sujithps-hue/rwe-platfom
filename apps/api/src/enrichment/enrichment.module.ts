import { Module } from '@nestjs/common';
import { EnrichmentService } from './enrichment.service';
import { EnrichmentController } from './enrichment.controller';
import { TenantEnrichmentStore } from './tenant-enrichment-store';

@Module({
  providers: [EnrichmentService, TenantEnrichmentStore],
  controllers: [EnrichmentController],
  exports: [EnrichmentService],
})
export class EnrichmentModule {}
