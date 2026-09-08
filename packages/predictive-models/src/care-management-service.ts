import { RiskScore } from '@rwe/common-data-model';
import { FeatureExtractor } from './feature-extraction';
import { ModelRegistry } from './model-registry';
import { PatientRecordBundle } from './types';

export interface RiskScoreStore {
  save(tenantId: string, scores: RiskScore[]): Promise<void>;
}

/**
 * Runs every registered model against a tenant's patients and persists the resulting risk_score
 * rows for the Care Management dashboard. Called by a scheduled worker in `apps/api`
 * (`apps/api/src/care-management`), scoped to exactly one tenant per invocation — see
 * `ModelRegistry`'s doc comment for why per-tenant instantiation is the isolation boundary here,
 * matching the wider platform's "never pool clinical data across tenants without explicit
 * multi-tenant research consent" rule (docs/COMPLIANCE.md).
 */
export class CareManagementService {
  private readonly featureExtractor = new FeatureExtractor();

  constructor(
    private readonly registry: ModelRegistry,
    private readonly store: RiskScoreStore,
  ) {}

  async scoreTenant(tenantId: string, patients: PatientRecordBundle[]): Promise<number> {
    const scores: RiskScore[] = [];

    for (const bundle of patients) {
      const features = this.featureExtractor.extract(bundle);
      for (const model of this.registry.list()) {
        const result = model.score(features);
        scores.push({
          riskScoreId: `${bundle.person.personId}-${model.id}-${bundle.asOf.getTime()}`,
          personId: bundle.person.personId,
          modelId: model.id,
          score: result.score,
          scoreBand: result.band,
          computedAt: bundle.asOf,
          explanation: result.explanation,
        });
      }
    }

    await this.store.save(tenantId, scores);
    return scores.length;
  }
}
