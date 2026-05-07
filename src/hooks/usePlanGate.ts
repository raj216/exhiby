/**
 * usePlanGate
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook — returns the feature gates for the currently logged-in user.
 * Components use this to show/hide features or display upgrade prompts.
 *
 * Usage:
 *   const { gates, tier, canJoinSession, upgradeRequired } = usePlanGate();
 */

import { useCallback } from "react";
import { usePlan } from "@/hooks/usePlan";
import { PLAN_GATES, type PlanGates } from "@/lib/planGates";
import type { PlanTier } from "@/hooks/usePlan";

export interface PlanGateResult {
  tier: PlanTier;
  gates: PlanGates;
  isLoading: boolean;

  /**
   * Check whether a feature key is available on the current plan.
   * Returns true if unlocked, false if gated (needs upgrade).
   */
  can: (feature: keyof PlanGates) => boolean;

  /**
   * Check if a session with `currentViewerCount` viewers can accept one more
   * viewer, based on the creator's plan gates.
   */
  canViewerJoin: (currentViewerCount: number) => boolean;

  /** True if the user should see an upgrade nudge. */
  shouldNudgeUpgrade: boolean;
}

export function usePlanGate(): PlanGateResult {
  const { tier, isLoading } = usePlan();
  const gates = PLAN_GATES[tier];

  const can = useCallback(
    (feature: keyof PlanGates): boolean => {
      const value = gates[feature];
      if (typeof value === "boolean") return value;
      if (value === null) return true; // null = unlimited = unlocked
      return true; // numeric limits are checked separately
    },
    [gates]
  );

  const canViewerJoin = useCallback(
    (currentViewerCount: number): boolean => {
      if (gates.maxAttendeesPerSession === null) return true;
      return currentViewerCount < gates.maxAttendeesPerSession;
    },
    [gates.maxAttendeesPerSession]
  );

  return {
    tier,
    gates,
    isLoading,
    can,
    canViewerJoin,
    shouldNudgeUpgrade: tier === "free",
  };
}
