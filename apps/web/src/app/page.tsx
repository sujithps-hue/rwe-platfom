'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useSession } from '@/lib/session';

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useSession();
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken } = await apiFetch<{ accessToken: string }>('/auth/dev-login', {
        method: 'POST',
        body: { tenantId, email },
      });
      setSession({ tenantId, accessToken, email });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 className="page-title">RWE Platform</h1>
      <p className="page-subtitle">
        A pluggable, multi-tenant real-world-evidence / EHR analytics platform — bring your own EHR data,
        your own tenancy, your own region&apos;s compliance framework.
      </p>

      <div className="card">
        <h3>Sign in (dev)</h3>
        <p className="muted" style={{ marginTop: -4, marginBottom: 16 }}>
          Local-dev password-less login against a seeded tenant/user. Production deployments use real
          SSO/SAML/OIDC instead (see apps/api/src/auth).
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="tenantId">Tenant ID</label>
            <input id="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && (
            <p className="muted" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
