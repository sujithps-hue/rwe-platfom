# OMOP Standardized Vocabulary & concept mapping

The platform's clinical tables (`packages/common-data-model/prisma/tenant_schema_template.sql`)
follow the real OMOP CDM v5.4 convention: every clinical fact is stored against a standard
**concept_id**, not a raw source code, so a cohort query filtering on `condition_concept_id = X`
matches that clinical fact regardless of which connector — or which EHR's own coding system —
produced it. This document covers the vocabulary schema itself, how source codes get mapped to
standard concepts, and what a production deployment still needs to do that this repo can't do for
it (load the real OHDSI vocabulary content).

## The vocabulary tables

`packages/common-data-model/prisma/omop_vocabulary_schema.sql` creates a shared `omop_vocabulary`
Postgres schema with the real OMOP CDM v5.4 Standardized Vocabulary tables:

| Table | Purpose |
|---|---|
| `concept` | Every concept (SNOMED CT condition, RxNorm drug, LOINC lab test, OMOP's own Gender/Race/Ethnicity/Visit vocabularies, ...), keyed by a stable integer `concept_id`. |
| `vocabulary`, `domain`, `concept_class` | Metadata describing what a concept *is* (which coding system, which clinical domain, what kind of thing). |
| `relationship`, `concept_relationship` | Relationships between concepts — most importantly `'Maps to'`, which is how a non-standard/source concept is linked to its standard equivalent. |
| `concept_synonym` | Alternate names for a concept (used by vocabulary search). |
| `concept_ancestor` | Precomputed hierarchy closure — "all descendants of Essential Hypertension," etc. — used by the Cohort Builder's "include descendants" option. |
| `drug_strength` | Ingredient/strength data for RxNorm drug concepts. |
| `source_to_concept_map` | Maps a *raw, local* source value (one that was never itself a standard-vocabulary code — a gender string, a site-specific lab code) to a target concept. |

This is **shared once per Postgres cluster**, not duplicated per tenant: SNOMED/RxNorm/LOINC and
OMOP's own vocabularies are public terminology standards, not PHI/PII, so there's no compliance
reason to pay the storage/load cost of copying a multi-million-row reference dataset into every
tenant schema. Every tenant schema's clinical tables reference `omop_vocabulary.concept` via
cross-schema foreign keys. A dedicated-instance tenant (docs/MULTI_TENANCY.md's isolation tiers)
gets its own copy of this schema in its own database instance, loaded the same way.

Foreign keys among the vocabulary tables themselves are applied separately
(`omop_vocabulary_constraints.sql`), **after** the tables are populated — `concept`, `domain`,
`vocabulary`, and `concept_class` reference each other circularly, and bulk-loading is dramatically
faster without constraints/indexes in the way. This matches how OHDSI's own distributed load
scripts are structured.

## What's actually seeded in this repo — and what isn't

`omop_vocabulary_seed.sql` ships a **minimal bootstrap set**, not the real vocabulary:

- The real, standard OMOP concepts for `0` ("No matching concept" — a reserved sentinel every
  OMOP database has), `8507`/`8532` (Gender: MALE/FEMALE), and `9201`/`9202`/`9203` (Visit type:
  Inpatient/Outpatient/Emergency Room). These are stable, extremely widely-cited OHDSI constants.
- `source_to_concept_map` rows translating the raw gender strings and visit-type strings the
  reference connectors actually emit (`male`/`Male`/`MALE`/`M`, `inpatient`/`outpatient`/...) to
  those standard concepts.
- One placeholder concept (`2000000001`, "Telehealth Visit") in OMOP's own reserved
  "locally-assigned concept" range (`>= 2,000,000,000`) — used because this repo isn't confident
  the official vocabulary's Telehealth Visit concept has a specific id, and would rather be
  explicit about that than assert one.
- Minimal `domain`/`vocabulary`/`concept_class`/`relationship` metadata rows needed for the above
  to satisfy foreign keys. These are this platform's own bootstrap scaffolding — internally
  consistent, but not asserted to match the official vocabulary's metadata rows, which get
  superseded once the real vocabulary is loaded.

**Everything else — every real SNOMED condition code, RxNorm drug code, and LOINC lab code — is
intentionally not seeded.** Until the real vocabulary is loaded, `ConceptMapper` will correctly
resolve any condition/drug/measurement source code to `concept_id = 0` ("No matching concept").
That is expected, not a bug: it's exactly what a real OMOP ETL pipeline does against an incomplete
vocabulary, and it's a safer default than fabricating plausible-looking concept_ids that might not
match what the official vocabulary actually assigns.

## Loading the real vocabulary

1. Register for a free UMLS Metathesaurus license and download the Standardized Vocabularies from
   [Athena](https://athena.ohdsi.org) (select at minimum SNOMED, RxNorm, RxNorm Extension, and
   LOINC).
2. The download is a set of tab-delimited files (`CONCEPT.csv`, `VOCABULARY.csv`, `DOMAIN.csv`,
   `CONCEPT_CLASS.csv`, `RELATIONSHIP.csv`, `CONCEPT_RELATIONSHIP.csv`, `CONCEPT_SYNONYM.csv`,
   `CONCEPT_ANCESTOR.csv`, `DRUG_STRENGTH.csv`) whose columns match this schema's tables directly.
3. Apply `omop_vocabulary_schema.sql`, then bulk-load each file with `\copy` (or Postgres `COPY`
   from a location the server can read), e.g.:
   ```sql
   \copy omop_vocabulary.concept FROM 'CONCEPT.csv' WITH (FORMAT csv, DELIMITER E'\t', HEADER true, QUOTE E'\b');
   ```
4. Apply `omop_vocabulary_constraints.sql` **after** all files are loaded.
5. Populate `source_to_concept_map` for any of your connected EHRs' truly local/non-standard
   codes (site-specific lab codes, a legacy problem list vocabulary) — this is normally generated
   with OHDSI's [Usagi](https://github.com/OHDSI/Usagi) tool, which suggests candidate standard
   concepts for a list of source codes/descriptions and lets a reviewer confirm each mapping.

This is a one-time, per-cluster operation — see `infra/README.md` for where it fits into standing
up a new regional stack.

## How ConceptMapper resolves a code

`apps/api/src/common/concept-mapper.ts` — called from `TenantCdmWriter` and
`TenantEnrichmentStore` at write time, never by connectors themselves (docs/CONNECTORS.md):

- **`resolveByStandardCode(vocabularyId, code)`** — for codes a connector already emits in a
  standard vocabulary (SNOMED conditions, RxNorm drugs, LOINC measurements): look the code up
  directly in `concept`. If it's already a standard concept (`standard_concept = 'S'`), use it
  as-is. Otherwise, follow the `'Maps to'` relationship in `concept_relationship` to find the
  standard target. Falls back to `concept_id = 0` if nothing matches.
- **`resolveViaSourceMap(sourceVocabularyId, sourceCode)`** — for raw/local values that were never
  a standard vocabulary code to begin with (a gender string, this platform's own
  `inpatient`/`outpatient`/`emergency`/`telehealth` visit-type strings): look up
  `source_to_concept_map`, which exists for exactly this purpose.

Both are cached per-instance for the lifetime of a sync/enrichment run, since vocabulary content
doesn't change mid-batch.

## Querying by concept_id

The Cohort Builder (`apps/api/src/analytics/cohort-builder.service.ts`,
`apps/web/src/app/analytics`) filters `has_condition`/`has_drug_exposure` criteria on
`condition_concept_id`/`drug_concept_id` directly, with an optional "include descendants" flag
that joins `omop_vocabulary.concept_ancestor` — the same "include descendants" behavior OHDSI's
ATLAS cohort-definition tool offers, so a criterion like "Essential Hypertension" can optionally
also match every more specific hypertension subtype below it in the SNOMED hierarchy without the
caller enumerating every descendant concept_id by hand. The concept search endpoint
(`GET /vocabulary/concepts/search`, wired into a `ConceptPicker` search box in the web UI) is how
a user finds the right concept_id in the first place, rather than needing to already know it.
