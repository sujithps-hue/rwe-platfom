import { CdmRecordBatch } from '@rwe/common-data-model';

/**
 * Non-secret connector configuration. `credentialSecretId` is a reference into a secrets
 * manager/KMS-wrapped credential store (never a raw client secret/API key) — connectors resolve
 * the actual credential at call time via the `SecretResolver` the host application injects.
 */
export interface ConnectorConfig {
  tenantId: string;
  connectorId: string; // this ConnectorConfigRecord's id, not the connector *type*
  displayName: string;
  credentialSecretId: string;
  settings: Record<string, unknown>; // e.g. { baseUrl, resourceTypes: ["Patient","Condition"], pollIntervalMinutes: 60 }
}

export interface SecretResolver {
  resolve(secretId: string): Promise<string>;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  checkedAt: Date;
}

/**
 * Opaque, connector-defined bookmark for incremental sync (a FHIR `_since` timestamp, an HL7
 * file offset, an S3 object key, etc.). Persisted by the host application between syncs.
 */
export type SyncCursor = string;

export interface SyncResult {
  cursor: SyncCursor | null; // null if the source has no more data / this connector type doesn't support cursors
  recordsFetched: number;
  batch: CdmRecordBatch;
  errors: SyncError[];
}

export interface SyncError {
  message: string;
  sourceRecordId?: string;
  retryable: boolean;
}

/**
 * The interface every EHR/data-source connector implements. Implementations must NOT perform
 * consent checks, residency checks, or de-identification themselves — the host application's
 * ConnectorsModule runs every record produced here through the compliance engine before
 * persistence, so connector authors only need to worry about "how do I read from this source and
 * map it to the CDM."
 */
export interface EhrConnector {
  /** Stable identifier for this connector implementation, e.g. "fhir-r4", "hl7v2-file", "csv-file". */
  readonly id: string;
  readonly displayName: string;

  configure(config: ConnectorConfig, secrets: SecretResolver): Promise<void>;

  testConnection(): Promise<ConnectionTestResult>;

  /** Pulls new/changed data since `cursor` (or from the beginning, if `null`) and maps it to the CDM. */
  sync(cursor: SyncCursor | null): Promise<SyncResult>;
}

export interface ConnectorFactory {
  readonly connectorType: string;
  create(): EhrConnector;
}
