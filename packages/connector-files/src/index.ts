import { ConnectorFactory, EhrConnector } from '@rwe/connector-sdk';
import { FilesConnector } from './files-connector';

export * from './files-connector';
export * from './file-source';
export * from './hl7v2-parser';
export * from './hl7-mapper';
export * from './csv-parser';
export * from './csv-mapper';

export class FilesConnectorFactory implements ConnectorFactory {
  readonly connectorType = 'files-batch';
  create(): EhrConnector {
    return new FilesConnector();
  }
}
