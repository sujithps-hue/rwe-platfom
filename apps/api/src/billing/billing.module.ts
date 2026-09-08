import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { StripeBillingProvider } from './stripe-billing.provider';
import { UsageMeterService } from './usage-meter.service';

@Module({
  providers: [BillingService, StripeBillingProvider, UsageMeterService],
  controllers: [BillingController],
  exports: [UsageMeterService],
})
export class BillingModule {}
