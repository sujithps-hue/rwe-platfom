import { ClinicalNote, NlpExtractedConcept } from '@rwe/common-data-model';
import { EnrichmentPipeline } from './types';
import { CONCEPT_TERMS } from './terminology';
import { detectPolarity } from './negation';

type ExtractedRow = Omit<NlpExtractedConcept, 'nlpExtractedConceptId' | 'extractedAt'>;

/**
 * Default, dependency-free `EnrichmentPipeline`: terminology matching (case-insensitive substring/
 * synonym match) + windowed negation/hypothetical/family-history detection + keyword-based
 * severity hinting. Intended as a functional baseline and an extension point, not a clinical-grade
 * NLP model — see the module doc in `negation.ts` for how a production deployment would replace it.
 */
export class RuleBasedEnrichmentPipeline implements EnrichmentPipeline {
  readonly id = 'rule-based-v1';

  async enrich(note: ClinicalNote): Promise<ExtractedRow[]> {
    const text = note.noteText;
    const lowerText = text.toLowerCase();
    const results: ExtractedRow[] = [];

    for (const term of CONCEPT_TERMS) {
      for (const synonym of term.synonyms) {
        let searchFrom = 0;
        let matchIndex: number;
        while ((matchIndex = lowerText.indexOf(synonym.toLowerCase(), searchFrom)) !== -1) {
          const polarity = detectPolarity(lowerText, matchIndex);
          const severity = detectSeverity(lowerText, matchIndex, term.severityHints);

          results.push({
            clinicalNoteId: note.clinicalNoteId,
            personId: note.personId,
            conceptCode: term.conceptCode,
            conceptName: term.conceptName,
            polarity,
            severity,
            confidence: 0.6, // fixed conservative confidence for a rule-based match; model-backed pipelines should report calibrated scores
            pipelineId: this.id,
          });

          searchFrom = matchIndex + synonym.length;
        }
      }
    }

    return dedupe(results);
  }
}

function detectSeverity(
  text: string,
  matchIndex: number,
  hints: Record<'mild' | 'moderate' | 'severe', string[]> | undefined,
): 'mild' | 'moderate' | 'severe' | null {
  if (!hints) return null;
  const windowStart = Math.max(0, matchIndex - 80);
  const windowEnd = Math.min(text.length, matchIndex + 80);
  const window = text.slice(windowStart, windowEnd);
  for (const level of ['severe', 'moderate', 'mild'] as const) {
    if (hints[level].some((phrase) => window.includes(phrase))) return level;
  }
  return null;
}

function dedupe(rows: ExtractedRow[]): ExtractedRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.conceptCode}:${row.polarity}:${row.severity ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
