import { CdmRecordBatch, VisitConcept, emptyCdmRecordBatch } from '@rwe/common-data-model';

/**
 * Expected CSV column contract for the reference implementation. A real deployment ingesting a
 * registry/legacy export with different column names supplies a `columnMapping` in the
 * connector's settings (source column -> this canonical name) rather than forking this mapper.
 */
export interface CsvPatientRow {
  patient_id: string;
  gender?: string;
  birth_year?: string;
  visit_type?: string;
  visit_start?: string;
  visit_end?: string;
  condition_code?: string;
  condition_name?: string;
  condition_date?: string;
}

export function mapCsvRows(rows: Record<string, string>[], sourceConnectorId: string): CdmRecordBatch {
  const batch = emptyCdmRecordBatch();
  const personIdByPatientId = new Map<string, string>();

  for (const raw of rows as unknown as CsvPatientRow[]) {
    if (!raw.patient_id) continue;

    let personId = personIdByPatientId.get(raw.patient_id);
    if (!personId) {
      personId = crypto.randomUUID();
      personIdByPatientId.set(raw.patient_id, personId);
      batch.persons.push({
        personId,
        sourcePatientId: raw.patient_id,
        genderConcept: raw.gender ?? null,
        birthYear: raw.birth_year ? Number(raw.birth_year) : null,
        raceConcept: null,
        ethnicityConcept: null,
        locationRegion: null,
        sourceConnectorId,
        createdAt: new Date(),
      });
    }

    let visitOccurrenceId: string | null = null;
    if (raw.visit_start) {
      visitOccurrenceId = crypto.randomUUID();
      batch.visits.push({
        visitOccurrenceId,
        personId,
        visitConcept: (raw.visit_type as VisitConcept) ?? 'outpatient',
        visitStartDate: raw.visit_start,
        visitEndDate: raw.visit_end ?? null,
        careSite: null,
        sourceConnectorId,
      });
    }

    if (raw.condition_code) {
      batch.conditions.push({
        conditionOccurrenceId: crypto.randomUUID(),
        personId,
        visitOccurrenceId,
        conditionConceptCode: raw.condition_code,
        conditionConceptName: raw.condition_name ?? null,
        conditionStartDate: raw.condition_date ?? raw.visit_start ?? new Date().toISOString().slice(0, 10),
        conditionEndDate: null,
        sourceConnectorId,
      });
    }
  }

  return batch;
}
