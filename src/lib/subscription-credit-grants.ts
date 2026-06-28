function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function nextMonthlyCreditGrantAt(from: Date) {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const day = from.getUTCDate();
  const nextMonth = month + 1;
  const nextYear = year + Math.floor(nextMonth / 12);
  const normalizedNextMonth = nextMonth % 12;
  const clampedDay = Math.min(day, daysInMonth(nextYear, normalizedNextMonth));

  return new Date(Date.UTC(
    nextYear,
    normalizedNextMonth,
    clampedDay,
    from.getUTCHours(),
    from.getUTCMinutes(),
    from.getUTCSeconds(),
    from.getUTCMilliseconds(),
  ));
}

export function buildMonthlySubscriptionGrantKey(stripeSubscriptionId: string, grantAt: Date) {
  return `subscription_monthly:${stripeSubscriptionId}:${grantAt.toISOString().slice(0, 10)}`;
}

export function buildStripeInvoiceGrantKey(stripeInvoiceId: string) {
  return `stripe_invoice:${stripeInvoiceId}`;
}
