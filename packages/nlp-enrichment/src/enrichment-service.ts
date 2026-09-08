import { ClinicalNote, NlpExtractedConcept } from '@rwe/common-data-model';
import { EnrichmentPipeline } from './types';

export interface EnrichmentStore {
  fetchPendingNotes(tenantId: string, limit: number): Promise<ClinicalNote[]>;
  saveExtractedConcepts(tenantId: string, concepts: NlpExtractedConcept[]): Promise<void>;
  markEnrichmentStatus(tenantId: string, clinicalNoteId: string, status: 'enriched' | 'failed'): Promise<void>;
}

/**
 * Orchestrates enrichment runs: pulls notes with `enrichment_status = 'pending'` for a tenant
 * (written there by any connector that produced a `ClinicalNote`), runs the tenant's configured
 * `EnrichmentPipeline`, and persists the resulting `NlpExtractedConcept` rows. Called by a
 * scheduled worker in `apps/api` (mirroring how connector syncs are scheduled), not inline during
 * connector sync, so a slow/failing NLP pass never blocks data ingestion.
 */
export class EnrichmentService {
  constructor(
    private readonly store: EnrichmentStore,
    private readonly pipeline: EnrichmentPipeline,
  ) {}

  async runBatch(tenantId: string, batchSize = 100): Promise<{ processed: number; failed: number }> {
    const notes = await this.store.fetchPendingNotes(tenantId, batchSize);
    let processed = 0;
    let failed = 0;

    for (const note of notes) {
      try {
        const extracted = await this.pipeline.enrich(note);
        const concepts: NlpExtractedConcept[] = extracted.map((row, i) => ({
          ...row,
          nlpExtractedConceptId: `${note.clinicalNoteId}-${this.pipeline.id}-${i}`,
          extractedAt: new Date(),
        }));
        await this.store.saveExtractedConcepts(tenantId, concepts);
        await this.store.markEnrichmentStatus(tenantId, note.clinicalNoteId, 'enriched');
        processed++;
      } catch {
        await this.store.markEnrichmentStatus(tenantId, note.clinicalNoteId, 'failed');
        failed++;
      }
    }

    return { processed, failed };
  }
}
