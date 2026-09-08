import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /** Platform-operator-only: onboarding a new EHR/hospital/clinic customer. Not tenant-scoped by design. */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.provision(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  list() {
    return this.tenantsService.list();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin', 'tenant_admin')
  get(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }
}
