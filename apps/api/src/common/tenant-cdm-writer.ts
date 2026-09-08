import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CdmRecordBatch } from '@rwe/common-data-model';
import { PrismaService } from './prisma.service';

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
 */
@Injectable()
export class TenantCdmWriter {
  constructor(private readonly prisma: PrismaService) {}

  async writeBatch(schemaName: string, batch: CdmRecordBatch): Promise<void> {
    if (!SCHEMA_NAME_RE.test(schemaName)) {
      throw new Error(`Refusing to write to schema "${schemaName}": does not match the expected tenant schema pattern`);
    }
    const schema = Prisma.raw(`"${schemaName}"`);

    for (const p of batch.persons) {
      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.person (person_id, source_patient_id, gender_concept, birth_year, race_concept, ethnicity_concept, location_region, source_connector_id)
        VALUES (${p.personId}::uuid, ${p.sourcePatientId}, ${p.genderConcept}, ${p.birthYear}, ${p.raceConcept}, ${p.ethnicityConcept}, ${p.locationRegion}, ${p.sourceConnectorId}::uuid)
        ON CONFLICT (source_connector_id, source_patient_id) DO NOTHING
      `;
    }

    for (const v of batch.visits) {
      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.visit_occurrence (visit_occurrence_id, person_id, visit_concept, visit_start_date, visit_end_date, care_site, source_connector_id)
        VALUES (${v.visitOccurrenceId}::uuid, ${v.personId}::uuid, ${v.visitConcept}, ${v.visitStartDate}::date, ${v.visitEndDate}::date, ${v.careSite}, ${v.sourceConnectorId}::uuid)
      `;
    }

    for (const c of batch.conditions) {
      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.condition_occurrence (condition_occurrence_id, person_id, visit_occurrence_id, condition_concept_code, condition_concept_name, condition_start_date, condition_end_date, source_connector_id)
        VALUES (${c.conditionOccurrenceId}::uuid, ${c.personId}::uuid, ${c.visitOccurrenceId}::uuid, ${c.conditionConceptCode}, ${c.conditionConceptName}, ${c.conditionStartDate}::date, ${c.conditionEndDate}::date, ${c.sourceConnectorId}::uuid)
      `;
    }

    for (const d of batch.drugExposures) {
      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.drug_exposure (drug_exposure_id, person_id, visit_occurrence_id, drug_concept_code, drug_concept_name, exposure_start_date, exposure_end_date, dose, source_connector_id)
        VALUES (${d.drugExposureId}::uuid, ${d.personId}::uuid, ${d.visitOccurrenceId}::uuid, ${d.drugConceptCode}, ${d.drugConceptName}, ${d.exposureStartDate}::date, ${d.exposureEndDate}::date, ${d.dose}, ${d.sourceConnectorId}::uuid)
      `;
    }

    for (const m of batch.measurements) {
      await this.prisma.$executeRaw`
        INSERT INTO ${schema}.measurement (measurement_id, person_id, visit_occurrence_id, measurement_concept_code, measurement_concept_name, measurement_date, value_numeric, value_unit, source_connector_id)
        VALUES (${m.measurementId}::uuid, ${m.personId}::uuid, ${m.visitOccurrenceId}::uuid, ${m.measurementConceptCode}, ${m.measurementConceptName}, ${m.measurementDate}::date, ${m.valueNumeric}, ${m.valueUnit}, ${m.sourceConnectorId}::uuid)
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
