export type BillingEventType =
  | "checkout_completed"
  | "invoice_paid"
  | "invoice_payment_failed"
  | "refund_created";

export type BillingEventStatus =
  | "paid"
  | "failed"
  | "refunded"
  | "informational";

export function billingEventLabel(type: string) {
  if (type === "checkout_completed") return "Checkout completed";
  if (type === "invoice_paid") return "Invoice paid";
  if (type === "invoice_payment_failed") return "Payment failed";
  if (type === "refund_created") return "Refund recorded";
  return "Billing event";
}

export function mostImportantBillingStatus(statuses: string[]) {
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("refunded")) return "refunded";
  if (statuses.includes("paid")) return "paid";
  return "informational";
}

export function stripeAmountToCents(value: number | null | undefined) {
  return typeof value === "number" ? value : null;
}

export function stripeCurrency(value: string | null | undefined) {
  return value ? value.toLowerCase() : null;
}
