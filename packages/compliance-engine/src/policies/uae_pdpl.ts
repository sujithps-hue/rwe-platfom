import { CompliancePolicy } from '../types';

/**
 * United Arab Emirates — Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data
 * (PDPL), plus sector rules from DHA/DoH where the tenant is a licensed healthcare provider.
 * Health data is "sensitive personal data" under Art. 1/Art. 4 — processing generally requires
 * explicit consent absent a specific statutory exception.
 */
export const uaePdpl: CompliancePolicy = {
  framework: 'UAE_PDPL',
  jurisdiction: 'AE',
  allowedRegions: ['me-uae'],
  crossBorderTransfer: {
    permitted: true,
    safeguard: 'adequacy_decision', // UAE Data Office maintains an adequate-country mechanism; otherwise consent/contractual safeguard required
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
  requiresDpo: true, // required where processing involves large-scale sensitive personal data
  citation:
    'UAE Federal Decree-Law No. 45 of 2021 (PDPL); DHA Data Protection Standard / DoH data-sharing policies for licensed providers',
};
