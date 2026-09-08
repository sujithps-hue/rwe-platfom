import { Injectable } from '@nestjs/common';
import { SecretResolver } from '@rwe/connector-sdk';

/**
 * Dev-only secret resolution: reads the named secret from an environment variable. Production
 * deployments must supply a resolver backed by a real secrets manager (AWS Secrets Manager, GCP
 * Secret Manager, HashiCorp Vault, or the customer's own vault for a bring-your-own-tenancy
 * deployment) — connector credentials must never be stored as plain environment variables or in
 * the application database in a real deployment.
 */
@Injectable()
export class EnvSecretResolver implements SecretResolver {
  async resolve(secretId: string): Promise<string> {
    const value = process.env[secretId];
    if (!value) throw new Error(`Secret "${secretId}" is not set (dev resolver reads from environment variables)`);
    return value;
  }
}
