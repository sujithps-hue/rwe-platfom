import { Injectable } from '@nestjs/common';
import { EnrichmentService as NlpEnrichmentService, RuleBasedEnrichmentPipeline } from '@rwe/nlp-enrichment';
import { getTenantContext } from '../common/tenant-context';
import { TenantEnrichmentStore } from './tenant-enrichment-store';

/**
 * Thin per-request wrapper around `@rwe/nlp-enrichment`'s `EnrichmentService`. The pipeline is
 * hardcoded to the shipped `RuleBasedEnrichmentPipeline` reference implementation here — a tenant
 * with a licensed/trained clinical NLP vendor would have its `EnrichmentPipeline` implementation
 * selected here based on tenant configuration instead (see docs/PRODUCT.md#nlp-enrichment).
 */
@Injectable()
export class EnrichmentService {
  constructor(private readonly store: TenantEnrichmentStore) {}

  async runBatch(batchSize = 100): Promise<{ processed: number; failed: number }> {
    const { tenant } = getTenantContext();
    const service = new NlpEnrichmentService(this.store, new RuleBasedEnrichmentPipeline());
    return service.runBatch(tenant.schemaName, batchSize);
  }
}
