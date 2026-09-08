# Product shape (mapped from NeuroBlu)

This platform reproduces NeuroBlu's three product pillars as generic, pluggable modules — generic because,
unlike NeuroBlu, this product does not own a single proprietary dataset; instead **any** EHR/hospital/clinic
plugs its own data in, in its own tenancy, region, and compliance posture.

| NeuroBlu pillar | This platform's equivalent | Where |
|---|---|---|
| **NeuroBlu Data** — 32M+ patients, 20yr longitudinal, NLP-enriched | **Common Data Model + NLP Enrichment Pipeline** — any connected EHR's data is normalized into the shared CDM and enriched by an NLP pass over clinical notes (symptom/severity extraction, SDOH tagging) so structured *and* unstructured data both feed analytics | `packages/common-data-model`, `packages/nlp-enrichment` |
| **NeuroBlu Analytics** — no-code UI + R/Python code studio | **Cohort Builder (no-code) + Code Studio (notebook)** inside a browser-based Trusted Research Environment — no raw data ever leaves the TRE; only aggregate/exported results do | `apps/web` (`/analytics`, `/studio`), `apps/api/src/analytics` |
| **NeuroBlu Health** — care management, predictive models for clinicians | **Care Management Module** — risk-stratification and trajectory-prediction models surfaced to clinicians at point of care, trained per-tenant on that tenant's own (in-region) data, never pooled across tenants without explicit multi-tenant research consent | `packages/predictive-models`, `apps/api/src/care-management` |

## Customer segments this serves (same four as NeuroBlu's market)

1. **Pharma / life sciences** — cohort discovery for trial feasibility and RWE for regulatory submissions
   (FDA RWE guidance-aligned exports), using de-identified, tokenizable (Datavant-style linkage-ready) data.
2. **Healthcare providers** — the Care Management module + provider-facing dashboards for cost-of-care and
   risk-stratification.
3. **Academic researchers** — the no-code Cohort Builder + Code Studio, scoped to their own institution's
   connected data (a university hospital's tenant), under IRB-governed consent.
4. **Payers** — comparative-outcomes analytics against the CDM, exported as aggregate/de-identified reports.

## Trusted Research Environment (TRE)

Matching NeuroBlu's "browser-based TRE" architecture: `apps/web`'s Code Studio runs analyst code
(R/Python) against the tenant's CDM inside a sandboxed, network-egress-restricted compute environment
(`apps/api/src/analytics/code-studio`) — the analyst never receives a data export by default; only
aggregate results, tables, and charts leave the sandbox. A raw-row export is a distinct, audited,
compliance-gated action (`ComplianceModule`'s export/DSAR pathway), not a default capability of the studio.

## NLP enrichment (behavioral-health-oriented, but framework-agnostic)

`packages/nlp-enrichment` defines an `EnrichmentPipeline` interface that a tenant can plug a model into
(the platform ships a lightweight rule/terminology-based reference implementation; tenants with clinical
NLP vendors — or the platform operator's own trained models, mirroring NeuroBlu's disease-specific models
— can swap in a stronger implementation). It runs over `note_text` fields already stored in the CDM
(`observation.note_text` / a dedicated `clinical_note` table) and writes back structured
`nlp_extracted_concept` rows (SNOMED-coded symptom/severity/SDOH mentions) that the Cohort Builder can
filter on exactly like structured EHR fields — so a cohort like "patients with clinician-documented
suicidal ideation in the last 90 days" is queryable even when that information only ever existed in free
text.

## Monetization alignment

Matches NeuroBlu's enterprise-SaaS motion (see `MONETIZATION.md` for the generic mechanism): `enterprise`
and `platform` tiers are priced for pharma/payer-scale annual contracts with a named account team,
`growth`/`starter` serve individual hospitals and academic groups on self-serve or light-touch sales, and
`professional_services` line items (implementation, connector development, custom NLP model tuning) are
tracked as one-off invoiced engagements in the same `subscription` data model via a `service_engagement`
record type.
