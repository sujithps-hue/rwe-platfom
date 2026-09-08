import { PatientFeatures, PatientRecordBundle } from './types';

const SUICIDAL_IDEATION_CONCEPT_CODE = '6471006'; // matches packages/nlp-enrichment/src/terminology.ts
const SDOH_CONCEPT_CODES = new Set(['32911000', '733423003', '423315002']); // homelessness, food insecurity, social isolation

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export class FeatureExtractor {
  extract(bundle: PatientRecordBundle): PatientFeatures {
    const { person, visits, conditions, drugExposures, nlpConcepts, asOf } = bundle;
    const twelveMonthsAgo = new Date(asOf);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const recentVisits = visits.filter((v) => new Date(v.visitStartDate) >= twelveMonthsAgo);
    const recentConditionCodes = new Set(
      conditions.filter((c) => new Date(c.conditionStartDate) >= twelveMonthsAgo).map((c) => c.conditionConceptCode),
    );
    const activeMedications = drugExposures.filter((d) => !d.exposureEndDate || new Date(d.exposureEndDate) >= asOf);

    const lastVisitDate = visits
      .map((v) => new Date(v.visitStartDate))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      personId: person.personId,
      ageYears: person.birthYear ? asOf.getFullYear() - person.birthYear : null,
      inpatientVisitsLast12mo: recentVisits.filter((v) => v.visitConcept === 'inpatient').length,
      edVisitsLast12mo: recentVisits.filter((v) => v.visitConcept === 'emergency').length,
      distinctConditionsLast12mo: recentConditionCodes.size,
      activeMedicationCount: activeMedications.length,
      daysSinceLastVisit: lastVisitDate ? daysBetween(asOf, lastVisitDate) : null,
      hasPositiveSuicidalIdeation: nlpConcepts.some(
        (c) => c.conceptCode === SUICIDAL_IDEATION_CONCEPT_CODE && c.polarity === 'positive',
      ),
      hasSdohRiskFlag: nlpConcepts.some((c) => SDOH_CONCEPT_CODES.has(c.conceptCode) && c.polarity === 'positive'),
    };
  }
}
