/**
 * TypeScript mirror of prisma/tenant_schema_template.sql — the per-tenant clinical data model.
 * Connectors (packages/connector-fhir, packages/connector-files) map source data to these shapes;
 * the API's AnalyticsModule and packages/nlp-enrichment / packages/predictive-models consume them.
 * Kept hand-written (rather than generated) so downstream packages can typecheck without running
 * `prisma generate`, which requires a schema/DB connection step, against a schema whose real
 * source of truth is `prisma/tenant_schema_template.sql`.
 */

export interface Person {
  personId: string;
  sourcePatientId: string;
  genderConcept: string | null;
  birthYear: number | null;
  raceConcept: string | null;
  ethnicityConcept: string | null;
  locationRegion: string | null;
  sourceConnectorId: string;
  createdAt: Date;
}

export type VisitConcept = 'inpatient' | 'outpatient' | 'emergency' | 'telehealth';

export interface VisitOccurrence {
  visitOccurrenceId: string;
  personId: string;
  visitConcept: VisitConcept;
  visitStartDate: string; // ISO date
  visitEndDate: string | null;
  careSite: string | null;
  sourceConnectorId: string;
}

export interface ConditionOccurrence {
  conditionOccurrenceId: string;
  personId: string;
  visitOccurrenceId: string | null;
  conditionConceptCode: string; // SNOMED CT
  conditionConceptName: string | null;
  conditionStartDate: string;
  conditionEndDate: string | null;
  sourceConnectorId: string;
}

export interface DrugExposure {
  drugExposureId: string;
  personId: string;
  visitOccurrenceId: string | null;
  drugConceptCode: string; // RxNorm
  drugConceptName: string | null;
  exposureStartDate: string;
  exposureEndDate: string | null;
  dose: string | null;
  sourceConnectorId: string;
}

export interface Measurement {
  measurementId: string;
  personId: string;
  visitOccurrenceId: string | null;
  measurementConceptCode: string; // LOINC
  measurementConceptName: string | null;
  measurementDate: string;
  valueNumeric: number | null;
  valueUnit: string | null;
  sourceConnectorId: string;
}

export interface Observation {
  observationId: string;
  personId: string;
  visitOccurrenceId: string | null;
  observationConceptCode: string | null;
  observationDate: string;
  valueAsString: string | null;
  sourceConnectorId: string;
}

export type EnrichmentStatus = 'pending' | 'enriched' | 'failed';

export interface ClinicalNote {
  clinicalNoteId: string;
  personId: string;
  visitOccurrenceId: string | null;
  noteDate: string;
  noteType: string | null;
  noteText: string;
  sourceConnectorId: string;
  enrichmentStatus: EnrichmentStatus;
}

export type ConceptPolarity = 'positive' | 'negated' | 'hypothetical' | 'family_history';

export interface NlpExtractedConcept {
  nlpExtractedConceptId: string;
  clinicalNoteId: string;
  personId: string;
  conceptCode: string; // SNOMED CT
  conceptName: string;
  polarity: ConceptPolarity;
  severity: 'mild' | 'moderate' | 'severe' | null;
  confidence: number | null;
  extractedAt: Date;
  pipelineId: string;
}

export type RiskBand = 'low' | 'medium' | 'high';

export interface RiskScore {
  riskScoreId: string;
  personId: string;
  modelId: string;
  score: number;
  scoreBand: RiskBand;
  computedAt: Date;
  explanation: Record<string, number> | null; // feature -> contribution weight
}

/** A connector's normalized output for one sync batch, ready to persist into a tenant's CDM schema. */
export interface CdmRecordBatch {
  persons: Person[];
  visits: VisitOccurrence[];
  conditions: ConditionOccurrence[];
  drugExposures: DrugExposure[];
  measurements: Measurement[];
  observations: Observation[];
  clinicalNotes: ClinicalNote[];
}

export function emptyCdmRecordBatch(): CdmRecordBatch {
  return {
    persons: [],
    visits: [],
    conditions: [],
    drugExposures: [],
    measurements: [],
    observations: [],
    clinicalNotes: [],
  };
}
