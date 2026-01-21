import type { NavigateFunction, To } from "react-router-dom";

/**
 * React Router stores a monotonically increasing `idx` on window.history.state.
 * When `idx` is 0, the user likely landed directly (deep link / fresh tab) and cannot go back.
 */
export function canNavigateBack(): boolean {
  const state = window.history.state as { idx?: number } | null;
  if (state && typeof state.idx === "number") return state.idx > 0;
  return window.history.length > 1;
}

export function navigateBack(
  navigate: NavigateFunction,
  fallback: To = "/",
  options?: { replace?: boolean }
) {
  if (canNavigateBack()) {
    navigate(-1);
    return;
  }

  navigate(fallback, { replace: options?.replace ?? true });
}
