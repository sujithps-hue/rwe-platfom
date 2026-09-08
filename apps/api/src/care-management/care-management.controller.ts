import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { AuditableAction } from '../common/audit.interceptor';
import { CareManagementService } from './care-management.service';

@Controller('care-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('clinician', 'tenant_admin', 'platform_admin')
export class CareManagementController {
  constructor(private readonly careManagementService: CareManagementService) {}

  @Post('patients/:personId/score')
  @AuditableAction('read_identifiable', 'RiskScore')
  score(@Param('personId') personId: string) {
    return this.careManagementService.scorePatient(personId);
  }

  @Get('patients/:personId/risk-scores')
  @AuditableAction('read_identifiable', 'RiskScore')
  getScores(@Param('personId') personId: string) {
    return this.careManagementService.getRiskScores(personId);
  }
}
