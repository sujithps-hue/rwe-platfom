# Multi-tenancy & isolation model

## Isolation strategy: schema-per-tenant + Row-Level Security

Two layers of defense, deliberately redundant:

1. **Schema-per-tenant** — each tenant's clinical data (the CDM tables: `person`, `visit_occurrence`,
   `condition_occurrence`, `drug_exposure`, `measurement`, `observation`) lives in its own Postgres schema
   (`tenant_<id>`), created by `TenantsModule.provision()` from the template in
   `packages/common-data-model/prisma/tenant_schema_template.sql`. This gives hard blast-radius containment
   — a bug in a query can't accidentally join across tenants because the tables aren't in the same
   namespace — and makes physically exporting or deleting one tenant's data (GDPR erasure, offboarding) a
   schema-level operation. Every tenant schema's clinical tables reference the cluster's shared
   `omop_vocabulary` schema (concept_id foreign keys) — see `docs/OMOP_VOCABULARY.md` — so that schema
   must be provisioned once per cluster **before** the first tenant is provisioned; `TenantsModule.provision()`
   does not create it.
2. **Row-Level Security (RLS)** on shared/control-plane tables (`tenant`, `user`, `consent_record`,
   `audit_log`, `subscription`) that are cheaper to keep in one table but must never leak across tenants.
   Every such table has `tenant_id` plus a policy:

   ```sql
   ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON audit_log
     USING (tenant_id = current_setting('app.tenant_id')::uuid);
   ```

   The API sets `app.tenant_id` for the duration of each request/transaction
   (`apps/api/src/common/prisma-tenant.middleware.ts`), so even a raw SQL query issued through a
   compromised endpoint cannot read another tenant's rows — the database enforces it, not just the ORM.

Bigger regulated customers (typically the ones asking "can this run inside our own VPC/tenancy?") can be
given a **fully dedicated database instance** instead of a shared Postgres cluster with schema separation;
`TenantsModule` supports both via the `IsolationTier` field (`shared_schema` | `dedicated_instance`) and
`common-data-model`'s connection resolver picks the right connection string per tenant.

## Regional placement

Each tenant has a `homeRegion` (`us`, `eu`, `uae`, `ksa`, `sg`, `cn`, `in`, ...) fixed at provisioning
time. The API's connection pool resolver routes that tenant's schema/instance to the Postgres cluster
running in the matching Terraform-managed regional stack (`infra/terraform`), so residency is enforced at
the infrastructure layer, not only checked in application code.

## Bring-your-own-tenancy (BYOT)

For hospital systems and EHR vendors who require the platform to run **inside their own cloud account**
(common ask for HIPAA-covered entities and for UAE/KSA data-localization rules), the platform ships as:

- A Helm chart / Terraform module (`infra/terraform`) the customer applies into their own AWS/Azure/GCP
  account and region.
- The customer's KMS keys are used for encryption at rest (`packages/compliance-engine`'s
  `EncryptionProvider` interface is pluggable — default is AWS KMS, swappable for Azure Key Vault / GCP
  KMS / an on-prem HSM).
- The platform operator manages the control plane (billing, product updates, connector registry) through
  a narrow, audited API surface; clinical data planes stay inside the customer's account.

This is the deployment mode that lets "any EHR company or hospital or clinic plug in their EHR data into
this pluggable product in their own secured tenancy" (rather than trusting the vendor to hold PHI/PII in a
multi-tenant SaaS database).

## Tenant lifecycle

`provisioning → active → suspended (billing/compliance hold) → offboarding → purged`

Offboarding runs the DSAR "full erasure" pathway tenant-wide: drop the tenant's schema (or destroy the
dedicated instance), revoke connector credentials, retain only the audit log entries required by the
applicable framework's minimum retention (see `COMPLIANCE.md`), then purge.
