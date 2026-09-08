import { ConnectionTestResult, ConnectorConfig, EhrConnector, SecretResolver, SyncCursor, SyncResult } from '@rwe/connector-sdk';
import { CdmRecordBatch, emptyCdmRecordBatch } from '@rwe/common-data-model';
import { FileSource, LocalDirectoryFileSource } from './file-source';
import { splitHl7Batch, parseHl7Message } from './hl7v2-parser';
import { mapHl7Message } from './hl7-mapper';
import { parseCsv } from './csv-parser';
import { mapCsvRows } from './csv-mapper';

type FileFormat = 'hl7v2' | 'csv';

interface FilesConnectorSettings {
  format: FileFormat;
  /** Local directory path for the dev/reference file source. A production deployment supplies an S3/SFTP-backed FileSource via `configureSource` instead of relying on settings-driven construction. */
  directory?: string;
}

/**
 * Reference connector: batch ingestion of HL7v2 message files or CSV drops. Suited to registries
 * and legacy EHRs that export nightly/periodic files rather than exposing a live API.
 *
 * The file transport is pluggable via `FileSource` (`file-source.ts`) — this connector ships a
 * local-directory implementation for dev/CI; production deployments inject an S3/SFTP-backed
 * `FileSource` via `configureSource()` before the host application calls `sync()`.
 */
export class FilesConnector implements EhrConnector {
  readonly id = 'files-batch';
  readonly displayName = 'Batch files (HL7v2 / CSV)';

  private settings!: FilesConnectorSettings;
  private connectorId!: string;
  private source!: FileSource;

  async configure(config: ConnectorConfig, _secrets: SecretResolver): Promise<void> {
    this.settings = config.settings as unknown as FilesConnectorSettings;
    this.connectorId = config.connectorId;
    if (this.settings.directory) {
      this.source = new LocalDirectoryFileSource(this.settings.directory);
    }
  }

  /** Overrides the file transport (e.g. with an S3/SFTP-backed implementation) after `configure()`. */
  configureSource(source: FileSource): void {
    this.source = source;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.source.listNewFiles(null);
      return { ok: true, message: 'File source reachable', checkedAt: new Date() };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err), checkedAt: new Date() };
    }
  }

  async sync(cursor: SyncCursor | null): Promise<SyncResult> {
    const files = await this.source.listNewFiles(cursor);
    const batch: CdmRecordBatch = emptyCdmRecordBatch();
    const errors: SyncResult['errors'] = [];
    let recordsFetched = 0;
    let latestCursor = cursor;

    for (const file of files) {
      try {
        const content = await this.source.readFile(file.key);
        if (this.settings.format === 'hl7v2') {
          recordsFetched += this.ingestHl7File(content, batch);
        } else {
          recordsFetched += this.ingestCsvFile(content, batch);
        }
        latestCursor = file.modifiedCursor;
      } catch (err) {
        errors.push({ message: `${file.key}: ${err instanceof Error ? err.message : String(err)}`, sourceRecordId: file.key, retryable: true });
      }
    }

    return { cursor: latestCursor, recordsFetched, batch, errors };
  }

  private ingestHl7File(content: string, batch: CdmRecordBatch): number {
    let count = 0;
    for (const rawMessage of splitHl7Batch(content)) {
      const message = parseHl7Message(rawMessage);
      const mapped = mapHl7Message(message, this.connectorId);
      if (!mapped) continue;
      batch.persons.push(mapped.person);
      if (mapped.visit) batch.visits.push(mapped.visit);
      batch.conditions.push(...mapped.conditions);
      count++;
    }
    return count;
  }

  private ingestCsvFile(content: string, batch: CdmRecordBatch): number {
    const rows = parseCsv(content);
    const mapped = mapCsvRows(rows, this.connectorId);
    batch.persons.push(...mapped.persons);
    batch.visits.push(...mapped.visits);
    batch.conditions.push(...mapped.conditions);
    return rows.length;
  }
}
