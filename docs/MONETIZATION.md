# Monetization model

`BillingModule` (`apps/api/src/billing`) and the `subscription` / `usage_record` tables in
`packages/common-data-model` implement three composable pricing mechanisms so the platform operator can
monetize regardless of customer size or shape:

## 1. Subscription plans (seat/tier based)

| Plan | Target customer | Included | Overage |
|---|---|---|---|
| `starter` | Single clinic | 1 connector, up to 5,000 patients, 3 admin seats, basic cohort builder | Blocked above cap until upgrade |
| `growth` | Multi-site clinic / small hospital | 3 connectors, up to 100,000 patients, 15 seats, saved cohorts + exports | Metered per additional 10k patients |
| `enterprise` | Hospital system / EHR vendor reselling | Unlimited connectors, dedicated-instance isolation tier, SSO/SCIM, custom compliance jurisdictions, SLA | Custom contract, usage-based true-up |
| `platform` (white-label) | EHR vendor embedding this product for their own customers | Multi-tenant-of-tenants ("reseller") support, revenue-share billing hooks | Per-sub-tenant metering rolled up to the reseller invoice |

Plans are data (`subscription_plan` table), not code — operators can add/edit plans without a deploy.

## 2. Usage-based metering

`UsageMeterService` records metered events per tenant as they happen and aggregates them for billing:

- `records_ingested` — per patient-record written to the CDM by any connector
- `active_seats` — distinct authenticated users in the billing period
- `cohort_queries` — analytics/cohort-builder executions
- `api_calls` — external API usage (for tenants integrating the platform into their own product)
- `storage_gb_month` — CDM + document storage footprint

Each meter has a plan-defined included allowance and an overage rate; `UsageMeterService.rollup()` runs
on a schedule and produces a billing-period summary consumed by the billing provider.

## 3. Reseller / white-label revenue share

Because `platform` tenants can themselves host sub-tenants (an EHR vendor selling this to its own hospital
customers), `subscription.parent_tenant_id` lets usage roll up: the reseller is billed for the sum of its
sub-tenants' usage at a wholesale rate, and can independently set its own retail pricing to its customers
in `apps/web`'s reseller console — the platform operator never needs to know the reseller's retail price.

## Billing provider abstraction

```ts
export interface BillingProvider {
  createCustomer(tenant: Tenant): Promise<string>;
  createSubscription(tenantId: string, planId: string): Promise<string>;
  reportUsage(subscriptionId: string, meter: string, quantity: number): Promise<void>;
  handleWebhook(payload: unknown, signature: string): Promise<BillingEvent>;
}
```

The default implementation targets Stripe Billing (subscriptions + metered usage records), but the
interface is provider-agnostic so a customer requiring a different payment rail (common in the UAE/KSA and
some APAC markets, e.g. local payment gateways) can be swapped in per deployment without touching
`BillingModule`'s business logic.

## Compliance interaction

Billing data (customer name, plan, payment metadata) is **not** clinical/PHI data, so it lives in the
control-plane schema and is exempt from the CDM's stricter residency rules — but invoicing contacts and
tax IDs are still personal data under GDPR/PDPL, so `BillingModule` still runs through the compliance
engine's consent/audit hooks for that (non-health) personal data category.
