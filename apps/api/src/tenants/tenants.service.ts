import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Tenant } from '@rwe/common-data-model';
import { PrismaService } from '../common/prisma.service';
import { CreateTenantDto } from './dto';

const TEMPLATE_PATH = require.resolve('@rwe/common-data-model/prisma/tenant_schema_template.sql');
const SCHEMA_NAME_RE = /^tenant_[a-z0-9_]+$/;

/**
 * Tenant lifecycle: provisioning → active → suspended → offboarding → purged (docs/MULTI_TENANCY.md).
 * `provision()` performs the two isolation-layer setup steps for a new tenant: it creates the
 * tenant's dedicated Postgres schema from `tenant_schema_template.sql` (physical CDM isolation)
 * and inserts the control-plane `Tenant` row that RLS policies on shared tables key off.
 */
@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async provision(dto: CreateTenantDto): Promise<Tenant> {
    const schemaName = `tenant_${dto.slug.replace(/-/g, '_')}`;
    if (!SCHEMA_NAME_RE.test(schemaName)) {
      throw new Error(`Derived schema name "${schemaName}" is not a safe Postgres identifier`);
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        id: randomUUID(),
        name: dto.name,
        slug: dto.slug,
        homeRegion: dto.homeRegion,
        jurisdictions: dto.jurisdictions,
        isolationTier: dto.isolationTier ?? 'shared_schema',
        schemaName,
        status: 'provisioning',
        parentTenantId: dto.parentTenantId,
      },
    });

    await this.createTenantSchema(schemaName);

    const activated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: 'active' },
    });

    return activated as unknown as Tenant;
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant as unknown as Tenant;
  }

  async findBySlugOrHost(slugOrHost: string): Promise<Tenant | null> {
    const slug = slugOrHost.split('.')[0];
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    return (tenant as unknown as Tenant) ?? null;
  }

  async list(): Promise<Tenant[]> {
    const tenants = await this.prisma.tenant.findMany();
    return tenants as unknown as Tenant[];
  }

  /** Tenant-wide erasure pathway for offboarding/DSAR "full erasure" — drops the tenant's clinical schema entirely. See docs/MULTI_TENANCY.md#tenant-lifecycle. */
  async offboard(id: string): Promise<void> {
    const tenant = await this.findById(id);
    await this.prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
    await this.prisma.tenant.update({ where: { id }, data: { status: 'purged' } });
  }

  private async createTenantSchema(schemaName: string): Promise<void> {
    const template = await readFile(TEMPLATE_PATH, 'utf-8');
    const rendered = template.replace(/\{\{schema_name\}\}/g, schemaName);
    const statements = splitSqlStatements(rendered);
    for (const statement of statements) {
      await this.prisma.$executeRawUnsafe(statement);
    }
  }
}

/** Naive top-level statement splitter — sufficient for the DDL-only template, which contains no semicolons inside string literals. */
function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
}
