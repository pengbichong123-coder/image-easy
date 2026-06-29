export function buildStripeInvoiceGrantKey(stripeInvoiceId: string) {
  return `stripe_invoice:${stripeInvoiceId}`;
}
