-- Per-tenant clinical data schema template — a simplified OMOP CDM v5.4 clinical-tables layout,
-- standardized against the real OMOP Standardized Vocabularies (omop_vocabulary_schema.sql,
-- shared once per Postgres cluster — see that file's header for why it isn't per-tenant).
--
-- `TenantsModule.provision()` (apps/api/src/tenants) renders this template with
-- `{{schema_name}}` replaced by the tenant's dedicated schema name (e.g. "tenant_acme") and
-- executes it once, at tenant creation, giving every tenant physically separate clinical tables —
-- the first of the two isolation layers described in docs/MULTI_TENANCY.md. The `omop_vocabulary`
-- schema this template's foreign keys reference must already exist in the same database (apply
-- omop_vocabulary_schema.sql + omop_vocabulary_seed.sql or a real Athena load, then
-- omop_vocabulary_constraints.sql, once per cluster before provisioning any tenant).
--
-- Every clinical field follows the real OMOP CDM convention of three companion columns:
--   <field>_concept_id        -- the STANDARD concept (FK to omop_vocabulary.concept), resolved
--                                 at write time by apps/api/src/common/concept-mapper.ts — never
--                                 written directly by a connector.
--   <field>_source_value      -- the raw code/string exactly as the connector received it.
--   <field>_source_concept_id -- the concept matching the raw source value *before* mapping to a
--                                 standard concept, when that raw value is itself in a known
--                                 vocabulary (nullable — many source values aren't).
-- This is what makes the platform's cohort queries and analytics connector-agnostic: a query
-- filters on <field>_concept_id once, and it matches the same clinical fact regardless of which
-- connector's own source coding produced it. See docs/OMOP_VOCABULARY.md.

CREATE SCHEMA IF NOT EXISTS "{{schema_name}}";

CREATE TABLE "{{schema_name}}".person (
  person_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_patient_id     TEXT NOT NULL, -- the connector's native patient identifier (already pseudonymized/tokenized before landing here for tenants under a pseudonymization policy)
  gender_concept_id     INTEGER NOT NULL DEFAULT 0 REFERENCES omop_vocabulary.concept (concept_id),
  gender_source_value   TEXT,
  year_of_birth         INT,
  race_concept_id       INTEGER NOT NULL DEFAULT 0 REFERENCES omop_vocabulary.concept (concept_id),
  race_source_value     TEXT,
  ethnicity_concept_id  INTEGER NOT NULL DEFAULT 0 REFERENCES omop_vocabulary.concept (concept_id),
  ethnicity_source_value TEXT,
  location_region       TEXT,
  source_connector_id   UUID NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON "{{schema_name}}".person (source_connector_id, source_patient_id);

CREATE TABLE "{{schema_name}}".visit_occurrence (
  visit_occurrence_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id            UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  visit_concept_id     INTEGER NOT NULL DEFAULT 0 REFERENCES omop_vocabulary.concept (concept_id), -- standard: 9201 Inpatient, 9202 Outpatient, 9203 Emergency
  visit_source_value   TEXT, -- the connector's own visitConcept string (inpatient|outpatient|emergency|telehealth) before mapping
  visit_start_date     DATE NOT NULL,
  visit_end_date       DATE,
  care_site            TEXT,
  source_connector_id  UUID NOT NULL
);
CREATE INDEX ON "{{schema_name}}".visit_occurrence (person_id);
CREATE INDEX ON "{{schema_name}}".visit_occurrence (visit_concept_id);

CREATE TABLE "{{schema_name}}".condition_occurrence (
  condition_occurrence_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id                   UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  visit_occurrence_id         UUID REFERENCES "{{schema_name}}".visit_occurrence(visit_occurrence_id),
  condition_concept_id        INTEGER NOT NULL DEFAULT 0 REFERENCES omop_vocabulary.concept (concept_id), -- standard SNOMED concept
  condition_source_value      TEXT NOT NULL, -- raw code as submitted by the connector (usually already SNOMED)
  condition_source_concept_id INTEGER REFERENCES omop_vocabulary.concept (concept_id),
  condition_start_date        DATE NOT NULL,
  condition_end_date          DATE,
  source_connector_id         UUID NOT NULL
);
CREATE INDEX ON "{{schema_name}}".condition_occurrence (person_id);
CREATE INDEX ON "{{schema_name}}".condition_occurrence (condition_concept_id);

CREATE TABLE "{{schema_name}}".drug_exposure (
  drug_exposure_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id               UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  visit_occurrence_id     UUID REFERENCES "{{schema_name}}".visit_occurrence(visit_occurrence_id),
  drug_concept_id         INTEGER NOT NULL DEFAULT 0 REFERENCES omop_vocabulary.concept (concept_id), -- standard RxNorm concept
  drug_source_value       TEXT NOT NULL, -- raw code as submitted by the connector (usually already RxNorm)
  drug_source_concept_id  INTEGER REFERENCES omop_vocabulary.concept (concept_id),
  exposure_start_date     DATE NOT NULL,
  exposure_end_date       DATE,
  dose                    TEXT,
  source_connector_id     UUID NOT NULL
);
CREATE INDEX ON "{{schema_name}}".drug_exposure (person_id);
CREATE INDEX ON "{{schema_name}}".drug_exposure (drug_concept_id);

CREATE TABLE "{{schema_name}}".measurement (
  measurement_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id                    UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  visit_occurrence_id          UUID REFERENCES "{{schema_name}}".visit_occurrence(visit_occurrence_id),
  measurement_concept_id       INTEGER NOT NULL DEFAULT 0 REFERENCES omop_vocabulary.concept (concept_id), -- standard LOINC concept
  measurement_source_value     TEXT NOT NULL, -- raw code as submitted by the connector (usually already LOINC)
  measurement_source_concept_id INTEGER REFERENCES omop_vocabulary.concept (concept_id),
  measurement_date             DATE NOT NULL,
  value_numeric                NUMERIC,
  unit_concept_id               INTEGER REFERENCES omop_vocabulary.concept (concept_id),
  unit_source_value             TEXT,
  source_connector_id          UUID NOT NULL
);
CREATE INDEX ON "{{schema_name}}".measurement (person_id);
CREATE INDEX ON "{{schema_name}}".measurement (measurement_concept_id);

CREATE TABLE "{{schema_name}}".observation (
  observation_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id                    UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  visit_occurrence_id          UUID REFERENCES "{{schema_name}}".visit_occurrence(visit_occurrence_id),
  observation_concept_id       INTEGER NOT NULL DEFAULT 0 REFERENCES omop_vocabulary.concept (concept_id),
  observation_source_value     TEXT,
  observation_date             DATE NOT NULL,
  value_as_string              TEXT,
  source_connector_id          UUID NOT NULL
);
CREATE INDEX ON "{{schema_name}}".observation (person_id);

-- Free-text clinical notes, source material for packages/nlp-enrichment.
CREATE TABLE "{{schema_name}}".clinical_note (
  clinical_note_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id            UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  visit_occurrence_id  UUID REFERENCES "{{schema_name}}".visit_occurrence(visit_occurrence_id),
  note_date            DATE NOT NULL,
  note_type            TEXT, -- progress_note | discharge_summary | psych_eval, etc.
  note_text            TEXT NOT NULL,
  source_connector_id  UUID NOT NULL,
  enrichment_status    TEXT NOT NULL DEFAULT 'pending' -- pending | enriched | failed
);
CREATE INDEX ON "{{schema_name}}".clinical_note (person_id);
CREATE INDEX ON "{{schema_name}}".clinical_note (enrichment_status);

-- Structured concepts extracted from clinical_note.note_text by packages/nlp-enrichment,
-- queryable by the Cohort Builder exactly like any structured field. `concept_code`/`concept_name`
-- (the SNOMED code/display text packages/nlp-enrichment's terminology emits) are kept as the
-- primary matching key since SNOMED CT is itself the OMOP-standard vocabulary for the Condition/
-- Observation domains; `concept_id` is additionally resolved for cross-vocabulary joins and
-- consistency with the rest of the schema.
CREATE TABLE "{{schema_name}}".nlp_extracted_concept (
  nlp_extracted_concept_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinical_note_id         UUID NOT NULL REFERENCES "{{schema_name}}".clinical_note(clinical_note_id),
  person_id                UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  concept_id                INTEGER NOT NULL DEFAULT 0 REFERENCES omop_vocabulary.concept (concept_id),
  concept_code              TEXT NOT NULL, -- SNOMED CT code, as emitted by the enrichment pipeline
  concept_name              TEXT NOT NULL,
  polarity                  TEXT NOT NULL DEFAULT 'positive', -- positive | negated | hypothetical | family_history
  severity                  TEXT, -- mild | moderate | severe, when extractable
  confidence                NUMERIC,
  extracted_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  pipeline_id               TEXT NOT NULL -- identifies which EnrichmentPipeline implementation produced this row
);
CREATE INDEX ON "{{schema_name}}".nlp_extracted_concept (person_id);
CREATE INDEX ON "{{schema_name}}".nlp_extracted_concept (concept_code);
CREATE INDEX ON "{{schema_name}}".nlp_extracted_concept (concept_id);

-- Predictive-model outputs (packages/predictive-models), surfaced to clinicians in the Care
-- Management module. Scores are recomputed per tenant, on that tenant's own data only.
CREATE TABLE "{{schema_name}}".risk_score (
  risk_score_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id            UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  model_id             TEXT NOT NULL, -- e.g. "readmission-risk-v1", "relapse-risk-v1"
  score                NUMERIC NOT NULL,
  score_band           TEXT NOT NULL, -- low | medium | high
  computed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  explanation          JSONB -- top contributing features, for clinician-facing transparency
);
CREATE INDEX ON "{{schema_name}}".risk_score (person_id);
CREATE INDEX ON "{{schema_name}}".risk_score (model_id, computed_at);
