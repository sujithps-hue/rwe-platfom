import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { BillingService } from './billing.service';
import { UsageMeterService } from './usage-meter.service';

class SubscribeDto {
  @IsString() planCode!: string;
  @IsEmail() billingEmail!: string;
}

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly usageMeterService: UsageMeterService,
  ) {}

  @Get('plans')
  listPlans() {
    return this.billingService.listPlans();
  }

  @Get('subscription')
  @Roles('tenant_admin', 'platform_admin')
  currentSubscription() {
    return this.billingService.currentSubscription();
  }

  @Post('subscribe')
  @Roles('tenant_admin', 'platform_admin')
  subscribe(@Body() dto: SubscribeDto) {
    return this.billingService.subscribe(dto.planCode, dto.billingEmail);
  }

  @Get('usage')
  @Roles('tenant_admin', 'platform_admin')
  usage() {
    return this.usageMeterService.rollupForCurrentPeriod();
  }
}
