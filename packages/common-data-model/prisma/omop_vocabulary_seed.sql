-- Minimal bootstrap content for the omop_vocabulary schema — enough for local dev/CI and for the
-- reference connectors' Gender/Visit fields to resolve to real, standard OMOP concepts end to
-- end. THIS IS NOT THE REAL OHDSI VOCABULARY. The real one is a ~10M-row release covering SNOMED
-- CT, RxNorm, LOINC, and everything else, distributed by OHDSI at https://athena.ohdsi.org (free
-- registration, UMLS license required) — see docs/OMOP_VOCABULARY.md for how to load it into this
-- same schema. Until that's done, any condition/drug/measurement source code this platform sees
-- will correctly resolve to concept_id 0 ("No matching concept") — that is expected, not a bug:
-- it's exactly what a real OMOP ETL does against an incomplete vocabulary.
--
-- Accuracy note on what's seeded below: concept_id 0, 8507, 8532, 9201, 9202, and 9203 are the
-- real, standard OMOP concepts for "No matching concept", Gender (MALE/FEMALE), and Visit type
-- (Inpatient/Outpatient/Emergency Room) respectively — these are stable, extremely widely-cited
-- OHDSI constants. Everything else here (domain/vocabulary/concept_class/relationship rows, and
-- the one placeholder Telehealth visit concept) is this platform's own minimal bootstrap
-- scaffolding, using concept_id >= 2,000,000,000 for anything OMOP-reserves for "locally
-- assigned" concepts not yet in the official vocabulary — it is NOT asserted to match whatever
-- id the official vocabulary eventually assigns, and gets superseded once the real vocabulary is
-- loaded.

-- Apply after omop_vocabulary_schema.sql and before omop_vocabulary_constraints.sql.

BEGIN;

INSERT INTO omop_vocabulary.domain (domain_id, domain_name, domain_concept_id) VALUES
  ('Metadata', 'Metadata', 0),
  ('Gender', 'Gender', 0),
  ('Race', 'Race', 0),
  ('Ethnicity', 'Ethnicity', 0),
  ('Visit', 'Visit', 0),
  ('Condition', 'Condition', 0),
  ('Drug', 'Drug', 0),
  ('Measurement', 'Measurement', 0),
  ('Observation', 'Observation', 0)
ON CONFLICT DO NOTHING;

INSERT INTO omop_vocabulary.vocabulary (vocabulary_id, vocabulary_name, vocabulary_reference, vocabulary_version, vocabulary_concept_id) VALUES
  ('None', 'OMOP Standard vocabulary (for concepts with no source vocabulary)', 'OMOP generated', NULL, 0),
  ('Gender', 'OMOP Gender', 'OMOP generated', NULL, 0),
  ('Race', 'Race and Ethnicity Code Set (USBC)', 'OMOP generated', NULL, 0),
  ('Ethnicity', 'OMOP Ethnicity', 'OMOP generated', NULL, 0),
  ('Visit', 'OMOP Visit', 'OMOP generated', NULL, 0),
  ('SNOMED', 'Systematic Nomenclature of Medicine - Clinical Terms (IHTSDO)', 'https://athena.ohdsi.org', NULL, 0),
  ('RxNorm', 'RxNorm (NLM)', 'https://athena.ohdsi.org', NULL, 0),
  ('LOINC', 'Logical Observation Identifiers Names and Codes (Regenstrief Institute)', 'https://athena.ohdsi.org', NULL, 0)
ON CONFLICT DO NOTHING;

INSERT INTO omop_vocabulary.concept_class (concept_class_id, concept_class_name, concept_class_concept_id) VALUES
  ('Undefined', 'Undefined', 0),
  ('Gender', 'Gender', 0),
  ('Visit', 'Visit', 0),
  ('Race', 'Race', 0),
  ('Ethnicity', 'Ethnicity', 0),
  ('Clinical Finding', 'Clinical Finding', 0),
  ('Ingredient', 'Ingredient', 0),
  ('Lab Test', 'Lab Test', 0)
ON CONFLICT DO NOTHING;

INSERT INTO omop_vocabulary.relationship (relationship_id, relationship_name, is_hierarchical, defines_ancestry, reverse_relationship_id, relationship_concept_id) VALUES
  ('Maps to', 'Maps to', '0', '0', 'Mapped from', 0),
  ('Mapped from', 'Mapped from', '0', '0', 'Maps to', 0),
  ('Is a', 'Is a', '1', '1', 'Subsumes', 0),
  ('Subsumes', 'Subsumes', '1', '1', 'Is a', 0)
