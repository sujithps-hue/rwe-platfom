import { ConnectorConfig, ConnectionTestResult, EhrConnector, SecretResolver, SyncCursor, SyncResult } from '@rwe/connector-sdk';
import { emptyCdmRecordBatch } from '@rwe/common-data-model';
import { SmartBackendOAuthClient } from './oauth-client';
import { FhirCondition, FhirDocumentReference, FhirEncounter, FhirMapper, FhirMedicationRequest, FhirPatient } from './fhir-mapper';

interface FhirBundleEntry<T> {
  resource: T;
}
interface FhirBundle<T> {
  resourceType: 'Bundle';
  entry?: FhirBundleEntry<T>[];
  link?: Array<{ relation: string; url: string }>;
}

interface FhirConnectorSettings {
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  scope?: string;
  pageSize?: number;
}

/**
 * Reference connector: FHIR R4 REST, authenticated via SMART-on-FHIR backend-services
 * client-credentials. Works unmodified against any FHIR R4-compliant EHR API (Epic, Cerner/Oracle
 * Health sandboxes and production endpoints included) — only `settings.baseUrl`/`tokenUrl` and the
 * registered app's credentials differ per tenant/EHR.
 *
 * `sync(cursor)` pulls Patient + Encounter + Condition + MedicationRequest + DocumentReference
 * (clinical notes) updated since `cursor` (an ISO timestamp used as FHIR's `_lastUpdated=gt...`
 * search parameter), maps each to the common data model, and returns the next cursor.
 */
export class FhirConnector implements EhrConnector {
  readonly id = 'fhir-r4';
  readonly displayName = 'FHIR R4 (SMART-on-FHIR backend services)';

  private settings!: FhirConnectorSettings;
  private oauth!: SmartBackendOAuthClient;
  private mapper!: FhirMapper;
  private tenantId!: string;

  async configure(config: ConnectorConfig, secrets: SecretResolver): Promise<void> {
    this.settings = config.settings as unknown as FhirConnectorSettings;
    this.tenantId = config.tenantId;
    const clientSecret = await secrets.resolve(config.credentialSecretId);
    this.oauth = new SmartBackendOAuthClient({
      tokenUrl: this.settings.tokenUrl,
      clientId: this.settings.clientId,
      clientSecret,
      scope: this.settings.scope ?? 'system/Patient.read system/Encounter.read system/Condition.read system/MedicationRequest.read system/DocumentReference.read',
    });
    this.mapper = new FhirMapper(config.connectorId);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const token = await this.oauth.getAccessToken();
      const response = await fetch(`${this.settings.baseUrl}/metadata`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/fhir+json' },
      });
      return {
        ok: response.ok,
        message: response.ok ? 'Connected to FHIR CapabilityStatement endpoint' : `HTTP ${response.status}`,
        checkedAt: new Date(),
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err), checkedAt: new Date() };
    }
  }

  async sync(cursor: SyncCursor | null): Promise<SyncResult> {
    const since = cursor ?? '1970-01-01T00:00:00Z';
    const now = new Date().toISOString();
    const batch = emptyCdmRecordBatch();
    let recordsFetched = 0;
    const errors: SyncResult['errors'] = [];

    try {
      const patients = await this.fetchAll<FhirPatient>('Patient', since);
      for (const patient of patients) {
        batch.persons.push(this.mapper.mapPatient(patient));
        recordsFetched++;
      }

      const encounters = await this.fetchAll<FhirEncounter>('Encounter', since);
      const visitIdByFhirId = new Map<string, string>();
      for (const encounter of encounters) {
        const personId = FhirMapper.findPersonId(batch, FhirMapper.referenceId(encounter.subject.reference));
        if (!personId) continue; // patient not in this batch (already synced previously); a full implementation resolves against previously-persisted persons too
        const visit = this.mapper.mapEncounter(encounter, personId);
        batch.visits.push(visit);
        visitIdByFhirId.set(encounter.id, visit.visitOccurrenceId);
        recordsFetched++;
      }

      const conditions = await this.fetchAll<FhirCondition>('Condition', since);
      for (const condition of conditions) {
        const personId = FhirMapper.findPersonId(batch, FhirMapper.referenceId(condition.subject.reference));
        if (!personId) continue;
        const visitId = condition.encounter ? (visitIdByFhirId.get(FhirMapper.referenceId(condition.encounter.reference)) ?? null) : null;
        batch.conditions.push(this.mapper.mapCondition(condition, personId, visitId));
        recordsFetched++;
      }

      const medications = await this.fetchAll<FhirMedicationRequest>('MedicationRequest', since);
      for (const med of medications) {
        const personId = FhirMapper.findPersonId(batch, FhirMapper.referenceId(med.subject.reference));
        if (!personId) continue;
        const visitId = med.encounter ? (visitIdByFhirId.get(FhirMapper.referenceId(med.encounter.reference)) ?? null) : null;
        batch.drugExposures.push(this.mapper.mapMedicationRequest(med, personId, visitId));
        recordsFetched++;
      }

      const documents = await this.fetchAll<FhirDocumentReference>('DocumentReference', since);
      for (const doc of documents) {
        const personId = FhirMapper.findPersonId(batch, FhirMapper.referenceId(doc.subject.reference));
        if (!personId) continue;
        const encRef = doc.context?.encounter?.[0]?.reference;
        const visitId = encRef ? (visitIdByFhirId.get(FhirMapper.referenceId(encRef)) ?? null) : null;
        const note = this.mapper.mapDocumentReference(doc, personId, visitId);
        if (note) batch.clinicalNotes.push(note);
        recordsFetched++;
      }
    } catch (err) {
      errors.push({ message: err instanceof Error ? err.message : String(err), retryable: true });
    }

    return { cursor: now, recordsFetched, batch, errors };
  }

  private async fetchAll<T>(resourceType: string, since: string): Promise<T[]> {
    const token = await this.oauth.getAccessToken();
    const pageSize = this.settings.pageSize ?? 100;
    let url: string | undefined =
      `${this.settings.baseUrl}/${resourceType}?_lastUpdated=gt${encodeURIComponent(since)}&_count=${pageSize}`;
    const results: T[] = [];

    while (url) {
      const response: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/fhir+json' },
      });
      if (!response.ok) {
        throw new Error(`FHIR ${resourceType} search failed: ${response.status} ${await response.text()}`);
      }
      const bundle = (await response.json()) as FhirBundle<T>;
      for (const entry of bundle.entry ?? []) {
        results.push(entry.resource);
      }
      url = bundle.link?.find((l) => l.relation === 'next')?.url;
    }

    return results;
  }
}
