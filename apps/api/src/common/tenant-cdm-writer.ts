import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CdmRecordBatch } from '@rwe/common-data-model';
import { PrismaService } from './prisma.service';
import { ConceptMapper } from './concept-mapper';

const SCHEMA_NAME_RE = /^tenant_[a-z0-9_]+$/;

/**
 * Writes a connector's normalized `CdmRecordBatch` into a tenant's dedicated clinical schema
 * (`tenant_<slug>.person`, `.visit_occurrence`, etc. — see
 * packages/common-data-model/prisma/tenant_schema_template.sql). These tables are NOT part of the
 * Prisma-generated client (they're created per tenant via raw DDL, so their shape isn't known at
 * `prisma generate` time), so writes go through parameterized raw SQL: `Prisma.raw()` supplies the
 * validated schema-name identifier (never user input reaching this class unvalidated) while every
 * data value is still a proper bind parameter via `Prisma.sql`, so this is not string-built SQL
 * over patient data.
 *
 * This is also where the OMOP standardization step happens: a connector's `CdmRecordBatch` only
 * ever carries raw source codes/strings (`conditionConceptCode`, `genderConcept`, etc. — see
 * packages/common-data-model/src/cdm-types.ts and docs/CONNECTORS.md); every insert here resolves
 * those source values to a standard `omop_vocabulary.concept` row via `ConceptMapper` before
 * writing both the resolved `*_concept_id` and the original `*_source_value` into the tenant
 * schema. Connectors themselves never need to know about concept_id resolution — see
 * docs/OMOP_VOCABULARY.md.
 */
@Injectable()
export class TenantCdmWriter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conceptMapper: ConceptMapper,
  ) {}

  async writeBatch(schemaName: string, batch: CdmRecordBatch): Promise<void> {
    if (!SCHEMA_NAME_RE.test(schemaName)) {
      throw new Error(`Refusing to write to schema "${schemaName}": does not match the expected tenant schema pattern`);
    }
    const schema = Prisma.raw(`"${schemaName}"`);

    for (const p of batch.persons) {
      const gender = p.genderConcept ? await this.conceptMapper.resolveViaSourceMap('Gender', p.genderConcept) : null;
      const race = p.raceConcept ? await this.conceptMapper.resolveViaSourceMap('Race', p.raceConcept) : null;
      const ethnicity = p.ethnicityConcept
        ? await this.conceptMapper.resolveViaSourceMap('Ethnicity', p.ethnicityConcept)
        : null;

      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.person (
          person_id, source_patient_id,
          gender_concept_id, gender_source_value,
          year_of_birth,
          race_concept_id, race_source_value,
          ethnicity_concept_id, ethnicity_source_value,
          location_region, source_connector_id
        )
        VALUES (
          ${p.personId}::uuid, ${p.sourcePatientId},
          ${gender?.conceptId ?? 0}, ${p.genderConcept},
          ${p.birthYear},
          ${race?.conceptId ?? 0}, ${p.raceConcept},
          ${ethnicity?.conceptId ?? 0}, ${p.ethnicityConcept},
          ${p.locationRegion}, ${p.sourceConnectorId}::uuid
        )
        ON CONFLICT (source_connector_id, source_patient_id) DO NOTHING
      `;
    }

    for (const v of batch.visits) {
      const visit = await this.conceptMapper.resolveViaSourceMap('Visit', v.visitConcept);
      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.visit_occurrence (visit_occurrence_id, person_id, visit_concept_id, visit_source_value, visit_start_date, visit_end_date, care_site, source_connector_id)
        VALUES (${v.visitOccurrenceId}::uuid, ${v.personId}::uuid, ${visit.conceptId}, ${v.visitConcept}, ${v.visitStartDate}::date, ${v.visitEndDate}::date, ${v.careSite}, ${v.sourceConnectorId}::uuid)
      `;
    }

    for (const c of batch.conditions) {
      const condition = await this.conceptMapper.resolveByStandardCode('SNOMED', c.conditionConceptCode);
      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.condition_occurrence (condition_occurrence_id, person_id, visit_occurrence_id, condition_concept_id, condition_source_value, condition_source_concept_id, condition_start_date, condition_end_date, source_connector_id)
        VALUES (${c.conditionOccurrenceId}::uuid, ${c.personId}::uuid, ${c.visitOccurrenceId}::uuid, ${condition.conceptId}, ${c.conditionConceptCode}, ${condition.sourceConceptId}, ${c.conditionStartDate}::date, ${c.conditionEndDate}::date, ${c.sourceConnectorId}::uuid)
      `;
    }

    for (const d of batch.drugExposures) {
      const drug = await this.conceptMapper.resolveByStandardCode('RxNorm', d.drugConceptCode);
      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.drug_exposure (drug_exposure_id, person_id, visit_occurrence_id, drug_concept_id, drug_source_value, drug_source_concept_id, exposure_start_date, exposure_end_date, dose, source_connector_id)
        VALUES (${d.drugExposureId}::uuid, ${d.personId}::uuid, ${d.visitOccurrenceId}::uuid, ${drug.conceptId}, ${d.drugConceptCode}, ${drug.sourceConceptId}, ${d.exposureStartDate}::date, ${d.exposureEndDate}::date, ${d.dose}, ${d.sourceConnectorId}::uuid)
      `;
    }

    for (const m of batch.measurements) {
      const measurement = await this.conceptMapper.resolveByStandardCode('LOINC', m.measurementConceptCode);
      // Unit-concept mapping (mapping `value_unit`'s free-text/UCUM string to a standard unit
      // concept) is not implemented in this reference writer — `unit_concept_id` is left at its
      // default (0) and the raw string is kept in `unit_source_value` for a later mapping pass.
      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.measurement (measurement_id, person_id, visit_occurrence_id, measurement_concept_id, measurement_source_value, measurement_source_concept_id, measurement_date, value_numeric, unit_source_value, source_connector_id)
        VALUES (${m.measurementId}::uuid, ${m.personId}::uuid, ${m.visitOccurrenceId}::uuid, ${measurement.conceptId}, ${m.measurementConceptCode}, ${measurement.sourceConceptId}, ${m.measurementDate}::date, ${m.valueNumeric}, ${m.valueUnit}, ${m.sourceConnectorId}::uuid)
      `;
    }

    for (const note of batch.clinicalNotes) {
      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.clinical_note (clinical_note_id, person_id, visit_occurrence_id, note_date, note_type, note_text, source_connector_id, enrichment_status)
        VALUES (${note.clinicalNoteId}::uuid, ${note.personId}::uuid, ${note.visitOccurrenceId}::uuid, ${note.noteDate}::date, ${note.noteType}, ${note.noteText}, ${note.sourceConnectorId}::uuid, 'pending')
      `;
    }
  }
}
