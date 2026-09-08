export type CohortCriterion =
  | { kind: 'has_condition'; conceptCode: string; withinDays?: number }
  | { kind: 'has_drug_exposure'; conceptCode: string; withinDays?: number }
  | { kind: 'has_nlp_concept'; conceptCode: string; polarity?: 'positive' | 'negated' }
  | { kind: 'age_between'; minYears: number; maxYears: number }
  | { kind: 'visit_type'; visitConcept: 'inpatient' | 'outpatient' | 'emergency' | 'telehealth' };

export interface CohortDefinition {
  name: string;
  /** All criteria are AND-ed together — a criterion-group/OR model is a documented extension point, not implemented in this reference. */
  criteria: CohortCriterion[];
}
