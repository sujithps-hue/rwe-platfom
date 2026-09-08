'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useAuthedApi } from '@/lib/use-authed-api';

interface CompliancePolicy {
  framework: string;
  jurisdiction: string;
  allowedRegions: string[];
  requiredConsent: string;
  deidentificationStandard: string;
  auditRetentionDays: number;
  breachNotificationHours: number;
  dataSubjectRights: {
    access: boolean;
    rectification: boolean;
    erasure: boolean;
    portability: boolean;
    restriction: boolean;
    fulfillmentSlaDays: number;
  };
  citation: string;
}

interface DsarRequest {
  id: string;
  dataSubjectId: string;
  type: string;
  status: string;
  requestedAt: string;
  dueBy: string;
}

interface AuditEntry {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  occurredAt: string;
}

export default function CompliancePage() {
  const { call, session } = useAuthedApi();
  const [policy, setPolicy] = useState<CompliancePolicy | null>(null);
  const [dsarRequests, setDsarRequests] = useState<DsarRequest[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [dataSubjectId, setDataSubjectId] = useState('');
  const [dsarType, setDsarType] = useState('access');
  const [message, setMessage] = useState<string | null>(null);

  function refresh() {
    if (!session) return;
    call<CompliancePolicy>('/compliance/policy').then(setPolicy).catch(() => undefined);
    call<DsarRequest[]>('/compliance/dsar').then(setDsarRequests).catch(() => undefined);
    call<AuditEntry[]>('/compliance/audit-log').then(setAuditLog).catch(() => undefined);
  }

  useEffect(refresh, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitDsar(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await call('/compliance/dsar', { method: 'POST', body: { dataSubjectId, type: dsarType } });
      setDataSubjectId('');
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  if (!session) return <p className="muted">Sign in to view compliance status.</p>;

  const rights = policy?.dataSubjectRights;

  return (
    <div>
      <h1 className="page-title">Compliance</h1>
      <p className="page-subtitle">
        This tenant&apos;s effective policy, resolved from its configured jurisdiction(s) — see
        docs/COMPLIANCE.md for the full framework matrix.
      </p>

      {policy && (
        <div className="card">
          <h3>Effective policy: {policy.framework}</h3>
          <table>
            <tbody>
              <tr>
                <td>Data residency</td>
                <td>{policy.allowedRegions.join(', ') || 'not configured'}</td>
              </tr>
              <tr>
                <td>Required consent</td>
                <td>{policy.requiredConsent}</td>
              </tr>
              <tr>
                <td>De-identification standard</td>
                <td>{policy.deidentificationStandard}</td>
              </tr>
              <tr>
                <td>Audit retention</td>
                <td>{policy.auditRetentionDays} days</td>
              </tr>
              <tr>
                <td>Breach notification SLA</td>
                <td>{policy.breachNotificationHours} hours</td>
              </tr>
              <tr>
                <td>Data subject rights</td>
                <td>
                  {rights &&
                    (['access', 'rectification', 'erasure', 'portability', 'restriction'] as const)
                      .filter((r) => rights[r])
                      .join(', ')}{' '}
                  (SLA: {rights?.fulfillmentSlaDays} days)
                </td>
              </tr>
              <tr>
                <td>Citation</td>
                <td className="muted">{policy.citation}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3>Data subject requests (DSAR)</h3>
        <form onSubmit={submitDsar} className="form-row" style={{ alignItems: 'flex-end', marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Data subject ID</label>
            <input value={dataSubjectId} onChange={(e) => setDataSubjectId(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Request type</label>
            <select value={dsarType} onChange={(e) => setDsarType(e.target.value)}>
              <option value="access">Access</option>
              <option value="rectification">Rectification</option>
              <option value="erasure">Erasure</option>
              <option value="portability">Portability</option>
              <option value="restriction">Restriction</option>
            </select>
          </div>
          <button type="submit">Submit</button>
        </form>
        {message && <p style={{ color: 'var(--danger)' }}>{message}</p>}

        {dsarRequests.length === 0 ? (
          <p className="muted">No requests yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Type</th>
                <th>Status</th>
                <th>Due by</th>
              </tr>
            </thead>
            <tbody>
              {dsarRequests.map((r) => (
                <tr key={r.id}>
                  <td>{r.dataSubjectId}</td>
                  <td>{r.type}</td>
                  <td>{r.status}</td>
                  <td>{new Date(r.dueBy).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Audit log</h3>
        {auditLog.length === 0 ? (
          <p className="muted">No audit entries yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((e) => (
                <tr key={e.id}>
                  <td>{e.actorId}</td>
                  <td>{e.action}</td>
                  <td>{e.resourceType}</td>
                  <td>{new Date(e.occurredAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
