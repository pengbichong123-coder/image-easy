import type Stripe from "stripe";
import { defaultLocale, hasLocale } from "@/i18n/routing";

export type CheckoutPaymentForValidation = {
  id: string;
  userId: string;
  stripeCheckoutSessionId: string | null;
  credits: number;
  amountCents: number;
  currency: string;
  status: string;
};

export function normalizeCheckoutLocale(locale: string | undefined) {
  return locale && hasLocale(locale) ? locale : defaultLocale;
}

export function buildCheckoutReturnUrls(appUrl: string, locale: string | undefined) {
  const normalizedAppUrl = appUrl.replace(/\/$/, "");
  const normalizedLocale = normalizeCheckoutLocale(locale);

  return {
    successUrl: `${normalizedAppUrl}/${normalizedLocale}/pricing?checkout=success`,
    cancelUrl: `${normalizedAppUrl}/${normalizedLocale}/pricing?checkout=cancel`,
  };
}

export function validateCheckoutSessionPaymentDetails(
  session: Stripe.Checkout.Session,
  payment: CheckoutPaymentForValidation,
) {
  if (session.metadata?.paymentId !== payment.id) {
    throw new Error("Stripe checkout session metadata paymentId does not match local payment");
  }

  if (session.metadata?.userId !== payment.userId) {
    throw new Error("Stripe checkout session metadata userId does not match local payment user");
  }

  if (payment.stripeCheckoutSessionId && session.id !== payment.stripeCheckoutSessionId) {
    throw new Error("Stripe checkout session id does not match local payment");
  }

  if (session.client_reference_id !== payment.userId) {
    throw new Error("Stripe checkout session client_reference_id does not match local payment user");
  }

  const metadataCredits = Number.parseInt(session.metadata?.credits ?? "", 10);
  if (!Number.isInteger(metadataCredits) || metadataCredits !== payment.credits) {
    throw new Error("Stripe checkout session metadata credits do not match local payment");
  }

  if (session.amount_total !== payment.amountCents) {
    throw new Error("Stripe checkout session amount does not match local payment");
  }

  if (session.currency?.toLowerCase() !== payment.currency.toLowerCase()) {
    throw new Error("Stripe checkout session currency does not match local payment");
  }
}

export function validateCheckoutSessionAgainstPayment(
  session: Stripe.Checkout.Session,
  payment: CheckoutPaymentForValidation,
) {
  if (session.payment_status !== "paid") {
    throw new Error("Stripe checkout session is not paid");
  }

  validateCheckoutSessionPaymentDetails(session, payment);
}
