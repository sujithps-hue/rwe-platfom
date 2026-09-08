# RWE Platform

A pluggable, multi-tenant **Real-World-Evidence / EHR analytics platform** that lets any EHR vendor,
hospital, or clinic connect their own patient data into a secure, isolated tenancy, normalize it into a
common research data model, and run cohort analytics on it, while the platform operator monetizes the
offering through metered/subscription billing.

The defining constraint of this build is **regulatory portability**: the same codebase must be deployable,
unmodified, for a clinic in the US (HIPAA), a hospital group in the EU (GDPR), a provider in the UAE
(PDPL) or Saudi Arabia (PDPL), and a health system in Singapore (PDPA) or elsewhere in APAC — with the
correct region-specific behavior (data residency, consent, retention, breach notification, de-identification)
selected automatically per tenant. See [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) for the full mapping.

## Why this shape

A curated real-world-data (RWD) platform generally works like this: EHR data is extracted, transformed
into a common data model (CDM), de-identified/pseudonymized, and exposed through a cohort-builder +
analytics UI to researchers and life-science customers, with the underlying provenance staying inside
the health system's governance boundary. This project builds that shape as a **pluggable,
white-labelable product**, rather than a single-tenant research database:

1. **Bring-your-own-EHR, bring-your-own-tenancy.** Any EHR (Epic, Cerner/Oracle Health, Allscripts, a
   home-grown system) plugs in through a connector SDK. Each customer's data lives in its own logically
   (or physically) isolated tenancy, in a region the customer chooses.
2. **Common data model.** All connectors normalize source data into a common schema
   (`packages/common-data-model`) standardized against the real OMOP Standardized Vocabulary
   (`concept_id`, not raw source codes — see [`docs/OMOP_VOCABULARY.md`](docs/OMOP_VOCABULARY.md))
   so analytics, cohort definitions, and dashboards are connector-agnostic.
3. **Compliance is a first-class runtime concern, not a checklist.** A policy engine
   (`packages/compliance-engine`) resolves the applicable frameworks per tenant/region and enforces them
   at request time: residency routing, consent gating, de-identification, audit logging, retention, and
   data-subject-rights workflows (access/export/erasure).
4. **Monetization is built in.** Tenants subscribe to plans and/or are metered on usage (records
   ingested, active seats, API calls, cohort queries) — see [`docs/MONETIZATION.md`](docs/MONETIZATION.md).

## Repository layout

```
apps/
  api/                  NestJS backend: tenants, auth (RBAC/ABAC), connectors, compliance, billing, analytics
  web/                  Next.js tenant console + analytics/cohort UI
packages/
  compliance-engine/    Region → framework resolution, policy rules, consent, audit, de-identification
  connector-sdk/        The pluggable EHR connector interface + registry that any adapter implements
  connector-fhir/       Reference connector: FHIR R4 (Epic/Cerner/any FHIR-compliant EHR)
  connector-files/      Reference connector: HL7v2 and CSV/flat-file batch ingestion
  common-data-model/    Prisma schema for the control plane, per-tenant OMOP CDM schema template, and the
                        shared OMOP Standardized Vocabulary schema + RLS migration
infra/
  docker/               Local dev docker-compose stack (Postgres, Redis, API, web)
  terraform/            Skeleton for multi-region deployment (US, EU, UAE/ME, APAC)
docs/
  ARCHITECTURE.md       System design, tenancy model, data flow
  COMPLIANCE.md         Regulatory framework matrix and how the engine enforces each one
  MULTI_TENANCY.md       Isolation model (schema-per-tenant + RLS) and region placement
  CONNECTORS.md         How to build a new EHR connector
  MONETIZATION.md       Plans, metering, billing integration
  OMOP_VOCABULARY.md    The OMOP Standardized Vocabulary schema, concept_id mapping, and how to load real vocabulary data
```

## Getting started (local dev)

```bash
npm install
cp infra/docker/.env.example infra/docker/.env
docker compose -f infra/docker/docker-compose.yml up -d postgres redis

# Build the shared packages first (apps/api depends on their compiled output):
npm run build --workspace=packages/compliance-engine
npm run build --workspace=packages/common-data-model
npm run build --workspace=packages/connector-sdk
npm run build --workspace=packages/connector-fhir
npm run build --workspace=packages/connector-files
npm run build --workspace=packages/nlp-enrichment
npm run build --workspace=packages/predictive-models

# Generate the Prisma client, then create the initial control-plane migration against your local
# Postgres (this repo ships prisma/schema.prisma and rls_policies.sql, but not a committed
# migrations/ directory, since that must be generated against a real database connection):
npm run prisma:generate --workspace=packages/common-data-model
export DATABASE_URL=postgres://rwe:rwe_dev_password@localhost:5432/rwe_platform
npx prisma migrate dev --schema packages/common-data-model/prisma/schema.prisma --name init
psql "$DATABASE_URL" -f packages/common-data-model/prisma/rls_policies.sql

# Once per cluster (not per tenant): the shared OMOP Standardized Vocabulary schema — see
# docs/OMOP_VOCABULARY.md for what's in the bootstrap seed vs. what a real deployment loads.
psql "$DATABASE_URL" -f packages/common-data-model/prisma/omop_vocabulary_schema.sql
psql "$DATABASE_URL" -f packages/common-data-model/prisma/omop_vocabulary_seed.sql
psql "$DATABASE_URL" -f packages/common-data-model/prisma/omop_vocabulary_constraints.sql

npm run prisma:seed --workspace=packages/common-data-model

npm run start:dev --workspace=apps/api
npm run dev --workspace=apps/web
```

The API listens on `:4000`, the web console on `:3000`. Sign in at `:3000` with the seeded tenant
slug (`demo-clinic` — look up its id via `psql`/Prisma Studio, since `/auth/dev-login` takes a
tenant *id*) and email `admin@demo-clinic.example`. See `infra/README.md` for the docker-compose
and Terraform deployment options, and each package's `package.json` for its own scripts.

## Status

This repository is an architectural foundation: the tenancy, compliance-engine, connector-SDK, data model,
and billing/analytics scaffolding are implemented and wired together; production hardening (real Epic/Cerner
OAuth flows, HSM-backed key management, a full terraform rollout per region, SOC 2 / HITRUST evidence
collection) is called out explicitly as follow-up work in the relevant docs rather than stubbed out silently.
