import { ConnectorFactory, EhrConnector } from '@rwe/connector-sdk';
import { FhirConnector } from './fhir-connector';

export * from './fhir-connector';
export * from './fhir-mapper';
export * from './oauth-client';

export class FhirConnectorFactory implements ConnectorFactory {
  readonly connectorType = 'fhir-r4';
  create(): EhrConnector {
    return new FhirConnector();
  }
}
