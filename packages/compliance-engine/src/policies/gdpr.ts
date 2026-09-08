import { CompliancePolicy } from '../types';

/** European Union / EEA — GDPR (Regulation (EU) 2016/679). */
export const gdpr: CompliancePolicy = {
  framework: 'GDPR',
  jurisdiction: 'EU',
  allowedRegions: ['eu-central', 'eu-west'],
  crossBorderTransfer: {
    permitted: true,
    safeguard: 'sccs',
  },
  requiredConsent: 'opt_in', // health data is a "special category" under Art. 9 — explicit consent (or another Art. 9(2) basis)
  deidentificationStandard: 'pseudonymization',
  auditRetentionDays: 6 * 365,
  maxDataRetentionDays: null, // storage limitation principle: contractual, not a fixed statutory number
  breachNotificationHours: 72,
  dataSubjectRights: {
    access: true,
    rectification: true,
    erasure: true,
    portability: true,
    restriction: true,
    fulfillmentSlaDays: 30,
  },
  requiresDpo: true, // Art. 37: mandatory for large-scale processing of special category data
  citation: 'Regulation (EU) 2016/679 (GDPR), Articles 9, 17, 20, 33, 35, 37',
};

/** United Kingdom — UK GDPR + Data Protection Act 2018 (materially the same shape post-Brexit). */
export const ukGdpr: CompliancePolicy = {
  ...gdpr,
  framework: 'UK_GDPR',
  jurisdiction: 'UK',
  allowedRegions: ['uk'],
  citation: 'UK GDPR and Data Protection Act 2018',
};
