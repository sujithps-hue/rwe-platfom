import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConnectorRegistry } from '@rwe/connector-sdk';
import { PrismaService } from '../common/prisma.service';
import { TenantCdmWriter } from '../common/tenant-cdm-writer';
import { getTenantContext } from '../common/tenant-context';
import { CONNECTOR_REGISTRY } from './connector-registry.provider';
import { EnvSecretResolver } from './secret-resolver';
import { CreateConnectorDto } from './dto';

@Injectable()
export class ConnectorsService {
  constructor(
    @Inject(CONNECTOR_REGISTRY) private readonly registry: ConnectorRegistry,
    private readonly prisma: PrismaService,
    private readonly cdmWriter: TenantCdmWriter,
    private readonly secretResolver: EnvSecretResolver,
  ) {}

  availableConnectorTypes(): string[] {
    return this.registry.list();
  }

  async register(dto: CreateConnectorDto) {
    const { tenant } = getTenantContext();
    return this.prisma.connectorConfigRecord.create({
      data: {
        tenantId: tenant.id,
        connectorType: dto.connectorType,
        displayName: dto.displayName,
        credentialSecretId: dto.credentialSecretId,
        config: dto.settings as Prisma.InputJsonValue,
        lastSyncStatus: 'never_run',
      },
    });
  }

  async list() {
    const { tenant } = getTenantContext();
    return this.prisma.connectorConfigRecord.findMany({ where: { tenantId: tenant.id } });
  }

  /**
   * Runs one sync cycle: pulls new data via the connector, runs every record through the
   * compliance engine's residency check (consent/de-identification are enforced at the
   * analytics-read layer for this reference implementation — see docs/COMPLIANCE.md for the full
   * enforcement points), then persists into the tenant's CDM schema.
   */
  async triggerSync(connectorConfigId: string) {
    const { tenant, engine } = getTenantContext();
    const record = await this.prisma.connectorConfigRecord.findFirst({
      where: { id: connectorConfigId, tenantId: tenant.id },
    });
    if (!record) throw new NotFoundException(`Connector ${connectorConfigId} not found for this tenant`);

    engine.checkResidency(tenant.homeRegion);

    const connector = this.registry.create(record.connectorType);
    await connector.configure(
      {
        tenantId: tenant.id,
        connectorId: record.id,
        displayName: record.displayName,
        credentialSecretId: record.credentialSecretId,
        settings: record.config as Record<string, unknown>,
      },
      this.secretResolver,
    );

    const result = await connector.sync(record.lastSyncCursor);
    await this.cdmWriter.writeBatch(tenant.schemaName, result.batch);

    await this.prisma.connectorConfigRecord.update({
      where: { id: record.id },
      data: {
        lastSyncCursor: result.cursor,
        lastSyncedAt: new Date(),
        lastSyncStatus: result.errors.length > 0 ? 'error' : 'ok',
        consecutiveErrors: result.errors.length > 0 ? { increment: 1 } : 0,
      },
    });

    return {
      recordsFetched: result.recordsFetched,
      errors: result.errors,
    };
  }
}
