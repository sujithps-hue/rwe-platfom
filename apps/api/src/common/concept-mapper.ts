import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export const NO_MATCHING_CONCEPT_ID = 0;

export interface ResolvedConcept {
  /** The standard concept to filter/aggregate on. Falls back to 0 ("No matching concept") when nothing resolves. */
  conceptId: number;
  /** The concept matching the raw source value before standardization, when the source value itself was found in `concept`. Null when unresolved or resolved only via source_to_concept_map. */
  sourceConceptId: number | null;
}

/**
 * Resolves raw source codes to standard OMOP concepts — the actual "T" (standardize) step of an
 * OMOP ETL pipeline, sitting between a connector's extract+shape output and
 * `TenantCdmWriter`/`TenantEnrichmentStore` persisting into the tenant's CDM schema. Two
 * resolution strategies, matching how real OMOP ETL tooling (OHDSI's Usagi/Rabbit-in-a-Hat) is
 * normally used:
 *
 * - `resolveByStandardCode` — for codes that are already drawn from a standard vocabulary (a
 *   connector emitting real SNOMED/RxNorm/LOINC codes): look the code up directly in `concept`,
 *   then follow the 'Maps to' relationship if it isn't itself a standard concept.
 * - `resolveViaSourceMap` — for raw, local, or free-text source values that were never SNOMED/
 *   RxNorm/LOINC codes to begin with (a "male"/"M"/"Male" gender string, this platform's own
 *   `inpatient`/`outpatient`/... visit-type strings): look up `source_to_concept_map`, which is
 *   built for exactly this purpose.
 *
 * Every method is safe to call against an empty/bootstrap vocabulary (docs/OMOP_VOCABULARY.md) —
 * an unresolvable code correctly falls back to concept_id 0, matching real OMOP ETL behavior
 * rather than throwing, since "we don't have a standard mapping for this yet" is an expected,
 * common state, not an error.
 */
@Injectable()
export class ConceptMapper {
  // Per-instance cache — safe because vocabulary content doesn't change during a request/sync
  // batch's lifetime. Swap for a shared (e.g. Redis) cache if concept resolution volume grows
  // beyond a single-process cache's useful lifetime.
  private readonly cache = new Map<string, ResolvedConcept>();

  constructor(private readonly prisma: PrismaService) {}

  async resolveByStandardCode(vocabularyId: string, code: string): Promise<ResolvedConcept> {
    const cacheKey = `code:${vocabularyId}:${code}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.$queryRaw<{ concept_id: number; standard_concept: string | null }[]>`
      SELECT concept_id, standard_concept
      FROM omop_vocabulary.concept
      WHERE vocabulary_id = ${vocabularyId} AND concept_code = ${code} AND invalid_reason IS NULL
      LIMIT 1
    `;

    if (rows.length === 0) {
      const result = { conceptId: NO_MATCHING_CONCEPT_ID, sourceConceptId: null };
      this.cache.set(cacheKey, result);
      return result;
    }

    const { concept_id: sourceConceptId, standard_concept: standardFlag } = rows[0];

    if (standardFlag === 'S') {
      const result = { conceptId: sourceConceptId, sourceConceptId };
      this.cache.set(cacheKey, result);
      return result;
    }

    // Not itself a standard concept — follow 'Maps to' to find the standard target.
    const mapped = await this.prisma.$queryRaw<{ concept_id_2: number }[]>`
      SELECT concept_id_2
      FROM omop_vocabulary.concept_relationship
      WHERE concept_id_1 = ${sourceConceptId} AND relationship_id = 'Maps to' AND invalid_reason IS NULL
      LIMIT 1
    `;

    const result: ResolvedConcept = {
      conceptId: mapped[0]?.concept_id_2 ?? NO_MATCHING_CONCEPT_ID,
      sourceConceptId,
    };
    this.cache.set(cacheKey, result);
    return result;
  }

  async resolveViaSourceMap(sourceVocabularyId: string, sourceCode: string): Promise<ResolvedConcept> {
    const cacheKey = `map:${sourceVocabularyId}:${sourceCode}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.$queryRaw<{ target_concept_id: number; source_concept_id: number }[]>`
      SELECT target_concept_id, source_concept_id
      FROM omop_vocabulary.source_to_concept_map
      WHERE source_vocabulary_id = ${sourceVocabularyId} AND source_code = ${sourceCode} AND invalid_reason IS NULL
      LIMIT 1
    `;

    const result: ResolvedConcept =
      rows.length > 0
        ? { conceptId: rows[0].target_concept_id, sourceConceptId: rows[0].source_concept_id || null }
        : { conceptId: NO_MATCHING_CONCEPT_ID, sourceConceptId: null };
    this.cache.set(cacheKey, result);
    return result;
  }

  /** Looks up a concept's display name — used to show human-readable labels for a stored concept_id (e.g. in the Care Management patient view). */
  async getConceptName(conceptId: number): Promise<string | null> {
    if (conceptId === NO_MATCHING_CONCEPT_ID) return null;
    const rows = await this.prisma.$queryRaw<{ concept_name: string }[]>`
      SELECT concept_name FROM omop_vocabulary.concept WHERE concept_id = ${conceptId} LIMIT 1
    `;
    return rows[0]?.concept_name ?? null;
  }
}
