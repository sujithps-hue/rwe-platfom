import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CohortBuilderService } from './cohort-builder.service';
import { CohortDefinition } from './cohort-definition';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly cohortBuilderService: CohortBuilderService) {}

  /**
   * The no-code Cohort Builder's count endpoint. Returns only an aggregate count — never
   * per-patient identifiable rows — matching the Trusted-Research-Environment posture described
   * in docs/PRODUCT.md. A future `/analytics/cohorts/:id/export` endpoint is where a
   * de-identified or (role-gated) identifiable row-level export would be exposed, run through
   * the compliance engine's `Deidentifier` and logged via `@AuditableAction('export', ...)`.
   */
  @Post('cohorts/count')
  @Roles('data_analyst', 'clinician', 'tenant_admin', 'platform_admin', 'auditor')
  countCohort(@Body() definition: CohortDefinition) {
    return this.cohortBuilderService.count(definition);
  }
}
