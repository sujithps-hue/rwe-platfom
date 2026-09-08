-- Real OHDSI OMOP Common Data Model v5.4 Standardized Vocabulary tables, as one shared
-- `omop_vocabulary` Postgres schema. Applied ONCE per Postgres cluster (i.e. once per regional
-- stack in infra/terraform), NOT per tenant — vocabulary/terminology reference data (SNOMED CT,
-- RxNorm, LOINC, and OMOP's own Gender/Race/Ethnicity/Visit vocabularies) is public reference
-- data, not PHI/PII, so there is no compliance reason to duplicate it per tenant, and every
-- tenant schema in the cluster references it read-only via cross-schema foreign keys. A
-- dedicated-instance tenant (docs/MULTI_TENANCY.md's isolation tiers) gets its own copy of this
-- schema in its own instance, applied the same way.
--
-- Table shapes here match the published OMOP CDM v5.4 specification
-- (https://ohdsi.github.io/CommonDataModel/cdm54.html#Standardized_Vocabularies) — this repo does
-- not ship the actual vocabulary content (that's a ~10M-row dataset requiring a free UMLS license,
-- distributed by OHDSI at https://athena.ohdsi.org). See omop_vocabulary_seed.sql for a small
-- bootstrap set and docs/OMOP_VOCABULARY.md for how to load the real release.
--
-- Foreign keys among these tables are intentionally NOT created here — apply
-- omop_vocabulary_constraints.sql only after the tables are populated (this file's seed, or a
-- real Athena load). This matches OHDSI's own documented load order: concept/domain/vocabulary/
-- concept_class have a circular reference (concept.domain_id -> domain, domain.domain_concept_id
-- -> concept) that is easiest to bootstrap by loading data first and constraining afterward,
-- which is also how the official Athena-distributed DDL/load scripts are structured.

CREATE SCHEMA IF NOT EXISTS omop_vocabulary;

CREATE TABLE IF NOT EXISTS omop_vocabulary.concept (
  concept_id        INTEGER PRIMARY KEY,
  concept_name      VARCHAR(255) NOT NULL,
  domain_id         VARCHAR(20)  NOT NULL,
  vocabulary_id     VARCHAR(20)  NOT NULL,
  concept_class_id  VARCHAR(20)  NOT NULL,
  standard_concept  VARCHAR(1),        -- 'S' = Standard, 'C' = Classification, NULL = non-standard
  concept_code      VARCHAR(50)  NOT NULL,
  valid_start_date  DATE         NOT NULL,
  valid_end_date    DATE         NOT NULL,
  invalid_reason    VARCHAR(1)         -- 'D' = deleted, 'U' = updated (replaced), NULL = valid
);
CREATE INDEX IF NOT EXISTS idx_concept_code ON omop_vocabulary.concept (vocabulary_id, concept_code);
CREATE INDEX IF NOT EXISTS idx_concept_domain ON omop_vocabulary.concept (domain_id);

CREATE TABLE IF NOT EXISTS omop_vocabulary.vocabulary (
  vocabulary_id         VARCHAR(20) PRIMARY KEY,
  vocabulary_name       VARCHAR(255) NOT NULL,
  vocabulary_reference  VARCHAR(255),
  vocabulary_version    VARCHAR(255),
  vocabulary_concept_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS omop_vocabulary.domain (
  domain_id         VARCHAR(20) PRIMARY KEY,
  domain_name       VARCHAR(255) NOT NULL,
  domain_concept_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS omop_vocabulary.concept_class (
  concept_class_id         VARCHAR(20) PRIMARY KEY,
  concept_class_name       VARCHAR(255) NOT NULL,
  concept_class_concept_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS omop_vocabulary.relationship (
  relationship_id          VARCHAR(20) PRIMARY KEY,
  relationship_name        VARCHAR(255) NOT NULL,
  is_hierarchical          VARCHAR(1)  NOT NULL DEFAULT '0',
  defines_ancestry         VARCHAR(1)  NOT NULL DEFAULT '0',
  reverse_relationship_id  VARCHAR(20) NOT NULL,
  relationship_concept_id  INTEGER NOT NULL
);

-- The mapping backbone: relates a source/non-standard concept to a standard one (relationship_id
-- = 'Maps to') among many other relationship types (e.g. 'Subsumes', 'Is a'). ConceptMapper
-- (apps/api/src/common/concept-mapper.ts) walks 'Maps to' edges to standardize a code.
CREATE TABLE IF NOT EXISTS omop_vocabulary.concept_relationship (
  concept_id_1      INTEGER     NOT NULL,
  concept_id_2      INTEGER     NOT NULL,
  relationship_id   VARCHAR(20) NOT NULL,
  valid_start_date  DATE        NOT NULL,
  valid_end_date    DATE        NOT NULL,
  invalid_reason    VARCHAR(1),
  PRIMARY KEY (concept_id_1, concept_id_2, relationship_id)
);
CREATE INDEX IF NOT EXISTS idx_concept_relationship_id_1 ON omop_vocabulary.concept_relationship (concept_id_1, relationship_id);

CREATE TABLE IF NOT EXISTS omop_vocabulary.concept_synonym (
  concept_id           INTEGER      NOT NULL,
  concept_synonym_name VARCHAR(1000) NOT NULL,
  language_concept_id  INTEGER      NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_concept_synonym_concept_id ON omop_vocabulary.concept_synonym (concept_id);

-- Precomputed hierarchy closure (all ancestor/descendant pairs, not just direct parent/child) —
-- lets a cohort criterion like "essential hypertension and all its more specific descendant
-- concepts" run as a single indexed join instead of a recursive query. This is exactly how
-- OHDSI's ATLAS cohort-definition tool implements "include descendants."
CREATE TABLE IF NOT EXISTS omop_vocabulary.concept_ancestor (
  ancestor_concept_id       INTEGER NOT NULL,
  descendant_concept_id     INTEGER NOT NULL,
  min_levels_of_separation  INTEGER NOT NULL,
  max_levels_of_separation  INTEGER NOT NULL,
  PRIMARY KEY (ancestor_concept_id, descendant_concept_id)
);
CREATE INDEX IF NOT EXISTS idx_concept_ancestor_descendant ON omop_vocabulary.concept_ancestor (descendant_concept_id);

CREATE TABLE IF NOT EXISTS omop_vocabulary.drug_strength (
  drug_concept_id             INTEGER NOT NULL,
  ingredient_concept_id       INTEGER NOT NULL,
  amount_value                NUMERIC,
  amount_unit_concept_id      INTEGER,
  numerator_value             NUMERIC,
  numerator_unit_concept_id   INTEGER,
  denominator_value           NUMERIC,
  denominator_unit_concept_id INTEGER,
  box_size                    INTEGER,
  valid_start_date            DATE NOT NULL,
  valid_end_date              DATE NOT NULL,
  invalid_reason              VARCHAR(1),
  PRIMARY KEY (drug_concept_id, ingredient_concept_id)
);

-- The other half of the mapping backbone: translates a *raw, local* source value (a code that
-- isn't itself drawn from a standard vocabulary — e.g. a site-specific lab test code, or a raw
-- "male"/"M"/"Male" gender string from an inbound HL7/FHIR feed) into a target concept, without
-- needing that raw value to exist in `concept` at all. ConceptMapper.resolveViaSourceMap() reads
-- this table; docs/OMOP_VOCABULARY.md documents populating it per source system, matching how
-- OHDSI's Usagi tool is normally used to generate these mappings.
CREATE TABLE IF NOT EXISTS omop_vocabulary.source_to_concept_map (
  source_code             VARCHAR(50)  NOT NULL,
  source_concept_id       INTEGER      NOT NULL DEFAULT 0,
  source_vocabulary_id    VARCHAR(20)  NOT NULL,
  source_code_description VARCHAR(255),
  target_concept_id       INTEGER      NOT NULL,
  target_vocabulary_id    VARCHAR(20)  NOT NULL,
  valid_start_date        DATE         NOT NULL,
  valid_end_date          DATE         NOT NULL,
  invalid_reason          VARCHAR(1)
);
CREATE INDEX IF NOT EXISTS idx_source_to_concept_map_lookup
  ON omop_vocabulary.source_to_concept_map (source_vocabulary_id, source_code);

-- Foreign keys are applied separately — see omop_vocabulary_constraints.sql, run after this file
-- and after omop_vocabulary_seed.sql (or a real Athena load).
