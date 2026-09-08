import { RiskModel } from './types';

/**
 * Per-tenant model registry. Deliberately instantiated fresh per tenant context by the host
 * application (never a shared singleton across tenants) so it's structurally impossible for one
 * tenant's registered model instance to be invoked against another tenant's data — the same
 * "never pooled across tenants" boundary described in docs/PRODUCT.md's Care Management section.
 */
export class ModelRegistry {
  private models = new Map<string, RiskModel>();

  register(model: RiskModel): void {
    this.models.set(model.id, model);
  }

  get(modelId: string): RiskModel {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`Unknown risk model id: ${modelId}`);
    return model;
  }

  list(): RiskModel[] {
    return Array.from(this.models.values());
  }
}
