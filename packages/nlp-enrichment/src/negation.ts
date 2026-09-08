import { ConceptPolarity } from './types';

/**
 * Simplified ConText-algorithm-style polarity detection: looks at a fixed window of words
 * preceding a matched term for negation/hypothetical/family-history trigger phrases. This is a
 * deliberately conservative reference implementation — production behavioral-health NLP uses
 * trained classifiers, not a fixed trigger list; swap `RuleBasedEnrichmentPipeline` for a
 * model-backed `EnrichmentPipeline` implementation to improve on this.
 */
const NEGATION_TRIGGERS = ['no', 'not', 'denies', 'denied', 'without', 'negative for', 'ruled out', 'no evidence of', 'no history of'];
const HYPOTHETICAL_TRIGGERS = ['if', 'should', 'monitor for', 'risk of', 'concern for', 'possible', 'could develop'];
const FAMILY_HISTORY_TRIGGERS = ['family history of', 'mother has', 'father has', 'sibling has', 'parent with'];

const WINDOW_WORDS = 6;
const SENTENCE_BOUNDARY_RE = /[.!?\n]/g;

export function detectPolarity(text: string, matchIndex: number): ConceptPolarity {
  const preceding = text.slice(0, matchIndex).toLowerCase();

  // Clamp the window to the current sentence: a trigger word from an earlier, unrelated sentence
  // (e.g. "Patient denies suicidal ideation. ... patient states lack of housing.") must never
  // negate a later, distinct clinical fact just because it falls within a fixed character count.
  let sentenceStart = 0;
  let match: RegExpExecArray | null;
  SENTENCE_BOUNDARY_RE.lastIndex = 0;
  while ((match = SENTENCE_BOUNDARY_RE.exec(preceding)) !== null) {
    sentenceStart = match.index + 1;
  }

  const windowStart = Math.max(sentenceStart, preceding.length - WINDOW_WORDS * 12); // ~12 chars/word heuristic
  const window = preceding.slice(windowStart);

  if (FAMILY_HISTORY_TRIGGERS.some((t) => window.includes(t))) return 'family_history';
  if (NEGATION_TRIGGERS.some((t) => window.includes(t))) return 'negated';
  if (HYPOTHETICAL_TRIGGERS.some((t) => window.includes(t))) return 'hypothetical';
  return 'positive';
}
