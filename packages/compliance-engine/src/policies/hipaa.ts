import { CompliancePolicy } from '../types';

/**
 * United States — HIPAA Privacy, Security, and Breach Notification Rules.
 * Applies to "covered entities" and their "business associates" handling PHI.
 */
export const hipaa: CompliancePolicy = {
  framework: 'HIPAA',
  jurisdiction: 'US',
  allowedRegions: ['us-east', 'us-west'],
  crossBorderTransfer: {
    permitted: false,
  },
  requiredConsent: 'notice_and_opt_out',
  deidentificationStandard: 'hipaa_safe_harbor',
  auditRetentionDays: 6 * 365,
  maxDataRetentionDays: null,
  breachNotificationHours: 60 * 24,
  dataSubjectRights: {
    access: true,
    rectification: true,
    erasure: false, // HIPAA does not grant a general right to erasure of the medical record
    portability: true,
    restriction: true,
    fulfillmentSlaDays: 30,
  },
  requiresDpo: false, // HIPAA requires a named Privacy Officer + Security Officer, not a "DPO" per se
  citation: '45 CFR Parts 160 and 164 (HIPAA Privacy, Security, Breach Notification Rules)',
};
