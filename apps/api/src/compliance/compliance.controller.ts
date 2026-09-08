import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { ConsentType, DsarRequestType } from '@rwe/compliance-engine';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { AuditableAction } from '../common/audit.interceptor';
import { ComplianceService } from './compliance.service';

class GrantConsentDto {
  @IsString() dataSubjectId!: string;
  @IsString() purpose!: string;
  @IsIn(['opt_in', 'notice_and_opt_out', 'granular_purpose']) type!: ConsentType;
  @IsString() method!: string;
}

class SubmitDsarDto {
  @IsString() dataSubjectId!: string;
  @IsIn(['access', 'rectification', 'erasure', 'portability', 'restriction']) type!: DsarRequestType;
}

@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('policy')
  getPolicy() {
    return this.complianceService.getEffectivePolicy();
  }

  @Post('consent')
  @Roles('tenant_admin', 'clinician', 'platform_admin')
  @AuditableAction('consent_change', 'ConsentRecord')
  grantConsent(@Body() dto: GrantConsentDto) {
    return this.complianceService.grantConsent(dto.dataSubjectId, dto.purpose, dto.type, dto.method);
  }

  @Post('consent/revoke')
  @Roles('tenant_admin', 'clinician', 'platform_admin')
  @AuditableAction('consent_change', 'ConsentRecord')
  revokeConsent(@Body() dto: { dataSubjectId: string; purpose: string }) {
    return this.complianceService.revokeConsent(dto.dataSubjectId, dto.purpose);
  }

  @Post('dsar')
  @AuditableAction('dsar_request', 'DsarRequest')
  submitDsar(@Body() dto: SubmitDsarDto) {
    return this.complianceService.submitDsar(dto.dataSubjectId, dto.type);
  }

  @Get('dsar')
  @Roles('tenant_admin', 'platform_admin', 'auditor')
  listDsar() {
    return this.complianceService.listDsarRequests();
  }

  @Post('dsar/:id/fulfill')
  @Roles('tenant_admin', 'platform_admin')
  @AuditableAction('dsar_fulfilled', 'DsarRequest')
  fulfillDsar(@Param('id') id: string) {
    return this.complianceService.fulfillDsar(id);
  }

  @Get('audit-log')
  @Roles('tenant_admin', 'platform_admin', 'auditor')
  queryAuditLog(@Query('action') action?: string, @Query('resourceType') resourceType?: string) {
    return this.complianceService.queryAuditLog({ action, resourceType });
  }
}
