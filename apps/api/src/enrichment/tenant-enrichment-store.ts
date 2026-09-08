import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClinicalNote, NlpExtractedConcept } from '@rwe/common-data-model';
import { EnrichmentStore } from '@rwe/nlp-enrichment';
import { PrismaService } from '../common/prisma.service';
import { ConceptMapper } from '../common/concept-mapper';

const SCHEMA_NAME_RE = /^tenant_[a-z0-9_]+$/;

function requireValidSchema(schemaName: string): Prisma.Sql {
  if (!SCHEMA_NAME_RE.test(schemaName)) {
    throw new Error(`Refusing to touch schema "${schemaName}": failed validation`);
  }
  return Prisma.raw(`"${schemaName}"`);
}

/**
 * `EnrichmentStore` implementation backing `@rwe/nlp-enrichment`'s `EnrichmentService`. Scoped to
 * one tenant schema per call — `apps/api/src/enrichment/enrichment.service.ts` resolves the
 * schema name from the active `TenantContext` before calling in, so this class never needs (and
 * never accepts) a raw tenantId that could be used to cross tenant boundaries.
 */
@Injectable()
export class TenantEnrichmentStore implements EnrichmentStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conceptMapper: ConceptMapper,
  ) {}

  async fetchPendingNotes(schemaName: string, limit: number): Promise<ClinicalNote[]> {
    const schema = requireValidSchema(schemaName);
    const rows = await this.prisma.$queryRaw<
      { clinical_note_id: string; person_id: string; visit_occurrence_id: string | null; note_date: Date; note_type: string | null; note_text: string; source_connector_id: string; enrichment_status: string }[]
    >`
      SELECT * FROM ${schema}.clinical_note WHERE enrichment_status = 'pending' LIMIT ${limit}
    `;
    return rows.map((r) => ({
      clinicalNoteId: r.clinical_note_id,
      personId: r.person_id,
      visitOccurrenceId: r.visit_occurrence_id,
      noteDate: r.note_date.toISOString().slice(0, 10),
      noteType: r.note_type,
      noteText: r.note_text,
      sourceConnectorId: r.source_connector_id,
      enrichmentStatus: r.enrichment_status as ClinicalNote['enrichmentStatus'],
    }));
  }

  async saveExtractedConcepts(schemaName: string, concepts: NlpExtractedConcept[]): Promise<void> {
    const schema = requireValidSchema(schemaName);
    for (const c of concepts) {
      // SNOMED CT is itself the OMOP-standard vocabulary for the concepts this pipeline extracts
      // (see packages/nlp-enrichment/src/terminology.ts), so the same standard-code resolution
      // used for condition_occurrence applies here.
      const resolved = await this.conceptMapper.resolveByStandardCode('SNOMED', c.conceptCode);
      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.nlp_extracted_concept (nlp_extracted_concept_id, clinical_note_id, person_id, concept_id, concept_code, concept_name, polarity, severity, confidence, extracted_at, pipeline_id)
        VALUES (gen_random_uuid(), ${c.clinicalNoteId}::uuid, ${c.personId}::uuid, ${resolved.conceptId}, ${c.conceptCode}, ${c.conceptName}, ${c.polarity}, ${c.severity}, ${c.confidence}, ${c.extractedAt}, ${c.pipelineId})
      `;
    }
  }

  async markEnrichmentStatus(schemaName: string, clinicalNoteId: string, status: 'enriched' | 'failed'): Promise<void> {
    const schema = requireValidSchema(schemaName);
    await this.prisma.$executeRaw`
      UPDATE ${schema}.clinical_note SET enrichment_status = ${status} WHERE clinical_note_id = ${clinicalNoteId}::uuid
    `;
  }
}
