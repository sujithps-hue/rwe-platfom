import { ConnectorFactory, EhrConnector } from './types';

/**
 * Process-wide registry of connector types the platform build knows about. The API's
 * ConnectorsModule registers the shipped reference connectors (connector-fhir, connector-files)
 * at bootstrap, and a deployment can register additional proprietary connectors the same way
 * without modifying this package.
 */
export class ConnectorRegistry {
  private factories = new Map<string, ConnectorFactory>();

  register(factory: ConnectorFactory): void {
    if (this.factories.has(factory.connectorType)) {
      throw new Error(`Connector type "${factory.connectorType}" is already registered`);
    }
    this.factories.set(factory.connectorType, factory);
  }

  create(connectorType: string): EhrConnector {
    const factory = this.factories.get(connectorType);
    if (!factory) {
      throw new Error(
        `Unknown connector type "${connectorType}". Registered types: ${Array.from(this.factories.keys()).join(', ') || 'none'}`,
      );
    }
    return factory.create();
  }

  list(): string[] {
    return Array.from(this.factories.keys());
  }
}
