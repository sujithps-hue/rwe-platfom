'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useAuthedApi } from '@/lib/use-authed-api';

interface ConnectorConfigSummary {
  id: string;
  displayName: string;
  connectorType: string;
  lastSyncStatus: string | null;
  lastSyncedAt: string | null;
  consecutiveErrors: number;
}

export default function ConnectorsPage() {
  const { call, session } = useAuthedApi();
  const [connectors, setConnectors] = useState<ConnectorConfigSummary[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [connectorType, setConnectorType] = useState('fhir-r4');
  const [credentialSecretId, setCredentialSecretId] = useState('');
  const [settingsJson, setSettingsJson] = useState('{\n  "baseUrl": "https://fhir.example-ehr.com/R4",\n  "tokenUrl": "https://fhir.example-ehr.com/oauth2/token",\n  "clientId": "your-client-id"\n}');

  function refresh() {
    if (!session) return;
    call<ConnectorConfigSummary[]>('/connectors').then(setConnectors).catch((e) => setMessage(e.message));
    call<string[]>('/connectors/types').then(setTypes).catch(() => undefined);
  }

  useEffect(refresh, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      const settings = JSON.parse(settingsJson);
      await call('/connectors', { method: 'POST', body: { displayName, connectorType, credentialSecretId, settings } });
      setDisplayName('');
      setCredentialSecretId('');
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSync(id: string) {
    setBusyId(id);
    setMessage(null);
    try {
      const result = await call<{ recordsFetched: number; errors: unknown[] }>(`/connectors/${id}/sync`, { method: 'POST' });
      setMessage(`Synced ${result.recordsFetched} record(s), ${result.errors.length} error(s).`);
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  if (!session) return <p className="muted">Sign in to manage connectors.</p>;

  return (
    <div>
      <h1 className="page-title">Connectors</h1>
      <p className="page-subtitle">
        Plug in your EHR&apos;s FHIR API, or drop HL7v2/CSV batch files — see docs/CONNECTORS.md for building a
        new connector type.
      </p>

      {message && <p className="muted">{message}</p>}

      <div className="card">
        <h3>Registered connectors</h3>
        {connectors.length === 0 ? (
          <p className="muted">None yet — register one below.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Last sync</th>
                <th>Status</th>
                <th></th>
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
                  <td>
                    <button className="secondary" disabled={busyId === c.id} onClick={() => handleSync(c.id)}>
                      {busyId === c.id ? 'Syncing…' : 'Sync now'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Register a connector</h3>
        <form onSubmit={handleRegister}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="displayName">Display name</label>
              <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="connectorType">Connector type</label>
              <select id="connectorType" value={connectorType} onChange={(e) => setConnectorType(e.target.value)}>
                {(types.length > 0 ? types : ['fhir-r4', 'files-batch']).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="credentialSecretId">Credential secret ID</label>
            <input
              id="credentialSecretId"
              value={credentialSecretId}
              onChange={(e) => setCredentialSecretId(e.target.value)}
              placeholder="Name of the environment variable / secrets-manager entry holding the client secret"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="settings">Settings (JSON)</label>
            <textarea id="settings" rows={6} value={settingsJson} onChange={(e) => setSettingsJson(e.target.value)} />
          </div>
          <button type="submit">Register connector</button>
        </form>
      </div>
    </div>
  );
}
