import { Provider } from '@nestjs/common';
import { ConnectorRegistry } from '@rwe/connector-sdk';
import { FhirConnectorFactory } from '@rwe/connector-fhir';
import { FilesConnectorFactory } from '@rwe/connector-files';

export const CONNECTOR_REGISTRY = 'CONNECTOR_REGISTRY';

/**
 * Registers the reference connectors this build ships with. A deployment adding a proprietary
 * connector (see docs/CONNECTORS.md) registers its factory here too, or via a plugin-loading
 * mechanism reading from configuration — this provider is the single place connector types are
 * wired into the running application.
 */
export const connectorRegistryProvider: Provider = {
  provide: CONNECTOR_REGISTRY,
  useFactory: () => {
    const registry = new ConnectorRegistry();
    registry.register(new FhirConnectorFactory());
    registry.register(new FilesConnectorFactory());
    return registry;
  },
};
