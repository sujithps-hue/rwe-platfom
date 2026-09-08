'use client';

import { FormEvent, useState } from 'react';
import { useAuthedApi } from '@/lib/use-authed-api';

interface RiskScore {
  riskScoreId: string;
  personId: string;
  modelId: string;
  score: number;
  scoreBand: 'low' | 'medium' | 'high';
  computedAt: string;
  explanation: Record<string, number> | null;
}

export default function CareManagementPage() {
  const { call, session } = useAuthedApi();
  const [personId, setPersonId] = useState('');
  const [scores, setScores] = useState<RiskScore[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleScore(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setScores(null);
    try {
      await call(`/care-management/patients/${personId}/score`, { method: 'POST' });
      const result = await call<RiskScore[]>(`/care-management/patients/${personId}/risk-scores`);
      setScores(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!session) return <p className="muted">Sign in to use Care Management.</p>;

  return (
    <div>
      <h1 className="page-title">Care Management</h1>
      <p className="page-subtitle">
        The Care Management pillar: risk-stratification and trajectory-prediction models,
        scored per-patient on your tenant&apos;s own data only (docs/PRODUCT.md).
      </p>

      <div className="card">
        <h3>Score a patient</h3>
        <form onSubmit={handleScore}>
          <div className="field">
            <label htmlFor="personId">Person ID</label>
            <input id="personId" value={personId} onChange={(e) => setPersonId(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Scoring…' : 'Run risk models'}
          </button>
        </form>
        {error && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</p>}
      </div>

      {scores && (
        <div className="card">
          <h3>Risk scores</h3>
          {scores.length === 0 ? (
            <p className="muted">No scores yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Score</th>
                  <th>Band</th>
                  <th>Top contributing factors</th>
                  <th>Computed</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.riskScoreId}>
                    <td>{s.modelId}</td>
                    <td>{s.score.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${s.scoreBand}`}>{s.scoreBand}</span>
                    </td>
                    <td className="muted">
                      {s.explanation
                        ? Object.entries(s.explanation)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 2)
                            .map(([k]) => k)
                            .join(', ')
                        : '—'}
                    </td>
                    <td>{new Date(s.computedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
