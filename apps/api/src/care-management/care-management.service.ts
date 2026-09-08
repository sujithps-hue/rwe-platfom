import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CareManagementService as PredictiveCareManagementService,
  ModelRegistry,
  PatientRecordBundle,
  ReadmissionRiskModel,
  BehavioralHealthRelapseRiskModel,
} from '@rwe/predictive-models';
import { ConditionOccurrence, DrugExposure, NlpExtractedConcept, Person, VisitOccurrence } from '@rwe/common-data-model';
import { PrismaService } from '../common/prisma.service';
import { getTenantContext } from '../common/tenant-context';
import { TenantRiskScoreStore } from './tenant-risk-score-store';

const SCHEMA_NAME_RE = /^tenant_[a-z0-9_]+$/;

/**
 * The Care-Management (NeuroBlu-Health-equivalent) service: assembles a patient's full record
 * from their own tenant's CDM schema, scores it with every registered `RiskModel`, and persists
 * the results. A fresh `ModelRegistry` is created per call — never held as a shared singleton —
 * so scoring one tenant's patient can never accidentally reach another tenant's registered model
 * state (see `ModelRegistry`'s doc comment in packages/predictive-models).
 */
@Injectable()
export class CareManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskScoreStore: TenantRiskScoreStore,
  ) {}

  async scorePatient(personId: string): Promise<{ scoredModels: number }> {
    const { tenant } = getTenantContext();
    if (!SCHEMA_NAME_RE.test(tenant.schemaName)) {
      throw new Error(`Tenant schema name "${tenant.schemaName}" failed validation`);
    }

    const bundle = await this.loadPatientBundle(tenant.schemaName, personId);
    if (!bundle) throw new NotFoundException(`Patient ${personId} not found in this tenant`);

    const registry = new ModelRegistry();
    registry.register(new ReadmissionRiskModel());
    registry.register(new BehavioralHealthRelapseRiskModel());

    const service = new PredictiveCareManagementService(registry, this.riskScoreStore);
    const scoredModels = await service.scoreTenant(tenant.id, [bundle]);
    return { scoredModels };
  }

  async getRiskScores(personId: string) {
    const { tenant } = getTenantContext();
    return this.riskScoreStore.listForPatient(tenant.schemaName, personId);
  }

  private async loadPatientBundle(schemaName: string, personId: string): Promise<PatientRecordBundle | null> {
    const schema = Prisma.raw(`"${schemaName}"`);

    const [personRows, visits, conditions, drugExposures, nlpConcepts] = await Promise.all([
      this.prisma.$queryRaw<PersonRow[]>`SELECT * FROM ${schema}.person WHERE person_id = ${personId}::uuid`,
      this.prisma.$queryRaw<VisitRow[]>`SELECT * FROM ${schema}.visit_occurrence WHERE person_id = ${personId}::uuid`,
      this.prisma.$queryRaw<ConditionRow[]>`SELECT * FROM ${schema}.condition_occurrence WHERE person_id = ${personId}::uuid`,
      this.prisma.$queryRaw<DrugRow[]>`SELECT * FROM ${schema}.drug_exposure WHERE person_id = ${personId}::uuid`,
      this.prisma.$queryRaw<NlpRow[]>`SELECT * FROM ${schema}.nlp_extracted_concept WHERE person_id = ${personId}::uuid`,
    ]);

    if (personRows.length === 0) return null;
    const p = personRows[0];

    const person: Person = {
      personId: p.person_id,
      sourcePatientId: p.source_patient_id,
      genderConcept: p.gender_concept,
      birthYear: p.birth_year,
      raceConcept: p.race_concept,
      ethnicityConcept: p.ethnicity_concept,
      locationRegion: p.location_region,
      sourceConnectorId: p.source_connector_id,
      createdAt: p.created_at,
    };

    return {
      person,
      visits: visits.map(mapVisitRow),
      conditions: conditions.map(mapConditionRow),
      drugExposures: drugExposures.map(mapDrugRow),
      nlpConcepts: nlpConcepts.map(mapNlpRow),
      asOf: new Date(),
    };
  }
}

