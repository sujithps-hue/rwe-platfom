import { ComplianceFramework, Jurisdiction, CompliancePolicy } from '../types';
import { hipaa } from './hipaa';
import { gdpr, ukGdpr } from './gdpr';
import { uaePdpl } from './uae_pdpl';
import { ksaPdpl } from './ksa_pdpl';
import { pdpaSg } from './pdpa_sg';
import { piplCn } from './pipl_cn';
import { dpdpIn } from './dpdp_in';
import { baseline } from './baseline';

/** Every jurisdiction the platform ships policies for, keyed for O(1) lookup. */
export const POLICIES_BY_JURISDICTION: Record<Jurisdiction, CompliancePolicy> = {
  US: hipaa,
  EU: gdpr,
  UK: ukGdpr,
  AE: uaePdpl,
  SA: ksaPdpl,
  SG: pdpaSg,
  CN: piplCn,
  IN: dpdpIn,
  GLOBAL: baseline,
};

export const POLICIES_BY_FRAMEWORK: Record<ComplianceFramework, CompliancePolicy> = {
  HIPAA: hipaa,
  GDPR: gdpr,
  UK_GDPR: ukGdpr,
  UAE_PDPL: uaePdpl,
  KSA_PDPL: ksaPdpl,
  PDPA_SG: pdpaSg,
  PIPL_CN: piplCn,
  DPDP_IN: dpdpIn,
  BASELINE: baseline,
};

export {
  hipaa,
  gdpr,
  ukGdpr,
  uaePdpl,
  ksaPdpl,
  pdpaSg,
  piplCn,
  dpdpIn,
  baseline,
};
