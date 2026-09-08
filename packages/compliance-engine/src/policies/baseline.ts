import { CompliancePolicy } from '../types';

/**
 * Conservative default applied when a tenant has no jurisdiction configured yet (e.g. mid
 * onboarding), or as the floor merged into every other policy. Chooses the most restrictive
 * value seen across the known frameworks so nothing is ever under-protected by omission.
 */
export const baseline: CompliancePolicy = {
  framework: 'BASELINE',
  jurisdiction: 'GLOBAL',
  allowedRegions: [],
  crossBorderTransfer: {
    permitted: false,
  },
  requiredConsent: 'opt_in',
  deidentificationStandard: 'hipaa_safe_harbor',
  auditRetentionDays: 6 * 365,
  maxDataRetentionDays: null,
  breachNotificationHours: 24,
  dataSubjectRights: {
    access: true,
    rectification: true,
    erasure: true,
    portability: true,
    restriction: true,
    fulfillmentSlaDays: 15,
  },
  requiresDpo: true,
  citation: 'Platform baseline — no tenant jurisdiction configured; most-restrictive-known defaults applied',
};
