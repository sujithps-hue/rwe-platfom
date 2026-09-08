import { ConditionOccurrence, DrugExposure, NlpExtractedConcept, Person, RiskBand, VisitOccurrence } from '@rwe/common-data-model';

/**
 * A patient's assembled feature set for scoring. Built entirely from one tenant's own CDM data —
 * `FeatureExtractor` never reaches across tenants, so a risk model is only ever trained/scored on
 * the data-holder's own population (see the module doc in `care-management-service.ts` for why
 * that boundary is enforced structurally, not just by policy).
 */
export interface PatientFeatures {
  personId: string;
  ageYears: number | null;
  inpatientVisitsLast12mo: number;
  edVisitsLast12mo: number;
  distinctConditionsLast12mo: number;
  activeMedicationCount: number;
  daysSinceLastVisit: number | null;
  hasPositiveSuicidalIdeation: boolean;
  hasSdohRiskFlag: boolean; // homelessness, food insecurity, social isolation, etc.
}

export interface RiskScoreResult {
  score: number; // 0..1
  band: RiskBand;
  /** Feature -> contribution weight, surfaced to clinicians for transparency (never a black-box score alone). */
  explanation: Record<string, number>;
}

export interface RiskModel {
  readonly id: string;
  readonly displayName: string;
  score(features: PatientFeatures): RiskScoreResult;
}

export interface PatientRecordBundle {
  person: Person;
  visits: VisitOccurrence[];
  conditions: ConditionOccurrence[];
  drugExposures: DrugExposure[];
  nlpConcepts: NlpExtractedConcept[];
  /** Reference "now" for windowed features (last-12-months, days-since-last-visit); pass a fixed value in tests. */
  asOf: Date;
}
