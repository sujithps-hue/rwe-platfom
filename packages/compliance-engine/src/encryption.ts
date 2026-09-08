import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Pluggable envelope-encryption provider. The default `LocalDevEncryptionProvider` is for local
 * development only (see the loud warning it prints) — production deployments must supply a KMS/HSM-
 * backed implementation (AWS KMS, Azure Key Vault, GCP KMS, or an on-prem HSM for a bring-your-
 * own-tenancy customer) that never lets the raw data key touch application memory unencrypted for
 * longer than a single operation.
 */
export interface EncryptionProvider {
  /** Encrypts a buffer with a data key scoped to `tenantId`/`keyId`, returning ciphertext + metadata needed to decrypt. */
  encrypt(tenantId: string, keyId: string, plaintext: Buffer): Promise<{ ciphertext: Buffer; iv: Buffer; authTag: Buffer }>;
  decrypt(tenantId: string, keyId: string, ciphertext: Buffer, iv: Buffer, authTag: Buffer): Promise<Buffer>;
  /** Generates and registers a fresh per-tenant data key (called once at tenant provisioning, and on scheduled rotation). */
  generateTenantKey(tenantId: string): Promise<string>;
}

/**
 * AES-256-GCM using an in-process key, keyed only by tenantId for this reference implementation.
 * NOT SUITABLE FOR PRODUCTION: keys are held in process memory with no HSM backing, no rotation,
 * and no audit trail of key usage. Swap for a real `EncryptionProvider` (AWS KMS envelope
 * encryption is the reference production implementation) before handling real PHI/PII.
 */
export class LocalDevEncryptionProvider implements EncryptionProvider {
  private keys = new Map<string, Buffer>();

  constructor() {
    // eslint-disable-next-line no-console
    console.warn(
      '[compliance-engine] LocalDevEncryptionProvider is active — DEV ONLY, do not use with real patient data.',
    );
  }

  async generateTenantKey(tenantId: string): Promise<string> {
    const keyId = `${tenantId}-key-1`;
    this.keys.set(keyId, randomBytes(32));
    return keyId;
  }

  async encrypt(tenantId: string, keyId: string, plaintext: Buffer) {
    const key = this.requireKey(keyId);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { ciphertext, iv, authTag: cipher.getAuthTag() };
  }

  async decrypt(tenantId: string, keyId: string, ciphertext: Buffer, iv: Buffer, authTag: Buffer) {
    const key = this.requireKey(keyId);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  private requireKey(keyId: string): Buffer {
    const key = this.keys.get(keyId);
    if (!key) throw new Error(`Unknown key id: ${keyId}`);
    return key;
  }
}
