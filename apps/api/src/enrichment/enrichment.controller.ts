import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { EnrichmentService } from './enrichment.service';

@Controller('enrichment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrichmentController {
  constructor(private readonly enrichmentService: EnrichmentService) {}

  /** Runs one enrichment batch on demand; production deployments schedule this on an interval instead (see docs/CONNECTORS.md's sync-scheduling model, which the same worker pattern applies to). */
  @Post('run')
  @Roles('tenant_admin', 'platform_admin')
  run() {
    return this.enrichmentService.runBatch();
  }
}
