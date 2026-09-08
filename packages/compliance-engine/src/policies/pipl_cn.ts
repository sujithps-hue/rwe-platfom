import { CompliancePolicy } from '../types';

/**
 * People's Republic of China — Personal Information Protection Law (PIPL) plus the Data
 * Security Law. Health information is "sensitive personal information" (Art. 28), requiring
 * separate, explicit consent, and cross-border transfer requires a security assessment /
 * standard contract filed with the CAC.
 */
export const piplCn: CompliancePolicy = {
  framework: 'PIPL_CN',
  jurisdiction: 'CN',
  allowedRegions: ['cn-north'],
  crossBorderTransfer: {
    permitted: false,
    safeguard: 'security_assessment',
  },
  requiredConsent: 'granular_purpose', // Art. 29: separate consent per purpose for sensitive personal information
  deidentificationStandard: 'pseudonymization',
  auditRetentionDays: 3 * 365,
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
  requiresDpo: true, // Art. 52: "personal information protection officer" required above volume thresholds
  citation: "PRC Personal Information Protection Law (PIPL, 2021) and Data Security Law (2021)",
};
