import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { AuditableAction } from '../common/audit.interceptor';
import { ConnectorsService } from './connectors.service';
import { CreateConnectorDto } from './dto';

@Controller('connectors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConnectorsController {
  constructor(private readonly connectorsService: ConnectorsService) {}

  @Get('types')
  availableTypes() {
    return this.connectorsService.availableConnectorTypes();
  }

  @Get()
  @Roles('tenant_admin', 'platform_admin')
  list() {
    return this.connectorsService.list();
  }

  @Post()
  @Roles('tenant_admin', 'platform_admin')
  @AuditableAction('connector_change', 'ConnectorConfig')
  register(@Body() dto: CreateConnectorDto) {
    return this.connectorsService.register(dto);
  }

  @Post(':id/sync')
  @Roles('tenant_admin', 'platform_admin')
  @AuditableAction('connector_change', 'ConnectorConfig')
  sync(@Param('id') id: string) {
    return this.connectorsService.triggerSync(id);
  }
}
