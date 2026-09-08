import { Module } from '@nestjs/common';
import { CohortBuilderService } from './cohort-builder.service';
import { AnalyticsController } from './analytics.controller';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  providers: [CohortBuilderService],
  controllers: [AnalyticsController],
  exports: [CohortBuilderService],
})
export class AnalyticsModule {}
