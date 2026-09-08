import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface ConceptSearchResult {
  conceptId: number;
  conceptName: string;
  domainId: string;
  vocabularyId: string;
  conceptClassId: string;
  standardConcept: string | null;
  conceptCode: string;
}

/**
 * Backs the Cohort Builder's concept search (apps/web's analytics page) — the same role OHDSI's
 * ATLAS "concept set" search box plays: find a concept_id by name or code without needing to know
 * it up front or query the database directly. Reference-data only (no tenant scoping needed —
 * `omop_vocabulary` is shared across the cluster, see its schema file's header comment).
 */
@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, opts: { domainId?: string; vocabularyId?: string; limit?: number } = {}): Promise<ConceptSearchResult[]> {
    const limit = Math.min(opts.limit ?? 20, 100);
    const rows = await this.prisma.$queryRaw<
      {
        concept_id: number;
        concept_name: string;
        domain_id: string;
        vocabulary_id: string;
        concept_class_id: string;
        standard_concept: string | null;
        concept_code: string;
      }[]
    >`
      SELECT concept_id, concept_name, domain_id, vocabulary_id, concept_class_id, standard_concept, concept_code
      FROM omop_vocabulary.concept
      WHERE invalid_reason IS NULL
        AND (concept_name ILIKE ${'%' + query + '%'} OR concept_code = ${query})
        AND (${opts.domainId ?? null}::text IS NULL OR domain_id = ${opts.domainId ?? null})
        AND (${opts.vocabularyId ?? null}::text IS NULL OR vocabulary_id = ${opts.vocabularyId ?? null})
      ORDER BY (concept_code = ${query}) DESC, concept_name ASC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      conceptId: r.concept_id,
      conceptName: r.concept_name,
      domainId: r.domain_id,
      vocabularyId: r.vocabulary_id,
      conceptClassId: r.concept_class_id,
      standardConcept: r.standard_concept,
      conceptCode: r.concept_code,
    }));
  }
}
