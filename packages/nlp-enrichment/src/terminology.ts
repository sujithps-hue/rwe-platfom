import { ConceptTerm } from './types';

/**
 * Seed terminology oriented toward behavioral health documentation (matching the domain NeuroBlu
 * itself focuses on), but the pipeline and its plug interface are not behavioral-health-specific —
 * a tenant extends `CONCEPT_TERMS` (or supplies an entirely different pipeline) for other
 * specialties. Codes are illustrative SNOMED CT concept ids for common behavioral-health terms.
 */
export const CONCEPT_TERMS: ConceptTerm[] = [
  {
    conceptCode: '6471006',
    conceptName: 'Suicidal ideation',
    synonyms: ['suicidal ideation', 'suicidal thoughts', 'thoughts of suicide', ' si ', 'suicidality'],
    severityHints: {
      mild: ['passive'],
      moderate: ['active'],
      severe: ['with plan', 'with intent', 'plan and intent'],
    },
    category: 'symptom',
  },
  {
    conceptCode: '35489007',
    conceptName: 'Depressive disorder',
    synonyms: ['depressed mood', 'depression', 'major depressive disorder', 'mdd'],
    category: 'diagnosis',
  },
  {
    conceptCode: '48694002',
    conceptName: 'Anxiety',
    synonyms: ['anxiety', 'anxious', 'panic attacks', 'generalized anxiety'],
    category: 'symptom',
  },
  {
    conceptCode: '193462001',
    conceptName: 'Insomnia',
    synonyms: ['insomnia', 'difficulty sleeping', 'trouble sleeping'],
    category: 'symptom',
  },
  {
    conceptCode: '66214007',
    conceptName: 'Substance use disorder',
    synonyms: ['substance use', 'alcohol use disorder', 'drug abuse', 'opioid use disorder'],
    category: 'diagnosis',
  },
  {
    conceptCode: '32911000',
    conceptName: 'Homelessness',
    synonyms: ['homeless', 'lack of housing', 'unstably housed', 'unhoused'],
    category: 'sdoh',
  },
  {
    conceptCode: '733423003',
    conceptName: 'Food insecurity',
    synonyms: ['food insecurity', 'unable to afford food', 'food insecure'],
    category: 'sdoh',
  },
  {
    conceptCode: '423315002',
    conceptName: 'Limited social contact',
    synonyms: ['social isolation', 'socially isolated', 'lives alone with no support'],
    category: 'sdoh',
  },
];
