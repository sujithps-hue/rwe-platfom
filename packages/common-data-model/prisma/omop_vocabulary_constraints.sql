-- Foreign key constraints for the omop_vocabulary schema (omop_vocabulary_schema.sql). Apply
-- this AFTER the vocabulary tables are populated — either omop_vocabulary_seed.sql for local
-- dev/demo, or a real Athena vocabulary load for production (docs/OMOP_VOCABULARY.md) — never
-- before, because concept/domain/vocabulary/concept_class reference each other circularly and
-- bulk-loading is also dramatically faster without constraints/indexes in the way. This is the
-- same load order OHDSI's own distributed DDL scripts use.

ALTER TABLE omop_vocabulary.concept
  ADD CONSTRAINT fk_concept_domain FOREIGN KEY (domain_id) REFERENCES omop_vocabulary.domain (domain_id),
  ADD CONSTRAINT fk_concept_vocabulary FOREIGN KEY (vocabulary_id) REFERENCES omop_vocabulary.vocabulary (vocabulary_id),
  ADD CONSTRAINT fk_concept_class FOREIGN KEY (concept_class_id) REFERENCES omop_vocabulary.concept_class (concept_class_id);

ALTER TABLE omop_vocabulary.vocabulary
  ADD CONSTRAINT fk_vocabulary_concept FOREIGN KEY (vocabulary_concept_id) REFERENCES omop_vocabulary.concept (concept_id);

ALTER TABLE omop_vocabulary.domain
  ADD CONSTRAINT fk_domain_concept FOREIGN KEY (domain_concept_id) REFERENCES omop_vocabulary.concept (concept_id);

ALTER TABLE omop_vocabulary.concept_class
  ADD CONSTRAINT fk_concept_class_concept FOREIGN KEY (concept_class_concept_id) REFERENCES omop_vocabulary.concept (concept_id);

ALTER TABLE omop_vocabulary.relationship
  ADD CONSTRAINT fk_relationship_concept FOREIGN KEY (relationship_concept_id) REFERENCES omop_vocabulary.concept (concept_id),
  ADD CONSTRAINT fk_relationship_reverse FOREIGN KEY (reverse_relationship_id) REFERENCES omop_vocabulary.relationship (relationship_id);

ALTER TABLE omop_vocabulary.concept_relationship
  ADD CONSTRAINT fk_concept_relationship_1 FOREIGN KEY (concept_id_1) REFERENCES omop_vocabulary.concept (concept_id),
  ADD CONSTRAINT fk_concept_relationship_2 FOREIGN KEY (concept_id_2) REFERENCES omop_vocabulary.concept (concept_id),
  ADD CONSTRAINT fk_concept_relationship_rel FOREIGN KEY (relationship_id) REFERENCES omop_vocabulary.relationship (relationship_id);

ALTER TABLE omop_vocabulary.concept_synonym
  ADD CONSTRAINT fk_concept_synonym_concept FOREIGN KEY (concept_id) REFERENCES omop_vocabulary.concept (concept_id),
  ADD CONSTRAINT fk_concept_synonym_lang FOREIGN KEY (language_concept_id) REFERENCES omop_vocabulary.concept (concept_id);

ALTER TABLE omop_vocabulary.concept_ancestor
  ADD CONSTRAINT fk_concept_ancestor_anc FOREIGN KEY (ancestor_concept_id) REFERENCES omop_vocabulary.concept (concept_id),
  ADD CONSTRAINT fk_concept_ancestor_desc FOREIGN KEY (descendant_concept_id) REFERENCES omop_vocabulary.concept (concept_id);

ALTER TABLE omop_vocabulary.drug_strength
  ADD CONSTRAINT fk_drug_strength_drug FOREIGN KEY (drug_concept_id) REFERENCES omop_vocabulary.concept (concept_id),
  ADD CONSTRAINT fk_drug_strength_ingredient FOREIGN KEY (ingredient_concept_id) REFERENCES omop_vocabulary.concept (concept_id);

ALTER TABLE omop_vocabulary.source_to_concept_map
  ADD CONSTRAINT fk_stcm_target FOREIGN KEY (target_concept_id) REFERENCES omop_vocabulary.concept (concept_id);
