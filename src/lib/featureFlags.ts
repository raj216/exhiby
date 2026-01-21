/**
 * Feature Flags Configuration
 * 
 * Central configuration for enabling/disabling features.
 * This allows the app to run without certain integrations (e.g., Stripe)
 * until they are properly configured.
 */

export const featureFlags = {
  /**
   * Payments Feature Flag
   * When false:
   * - All events are treated as free
   * - Payout buttons are hidden
   * - Payment drawers show "Coming Soon" instead of processing
   * - Wallet & Earnings navigation is disabled
   * 
   * Set to true once Stripe is properly integrated
   */
  paymentsEnabled: false,
  
  /**
   * Check if paid events should be allowed
   * Returns false if payments are disabled
   */
  isPaidEventsEnabled: () => featureFlags.paymentsEnabled,
  
  /**
   * Get effective price for an event
   * Returns 0 if payments are disabled
   */
  getEffectivePrice: (price: number, isFree: boolean) => {
    if (!featureFlags.paymentsEnabled) return 0;
    return isFree ? 0 : price;
  },
  
  /**
   * Check if event requires payment
   * Always returns false if payments are disabled
   */
  requiresPayment: (price: number, isFree: boolean) => {
    if (!featureFlags.paymentsEnabled) return false;
    return !isFree && price > 0;
  },
} as const;

export default featureFlags;
