/**
 * Processing Fee Calculator
 * 
 * Calculates buyer-paid Stripe processing fees.
 * Formula: round_up(ticket_price * 0.029 + 0.30, 2)
 * 
 * This fee is added ON TOP of the ticket price at checkout.
 * It does NOT affect creator earnings or platform fee calculations.
 */

/**
 * Calculate the Stripe processing fee for a given ticket price.
 * @param ticketPrice - The ticket price in dollars (e.g. 10.00)
 * @returns The processing fee in dollars, rounded up to 2 decimal places
 */
export function calculateProcessingFee(ticketPrice: number): number {
  if (ticketPrice <= 0) return 0;
  // Work in cents to avoid floating point errors
  const priceCents = Math.round(ticketPrice * 100);
  const feeCents = Math.ceil(priceCents * 0.029 + 30);
  return feeCents / 100;
}

/**
 * Calculate the total amount the buyer pays (ticket + processing fee).
 * @param ticketPrice - The ticket price in dollars
 * @returns The total charge amount in dollars
 */
export function calculateBuyerTotal(ticketPrice: number): number {
  if (ticketPrice <= 0) return 0;
  return ticketPrice + calculateProcessingFee(ticketPrice);
}

/**
 * Get a full pricing breakdown for display.
 */
export function getPricingBreakdown(ticketPrice: number) {
  const processingFee = calculateProcessingFee(ticketPrice);
  const total = ticketPrice + processingFee;
  return {
    ticketPrice,
    processingFee,
    total,
  };
}

/**
 * Server-side: Calculate processing fee from cents.
 * @param ticketPriceCents - The ticket price in cents
 * @returns The processing fee in cents
 */
export function calculateProcessingFeeCents(ticketPriceCents: number): number {
  if (ticketPriceCents <= 0) return 0;
  return Math.ceil(ticketPriceCents * 0.029 + 30);
}
