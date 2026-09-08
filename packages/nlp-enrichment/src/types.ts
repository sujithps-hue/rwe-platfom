import { ClinicalNote, ConceptPolarity, NlpExtractedConcept } from '@rwe/common-data-model';

/**
 * Pluggable enrichment interface. The platform ships `RuleBasedEnrichmentPipeline` (a terminology/
 * negation-detection reference implementation) as the default; a tenant with a licensed clinical
 * NLP vendor, or the platform operator's own trained, disease-specific models, can implement this
 * interface and register it in place of the default per tenant.
 */
export interface EnrichmentPipeline {
  readonly id: string;
  enrich(note: ClinicalNote): Promise<Omit<NlpExtractedConcept, 'nlpExtractedConceptId' | 'extractedAt'>[]>;
}

export interface ConceptTerm {
  conceptCode: string; // SNOMED CT
  conceptName: string;
  /** Case-insensitive surface forms/synonyms that trigger a match. */
  synonyms: string[];
  severityHints?: Record<'mild' | 'moderate' | 'severe', string[]>;
  category: 'symptom' | 'diagnosis' | 'sdoh';
}

export type { ConceptPolarity };
