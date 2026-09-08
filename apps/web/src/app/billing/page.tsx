'use client';

import { useEffect, useState } from 'react';
import { useAuthedApi } from '@/lib/use-authed-api';

interface Plan {
  id: string;
  code: string;
  name: string;
  monthlyPriceCents: number | null;
  includedAllowances: Record<string, number>;
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  plan: Plan;
}

export default function BillingPage() {
  const { call, session } = useAuthedApi();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    call<Plan[]>('/billing/plans').then(setPlans).catch(() => undefined);
    call<Subscription | null>('/billing/subscription').then(setSubscription).catch(() => undefined);
    call<Record<string, number>>('/billing/usage').then(setUsage).catch(() => undefined);
  }, [call, session]);

  async function handleSubscribe(planCode: string) {
    setMessage(null);
    try {
      await call('/billing/subscribe', { method: 'POST', body: { planCode, billingEmail: session?.email } });
      setMessage(`Subscribed to ${planCode}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  if (!session) return <p className="muted">Sign in to manage billing.</p>;

  return (
    <div>
      <h1 className="page-title">Billing</h1>
      <p className="page-subtitle">Subscription plans and usage metering — see docs/MONETIZATION.md.</p>

      {message && <p className="muted">{message}</p>}

      {subscription && (
        <div className="card">
          <h3>Current subscription</h3>
          <p>
            <strong>{subscription.plan.name}</strong> — {subscription.status}, renews{' '}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        </div>
      )}

      <div className="card">
        <h3>Usage this period</h3>
        {Object.keys(usage).length === 0 ? (
          <p className="muted">No usage recorded yet this period.</p>
        ) : (
          <table>
            <tbody>
              {Object.entries(usage).map(([meter, quantity]) => (
                <tr key={meter}>
                  <td>{meter}</td>
                  <td>{quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="stat-grid">
        {plans.map((plan) => (
          <div className="stat-tile" key={plan.id}>
            <div className="label">{plan.code}</div>
            <div className="value">{plan.monthlyPriceCents != null ? `$${(plan.monthlyPriceCents / 100).toFixed(0)}/mo` : 'Custom'}</div>
            <p className="muted" style={{ margin: '8px 0' }}>
              {plan.name}
            </p>
            <button className="secondary" onClick={() => handleSubscribe(plan.code)}>
              Choose plan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
