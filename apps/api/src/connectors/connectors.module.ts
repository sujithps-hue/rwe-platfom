import { Module } from '@nestjs/common';
import { ConnectorsService } from './connectors.service';
import { ConnectorsController } from './connectors.controller';
import { connectorRegistryProvider } from './connector-registry.provider';
import { EnvSecretResolver } from './secret-resolver';

@Module({
  providers: [ConnectorsService, connectorRegistryProvider, EnvSecretResolver],
  controllers: [ConnectorsController],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
