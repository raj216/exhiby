/**
 * planGates.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every feature that is gated by plan tier.
 * Add new gates here first — never scatter plan checks around the codebase.
 *
 * Rules:
 *  - null means "unlimited / unrestricted"
 *  - Each entry maps directly to what is shown on the Pricing page
 *  - Backend functions (edge functions) read these rules via the DB profile.plan
 *    column — keep DB values and these constants in sync.
 */

import type { PlanTier } from "@/hooks/usePlan";

export interface PlanGates {
  /** Max concurrent viewers per live session. null = unlimited. */
  maxAttendeesPerSession: number | null;

  /** Platform commission percentage charged on ticket + tip revenue (0–100). */
  commissionPct: number;

  /**
   * How many sessions get 0% commission (counted from the creator's first
   * ever paid session). After this count, commissionPct kicks in.
   */
  zeroCommissionSessions: number;

  /** Advanced analytics: retention, viewer demographics, peak times, etc. */
  hasAdvancedAnalytics: boolean;

  /** Custom studio branding: colors, URL slug. */
  hasCustomStudio: boolean;

  /** Priority support queue. */
  hasPrioritySupport: boolean;

  /** Early access to new features. */
  hasEarlyAccess: boolean;
}

export const PLAN_GATES: Record<PlanTier, PlanGates> = {
  free: {
    maxAttendeesPerSession: 50,
    commissionPct: 8,
    zeroCommissionSessions: 10,
    hasAdvancedAnalytics: false,
    hasCustomStudio: false,
    hasPrioritySupport: false,
    hasEarlyAccess: false,
  },
  pro: {
    maxAttendeesPerSession: null,
    commissionPct: 4,
    zeroCommissionSessions: 0,
    hasAdvancedAnalytics: true,
    hasCustomStudio: true,
    hasPrioritySupport: true,
    hasEarlyAccess: true,
  },
  plus: {
    maxAttendeesPerSession: null,
    commissionPct: 4,
    zeroCommissionSessions: 0,
    hasAdvancedAnalytics: true,
    hasCustomStudio: true,
    hasPrioritySupport: true,
    hasEarlyAccess: true,
  },
};

/** Convenience: get gates for a tier without a hook (safe to call outside React). */
export function getGates(tier: PlanTier): PlanGates {
  return PLAN_GATES[tier];
}
