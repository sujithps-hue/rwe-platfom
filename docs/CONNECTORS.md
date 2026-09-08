# Building an EHR connector

Any EHR or data source becomes usable by implementing the `EhrConnector` interface from
`packages/connector-sdk`. Two reference connectors ship in this repo:

- `packages/connector-fhir` — FHIR R4 REST (works against Epic, Cerner/Oracle Health, Allscripts, and any
  FHIR-compliant EHR sandbox or production API using SMART-on-FHIR OAuth2).
- `packages/connector-files` — batch ingestion of HL7v2 (ADT/ORU messages) and CSV drops (SFTP/S3), for
  EHRs/registries that don't expose a live API.

## The interface

```ts
export interface EhrConnector {
  readonly id: string;                       // unique connector type, e.g. "fhir-r4"
  configure(config: ConnectorConfig): Promise<void>;
  testConnection(): Promise<ConnectionTestResult>;
  sync(cursor: SyncCursor | null): Promise<SyncResult>;   // incremental pull
  mapToCdm(raw: unknown): CdmRecordBatch;                 // source format -> common data model
}
```

`ConnectorConfig` carries only references to secrets (a KMS-encrypted credential ID), never raw
credentials, so connector configuration can be stored per-tenant without becoming a PHI/secret-sprawl
liability.

## Adding a new connector

1. Scaffold a package under `packages/connector-<name>` depending on `@rwe/connector-sdk`.
2. Implement `EhrConnector`. Use `packages/connector-fhir` as a template if the source is FHIR/HL7-shaped,
   or `packages/connector-files` if it's batch/flat-file.
3. `mapToCdm` must emit records typed against `@rwe/common-data-model`'s `Person`, `VisitOccurrence`,
   `ConditionOccurrence`, `DrugExposure`, `Measurement`, and `Observation` shapes, using standard
   vocabularies where possible (SNOMED CT for conditions, RxNorm for drugs, LOINC for measurements) so the
   record is comparable across every other connector. Emit the raw source code/value here — never a
   resolved `concept_id` — the platform's write path (`apps/api/src/common/tenant-cdm-writer.ts`)
   standardizes every record to a real OMOP concept via `ConceptMapper` before persistence; see
   `docs/OMOP_VOCABULARY.md`.
4. Register the connector in `apps/api/src/connectors/connector-registry.ts`.
5. Every record your connector produces is passed through the compliance engine automatically by
   `ConnectorsModule` before being persisted — you do not need to (and should not) implement consent
   checks or de-identification inside the connector itself.

## Sync model

`sync(cursor)` is called on a schedule (default hourly, configurable per tenant) by a BullMQ worker. It
must be resumable: return a `SyncCursor` (an opaque, connector-defined bookmark — a FHIR `_since`
timestamp, an HL7 file offset, an S3 object key) so a restart doesn't re-ingest or skip records. Failures
are retried with backoff and surfaced on the tenant's connector-health dashboard; three consecutive
failures suspend the connector and alert the tenant admin rather than silently dropping data.