interface PersonRow {
  person_id: string;
  source_patient_id: string;
  gender_concept: string | null;
  birth_year: number | null;
  race_concept: string | null;
  ethnicity_concept: string | null;
  location_region: string | null;
  source_connector_id: string;
  created_at: Date;
}
interface VisitRow {
  visit_occurrence_id: string;
  person_id: string;
  visit_concept: VisitOccurrence['visitConcept'];
  visit_start_date: Date;
  visit_end_date: Date | null;
  care_site: string | null;
  source_connector_id: string;
}
interface ConditionRow {
  condition_occurrence_id: string;
  person_id: string;
  visit_occurrence_id: string | null;
  condition_concept_code: string;
  condition_concept_name: string | null;
  condition_start_date: Date;
  condition_end_date: Date | null;
  source_connector_id: string;
}
interface DrugRow {
  drug_exposure_id: string;
  person_id: string;
  visit_occurrence_id: string | null;
  drug_concept_code: string;
  drug_concept_name: string | null;
  exposure_start_date: Date;
  exposure_end_date: Date | null;
  dose: string | null;
  source_connector_id: string;
}
interface NlpRow {
  nlp_extracted_concept_id: string;
  clinical_note_id: string;
  person_id: string;
  concept_code: string;
  concept_name: string;
  polarity: NlpExtractedConcept['polarity'];
  severity: NlpExtractedConcept['severity'];
  confidence: number | null;
  extracted_at: Date;
  pipeline_id: string;
}

function mapVisitRow(v: VisitRow): VisitOccurrence {
  return {
    visitOccurrenceId: v.visit_occurrence_id,
    personId: v.person_id,
    visitConcept: v.visit_concept,
    visitStartDate: v.visit_start_date.toISOString().slice(0, 10),
    visitEndDate: v.visit_end_date ? v.visit_end_date.toISOString().slice(0, 10) : null,
    careSite: v.care_site,
    sourceConnectorId: v.source_connector_id,
  };
}
function mapConditionRow(c: ConditionRow): ConditionOccurrence {
  return {
    conditionOccurrenceId: c.condition_occurrence_id,
    personId: c.person_id,
    visitOccurrenceId: c.visit_occurrence_id,
    conditionConceptCode: c.condition_concept_code,
    conditionConceptName: c.condition_concept_name,
    conditionStartDate: c.condition_start_date.toISOString().slice(0, 10),
    conditionEndDate: c.condition_end_date ? c.condition_end_date.toISOString().slice(0, 10) : null,
    sourceConnectorId: c.source_connector_id,
  };
}
function mapDrugRow(d: DrugRow): DrugExposure {
  return {
    drugExposureId: d.drug_exposure_id,
    personId: d.person_id,
    visitOccurrenceId: d.visit_occurrence_id,
    drugConceptCode: d.drug_concept_code,
    drugConceptName: d.drug_concept_name,
    exposureStartDate: d.exposure_start_date.toISOString().slice(0, 10),
    exposureEndDate: d.exposure_end_date ? d.exposure_end_date.toISOString().slice(0, 10) : null,
    dose: d.dose,
    sourceConnectorId: d.source_connector_id,
  };
}
function mapNlpRow(n: NlpRow): NlpExtractedConcept {
  return {
    nlpExtractedConceptId: n.nlp_extracted_concept_id,
    clinicalNoteId: n.clinical_note_id,
    personId: n.person_id,
    conceptCode: n.concept_code,
    conceptName: n.concept_name,
    polarity: n.polarity,
    severity: n.severity,
    confidence: n.confidence,
    extractedAt: n.extracted_at,
    pipelineId: n.pipeline_id,
  };
}
