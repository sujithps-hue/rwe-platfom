'use client';

import { useState } from 'react';
import { useAuthedApi } from '@/lib/use-authed-api';
import { ConceptPicker, ConceptSearchResult } from '@/components/ConceptPicker';

type CriterionKind = 'has_condition' | 'has_drug_exposure' | 'has_nlp_concept' | 'age_between' | 'visit_type';

interface Criterion {
  kind: CriterionKind;
  conceptId?: number; // has_condition / has_drug_exposure — resolved via ConceptPicker
  conceptLabel?: string; // display only, not sent to the API
  includeDescendants?: boolean;
  conceptCode?: string; // has_nlp_concept — matched by SNOMED code directly, see docs/OMOP_VOCABULARY.md
  minYears?: number;
  maxYears?: number;
  visitConcept?: string;
}

const CRITERION_LABELS: Record<CriterionKind, string> = {
  has_condition: 'Has condition',
  has_drug_exposure: 'Has drug exposure',
  has_nlp_concept: 'Has NLP-extracted concept (e.g. suicidal ideation: 6471006)',
  age_between: 'Age between',
  visit_type: 'Has visit of type',
};

/** Strips UI-only fields (conceptLabel) before sending a criterion to the API. */
function toApiCriterion(c: Criterion) {
  const { conceptLabel: _conceptLabel, ...rest } = c;
  return rest;
}

export default function AnalyticsPage() {
  const { call, session } = useAuthedApi();
  const [name, setName] = useState('Untitled cohort');
  const [criteria, setCriteria] = useState<Criterion[]>([{ kind: 'has_nlp_concept', conceptCode: '6471006' }]);
  const [result, setResult] = useState<{ matchingPatients: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateCriterion(index: number, patch: Partial<Criterion>) {
    setCriteria((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addCriterion() {
    setCriteria((prev) => [...prev, { kind: 'has_condition' }]);
  }

  function removeCriterion(index: number) {
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  }

  async function runQuery() {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const definition = { name, criteria: criteria.map(toApiCriterion) };
      const res = await call<{ matchingPatients: number }>('/analytics/cohorts/count', { method: 'POST', body: definition });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!session) return <p className="muted">Sign in to use the cohort builder.</p>;

  return (
    <div>
      <h1 className="page-title">Cohort Builder</h1>
      <p className="page-subtitle">
        No-code cohort definition against your tenant&apos;s own data, standardized to real OMOP concept_ids
        (docs/OMOP_VOCABULARY.md) — the Analytics pillar of the platform (docs/PRODUCT.md).
        Returns an aggregate count only; a row-level export is a separate, audited action.
      </p>

      <div className="card">
        <div className="field">
          <label htmlFor="cohortName">Cohort name</label>
          <input id="cohortName" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {criteria.map((criterion, i) => (
          <div key={i} style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
            <div className="form-row" style={{ alignItems: 'flex-end', marginBottom: 8 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Criterion</label>
                <select value={criterion.kind} onChange={(e) => updateCriterion(i, { kind: e.target.value as CriterionKind })}>
                  {Object.entries(CRITERION_LABELS).map(([kind, label]) => (
                    <option key={kind} value={kind}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="secondary" onClick={() => removeCriterion(i)}>
                Remove
              </button>
            </div>

            {(criterion.kind === 'has_condition' || criterion.kind === 'has_drug_exposure') && (
              <>
                <ConceptPicker
                  domain={criterion.kind === 'has_condition' ? 'Condition' : 'Drug'}
                  selected={criterion.conceptId ? { conceptId: criterion.conceptId, conceptName: criterion.conceptLabel ?? String(criterion.conceptId) } : null}
                  onSelect={(c: ConceptSearchResult) => updateCriterion(i, { conceptId: c.conceptId, conceptLabel: c.conceptName })}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={criterion.includeDescendants ?? false}
                    onChange={(e) => updateCriterion(i, { includeDescendants: e.target.checked })}
                  />
                  <span className="muted">Include descendant concepts (via concept_ancestor)</span>
                </label>
              </>
            )}

            {criterion.kind === 'has_nlp_concept' && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label>SNOMED concept code</label>
                <input value={criterion.conceptCode ?? ''} onChange={(e) => updateCriterion(i, { conceptCode: e.target.value })} />
              </div>
            )}

            {criterion.kind === 'age_between' && (
              <div className="form-row">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Min age</label>
                  <input type="number" value={criterion.minYears ?? 0} onChange={(e) => updateCriterion(i, { minYears: Number(e.target.value) })} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Max age</label>
                  <input type="number" value={criterion.maxYears ?? 120} onChange={(e) => updateCriterion(i, { maxYears: Number(e.target.value) })} />
                </div>
              </div>
            )}

            {criterion.kind === 'visit_type' && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Visit type</label>
                <select value={criterion.visitConcept ?? 'inpatient'} onChange={(e) => updateCriterion(i, { visitConcept: e.target.value })}>
                  <option value="inpatient">Inpatient</option>
                  <option value="outpatient">Outpatient</option>
                  <option value="emergency">Emergency</option>
                  <option value="telehealth">Telehealth</option>
                </select>
              </div>
            )}
          </div>
        ))}

        <button type="button" className="secondary" onClick={addCriterion} style={{ marginRight: 8 }}>
          + Add criterion
        </button>
        <button type="button" onClick={runQuery} disabled={loading}>
          {loading ? 'Running…' : 'Run cohort count'}
        </button>

        {error && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</p>}
        {result && (
          <div className="stat-tile" style={{ marginTop: 16, maxWidth: 240 }}>
            <div className="value">{result.matchingPatients}</div>
            <div className="label">Matching patients</div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Code Studio</h3>
        <p className="muted">
          A browser-based R/Python notebook running inside a sandboxed, network-egress-restricted compute
          environment against this same cohort — the Trusted Research Environment described in
          docs/PRODUCT.md. Not implemented in this scaffold; `apps/api/src/analytics/code-studio` is the
          integration point for a sandboxed kernel service (e.g. Jupyter Enterprise Gateway or a
          containers-per-session runner).
        </p>
      </div>
    </div>
  );
}
