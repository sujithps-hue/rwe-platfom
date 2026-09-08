import { POLICIES_BY_JURISDICTION, baseline } from './policies';
import {
  CompliancePolicy,
  ConsentRecord,
  ConsentType,
  Jurisdiction,
} from './types';

export class ResidencyViolationError extends Error {
  constructor(region: string, allowed: string[]) {
    super(`Region "${region}" is not permitted by the tenant's compliance policy (allowed: ${allowed.join(', ') || 'none configured'})`);
    this.name = 'ResidencyViolationError';
  }
}

export class ConsentRequiredError extends Error {
  constructor(dataSubjectId: string, purpose: string) {
    super(`No valid consent on file for data subject "${dataSubjectId}" for purpose "${purpose}"`);
    this.name = 'ConsentRequiredError';
  }
}

const CONSENT_STRICTNESS_ORDER: ConsentType[] = ['notice_and_opt_out', 'opt_in', 'granular_purpose'];

function stricterConsent(a: ConsentType, b: ConsentType): ConsentType {
  return CONSENT_STRICTNESS_ORDER.indexOf(a) >= CONSENT_STRICTNESS_ORDER.indexOf(b) ? a : b;
}

/**
 * Merge multiple jurisdictions' policies into one effective policy for a tenant, always taking
 * the more restrictive value per control. Used for tenants operating across regions (e.g. a US
 * company with an EU subsidiary) so the platform never under-protects by picking the looser rule.
 */
export function mergePolicies(policies: CompliancePolicy[]): CompliancePolicy {
  if (policies.length === 0) return baseline;
  return policies.reduce((merged, p) => ({
    // framework/jurisdiction on a merged policy are informational only; keep the first for display
    framework: merged.framework,
    jurisdiction: merged.jurisdiction,
    allowedRegions:
      merged.allowedRegions.length === 0
        ? p.allowedRegions
        : merged.allowedRegions.filter((r) => p.allowedRegions.length === 0 || p.allowedRegions.includes(r)),
    crossBorderTransfer: {
      permitted: merged.crossBorderTransfer.permitted && p.crossBorderTransfer.permitted,
      safeguard: merged.crossBorderTransfer.safeguard ?? p.crossBorderTransfer.safeguard,
    },
    requiredConsent: stricterConsent(merged.requiredConsent, p.requiredConsent),
    deidentificationStandard: merged.deidentificationStandard, // Safe Harbor is treated as strictest; kept stable across merges
    auditRetentionDays: Math.max(merged.auditRetentionDays, p.auditRetentionDays),
    maxDataRetentionDays:
      merged.maxDataRetentionDays === null
        ? p.maxDataRetentionDays
        : p.maxDataRetentionDays === null
          ? merged.maxDataRetentionDays
          : Math.min(merged.maxDataRetentionDays, p.maxDataRetentionDays),
    breachNotificationHours: Math.min(merged.breachNotificationHours, p.breachNotificationHours),
    dataSubjectRights: {
      access: merged.dataSubjectRights.access || p.dataSubjectRights.access,
      rectification: merged.dataSubjectRights.rectification || p.dataSubjectRights.rectification,
      erasure: merged.dataSubjectRights.erasure || p.dataSubjectRights.erasure,
      portability: merged.dataSubjectRights.portability || p.dataSubjectRights.portability,
      restriction: merged.dataSubjectRights.restriction || p.dataSubjectRights.restriction,
      fulfillmentSlaDays: Math.min(merged.dataSubjectRights.fulfillmentSlaDays, p.dataSubjectRights.fulfillmentSlaDays),
    },
    requiresDpo: merged.requiresDpo || p.requiresDpo,
    citation: `${merged.citation}; ${p.citation}`,
  }));
}

export function resolvePolicy(jurisdictions: Jurisdiction[]): CompliancePolicy {
  if (jurisdictions.length === 0) return baseline;
  return mergePolicies(jurisdictions.map((j) => POLICIES_BY_JURISDICTION[j]));
}

export class ComplianceEngine {
  private readonly policy: CompliancePolicy;

  constructor(jurisdictions: Jurisdiction[]) {
    this.policy = resolvePolicy(jurisdictions);
  }

  getPolicy(): CompliancePolicy {
    return this.policy;
  }

  /** Throws if `region` is not permitted for this tenant's effective policy. */
  checkResidency(region: string): void {
    const allowed = this.policy.allowedRegions;
    if (allowed.length > 0 && !allowed.includes(region)) {
      throw new ResidencyViolationError(region, allowed);
    }
  }

  /**
   * Throws unless a granted, non-revoked consent record exists for the subject/purpose that
   * satisfies (or exceeds) the policy's required consent type.
   */
  checkConsent(record: ConsentRecord | null, purpose: string): void {
    if (!record || !record.granted || record.revokedAt) {
      throw new ConsentRequiredError(record?.dataSubjectId ?? 'unknown', purpose);
    }
    const requiredRank = CONSENT_STRICTNESS_ORDER.indexOf(this.policy.requiredConsent);
    const grantedRank = CONSENT_STRICTNESS_ORDER.indexOf(record.type);
    if (grantedRank < requiredRank) {
      throw new ConsentRequiredError(record.dataSubjectId, purpose);
    }
  }

  /** Whether cross-border transfer out of `allowedRegions` is permitted at all for this tenant. */
  canTransferCrossBorder(): boolean {
    return this.policy.crossBorderTransfer.permitted;
  }

  /** Computes the breach-notification deadline given a discovery timestamp. */
  breachNotificationDeadline(discoveredAt: Date): Date {
    return new Date(discoveredAt.getTime() + this.policy.breachNotificationHours * 60 * 60 * 1000);
  }

  /** Computes the DSAR fulfillment deadline given a request timestamp. */
  dsarDueDate(requestedAt: Date): Date {
    return new Date(requestedAt.getTime() + this.policy.dataSubjectRights.fulfillmentSlaDays * 24 * 60 * 60 * 1000);
  }
}
