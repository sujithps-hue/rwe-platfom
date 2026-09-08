# Architecture

## High-level data flow

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────────────┐     ┌────────────────────┐
│  Source EHR │────▶│  Connector (SDK)  │────▶│  Common Data Model    │────▶│  Analytics / Cohort │
│ Epic/Cerner/│     │ FHIR / HL7v2 /CSV │     │ (OMOP-CDM-inspired,   │     │  Builder + Dashboards│
│ generic API │     │  per-tenant creds │     │  per-tenant isolated) │     │  (apps/web)         │
└─────────────┘     └──────────────────┘     └───────────────────────┘     └────────────────────┘
                              │                          ▲
                              ▼                          │
                     ┌──────────────────┐        ┌───────────────┐
                     │ Compliance Engine │───────▶│ Audit Log /   │
                     │ (consent, residency,       │ Consent Store │
                     │  de-identification) │       └───────────────┘
                     └──────────────────┘
```

1. A tenant registers one or more **connectors** (`packages/connector-sdk`), configuring source
   credentials (FHIR base URL + OAuth2 client, or an SFTP/S3 drop location for HL7v2/CSV batches).
2. The API's `ConnectorsModule` runs sync jobs (BullMQ-backed) that pull data, and the connector maps
   source resources to the **common data model** (`packages/common-data-model`).
3. Every ingested record passes through the **compliance engine** first: consent check, residency check,
   de-identification (if the tenant's policy or the user's role requires it), then is written to the
   tenant-isolated store and an audit entry is appended.
4. The **analytics layer** (`apps/api/src/analytics`) queries the CDM to power cohort definitions,
   aggregate dashboards, and exports — never touching the source EHR directly.
5. **Billing** meters ingestion volume, active users, and analytics queries per tenant for monetization.

## Services (apps/api)

NestJS modules, each independently testable and mapped 1:1 to a bounded context:

- `TenantsModule` — tenant CRUD, region/jurisdiction assignment, provisioning (creates the tenant's
  isolated schema + RLS policies via `common-data-model`).
- `AuthModule` — JWT auth, tenant-scoped sessions, RBAC/ABAC via CASL (`Role`: `platform_admin`,
  `tenant_admin`, `clinician`, `data_analyst`, `auditor`, `patient` for self-service DSAR).
- `ConnectorsModule` — registers connector instances per tenant, schedules/executes sync jobs, surfaces
  sync health.
- `ComplianceModule` — consent CRUD, DSAR intake/fulfillment, audit log query API, breach-workflow clock.
- `BillingModule` — subscription plans, usage metering, invoice/webhook handling (Stripe-shaped interface,
  provider-agnostic behind `BillingProvider`).
- `AnalyticsModule` — cohort builder query execution against the CDM, aggregate/statistical endpoints.
- `common/` — tenant-context middleware, audit interceptor, guards, exception filters.

## Request lifecycle & tenant context

Every inbound request resolves a `TenantContext` (`apps/api/src/common/tenant-context.middleware.ts`) from
either a subdomain (`acme.rweplatform.com`), an `X-Tenant-Id` header (service-to-service), or the
authenticated JWT's `tenantId` claim. The context carries `tenantId`, `homeRegion`, and the resolved
`CompliancePolicy`, and is attached to the async local storage store so the Prisma client can set the
Postgres session variable (`app.tenant_id`) that Row-Level-Security policies key off — see
[`MULTI_TENANCY.md`](MULTI_TENANCY.md).

## Deployment topology

`infra/terraform` defines one **regional stack** per residency zone (`us-east`, `eu-central`, `me-uae`,
`ap-southeast`), each with its own Postgres, object storage, and KMS key. A tenant is provisioned entirely
within one regional stack (or split, for a multi-region customer, into per-subsidiary tenants that share
billing but not data). This makes "data never leaves the region" an infrastructure fact rather than an
application promise, satisfying UAE/KSA localization and reducing GDPR cross-border-transfer exposure.

## Compliance readiness checklist

Before onboarding a real tenant with real PHI/PII in a given region:

- [ ] Signed BAA (US) or DPA (EU/UK/elsewhere) with the tenant and every sub-processor
- [ ] Regional Terraform stack applied and verified for that residency zone
- [ ] Tenant's `Jurisdiction` set correctly (drives which `CompliancePolicy` applies)
- [ ] Encryption keys provisioned via KMS/HSM (not the dev defaults in `.env.example`)
- [ ] Security Risk Assessment (HIPAA) / DPIA (GDPR, large-scale health data) completed and filed
- [ ] Breach-response runbook reviewed with legal counsel for that jurisdiction
- [ ] Penetration test and access review completed
- [ ] Data retention schedule confirmed against the framework's minimum/maximum (see `COMPLIANCE.md`)

## Why an OMOP-CDM-inspired model, not raw FHIR storage

FHIR is excellent as an **interoperability/transport** format but is a poor fit for population-level
cohort analytics (deeply nested, versioned resources, no stable star-schema for OLAP-style queries). OMOP
CDM is the de facto standard for real-world-evidence analytics (used by OHDSI, and broadly similar to what
NeuroBlu itself normalizes into) and has mature tooling for cohort definitions and standardized
vocabularies (SNOMED, RxNorm, LOINC). Connectors are therefore responsible for **FHIR/HL7v2/CSV → CDM**
mapping; the CDM is the single schema that all analytics and dashboards are built against, independent of
which EHR the data came from.