ON CONFLICT DO NOTHING;

-- concept_id 0 must exist before anything else references it (no FK is enforced yet — see
-- omop_vocabulary_constraints.sql — so insertion order here is for readability, not correctness).
INSERT INTO omop_vocabulary.concept (concept_id, concept_name, domain_id, vocabulary_id, concept_class_id, standard_concept, concept_code, valid_start_date, valid_end_date, invalid_reason) VALUES
  (0, 'No matching concept', 'Metadata', 'None', 'Undefined', NULL, '0', '1970-01-01', '2099-12-31', NULL),

  -- Real, standard OMOP concepts (high-confidence, widely-cited OHDSI constants):
  (8507, 'MALE', 'Gender', 'Gender', 'Gender', 'S', 'M', '1970-01-01', '2099-12-31', NULL),
  (8532, 'FEMALE', 'Gender', 'Gender', 'Gender', 'S', 'F', '1970-01-01', '2099-12-31', NULL),
  (9201, 'Inpatient Visit', 'Visit', 'Visit', 'Visit', 'S', 'IP', '1970-01-01', '2099-12-31', NULL),
  (9202, 'Outpatient Visit', 'Visit', 'Visit', 'Visit', 'S', 'OP', '1970-01-01', '2099-12-31', NULL),
  (9203, 'Emergency Room Visit', 'Visit', 'Visit', 'Visit', 'S', 'ER', '1970-01-01', '2099-12-31', NULL),

  -- Platform-bootstrap placeholder (locally-assigned id range) — not asserted to match the
  -- official vocabulary's eventual Telehealth Visit concept:
  (2000000001, 'Telehealth Visit [bootstrap placeholder]', 'Visit', 'Visit', 'Visit', 'S', 'TELEHEALTH-PLACEHOLDER', '1970-01-01', '2099-12-31', NULL)
ON CONFLICT DO NOTHING;

-- Maps the raw source strings the reference connectors actually emit (packages/connector-fhir,
-- packages/connector-files) to the standard concepts above. ConceptMapper.resolveViaSourceMap()
-- (apps/api/src/common/concept-mapper.ts) reads this table.
INSERT INTO omop_vocabulary.source_to_concept_map (source_code, source_concept_id, source_vocabulary_id, source_code_description, target_concept_id, target_vocabulary_id, valid_start_date, valid_end_date, invalid_reason) VALUES
  -- FHIR AdministrativeGender + common casings a CSV/HL7 feed might send:
  ('male', 0, 'Gender', 'FHIR AdministrativeGender / common source casing', 8507, 'Gender', '1970-01-01', '2099-12-31', NULL),
  ('Male', 0, 'Gender', 'Common source casing', 8507, 'Gender', '1970-01-01', '2099-12-31', NULL),
  ('MALE', 0, 'Gender', 'Common source casing', 8507, 'Gender', '1970-01-01', '2099-12-31', NULL),
  ('M', 0, 'Gender', 'HL7 Table 0001 / generic single-letter code', 8507, 'Gender', '1970-01-01', '2099-12-31', NULL),
  ('female', 0, 'Gender', 'FHIR AdministrativeGender / common source casing', 8532, 'Gender', '1970-01-01', '2099-12-31', NULL),
  ('Female', 0, 'Gender', 'Common source casing', 8532, 'Gender', '1970-01-01', '2099-12-31', NULL),
  ('FEMALE', 0, 'Gender', 'Common source casing', 8532, 'Gender', '1970-01-01', '2099-12-31', NULL),
  ('F', 0, 'Gender', 'HL7 Table 0001 / generic single-letter code', 8532, 'Gender', '1970-01-01', '2099-12-31', NULL),

  -- The 4 literal visitConcept values every reference connector's mapper already normalizes to
  -- (see connector-fhir/src/fhir-mapper.ts and connector-files/src/hl7-mapper.ts):
  ('inpatient', 0, 'Visit', 'RWE Platform connector-normalized visit type', 9201, 'Visit', '1970-01-01', '2099-12-31', NULL),
  ('outpatient', 0, 'Visit', 'RWE Platform connector-normalized visit type', 9202, 'Visit', '1970-01-01', '2099-12-31', NULL),
  ('emergency', 0, 'Visit', 'RWE Platform connector-normalized visit type', 9203, 'Visit', '1970-01-01', '2099-12-31', NULL),
  ('telehealth', 0, 'Visit', 'RWE Platform connector-normalized visit type', 2000000001, 'Visit', '1970-01-01', '2099-12-31', NULL)
ON CONFLICT DO NOTHING;

COMMIT;
