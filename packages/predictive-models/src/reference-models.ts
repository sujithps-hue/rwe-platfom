import { PatientFeatures, RiskModel, RiskScoreResult } from './types';

function toBand(score: number): 'low' | 'medium' | 'high' {
  if (score >= 0.66) return 'high';
  if (score >= 0.33) return 'medium';
  return 'low';
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Transparent, weighted-scorecard reference model — deliberately not a trained ML model, so its
 * behavior is auditable and explainable out of the box (each weight is a named, inspectable
 * constant). A tenant with enough volume/history to train a real model implements `RiskModel`
 * with one backed by their own pipeline (scikit-learn/XGBoost service, etc.) and registers it in
 * `ModelRegistry` in place of this reference — the interface and the clinician-facing UI
 * (`apps/web`'s Care Management pages) don't change either way.
 */
export class ReadmissionRiskModel implements RiskModel {
  readonly id = 'readmission-risk-v1';
  readonly displayName = '30/60/90-day readmission risk';

  private readonly weights = {
    inpatientVisitsLast12mo: 0.6,
    edVisitsLast12mo: 0.35,
    distinctConditionsLast12mo: 0.15,
    activeMedicationCount: 0.08,
    recentDischarge: 0.5, // daysSinceLastVisit < 30
  };

  score(features: PatientFeatures): RiskScoreResult {
    const contributions: Record<string, number> = {
      inpatientVisitsLast12mo: this.weights.inpatientVisitsLast12mo * Math.min(features.inpatientVisitsLast12mo, 5),
      edVisitsLast12mo: this.weights.edVisitsLast12mo * Math.min(features.edVisitsLast12mo, 5),
      distinctConditionsLast12mo: this.weights.distinctConditionsLast12mo * Math.min(features.distinctConditionsLast12mo, 8),
      activeMedicationCount: this.weights.activeMedicationCount * Math.min(features.activeMedicationCount, 10),
      recentDischarge:
        features.daysSinceLastVisit !== null && features.daysSinceLastVisit < 30 ? this.weights.recentDischarge : 0,
    };

    const rawScore = Object.values(contributions).reduce((sum, v) => sum + v, 0) - 1.5; // centering constant
    const score = sigmoid(rawScore);

    return { score, band: toBand(score), explanation: contributions };
  }
}

/**
 * Behavioral-health relapse/crisis risk — a predictive model for clinicians, weighting the
 * NLP-derived suicidal-ideation and SDOH flags alongside utilization signals.
 */
export class BehavioralHealthRelapseRiskModel implements RiskModel {
  readonly id = 'relapse-risk-v1';
  readonly displayName = 'Behavioral health relapse/crisis risk';

  private readonly weights = {
    suicidalIdeation: 1.4,
    sdohRiskFlag: 0.5,
    edVisitsLast12mo: 0.4,
    distinctConditionsLast12mo: 0.1,
    longGapSinceLastVisit: 0.3, // daysSinceLastVisit > 90 (disengagement signal)
  };

  score(features: PatientFeatures): RiskScoreResult {
    const contributions: Record<string, number> = {
      suicidalIdeation: features.hasPositiveSuicidalIdeation ? this.weights.suicidalIdeation : 0,
      sdohRiskFlag: features.hasSdohRiskFlag ? this.weights.sdohRiskFlag : 0,
      edVisitsLast12mo: this.weights.edVisitsLast12mo * Math.min(features.edVisitsLast12mo, 5),
      distinctConditionsLast12mo: this.weights.distinctConditionsLast12mo * Math.min(features.distinctConditionsLast12mo, 8),
      longGapSinceLastVisit:
        features.daysSinceLastVisit !== null && features.daysSinceLastVisit > 90 ? this.weights.longGapSinceLastVisit : 0,
    };

    const rawScore = Object.values(contributions).reduce((sum, v) => sum + v, 0) - 1.2;
    const score = sigmoid(rawScore);

    return { score, band: toBand(score), explanation: contributions };
  }
}
