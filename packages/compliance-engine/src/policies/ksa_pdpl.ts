import { CompliancePolicy } from '../types';

/** Saudi Arabia — Personal Data Protection Law (PDPL), regulated by SDAIA. */
export const ksaPdpl: CompliancePolicy = {
  framework: 'KSA_PDPL',
  jurisdiction: 'SA',
  allowedRegions: ['me-ksa'],
  crossBorderTransfer: {
    permitted: false, // default posture: in-kingdom localization for health data unless SDAIA approval obtained
    safeguard: 'security_assessment',
  },
  requiredConsent: 'opt_in',
  deidentificationStandard: 'pseudonymization',
  auditRetentionDays: 5 * 365,
  maxDataRetentionDays: null,
  breachNotificationHours: 72,
  dataSubjectRights: {
    access: true,
    rectification: true,
    erasure: true,
    portability: true,
    restriction: true,
    fulfillmentSlaDays: 30,
  },
  requiresDpo: true,
  citation: 'Saudi Personal Data Protection Law (PDPL) and Implementing Regulations, SDAIA',
};
