import { CompliancePolicy } from '../types';

/** Singapore — Personal Data Protection Act 2012 (PDPA), enforced by the PDPC. */
export const pdpaSg: CompliancePolicy = {
  framework: 'PDPA_SG',
  jurisdiction: 'SG',
  allowedRegions: ['ap-southeast'],
  crossBorderTransfer: {
    permitted: true,
    safeguard: 'sccs',
  },
  requiredConsent: 'notice_and_opt_out',
  deidentificationStandard: 'generic_pii_scrub',
  auditRetentionDays: 3 * 365,
  maxDataRetentionDays: null,
  breachNotificationHours: 72, // "as soon as practicable", 72h is the platform's conservative operational target
  dataSubjectRights: {
    access: true,
    rectification: true,
    erasure: false, // PDPA gives withdrawal-of-consent + correction rights, not a general erasure right
    portability: false,
    restriction: true,
    fulfillmentSlaDays: 30,
  },
  requiresDpo: true, // PDPA mandates a Data Protection Officer for every organisation
  citation: 'Singapore Personal Data Protection Act 2012 (PDPA), as amended 2020',
};
