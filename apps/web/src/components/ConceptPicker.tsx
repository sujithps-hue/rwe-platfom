'use client';

import { useState } from 'react';
import { useAuthedApi } from '@/lib/use-authed-api';

export interface ConceptSearchResult {
  conceptId: number;
  conceptName: string;
  domainId: string;
  vocabularyId: string;
  conceptClassId: string;
  standardConcept: string | null;
  conceptCode: string;
}

/**
 * Concept search box for the Cohort Builder — the same role OHDSI ATLAS's concept-set search
 * plays: find a standard concept_id by name or code instead of needing to already know it.
 * Queries GET /vocabulary/concepts/search (apps/api/src/vocabulary), which searches whatever is
 * loaded into the shared omop_vocabulary schema — a small bootstrap set in local dev
 * (docs/OMOP_VOCABULARY.md), the full Athena release in production.
 */
export function ConceptPicker({
  domain,
  selected,
  onSelect,
}: {
  domain?: string;
  selected: { conceptId: number; conceptName: string } | null;
  onSelect: (concept: ConceptSearchResult) => void;
}) {
  const { call } = useAuthedApi();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ConceptSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (domain) params.set('domain', domain);
      const found = await call<ConceptSearchResult[]>(`/vocabulary/concepts/search?${params.toString()}`);
      setResults(found);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        placeholder={selected ? selected.conceptName : 'Search by name or code…'}
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {selected && !open && (
        <div className="muted" style={{ marginTop: 4 }}>
          Selected: <strong>{selected.conceptName}</strong> (concept_id {selected.conceptId})
        </div>
      )}
      {open && (
        <div
          className="card"
          style={{ position: 'absolute', zIndex: 10, marginTop: 4, padding: 4, maxHeight: 220, overflowY: 'auto', width: '100%' }}
        >
          {loading && <div className="muted" style={{ padding: 8 }}>Searching…</div>}
          {!loading && results.length === 0 && <div className="muted" style={{ padding: 8 }}>No matches in the loaded vocabulary.</div>}
          {results.map((r) => (
            <div
              key={r.conceptId}
              style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 6 }}
              onMouseDown={() => {
                onSelect(r);
                setQuery('');
                setOpen(false);
              }}
            >
              <div>{r.conceptName}</div>
              <div className="muted">
                {r.vocabularyId} {r.conceptCode} · concept_id {r.conceptId}
                {r.standardConcept !== 'S' && ' · non-standard (will be mapped via "Maps to")'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
