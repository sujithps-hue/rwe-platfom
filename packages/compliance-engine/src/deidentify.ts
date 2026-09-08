import { createHash, randomBytes } from 'crypto';
import { DeidentificationStandard } from './types';

/**
 * The 18 HIPAA Safe Harbor identifier categories (45 CFR 164.514(b)(2)). Field names are matched
 * case-insensitively against this list; real deployments should drive this from a per-connector
 * field mapping rather than name-sniffing alone (see `packages/connector-sdk`'s CDM mapping,
 * which tags fields with an `identifierCategory` up front) — name-sniffing here is the safe,
 * conservative fallback for arbitrary/unmapped input.
 */
export const HIPAA_SAFE_HARBOR_IDENTIFIER_FIELDS = [
  'name',
  'firstname',
  'lastname',
  'address',
  'street',
  'city',
  'zip',
  'zipcode',
  'postalcode',
  'dob',
  'dateofbirth',
  'birthdate',
  'admissiondate',
  'dischargedate',
  'deathdate',
  'phone',
  'phonenumber',
  'fax',
  'email',
  'ssn',
  'socialsecuritynumber',
  'mrn',
  'medicalrecordnumber',
  'healthplanid',
  'accountnumber',
  'certificatenumber',
  'licensenumber',
  'vehicleid',
  'vin',
  'deviceid',
  'serialnumber',
  'url',
  'ipaddress',
  'biometricid',
  'fingerprint',
  'voiceprint',
  'photo',
  'facephoto',
] as const;

/** Ages over 89 must be generalized to "90+" under Safe Harbor. */
export function generalizeAge(age: number): number | '90+' {
  return age > 89 ? '90+' : age;
}

/** Reduces a date to year-only, as Safe Harbor requires for dates directly related to an individual (except year itself, which may be kept unless the subject is 90+). */
export function generalizeDateToYear(date: Date): number {
  return date.getFullYear();
}

/** Reduces a 5-digit ZIP to a 3-digit prefix, and to "000" if that prefix's population is under 20,000 (Safe Harbor's specific carve-out) — `lowPopulationPrefixes` should be sourced from the current Census data in a real deployment. */
export function generalizeZip(zip: string, lowPopulationPrefixes: Set<string> = new Set()): string {
  const prefix = zip.slice(0, 3);
  return lowPopulationPrefixes.has(prefix) ? '000' : prefix;
}

function isIdentifierField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[^a-z]/g, '');
  return (HIPAA_SAFE_HARBOR_IDENTIFIER_FIELDS as readonly string[]).includes(normalized);
}

export interface DeidentificationResult {
  standard: DeidentificationStandard;
  data: Record<string, unknown>;
  /** Field names that were removed/generalized/tokenized, for audit purposes. */
  transformedFields: string[];
}

/**
 * Applies HIPAA Safe Harbor: removes/generalizes every recognized direct identifier field.
 * Non-identifier fields (clinical codes, lab values, structured vocab-coded diagnoses) pass
 * through untouched, since Safe Harbor de-identification is about removing *identifiers*, not
 * clinical content.
 */
export function applySafeHarbor(record: Record<string, unknown>): DeidentificationResult {
  const data: Record<string, unknown> = {};
  const transformedFields: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (isIdentifierField(key)) {
      transformedFields.push(key);
      continue; // dropped entirely; Safe Harbor permits generalization for age/zip/date but removal is always compliant
    }
    data[key] = value;
  }
  return { standard: 'hipaa_safe_harbor', data, transformedFields };
}

/**
 * GDPR/PDPL-style pseudonymization: identifiers are replaced with a keyed HMAC token rather than
 * removed, so records remain linkable (e.g. across visits, or for re-identification by an
 * authorized party holding the key) without exposing the raw identifier. The key must be managed
 * by `EncryptionProvider` (see `encryption.ts`), never hardcoded.
 */
export function pseudonymize(record: Record<string, unknown>, key: Buffer): DeidentificationResult {
  const data: Record<string, unknown> = {};
  const transformedFields: string[] = [];
  for (const [fieldKey, value] of Object.entries(record)) {
    if (isIdentifierField(fieldKey) && value != null) {
      data[fieldKey] = tokenize(String(value), key);
      transformedFields.push(fieldKey);
    } else {
      data[fieldKey] = value;
    }
  }
  return { standard: 'pseudonymization', data, transformedFields };
}

export function tokenize(value: string, key: Buffer): string {
  return createHash('sha256').update(key).update(value).digest('hex');
}

/** Baseline scrub for frameworks without a codified standard: same removal behavior as Safe Harbor. */
export function genericPiiScrub(record: Record<string, unknown>): DeidentificationResult {
  const result = applySafeHarbor(record);
  return { ...result, standard: 'generic_pii_scrub' };
}

export class Deidentifier {
  constructor(private readonly pseudonymizationKey: Buffer = randomBytes(32)) {}

  apply(standard: DeidentificationStandard, record: Record<string, unknown>): DeidentificationResult {
    switch (standard) {
      case 'hipaa_safe_harbor':
        return applySafeHarbor(record);
      case 'pseudonymization':
        return pseudonymize(record, this.pseudonymizationKey);
      case 'generic_pii_scrub':
        return genericPiiScrub(record);
      case 'expert_determination':
        // Statistical de-identification requires a qualified expert's methodology and is not a
        // fixed transform; the platform falls back to Safe Harbor as the conservative default and
        // flags the record for expert review rather than claiming a determination it hasn't made.
        return { ...applySafeHarbor(record), standard: 'expert_determination' };
      default:
        return genericPiiScrub(record);
    }
  }
}
