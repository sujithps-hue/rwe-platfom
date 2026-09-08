-- Per-tenant clinical data schema template (OMOP-CDM-inspired, simplified for this platform).
--
-- `TenantsModule.provision()` (apps/api/src/tenants) renders this template with
-- `{{schema_name}}` replaced by the tenant's dedicated schema name (e.g. "tenant_acme") and
-- executes it once, at tenant creation, giving every tenant physically separate clinical tables —
-- the first of the two isolation layers described in docs/MULTI_TENANCY.md.
--
-- Standard vocabularies used: SNOMED CT (conditions), RxNorm (drugs), LOINC (measurements).
-- Connectors (packages/connector-fhir, packages/connector-files) are responsible for mapping
-- source codes into these vocabularies before writing here.

CREATE SCHEMA IF NOT EXISTS "{{schema_name}}";

CREATE TABLE "{{schema_name}}".person (
  person_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_patient_id   TEXT NOT NULL, -- the connector's native patient identifier (already pseudonymized/tokenized before landing here for tenants under a pseudonymization policy)
  gender_concept      TEXT,
  birth_year          INT,
  race_concept        TEXT,
  ethnicity_concept   TEXT,
  location_region     TEXT,
  source_connector_id UUID NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON "{{schema_name}}".person (source_connector_id, source_patient_id);

CREATE TABLE "{{schema_name}}".visit_occurrence (
  visit_occurrence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id           UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  visit_concept       TEXT NOT NULL, -- inpatient | outpatient | emergency | telehealth
  visit_start_date    DATE NOT NULL,
  visit_end_date      DATE,
  care_site           TEXT,
  source_connector_id UUID NOT NULL
);
CREATE INDEX ON "{{schema_name}}".visit_occurrence (person_id);

CREATE TABLE "{{schema_name}}".condition_occurrence (
  condition_occurrence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id               UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  visit_occurrence_id     UUID REFERENCES "{{schema_name}}".visit_occurrence(visit_occurrence_id),
  condition_concept_code  TEXT NOT NULL, -- SNOMED CT code
  condition_concept_name  TEXT,
  condition_start_date    DATE NOT NULL,
  condition_end_date      DATE,
  source_connector_id     UUID NOT NULL
);
CREATE INDEX ON "{{schema_name}}".condition_occurrence (person_id);
CREATE INDEX ON "{{schema_name}}".condition_occurrence (condition_concept_code);

CREATE TABLE "{{schema_name}}".drug_exposure (
  drug_exposure_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id            UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  visit_occurrence_id  UUID REFERENCES "{{schema_name}}".visit_occurrence(visit_occurrence_id),
  drug_concept_code    TEXT NOT NULL, -- RxNorm code
  drug_concept_name    TEXT,
  exposure_start_date  DATE NOT NULL,
  exposure_end_date    DATE,
  dose                 TEXT,
  source_connector_id  UUID NOT NULL
);
CREATE INDEX ON "{{schema_name}}".drug_exposure (person_id);

CREATE TABLE "{{schema_name}}".measurement (
  measurement_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id            UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  visit_occurrence_id  UUID REFERENCES "{{schema_name}}".visit_occurrence(visit_occurrence_id),
  measurement_concept_code TEXT NOT NULL, -- LOINC code
  measurement_concept_name TEXT,
  measurement_date     DATE NOT NULL,
  value_numeric        NUMERIC,
  value_unit           TEXT,
  source_connector_id  UUID NOT NULL
);
CREATE INDEX ON "{{schema_name}}".measurement (person_id);

CREATE TABLE "{{schema_name}}".observation (
  observation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id            UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  visit_occurrence_id  UUID REFERENCES "{{schema_name}}".visit_occurrence(visit_occurrence_id),
  observation_concept_code TEXT,
  observation_date     DATE NOT NULL,
  value_as_string      TEXT,
  source_connector_id  UUID NOT NULL
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
-- queryable by the Cohort Builder exactly like any structured field.
CREATE TABLE "{{schema_name}}".nlp_extracted_concept (
  nlp_extracted_concept_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinical_note_id         UUID NOT NULL REFERENCES "{{schema_name}}".clinical_note(clinical_note_id),
  person_id                UUID NOT NULL REFERENCES "{{schema_name}}".person(person_id),
  concept_code              TEXT NOT NULL, -- SNOMED CT code
  concept_name              TEXT NOT NULL,
  polarity                  TEXT NOT NULL DEFAULT 'positive', -- positive | negated | hypothetical | family_history
  severity                  TEXT, -- mild | moderate | severe, when extractable
  confidence                NUMERIC,
  extracted_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  pipeline_id               TEXT NOT NULL -- identifies which EnrichmentPipeline implementation produced this row
);
CREATE INDEX ON "{{schema_name}}".nlp_extracted_concept (person_id);
CREATE INDEX ON "{{schema_name}}".nlp_extracted_concept (concept_code);

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
