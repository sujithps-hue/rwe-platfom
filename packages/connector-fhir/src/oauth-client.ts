export interface OAuthClientCredentials {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * SMART-on-FHIR "backend services" client-credentials flow (the standard way Epic/Cerner/Oracle
 * Health grant server-to-server FHIR API access to a registered app). Caches the token in memory
 * until shortly before expiry.
 */
export class SmartBackendOAuthClient {
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly credentials: OAuthClientCredentials) {}

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.value;
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
      scope: this.credentials.scope,
    });
    const response = await fetch(this.credentials.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new Error(`FHIR OAuth token request failed: ${response.status} ${await response.text()}`);
    }
    const token = (await response.json()) as TokenResponse;
    this.cachedToken = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
    return token.access_token;
  }
}
