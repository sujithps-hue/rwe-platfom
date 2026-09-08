import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { UsageMeterService } from '../billing/usage-meter.service';
import { ConceptMapper } from '../common/concept-mapper';
import { getTenantContext } from '../common/tenant-context';
import { CohortCriterion, CohortDefinition } from './cohort-definition';

const SCHEMA_NAME_RE = /^tenant_[a-z0-9_]+$/;

/**
 * The no-code Cohort Builder's execution engine (the Analytics pillar — docs/PRODUCT.md). Every
 * criterion compiles to a parameterized `EXISTS`/`WHERE` fragment over
 * the tenant's own CDM schema, filtered by standard `concept_id` — the entire point of
 * standardizing to OMOP is that this query matches the same clinical fact regardless of which
 * connector's own source coding produced it (docs/OMOP_VOCABULARY.md). Nothing here ever joins
 * across tenant schemas. Only aggregate counts leave this service by default — returning
 * identifiable per-patient rows is a distinct, audited action gated behind the
 * `read_identifiable` ability (see `AbilityFactory`), matching the Trusted-Research-Environment
 * model described in docs/PRODUCT.md.
 */
@Injectable()
export class CohortBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageMeter: UsageMeterService,
    private readonly conceptMapper: ConceptMapper,
  ) {}

  async count(definition: CohortDefinition): Promise<{ matchingPatients: number }> {
    const { tenant } = getTenantContext();
    if (!SCHEMA_NAME_RE.test(tenant.schemaName)) {
      throw new Error(`Tenant schema name "${tenant.schemaName}" failed validation`);
    }
    const schema = Prisma.raw(`"${tenant.schemaName}"`);

    const whereFragments = await Promise.all(
      definition.criteria.map((criterion) => this.compileCriterion(criterion, schema)),
    );
    const whereClause = whereFragments.length > 0 ? Prisma.join(whereFragments, ' AND ') : Prisma.sql`TRUE`;

    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM ${schema}.person p WHERE ${whereClause}
    `;

    await this.usageMeter.record('cohort_queries', 1);

    return { matchingPatients: Number(rows[0]?.count ?? 0) };
  }

  private async compileCriterion(criterion: CohortCriterion, schema: Prisma.Sql): Promise<Prisma.Sql> {
    switch (criterion.kind) {
      case 'has_condition':
        return Prisma.sql`EXISTS (
          SELECT 1 FROM ${schema}.condition_occurrence co
          WHERE co.person_id = p.person_id AND ${this.conceptMatch('co.condition_concept_id', criterion.conceptId, criterion.includeDescendants)}
          ${criterion.withinDays ? Prisma.sql`AND co.condition_start_date >= (CURRENT_DATE - ${criterion.withinDays}::int)` : Prisma.empty}
        )`;
      case 'has_drug_exposure':
        return Prisma.sql`EXISTS (
          SELECT 1 FROM ${schema}.drug_exposure de
          WHERE de.person_id = p.person_id AND ${this.conceptMatch('de.drug_concept_id', criterion.conceptId, criterion.includeDescendants)}
          ${criterion.withinDays ? Prisma.sql`AND de.exposure_start_date >= (CURRENT_DATE - ${criterion.withinDays}::int)` : Prisma.empty}
        )`;
      case 'has_nlp_concept':
        // Matched by SNOMED concept_code directly, not concept_id — see the doc comment on
        // nlp_extracted_concept in tenant_schema_template.sql for why that's still OMOP-correct.
        return Prisma.sql`EXISTS (
          SELECT 1 FROM ${schema}.nlp_extracted_concept nc
          WHERE nc.person_id = p.person_id AND nc.concept_code = ${criterion.conceptCode}
          ${criterion.polarity ? Prisma.sql`AND nc.polarity = ${criterion.polarity}` : Prisma.empty}
        )`;
      case 'age_between':
        return Prisma.sql`(EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) BETWEEN ${criterion.minYears} AND ${criterion.maxYears}`;
      case 'visit_type': {
        const visit = await this.conceptMapper.resolveViaSourceMap('Visit', criterion.visitConcept);
        return Prisma.sql`EXISTS (
          SELECT 1 FROM ${schema}.visit_occurrence vo
          WHERE vo.person_id = p.person_id AND vo.visit_concept_id = ${visit.conceptId}
        )`;
      }
    }
  }

  /**
   * Compiles a concept_id match, optionally expanded to every descendant of that concept via the
   * precomputed `omop_vocabulary.concept_ancestor` closure table — the same "include descendants"
   * behavior OHDSI's ATLAS cohort-definition tool offers (e.g. matching "Essential hypertension"
   * AND every more specific hypertension subtype below it in the SNOMED hierarchy), rather than
   * requiring the caller to enumerate every descendant concept_id by hand.
   */
  private conceptMatch(column: string, conceptId: number, includeDescendants?: boolean): Prisma.Sql {
    const columnRaw = Prisma.raw(column);
    if (!includeDescendants) {
      return Prisma.sql`${columnRaw} = ${conceptId}`;
    }
    return Prisma.sql`${columnRaw} IN (
      SELECT descendant_concept_id FROM omop_vocabulary.concept_ancestor WHERE ancestor_concept_id = ${conceptId}
      UNION ALL SELECT ${conceptId}
    )`;
  }
}
