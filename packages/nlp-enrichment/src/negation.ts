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

export function detectPolarity(text: string, matchIndex: number): ConceptPolarity {
  const preceding = text.slice(0, matchIndex).toLowerCase();
  const windowStart = Math.max(0, preceding.length - WINDOW_WORDS * 12); // ~12 chars/word heuristic
  const window = preceding.slice(windowStart);

  if (FAMILY_HISTORY_TRIGGERS.some((t) => window.includes(t))) return 'family_history';
  if (NEGATION_TRIGGERS.some((t) => window.includes(t))) return 'negated';
  if (HYPOTHETICAL_TRIGGERS.some((t) => window.includes(t))) return 'hypothetical';
  return 'positive';
}
