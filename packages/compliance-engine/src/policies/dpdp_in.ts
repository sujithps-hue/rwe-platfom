import { CompliancePolicy } from '../types';

/** India — Digital Personal Data Protection Act, 2023 (DPDP Act). */
export const dpdpIn: CompliancePolicy = {
  framework: 'DPDP_IN',
  jurisdiction: 'IN',
  allowedRegions: ['ap-south'],
  crossBorderTransfer: {
    permitted: true, // permitted by default except to countries the government restricts (blacklist model)
    safeguard: 'adequacy_decision',
  },
  requiredConsent: 'opt_in',
  deidentificationStandard: 'generic_pii_scrub',
  auditRetentionDays: 3 * 365,
  maxDataRetentionDays: null,
  breachNotificationHours: 72,
  dataSubjectRights: {
    access: true,
    rectification: true,
    erasure: true,
    portability: false,
    restriction: false,
    fulfillmentSlaDays: 30,
  },
  requiresDpo: true, // required for "Significant Data Fiduciaries"
  citation: 'Digital Personal Data Protection Act, 2023 (India)',
};
