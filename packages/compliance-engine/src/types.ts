/**
 * Core types for the compliance engine. A tenant is assigned one or more Jurisdictions;
 * each Jurisdiction resolves to exactly one CompliancePolicy. When a tenant spans multiple
 * jurisdictions, `mergePolicies` composes them by taking the most restrictive value per control.
 */

export type Jurisdiction =
  | 'US' // HIPAA
  | 'EU' // GDPR (also covers EEA)
  | 'UK' // UK GDPR / DPA 2018
  | 'AE' // UAE PDPL
  | 'SA' // Saudi Arabia PDPL
  | 'SG' // Singapore PDPA
  | 'CN' // China PIPL
  | 'IN' // India DPDP Act
  | 'GLOBAL'; // baseline, used until a tenant's real jurisdiction(s) are configured

export type ComplianceFramework =
  | 'HIPAA'
  | 'GDPR'
  | 'UK_GDPR'
  | 'UAE_PDPL'
  | 'KSA_PDPL'
  | 'PDPA_SG'
  | 'PIPL_CN'
  | 'DPDP_IN'
  | 'BASELINE';

export type ConsentType =
  | 'opt_in' // explicit affirmative consent required before any processing
  | 'notice_and_opt_out' // processing permitted after notice, subject may opt out
  | 'granular_purpose'; // separate consent per processing purpose (e.g. research vs. care)

export type DeidentificationStandard =
  | 'hipaa_safe_harbor' // remove/generalize the 18 HIPAA identifiers
  | 'expert_determination' // statistical de-identification, no fixed rule list
  | 'pseudonymization' // GDPR-style: reversible with a securely held key
  | 'generic_pii_scrub'; // baseline scrub used when no framework-specific standard applies

export interface DataSubjectRightsSupport {
  access: boolean;
  rectification: boolean;
  erasure: boolean;
  portability: boolean;
  restriction: boolean;
  /** Business days allowed to fulfil a request end-to-end. */
  fulfillmentSlaDays: number;
}

export interface CompliancePolicy {
  framework: ComplianceFramework;
  jurisdiction: Jurisdiction;
  /** Regions data may be stored/processed in. Empty = no residency restriction. */
  allowedRegions: string[];
  /** Whether data may leave `allowedRegions` at all, and under what safeguard. */
  crossBorderTransfer: {
    permitted: boolean;
    safeguard?: 'sccs' | 'adequacy_decision' | 'explicit_consent' | 'security_assessment';
  };
  requiredConsent: ConsentType;
  deidentificationStandard: DeidentificationStandard;
  /** Minimum time audit records must be retained, in days. */
  auditRetentionDays: number;
  /** Maximum time personal/health data may be retained absent an ongoing care relationship, in days. `null` = no fixed ceiling in the framework itself (retention schedule is contractual). */
  maxDataRetentionDays: number | null;
  /** Deadline to notify the relevant authority/data subjects after discovering a breach, in hours. */
  breachNotificationHours: number;
  dataSubjectRights: DataSubjectRightsSupport;
  /** Whether a formal privacy/data-protection officer role is required above processing-volume thresholds. */
  requiresDpo: boolean;
  /** Free-text pointer to the legal basis/citation, for audit and legal review purposes. */
  citation: string;
}

export interface ConsentRecord {
  id: string;
  tenantId: string;
  dataSubjectId: string;
  purpose: string;
  type: ConsentType;
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
  /** e.g. "written", "electronic-signature", "verbal-recorded" */
  method: string;
}

export type AuditAction =
  | 'read_identifiable'
  | 'read_deidentified'
  | 'export'
  | 'consent_change'
  | 'connector_change'
  | 'dsar_request'
  | 'dsar_fulfilled'
  | 'breach_declared'
  | 'user_login'
  | 'permission_change';

export interface AuditEntry {
  id: string;
  tenantId: string;
  actorId: string;
  actorRole: string;
  action: AuditAction;
  jurisdiction: Jurisdiction;
  resourceType: string;
  resourceId: string | null;
  occurredAt: Date;
  metadata: Record<string, unknown>;
}

export type DsarRequestType = 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction';

export interface DsarRequest {
  id: string;
  tenantId: string;
  dataSubjectId: string;
  type: DsarRequestType;
  requestedAt: Date;
  dueBy: Date;
  fulfilledAt: Date | null;
  status: 'received' | 'in_progress' | 'fulfilled' | 'rejected';
}
