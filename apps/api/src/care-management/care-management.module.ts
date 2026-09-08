import { Module } from '@nestjs/common';
import { CareManagementService } from './care-management.service';
import { CareManagementController } from './care-management.controller';
import { TenantRiskScoreStore } from './tenant-risk-score-store';

@Module({
  providers: [CareManagementService, TenantRiskScoreStore],
  controllers: [CareManagementController],
  exports: [CareManagementService],
})
export class CareManagementModule {}
