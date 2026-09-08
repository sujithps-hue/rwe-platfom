import { Injectable } from '@nestjs/common';
import { BillingEvent, BillingProvider } from './billing-provider.interface';

/**
 * Reference `BillingProvider` targeting Stripe Billing (subscriptions + metered usage records).
 * NOT WIRED TO A REAL STRIPE ACCOUNT: this reference implementation intentionally does not bundle
 * the `stripe` SDK or real API calls, since doing so requires a live Stripe account, webhook
 * signing secret, and product/price configuration a deployment must set up itself. Each method
 * below documents exactly what the real Stripe call is; swap the throw for the real
 * `stripe.customers.create(...)` / `stripe.subscriptions.create(...)` / `stripe.subscriptionItems.createUsageRecord(...)`
 * / `stripe.webhooks.constructEvent(...)` calls once Stripe credentials are configured
 * (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
 */
@Injectable()
export class StripeBillingProvider implements BillingProvider {
  async createCustomer(_tenantId: string, _name: string, _billingEmail: string): Promise<string> {
    // Real implementation: `const customer = await stripe.customers.create({ name, email: billingEmail, metadata: { tenantId } }); return customer.id;`
    throw new Error('StripeBillingProvider is not configured — set STRIPE_SECRET_KEY and wire the real Stripe SDK call.');
  }

  async createSubscription(_tenantId: string, _billingProviderCustomerId: string, _planCode: string): Promise<string> {
    // Real implementation: look up the Stripe Price id for `planCode`, then
    // `const sub = await stripe.subscriptions.create({ customer: billingProviderCustomerId, items: [{ price: priceId }] }); return sub.id;`
    throw new Error('StripeBillingProvider is not configured — set STRIPE_SECRET_KEY and wire the real Stripe SDK call.');
  }

  async reportUsage(_subscriptionId: string, _meter: string, _quantity: number): Promise<void> {
    // Real implementation: `await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, { quantity, timestamp: 'now' });`
    throw new Error('StripeBillingProvider is not configured — set STRIPE_SECRET_KEY and wire the real Stripe SDK call.');
  }

  async handleWebhook(_payload: unknown, _signature: string): Promise<BillingEvent> {
    // Real implementation: `const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);`
    // then map event.type to a BillingEvent and pull tenantId back out of the customer/subscription metadata set in createCustomer above.
    throw new Error('StripeBillingProvider is not configured — set STRIPE_WEBHOOK_SECRET and wire the real Stripe SDK call.');
  }
}
