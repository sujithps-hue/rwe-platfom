'use client';

import { useEffect, useState } from 'react';
import { useAuthedApi } from '@/lib/use-authed-api';

interface CompliancePolicy {
  framework: string;
  jurisdiction: string;
  allowedRegions: string[];
  requiresDpo: boolean;
  breachNotificationHours: number;
}

interface ConnectorConfigSummary {
  id: string;
  displayName: string;
  connectorType: string;
  lastSyncStatus: string | null;
  lastSyncedAt: string | null;
}

export default function DashboardPage() {
  const { call, session } = useAuthedApi();
  const [policy, setPolicy] = useState<CompliancePolicy | null>(null);
  const [connectors, setConnectors] = useState<ConnectorConfigSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      call<CompliancePolicy>('/compliance/policy'),
      call<ConnectorConfigSummary[]>('/connectors'),
    ])
      .then(([p, c]) => {
        setPolicy(p);
        setConnectors(c);
      })
      .catch((err) => setError(err.message));
  }, [call, session]);

  if (!session) {
    return <p className="muted">Sign in to view your tenant&apos;s dashboard.</p>;
  }

  return (
    <div>
      <h1 className="page-title">Overview</h1>
      <p className="page-subtitle">Signed in as {session.email}</p>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="value">{connectors?.length ?? '—'}</div>
          <div className="label">Connected sources</div>
        </div>
        <div className="stat-tile">
          <div className="value">{policy?.framework ?? '—'}</div>
          <div className="label">Applicable framework</div>
        </div>
        <div className="stat-tile">
          <div className="value">{policy ? `${policy.breachNotificationHours}h` : '—'}</div>
          <div className="label">Breach notification SLA</div>
        </div>
        <div className="stat-tile">
          <div className="value">{policy?.requiresDpo ? 'Required' : 'Not required'}</div>
          <div className="label">DPO / privacy officer</div>
        </div>
      </div>

      <div className="card">
        <h3>Data residency</h3>
        <p className="muted">
          This tenant&apos;s data may only be stored/processed in:{' '}
          <strong>{policy?.allowedRegions.join(', ') || 'not yet configured'}</strong>
        </p>
      </div>

      <div className="card">
        <h3>Connector health</h3>
        {!connectors || connectors.length === 0 ? (
          <p className="muted">No connectors registered yet — add one from the Connectors page.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Last sync</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((c) => (
                <tr key={c.id}>
                  <td>{c.displayName}</td>
                  <td>{c.connectorType}</td>
                  <td>{c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString() : 'never'}</td>
                  <td>
                    <span className={`badge ${c.lastSyncStatus === 'ok' ? 'ok' : c.lastSyncStatus === 'error' ? 'error' : ''}`}>
                      {c.lastSyncStatus ?? 'never_run'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
