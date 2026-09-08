import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { UsageMeterService } from '../billing/usage-meter.service';
import { getTenantContext } from '../common/tenant-context';
import { CohortCriterion, CohortDefinition } from './cohort-definition';

const SCHEMA_NAME_RE = /^tenant_[a-z0-9_]+$/;

/**
 * The no-code Cohort Builder's execution engine (the NeuroBlu-Analytics-equivalent piece —
 * docs/PRODUCT.md). Every criterion compiles to a parameterized `EXISTS`/`WHERE` fragment over
 * the tenant's own CDM schema; nothing here ever joins across tenant schemas. Only aggregate
 * counts leave this service by default — returning identifiable per-patient rows is a distinct,
 * audited action gated behind the `read_identifiable` ability (see `AbilityFactory`), matching
 * the Trusted-Research-Environment model described in docs/PRODUCT.md.
 */
@Injectable()
export class CohortBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageMeter: UsageMeterService,
  ) {}

  async count(definition: CohortDefinition): Promise<{ matchingPatients: number }> {
    const { tenant } = getTenantContext();
    if (!SCHEMA_NAME_RE.test(tenant.schemaName)) {
      throw new Error(`Tenant schema name "${tenant.schemaName}" failed validation`);
    }
    const schema = Prisma.raw(`"${tenant.schemaName}"`);

    const whereFragments = definition.criteria.map((criterion) => this.compileCriterion(criterion, schema));
    const whereClause = whereFragments.length > 0 ? Prisma.join(whereFragments, ' AND ') : Prisma.sql`TRUE`;

    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM ${schema}.person p WHERE ${whereClause}
    `;

    await this.usageMeter.record('cohort_queries', 1);

    return { matchingPatients: Number(rows[0]?.count ?? 0) };
  }

  private compileCriterion(criterion: CohortCriterion, schema: Prisma.Sql): Prisma.Sql {
    switch (criterion.kind) {
      case 'has_condition':
        return Prisma.sql`EXISTS (
          SELECT 1 FROM ${schema}.condition_occurrence co
          WHERE co.person_id = p.person_id AND co.condition_concept_code = ${criterion.conceptCode}
          ${criterion.withinDays ? Prisma.sql`AND co.condition_start_date >= (CURRENT_DATE - ${criterion.withinDays}::int)` : Prisma.empty}
        )`;
      case 'has_drug_exposure':
        return Prisma.sql`EXISTS (
          SELECT 1 FROM ${schema}.drug_exposure de
          WHERE de.person_id = p.person_id AND de.drug_concept_code = ${criterion.conceptCode}
          ${criterion.withinDays ? Prisma.sql`AND de.exposure_start_date >= (CURRENT_DATE - ${criterion.withinDays}::int)` : Prisma.empty}
        )`;
      case 'has_nlp_concept':
        return Prisma.sql`EXISTS (
          SELECT 1 FROM ${schema}.nlp_extracted_concept nc
          WHERE nc.person_id = p.person_id AND nc.concept_code = ${criterion.conceptCode}
          ${criterion.polarity ? Prisma.sql`AND nc.polarity = ${criterion.polarity}` : Prisma.empty}
        )`;
      case 'age_between':
        return Prisma.sql`(EXTRACT(YEAR FROM CURRENT_DATE) - p.birth_year) BETWEEN ${criterion.minYears} AND ${criterion.maxYears}`;
      case 'visit_type':
        return Prisma.sql`EXISTS (
          SELECT 1 FROM ${schema}.visit_occurrence vo
          WHERE vo.person_id = p.person_id AND vo.visit_concept = ${criterion.visitConcept}
        )`;
    }
  }
}
