export interface BillingEvent {
  type: 'subscription_created' | 'subscription_canceled' | 'invoice_paid' | 'invoice_failed';
  tenantId: string;
  raw: unknown;
}

/**
 * Provider-agnostic billing interface (docs/MONETIZATION.md#billing-provider-abstraction). The
 * default target is Stripe Billing; a deployment needing a different payment rail (common for
 * UAE/KSA/APAC customers using a local gateway) implements this same interface.
 */
export interface BillingProvider {
  createCustomer(tenantId: string, name: string, billingEmail: string): Promise<string>;
  createSubscription(tenantId: string, billingProviderCustomerId: string, planCode: string): Promise<string>;
  reportUsage(subscriptionId: string, meter: string, quantity: number): Promise<void>;
  handleWebhook(payload: unknown, signature: string): Promise<BillingEvent>;
}
